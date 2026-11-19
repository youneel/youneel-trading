import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { getServerConfig } from './config.js';

export function getSupabaseUrl(): string {
  return getServerConfig().supabaseUrl;
}

export function getSupabasePublishableKey(): string {
  return getServerConfig().supabaseAnonKey;
}

export function getServiceRoleKey(): string {
  return getServerConfig().supabaseServiceRoleKey;
}

export function isServiceRoleConfigured(): boolean {
  const cfg = getServerConfig();
  return cfg.supabaseUrlValid && cfg.serviceRoleConfigured;
}

export function getAdminClient(): SupabaseClient | null {
  const cfg = getServerConfig();
  if (!cfg.supabaseUrlValid) {
    console.error('[SupabaseAdmin] Invalid SUPABASE_URL configured on server; admin client disabled.');
    return null;
  }
  if (!cfg.serviceRoleConfigured || !cfg.supabaseServiceRoleKey) {
    return null;
  }
  return createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getUserScopedClient(accessToken: string): SupabaseClient {
  const cfg = getServerConfig();
  if (!cfg.supabaseUrlValid) {
    throw new Error('Server SUPABASE_URL is invalid.');
  }
  return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Verifies the Bearer token directly with Supabase Auth and returns the authenticated User + DB client.
 */
export async function authenticateRequest(authHeader?: string): Promise<{
  user: User;
  token: string;
  db: SupabaseClient;
  usingServiceRole: boolean;
} | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const cfg = getServerConfig();
  if (!cfg.supabaseUrlValid) {
    console.error('[SupabaseAdmin] Refusing auth verification because SUPABASE_URL is invalid.');
    return null;
  }

  const client = getUserScopedClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;

  const adminClient = getAdminClient();
  return {
    user: data.user,
    token,
    db: adminClient || client,
    usingServiceRole: Boolean(adminClient),
  };
}

/**
 * Checks if authenticated user is an authorized administrator.
 */
export async function isAuthorizedAdmin(user: User, db: SupabaseClient): Promise<boolean> {
  const adminEmailsRaw = process.env.ADMIN_EMAILS || 'luca666lu@gmail.com';
  const allowedEmails = adminEmailsRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (user.email && allowedEmails.includes(user.email.toLowerCase())) {
    return true;
  }

  try {
    const { data } = await db
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (data && (data as any).role === 'admin') {
      return true;
    }
  } catch {
    // role column might not exist yet before SQL migration
  }

  return false;
}

export function getOwnerEmail(): string {
  return getServerConfig().ownerEmail;
}

export interface OwnerVerificationDetails {
  authorized: boolean;
  emailMatchesOwner: boolean;
  emailConfirmed: boolean;
  profileRole: 'owner' | 'trader' | 'admin' | 'missing' | 'column_missing';
  roleAutoProvisioned: boolean;
  reason: string;
}

/**
 * Server-side owner verification + idempotent profile provisioning.
 * - Verifies Supabase Auth JWT user email against server-side OWNER_EMAIL.
 * - Never trusts client-supplied role values.
 * - When service_role + migration 002 are present, ensures the existing owner profile
 *   carries role='owner' without modifying or duplicating other accounts.
 */
export async function verifyAndProvisionOwner(
  user: User,
  db: SupabaseClient,
  usingServiceRole: boolean
): Promise<OwnerVerificationDetails> {
  const ownerEmail = getOwnerEmail();
  const userEmail = (user.email || '').trim().toLowerCase();
  const emailConfirmed = Boolean(user.email_confirmed_at || (user as any).confirmed_at);

  if (!userEmail || userEmail !== ownerEmail) {
    return {
      authorized: false,
      emailMatchesOwner: false,
      emailConfirmed,
      profileRole: 'missing',
      roleAutoProvisioned: false,
      reason: 'Authenticated email does not match configured OWNER_EMAIL.',
    };
  }

  if (!emailConfirmed) {
    return {
      authorized: false,
      emailMatchesOwner: true,
      emailConfirmed: false,
      profileRole: 'missing',
      roleAutoProvisioned: false,
      reason: 'Owner Supabase email address is not yet confirmed.',
    };
  }

  let profileRole: OwnerVerificationDetails['profileRole'] = 'missing';
  let roleAutoProvisioned = false;

  try {
    const { data, error } = await db
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      if (error.code === '42703' || error.message?.includes('role')) {
        profileRole = 'column_missing';
      }
    } else if (data) {
      const currentRole = (data as any).role;
      profileRole =
        currentRole === 'owner' || currentRole === 'admin' || currentRole === 'trader'
          ? currentRole
          : 'trader';

      if (currentRole !== 'owner' && usingServiceRole) {
        const { error: updErr } = await db
          .from('profiles')
          .update({ role: 'owner' })
          .eq('id', user.id);
        if (!updErr) {
          profileRole = 'owner';
          roleAutoProvisioned = true;
        }
      }
    } else if (usingServiceRole) {
      // Idempotently provision missing profile row for the verified owner account only
      const { error: insErr } = await db.from('profiles').upsert(
        [
          {
            id: user.id,
            display_name: userEmail.split('@')[0],
            starting_capital: 10000,
            role: 'owner',
          },
        ],
        { onConflict: 'id' }
      );
      if (!insErr) {
        profileRole = 'owner';
        roleAutoProvisioned = true;
      }
    }
  } catch {
    profileRole = 'column_missing';
  }

  return {
    authorized: true,
    emailMatchesOwner: true,
    emailConfirmed: true,
    profileRole,
    roleAutoProvisioned,
    reason: 'Authenticated Supabase owner account verified.',
  };
}

/**
 * Strictly verifies the private YOUNEEL owner account.
 * Normal administrators and standard users are explicitly rejected.
 */
export async function isAuthorizedOwner(
  user: User,
  db: SupabaseClient,
  usingServiceRole = isServiceRoleConfigured()
): Promise<boolean> {
  const details = await verifyAndProvisionOwner(user, db, usingServiceRole);
  return details.authorized;
}
