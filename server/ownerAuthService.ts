import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { getAdminClient, getOwnerEmail } from './supabaseAdmin.js';

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const OWNER_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 45 * 1000;
export const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;
export const OTP_MAX_REQUESTS_PER_WINDOW = 5;
export const OTP_LOCKOUT_MS = 15 * 60 * 1000;

export interface OtpRecord {
  id: string;
  ownerUserId: string;
  ownerEmail: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  used: boolean;
  usedAt: number | null;
  expiresAt: number;
  createdAt: number;
  ip: string;
}

export interface OwnerSessionRecord {
  id: string;
  ownerUserId: string;
  ownerEmail: string;
  sessionHash: string;
  expiresAt: number;
  revoked: boolean;
  createdAt: number;
  lastSeenAt: number;
}

export interface AuditLogEntry {
  id: string;
  owner_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  ip_address: string;
  created_at: string;
}

export type EmailSenderFn = (params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) => Promise<void>;

// Ephemeral fallback secret per server boot if OWNER_SESSION_SECRET is omitted in dev;
// configuring OWNER_SESSION_SECRET in environment keeps sessions valid across restarts.
const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  const configured = process.env.OWNER_SESSION_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (configured && configured.length >= 16) return configured;
  return EPHEMERAL_FALLBACK_SECRET;
}

function hashSecretValue(value: string, salt = ''): string {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(`${salt}:${value}`)
    .digest('hex');
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

// Server-side in-memory stores (mirrored to Supabase when 002 migration + service_role exist)
const otpStore = new Map<string, OtpRecord>();
const requestTimestampsByKey = new Map<string, number[]>();
const lockoutUntilByKey = new Map<string, number>();
const ownerSessionStore = new Map<string, OwnerSessionRecord>();
const memoryAuditLogs: AuditLogEntry[] = [];

let customEmailSender: EmailSenderFn | null = null;

export function setEmailSenderForTesting(fn: EmailSenderFn | null): void {
  customEmailSender = fn;
}

export function resetOwnerAuthRateLimitsForTesting(): void {
  otpStore.clear();
  requestTimestampsByKey.clear();
  lockoutUntilByKey.clear();
  ownerSessionStore.clear();
}

export function isOwnerSessionSecretConfigured(): boolean {
  const secret = process.env.OWNER_SESSION_SECRET?.trim() || '';
  return secret.length >= 16;
}

export function getEmailDeliveryStatus(): {
  configured: boolean;
  provider: 'smtp' | 'resend' | 'none';
} {
  if (customEmailSender) {
    return { configured: true, provider: 'smtp' };
  }
  const hasSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
  if (hasSmtp) return { configured: true, provider: 'smtp' };
  if (process.env.RESEND_API_KEY?.trim()) return { configured: true, provider: 'resend' };
  return { configured: false, provider: 'none' };
}

export function diagnoseEmailDeliveryConfig(): {
  configured: boolean;
  provider: 'smtp' | 'resend' | 'none';
  missingFields: string[];
  detail: string;
} {
  if (customEmailSender) {
    return {
      configured: true,
      provider: 'smtp',
      missingFields: [],
      detail: 'Email transport active.',
    };
  }

  const smtpHost = process.env.SMTP_HOST?.trim() || '';
  const smtpUser = process.env.SMTP_USER?.trim() || '';
  const smtpPass = process.env.SMTP_PASS?.trim() || '';
  const smtpPort = process.env.SMTP_PORT?.trim() || '587';
  const resendKey = process.env.RESEND_API_KEY?.trim() || '';

  if (smtpHost && smtpUser && smtpPass) {
    return {
      configured: true,
      provider: 'smtp',
      missingFields: [],
      detail: `SMTP configured (${smtpHost}:${smtpPort}).`,
    };
  }

  if (resendKey) {
    return {
      configured: true,
      provider: 'resend',
      missingFields: [],
      detail: 'Resend HTTPS email delivery configured.',
    };
  }

  const missing: string[] = [];
  if (!smtpHost) missing.push('SMTP_HOST');
  if (!smtpUser) missing.push('SMTP_USER');
  if (!smtpPass) missing.push('SMTP_PASS');

  return {
    configured: false,
    provider: 'none',
    missingFields: missing,
    detail: `Email delivery not configured: set ${missing.join(', ')} (or RESEND_API_KEY) on the server.`,
  };
}

async function sendOwnerVerificationEmail(to: string, code: string, expiresMinutes: number): Promise<void> {
  const subject = 'YOUNEEL TRADING — Owner Verification Code';
  const text = [
    'YOUNEEL TRADING Private Owner Mode Verification',
    '',
    `Your single-use verification code is: ${code}`,
    `This code expires in ${expiresMinutes} minutes.`,
    '',
    'If you did not initiate this Owner Mode sign-in attempt, ignore this message and review your account security immediately.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0c0c0e; color:#f4f4f5; padding:32px; border-radius:16px; max-width:520px; margin:0 auto;">
      <p style="font-size:12px; letter-spacing:0.14em; text-transform:uppercase; color:#10b981; margin:0 0 8px;">YOUNEEL TRADING SECURITY</p>
      <h1 style="font-size:20px; font-weight:700; margin:0 0 16px; color:#ffffff;">Owner Mode Verification Code</h1>
      <p style="font-size:14px; color:#a1a1aa; line-height:1.6; margin:0 0 20px;">
        Use the single-use verification code below to unlock private Owner Mode. It expires in <strong style="color:#ffffff;">${expiresMinutes} minutes</strong>.
      </p>
      <div style="background:#18181b; border:1px solid #27272a; border-radius:12px; padding:20px; text-align:center; margin:0 0 20px;">
        <span style="font-family:monospace; font-size:32px; font-weight:800; letter-spacing:0.3em; color:#ffffff;">${code}</span>
      </div>
      <p style="font-size:12px; color:#71717a; line-height:1.5; margin:0;">
        If you did not initiate this request, change your password immediately and review your Owner security logs.
      </p>
    </div>
  `;

  if (customEmailSender) {
    await customEmailSender({ to, subject, text, html });
    return;
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (smtpHost && smtpUser && smtpPass) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const from = process.env.SMTP_FROM?.trim() || `YOUNEEL TRADING Security <${smtpUser}>`;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port,
      secure,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    try {
      await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      return;
    } catch (err: any) {
      const code = err?.code || err?.responseCode || 'SMTP_ERROR';
      // Log diagnostic summary without ever exposing SMTP_PASS, OTP code, or user secrets
      console.error('[OwnerAuth] SMTP delivery error:', {
        host: smtpHost,
        port,
        secure,
        code,
        command: err?.command || 'sendMail',
        reason: err?.message || 'Unknown SMTP failure',
      });
      if (code === 'EAUTH' || err?.responseCode === 535) {
        throw new Error('SMTP authentication failed (check SMTP_USER and SMTP_PASS / app password).');
      }
      if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
        throw new Error(`Unable to reach SMTP server ${smtpHost}:${port} (${code}).`);
      }
      throw new Error(`SMTP delivery failed (${code}): ${err?.message || 'check SMTP configuration'}`);
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const from = process.env.SMTP_FROM?.trim() || 'YOUNEEL TRADING <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) detail = `${detail}: ${body.message}`;
      } catch {
        // ignore JSON parse failure
      }
      console.error('[OwnerAuth] Resend delivery failed:', { status: res.status, detail });
      throw new Error(`Email provider rejected request (${detail})`);
    }
    return;
  }

  const diag = diagnoseEmailDeliveryConfig();
  console.error('[OwnerAuth] Email delivery requested while unconfigured:', {
    missingFields: diag.missingFields,
  });
  throw new Error(diag.detail);
}

export async function recordOwnerAudit(params: {
  userId?: string | null;
  email: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip?: string;
  db?: SupabaseClient | null;
}): Promise<void> {
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    owner_email: params.email,
    action: params.action,
    resource_type: params.resourceType || '',
    resource_id: params.resourceId || '',
    details: params.details || {},
    ip_address: params.ip || '',
    created_at: new Date().toISOString(),
  };

  memoryAuditLogs.unshift(entry);
  if (memoryAuditLogs.length > 100) memoryAuditLogs.length = 100;

  const client = params.db || getAdminClient();
  if (client) {
    try {
      await client.from('owner_audit_logs').insert([
        {
          owner_user_id: params.userId || null,
          owner_email: params.email,
          action: params.action,
          resource_type: params.resourceType || '',
          resource_id: params.resourceId || '',
          details: params.details || {},
          ip_address: params.ip || '',
        },
      ]);
    } catch {
      // Ignore if migration 002 hasn't been executed yet
    }
  }
}

export async function getRecentAuditLogs(db?: SupabaseClient | null): Promise<AuditLogEntry[]> {
  const client = db || getAdminClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('owner_audit_logs')
        .select('id, owner_email, action, resource_type, resource_id, details, ip_address, created_at')
        .order('created_at', { ascending: false })
        .limit(40);
      if (!error && Array.isArray(data) && data.length > 0) {
        return data as AuditLogEntry[];
      }
    } catch {
      // fallback to memory ring buffer
    }
  }
  return [...memoryAuditLogs];
}

export async function requestOwnerVerificationCode(params: {
  user: User;
  ip: string;
  db: SupabaseClient;
  nowMs?: number;
}): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  expiresInSeconds?: number;
  retryAfterSeconds?: number;
}> {
  const now = params.nowMs ?? Date.now();
  const ownerEmail = getOwnerEmail();
  const userEmail = (params.user.email || '').trim().toLowerCase();

  if (userEmail !== ownerEmail) {
    return { ok: false, status: 403, error: 'Unauthorized owner account' };
  }

  const delivery = getEmailDeliveryStatus();
  if (!delivery.configured) {
    return {
      ok: false,
      status: 503,
      error: 'Email verification delivery is not configured on the server.',
    };
  }

  const rateKey = `${userEmail}:${params.ip}`;
  const lockedUntil = lockoutUntilByKey.get(rateKey) || 0;
  if (lockedUntil > now) {
    return {
      ok: false,
      status: 429,
      error: 'Too many verification attempts. Please wait before requesting a new code.',
      retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
    };
  }

  const recentRequests = (requestTimestampsByKey.get(userEmail) || []).filter(
    (ts) => now - ts < OTP_REQUEST_WINDOW_MS
  );
  if (recentRequests.length > 0) {
    const latest = recentRequests[recentRequests.length - 1];
    if (now - latest < OTP_RESEND_COOLDOWN_MS) {
      return {
        ok: false,
        status: 429,
        error: 'Please wait before requesting another verification code.',
        retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - latest)) / 1000),
      };
    }
  }
  if (recentRequests.length >= OTP_MAX_REQUESTS_PER_WINDOW) {
    return {
      ok: false,
      status: 429,
      error: 'Verification request limit reached. Try again later.',
      retryAfterSeconds: Math.ceil(OTP_REQUEST_WINDOW_MS / 1000),
    };
  }

  // Invalidate any previously active unused codes for this owner (single active code at a time)
  for (const [, existing] of otpStore.entries()) {
    if (existing.ownerEmail === userEmail && !existing.used) {
      existing.used = true;
      existing.usedAt = now;
    }
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const id = crypto.randomUUID();
  const codeHash = hashSecretValue(code, userEmail);
  const expiresAt = now + OTP_TTL_MS;

  const record: OtpRecord = {
    id,
    ownerUserId: params.user.id,
    ownerEmail: userEmail,
    codeHash,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    used: false,
    usedAt: null,
    expiresAt,
    createdAt: now,
    ip: params.ip,
  };

  try {
    await sendOwnerVerificationEmail(ownerEmail, code, Math.round(OTP_TTL_MS / 60000));
  } catch (err: any) {
    return {
      ok: false,
      status: 502,
      error: err?.message || 'Failed to deliver verification email',
    };
  }

  otpStore.set(id, record);
  recentRequests.push(now);
  requestTimestampsByKey.set(userEmail, recentRequests);

  const adminDb = getAdminClient();
  if (adminDb) {
    try {
      await adminDb
        .from('owner_verification_codes')
        .update({ used: true, used_at: new Date(now).toISOString() })
        .eq('owner_email', userEmail)
        .eq('used', false);

      await adminDb.from('owner_verification_codes').insert([
        {
          id,
          owner_user_id: params.user.id,
          owner_email: userEmail,
          code_hash: codeHash,
          attempts: 0,
          max_attempts: OTP_MAX_ATTEMPTS,
          used: false,
          expires_at: new Date(expiresAt).toISOString(),
          requested_ip: params.ip,
        },
      ]);
    } catch {
      // Optional table before SQL migration
    }
  }

  await recordOwnerAudit({
    userId: params.user.id,
    email: userEmail,
    action: 'owner.otp.requested',
    resourceType: 'auth',
    ip: params.ip,
    db: adminDb,
  });

  return {
    ok: true,
    status: 200,
    expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
  };
}

export async function verifyOwnerVerificationCode(params: {
  user: User;
  code: string;
  ip: string;
  userAgent?: string;
  nowMs?: number;
}): Promise<{
  ok: boolean;
  status: number;
  error?: string;
  sessionToken?: string;
  expiresAt?: string;
}> {
  const now = params.nowMs ?? Date.now();
  const ownerEmail = getOwnerEmail();
  const userEmail = (params.user.email || '').trim().toLowerCase();

  if (userEmail !== ownerEmail) {
    return { ok: false, status: 403, error: 'Unauthorized owner account' };
  }

  const rateKey = `${userEmail}:${params.ip}`;
  const lockedUntil = lockoutUntilByKey.get(rateKey) || 0;
  if (lockedUntil > now) {
    return {
      ok: false,
      status: 429,
      error: 'Verification locked due to repeated invalid attempts. Request a new code later.',
    };
  }

  const cleanCode = String(params.code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, status: 400, error: 'Enter the 6-digit verification code.' };
  }

  // Locate latest OTP record for owner
  let activeRecord: OtpRecord | null = null;
  for (const rec of otpStore.values()) {
    if (rec.ownerEmail === userEmail) {
      if (!activeRecord || rec.createdAt > activeRecord.createdAt) {
        activeRecord = rec;
      }
    }
  }

  if (!activeRecord) {
    return { ok: false, status: 400, error: 'No active verification code found. Request a new code.' };
  }

  if (activeRecord.used) {
    return { ok: false, status: 400, error: 'Verification code has already been used.' };
  }

  if (now > activeRecord.expiresAt) {
    activeRecord.used = true;
    activeRecord.usedAt = now;
    return { ok: false, status: 400, error: 'Verification code expired. Request a new code.' };
  }

  const submittedHash = hashSecretValue(cleanCode, userEmail);
  const matches = constantTimeHexEqual(submittedHash, activeRecord.codeHash);

  if (!matches) {
    activeRecord.attempts += 1;
    if (activeRecord.attempts >= activeRecord.maxAttempts) {
      activeRecord.used = true;
      activeRecord.usedAt = now;
      lockoutUntilByKey.set(rateKey, now + OTP_LOCKOUT_MS);
      await recordOwnerAudit({
        userId: params.user.id,
        email: userEmail,
        action: 'owner.otp.locked',
        resourceType: 'auth',
        ip: params.ip,
      });
      return {
        ok: false,
        status: 429,
        error: 'Too many invalid attempts. Verification locked temporarily.',
      };
    }
    return { ok: false, status: 401, error: 'Invalid verification code.' };
  }

  // Mark code single-use immediately
  activeRecord.used = true;
  activeRecord.usedAt = now;

  // Create signed owner session token
  const sessionId = crypto.randomUUID();
  const sessionExpiresAt = now + OWNER_SESSION_TTL_MS;
  const payloadB64 = Buffer.from(
    JSON.stringify({
      sid: sessionId,
      uid: params.user.id,
      email: userEmail,
      exp: sessionExpiresAt,
    }),
    'utf8'
  ).toString('base64url');
  const sig = hashSecretValue(payloadB64, 'owner_session');
  const sessionToken = `${payloadB64}.${sig}`;
  const sessionHash = hashSecretValue(sessionToken, 'session_store');

  ownerSessionStore.set(sessionId, {
    id: sessionId,
    ownerUserId: params.user.id,
    ownerEmail: userEmail,
    sessionHash,
    expiresAt: sessionExpiresAt,
    revoked: false,
    createdAt: now,
    lastSeenAt: now,
  });

  const adminDb = getAdminClient();
  if (adminDb) {
    try {
      await adminDb
        .from('owner_verification_codes')
        .update({ used: true, used_at: new Date(now).toISOString() })
        .eq('id', activeRecord.id);

      await adminDb.from('owner_sessions').insert([
        {
          id: sessionId,
          owner_user_id: params.user.id,
          owner_email: userEmail,
          session_hash: sessionHash,
          expires_at: new Date(sessionExpiresAt).toISOString(),
          ip_address: params.ip,
          user_agent: (params.userAgent || '').slice(0, 240),
        },
      ]);

      // Ensure profiles.role is set server-side to 'owner'
      await adminDb
        .from('profiles')
        .update({ role: 'owner' })
        .eq('id', params.user.id);
    } catch {
      // Ignore if migration 002 hasn't been executed yet
    }
  }

  await recordOwnerAudit({
    userId: params.user.id,
    email: userEmail,
    action: 'owner.otp.verified',
    resourceType: 'auth',
    resourceId: sessionId,
    ip: params.ip,
    db: adminDb,
  });

  return {
    ok: true,
    status: 200,
    sessionToken,
    expiresAt: new Date(sessionExpiresAt).toISOString(),
  };
}

export function validateOwnerSessionToken(params: {
  token?: string | null;
  user: User;
  nowMs?: number;
}): { valid: boolean; sessionId?: string; expiresAt?: string; reason?: string } {
  const now = params.nowMs ?? Date.now();
  const ownerEmail = getOwnerEmail();
  const userEmail = (params.user.email || '').trim().toLowerCase();
  if (userEmail !== ownerEmail) {
    return { valid: false, reason: 'Email is not authorized owner' };
  }

  const raw = (params.token || '').trim();
  if (!raw || !raw.includes('.')) {
    return { valid: false, reason: 'Missing owner verification session' };
  }

  const [payloadB64, sig] = raw.split('.');
  if (!payloadB64 || !sig) {
    return { valid: false, reason: 'Malformed owner session token' };
  }

  const expectedSig = hashSecretValue(payloadB64, 'owner_session');
  if (!constantTimeHexEqual(sig, expectedSig)) {
    return { valid: false, reason: 'Invalid owner session signature' };
  }

  let parsed: { sid?: string; uid?: string; email?: string; exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { valid: false, reason: 'Corrupted owner session payload' };
  }

  if (
    !parsed.sid ||
    parsed.uid !== params.user.id ||
    parsed.email !== userEmail ||
    !parsed.exp ||
    now > parsed.exp
  ) {
    return { valid: false, reason: 'Owner verification session expired' };
  }

  const stored = ownerSessionStore.get(parsed.sid);
  if (stored) {
    if (stored.revoked) {
      return { valid: false, reason: 'Owner session revoked' };
    }
    stored.lastSeenAt = now;
  }

  return {
    valid: true,
    sessionId: parsed.sid,
    expiresAt: new Date(parsed.exp).toISOString(),
  };
}

export function getActiveOtpSummary(ownerEmail: string, nowMs = Date.now()): {
  hasActiveCode: boolean;
  expiresAt: string | null;
} {
  const normalized = ownerEmail.trim().toLowerCase();
  let latest: OtpRecord | null = null;
  for (const rec of otpStore.values()) {
    if (rec.ownerEmail === normalized && !rec.used && nowMs <= rec.expiresAt) {
      if (!latest || rec.createdAt > latest.createdAt) {
        latest = rec;
      }
    }
  }
  return {
    hasActiveCode: Boolean(latest),
    expiresAt: latest ? new Date(latest.expiresAt).toISOString() : null,
  };
}

export function revokeOwnerSessionToken(token?: string | null): void {
  const raw = (token || '').trim();
  if (!raw || !raw.includes('.')) return;
  const [payloadB64] = raw.split('.');
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (parsed?.sid && ownerSessionStore.has(parsed.sid)) {
      const rec = ownerSessionStore.get(parsed.sid)!;
      rec.revoked = true;
    }
  } catch {
    // ignore malformed token on logout
  }
}

