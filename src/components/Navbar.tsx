import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Compass,
  BookOpen,
  Newspaper,
  Gift,
  ShieldCheck,
  Instagram,
  Moon,
  Sun,
  Globe,
  LogOut,
  Trash2,
  Menu,
  X,
  AlertTriangle,
  Trophy,
  KeyRound,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Language, translations, translateApiError } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  lang,
  setLang,
  theme,
  setTheme,
  onOpenAuthModal,
}) => {
  const t = translations[lang];
  const { user, isAdmin, isOwnerAccount, signOut, deleteAccountAndData } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const navLinks = useMemo(
    () => [
      { id: 'home', label: t.navHome, icon: TrendingUp },
      { id: 'markets', label: t.navMarkets, icon: TrendingUp },
      { id: 'analysis', label: t.navAnalysis, icon: Compass },
      { id: 'journal', label: t.navJournal, icon: BookOpen },
      { id: 'news', label: t.navNews, icon: Newspaper },
      { id: 'giveaways', label: t.navGiveaways, icon: Gift },
      { id: 'competitions', label: t.navCompetitions, icon: Trophy },
      { id: 'brokers', label: t.navBrokers, icon: ShieldCheck },
      { id: 'contact', label: t.navContact, icon: Instagram },
    ],
    [t]
  );

  // Adaptive Priority+ overflow count for desktop nav (>= lg / 1024px)
  const [visibleCount, setVisibleCount] = useState<number>(navLinks.length);

  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const measureRowRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const recomputeVisibleCount = useCallback(() => {
    const navEl = navRef.current;
    const measureEl = measureRowRef.current;
    if (!navEl || !measureEl) return;

    const availableWidth = navEl.clientWidth;
    if (availableWidth <= 0) return;

    const itemEls = Array.from(measureEl.querySelectorAll<HTMLElement>('[data-measure-item]'));
    const moreEl = measureEl.querySelector<HTMLElement>('[data-measure-more]');
    if (itemEls.length === 0) return;

    const gapPx = 4; // matches Tailwind gap-1
    const safetyBufferPx = 8;

    const widths = itemEls.map((el) => Math.ceil(el.getBoundingClientRect().width));
    const totalAllWidth =
      widths.reduce((sum, w) => sum + w, 0) + Math.max(0, widths.length - 1) * gapPx;

    if (totalAllWidth + safetyBufferPx <= availableWidth) {
      setVisibleCount((prev) => (prev === navLinks.length ? prev : navLinks.length));
      setMoreDropdownOpen(false);
      return;
    }

    const moreWidth = moreEl ? Math.ceil(moreEl.getBoundingClientRect().width) : 80;
    const budget = Math.max(0, availableWidth - moreWidth - gapPx - safetyBufferPx);

    let usedWidth = 0;
    let count = 0;
    for (let i = 0; i < widths.length; i++) {
      const nextCost = widths[i] + (i > 0 ? gapPx : 0);
      if (usedWidth + nextCost <= budget) {
        usedWidth += nextCost;
        count += 1;
      } else {
        break;
      }
    }

    const nextVisible = Math.max(1, Math.min(count, navLinks.length - 1));
    setVisibleCount((prev) => (prev === nextVisible ? prev : nextVisible));
  }, [navLinks.length]);

  useLayoutEffect(() => {
    recomputeVisibleCount();
  }, [recomputeVisibleCount, lang, user?.email, isOwnerAccount]);

  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return;

    let rafId = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        recomputeVisibleCount();
      });
    };

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleMeasure) : null;
    observer?.observe(navEl);
    window.addEventListener('resize', scheduleMeasure);

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(scheduleMeasure).catch(() => {});
    }

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [recomputeVisibleCount]);

  // Close menus on outside click or Escape key
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setMoreDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserDropdownOpen(false);
      }
      if (headerRef.current && !headerRef.current.contains(target)) {
        setMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreDropdownOpen(false);
        setUserDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const primaryLinks = navLinks.slice(0, visibleCount);
  const overflowLinks = navLinks.slice(visibleCount);
  const isOverflowActive = overflowLinks.some((link) => link.id === currentTab);

  const toggleLanguage = () => setLang(lang === 'en' ? 'ar' : 'en');
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const handleSelectNav = (id: string) => {
    setCurrentTab(id);
    setMoreDropdownOpen(false);
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  };

  const handleConfirmDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteAccountAndData();
    setDeleting(false);
    if (res.success) {
      setConfirmDeleteOpen(false);
      setUserDropdownOpen(false);
    } else {
      setDeleteError(translateApiError(res.error, lang));
    }
  };

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/85 dark:bg-[#0c0c0e]/85 border-b border-black/5 dark:border-white/10 transition-colors"
      >
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-5 min-w-0">
          {/* Brand (Start) */}
          <button
            type="button"
            onClick={() => handleSelectNav('home')}
            className="flex items-center gap-2 sm:gap-2.5 group select-none text-start shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center shadow-xs shrink-0">
              <span className="text-white dark:text-black font-extrabold text-base sm:text-lg tracking-tighter">
                Y
              </span>
            </div>
            <div className="whitespace-nowrap flex items-baseline" dir="ltr">
              <span className="font-bold text-sm sm:text-base lg:text-lg tracking-tight text-zinc-900 dark:text-zinc-100">
                YOUNEEL
              </span>
              <span className="text-[10px] sm:text-xs font-semibold tracking-wider sm:tracking-widest text-emerald-600 dark:text-emerald-400 ms-1 sm:ms-1.5 uppercase">
                TRADING
              </span>
            </div>
          </button>

          {/* Desktop Adaptive Priority+ Navigation (>= 1024px) */}
          <nav
            ref={navRef}
            aria-label={t.navMenuLabel}
            className="hidden lg:flex flex-1 min-w-0 items-center justify-center gap-1 relative"
          >
            {/* Hidden deterministic width measurement mirror (exact same padding & typography) */}
            <div
              ref={measureRowRef}
              aria-hidden="true"
              className="pointer-events-none invisible absolute top-0 start-0 flex items-center gap-1 whitespace-nowrap"
            >
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <span
                    key={link.id}
                    data-measure-item
                    className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5"
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{link.label}</span>
                  </span>
                );
              })}
              <span
                data-measure-more
                className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap shrink-0 flex items-center gap-1"
              >
                <span>{t.navMore}</span>
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              </span>
            </div>

            {primaryLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentTab === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleSelectNav(link.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 opacity-80 shrink-0" />
                  <span>{link.label}</span>
                </button>
              );
            })}

            {overflowLinks.length > 0 && (
              <div ref={moreMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMoreDropdownOpen((v) => !v)}
                  aria-expanded={moreDropdownOpen}
                  aria-haspopup="menu"
                  className={`px-2.5 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 ${
                    isOverflowActive || moreDropdownOpen
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span>{t.navMore}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${
                      moreDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {moreDropdownOpen && (
                  <div
                    role="menu"
                    className="animate-navPop absolute end-0 mt-2 w-60 rounded-xl bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/10 shadow-xl py-1.5 z-50"
                  >
                    {overflowLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive = currentTab === link.id;
                      return (
                        <button
                          key={link.id}
                          type="button"
                          role="menuitem"
                          onClick={() => handleSelectNav(link.id)}
                          className={`w-full text-start px-3.5 py-2.5 text-[13px] font-medium flex items-center justify-between gap-2.5 transition-colors ${
                            isActive
                              ? 'bg-zinc-900/5 dark:bg-white/10 text-zinc-950 dark:text-white font-semibold'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 hover:text-zinc-950 dark:hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 opacity-80 shrink-0" />
                            <span className="truncate">{link.label}</span>
                          </span>
                          {isActive && (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Utilities & Auth Controls (End) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLanguage}
              title={t.langToggle}
              aria-label={t.langToggle}
              className="p-1.5 sm:p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1 text-xs font-semibold shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
            >
              <Globe className="w-4 h-4 opacity-75 shrink-0" />
              <span className="uppercase">{lang === 'ar' ? 'EN' : 'AR'}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title={t.themeToggle}
              aria-label={t.themeToggle}
              className="p-1.5 sm:p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <div ref={userMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((v) => !v)}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 sm:ps-2.5 rounded-lg border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                >
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span
                    className="text-xs font-medium text-zinc-800 dark:text-zinc-200 hidden sm:inline max-w-[110px] truncate"
                    dir="ltr"
                  >
                    {user.email?.split('@')[0]}
                  </span>
                </button>

                {userDropdownOpen && (
                  <div
                    role="menu"
                    className="animate-navPop absolute end-0 mt-2 w-60 rounded-xl bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/10 shadow-xl py-2 z-50"
                  >
                    <div className="px-4 py-2 border-b border-black/5 dark:border-white/10">
                      <p className="text-[11px] text-zinc-400 font-medium">
                        {t.signedInLabel} {isAdmin ? `(${t.adminBadge})` : ''}
                      </p>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate" dir="ltr">
                        {user.email}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectNav('journal')}
                      className="w-full text-start px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>{t.navJournal}</span>
                    </button>

                    {isOwnerAccount && (
                      <button
                        type="button"
                        onClick={() => handleSelectNav('owner')}
                        className="w-full text-start px-4 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 flex items-center gap-2"
                      >
                        <KeyRound className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.ownerStudioLabel}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        signOut();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full text-start px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <span>{t.signOut}</span>
                    </button>

                    <div className="border-t border-black/5 dark:border-white/10 mt-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setUserDropdownOpen(false);
                          setConfirmDeleteOpen(true);
                        }}
                        className="w-full text-start px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.deleteAccount}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
              >
                {t.signIn}
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-expanded={mobileMenuOpen}
              aria-label={t.navMenuLabel}
              className="lg:hidden p-1.5 sm:p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Tablet & Mobile Menu (< 1024px) */}
        {mobileMenuOpen && (
          <div className="animate-navPop lg:hidden px-4 pt-2 pb-4 border-t border-black/5 dark:border-white/10 bg-white/95 dark:bg-[#0c0c0e]/95 backdrop-blur-xl max-h-[calc(100vh-4rem)] overflow-y-auto shadow-lg">
            <nav aria-label={t.navMenuLabel} className="flex flex-col gap-1 max-w-xl mx-auto">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = currentTab === link.id;
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => handleSelectNav(link.id)}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 text-start transition-colors ${
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4 opacity-80 shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Mobile bottom tab bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-2xl bg-white/90 dark:bg-[#0c0c0e]/90 border-t border-black/10 dark:border-white/10">
        <div className="grid grid-cols-5 h-14 items-center">
          {[
            { id: 'home', label: t.navHome, icon: TrendingUp },
            { id: 'markets', label: t.navMarkets, icon: TrendingUp },
            { id: 'analysis', label: t.navAnalysis, icon: Compass },
            { id: 'journal', label: t.navJournal, icon: BookOpen },
            { id: 'news', label: t.navNews, icon: Newspaper },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectNav(tab.id)}
                className={`flex flex-col items-center justify-center py-1 transition-colors min-w-0 ${
                  isActive
                    ? 'text-zinc-950 dark:text-white font-semibold'
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
                <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[68px]">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* In-App Delete Account Confirmation Modal */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-2xl p-6 shadow-2xl border border-black/10 dark:border-white/10 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold">{t.deleteAccount}</h3>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t.deleteConfirm}
            </p>
            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
                {deleteError}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {deleting ? t.deletingBtn : t.deleteAccount}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
