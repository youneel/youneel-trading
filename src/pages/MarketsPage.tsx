import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Info,
  SlidersHorizontal,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Lock,
  ArrowUpRight,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  Language,
  translations,
  translateFreshness,
  translateApiError,
} from '../lib/i18n';
import {
  CandlestickChart,
  ChartMode,
  TradingViewChartStyle,
} from '../components/CandlestickChart';
import { ProtectedContent } from '../components/ProtectedContent';
import { CandleData, performMarketAnalysis } from '../lib/indicators';
import { MarketQuote, SymbolQuoteError, FreshnessState } from '../hooks/useLivePrices';
import { useAuth } from '../context/AuthContext';
import { useTradeEngine } from '../hooks/useTradeEngine';
import {
  ALL_SUPPORTED_SYMBOLS,
  ALL_TIMEFRAMES,
  INSTRUMENT_SPECS,
  SupportedSymbol,
  SupportedTimeframe,
  calculateLotSizeSafe,
  calculateRequiredMarginSafe,
} from '../lib/tradingMath';

interface MarketsPageProps {
  lang: Language;
  theme: 'dark' | 'light';
  quotes: Record<string, MarketQuote>;
  quoteErrors?: Record<string, SymbolQuoteError>;
  wsConnected?: boolean;
  selectedSymbol?: SupportedSymbol;
  onSelectSymbol?: (sym: SupportedSymbol) => void;
  onOpenAuth?: () => void;
  onOpenDailyAnalysis?: (sym: SupportedSymbol) => void;
}

interface MarketMeta {
  displayName: string;
  marketType: string;
  instrument?: string;
  source: string;
  sourceTimestamp: string;
  fetchedAt: string;
  lastSuccessfulUpdate?: string;
  freshness: FreshnessState;
  isLive: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  timeframeNote?: string;
}

interface DailySummaryItem {
  symbol: SupportedSymbol;
  tradingDate: string;
  dailyBias: string;
  directionalAlignmentScore: number;
  validityStatus: 'VALID' | 'WEAKENING' | 'INVALIDATED' | string;
  referencePrice: number;
  analysisTimestamp: string;
}

interface CachedMarketEntry {
  candles: CandleData[];
  quote: MarketQuote | null;
  meta: MarketMeta;
  fetchedAtMs: number;
}

type BottomTab = 'positions' | 'pending' | 'history' | 'smc';

const TIMEFRAME_LABELS: Record<SupportedTimeframe, string> = {
  M5: '5M',
  M15: '15M',
  H1: '1H',
  H4: '4H',
  D1: '1D',
  W1: '1W',
  MN: '1M',
};

const MarketsPageInner: React.FC<MarketsPageProps> = ({
  lang,
  theme,
  quotes,
  quoteErrors = {},
  wsConnected = false,
  selectedSymbol: externalSymbol,
  onSelectSymbol,
  onOpenAuth,
  onOpenDailyAnalysis,
}) => {
  const t = translations[lang];
  const { user } = useAuth();
  const tradeEngine = useTradeEngine(quotes);

  const [internalSymbol, setInternalSymbol] = useState<SupportedSymbol>(externalSymbol || 'XAUUSD');
  const selectedSymbol = externalSymbol || internalSymbol;

  const setSelectedSymbol = useCallback(
    (sym: SupportedSymbol) => {
      setInternalSymbol(sym);
      onSelectSymbol?.(sym);
    },
    [onSelectSymbol]
  );

  const [selectedTimeframe, setSelectedTimeframe] = useState<SupportedTimeframe>('H1');
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [marketMeta, setMarketMeta] = useState<MarketMeta | null>(null);
  const [dailySummaries, setDailySummaries] = useState<Record<string, DailySummaryItem>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Instant symbol/timeframe switching cache & stale-request guard
  const candleCacheRef = useRef<Map<string, CachedMarketEntry>>(new Map());
  const fetchSeqRef = useRef<number>(0);

  // Terminal Layout & Chart Settings
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [blotterExpanded, setBlotterExpanded] = useState<boolean>(true);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [chartMode, setChartMode] = useState<ChartMode>('tradingview');
  const [chartStyle, setChartStyle] = useState<TradingViewChartStyle>('1');
  const [showDrawingTools, setShowDrawingTools] = useState<boolean>(true);
  const [showEMAs, setShowEMAs] = useState<boolean>(true);
  const [showLevels, setShowLevels] = useState<boolean>(true);
  const [bottomTab, setBottomTab] = useState<BottomTab>('positions');

  // Quick Order Modal
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [stopLoss, setStopLoss] = useState<number>(0);
  const [takeProfit, setTakeProfit] = useState<number>(0);
  const [riskPct, setRiskPct] = useState<number>(1);
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [orderError, setOrderError] = useState<string | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  const fetchMarketData = useCallback(
    async (forceSpinner = false) => {
      const key = `${selectedSymbol}:${selectedTimeframe}`;
      const cached = candleCacheRef.current.get(key);
      const seq = ++fetchSeqRef.current;

      if (cached && !forceSpinner) {
        setCandles(cached.candles);
        setQuote(cached.quote);
        setMarketMeta(cached.meta);
        setError(null);
        setLoading(false);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetch(
          `/api/market-data?symbol=${encodeURIComponent(selectedSymbol)}&timeframe=${encodeURIComponent(selectedTimeframe)}`
        );

        if (seq !== fetchSeqRef.current) return;

        if (res.status === 429) {
          const errJson = await res.json().catch(() => ({}));
          setError(translateApiError(errJson.error || t.errorLoadingData, lang));
          setLoading(false);
          return;
        }

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `Feed unavailable (HTTP ${res.status})`);
        }

        const data = await res.json();
        if (seq !== fetchSeqRef.current) return;

        const rawCandles: CandleData[] = Array.isArray(data.candles) ? data.candles : [];
        const nextQuote: MarketQuote | null = data.quote || null;
        const nextMeta: MarketMeta = {
          displayName: data.displayName || selectedSymbol,
          marketType: data.marketType || '',
          instrument: data.instrument,
          source: data.source || '',
          sourceTimestamp: data.sourceTimestamp || '',
          fetchedAt: data.fetchedAt || '',
          lastSuccessfulUpdate: data.lastSuccessfulUpdate || data.quote?.lastSuccessfulUpdate,
          freshness: data.freshness || 'stale',
          isLive: Boolean(data.isLive) && !Boolean(data.fallbackUsed),
          fallbackUsed: Boolean(data.fallbackUsed),
          fallbackReason: data.fallbackReason,
          timeframeNote: data.timeframeNote,
        };

        candleCacheRef.current.set(key, {
          candles: rawCandles,
          quote: nextQuote,
          meta: nextMeta,
          fetchedAtMs: Date.now(),
        });

        setCandles(rawCandles);
        setQuote(nextQuote);
        setMarketMeta(nextMeta);
        setError(null);
      } catch (err: any) {
        if (seq !== fetchSeqRef.current) return;
        setError(translateApiError(err?.message, lang));
        if (!cached) {
          setCandles([]);
          setQuote(null);
          setMarketMeta(null);
        }
      } finally {
        if (seq === fetchSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [selectedSymbol, selectedTimeframe, lang, t.errorLoadingData]
  );

  const fetchSummaries = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis/summaries');
      if (res.ok) {
        const data = await res.json();
        if (data.summaries) {
          setDailySummaries(data.summaries);
        }
      }
    } catch {
      // ignore optional summary failure
    }
  }, []);

  useEffect(() => {
    fetchMarketData(false);
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) {
        fetchMarketData(false);
      }
    }, 30000);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchMarketData(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchMarketData]);

  useEffect(() => {
    fetchSummaries();
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) {
        fetchSummaries();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchSummaries]);

  // Memoize structural analysis and derived arrays so CandlestickChart avoids redundant effect runs
  const analysis = useMemo(
    () =>
      candles.length > 0
        ? performMarketAnalysis(selectedSymbol, candles, selectedTimeframe)
        : null,
    [selectedSymbol, candles, selectedTimeframe]
  );

  const supportLevels = useMemo(() => analysis?.levels.supports ?? [], [analysis]);
  const resistanceLevels = useMemo(() => analysis?.levels.resistances ?? [], [analysis]);
  const orderBlocks = useMemo(() => analysis?.smc?.orderBlocks ?? [], [analysis]);
  const fairValueGaps = useMemo(() => analysis?.smc?.fairValueGaps ?? [], [analysis]);
  const liquidityPools = useMemo(() => analysis?.smc?.liquidityPools ?? [], [analysis]);

  const activeQuote = quotes[selectedSymbol] || quote || null;
  const activeFallbackUsed = Boolean(marketMeta?.fallbackUsed || activeQuote?.fallbackUsed);
  const activeFallbackReason = marketMeta?.fallbackReason || activeQuote?.fallbackReason;
  const activeLastSuccess =
    marketMeta?.lastSuccessfulUpdate ||
    activeQuote?.lastSuccessfulUpdate ||
    activeQuote?.sourceTimestamp;

  const activeFreshness: FreshnessState | undefined = (() => {
    if (!wsConnected && error && !activeQuote) return 'disconnected';
    if (marketMeta?.freshness && (marketMeta.fallbackUsed || marketMeta.freshness !== 'live')) {
      return marketMeta.freshness;
    }
    return activeQuote?.freshness || marketMeta?.freshness;
  })();

  const activeIsLive = Boolean(
    activeQuote?.isLive &&
      (marketMeta ? marketMeta.isLive : true) &&
      activeFreshness === 'live' &&
      !activeFallbackUsed
  );
  const currentPrice = activeQuote?.price;
  const change24h = activeQuote?.change24h;
  const isPositive = (change24h ?? 0) >= 0;
  const spec = INSTRUMENT_SPECS[selectedSymbol];
  const dailySummary = dailySummaries[selectedSymbol];

  const spreadDisplay = (() => {
    if (activeQuote?.spread !== undefined && Number.isFinite(activeQuote.spread)) {
      return activeQuote.spread.toFixed(spec.decimals);
    }
    if (
      activeQuote?.bid !== undefined &&
      activeQuote?.ask !== undefined &&
      Number.isFinite(activeQuote.bid) &&
      Number.isFinite(activeQuote.ask)
    ) {
      return Math.max(0, activeQuote.ask - activeQuote.bid).toFixed(spec.decimals);
    }
    return t.notAvailableShort;
  })();

  useEffect(() => {
    if (orderModalOpen && currentPrice && currentPrice > 0) {
      const sl =
        orderSide === 'buy'
          ? currentPrice - spec.defaultSlOffset
          : currentPrice + spec.defaultSlOffset;
      const tp =
        orderSide === 'buy'
          ? currentPrice + spec.defaultTpOffset
          : currentPrice - spec.defaultTpOffset;
      setStopLoss(Number(sl.toFixed(spec.decimals)));
      setTakeProfit(Number(tp.toFixed(spec.decimals)));
      setOrderError(null);
    }
  }, [orderModalOpen, selectedSymbol, orderSide, currentPrice, spec]);

  const formatPrice = useCallback(
    (val?: number | null, sym: SupportedSymbol = selectedSymbol) => {
      if (val === undefined || val === null || !Number.isFinite(val)) return '---';
      const dec = INSTRUMENT_SPECS[sym].decimals;
      if (dec >= 3) return val.toFixed(dec);
      return val.toLocaleString(undefined, {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });
    },
    [selectedSymbol]
  );

  const translateBiasLabel = (raw?: string) => {
    if (!raw) return t.neutral;
    if (raw === 'INSUFFICIENT DATA' || raw === 'Insufficient Data') return t.insufficientDataBadge;
    if (raw.includes('Bullish')) return t.bullish;
    if (raw.includes('Bearish')) return t.bearish;
    return t.neutral;
  };

  const translateValidityLabel = (status?: string) => {
    if (status === 'VALID') return t.validBadge;
    if (status === 'WEAKENING') return t.weakeningBadge;
    if (status === 'INVALIDATED') return t.invalidatedBadge;
    return status || '';
  };

  const renderStatusPill = (
    freshness?: FreshnessState,
    isLive?: boolean,
    hasError?: boolean,
    fallbackUsed?: boolean
  ) => {
    const label = hasError
      ? t.statusUnavailable
      : translateFreshness(freshness, isLive, fallbackUsed, lang);

    if (freshness === 'disconnected' || hasError || !freshness || freshness === 'unavailable') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 whitespace-nowrap">
          {label}
        </span>
      );
    }
    if (isLive && freshness === 'live' && !fallbackUsed) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {label}
        </span>
      );
    }
    if (freshness === 'market_closed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
          {label}
        </span>
      );
    }
    if (freshness === 'stale') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-700 dark:text-orange-400 whitespace-nowrap">
          {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400 whitespace-nowrap">
        {label}
      </span>
    );
  };

  const biasBadgeClass = (bias?: string) => {
    if (!bias || bias === 'INSUFFICIENT DATA' || bias === 'Insufficient Data') {
      return 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300';
    }
    if (bias.includes('Bullish')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    if (bias.includes('Bearish')) return 'bg-rose-500/15 text-rose-700 dark:text-rose-400';
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  };

  const handleSubmitQuickOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    if (!currentPrice || currentPrice <= 0) {
      setOrderError(translateApiError(`Live market quote unavailable for ${selectedSymbol}`, lang));
      return;
    }
    setSubmittingOrder(true);
    try {
      await tradeEngine.createTrade({
        symbol: selectedSymbol,
        side: orderSide,
        sl: stopLoss,
        tp: takeProfit,
        risk_pct: riskPct,
        notes: orderNotes,
      });
      setOrderModalOpen(false);
      setOrderNotes('');
      setBottomTab('positions');
      setBlotterExpanded(true);
    } catch (err: any) {
      setOrderError(translateApiError(err?.message, lang));
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleClosePosition = async (tradeId: string) => {
    setClosingId(tradeId);
    try {
      await tradeEngine.closeTrade(tradeId);
    } finally {
      setClosingId(null);
    }
  };

  const computedLot =
    currentPrice && currentPrice > 0
      ? calculateLotSizeSafe(tradeEngine.balance, riskPct, currentPrice, stopLoss, selectedSymbol)
      : spec.minLot;
  const estMargin =
    currentPrice && currentPrice > 0
      ? calculateRequiredMarginSafe(currentPrice, computedLot, selectedSymbol)
      : 0;

  return (
    <div className="w-full lg:h-[calc(100dvh-64px)] lg:min-h-[680px] flex flex-col p-1.5 sm:p-2 gap-1.5 sm:gap-2 lg:overflow-hidden min-w-0">
      {/* 1. COMPACT FULL-WIDTH TOP TOOLBAR */}
      <div className="shrink-0 rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 px-2.5 sm:px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Instrument Selector + Price + Bid/Ask/Spread + Status */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <select
              aria-label={t.instrumentSelectorAria}
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value as SupportedSymbol)}
              className="2xl:hidden px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/15 bg-zinc-100 dark:bg-zinc-900 text-xs font-extrabold text-zinc-950 dark:text-white"
            >
              {ALL_SUPPORTED_SYMBOLS.map((sym) => (
                <option key={sym} value={sym}>
                  {sym} — {INSTRUMENT_SPECS[sym].shortName}
                </option>
              ))}
            </select>

            <div className="hidden 2xl:flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/10" dir="ltr">
              {ALL_SUPPORTED_SYMBOLS.map((sym) => {
                const active = selectedSymbol === sym;
                return (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => setSelectedSymbol(sym)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    {sym}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Verified Price & 24h Change */}
          <div className="flex items-baseline gap-2" dir="ltr">
            <span className="text-lg sm:text-xl font-extrabold font-mono tabular-nums tracking-tight text-zinc-950 dark:text-white">
              {currentPrice !== undefined ? formatPrice(currentPrice) : t.statusUnavailable}
            </span>
            {change24h !== undefined && (
              <span
                className={`text-xs font-bold font-mono tabular-nums flex items-center gap-0.5 ${
                  isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {isPositive ? '+' : ''}
                {change24h.toFixed(2)}%
              </span>
            )}
          </div>

          {/* Bid / Ask / Spread */}
          <div className="hidden md:flex items-center gap-3 text-[11px] font-mono tabular-nums border-s border-black/10 dark:border-white/10 ps-3 text-zinc-500 dark:text-zinc-400">
            <div>
              <span className="text-[10px] uppercase me-1 font-sans">{t.bidLabel}</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100" dir="ltr">
                {activeQuote?.bid !== undefined ? formatPrice(activeQuote.bid) : t.notAvailableShort}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase me-1 font-sans">{t.askLabel}</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100" dir="ltr">
                {activeQuote?.ask !== undefined ? formatPrice(activeQuote.ask) : t.notAvailableShort}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase me-1 font-sans">{t.spreadLabel}</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100" dir="ltr">
                {spreadDisplay}
              </span>
            </div>
          </div>

          {/* Market Status */}
          <div className="flex items-center gap-2 border-s border-black/10 dark:border-white/10 ps-2.5 sm:ps-3">
            {renderStatusPill(
              activeFreshness,
              activeIsLive,
              Boolean(error && !activeQuote),
              activeFallbackUsed
            )}
            <span
              className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-mono ${
                wsConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
              }`}
              dir="ltr"
            >
              {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {activeLastSuccess
                ? new Date(activeLastSuccess).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : '---'}
            </span>
          </div>
        </div>

        {/* Right: 7-Timeframe Selector + Chart Tools + Panel Controls */}
        <div className="flex flex-wrap items-center gap-1.5 ms-auto">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/10" dir="ltr">
            {ALL_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setSelectedTimeframe(tf)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold font-mono whitespace-nowrap transition-colors ${
                  selectedTimeframe === tf
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {TIMEFRAME_LABELS[tf]}
              </button>
            ))}
          </div>

          {/* Chart Tools Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                settingsOpen
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-transparent'
                  : 'border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.chartToolsBtn}</span>
            </button>

            {settingsOpen && (
              <div className="absolute end-0 mt-2 w-64 rounded-xl bg-white dark:bg-[#18181b] border border-black/10 dark:border-white/15 shadow-xl p-3.5 z-40 space-y-3 text-xs">
                <div>
                  <span className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                    {t.chartEngineLabel}
                  </span>
                  <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900">
                    <button
                      type="button"
                      onClick={() => setChartMode('tradingview')}
                      className={`py-1 rounded-md font-semibold ${
                        chartMode === 'tradingview'
                          ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                          : 'text-zinc-500'
                      }`}
                    >
                      {t.chartEngineTradingView}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMode('backend')}
                      className={`py-1 rounded-md font-semibold ${
                        chartMode === 'backend'
                          ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                          : 'text-zinc-500'
                      }`}
                    >
                      {t.chartEngineQuant}
                    </button>
                  </div>
                </div>

                {chartMode === 'tradingview' ? (
                  <>
                    <div>
                      <span className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                        {t.candleStyleLabel}
                      </span>
                      <select
                        value={chartStyle}
                        onChange={(e) => setChartStyle(e.target.value as TradingViewChartStyle)}
                        className="w-full p-1.5 rounded-lg border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium"
                      >
                        <option value="1">{t.candleStyleCandles}</option>
                        <option value="9">{t.candleStyleHollow}</option>
                        <option value="8">{t.candleStyleHeikin}</option>
                        <option value="2">{t.candleStyleLine}</option>
                      </select>
                    </div>
                    <label className="flex items-center justify-between pt-1 cursor-pointer">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {t.drawingToolbarLabel}
                      </span>
                      <input
                        type="checkbox"
                        checked={showDrawingTools}
                        onChange={(e) => setShowDrawingTools(e.target.checked)}
                      />
                    </label>
                  </>
                ) : (
                  <div className="space-y-2 pt-1">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {t.emaOverlayLabel}
                      </span>
                      <input
                        type="checkbox"
                        checked={showEMAs}
                        onChange={(e) => setShowEMAs(e.target.checked)}
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {t.smcOverlayLabel}
                      </span>
                      <input
                        type="checkbox"
                        checked={showLevels}
                        onChange={(e) => setShowLevels(e.target.checked)}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toggle Side Panel */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? t.expandChartTitle : t.showSidebarTitle}
            className="hidden lg:inline-flex p-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5"
          >
            {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => {
              fetchMarketData(true);
              fetchSummaries();
            }}
            disabled={loading}
            title={t.retry}
            className="p-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Inline Feed Warning / Provenance Strip */}
      {error && (
        <div className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            onClick={() => fetchMarketData(true)}
            className="px-2.5 py-0.5 rounded bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700 shrink-0"
          >
            {t.retry}
          </button>
        </div>
      )}

      {(activeFallbackUsed || activeFreshness === 'stale' || activeFreshness === 'delayed') && !error && (
        <div className="shrink-0 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {activeFallbackReason || marketMeta?.timeframeNote || t.degradedFeedNotice}
            </span>
          </div>
          {activeLastSuccess && (
            <span className="font-mono text-[10px] shrink-0">
              {t.lastVerifiedPrefix} {new Date(activeLastSuccess).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {chartMode === 'tradingview' && !error && (
        <div className="shrink-0 px-3 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center gap-2 text-[11px]">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{t.tvFeedProvenanceNote}</span>
        </div>
      )}

      {/* 2. MAIN WORKSPACE */}
      <div
        className={`lg:flex-1 lg:min-h-0 grid grid-cols-1 gap-2 min-w-0 ${
          sidebarOpen
            ? 'lg:grid-cols-[minmax(0,1fr)_270px] xl:grid-cols-[minmax(0,1fr)_310px] 2xl:grid-cols-[minmax(0,1fr)_340px]'
            : ''
        }`}
      >
        {/* PRIMARY CHART CANVAS */}
        <section
          aria-label={t.marketsTitle}
          className="min-w-0 min-h-[480px] lg:min-h-0 lg:h-full rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-white dark:bg-[#121214]"
        >
          <CandlestickChart
            candles={candles}
            symbol={selectedSymbol}
            timeframe={selectedTimeframe}
            theme={theme}
            lang={lang}
            chartMode={chartMode}
            chartStyle={chartStyle}
            showDrawingTools={showDrawingTools}
            showEMAs={showEMAs}
            showLevels={showLevels}
            supportLevels={supportLevels}
            resistanceLevels={resistanceLevels}
            pivot={analysis?.levels.pivot}
            orderBlocks={orderBlocks}
            fairValueGaps={fairValueGaps}
            liquidityPools={liquidityPools}
            dataSource={marketMeta?.source}
            fillHeight={true}
            livePrice={currentPrice}
          />
        </section>

        {/* RIGHT SIDEBAR */}
        {sidebarOpen && (
          <aside className="min-w-0 lg:h-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121214] divide-y divide-black/10 dark:divide-white/10 flex flex-col lg:overflow-y-auto">
            {/* 8-Asset Watchlist */}
            <div className="p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                <span>{t.watchlistLabel}</span>
                <span>{t.marketsCountLabel}</span>
              </div>

              <div className="space-y-0.5">
                {ALL_SUPPORTED_SYMBOLS.map((sym) => {
                  const q = quotes[sym];
                  const err = quoteErrors[sym];
                  const symSpec = INSTRUMENT_SPECS[sym];
                  const isSelected = selectedSymbol === sym;
                  const ch = q?.change24h ?? 0;

                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => setSelectedSymbol(sym)}
                      className={`w-full py-1.5 px-2 text-start flex items-center justify-between gap-2 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                          : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs" dir="ltr">{sym}</span>
                          <span
                            className={`text-[9px] font-bold uppercase ${
                              err
                                ? 'text-rose-500'
                                : q?.isLive && !q?.fallbackUsed && q?.freshness === 'live'
                                ? 'text-emerald-500'
                                : q?.freshness === 'stale'
                                ? 'text-orange-500'
                                : q?.freshness === 'delayed'
                                ? 'text-amber-500'
                                : isSelected
                                ? 'text-zinc-300 dark:text-zinc-600'
                                : 'text-zinc-400'
                            }`}
                          >
                            {err
                              ? t.statusUnavailable
                              : !q
                              ? t.statusSync
                              : translateFreshness(q.freshness, q.isLive, q.fallbackUsed, lang)}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] truncate block ${
                            isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400'
                          }`}
                        >
                          {symSpec.shortName}
                        </span>
                      </div>

                      <div className="text-end font-mono tabular-nums shrink-0" dir="ltr">
                        <div className="text-xs font-bold">
                          {err ? t.notAvailableShort : q ? formatPrice(q.price, sym) : '---'}
                        </div>
                        {q && (
                          <div
                            className={`text-[10px] font-semibold ${
                              ch >= 0 ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                          >
                            {ch >= 0 ? '+' : ''}
                            {ch.toFixed(2)}%
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Bias & Quant Summary (Protected Proprietary Intelligence) */}
            <ProtectedContent lang={lang} className="p-2.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {t.dailyBiasQuantTitle}
                </span>
                {dailySummary && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      dailySummary.validityStatus === 'VALID'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : dailySummary.validityStatus === 'WEAKENING'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {translateValidityLabel(dailySummary.validityStatus)}
                  </span>
                )}
              </div>

              {dailySummary ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${biasBadgeClass(dailySummary.dailyBias)}`}>
                      {translateBiasLabel(dailySummary.dailyBias)}
                    </span>
                    <span className="font-mono tabular-nums text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                      {t.alignLabel}: {dailySummary.directionalAlignmentScore}/100
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                    <span>{t.sessionLabel}: {dailySummary.tradingDate}</span>
                    <span>{t.refLabel}: {formatPrice(dailySummary.referencePrice)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-zinc-400">{t.calculatingDailyBias}</div>
              )}

              {analysis && (
                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono tabular-nums pt-1">
                  <div className="px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-900/70 flex justify-between">
                    <span className="text-zinc-400">{selectedTimeframe}</span>
                    <span className="font-bold font-sans">{translateBiasLabel(analysis.bias)}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-900/70 flex justify-between">
                    <span className="text-zinc-400">RSI</span>
                    <span className="font-bold">{analysis.indicators.rsi ?? t.notAvailableShort}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-900/70 flex justify-between">
                    <span className="text-emerald-600 dark:text-emerald-400">S1</span>
                    <span>{formatPrice(analysis.levels.supports[0])}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-zinc-50 dark:bg-zinc-900/70 flex justify-between">
                    <span className="text-rose-600 dark:text-rose-400">R1</span>
                    <span>{formatPrice(analysis.levels.resistances[0])}</span>
                  </div>
                </div>
              )}

              {onOpenDailyAnalysis && (
                <button
                  type="button"
                  onClick={() => onOpenDailyAnalysis(selectedSymbol)}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-[11px] font-semibold flex items-center justify-center gap-1 hover:opacity-90 transition-opacity"
                >
                  <span>{t.openFullDailyAnalysis}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 rtl:rotate-[-90deg]" />
                </button>
              )}
            </ProtectedContent>

            {/* Selected Instrument Specs & Provider Status */}
            <div className="p-2.5 space-y-1.5 text-[11px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {t.instrumentDataFeedTitle}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">{t.assetLabel}</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-end">
                    {spec.displayName}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">{t.contractLevLabel}</span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100" dir="ltr">
                    {spec.contractSize.toLocaleString()} | 1:{spec.leverage}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">{t.quoteSourceLabel}</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[155px]" dir="ltr">
                    {activeQuote?.source || t.statusUnavailable}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-zinc-400">{t.candleFeedLabel}</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[155px]" dir="ltr">
                    {marketMeta?.source || t.statusUnavailable} ({candles.length})
                  </span>
                </div>
                {activeLastSuccess && (
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-400">{t.lastUpdateLabel}</span>
                    <span className="font-mono text-zinc-600 dark:text-zinc-300" dir="ltr">
                      {new Date(activeLastSuccess).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* 3. BOTTOM WORKSPACE */}
      <section className="shrink-0 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121214] overflow-hidden">
        <div className="px-2.5 sm:px-3 py-1.5 border-b border-black/5 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 bg-zinc-50/70 dark:bg-[#101013]">
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'positions' as BottomTab, label: `${t.tabPositions} (${tradeEngine.openTrades.length})` },
              { id: 'pending' as BottomTab, label: `${t.tabPending} (0)` },
              { id: 'history' as BottomTab, label: `${t.tabHistory} (${tradeEngine.closedTrades.length})` },
              { id: 'smc' as BottomTab, label: t.tabSmcZones },
            ].map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => {
                  setBottomTab(tabItem.id);
                  setBlotterExpanded(true);
                }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  bottomTab === tabItem.id
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {user ? (
              <>
                <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                  <div>
                    <span className="text-zinc-400 font-sans me-1">{t.balance}:</span>
                    <strong className="text-zinc-950 dark:text-white" dir="ltr">
                      ${tradeEngine.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 font-sans me-1">{t.equity}:</span>
                    <strong className="text-zinc-950 dark:text-white" dir="ltr">
                      ${tradeEngine.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div>
                    <span className="text-zinc-400 font-sans me-1">{t.floatingLabel}:</span>
                    <strong
                      dir="ltr"
                      className={
                        tradeEngine.floatingPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                      }
                    >
                      {tradeEngine.floatingPnl >= 0 ? '+' : ''}${tradeEngine.floatingPnl.toFixed(2)}
                    </strong>
                  </div>
                  <div className="hidden sm:block">
                    <span className="text-zinc-400 font-sans me-1">{t.freeMargin}:</span>
                    <strong className="text-zinc-800 dark:text-zinc-200" dir="ltr">
                      ${tradeEngine.freeMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOrderModalOpen(true)}
                  className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.newOrderBtn}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-2.5 py-1 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
              >
                <Lock className="w-3 h-3" />
                <span>{t.signInPaperTerminal}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setBlotterExpanded(!blotterExpanded)}
              title={blotterExpanded ? t.collapseBlotter : t.expandBlotter}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-zinc-500"
            >
              {blotterExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {blotterExpanded && (
          <div className="h-[155px] overflow-y-auto px-3 py-2">
            {bottomTab === 'positions' && (
              !user ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500 text-center">
                  {t.signInPositionsPrompt}
                </div>
              ) : tradeEngine.openTrades.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  {t.noOpenTrades}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/10 text-zinc-400 uppercase text-[10px]">
                        <th className="py-1.5 px-2 text-start font-sans">{t.colSymbol}</th>
                        <th className="py-1.5 px-2 text-start font-sans">{t.side}</th>
                        <th className="py-1.5 px-2 text-end font-sans">{t.colLots}</th>
                        <th className="py-1.5 px-2 text-end font-sans">{t.colEntry}</th>
                        <th className="py-1.5 px-2 text-end font-sans">{t.colLiveQuote}</th>
                        <th className="py-1.5 px-2 text-end">S/L</th>
                        <th className="py-1.5 px-2 text-end">T/P</th>
                        <th className="py-1.5 px-2 text-end font-sans">{t.colNetPnlUsd}</th>
                        <th className="py-1.5 px-2 text-center font-sans">{t.colAction}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {tradeEngine.openTrades.map((tr) => {
                        const pnl = tr.floatingPnl ?? 0;
                        return (
                          <tr key={tr.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                            <td className="py-1.5 px-2 font-bold font-sans">{tr.symbol}</td>
                            <td className="py-1.5 px-2 font-sans">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  tr.side === 'buy'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                {tr.side === 'buy' ? t.buyShort : t.sellShort}
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-end">{tr.lot}</td>
                            <td className="py-1.5 px-2 text-end">{tr.entry}</td>
                            <td className="py-1.5 px-2 text-end font-bold">
                              {tr.hasVerifiedQuote ? tr.currentPrice : '---'}
                            </td>
                            <td className="py-1.5 px-2 text-end text-rose-500">{tr.sl}</td>
                            <td className="py-1.5 px-2 text-end text-emerald-500">{tr.tp}</td>
                            <td
                              dir="ltr"
                              className={`py-1.5 px-2 text-end font-bold ${
                                pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 text-center font-sans">
                              <button
                                type="button"
                                disabled={closingId === tr.id}
                                onClick={() => handleClosePosition(tr.id)}
                                className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 hover:bg-rose-600 hover:text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
                              >
                                {closingId === tr.id ? '...' : t.manualClose}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {bottomTab === 'pending' && (
              <div className="h-full flex flex-col items-center justify-center text-xs text-zinc-500 space-y-1 text-center">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">{t.noPendingTitle}</p>
                <p>{t.noPendingDesc}</p>
              </div>
            )}

            {bottomTab === 'history' && (
              !user ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  {t.signInHistoryPrompt}
                </div>
              ) : tradeEngine.closedTrades.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  {t.noClosedTrades}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/10 text-zinc-400 uppercase text-[10px]">
                        <th className="py-1.5 px-2 text-start font-sans">{t.colSymbol}</th>
                        <th className="py-1.5 px-2 text-start font-sans">{t.side}</th>
                        <th className="py-1.5 px-2 text-end font-sans">{t.colLots}</th>
                        <th className="py-1.5 px-2 text-end font-sans">{t.colEntry}</th>
                        <th className="py-1.5 px-2 text-end font-sans">{t.colExit}</th>
                        <th className="py-1.5 px-2 text-center font-sans">{t.colTrigger}</th>
                        <th className="py-1.5 px-2 text-end font-sans">{t.colNetPnlUsd}</th>
                        <th className="py-1.5 px-2 text-end font-sans">{t.closedAt}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {tradeEngine.closedTrades.slice(0, 15).map((tr) => {
                        const pnl = tr.pnl ?? 0;
                        return (
                          <tr key={tr.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                            <td className="py-1.5 px-2 font-bold font-sans">{tr.symbol}</td>
                            <td className="py-1.5 px-2 uppercase font-sans">
                              {tr.side === 'buy' ? t.buyShort : t.sellShort}
                            </td>
                            <td className="py-1.5 px-2 text-end">{tr.lot}</td>
                            <td className="py-1.5 px-2 text-end">{tr.entry}</td>
                            <td className="py-1.5 px-2 text-end">{tr.exit_price ?? '---'}</td>
                            <td className="py-1.5 px-2 text-center uppercase font-sans">{tr.close_reason ?? 'manual'}</td>
                            <td
                              dir="ltr"
                              className={`py-1.5 px-2 text-end font-bold ${
                                pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                              }`}
                            >
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2 text-end text-[11px] text-zinc-400">
                              {tr.closed_at ? new Date(tr.closed_at).toLocaleString() : '---'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {bottomTab === 'smc' && (
              !analysis || !analysis.smc.sufficient ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  {t.insufficientSmcBars}
                </div>
              ) : (
                <ProtectedContent lang={lang} className="space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 font-bold font-sans">
                        {translateBiasLabel(analysis.trendStructure.trend)}
                      </span>
                      <span className="text-zinc-500" dir="ltr">
                        EMA20: {formatPrice(analysis.indicators.ema20)} | EMA50: {formatPrice(analysis.indicators.ema50)}
                      </span>
                      <span className="text-zinc-500" dir="ltr">
                        RSI: {analysis.indicators.rsi ?? 'N/A'} | ADX: {analysis.indicators.adx ?? 'N/A'} | ATR: {formatPrice(analysis.indicators.atr)}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400" dir="ltr">
                      P/D: {analysis.smc.premiumDiscount?.currentZone || 'N/A'} ({analysis.smc.premiumDiscount?.positionPct ?? 0}%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 font-mono tabular-nums text-[11px]">
                    <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans block">{t.support1Label}</span>
                      <strong>{formatPrice(analysis.levels.supports[0])}</strong>
                    </div>
                    <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70">
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-sans block">{t.resistance1Label}</span>
                      <strong>{formatPrice(analysis.levels.resistances[0])}</strong>
                    </div>
                    <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70">
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 font-sans block">{t.latestBosChochLabel}</span>
                      <strong dir="ltr">
                        {analysis.smc.structureEvents[analysis.smc.structureEvents.length - 1]
                          ? `${analysis.smc.structureEvents[analysis.smc.structureEvents.length - 1].type} @ ${formatPrice(
                              analysis.smc.structureEvents[analysis.smc.structureEvents.length - 1].brokenLevel
                            )}`
                          : t.noneLabel}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70">
                      <span className="text-[10px] text-zinc-400 font-sans block">
                        {t.orderBlocksLabel} ({selectedTimeframe})
                      </span>
                      <strong>
                        {analysis.smc.orderBlocks.length} {t.activeCountSuffix}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70">
                      <span className="text-[10px] text-zinc-400 font-sans block">
                        {t.fvgsLabel} ({selectedTimeframe})
                      </span>
                      <strong>
                        {analysis.smc.fairValueGaps.length} {t.activeCountSuffix}
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70">
                      <span className="text-[10px] text-zinc-400 font-sans block">{t.liquidityPoolsLabel}</span>
                      <strong>
                        {analysis.smc.liquidityPools.length} {t.mappedCountSuffix}
                      </strong>
                    </div>
                  </div>
                </ProtectedContent>
              )
            )}
          </div>
        )}
      </section>

      {/* QUICK ORDER MODAL */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-2xl p-6 shadow-2xl border border-black/10 dark:border-white/10 space-y-4">
            <button
              onClick={() => setOrderModalOpen(false)}
              aria-label={t.closeBtn}
              className="absolute top-4 end-4 p-2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <h3 className="text-lg font-bold">
                {t.quickOrderTitle} — {selectedSymbol}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {t.executesAtServerQuote} ({activeQuote?.source || t.statusUnavailable})
              </p>
            </div>

            {orderError && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
                {orderError}
              </div>
            )}

            <form onSubmit={handleSubmitQuickOrder} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setOrderSide('buy')}
                  className={`py-2 rounded-lg text-xs font-bold uppercase ${
                    orderSide === 'buy' ? 'bg-emerald-600 text-white' : 'text-zinc-500'
                  }`}
                >
                  {t.buyShort}
                </button>
                <button
                  type="button"
                  onClick={() => setOrderSide('sell')}
                  className={`py-2 rounded-lg text-xs font-bold uppercase ${
                    orderSide === 'sell' ? 'bg-rose-600 text-white' : 'text-zinc-500'
                  }`}
                >
                  {t.sellShort}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 flex justify-between items-center text-xs font-mono">
                <span className="text-zinc-400 font-sans">{t.liveExecPriceLabel}</span>
                <span className="font-bold text-sm" dir="ltr">
                  {currentPrice ? formatPrice(currentPrice) : t.statusUnavailable}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-rose-500 mb-1">{t.stopLoss}</label>
                  <input
                    type="number"
                    step="any"
                    required
                    dir="ltr"
                    value={stopLoss || ''}
                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-xl border border-rose-500/30 bg-rose-500/5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-emerald-500 mb-1">{t.takeProfit}</label>
                  <input
                    type="number"
                    step="any"
                    required
                    dir="ltr"
                    value={takeProfit || ''}
                    onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-between text-xs">
                <div>
                  <span className="text-zinc-400 block text-[10px]">{t.riskPctShort}</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.1"
                    max="10"
                    dir="ltr"
                    value={riskPct}
                    onChange={(e) => setRiskPct(parseFloat(e.target.value) || 1)}
                    className="w-16 p-1 rounded border border-black/10 dark:border-white/15 bg-white dark:bg-black font-mono font-bold mt-0.5"
                  />
                </div>
                <div className="text-end font-mono" dir="ltr">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                    {computedLot} {t.lotsUnit}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {t.marginShort}: ${estMargin.toFixed(2)}
                  </span>
                </div>
              </div>

              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder={t.orderNotePlaceholder}
                className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
              />

              <button
                type="submit"
                disabled={submittingOrder || !currentPrice}
                className="w-full py-3 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs disabled:opacity-50"
              >
                {submittingOrder ? t.executingLabel : t.openTradeBtn}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const MarketsPage = React.memo(MarketsPageInner);
