import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

const LEGACY_OWNER_SESSION_STORAGE_KEY = 'youneel_owner_session_token';

export interface OwnerAuthDiagnostics {
  supabaseAuthenticated: boolean;
  userId: string;
  emailConfirmed: boolean;
  ownerRoleStatus: string;
  roleAutoProvisioned: boolean;
  emailVerificationStatus: 'verified' | 'code_pending' | 'required';
  activeOtpExpiresAt?: string | null;
  deliveryConfigured: boolean;
  deliveryProvider: string;
  deliveryDetail: string;
  deliveryMissingFields: string[];
  sessionValid: boolean;
  sessionExpiresAt: string | null;
  sessionReason?: string;
  authorizationResult: string;
  serviceRoleConfigured: boolean;
  ownerSessionSecretConfigured: boolean;
  signingSecretConfigured?: boolean;
  envPresence?: {
    runtime: string;
    vercelEnv: string | null;
    hasOwnerSessionSecret: boolean;
    ownerSessionSecretValidLength: boolean;
    hasServiceRoleKey: boolean;
    hasServiceRoleAlias: boolean;
    hasSupabaseUrl: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  profile: Profile | null;
  isAdmin: boolean;
  isOwnerAccount: boolean;
  ownerStatusLoading: boolean;
  ownerSessionVerified: boolean;
  ownerEmailDeliveryConfigured: boolean;
  ownerDiagnostics: OwnerAuthDiagnostics | null;
  loading: boolean;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ error: any; isOwnerAccount?: boolean }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  deleteAccountAndData: () => Promise<{ success: boolean; error?: any }>;
  updateStartingCapital: (capital: number) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  refreshOwnerStatus: (silent?: boolean) => Promise<void>;
  lockOwnerSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwnerAccount, setIsOwnerAccount] = useState(false);
  const [ownerStatusLoading, setOwnerStatusLoading] = useState(true);
  const [ownerSessionVerified, setOwnerSessionVerified] = useState(false);
  const ownerSessionVerifiedRef = useRef(false);
  const lastOwnerUserIdRef = useRef<string | null>(null);
  const [ownerEmailDeliveryConfigured, setOwnerEmailDeliveryConfigured] = useState(false);
  const [ownerDiagnostics, setOwnerDiagnostics] = useState<OwnerAuthDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      sessionStorage.removeItem(LEGACY_OWNER_SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const checkAdminStatus = useCallback(async (token?: string) => {
    if (!token) {
      setIsAdmin(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(Boolean(data.isAdmin));
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    }
  }, []);

  const checkOwnerStatus = useCallback(
    async (accessTok?: string | null, opts?: { silent?: boolean }): Promise<boolean> => {
      if (!accessTok) {
        lastOwnerUserIdRef.current = null;
        ownerSessionVerifiedRef.current = false;
        setIsOwnerAccount(false);
        setOwnerSessionVerified(false);
        setOwnerEmailDeliveryConfigured(false);
        setOwnerDiagnostics(null);
        setOwnerStatusLoading(false);
        return false;
      }

      if (!opts?.silent) {
        setOwnerStatusLoading(true);
      }
      try {
        const res = await fetch('/api/owner/auth/status', {
          headers: { Authorization: `Bearer ${accessTok}` },
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const ownerOk = Boolean(data.isOwnerAccount);
          const sessionOk = Boolean(data.ownerSessionVerified);
          ownerSessionVerifiedRef.current = sessionOk;
          setIsOwnerAccount(ownerOk);
          setOwnerSessionVerified(sessionOk);
          setOwnerEmailDeliveryConfigured(Boolean(data.deliveryConfigured));
          setOwnerDiagnostics(data.diagnostics || null);
          return ownerOk;
        }

        if (!opts?.silent) {
          ownerSessionVerifiedRef.current = false;
          setIsOwnerAccount(false);
          setOwnerSessionVerified(false);
          setOwnerDiagnostics(null);
        }
        return false;
      } catch {
        // Preserve active session state across transient network/tab-wake blips
        if (!opts?.silent && !ownerSessionVerifiedRef.current) {
          setIsOwnerAccount(false);
          setOwnerSessionVerified(false);
          setOwnerDiagnostics(null);
        }
        return ownerSessionVerifiedRef.current;
      } finally {
        if (!opts?.silent) {
          setOwnerStatusLoading(false);
        }
      }
    },
    []
  );

  const fetchProfile = useCallback(async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile:', error.message);
        return;
      }

      if (data) {
        setProfile(data as Profile);
      } else {
        const newProfile: Profile = {
          id: userId,
          display_name: email ? email.split('@')[0] : 'Trader',
          starting_capital: 10000,
        };
        const { error: insertErr } = await supabase.from('profiles').insert([newProfile]);
        if (!insertErr) {
          setProfile(newProfile);
        }
      }
    } catch (err) {
      console.error('Profile fetch exception:', err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        lastOwnerUserIdRef.current = initialSession.user.id;
        await Promise.all([
          fetchProfile(initialSession.user.id, initialSession.user.email),
          checkAdminStatus(initialSession.access_token),
          checkOwnerStatus(initialSession.access_token),
        ]);
      } else {
        lastOwnerUserIdRef.current = null;
        ownerSessionVerifiedRef.current = false;
        setIsAdmin(false);
        setIsOwnerAccount(false);
        setOwnerSessionVerified(false);
        setOwnerDiagnostics(null);
        setOwnerStatusLoading(false);
      }
      if (mounted) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        const sameUser = lastOwnerUserIdRef.current === nextSession.user.id;
        const isSilentEvent =
          sameUser &&
          (event === 'TOKEN_REFRESHED' ||
            event === 'INITIAL_SESSION' ||
            (event === 'SIGNED_IN' && ownerSessionVerifiedRef.current));

        lastOwnerUserIdRef.current = nextSession.user.id;
        await Promise.all([
          sameUser ? Promise.resolve() : fetchProfile(nextSession.user.id, nextSession.user.email),
          checkAdminStatus(nextSession.access_token),
          checkOwnerStatus(nextSession.access_token, { silent: isSilentEvent }),
        ]);
      } else {
        lastOwnerUserIdRef.current = null;
        ownerSessionVerifiedRef.current = false;
        setProfile(null);
        setIsAdmin(false);
        setIsOwnerAccount(false);
        setOwnerSessionVerified(false);
        setOwnerDiagnostics(null);
        setOwnerStatusLoading(false);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, checkAdminStatus, checkOwnerStatus]);

  const signInWithEmail = async (email: string, password: string) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    let ownerOk = false;
    if (res.data.user && res.data.session) {
      lastOwnerUserIdRef.current = res.data.user.id;
      const [, , ownerRes] = await Promise.all([
        fetchProfile(res.data.user.id, res.data.user.email),
        checkAdminStatus(res.data.session.access_token),
        checkOwnerStatus(res.data.session.access_token),
      ]);
      ownerOk = ownerRes;
    }
    return { error: res.error, isOwnerAccount: ownerOk };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const res = await supabase.auth.signUp({ email, password });
    if (res.data.user && res.data.session) {
      lastOwnerUserIdRef.current = res.data.user.id;
      await Promise.all([
        fetchProfile(res.data.user.id, res.data.user.email),
        checkAdminStatus(res.data.session.access_token),
        checkOwnerStatus(res.data.session.access_token),
      ]);
    }
    return { error: res.error };
  };

  const resetPasswordForEmail = async (email: string) => {
    const res = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error: res.error };
  };

  const lockOwnerSession = useCallback(async () => {
    try {
      await fetch('/api/owner/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    ownerSessionVerifiedRef.current = false;
    setOwnerSessionVerified(false);
    if (session?.access_token) {
      await checkOwnerStatus(session.access_token, { silent: false });
    }
  }, [session?.access_token, checkOwnerStatus]);

  const signOut = async () => {
    await lockOwnerSession();
    await supabase.auth.signOut();
    lastOwnerUserIdRef.current = null;
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setIsOwnerAccount(false);
    setOwnerSessionVerified(false);
    setOwnerDiagnostics(null);
  };

  const deleteAccountAndData = async () => {
    if (!user) return { success: false, error: 'Authentication required' };

    try {
      const { error: tradesErr } = await supabase.from('trades').delete().eq('user_id', user.id);
      if (tradesErr) throw tradesErr;

      await supabase.from('giveaway_participants').delete().eq('user_id', user.id);

      const { error: profileErr } = await supabase.from('profiles').delete().eq('id', user.id);
      if (profileErr) throw profileErr;

      await signOut();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to delete account data:', err);
      return { success: false, error: err.message };
    }
  };

  const updateStartingCapital = async (capital: number): Promise<{ success: boolean; error?: string }> => {
    if (!user || !session?.access_token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const res = await fetch('/api/journal/capital', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ starting_capital: capital }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update starting capital' };
      }

      if (data.profile) {
        setProfile(data.profile as Profile);
      } else {
        setProfile((prev) =>
          prev ? { ...prev, starting_capital: capital } : { id: user.id, display_name: null, starting_capital: capital }
        );
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user.email);
    }
  };

  const refreshOwnerStatus = useCallback(
    async (silent = false) => {
      await checkOwnerStatus(session?.access_token ?? null, { silent });
    },
    [session?.access_token, checkOwnerStatus]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        accessToken: session?.access_token ?? null,
        profile,
        isAdmin,
        isOwnerAccount,
        ownerStatusLoading,
        ownerSessionVerified,
        ownerEmailDeliveryConfigured,
        ownerDiagnostics,
        loading,
        signInWithEmail,
        signUpWithEmail,
        resetPasswordForEmail,
        signOut,
        deleteAccountAndData,
        updateStartingCapital,
        refreshProfile,
        refreshOwnerStatus,
        lockOwnerSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
