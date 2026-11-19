import dotenv from 'dotenv';

const CANONICAL_SUPABASE_URL = 'https://xhqvlqygqvyniuiqjjzx.supabase.co';
const CANONICAL_SUPABASE_ANON_KEY = 'sb_publishable_8sLROvIDtB-WfqqSNkWsfw_2dAmTJLS';
const DEFAULT_OWNER_EMAIL = 'younesselidrissi64@gmail.com';

const KNOWN_PLACEHOLDERS = new Set([
  'my_gemini_api_key',
  'my_app_url',
  'replace_me',
  'changeme',
  'your_secret_here',
  'your_service_role_key',
  'null',
  'undefined',
]);

let localEnvBootstrapped = false;
let startupLogged = false;

export type SupabaseKeyFormat =
  | 'jwt_service_role'
  | 'sb_secret'
  | 'opaque_secret'
  | 'invalid_publishable'
  | 'invalid_placeholder'
  | 'missing';

export interface ServerConfig {
  runtime: 'vercel-serverless' | 'serverless' | 'node';
  isServerless: boolean;
  vercelEnv: string | null;
  nodeVersion: string;
  supabaseUrl: string;
  supabaseUrlValid: boolean;
  supabaseUrlSource: 'env' | 'default_project';
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  serviceRoleKeySource: string | null;
  serviceRoleKeyFormat: SupabaseKeyFormat;
  serviceRoleConfigured: boolean;
  ownerSessionSecret: string;
  ownerSessionSecretConfigured: boolean;
  ownerSessionSecretStrong: boolean;
  signingSecret: string;
  signingSecretConfigured: boolean;
  signingSecretSource: 'OWNER_SESSION_SECRET' | 'SUPABASE_SERVICE_ROLE_KEY' | 'none';
  ownerEmail: string;
  cronSecret: string;
  cronSecretConfigured: boolean;
  emailDeliveryConfigured: boolean;
}

export interface SafeConfigDiagnostics {
  runtime: 'vercel-serverless' | 'serverless' | 'node';
  vercelEnv: string | null;
  nodeVersion: string;
  hasOwnerSessionSecret: boolean;
  ownerSessionSecretConfigured: boolean;
  ownerSessionSecretStrong: boolean;
  hasServiceRoleKey: boolean;
  serviceRoleKeySource: string | null;
  serviceRoleKeyFormat: SupabaseKeyFormat;
  hasSupabaseUrl: boolean;
  supabaseUrlValid: boolean;
  supabaseUrlSource: 'env' | 'default_project';
  hasSupabaseAnonKey: boolean;
  hasOwnerEmail: boolean;
  hasEmailDelivery: boolean;
  hasCronSecret: boolean;
  signingSecretConfigured: boolean;
  signingSecretSource: 'OWNER_SESSION_SECRET' | 'SUPABASE_SERVICE_ROLE_KEY' | 'none';
}

export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY
  );
}

/**
 * Loads .env.local / .env strictly for local non-serverless runs BEFORE reading process.env.
 * Never overrides variables injected by Vercel / hosting runtimes.
 */
export function ensureServerEnvBootstrapped(): void {
  if (localEnvBootstrapped) return;
  localEnvBootstrapped = true;
  if (!isServerlessRuntime()) {
    dotenv.config({ path: ['.env.local', '.env'], override: false, quiet: true });
  }
}

// Execute immediately when imported as first module in server.ts / api/index.ts.
ensureServerEnvBootstrapped();

function cleanRawEnvValue(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Reads the first non-empty server-only environment variable from `names` directly from `process.env`.
 */
export function readServerEnv(...names: string[]): { value: string; matchedKey: string | null } {
  ensureServerEnvBootstrapped();
  for (const name of names) {
    const cleaned = cleanRawEnvValue(process.env[name]);
    if (cleaned.length > 0) {
      return { value: cleaned, matchedKey: name };
    }
  }
  return { value: '', matchedKey: null };
}

function isPlaceholderValue(val: string): boolean {
  if (!val) return true;
  return KNOWN_PLACEHOLDERS.has(val.toLowerCase());
}

/**
 * Inspects Supabase secret/service_role key format without assuming legacy JWT structure.
 * Supports:
 * - Legacy JWT service_role key (`eyJ...`)
 * - Modern Supabase Secret Key (`sb_secret_...`)
 * - Other valid server secret tokens (>= 20 chars)
 * Rejects public/publishable keys (`sb_publishable_...` or JWT `role: "anon"`).
 */
export function classifySupabaseSecretKey(key: string): SupabaseKeyFormat {
  if (!key) return 'missing';
  if (isPlaceholderValue(key)) return 'invalid_placeholder';
  if (key.startsWith('sb_publishable_')) return 'invalid_publishable';
  if (key.startsWith('sb_secret_') && key.length >= 24) return 'sb_secret';

  const jwtParts = key.split('.');
  if (key.startsWith('eyJ') && jwtParts.length === 3) {
    try {
      const claimsJson = Buffer.from(jwtParts[1], 'base64url').toString('utf8');
      const claims = JSON.parse(claimsJson);
      if (claims?.role === 'anon') return 'invalid_publishable';
      if (claims?.role === 'service_role') return 'jwt_service_role';
    } catch {
      // Malformed JWT payload; still treat as opaque only if long enough
    }
    return 'jwt_service_role';
  }

  return key.length >= 20 ? 'opaque_secret' : 'invalid_placeholder';
}

export function getServerConfig(): ServerConfig {
  ensureServerEnvBootstrapped();

  const serverless = isServerlessRuntime();
  const runtime: ServerConfig['runtime'] = process.env.VERCEL
    ? 'vercel-serverless'
    : serverless
    ? 'serverless'
    : 'node';

  // Server-only Supabase URL (never falls back to VITE_* or invalid explicit URLs)
  const rawUrl = readServerEnv('SUPABASE_URL').value;
  let supabaseUrl = CANONICAL_SUPABASE_URL;
  let supabaseUrlValid = true;
  let supabaseUrlSource: 'env' | 'default_project' = 'default_project';

  if (rawUrl) {
    const normalized = rawUrl.replace(/\/+$/, '');
    supabaseUrlSource = 'env';
    try {
      const parsed = new URL(normalized);
      supabaseUrlValid = parsed.protocol === 'https:' && parsed.hostname.length > 0;
      supabaseUrl = normalized;
    } catch {
      supabaseUrlValid = false;
      supabaseUrl = normalized;
    }
  }

  const rawAnon = readServerEnv('SUPABASE_ANON_KEY').value;
  const supabaseAnonKey =
    rawAnon && !isPlaceholderValue(rawAnon) ? rawAnon : CANONICAL_SUPABASE_ANON_KEY;

  // Service-role / secret key strictly from server environment variables
  const serviceRead = readServerEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_KEY'
  );
  const serviceRoleKeyFormat = classifySupabaseSecretKey(serviceRead.value);
  const serviceRoleConfigured =
    serviceRoleKeyFormat === 'jwt_service_role' ||
    serviceRoleKeyFormat === 'sb_secret' ||
    serviceRoleKeyFormat === 'opaque_secret';

  // Owner session HMAC signing secret strictly from server environment
  const ownerSecretRaw = readServerEnv('OWNER_SESSION_SECRET').value;
  const ownerSessionSecretConfigured =
    ownerSecretRaw.length >= 8 && !isPlaceholderValue(ownerSecretRaw);
  const ownerSessionSecretStrong =
    ownerSecretRaw.length >= 16 && !isPlaceholderValue(ownerSecretRaw);

  let signingSecret = '';
  let signingSecretSource: ServerConfig['signingSecretSource'] = 'none';
  if (ownerSessionSecretConfigured) {
    signingSecret = ownerSecretRaw;
    signingSecretSource = 'OWNER_SESSION_SECRET';
  } else if (serviceRoleConfigured) {
    signingSecret = serviceRead.value;
    signingSecretSource = 'SUPABASE_SERVICE_ROLE_KEY';
  }

  const ownerEmailRaw = readServerEnv('OWNER_EMAIL').value;
  const ownerEmail = (ownerEmailRaw || DEFAULT_OWNER_EMAIL).toLowerCase();

  const cronSecret = readServerEnv('CRON_SECRET').value;
  const hasSmtp = Boolean(
    readServerEnv('SMTP_HOST').value &&
      readServerEnv('SMTP_USER').value &&
      readServerEnv('SMTP_PASS').value
  );
  const hasResend = Boolean(readServerEnv('RESEND_API_KEY').value);

  return {
    runtime,
    isServerless: serverless,
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeVersion: process.version,
    supabaseUrl,
    supabaseUrlValid,
    supabaseUrlSource,
    supabaseAnonKey,
    supabaseServiceRoleKey: serviceRoleConfigured ? serviceRead.value : '',
    serviceRoleKeySource: serviceRead.matchedKey,
    serviceRoleKeyFormat,
    serviceRoleConfigured,
    ownerSessionSecret: ownerSessionSecretConfigured ? ownerSecretRaw : '',
    ownerSessionSecretConfigured,
    ownerSessionSecretStrong,
    signingSecret,
    signingSecretConfigured: Boolean(signingSecret),
    signingSecretSource,
    ownerEmail,
    cronSecret,
    cronSecretConfigured: cronSecret.length > 0,
    emailDeliveryConfigured: hasSmtp || hasResend,
  };
}

/**
 * Returns strictly boolean flags and safe metadata (never returns any secret value or prefix).
 */
export function getSafeConfigDiagnostics(cfg = getServerConfig()): SafeConfigDiagnostics {
  const rawOwnerSecretPresent = readServerEnv('OWNER_SESSION_SECRET').value.length > 0;
  return {
    runtime: cfg.runtime,
    vercelEnv: cfg.vercelEnv,
    nodeVersion: cfg.nodeVersion,
    hasOwnerSessionSecret: rawOwnerSecretPresent,
    ownerSessionSecretConfigured: cfg.ownerSessionSecretConfigured,
    ownerSessionSecretStrong: cfg.ownerSessionSecretStrong,
    hasServiceRoleKey: cfg.serviceRoleConfigured,
    serviceRoleKeySource: cfg.serviceRoleKeySource,
    serviceRoleKeyFormat: cfg.serviceRoleKeyFormat,
    hasSupabaseUrl: readServerEnv('SUPABASE_URL').value.length > 0,
    supabaseUrlValid: cfg.supabaseUrlValid,
    supabaseUrlSource: cfg.supabaseUrlSource,
    hasSupabaseAnonKey: readServerEnv('SUPABASE_ANON_KEY').value.length > 0,
    hasOwnerEmail: readServerEnv('OWNER_EMAIL').value.length > 0,
    hasEmailDelivery: cfg.emailDeliveryConfigured,
    hasCronSecret: cfg.cronSecretConfigured,
    signingSecretConfigured: cfg.signingSecretConfigured,
    signingSecretSource: cfg.signingSecretSource,
  };
}

export function logSafeConfigDiagnostics(trigger: string, force = false): SafeConfigDiagnostics {
  const diag = getSafeConfigDiagnostics();
  if (!startupLogged || force) {
    startupLogged = true;
    console.info('[ServerConfig]', JSON.stringify({ trigger, ...diag }));
  }
  return diag;
}
