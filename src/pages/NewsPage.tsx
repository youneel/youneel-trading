import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  RefreshCw,
  AlertCircle,
  Cpu,
  Landmark,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import { Language, translations, translateApiError } from '../lib/i18n';
import { ALL_SUPPORTED_SYMBOLS, SupportedSymbol } from '../lib/tradingMath';
import { ProtectedContent } from '../components/ProtectedContent';
import { FundamentalAnalysisView } from '../components/FundamentalAnalysisView';

export type MarketNewsCategory =
  | 'GOLD'
  | 'US_INDICES'
  | 'FOREX'
  | 'CRYPTO'
  | 'OIL_COMMODITIES'
  | 'US_MACRO';

export type MarketFilterValue = 'ALL' | MarketNewsCategory;

interface RealNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
  marketCategory?: MarketNewsCategory;
  marketCategories?: MarketNewsCategory[];
  relatedInstruments?: SupportedSymbol[];
  impactLevel?: 'High' | 'Medium' | 'Low';
  macroEventLink?: 'CPI' | 'FOMC' | 'PPI' | 'NFP';
  freshness?: 'live' | 'recent' | 'archive';
  ageHours?: number;
}

interface NewsPageProps {
  lang: Language;
}

export const NewsPage: React.FC<NewsPageProps> = ({ lang }) => {
  const t = translations[lang];

  const allSymbols: SupportedSymbol[] = [...ALL_SUPPORTED_SYMBOLS];
  const [selectedMarket, setSelectedMarket] = useState<MarketFilterValue>('ALL');
  const [selectedAsset, setSelectedAsset] = useState<'ALL' | SupportedSymbol>('ALL');
  const [activeTab, setActiveTab] = useState<'today' | 'old' | 'macro'>('today');

  // Today's Verified Wire State (<72h only)
  const [news, setNews] = useState<RealNewsItem[]>([]);
  const [newsSources, setNewsSources] = useState<string[]>([]);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [loadingNews, setLoadingNews] = useState(true);

  // Historical Official Archive State
  const [historicalArchive, setHistoricalArchive] = useState<RealNewsItem[]>([]);
  const [archiveSources, setArchiveSources] = useState<string[]>([]);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // On-demand Macro Impact Analysis
  const [analyzingMap, setAnalyzingMap] = useState<Record<string, boolean>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const [analysisResults, setAnalysisResults] = useState<
    Record<string, Record<string, { impact: 'Bullish' | 'Bearish' | 'Neutral'; reasoning: string }>>
  >({});

  const marketFilters: Array<{ value: MarketFilterValue; label: string }> = [
    { value: 'ALL', label: t.marketFilterAll },
    { value: 'GOLD', label: t.marketFilterGold },
    { value: 'US_INDICES', label: t.marketFilterIndices },
    { value: 'FOREX', label: t.marketFilterForex },
    { value: 'CRYPTO', label: t.marketFilterCrypto },
    { value: 'OIL_COMMODITIES', label: t.marketFilterOil },
    { value: 'US_MACRO', label: t.marketFilterMacro },
  ];

  const fetchTodayNews = useCallback(async () => {
    setLoadingNews(true);
    setNewsError(null);
    try {
      const res = await fetch('/api/news');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setNews(Array.isArray(data.news) ? data.news : []);
      setNewsSources(Array.isArray(data.sourcesActive) ? data.sourcesActive : []);
    } catch (err: any) {
      setNews([]);
      setNewsError(translateApiError(err?.message, lang));
    } finally {
      setLoadingNews(false);
    }
  }, [lang]);

  const fetchHistoricalArchive = useCallback(async () => {
    setLoadingArchive(true);
    setArchiveError(null);
    try {
      const res = await fetch('/api/historical-news');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setHistoricalArchive(Array.isArray(data.archive) ? data.archive : []);
      setArchiveSources(Array.isArray(data.sourcesActive) ? data.sourcesActive : []);
    } catch (err: any) {
      setHistoricalArchive([]);
      setArchiveError(translateApiError(err?.message, lang));
    } finally {
      setLoadingArchive(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchTodayNews();
  }, [fetchTodayNews]);

  useEffect(() => {
    if (activeTab === 'old' && historicalArchive.length === 0 && !archiveError) {
      fetchHistoricalArchive();
    }
  }, [activeTab, historicalArchive.length, archiveError, fetchHistoricalArchive]);

  const matchesMarketFilter = useCallback(
    (item: RealNewsItem, market: MarketFilterValue): boolean => {
      if (market === 'ALL') return true;
      if (item.marketCategory === market) return true;
      if (Array.isArray(item.marketCategories) && item.marketCategories.includes(market)) return true;
      return false;
    },
    []
  );

  const matchesAssetFilter = useCallback(
    (item: RealNewsItem, asset: 'ALL' | SupportedSymbol): boolean => {
      if (asset === 'ALL') return true;
      return Array.isArray(item.relatedInstruments) && item.relatedInstruments.includes(asset);
    },
    []
  );

  const activeItemsSource = activeTab === 'old' ? historicalArchive : news;

  const marketCounts = useMemo(() => {
    const counts: Record<MarketFilterValue, number> = {
      ALL: activeItemsSource.length,
      GOLD: 0,
      US_INDICES: 0,
      FOREX: 0,
      CRYPTO: 0,
      OIL_COMMODITIES: 0,
      US_MACRO: 0,
    };
    for (const item of activeItemsSource) {
      for (const f of marketFilters) {
        if (f.value !== 'ALL' && matchesMarketFilter(item, f.value)) {
          counts[f.value] += 1;
        }
      }
    }
    return counts;
  }, [activeItemsSource, matchesMarketFilter]);

  const visibleNews = useMemo(
    () => news.filter((item) => matchesMarketFilter(item, selectedMarket) && matchesAssetFilter(item, selectedAsset)),
    [news, selectedMarket, selectedAsset, matchesMarketFilter, matchesAssetFilter]
  );

  const visibleArchive = useMemo(
    () =>
      historicalArchive.filter(
        (item) => matchesMarketFilter(item, selectedMarket) && matchesAssetFilter(item, selectedAsset)
      ),
    [historicalArchive, selectedMarket, selectedAsset, matchesMarketFilter, matchesAssetFilter]
  );

  const handleSelectMarket = (val: MarketFilterValue) => {
    setSelectedMarket(val);
    setSelectedAsset('ALL');
  };

  const analyzeItemImpact = async (item: RealNewsItem) => {
    setAnalyzingMap((prev) => ({ ...prev, [item.id]: true }));
    setAnalysisErrors((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });

    const targetSymbols =
      selectedAsset !== 'ALL'
        ? [selectedAsset]
        : item.relatedInstruments && item.relatedInstruments.length > 0
        ? item.relatedInstruments
        : allSymbols;

    try {
      const res = await fetch('/api/news-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: item.title,
          summary: item.summary,
          symbols: targetSymbols,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Analysis unavailable (HTTP ${res.status})`);
      }
      if (data.analysis) {
        setAnalysisResults((prev) => ({
          ...prev,
          [item.id]: data.analysis,
        }));
      }
    } catch (err: any) {
      setAnalysisErrors((prev) => ({
        ...prev,
        [item.id]: translateApiError(err?.message, lang),
      }));
    } finally {
      setAnalyzingMap((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const renderImpactBadge = (impact: 'Bullish' | 'Bearish' | 'Neutral') => {
    if (impact === 'Bullish') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          <TrendingUp className="w-3 h-3" />
          <span>{t.bullish}</span>
        </span>
      );
    } else if (impact === 'Bearish') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
          <TrendingDown className="w-3 h-3" />
          <span>{t.bearish}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
        <Minus className="w-3 h-3" />
        <span>{t.neutral}</span>
      </span>
    );
  };

  const getFreshnessLabel = (item: RealNewsItem) => {
    const f = item.freshness || 'recent';
    if (f === 'live') return t.freshLiveBadge;
    if (f === 'recent') return t.freshRecentBadge;
    return t.freshArchiveBadge;
  };

  const getImpactLevelLabel = (level?: RealNewsItem['impactLevel']) => {
    if (level === 'High') return t.impactHigh;
    if (level === 'Low') return t.impactLow;
    return t.impactMedium;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Page Header */}
      <div className="border-b border-black/5 dark:border-white/10 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
          {t.newsTitle}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t.newsSubtitle}</p>

        {/* Primary View Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'today'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {t.tabToday}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('old')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'old'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {t.tabOldNews}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('macro')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'macro'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                : 'bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>{t.tabMacroEvents}</span>
          </button>
        </div>
      </div>

      {/* Multi-Market Category & Instrument Filters */}
      {activeTab !== 'macro' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <Filter className="w-3.5 h-3.5 text-zinc-500" />
              <span>{t.filterMarkets}</span>
            </div>

            {selectedMarket === 'US_MACRO' && (
              <button
                type="button"
                onClick={() => setActiveTab('macro')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>{t.openMacroBreakdownBtn}</span>
                <ArrowUpRight className="w-3.5 h-3.5 rtl:rotate-[-90deg]" />
              </button>
            )}
          </div>

          {/* 7 Explicit Market Filters */}
          <div
            role="tablist"
            aria-label={t.filterMarkets}
            className="flex flex-wrap items-center gap-2"
          >
            {marketFilters.map((f) => {
              const isActive = selectedMarket === f.value;
              const count = marketCounts[f.value] ?? 0;
              return (
                <button
                  key={f.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-market-filter={f.value}
                  onClick={() => handleSelectMarket(f.value)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-black/5 dark:border-white/5'
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    dir="ltr"
                    className={`font-mono text-[11px] tabular-nums ${
                      isActive ? 'opacity-80' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Optional Specific Instrument Refinement */}
          <div className="pt-3 border-t border-black/5 dark:border-white/10 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedAsset('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedAsset === 'ALL'
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-950 dark:text-white'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {t.assetFilterAll}
            </button>
            {allSymbols.map((sym) => {
              const active = selectedAsset === sym;
              return (
                <button
                  key={sym}
                  type="button"
                  data-asset-filter={sym}
                  onClick={() => setSelectedAsset(active ? 'ALL' : sym)}
                  dir="ltr"
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-sky-600 text-white dark:bg-sky-500 dark:text-zinc-950'
                      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {sym}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 1: Live Verified Multi-Market Wire (<72h) */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              {newsSources.length > 0
                ? `${t.verifiedProvidersPrefix} ${newsSources.join(' · ')}`
                : t.verifiedFinancialWire}
            </span>
            <button
              type="button"
              onClick={fetchTodayNews}
              disabled={loadingNews}
              className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingNews ? 'animate-spin' : ''}`} />
              <span>{t.retry}</span>
            </button>
          </div>

          {newsError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{newsError}</span>
            </div>
          )}

          {loadingNews ? (
            <div className="py-16 text-center text-zinc-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
              <span>{t.loadingVerifiedWire}</span>
            </div>
          ) : visibleNews.length === 0 ? (
            <div
              data-testid="news-empty-state"
              className="py-14 px-6 text-center rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 space-y-3"
            >
              <h3 className="text-base font-bold text-zinc-950 dark:text-white">
                {t.noMarketNewsTitle}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                {t.noMarketNewsDesc}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedMarket('ALL');
                  setSelectedAsset('ALL');
                }}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                {t.resetMarketFiltersBtn}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleNews.map((item) => {
                const itemAnalysis = analysisResults[item.id];
                const isAnalyzing = analyzingMap[item.id];
                const aiErr = analysisErrors[item.id];
                const analysisSymbols =
                  item.relatedInstruments && item.relatedInstruments.length > 0
                    ? item.relatedInstruments
                    : allSymbols;

                return (
                  <article
                    key={item.id}
                    data-market-category={item.marketCategory}
                    className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 space-y-3.5"
                  >
                    {/* Clean editorial metadata strip (no cluttered pills) */}
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-bold ${
                            item.freshness === 'live'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-sky-600 dark:text-sky-400'
                          }`}
                        >
                          {getFreshnessLabel(item)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200" dir="ltr">
                          {item.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span dir="ltr" className="font-medium text-zinc-600 dark:text-zinc-300">
                          {item.source}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            item.impactLevel === 'High'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {getImpactLevelLabel(item.impactLevel)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums" dir="ltr">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.publishedAt).toLocaleString()}</span>
                        {typeof item.ageHours === 'number' && (
                          <span className="text-zinc-400">({item.ageHours}h)</span>
                        )}
                      </div>
                    </div>

                    {/* Headline & Short Summary */}
                    <div className="space-y-1.5">
                      <h3 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-white leading-snug" dir="ltr">
                        {item.title}
                      </h3>
                      {item.summary && (
                        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed" dir="ltr">
                          {item.summary}
                        </p>
                      )}
                    </div>

                    {/* Related Instruments & Source / Macro Connection Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {item.relatedInstruments && item.relatedInstruments.length > 0 && (
                          <>
                            <span className="text-zinc-400 dark:text-zinc-500 font-medium">
                              {t.relatedInstrumentsLabel}:
                            </span>
                            <span dir="ltr" className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                              {item.relatedInstruments.join(' · ')}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        {item.macroEventLink && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('macro')}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white underline underline-offset-4"
                          >
                            <Landmark className="w-3.5 h-3.5" />
                            <span>
                              {t.macroReleaseConnectedLabel} ({item.macroEventLink})
                            </span>
                          </button>
                        )}

                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            <span>{t.readSource}</span>
                            <ExternalLink className="w-3 h-3 rtl:rotate-[-90deg]" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* On-demand Proprietary Macro Impact Assessment */}
                    <div className="pt-3 border-t border-black/5 dark:border-white/10 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{t.macroAssetImpactTitle}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => analyzeItemImpact(item)}
                          disabled={isAnalyzing}
                          className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 text-[11px] font-semibold transition-opacity disabled:opacity-50"
                        >
                          {isAnalyzing
                            ? t.analyzingBtn
                            : itemAnalysis
                            ? t.reanalyzeSelectedBtn
                            : t.analyzeWithGeminiBtn}
                        </button>
                      </div>

                      {aiErr && (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                          {aiErr}
                        </div>
                      )}

                      {itemAnalysis && (
                        <ProtectedContent lang={lang}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {analysisSymbols.map((sym) => {
                              const symData = itemAnalysis[sym];
                              if (!symData) return null;
                              return (
                                <div
                                  key={sym}
                                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-black/5 dark:border-white/5 space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 font-mono" dir="ltr">
                                      {sym}
                                    </span>
                                    {renderImpactBadge(symData.impact)}
                                  </div>
                                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-normal" dir="ltr">
                                    {symData.reasoning}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </ProtectedContent>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Official Central Bank & Statistical Archives */}
      {activeTab === 'old' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              {archiveSources.length > 0
                ? `${t.officialArchivesPrefix} ${archiveSources.join(' · ')}`
                : `${t.headlineArchive} — Federal Reserve, ECB, BLS`}
            </span>
            <button
              type="button"
              onClick={fetchHistoricalArchive}
              disabled={loadingArchive}
              className="flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingArchive ? 'animate-spin' : ''}`} />
              <span>{t.retry}</span>
            </button>
          </div>

          {archiveError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{archiveError}</span>
            </div>
          )}

          {loadingArchive ? (
            <div className="py-16 text-center text-zinc-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
              <span>{t.loadingArchivesMsg}</span>
            </div>
          ) : visibleArchive.length === 0 ? (
            <div className="py-14 px-6 text-center rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 space-y-3">
              <p className="text-sm text-zinc-500">{t.noArchiveMsg}</p>
              {(selectedMarket !== 'ALL' || selectedAsset !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMarket('ALL');
                    setSelectedAsset('ALL');
                  }}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold"
                >
                  {t.resetMarketFiltersBtn}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleArchive.map((hist) => {
                const isExpanded = expandedId === hist.id;
                const itemAnalysis = analysisResults[hist.id];
                const isAnalyzing = analyzingMap[hist.id];
                const aiErr = analysisErrors[hist.id];
                const analysisSymbols =
                  hist.relatedInstruments && hist.relatedInstruments.length > 0
                    ? hist.relatedInstruments
                    : allSymbols;

                return (
                  <div
                    key={hist.id}
                    className="rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : hist.id)}
                      className="w-full text-start p-5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="space-y-1 pe-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          <Landmark className="w-3.5 h-3.5" />
                          <span className="font-semibold text-zinc-600 dark:text-zinc-300" dir="ltr">
                            {hist.source}
                          </span>
                          <span aria-hidden="true">·</span>
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="font-mono tabular-nums" dir="ltr">
                            {new Date(hist.publishedAt).toLocaleDateString()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span dir="ltr" className="text-zinc-500 dark:text-zinc-400">
                            {hist.category}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-white leading-snug" dir="ltr">
                          {hist.title}
                        </h3>
                      </div>

                      <div className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-5 sm:p-6 bg-zinc-50/50 dark:bg-zinc-900/30 border-t border-black/5 dark:border-white/10 space-y-4">
                        {hist.summary && (
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed" dir="ltr">
                            {hist.summary}
                          </p>
                        )}

                        {hist.relatedInstruments && hist.relatedInstruments.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-zinc-400">{t.relatedInstrumentsLabel}:</span>
                            <span dir="ltr" className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                              {hist.relatedInstruments.join(' · ')}
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {hist.url && (
                            <a
                              href={hist.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                            >
                              <span>{t.readSource}</span>
                              <ExternalLink className="w-3.5 h-3.5 rtl:rotate-[-90deg]" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => analyzeItemImpact(hist)}
                            disabled={isAnalyzing}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold disabled:opacity-50"
                          >
                            {isAnalyzing ? t.analyzingBtn : t.analyzeWithGeminiBtn}
                          </button>
                        </div>

                        {aiErr && (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                            {aiErr}
                          </div>
                        )}

                        {itemAnalysis && (
                          <ProtectedContent lang={lang}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {analysisSymbols.map((sym) => {
                                const symImpact = itemAnalysis[sym];
                                if (!symImpact) return null;
                                return (
                                  <div
                                    key={sym}
                                    className="p-3.5 rounded-xl bg-white dark:bg-[#18181b] border border-black/5 dark:border-white/5 space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-xs text-zinc-950 dark:text-white font-mono" dir="ltr">
                                        {sym}
                                      </span>
                                      {renderImpactBadge(symImpact.impact)}
                                    </div>
                                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed" dir="ltr">
                                      {symImpact.reasoning}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </ProtectedContent>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: US Macro Fundamental Events (CPI, FOMC, PPI, NFP) */}
      {activeTab === 'macro' && <FundamentalAnalysisView lang={lang} />}
    </div>
  );
};
