import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ArrowRight,
  Activity,
  Layers,
  Cpu,
  Award,
  Trophy,
  Gift,
  Newspaper,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { Language, translations, translateFreshness } from '../lib/i18n';
import { MarketQuote, SymbolQuoteError } from '../hooks/useLivePrices';
import { ALL_SUPPORTED_SYMBOLS, INSTRUMENT_SPECS, SupportedSymbol } from '../lib/tradingMath';
import {
  BrokerCompetitionCard,
  PublicBrokerCompetition,
} from '../components/BrokerCompetitionCard';
import { GiveawayStyledCard } from '../components/GiveawayStyledCard';
import { GiveawayItem } from '../lib/giveawayTemplates';
import { MarketChartBackdrop } from '../components/MarketChartBackdrop';
import { useAuth } from '../context/AuthContext';

interface HomePageProps {
  lang: Language;
  onNavigate: (tab: string) => void;
  onSelectSymbol?: (sym: SupportedSymbol) => void;
  onOpenAuth?: () => void;
  quotes: Record<string, MarketQuote>;
  quoteErrors?: Record<string, SymbolQuoteError>;
}

interface HomeAnalysisSummary {
  symbol: SupportedSymbol;
  tradingDate: string;
  bias: 'Bullish' | 'Bearish' | 'Neutral' | string;
  directionalAlignmentPct?: number;
  referencePrice?: number;
}

interface HomeNewsHeadline {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

const HomePageInner: React.FC<HomePageProps> = ({
  lang,
  onNavigate,
  onSelectSymbol,
  onOpenAuth,
  quotes,
  quoteErrors = {},
}) => {
  const t = translations[lang];
  const { user, accessToken } = useAuth();
  const [featuredCompetitions, setFeaturedCompetitions] = useState<PublicBrokerCompetition[]>([]);
  const [analysisSummaries, setAnalysisSummaries] = useState<HomeAnalysisSummary[]>([]);
  const [activeGiveaways, setActiveGiveaways] = useState<GiveawayItem[]>([]);
  const [latestNews, setLatestNews] = useState<HomeNewsHeadline[]>([]);
  const [newsUnavailable, setNewsUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/competitions/featured', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.competitions)) {
          setFeaturedCompetitions(data.competitions);
        }
      })
      .catch(() => {});

    fetch('/api/analysis/summaries', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.summaries) {
          const list = Array.isArray(data.summaries)
            ? data.summaries
            : Object.values(data.summaries);
          const normalized = list
            .filter((item: any) => item && item.symbol)
            .slice(0, 4)
            .map((item: any) => ({
              symbol: item.symbol,
              tradingDate: item.tradingDate,
              bias: item.dailyBias || item.bias || 'Neutral',
              directionalAlignmentPct:
                typeof item.directionalAlignmentScore === 'number'
                  ? item.directionalAlignmentScore
                  : item.directionalAlignmentPct,
              referencePrice: item.referencePrice,
            }));
          setAnalysisSummaries(normalized);
        }
      })
      .catch(() => {});

    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    fetch('/api/giveaways', { signal: controller.signal, headers, credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.giveaways)) {
          setActiveGiveaways(data.giveaways.filter((g: GiveawayItem) => g.status === 'active').slice(0, 3));
        }
      })
      .catch(() => {});

    fetch('/api/news', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          setNewsUnavailable(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && Array.isArray(data.news) && data.news.length > 0) {
          setLatestNews(data.news.slice(0, 3));
          setNewsUnavailable(false);
        } else if (data) {
          setNewsUnavailable(true);
        }
      })
      .catch(() => setNewsUnavailable(true));

    return () => controller.abort();
  }, [accessToken]);

  const formatQuotePrice = (price: number, sym: SupportedSymbol) => {
    const dec = INSTRUMENT_SPECS[sym].decimals;
    if (dec >= 3) return price.toFixed(dec);
    return price.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };

  return (
    <div className="relative isolate overflow-hidden min-h-[calc(100vh-4rem)]">
      <MarketChartBackdrop />
      <div className="relative z-10 space-y-16 py-6 sm:py-12">
      {/* Hero Section */}
      <section className="text-center max-w-4xl mx-auto px-4 space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          {t.heroTag}
        </p>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-[1.1] text-balance">
          {t.heroTitle}
        </h1>

        <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 font-normal max-w-2xl mx-auto leading-relaxed text-balance">
          {t.heroSubtitle}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('markets')}
            className="px-6 py-3 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold text-sm hover:opacity-90 transition-all shadow-sm flex items-center gap-2"
          >
            <span>{t.exploreMarkets}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>

          <button
            onClick={() => onNavigate('analysis')}
            className="px-6 py-3 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-zinc-900 dark:text-white font-semibold text-sm border border-black/10 dark:border-white/10 transition-all flex items-center gap-2"
          >
            <span>{t.navAnalysis}</span>
          </button>

          <button
            onClick={() => onNavigate('journal')}
            className="px-6 py-3 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-zinc-900 dark:text-white font-semibold text-sm border border-black/10 dark:border-white/10 transition-all flex items-center gap-2"
          >
            <span>{t.openJournal}</span>
          </button>
        </div>
      </section>

      {/* Live 8-Instrument Market Quick-Cards */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {ALL_SUPPORTED_SYMBOLS.map((sym) => {
            const spec = INSTRUMENT_SPECS[sym];
            const quote = quotes[sym];
            const err = quoteErrors[sym];
            const price = quote?.price;
            const change = quote?.change24h;
            const isPositive = (change ?? 0) >= 0;

            return (
              <button
                key={sym}
                type="button"
                onClick={() => {
                  onSelectSymbol?.(sym);
                  onNavigate('markets');
                }}
                className="text-start p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-[#121214]/90 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs hover:border-black/20 dark:hover:border-white/25 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm sm:text-base text-zinc-900 dark:text-white tracking-tight" dir="ltr">
                    {sym}
                  </span>
                  {err ? (
                    <span className="text-[10px] font-bold uppercase text-rose-500">
                      {t.statusUnavailable}
                    </span>
                  ) : change !== undefined ? (
                    <span
                      dir="ltr"
                      className={`text-xs px-2 py-0.5 rounded-md font-semibold tabular-nums ${
                        isPositive
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {change.toFixed(2)}%
                    </span>
                  ) : null}
                </div>

                <div className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 my-1 font-mono tabular-nums" dir="ltr">
                  {err ? t.notAvailableShort : price !== undefined ? formatQuotePrice(price, sym) : '---'}
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">
                  <span className="truncate">{spec.displayName}</span>
                  <span className="shrink-0 ms-1 uppercase font-semibold">
                    {quote
                      ? translateFreshness(quote.freshness, quote.isLive, quote.fallbackUsed, lang)
                      : spec.marketType}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Daily Institutional Bias Highlights */}
      {analysisSummaries.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              <BarChart3 className="w-4 h-4" />
              <span>{t.homeDailyBiasHeading}</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analysis')}
              className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1"
            >
              <span>{t.navAnalysis}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {analysisSummaries.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => {
                  onSelectSymbol?.(item.symbol);
                  onNavigate('analysis');
                }}
                className="text-start p-4 rounded-2xl bg-white/90 dark:bg-[#121214]/90 border border-black/5 dark:border-white/10 hover:border-black/20 dark:hover:border-white/25 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm" dir="ltr">{item.symbol}</span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                      item.bias.includes('Bullish')
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : item.bias.includes('Bearish')
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                        : 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {item.bias}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono" dir="ltr">
                  <span>{item.referencePrice ? formatQuotePrice(item.referencePrice, item.symbol) : '—'}</span>
                  {typeof item.directionalAlignmentPct === 'number' && (
                    <span>{item.directionalAlignmentPct}%</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Active YOUNEEL GIVEAWAYS Preview */}
      {activeGiveaways.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                <Gift className="w-4 h-4" />
                <span>{t.navGiveaways}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {t.giveawaysGroupActive}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('giveaways')}
              className="self-start sm:self-auto px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 flex items-center gap-1.5"
            >
              <span>{t.viewAllGiveawaysBtn}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {activeGiveaways.map((g) => (
              <GiveawayStyledCard
                key={g.id}
                item={g}
                lang={lang}
                isSignedIn={Boolean(user)}
                onOpenAuth={onOpenAuth}
                onEnterClick={() => onNavigate('giveaways')}
              />
            ))}
          </div>
        </section>
      )}

      {/* Featured Broker Competitions (Strict separation from YOUNEEL GIVEAWAYS) */}
      {featuredCompetitions.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                <Trophy className="w-4 h-4" />
                <span>{t.navCompetitions}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {t.featuredCompetitionsTitle}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
                {t.featuredCompetitionsDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('competitions')}
              className="self-start sm:self-auto px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
            >
              <span>{t.viewAllCompetitionsBtn}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {featuredCompetitions.map((comp) => (
              <BrokerCompetitionCard key={comp.id} competition={comp} lang={lang} />
            ))}
          </div>
        </section>
      )}

      {/* Latest Verified News Highlights */}
      <section className="max-w-6xl mx-auto px-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            <Newspaper className="w-4 h-4" />
            <span>{t.homeLatestNewsHeading}</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('news')}
            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline flex items-center gap-1"
          >
            <span>{t.navNews}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

        {latestNews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {latestNews.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="p-4 rounded-2xl bg-white/90 dark:bg-[#121214]/90 border border-black/5 dark:border-white/10 hover:border-black/20 dark:hover:border-white/25 transition-all flex flex-col justify-between gap-3"
              >
                <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white leading-snug line-clamp-3">
                  {item.title}
                </h3>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{item.source}</span>
                  <span className="flex items-center gap-1 font-mono" dir="ltr">
                    {new Date(item.publishedAt).toLocaleDateString()}
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        ) : newsUnavailable ? (
          <div className="p-4 rounded-xl bg-white/70 dark:bg-[#121214]/70 border border-black/5 dark:border-white/10 text-xs text-zinc-500">
            {t.homeNewsUnavailableNotice}
          </div>
        ) : null}
      </section>

      {/* Core Capabilities */}
      <section className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t.statsTitle}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="p-6 sm:p-8 rounded-2xl bg-white/90 dark:bg-[#121214]/90 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1.5">
              {t.liveFeedsFeature}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t.liveFeedsDesc}
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl bg-white/90 dark:bg-[#121214]/90 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1.5">
              {t.mt5JournalFeature}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t.mt5JournalDesc}
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl bg-white/90 dark:bg-[#121214]/90 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 flex items-center justify-center mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1.5">
              {t.aiNewsFeature}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t.aiNewsDesc}
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl bg-white/90 dark:bg-[#121214]/90 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1.5">
              {t.brokerPartnershipFeature}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t.brokerPartnershipDesc}
            </p>
          </div>
        </div>
      </section>

      {/* Educational Notice */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="p-4 sm:p-5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/10 flex items-start gap-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 me-1">
              {t.educationalNoticeLabel}
            </span>
            {t.educationalDisclaimer}
          </div>
        </div>
      </section>
      </div>
    </div>
  );
};

export const HomePage = React.memo(HomePageInner);
