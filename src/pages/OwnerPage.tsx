import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  Gift,
  Trophy,
  Activity,
  LogOut,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  LayoutDashboard,
  Users,
  Inbox,
} from 'lucide-react';
import { Language, translations, translateApiError } from '../lib/i18n';
import { useAuth, OwnerAuthDiagnostics } from '../context/AuthContext';
import { GiveawayBuilderPanel } from '../components/owner/GiveawayBuilderPanel';
import { BrokerCompetitionsPanel } from '../components/owner/BrokerCompetitionsPanel';

interface OwnerPageProps {
  lang: Language;
  onExitOwner: () => void;
}

interface SecurityOverview {
  auditLogs: Array<{
    id: string;
    owner_email: string;
    action: string;
    resource_type: string;
    resource_id: string;
    ip_address: string;
    created_at: string;
  }>;
  delivery: { configured: boolean; provider: string };
  scheduler: { running: boolean; intervalMs: number; lastSyncFinishedAt: string | null };
  serviceRoleConfigured: boolean;
  diagnostics?: OwnerAuthDiagnostics;
}

interface OwnerOverviewData {
  serviceRoleConfigured: boolean;
  counts: {
    profiles: number;
    tradesTotal: number;
    tradesOpen: number;
    tradesClosed: number;
    giveawaysTotal: number;
    giveawaysActive: number;
    giveawaysParticipants: number;
    competitionsPublished: number;
    competitionsPending: number;
    dailyAnalysesToday: number;
    contactInquiries: number;
  };
  health: {
    supabaseConnected: boolean;
    giveawaysTableReady: boolean;
    competitionsTableReady: boolean;
    inquiriesTableReady: boolean;
    marketDataKeyConfigured: boolean;
    newsKeyConfigured: boolean;
    geminiConfigured: boolean;
    ownerSessionSecretConfigured: boolean;
    emailDelivery: { configured: boolean; provider: string };
    analysisScheduler: { running: boolean };
    competitionScheduler: { running: boolean };
  };
}

interface OwnerManagedUser {
  id: string;
  display_name: string;
  starting_capital: number;
  role: string;
  isSelfOwner: boolean;
  openTrades: number;
  closedTrades: number;
  realizedPnl: number;
}

interface OwnerInquiryItem {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'reviewed' | 'resolved';
  created_at: string;
}

interface FundamentalOwnerStatus {
  schedulerRunning: boolean;
  lastFullSyncAt: string | null;
  totalEvents: number;
  unavailableCount: number;
  events: Array<{
    id: string;
    eventType: string;
    title: string;
    scheduledAt: string;
    status: string;
    dataFreshness: string;
    hasBeforeStage: boolean;
    hasAfterStage: boolean;
    aiUsed: boolean;
    aiError: string | null;
    lastSyncedAt: string;
  }>;
  syncLogs: Array<{
    id: string;
    sourceName: string;
    eventType: string;
    status: string;
    errorMessage: string | null;
    executedAt: string;
  }>;
}

function OwnerDiagnosticsPanel({
  lang,
  diagnostics,
  onRefresh,
  refreshing,
}: {
  lang: Language;
  diagnostics: OwnerAuthDiagnostics;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const t = translations[lang];
  const rows = [
    {
      label: t.diagSupabaseAuth,
      value: diagnostics.supabaseAuthenticated
        ? diagnostics.emailConfirmed
          ? 'Authenticated & Confirmed'
          : 'Authenticated (Email Confirmation Pending)'
        : 'Not Authenticated',
      ok: diagnostics.supabaseAuthenticated && diagnostics.emailConfirmed,
    },
    {
      label: t.diagUserId,
      value: diagnostics.userId || '—',
      ok: Boolean(diagnostics.userId),
      mono: true,
    },
    {
      label: t.diagOwnerRole,
      value:
        diagnostics.ownerRoleStatus === 'owner'
          ? diagnostics.roleAutoProvisioned
            ? 'OWNER (Auto-provisioned on server)'
            : 'OWNER (Verified on server)'
          : diagnostics.ownerRoleStatus === 'column_missing'
          ? 'Server Email Verified (SQL 002 migration pending for profiles.role)'
          : `Role: ${diagnostics.ownerRoleStatus}`,
      ok: diagnostics.ownerRoleStatus === 'owner' || diagnostics.ownerRoleStatus === 'column_missing',
    },
    {
      label: t.diagEmailVerify,
      value:
        diagnostics.emailVerificationStatus === 'verified'
          ? 'Verified (2FA Active)'
          : diagnostics.emailVerificationStatus === 'code_pending'
          ? `Code Sent (Expires ${
              diagnostics.activeOtpExpiresAt
                ? new Date(diagnostics.activeOtpExpiresAt).toLocaleTimeString()
                : '5m'
            })`
          : 'Required (6-digit code)',
      ok: diagnostics.emailVerificationStatus === 'verified',
    },
    {
      label: t.diagEmailDelivery,
      value: diagnostics.deliveryDetail,
      ok: diagnostics.deliveryConfigured,
    },
    {
      label: t.diagSessionValid,
      value: diagnostics.sessionValid
        ? `Valid until ${
            diagnostics.sessionExpiresAt
              ? new Date(diagnostics.sessionExpiresAt).toLocaleTimeString()
              : '4h'
          }${diagnostics.signingSecretConfigured ?? diagnostics.ownerSessionSecretConfigured ? '' : ' (Ephemeral server key)'}`
        : diagnostics.sessionReason || 'Awaiting 2FA Verification',
      ok: diagnostics.sessionValid,
    },
    {
      label: 'Server Secret Config',
      value: `OWNER_SESSION_SECRET=${Boolean(diagnostics.envPresence?.hasOwnerSessionSecret ?? diagnostics.ownerSessionSecretConfigured)} • SUPABASE_SERVICE_ROLE_KEY=${Boolean(diagnostics.envPresence?.hasServiceRoleKey ?? diagnostics.serviceRoleConfigured)}${diagnostics.envPresence?.vercelEnv ? ` • Vercel Env: ${diagnostics.envPresence.vercelEnv}` : ''}`,
      ok: Boolean(diagnostics.signingSecretConfigured ?? (diagnostics.ownerSessionSecretConfigured || diagnostics.serviceRoleConfigured)),
      mono: true,
    },
    {
      label: t.diagAuthResult,
      value: diagnostics.authorizationResult,
      ok: diagnostics.sessionValid,
    },
  ];

  return (
    <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/70 border border-black/10 dark:border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
            {t.ownerDiagHeading}
          </h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {t.ownerDiagSubtitle}
          </p>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{t.refreshBtn}</span>
          </button>
        )}
      </div>

      <div className="divide-y divide-black/5 dark:divide-white/5 text-xs">
        {rows.map((row) => (
          <div
            key={row.label}
            className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
          >
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">{row.label}</span>
            <span
              dir="ltr"
              className={`font-semibold text-end break-all ${row.mono ? 'font-mono text-[11px]' : ''} ${
                row.ok
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const OwnerPage: React.FC<OwnerPageProps> = ({ lang, onExitOwner }) => {
  const t = translations[lang];
  const {
    user,
    accessToken,
    loading: authLoading,
    ownerStatusLoading,
    isOwnerAccount,
    ownerSessionVerified,
    ownerEmailDeliveryConfigured,
    ownerDiagnostics,
    signInWithEmail,
    signUpWithEmail,
    refreshOwnerStatus,
    lockOwnerSession,
    signOut,
  } = useAuth();

  // Step 1: Password sign-in or initial owner provisioning state (never stores or hardcodes password)
  const [provisionMode, setProvisionMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // Step 2: 5-minute single-use email OTP state
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [diagRefreshing, setDiagRefreshing] = useState(false);

  // Verified Studio Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'giveaways' | 'competitions' | 'users' | 'security'>('giveaways');
  const [securityData, setSecurityData] = useState<SecurityOverview | null>(null);
  const [overviewData, setOverviewData] = useState<OwnerOverviewData | null>(null);
  const [fundamentalStatus, setFundamentalStatus] = useState<FundamentalOwnerStatus | null>(null);
  const [syncingFundamental, setSyncingFundamental] = useState(false);
  const [usersList, setUsersList] = useState<OwnerManagedUser[]>([]);
  const [inquiriesList, setInquiriesList] = useState<OwnerInquiryItem[]>([]);
  const [usersServiceRole, setUsersServiceRole] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  // Cooldown countdown timer for Resend Verification Code
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const loadSecurityData = useCallback(async () => {
    if (!accessToken || !ownerSessionVerified) return;
    try {
      const res = await fetch('/api/owner/security', {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (res.ok) {
        setSecurityData(await res.json());
      }
    } catch {
      // ignore transient errors
    }
  }, [accessToken, ownerSessionVerified]);

  const loadOverviewData = useCallback(async () => {
    if (!accessToken || !ownerSessionVerified) return;
    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };
      const [ovRes, fundRes] = await Promise.all([
        fetch('/api/owner/overview', { credentials: 'include', headers }),
        fetch('/api/owner/fundamental/status', { credentials: 'include', headers }),
      ]);
      if (ovRes.ok) {
        setOverviewData(await ovRes.json());
      }
      if (fundRes.ok) {
        setFundamentalStatus(await fundRes.json());
      }
    } catch {
      // ignore
    }
  }, [accessToken, ownerSessionVerified]);

  const handleSyncFundamental = async () => {
    if (!accessToken) return;
    setSyncingFundamental(true);
    try {
      const res = await fetch('/api/owner/fundamental/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ forceAi: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setFundamentalStatus(data);
      }
    } finally {
      setSyncingFundamental(false);
    }
  };

  const loadUsersAndInquiries = useCallback(async () => {
    if (!accessToken || !ownerSessionVerified) return;
    setUsersError(null);
    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };
      const [uRes, iRes] = await Promise.all([
        fetch('/api/owner/users', { credentials: 'include', headers }),
        fetch('/api/owner/inquiries', { credentials: 'include', headers }),
      ]);
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsersList(Array.isArray(uData.users) ? uData.users : []);
        setUsersServiceRole(Boolean(uData.serviceRoleConfigured));
      }
      if (iRes.ok) {
        const iData = await iRes.json();
        setInquiriesList(Array.isArray(iData.inquiries) ? iData.inquiries : []);
      }
    } catch (err: any) {
      setUsersError(err?.message || 'Unable to load users and inquiries');
    }
  }, [accessToken, ownerSessionVerified]);

  useEffect(() => {
    if (!ownerSessionVerified) return;
    if (activeTab === 'security') loadSecurityData();
    if (activeTab === 'overview') loadOverviewData();
    if (activeTab === 'users') loadUsersAndInquiries();
  }, [ownerSessionVerified, activeTab, loadSecurityData, loadOverviewData, loadUsersAndInquiries]);

  const handleToggleUserRole = async (targetUser: OwnerManagedUser) => {
    if (!accessToken || targetUser.isSelfOwner || targetUser.role === 'owner') return;
    const nextRole = targetUser.role === 'admin' ? 'trader' : 'admin';
    setUsersError(null);
    try {
      const res = await fetch(`/api/owner/users/${encodeURIComponent(targetUser.id)}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Role update failed');
      await loadUsersAndInquiries();
    } catch (err: any) {
      setUsersError(err?.message || 'Unable to update role');
    }
  };

  const handleUpdateInquiryStatus = async (id: string, status: 'new' | 'reviewed' | 'resolved') => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/owner/inquiries/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await loadUsersAndInquiries();
      }
    } catch {
      // ignore
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    setLoginError(null);
    setLoginSuccess(null);

    if (provisionMode) {
      const { error } = await signUpWithEmail(loginEmail.trim(), loginPassword);
      setLoginPassword('');
      setSigningIn(false);
      if (error) {
        setLoginError(translateApiError(error.message, lang));
      } else {
        setLoginSuccess(t.signUpSuccessMsg);
      }
      return;
    }

    const { error } = await signInWithEmail(loginEmail.trim(), loginPassword);
    setLoginPassword('');
    setSigningIn(false);
    if (error) {
      setLoginError(translateApiError(error.message, lang));
    }
  };

  const handleRequestOtp = async () => {
    if (!accessToken) return;
    setOtpLoading(true);
    setOtpError(null);
    setOtpSuccess(null);
    try {
      const res = await fetch('/api/owner/auth/request-code', {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0) {
          setCooldownSeconds(Math.min(data.retryAfterSeconds, 60));
        }
        throw new Error(data.error || 'Failed to send code');
      }
      setOtpSent(true);
      setOtpSuccess(t.otpSentNotice);
      setCooldownSeconds(typeof data.cooldownSeconds === 'number' ? data.cooldownSeconds : 45);
      await refreshOwnerStatus(true);
    } catch (err: any) {
      setOtpError(translateApiError(err?.message, lang));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/owner/auth/verify-code', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      setOtpCode('');
      await refreshOwnerStatus(false);
    } catch (err: any) {
      setOtpError(translateApiError(err?.message, lang));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRefreshDiagnostics = async () => {
    setDiagRefreshing(true);
    await refreshOwnerStatus();
    setDiagRefreshing(false);
  };

  // Prevent false "Access Denied" flash while Supabase or server owner check is in flight
  if (authLoading || (Boolean(user) && ownerStatusLoading)) {
    return <div className="py-24 text-center text-xs text-zinc-400">{t.loadingPage}</div>;
  }

  // Gate 1: Not signed in yet
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-3xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-8 space-y-6 shadow-xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white">{t.ownerGateTitle}</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {provisionMode ? t.ownerProvisionDesc : t.ownerGateDesc}
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs text-center">
              {loginError}
            </div>
          )}

          {loginSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs text-center">
              {loginSuccess}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                {t.emailAddressLabel}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute start-3 top-3" />
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                {t.passwordLabel}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-400 absolute start-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  dir="ltr"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={signingIn}
              className="w-full py-3 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>
                {signingIn ? t.sendingLabel : provisionMode ? t.ownerProvisionBtn : t.signIn}
              </span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setProvisionMode((v) => !v);
                setLoginError(null);
                setLoginSuccess(null);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 underline underline-offset-4"
            >
              {provisionMode ? t.ownerProvisionBackToSignIn : t.ownerProvisionToggle}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate 2: Signed in as ordinary user or non-owner admin -> deny & offer exit
  if (!isOwnerAccount) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 space-y-5">
        <div className="p-8 rounded-3xl bg-white dark:bg-[#121214] border border-rose-500/20 space-y-4 text-center">
          <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="text-xl font-bold text-zinc-950 dark:text-white">
            {t.unauthorizedOwnerTitle}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {t.unauthorizedOwnerDesc}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={onExitOwner}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold"
            >
              {t.returnHomeBtn}
            </button>
            <button
              type="button"
              onClick={signOut}
              className="px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              {t.signOut}
            </button>
          </div>
        </div>

        {/* If the owner signed in but email isn't confirmed yet, backend safely returned diagnostics */}
        {ownerDiagnostics && (
          <OwnerDiagnosticsPanel
            lang={lang}
            diagnostics={ownerDiagnostics}
            onRefresh={handleRefreshDiagnostics}
            refreshing={diagRefreshing}
          />
        )}
      </div>
    );
  }

  // Gate 3: Signed in as Owner account -> require 5-minute single-use Email Verification Code
  if (!ownerSessionVerified) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 space-y-5">
        <div className="rounded-3xl bg-white dark:bg-[#121214] border border-emerald-500/20 p-6 sm:p-8 space-y-5 shadow-xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white">{t.ownerOtpHeading}</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t.ownerOtpDesc}
            </p>
            <p className="text-xs font-mono text-zinc-400" dir="ltr">
              {user.email}
            </p>
          </div>

          {!ownerEmailDeliveryConfigured && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <div className="font-bold">{t.otpDeliveryMissingTitle}</div>
              <div>{ownerDiagnostics?.deliveryDetail || t.otpDeliveryMissingDesc}</div>
            </div>
          )}

          {otpError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{otpError}</span>
            </div>
          )}

          {otpSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{otpSuccess}</span>
            </div>
          )}

          <button
            type="button"
            disabled={otpLoading || !ownerEmailDeliveryConfigured || cooldownSeconds > 0}
            onClick={handleRequestOtp}
            className="w-full py-2.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-semibold disabled:opacity-40"
          >
            {cooldownSeconds > 0
              ? `${t.ownerResendCooldownPrefix} ${cooldownSeconds}s`
              : otpSent
              ? t.resendOtpBtn
              : t.requestOtpBtn}
          </button>

          <form
            onSubmit={handleVerifyOtp}
            className="space-y-3 pt-2 border-t border-black/5 dark:border-white/10"
          >
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              dir="ltr"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={t.ownerOtpPlaceholder}
              className="w-full p-3 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-center font-mono text-lg tracking-[0.4em]"
            />
            <button
              type="submit"
              disabled={otpLoading || otpCode.length !== 6}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40"
            >
              {otpLoading ? t.verifyingOtpBtn : t.verifyOtpBtn}
            </button>
          </form>
        </div>

        {ownerDiagnostics && (
          <OwnerDiagnosticsPanel
            lang={lang}
            diagnostics={ownerDiagnostics}
            onRefresh={handleRefreshDiagnostics}
            refreshing={diagRefreshing}
          />
        )}
      </div>
    );
  }

  // Verified Private Owner Studio
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Studio Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>{t.ownerStudioLabel}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white mt-0.5">
            {t.ownerStudioTitle}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{t.ownerStudioSubtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={lockOwnerSession}
            className="px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.lockOwnerSessionBtn}</span>
          </button>
        </div>
      </div>

      {/* Studio Navigation Tabs (Giveaways vs Broker Competitions strictly isolated) */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 self-start w-fit">
        {[
          { id: 'overview', label: t.ownerTabOverview, icon: LayoutDashboard },
          { id: 'giveaways', label: t.ownerTabGiveaways, icon: Gift },
          { id: 'competitions', label: t.ownerTabCompetitions, icon: Trophy },
          { id: 'users', label: t.ownerTabUsers, icon: Users },
          { id: 'security', label: t.ownerTabSecurity, icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Studio Workspace */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">{t.ownerOverviewHeading}</h2>
            <button
              type="button"
              onClick={loadOverviewData}
              className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t.refreshBtn}</span>
            </button>
          </div>

          {overviewData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: t.metricUsersLabel, val: overviewData.counts.profiles },
                  { label: t.metricTradesLabel, val: `${overviewData.counts.tradesOpen} / ${overviewData.counts.tradesClosed}` },
                  { label: t.metricGiveawaysLabel, val: `${overviewData.counts.giveawaysActive} / ${overviewData.counts.giveawaysTotal}` },
                  { label: t.metricParticipantsLabel, val: overviewData.counts.giveawaysParticipants },
                  { label: t.metricCompetitionsLabel, val: `${overviewData.counts.competitionsPublished} (${overviewData.counts.competitionsPending})` },
                  { label: t.metricInquiriesLabel, val: overviewData.counts.contactInquiries },
                ].map((card) => (
                  <div key={card.label} className="p-4 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10">
                    <span className="text-[10px] uppercase font-semibold text-zinc-400 block">{card.label}</span>
                    <span className="text-xl font-bold font-mono tabular-nums mt-1 block" dir="ltr">{card.val}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {[
                  { label: 'Giveaways Tables', ok: overviewData.health.giveawaysTableReady },
                  { label: 'Broker Competitions Tables', ok: overviewData.health.competitionsTableReady },
                  { label: 'Contact Inquiries Table', ok: overviewData.health.inquiriesTableReady },
                  { label: 'SUPABASE_SERVICE_ROLE_KEY', ok: overviewData.serviceRoleConfigured },
                  { label: 'OWNER_SESSION_SECRET', ok: overviewData.health.ownerSessionSecretConfigured },
                  { label: '2FA Email Transport', ok: overviewData.health.emailDelivery.configured },
                  { label: 'Market Data API Key', ok: overviewData.health.marketDataKeyConfigured },
                  { label: 'News API Key', ok: overviewData.health.newsKeyConfigured },
                  { label: 'Gemini AI Analysis Key', ok: overviewData.health.geminiConfigured },
                ].map((item) => (
                  <div key={item.label} className="p-3.5 rounded-xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 flex items-center justify-between">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.label}</span>
                    <span className={`font-bold text-[11px] uppercase ${item.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {item.ok ? 'READY' : 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Fundamental Macro Sources & Sync Diagnostics */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                      {t.ownerFundamentalHeading}
                    </h3>
                    {fundamentalStatus?.lastFullSyncAt && (
                      <p className="text-[11px] font-mono text-zinc-400" dir="ltr">
                        Last Sync: {new Date(fundamentalStatus.lastFullSyncAt).toLocaleString()} • Events: {fundamentalStatus.totalEvents} • Unavailable: {fundamentalStatus.unavailableCount}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSyncFundamental}
                    disabled={syncingFundamental}
                    className="px-3.5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingFundamental ? 'animate-spin' : ''}`} />
                    <span>{t.ownerFundamentalSyncBtn}</span>
                  </button>
                </div>

                {fundamentalStatus && fundamentalStatus.events.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-start font-mono">
                      <thead>
                        <tr className="text-zinc-400 border-b border-black/5 dark:border-white/10 font-sans">
                          <th className="py-1.5 pe-3 text-start">Event</th>
                          <th className="py-1.5 pe-3 text-start">Status</th>
                          <th className="py-1.5 pe-3 text-start">Freshness</th>
                          <th className="py-1.5 pe-3 text-start">Stages</th>
                          <th className="py-1.5 text-end">Synced</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {fundamentalStatus.events.slice(0, 8).map((ev) => (
                          <tr key={ev.id}>
                            <td className="py-1.5 pe-3 font-sans font-semibold" dir="ltr">{ev.title}</td>
                            <td className="py-1.5 pe-3" dir="ltr">{ev.status}</td>
                            <td className="py-1.5 pe-3" dir="ltr">{ev.dataFreshness}</td>
                            <td className="py-1.5 pe-3" dir="ltr">
                              {ev.hasBeforeStage ? 'BEFORE' : '—'} / {ev.hasAfterStage ? 'AFTER' : '—'}
                            </td>
                            <td className="py-1.5 text-end text-zinc-400" dir="ltr">
                              {new Date(ev.lastSyncedAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {fundamentalStatus && fundamentalStatus.syncLogs.length > 0 && (
                  <div className="space-y-1 text-[11px] font-mono border-t border-black/5 dark:border-white/10 pt-3 max-h-36 overflow-y-auto" dir="ltr">
                    {fundamentalStatus.syncLogs.slice(0, 8).map((lg) => (
                      <div key={lg.id} className="flex items-center justify-between gap-2 text-zinc-500">
                        <span>{lg.sourceName} ({lg.eventType})</span>
                        <span className={lg.status === 'success' ? 'text-emerald-500' : 'text-amber-500'}>
                          {lg.status}{lg.errorMessage ? `: ${lg.errorMessage}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-zinc-400">{t.loadingPage}</div>
          )}
        </div>
      )}

      {activeTab === 'giveaways' && (
        <GiveawayBuilderPanel
          lang={lang}
          accessToken={accessToken!}
        />
      )}

      {activeTab === 'competitions' && (
        <BrokerCompetitionsPanel
          lang={lang}
          accessToken={accessToken!}
        />
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          {usersError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
              {usersError}
            </div>
          )}

          <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{t.ownerUsersHeading} ({usersList.length})</span>
              </h2>
              <button
                type="button"
                onClick={loadUsersAndInquiries}
                className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.refreshBtn}</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="text-zinc-400 border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pe-3 text-start">Trader</th>
                    <th className="py-2 pe-3 text-start">Role</th>
                    <th className="py-2 pe-3 text-end">Capital</th>
                    <th className="py-2 pe-3 text-end">Trades (O/C)</th>
                    <th className="py-2 pe-3 text-end">Realized P/L</th>
                    <th className="py-2 text-end">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {usersList.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 pe-3 font-semibold">{u.display_name}</td>
                      <td className="py-2.5 pe-3 uppercase font-mono text-[11px]">{u.role}</td>
                      <td className="py-2.5 pe-3 text-end font-mono" dir="ltr">${u.starting_capital.toLocaleString()}</td>
                      <td className="py-2.5 pe-3 text-end font-mono" dir="ltr">{u.openTrades} / {u.closedTrades}</td>
                      <td className={`py-2.5 pe-3 text-end font-mono font-bold ${u.realizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} dir="ltr">
                        {u.realizedPnl >= 0 ? '+' : ''}${u.realizedPnl.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-end">
                        {u.isSelfOwner || u.role === 'owner' ? (
                          <span className="text-[11px] text-emerald-500 font-semibold">OWNER</span>
                        ) : (
                          <button
                            type="button"
                            disabled={!usersServiceRole}
                            onClick={() => handleToggleUserRole(u)}
                            className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[11px] font-semibold disabled:opacity-40"
                          >
                            {u.role === 'admin' ? t.setTraderRoleBtn : t.setAdminRoleBtn}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Inbox className="w-4 h-4" />
              <span>{t.ownerInquiriesHeading} ({inquiriesList.length})</span>
            </h2>
            {inquiriesList.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-400">{t.noInquiriesYet}</p>
            ) : (
              <div className="space-y-2.5">
                {inquiriesList.map((inq) => (
                  <div key={inq.id} className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-black/5 dark:border-white/10 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold">{inq.name}</span>{' '}
                        <span className="text-zinc-400 font-mono text-[11px]" dir="ltr">({inq.email})</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(['new', 'reviewed', 'resolved'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleUpdateInquiryStatus(inq.id, st)}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              inq.status === st
                                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                                : 'bg-black/5 dark:bg-white/10 text-zinc-500'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                    {inq.subject && <div className="font-semibold text-zinc-800 dark:text-zinc-200">{inq.subject}</div>}
                    <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-line">{inq.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          {(securityData?.diagnostics || ownerDiagnostics) && (
            <OwnerDiagnosticsPanel
              lang={lang}
              diagnostics={securityData?.diagnostics || ownerDiagnostics!}
              onRefresh={loadSecurityData}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 space-y-1 text-xs">
              <div className="font-bold text-zinc-500">{t.emailDeliveryHeading}</div>
              <div className="text-base font-bold text-zinc-950 dark:text-white">
                {securityData?.delivery.configured
                  ? `${securityData.delivery.provider.toUpperCase()} Connected`
                  : t.otpDeliveryMissingTitle}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 space-y-1 text-xs">
              <div className="font-bold text-zinc-500">{t.schedulerStatusHeading}</div>
              <div className="text-base font-bold text-zinc-950 dark:text-white tabular-nums">
                {securityData?.scheduler.running
                  ? `Active (${Math.round(securityData.scheduler.intervalMs / 3600000)}h cycle)`
                  : 'Stopped'}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 space-y-3">
            <h3 className="text-sm font-bold">{t.auditLogsHeading}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead>
                  <tr className="text-zinc-400 border-b border-black/5 dark:border-white/10">
                    <th className="py-2 pe-3 text-start">Action</th>
                    <th className="py-2 pe-3 text-start">Resource</th>
                    <th className="py-2 pe-3 text-start">IP</th>
                    <th className="py-2 text-start">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {(securityData?.auditLogs || []).map((log) => (
                    <tr key={log.id}>
                      <td className="py-2 pe-3 font-mono font-semibold">{log.action}</td>
                      <td className="py-2 pe-3 text-zinc-500">
                        {log.resource_type} {log.resource_id ? `(${log.resource_id.slice(0, 14)})` : ''}
                      </td>
                      <td className="py-2 pe-3 font-mono text-zinc-400" dir="ltr">
                        {log.ip_address || '—'}
                      </td>
                      <td className="py-2 font-mono text-zinc-400 tabular-nums" dir="ltr">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
