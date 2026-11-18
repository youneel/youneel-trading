import dotenv from 'dotenv';

let envBootstrapped = false;
let diagnosticsLogged = false;

/**
 * Loads local .env / .env.local files once BEFORE other server modules read process.env.
 * Never overrides variables already provided by the hosting runtime (e.g. Vercel).
 */
export function ensureEnvLoaded(): void {
  if (envBootstrapped) return;
  envBootstrapped = true;
  dotenv.config({ path: ['.env.local', '.env'], override: false, quiet: true });
}

// Run immediately when this module is imported first.
ensureEnvLoaded();

/**
 * Reads the first non-empty env var from `names`, trimming whitespace and accidental wrapping quotes.
 */
export function readCleanEnv(...names: string[]): { value: string; matchedKey: string | null } {
  ensureEnvLoaded();
  for (const name of names) {
    const raw = process.env[name];
    if (typeof raw !== 'string') continue;
    let cleaned = raw.trim();
    if (
      (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length >= 2) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'") && cleaned.length >= 2)
    ) {
      cleaned = cleaned.slice(1, -1).trim();
    }
    if (cleaned.length > 0) {
      return { value: cleaned, matchedKey: name };
    }
  }
  return { value: '', matchedKey: null };
}

export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY
  );
}

export interface SafeEnvPresenceReport {
  runtime: 'vercel-serverless' | 'serverless' | 'node';
  vercelEnv: string | null;
  nodeVersion: string;
  hasOwnerSessionSecret: boolean;
  ownerSessionSecretValidLength: boolean;
  hasServiceRoleKey: boolean;
  hasServiceRoleAlias: boolean;
  hasSupabaseUrl: boolean;
  hasSupabaseAnonKey: boolean;
  hasOwnerEmail: boolean;
  hasEmailDelivery: boolean;
  hasCronSecret: boolean;
}

/**
 * Returns ONLY boolean presence flags and runtime environment name.
 * Never logs or returns secret values, lengths, prefixes, or partial strings.
 */
export function getSafeEnvPresence(): SafeEnvPresenceReport {
  ensureEnvLoaded();
  const ownerSecret = readCleanEnv('OWNER_SESSION_SECRET').value;
  const servicePrimary = readCleanEnv('SUPABASE_SERVICE_ROLE_KEY').value;
  const serviceAlias = readCleanEnv(
    'SUPABASE_SERVICE_ROLE',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_KEY'
  ).value;
  const supabaseUrl = readCleanEnv(
    'SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'VITE_SUPABASE_URL'
  ).value;
  const supabaseAnon = readCleanEnv(
    'SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY'
  ).value;
  const ownerEmail = readCleanEnv('OWNER_EMAIL').value;
  const hasSmtp = Boolean(
    readCleanEnv('SMTP_HOST').value &&
      readCleanEnv('SMTP_USER').value &&
      readCleanEnv('SMTP_PASS').value
  );
  const hasResend = Boolean(readCleanEnv('RESEND_API_KEY').value);
  const hasCron = Boolean(readCleanEnv('CRON_SECRET').value);

  const runtime: SafeEnvPresenceReport['runtime'] = process.env.VERCEL
    ? 'vercel-serverless'
    : isServerlessRuntime()
    ? 'serverless'
    : 'node';

  return {
    runtime,
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeVersion: process.version,
    hasOwnerSessionSecret: ownerSecret.length > 0,
    ownerSessionSecretValidLength: ownerSecret.length >= 16,
    hasServiceRoleKey: servicePrimary.length > 20,
    hasServiceRoleAlias: serviceAlias.length > 20,
    hasSupabaseUrl: supabaseUrl.length > 0,
    hasSupabaseAnonKey: supabaseAnon.length > 0,
    hasOwnerEmail: ownerEmail.length > 0,
    hasEmailDelivery: hasSmtp || hasResend,
    hasCronSecret: hasCron,
  };
}

export function logSafeEnvDiagnostics(trigger: string, force = false): SafeEnvPresenceReport {
  const report = getSafeEnvPresence();
  if (!diagnosticsLogged || force) {
    diagnosticsLogged = true;
    console.info(
      '[EnvDiagnostics]',
      JSON.stringify({
        trigger,
        ...report,
      })
    );
  }
  return report;
}
