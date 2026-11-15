import React, { useState } from 'react';
import { X, Lock, Mail, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Language, translations, translateApiError } from '../lib/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onOwnerSignIn?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, lang, onOwnerSignIn }) => {
  const t = translations[lang];
  const { signInWithEmail, signUpWithEmail, resetPasswordForEmail } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await resetPasswordForEmail(email.trim());
        if (error) {
          setErrorMsg(translateApiError(error.message, lang));
        } else {
          setSuccessMsg(t.resetEmailSent);
        }
      } else if (mode === 'signup') {
        const { error } = await signUpWithEmail(email.trim(), password);
        if (error) {
          setErrorMsg(translateApiError(error.message, lang));
        } else {
          setSuccessMsg(t.signUpSuccessMsg);
        }
      } else {
        const { error, isOwnerAccount } = await signInWithEmail(email.trim(), password);
        if (error) {
          setErrorMsg(translateApiError(error.message, lang));
        } else {
          onClose();
          if (isOwnerAccount) {
            onOwnerSignIn?.();
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(translateApiError(err?.message, lang) || t.authErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-3xl p-6 sm:p-8 shadow-2xl border border-black/10 dark:border-white/10 text-zinc-900 dark:text-zinc-100">
        <button
          onClick={onClose}
          type="button"
          aria-label={t.closeBtn}
          className="absolute top-5 end-5 p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center mx-auto mb-3 font-extrabold text-xl shadow-md">
            {mode === 'forgot' ? <KeyRound className="w-5 h-5" /> : 'Y'}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {mode === 'signup'
              ? t.createAccountTitle
              : mode === 'forgot'
              ? t.forgotPasswordTitle
              : t.signIn}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
            {mode === 'forgot' ? t.forgotPasswordDesc : t.journalSubtitle}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs text-center font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs text-center font-medium">
            {successMsg}
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              {t.emailAddressLabel}
            </label>
            <div className="relative">
              <Mail className="absolute start-3.5 top-3 w-4 h-4 text-zinc-400" />
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900/50 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {t.passwordLabel}
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                  >
                    {t.forgotPasswordLink}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute start-3.5 top-3 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900/50 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>
              {loading
                ? t.sendingLabel
                : mode === 'forgot'
                ? t.sendResetLink
                : mode === 'signup'
                ? t.createAccountBtn
                : t.signIn}
            </span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </form>

        <div className="text-center mt-5 space-y-2">
          {mode === 'forgot' ? (
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors underline underline-offset-4"
            >
              {t.backToSignIn}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
              className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors underline underline-offset-4"
            >
              {mode === 'signup' ? t.alreadyHaveAccount : t.dontHaveAccount}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
