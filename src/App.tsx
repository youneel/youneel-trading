import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { HomePage } from './pages/HomePage';
import { MarketsPage } from './pages/MarketsPage';
import { Language, translations } from './lib/i18n';
import { useLivePrices } from './hooks/useLivePrices';
import { SupportedSymbol } from './lib/tradingMath';

const AnalysisPage = lazy(() =>
  import('./pages/AnalysisPage').then((m) => ({ default: m.AnalysisPage }))
);
const JournalPage = lazy(() =>
  import('./pages/JournalPage').then((m) => ({ default: m.JournalPage }))
);
const NewsPage = lazy(() =>
  import('./pages/NewsPage').then((m) => ({ default: m.NewsPage }))
);
const GiveawaysPage = lazy(() =>
  import('./pages/GiveawaysPage').then((m) => ({ default: m.GiveawaysPage }))
);
const CompetitionsPage = lazy(() =>
  import('./pages/CompetitionsPage').then((m) => ({ default: m.CompetitionsPage }))
);
const BrokersPage = lazy(() =>
  import('./pages/BrokersPage').then((m) => ({ default: m.BrokersPage }))
);
const ContactPage = lazy(() =>
  import('./pages/ContactPage').then((m) => ({ default: m.ContactPage }))
);
const OwnerPage = lazy(() =>
  import('./pages/OwnerPage').then((m) => ({ default: m.OwnerPage }))
);

const VALID_TABS = [
  'home',
  'markets',
  'analysis',
  'journal',
  'news',
  'giveaways',
  'competitions',
  'brokers',
  'contact',
];

function isOwnerPathname(): boolean {
  return (
    window.location.pathname.replace(/\/+$/, '') === '/owner' ||
    window.location.hash.replace('#', '') === 'owner'
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; lang: Language },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; lang: Language }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', {
      message: error?.message || String(error),
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      const isAr = this.props.lang === 'ar';
      return (
        <div className="max-w-md mx-auto my-20 p-6 rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 text-center space-y-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isAr ? 'حدث خطأ غير متوقع أثناء عرض هذه الصفحة.' : 'An unexpected display error occurred on this view.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90"
          >
            {isAr ? 'إعادة تحميل الصفحة' : 'Reload Page'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('youneel_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
  });

  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('youneel_lang');
    return saved === 'ar' ? 'ar' : 'en';
  });

  const [isOwnerRoute, setIsOwnerRoute] = useState<boolean>(() => {
    const owner = isOwnerPathname();
    if (owner && window.location.pathname.replace(/\/+$/, '') !== '/owner') {
      window.history.replaceState(null, '', '/owner');
    }
    return owner;
  });

  const [currentTab, setCurrentTab] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    return VALID_TABS.includes(hash) ? hash : 'home';
  });

  const [activeSymbol, setActiveSymbol] = useState<SupportedSymbol>('XAUUSD');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const { prices: liveQuotes, symbolErrors: quoteErrors, wsConnected } = useLivePrices();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('youneel_theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    localStorage.setItem('youneel_lang', lang);
  }, [lang]);

  const handleTabChange = useCallback((tab: string) => {
    if (tab === 'owner') {
      setIsOwnerRoute(true);
      if (!isOwnerPathname()) {
        window.history.pushState(null, '', '/owner');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsOwnerRoute(false);
    setCurrentTab(tab);
    if (isOwnerPathname()) {
      window.history.pushState(null, '', `/#${tab}`);
    } else {
      window.location.hash = tab;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenAuth = useCallback(() => setAuthModalOpen(true), []);
  const handleCloseAuth = useCallback(() => setAuthModalOpen(false), []);

  const handleOpenDailyAnalysis = useCallback(
    (sym: SupportedSymbol) => {
      setActiveSymbol(sym);
      handleTabChange('analysis');
    },
    [handleTabChange]
  );

  const handleOpenTerminal = useCallback(
    (sym: SupportedSymbol) => {
      setActiveSymbol(sym);
      handleTabChange('markets');
    },
    [handleTabChange]
  );

  useEffect(() => {
    const handleHashOrPop = () => {
      const ownerPath = isOwnerPathname();
      setIsOwnerRoute(ownerPath);
      if (ownerPath) {
        if (window.location.pathname.replace(/\/+$/, '') !== '/owner') {
          window.history.replaceState(null, '', '/owner');
        }
      } else {
        const hash = window.location.hash.replace('#', '');
        if (VALID_TABS.includes(hash)) {
          setCurrentTab(hash);
        }
      }
    };
    window.addEventListener('hashchange', handleHashOrPop);
    window.addEventListener('popstate', handleHashOrPop);
    return () => {
      window.removeEventListener('hashchange', handleHashOrPop);
      window.removeEventListener('popstate', handleHashOrPop);
    };
  }, []);

  const isTerminalView = !isOwnerRoute && currentTab === 'markets';
  const t = translations[lang];

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-[#f5f5f7] dark:bg-[#0c0c0e] text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
        <Navbar
          currentTab={isOwnerRoute ? 'owner' : currentTab}
          setCurrentTab={handleTabChange}
          lang={lang}
          setLang={setLang}
          theme={theme}
          setTheme={setTheme}
          onOpenAuthModal={handleOpenAuth}
        />

        <main className={`flex-1 ${isTerminalView ? 'pb-14 lg:pb-0' : 'pb-16 md:pb-8'}`}>
          <AppErrorBoundary lang={lang}>
          {!isOwnerRoute && currentTab === 'home' && (
            <HomePage
              lang={lang}
              onNavigate={handleTabChange}
              onSelectSymbol={setActiveSymbol}
              quotes={liveQuotes}
              quoteErrors={quoteErrors}
            />
          )}
          {!isOwnerRoute && currentTab === 'markets' && (
            <MarketsPage
              lang={lang}
              theme={theme}
              quotes={liveQuotes}
              quoteErrors={quoteErrors}
              wsConnected={wsConnected}
              selectedSymbol={activeSymbol}
              onSelectSymbol={setActiveSymbol}
              onOpenAuth={handleOpenAuth}
              onOpenDailyAnalysis={handleOpenDailyAnalysis}
            />
          )}
          <Suspense
            fallback={
              <div className="py-24 text-center text-xs text-zinc-500 dark:text-zinc-400">
                {t.loadingPage}
              </div>
            }
          >
            {isOwnerRoute && (
              <OwnerPage
                lang={lang}
                onExitOwner={() => handleTabChange('home')}
              />
            )}
            {!isOwnerRoute && currentTab === 'analysis' && (
              <AnalysisPage
                lang={lang}
                selectedSymbol={activeSymbol}
                onSelectSymbol={setActiveSymbol}
                onOpenTerminal={handleOpenTerminal}
              />
            )}
            {!isOwnerRoute && currentTab === 'journal' && (
              <JournalPage
                lang={lang}
                onOpenAuth={handleOpenAuth}
                quotes={liveQuotes}
              />
            )}
            {!isOwnerRoute && currentTab === 'news' && <NewsPage lang={lang} />}
            {!isOwnerRoute && currentTab === 'giveaways' && (
              <GiveawaysPage
                lang={lang}
                onOpenAuth={handleOpenAuth}
                onNavigateOwner={() => handleTabChange('owner')}
              />
            )}
            {!isOwnerRoute && currentTab === 'competitions' && (
              <CompetitionsPage lang={lang} />
            )}
            {!isOwnerRoute && currentTab === 'brokers' && <BrokersPage lang={lang} />}
            {!isOwnerRoute && currentTab === 'contact' && <ContactPage lang={lang} />}
          </Suspense>
          </AppErrorBoundary>
        </main>

        {!isTerminalView && !isOwnerRoute && <Footer lang={lang} />}

        <AuthModal
          isOpen={authModalOpen}
          onClose={handleCloseAuth}
          lang={lang}
          onOwnerSignIn={() => handleTabChange('owner')}
        />
      </div>
    </AuthProvider>
  );
}
