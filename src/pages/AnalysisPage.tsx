import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Cpu,
  ExternalLink,
  ArrowUpRight,
  ShieldAlert,
  History,
  Server,
  Landmark,
} from 'lucide-react';
import { Language, translations, translateApiError } from '../lib/i18n';
import { ProtectedContent } from '../components/ProtectedContent';
import {
  FundamentalAnalysisView,
  FundamentalOverviewResponse,
} from '../components/FundamentalAnalysisView';
import {
  ALL_SUPPORTED_SYMBOLS,
  INSTRUMENT_SPECS,
  SupportedSymbol,
} from '../lib/tradingMath';
import type {
  DailyAnalysisSnapshot,
  IntradayUpdateRecord,
} from '../lib/biasEngine';

interface HistoricalOutcomeEvaluation {
  evaluated: boolean;
  snapshotDate: string;
  snapshotPrice: number;
  subsequentDaysTracked: number;
  latestObservedClose: number | null;
  periodHigh: number | null;
  periodLow: number | null;
  pctChangeSinceSnapshot: number | null;
  invalidationTouched: boolean;
  outcomeNote: string;
}

interface DailyAnalysisResponse {
  snapshot: DailyAnalysisSnapshot;
  intradayUpdates: IntradayUpdateRecord[];
  availableDates: string[];
  historicalOutcome: HistoricalOutcomeEvaluation;
  isPresentDay: boolean;
}

interface SchedulerStatusResponse {
  marketDateNY: string;
  coverage: {
    symbol: SupportedSymbol;
    hasTodaySnapshot: boolean;
    dailyBias: string | null;
    intradayCount: number;
  }[];
  recentJobs: {
    id: string;
    jobType: string;
    symbol: SupportedSymbol;
    tradingDate: string;
    status: string;
    attempts: number;
    error?: string;
    executedAt: string;
  }[];
}

interface AnalysisPageProps {
  lang: Language;
  selectedSymbol?: SupportedSymbol;
  onSelectSymbol?: (sym: SupportedSymbol) => void;
  onOpenTerminal?: (sym: SupportedSymbol) => void;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  lang,
  selectedSymbol: externalSymbol,
  onSelectSymbol,
  onOpenTerminal,
}) => {
  const t = translations[lang];

  const [internalSymbol, setInternalSymbol] = useState<SupportedSymbol>(externalSymbol || 'XAUUSD');
  const symbol = externalSymbol || internalSymbol;
  const setSymbol = (sym: SupportedSymbol) => {
    setInternalSymbol(sym);
    onSelectSymbol?.(sym);
    setSelectedDate(undefined);
  };

  const [analysisMode, setAnalysisMode] = useState<'technical' | 'fundamental'>('technical');
  const [fundamentalOverview, setFundamentalOverview] = useState<FundamentalOverviewResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [data, setData] = useState<DailyAnalysisResponse | null>(null);
  const [scheduler, setScheduler] = useState<SchedulerStatusResponse | null>(null);
  const [showSchedulerPanel, setShowSchedulerPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshingIntraday, setRefreshingIntraday] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = INSTRUMENT_SPECS[symbol];

  const formatNum = (val?: number | null) => {
    if (val === undefined || val === null || !Number.isFinite(val)) return t.notAvailableShort;
    if (spec.decimals >= 3) return val.toFixed(spec.decimals);
    return val.toLocaleString(undefined, {
      minimumFractionDigits: spec.decimals,
      maximumFractionDigits: spec.decimals,
    });
  };

  const translateBiasLabel = (bias: string) => {
    if (bias === 'INSUFFICIENT DATA' || bias === 'Insufficient Data') {
      return t.insufficientDataBadge;
    }
    if (bias === 'Strong Bullish' || bias === 'Bullish') return t.bullish;
    if (bias === 'Strong Bearish' || bias === 'Bearish') return t.bearish;
    return t.neutral;
  };

  const translateValidityLabel = (status?: string) => {
    if (status === 'VALID') return t.validBadge;
    if (status === 'WEAKENING') return t.weakeningBadge;
    if (status === 'INVALIDATED') return t.invalidatedBadge;
    return status || '';
  };

  const fetchDailyReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateQuery = selectedDate ? `&date=${encodeURIComponent(selectedDate)}` : '';
      const res = await fetch(`/api/analysis/daily?symbol=${encodeURIComponent(symbol)}${dateQuery}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Daily analysis unavailable (HTTP ${res.status})`);
      }
      setData(json);
    } catch (err: any) {
      setError(translateApiError(err?.message, lang));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, selectedDate, lang]);

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis/scheduler-status');
      if (res.ok) {
        setScheduler(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchFundamentalOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/fundamental/overview');
      if (res.ok) {
        setFundamentalOverview(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDailyReport();
    fetchSchedulerStatus();
    fetchFundamentalOverview();
  }, [fetchDailyReport, fetchSchedulerStatus, fetchFundamentalOverview]);

  const handleIntradayEvaluate = async () => {
    setRefreshingIntraday(true);
    try {
      const res = await fetch('/api/analysis/intraday-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        fetchSchedulerStatus();
      }
    } finally {
      setRefreshingIntraday(false);
    }
  };

  const renderBiasBadge = (bias: string) => {
    if (bias === 'INSUFFICIENT DATA') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          {t.insufficientDataBadge}
        </span>
      );
    }
    if (bias === 'Strong Bullish' || bias === 'Bullish') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5" />
          {translateBiasLabel(bias)}
        </span>
      );
    }
    if (bias === 'Strong Bearish' || bias === 'Bearish') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400">
          <TrendingDown className="w-3.5 h-3.5" />
          {translateBiasLabel(bias)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
        <Minus className="w-3.5 h-3.5" />
        {translateBiasLabel(bias)}
      </span>
    );
  };

  const renderValidityBadge = (status?: string) => {
    if (status === 'VALID') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {translateValidityLabel(status)}
        </span>
      );
    }
    if (status === 'WEAKENING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          {translateValidityLabel(status)}
        </span>
      );
    }
    if (status === 'INVALIDATED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400">
          <XCircle className="w-3.5 h-3.5" />
          {translateValidityLabel(status)}
        </span>
      );
    }
    return null;
  };

  const snap = data?.snapshot;
  const latestIntraday = data?.intradayUpdates?.[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              {t.analysisTitle}
            </h1>
            <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300" dir="ltr">
              {snap?.modelVersion || 'YOUNEEL-QUANT-v2.0'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {t.analysisSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data && data.availableDates.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#121214] text-xs">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <select
                aria-label={t.archivedDateAria}
                value={selectedDate || snap?.tradingDate || data.availableDates[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-mono font-semibold focus:outline-hidden"
              >
                {data.availableDates.map((d) => (
                  <option key={d} value={d} className="bg-white dark:bg-zinc-900">
                    {d} {d === scheduler?.marketDateNY ? t.todayNyTag : t.archivedTag}
                  </option>
                ))}
              </select>
            </div>
          )}

          {data?.isPresentDay && (
            <button
              type="button"
              onClick={handleIntradayEvaluate}
              disabled={refreshingIntraday || loading}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingIntraday ? 'animate-spin' : ''}`} />
              <span>{t.checkIntradayBtn}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSchedulerPanel(!showSchedulerPanel)}
            className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#121214] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Server className="w-3.5 h-3.5 text-zinc-400" />
            <span>{t.schedulerBtn}</span>
          </button>

          {onOpenTerminal && (
            <button
              type="button"
              onClick={() => onOpenTerminal(symbol)}
              className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#121214] text-xs font-semibold flex items-center gap-1 whitespace-nowrap hover:bg-black/5 dark:hover:bg-white/5"
            >
              <span>{t.chartTerminalBtn}</span>
              <ArrowUpRight className="w-3.5 h-3.5 rtl:rotate-[-90deg]" />
            </button>
          )}
        </div>
      </div>

      {/* Mode Switcher: Technical Daily Bias vs Fundamental Macro (CPI/FOMC/PPI/NFP) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAnalysisMode('technical')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            analysisMode === 'technical'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
              : 'bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/15'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{t.modeTechnicalBias}</span>
        </button>
        <button
          type="button"
          onClick={() => setAnalysisMode('fundamental')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            analysisMode === 'fundamental'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
              : 'bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/15'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>{t.modeFundamentalMacro}</span>
        </button>
      </div>

      {/* 8-Instrument Selector Strip */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10">
        {ALL_SUPPORTED_SYMBOLS.map((sym) => {
          const active = sym === symbol;
          const cov = scheduler?.coverage.find((c) => c.symbol === sym);
          return (
            <button
              key={sym}
              type="button"
              onClick={() => setSymbol(sym)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <span dir="ltr">{sym}</span>
              {cov?.dailyBias && (
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                    active
                      ? 'bg-white/20 dark:bg-black/15'
                      : cov.dailyBias.includes('Bullish')
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : cov.dailyBias.includes('Bearish')
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-zinc-400'
                  }`}
                >
                  {translateBiasLabel(cov.dailyBias)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {analysisMode === 'fundamental' ? (
        <FundamentalAnalysisView
          lang={lang}
          focusSymbol={symbol}
          onInspectTechnicalSymbol={(sym) => {
            setSymbol(sym);
            setAnalysisMode('technical');
          }}
        />
      ) : (
        <>

      {/* Persistent Scheduler Coverage & Job History Drawer */}
      {showSchedulerPanel && scheduler && (
        <div className="rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-bold uppercase tracking-wider text-zinc-500 text-[11px]">
              {t.schedulerAuditTitle} {scheduler.marketDateNY}
            </h2>
            <span className="font-mono text-[11px] text-zinc-400">
              {scheduler.coverage.filter((c) => c.hasTodaySnapshot).length}/{ALL_SUPPORTED_SYMBOLS.length} {t.archivedTodaySuffix}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 font-mono">
            {scheduler.coverage.map((c) => (
              <div
                key={c.symbol}
                className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-black/5 dark:border-white/5"
              >
                <div className="font-bold" dir="ltr">{c.symbol}</div>
                <div className="text-[10px] text-zinc-400 font-sans">
                  {c.hasTodaySnapshot && c.dailyBias ? translateBiasLabel(c.dailyBias) : t.pendingStatus}
                </div>
                <div className="text-[10px] text-zinc-500 font-sans">
                  {c.intradayCount} {t.checksSuffix}
                </div>
              </div>
            ))}
          </div>
          {scheduler.recentJobs.length > 0 && (
            <div className="max-h-36 overflow-y-auto border-t border-black/5 dark:border-white/10 pt-2">
              <table className="w-full text-[11px] font-mono tabular-nums">
                <thead>
                  <tr className="text-zinc-400 text-start font-sans">
                    <th className="py-1 text-start">{t.colTime}</th>
                    <th className="py-1 text-start">{t.colJob}</th>
                    <th className="py-1 text-start">{t.colSymbol}</th>
                    <th className="py-1 text-start">{t.colDate}</th>
                    <th className="py-1 text-start">{t.colStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {scheduler.recentJobs.slice(0, 10).map((j) => (
                    <tr key={j.id}>
                      <td className="py-1 text-zinc-400">{new Date(j.executedAt).toLocaleTimeString()}</td>
                      <td className="py-1">{j.jobType}</td>
                      <td className="py-1 font-bold">{j.symbol}</td>
                      <td className="py-1">{j.tradingDate}</td>
                      <td className="py-1">
                        <span className={j.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}>
                          {j.status} {j.error ? `(${j.error})` : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Loading / Error State */}
      {loading && (
        <div className="py-20 text-center rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 text-xs text-zinc-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-60" />
          {t.computingAnalysisMsg} ({symbol})
        </div>
      )}

      {!loading && error && (
        <div className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDailyReport}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* Fundamental vs Technical Cross-Check Banner for active symbol */}
      {!loading && snap && fundamentalOverview && (
        (() => {
          const latestMacro =
            (['CPI', 'FOMC', 'PPI', 'NFP'] as const)
              .map((cat) => fundamentalOverview.byCategory[cat]?.latestReleased)
              .filter(Boolean)
              .sort(
                (a: any, b: any) =>
                  new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
              )[0] || null;
          const symImpact = latestMacro?.afterRelease?.assetImpacts?.[symbol];
          if (!latestMacro || !symImpact) return null;
          const alignStatus = symImpact.technicalAlignment?.status || 'INSUFFICIENT_EVIDENCE';
          const bannerClasses =
            alignStatus === 'ALIGNED'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300'
              : alignStatus === 'CONFLICT'
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300'
              : 'bg-zinc-100 dark:bg-zinc-900/70 border-black/10 dark:border-white/10 text-zinc-700 dark:text-zinc-300';

          return (
            <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${bannerClasses}`}>
              <div className="space-y-1">
                <div className="font-bold flex flex-wrap items-center gap-2">
                  <Landmark className="w-4 h-4 shrink-0" />
                  <span>{t.fundamentalAlignBannerTitle}</span>
                  <span className="px-2 py-0.5 rounded bg-black/10 dark:bg-white/15 font-mono text-[10px]" dir="ltr">
                    {latestMacro.eventType}: {symImpact.bias} ({alignStatus})
                  </span>
                </div>
                <p className="opacity-90 leading-relaxed" dir="ltr">
                  {symImpact.technicalAlignment?.note || symImpact.reasoning}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAnalysisMode('fundamental')}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold text-xs whitespace-nowrap self-start sm:self-center"
              >
                {t.fundamentalViewBtn}
              </button>
            </div>
          );
        })()
      )}

      {/* PROPRIETARY DAILY ANALYSIS REPORT (ProtectedContent) */}
      {!loading && snap && (
        <ProtectedContent lang={lang} showBadge={true} className="space-y-5">
          {/* 1. BIAS & DETERMINISTIC SCORE SUMMARY */}
          <section className="rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono">
                  <span className="font-bold text-zinc-900 dark:text-white font-sans text-sm">
                    {snap.displayName} ({snap.marketType})
                  </span>
                  <span>•</span>
                  <span>
                    {t.nyDatePrefix} {snap.tradingDate}
                  </span>
                  <span>•</span>
                  <span>
                    {t.snapshotTimePrefix} {new Date(snap.analysisTimestamp).toLocaleTimeString()}
                  </span>
                  <span>•</span>
                  <span
                    className={
                      snap.dataQuality.status === 'COMPLETE'
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-amber-600 dark:text-amber-400 font-bold'
                    }
                  >
                    {t.dataQualityPrefix} {snap.dataQuality.status} ({snap.dataQuality.availableWeightPct}%)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {renderBiasBadge(snap.dailyBias)}
                  {latestIntraday && renderValidityBadge(latestIntraday.validityStatus)}
                  <span className="text-xs font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
                    {t.snapshotPricePrefix}{' '}
                    <strong className="text-zinc-950 dark:text-white" dir="ltr">
                      {formatNum(snap.referencePrice)}
                    </strong>
                  </span>
                  {latestIntraday && (
                    <span className="text-xs font-mono tabular-nums text-zinc-500">
                      {t.livePrefix}{' '}
                      <strong className="text-zinc-900 dark:text-zinc-100" dir="ltr">
                        {formatNum(latestIntraday.currentPrice)}
                      </strong>{' '}
                      <span dir="ltr">
                        ({latestIntraday.priceDeltaPct >= 0 ? '+' : ''}
                        {latestIntraday.priceDeltaPct}%)
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Quantitative Scores Strip */}
              <div className="grid grid-cols-3 gap-3 font-mono tabular-nums shrink-0">
                <div className="px-3.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="block text-[10px] font-sans font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
                    {t.bullishScoreLabel}
                  </span>
                  <strong className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
                    {snap.bullishScore}
                  </strong>
                </div>
                <div className="px-3.5 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
                  <span className="block text-[10px] font-sans font-semibold text-rose-700 dark:text-rose-400 uppercase">
                    {t.bearishScoreLabel}
                  </span>
                  <strong className="text-lg font-extrabold text-rose-700 dark:text-rose-300">
                    {snap.bearishScore}
                  </strong>
                </div>
                <div className="px-3.5 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-center">
                  <span
                    className="block text-[10px] font-sans font-semibold text-zinc-500 uppercase"
                    title={t.alignmentTooltip}
                  >
                    {t.alignmentScoreLabel}
                  </span>
                  <strong className="text-lg font-extrabold text-zinc-950 dark:text-white">
                    {snap.directionalAlignmentScore}%
                  </strong>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed" dir="ltr">
              {snap.summary}
            </p>

            {/* Timeframe Conflicts Banner */}
            {snap.timeframeConflicts.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.conflictsBannerTitle}</span>
                </div>
                <ul className="list-disc ps-5 space-y-0.5 text-[11px]" dir="ltr">
                  {snap.timeframeConflicts.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weighted Scoring Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/10 text-zinc-400 uppercase text-[10px]">
                    <th className="py-2 px-2 text-start font-sans">{t.colScoringComponent}</th>
                    <th className="py-2 px-2 text-end font-sans">{t.colWeight}</th>
                    <th className="py-2 px-2 text-end font-sans">{t.colRawScore}</th>
                    <th className="py-2 px-2 text-end font-sans">{t.colContribution}</th>
                    <th className="py-2 px-2 text-start font-sans">{t.colEvidence}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {snap.scoringBreakdown.map((row) => (
                    <tr key={row.component}>
                      <td className="py-2 px-2 font-sans font-semibold text-zinc-900 dark:text-zinc-100">
                        {row.component}
                      </td>
                      <td className="py-2 px-2 text-end text-zinc-500">{row.weightPct}%</td>
                      <td
                        dir="ltr"
                        className={`py-2 px-2 text-end font-bold ${
                          !row.available
                            ? 'text-zinc-400'
                            : row.rawScore > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : row.rawScore < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-zinc-500'
                        }`}
                      >
                        {row.available ? `${row.rawScore > 0 ? '+' : ''}${row.rawScore}` : t.notAvailableShort}
                      </td>
                      <td className="py-2 px-2 text-end" dir="ltr">
                        {row.available ? `${row.weightedContribution > 0 ? '+' : ''}${row.weightedContribution}` : '---'}
                      </td>
                      <td className="py-2 px-2 font-sans text-[11px] text-zinc-500 dark:text-zinc-400" dir="ltr">
                        {row.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Historical Archive Outcome Comparison */}
          {!data.isPresentDay && (
            <section className="rounded-xl bg-sky-500/10 border border-sky-500/20 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-sky-800 dark:text-sky-300">
                <History className="w-4 h-4" />
                <span>
                  {t.historicalEvalTitle} ({snap.tradingDate})
                </span>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300" dir="ltr">
                {data.historicalOutcome.outcomeNote}
              </p>
            </section>
          )}

          {/* Intraday Validity Timeline */}
          {data.intradayUpdates.length > 0 && (
            <section className="rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {t.intradayTimelineTitle} ({snap.tradingDate})
                  </span>
                </h2>
                <span className="text-[11px] text-zinc-400">{t.immutableSnapshotNote}</span>
              </div>
              <div className="divide-y divide-black/5 dark:divide-white/5 max-h-48 overflow-y-auto text-xs">
                {data.intradayUpdates.map((u) => (
                  <div key={u.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {renderValidityBadge(u.validityStatus)}
                      <span className="font-mono text-[11px] text-zinc-400" dir="ltr">
                        {new Date(u.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="font-mono font-bold tabular-nums" dir="ltr">
                        {formatNum(u.currentPrice)} ({u.priceDeltaPct >= 0 ? '+' : ''}
                        {u.priceDeltaPct}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400" dir="ltr">
                      {u.reason}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. MULTI-TIMEFRAME ALIGNMENT MATRIX */}
          <section className="rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-4 sm:p-5 space-y-3">
            <h2 className="text-sm font-bold tracking-tight text-zinc-950 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-500" />
              <span>{t.mtfMatrixTitle}</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/10 text-zinc-400 uppercase text-[10px]">
                    <th className="py-2 px-2 text-start font-sans">{t.colTf}</th>
                    <th className="py-2 px-2 text-end font-sans">{t.colBars}</th>
                    <th className="py-2 px-2 text-start font-sans">{t.colRegime}</th>
                    <th className="py-2 px-2 text-start font-sans">{t.colLean}</th>
                    <th className="py-2 px-2 text-end font-sans">{t.colScore}</th>
                    <th className="py-2 px-2 text-start font-sans">{t.colLatestEvent}</th>
                    <th className="py-2 px-2 text-end">RSI(14)</th>
                    <th className="py-2 px-2 text-end">ADX(14)</th>
                    <th className="py-2 px-2 text-end">ATR(14)</th>
                    <th className="py-2 px-2 text-start font-sans">{t.colEmaStack}</th>
                    <th className="py-2 px-2 text-start font-sans">{t.colDealingZone}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {snap.mtfTable.map((row) => (
                    <tr key={row.timeframe} className="hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="py-2 px-2 font-bold">{row.timeframe}</td>
                      <td className="py-2 px-2 text-end text-zinc-500">{row.barCount}</td>
                      <td className="py-2 px-2 font-sans text-zinc-700 dark:text-zinc-300" dir="ltr">
                        {row.regime}
                      </td>
                      <td className="py-2 px-2 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.directionalLean === 'Bullish'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : row.directionalLean === 'Bearish'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                              : row.directionalLean === 'Insufficient Data'
                              ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {translateBiasLabel(row.directionalLean)}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-end font-bold" dir="ltr">
                        {row.sufficient ? `${row.structureScore > 0 ? '+' : ''}${row.structureScore}` : t.notAvailableShort}
                      </td>
                      <td className="py-2 px-2 font-sans text-[11px] text-zinc-600 dark:text-zinc-300" dir="ltr">
                        {row.latestEvent}
                      </td>
                      <td className="py-2 px-2 text-end">{row.rsi14 ?? t.notAvailableShort}</td>
                      <td className="py-2 px-2 text-end">{row.adx14 ?? t.notAvailableShort}</td>
                      <td className="py-2 px-2 text-end">
                        {row.atr14 !== null ? formatNum(row.atr14) : t.notAvailableShort}
                      </td>
                      <td className="py-2 px-2 font-sans text-[11px] text-zinc-500" dir="ltr">
                        {row.emaAlignment}
                      </td>
                      <td className="py-2 px-2 font-sans text-[11px] text-zinc-500" dir="ltr">
                        {row.premiumDiscountZone}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. LIQUIDITY POOLS, ORDER BLOCKS, FVGS & S/R KEY LEVELS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-4 sm:p-5 space-y-3">
              <h2 className="text-sm font-bold tracking-tight text-zinc-950 dark:text-white">
                {t.liquidityAndSrTitle}
              </h2>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-rose-500 block">
                    {t.bslResistanceTitle}
                  </span>
                  {snap.liquidity.buySide.slice(0, 3).map((b, i) => (
                    <div key={i} className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70 flex justify-between font-mono tabular-nums">
                      <span className="text-[11px] text-zinc-500" dir="ltr">{b.kind} ({b.timeframe})</span>
                      <strong className="text-rose-600 dark:text-rose-400" dir="ltr">{formatNum(b.price)}</strong>
                    </div>
                  ))}
                  {snap.importantZones.resistances.slice(0, 2).map((r, i) => (
                    <div key={`r-${i}`} className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70 flex justify-between font-mono tabular-nums">
                      <span className="text-[11px] text-zinc-500" dir="ltr">{r.label} ({r.timeframe})</span>
                      <strong dir="ltr">{formatNum(r.price)}</strong>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-emerald-500 block">
                    {t.sslSupportTitle}
                  </span>
                  {snap.liquidity.sellSide.slice(0, 3).map((s, i) => (
                    <div key={i} className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70 flex justify-between font-mono tabular-nums">
                      <span className="text-[11px] text-zinc-500" dir="ltr">{s.kind} ({s.timeframe})</span>
                      <strong className="text-emerald-600 dark:text-emerald-400" dir="ltr">{formatNum(s.price)}</strong>
                    </div>
                  ))}
                  {snap.importantZones.supports.slice(0, 2).map((s, i) => (
                    <div key={`s-${i}`} className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70 flex justify-between font-mono tabular-nums">
                      <span className="text-[11px] text-zinc-500" dir="ltr">{s.label} ({s.timeframe})</span>
                      <strong dir="ltr">{formatNum(s.price)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {snap.liquidity.recentSweeps.length > 0 && (
                <div className="pt-2 border-t border-black/5 dark:border-white/10 space-y-1 text-[11px]">
                  <span className="font-bold uppercase text-zinc-400 text-[10px] block">
                    {t.detectedSweepsTitle}
                  </span>
                  {snap.liquidity.recentSweeps.slice(0, 3).map((sw, idx) => (
                    <div key={idx} className="flex items-center justify-between text-zinc-600 dark:text-zinc-300 font-mono">
                      <span dir="ltr">
                        {sw.side.replace('_', ' ')} ({sw.timeframe}) @ {formatNum(sw.sweptLevel)}
                      </span>
                      <span className="text-zinc-400">{new Date(sw.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold tracking-tight text-zinc-950 dark:text-white">
                  {t.obFvgRangeTitle}
                </h2>
                {snap.importantZones.premiumDiscount && (
                  <span className="text-[11px] font-mono text-zinc-500" dir="ltr">
                    Eq: {formatNum(snap.importantZones.premiumDiscount.equilibrium)} ({snap.importantZones.premiumDiscount.currentZone})
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                  {t.activeOrderBlocksLabel} ({snap.importantZones.orderBlocks.length})
                </span>
                {snap.importantZones.orderBlocks.length === 0 ? (
                  <p className="text-[11px] text-zinc-400">{t.noOrderBlocksMsg}</p>
                ) : (
                  <div className="space-y-1 font-mono tabular-nums" dir="ltr">
                    {snap.importantZones.orderBlocks.map((ob, i) => (
                      <div key={i} className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className={ob.direction === 'bullish' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                          {ob.direction.toUpperCase()} OB ({ob.timeframe})
                        </span>
                        <span>
                          [{formatNum(ob.low)} – {formatNum(ob.high)}]
                        </span>
                        <span className="text-zinc-400 text-[10px]">{ob.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                <span className="text-[10px] font-bold uppercase text-zinc-400 block pt-2">
                  {t.unfilledFvgLabel} ({snap.importantZones.fairValueGaps.length})
                </span>
                {snap.importantZones.fairValueGaps.length === 0 ? (
                  <p className="text-[11px] text-zinc-400">{t.noFvgMsg}</p>
                ) : (
                  <div className="space-y-1 font-mono tabular-nums" dir="ltr">
                    {snap.importantZones.fairValueGaps.map((fvg, i) => (
                      <div key={i} className="p-2 rounded bg-zinc-50 dark:bg-zinc-900/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className={fvg.direction === 'bullish' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                          {fvg.direction.toUpperCase()} FVG ({fvg.timeframe})
                        </span>
                        <span>
                          [{formatNum(fvg.low)} – {formatNum(fvg.high)}]
                        </span>
                        <span className="text-zinc-400 text-[10px]">{fvg.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* 4. SCENARIOS, INVALIDATION & MARKET CONDITIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-4 space-y-2 text-xs">
              <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>{t.bullishScenarioTitle}</span>
              </div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100" dir="ltr">
                {snap.bullishScenario.trigger}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed" dir="ltr">
                {snap.bullishScenario.rationale}
              </p>
              <div className="pt-1 font-mono tabular-nums text-[11px]">
                <span className="text-zinc-400 font-sans me-1.5">{t.targetsLabel}</span>
                <span dir="ltr">
                  {snap.bullishScenario.targets.map((tgt) => formatNum(tgt)).join(' -> ')}
                </span>
              </div>
            </section>

            <section className="rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-4 space-y-2 text-xs">
              <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" />
                <span>{t.bearishScenarioTitle}</span>
              </div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100" dir="ltr">
                {snap.bearishScenario.trigger}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed" dir="ltr">
                {snap.bearishScenario.rationale}
              </p>
              <div className="pt-1 font-mono tabular-nums text-[11px]">
                <span className="text-zinc-400 font-sans me-1.5">{t.targetsLabel}</span>
                <span dir="ltr">
                  {snap.bearishScenario.targets.map((tgt) => formatNum(tgt)).join(' -> ')}
                </span>
              </div>
            </section>

            <section className="rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-4 space-y-2 text-xs">
              <div className="font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                <span>{t.invalidationVolTitle}</span>
              </div>
              <p className="font-semibold text-rose-600 dark:text-rose-400" dir="ltr">
                {snap.invalidationConditions.rule}
              </p>
              <div className="space-y-1 text-[11px] text-zinc-500 pt-1 font-mono">
                <div>
                  {t.volatilityLabel} <span dir="ltr">{snap.marketConditions.volatilityState}</span>
                </div>
                <div>
                  {t.dailyAtrLabel}{' '}
                  <span dir="ltr">
                    {snap.marketConditions.atrDaily !== null ? formatNum(snap.marketConditions.atrDaily) : t.notAvailableShort} ({snap.marketConditions.atrDailyPct ?? t.notAvailableShort}%)
                  </span>
                </div>
                <div>
                  {t.volumeLabel} <span dir="ltr">{snap.marketConditions.volumeAssessment}</span>
                </div>
              </div>
            </section>
          </div>

          {/* 5. RELEVANT NEWS + QUANTITATIVE ANALYST INTERPRETATION */}
          <section className="rounded-xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
                <Cpu className="w-4 h-4 text-zinc-500" />
                <span>{t.quantInterpreterTitle}</span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                {snap.aiAnalyst.used
                  ? `${t.explainedByModelPrefix} (${snap.aiAnalyst.model})`
                  : snap.aiAnalyst.error || t.deterministicOnlyLabel}
              </span>
            </div>

            {snap.aiAnalyst.used ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                <div>
                  <span className="font-bold text-zinc-950 dark:text-white block mb-1">
                    {t.marketStructureOverview}
                  </span>
                  <p dir="ltr">{snap.aiAnalyst.structureExplanation}</p>
                </div>
                <div>
                  <span className="font-bold text-zinc-950 dark:text-white block mb-1">
                    {t.deterministicEvidenceLabel}
                  </span>
                  <p dir="ltr">{snap.aiAnalyst.evidenceSummary}</p>
                </div>
                <div>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">
                    {t.bullishPathLabel}
                  </span>
                  <p dir="ltr">{snap.aiAnalyst.bullishNarrative}</p>
                </div>
                <div>
                  <span className="font-bold text-rose-700 dark:text-rose-400 block mb-1">
                    {t.bearishPathLabel}
                  </span>
                  <p dir="ltr">{snap.aiAnalyst.bearishNarrative}</p>
                </div>
                <div>
                  <span className="font-bold text-zinc-950 dark:text-white block mb-1">
                    {t.conflictsInvalidationLabel}
                  </span>
                  <p dir="ltr">
                    {snap.aiAnalyst.conflictsNarrative} {snap.aiAnalyst.invalidationExplanation}
                  </p>
                </div>
                <div>
                  <span className="font-bold text-zinc-950 dark:text-white block mb-1">
                    {t.conclusionLabel}
                  </span>
                  <p dir="ltr">{snap.aiAnalyst.conclusion}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed" dir="ltr">
                {snap.summary}
              </p>
            )}

            {snap.marketConditions.relevantNews.length > 0 && (
              <div className="pt-3 border-t border-black/5 dark:border-white/10 space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                  {t.matchedNewsContextTitle}
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {snap.marketConditions.relevantNews.map((n, i) => (
                    <a
                      key={i}
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/70 hover:bg-black/5 dark:hover:bg-white/5 flex items-start justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-1" dir="ltr">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {n.source} • {new Date(n.publishedAt).toLocaleString()}
                        </span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-zinc-400 pt-2 border-t border-black/5 dark:border-white/10">
              {t.educationalDisclaimer} {t.alignmentNoteFooter}
            </p>
          </section>
        </ProtectedContent>
      )}
        </>
      )}
    </div>
  );
};
