import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xhqvlqygqvyniuiqjjzx.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_8sLROvIDtB-WfqqSNkWsfw_2dAmTJLS';

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

export function isServiceRoleConfigured(): boolean {
  return SERVICE_ROLE_KEY.length > 20;
}

export function getAdminClient(): SupabaseClient | null {
  if (!isServiceRoleConfigured()) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getUserScopedClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
  return (process.env.OWNER_EMAIL || 'younesselidrissi64@gmail.com').trim().toLowerCase();
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
