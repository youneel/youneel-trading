import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Landmark,
  ExternalLink,
  Layers,
  ShieldAlert,
  GitCompare,
  Sparkles,
  FileText,
  ArrowUpRight,
} from 'lucide-react';
import { Language, translations, translateApiError } from '../lib/i18n';
import { ALL_SUPPORTED_SYMBOLS, SupportedSymbol } from '../lib/tradingMath';
import { ProtectedContent } from './ProtectedContent';

export type MacroEventType = 'CPI' | 'FOMC' | 'PPI' | 'NFP';

export interface SourceReference {
  label: string;
  institution: string;
  url: string;
  publishedAt?: string;
}

export interface AssetMacroImpact {
  symbol: SupportedSymbol;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNCERTAIN';
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  reasoning: string;
  transmissionMechanism: string;
  supportingEvidence: string[];
  invalidationConditions: string[];
  technicalAlignment: {
    status: 'ALIGNED' | 'CONFLICT' | 'INSUFFICIENT_EVIDENCE';
    technicalBias: string | null;
    referencePrice: number | null;
    note: string;
  };
  postReleaseReaction?: {
    available: boolean;
    referencePriceBefore: number | null;
    observedPriceAfter: number | null;
    pctMove: number | null;
    directionConfirmed: 'CONFIRMED' | 'CONTRADICTED' | 'MIXED' | 'UNAVAILABLE';
    timestamp: string | null;
  };
}

export interface FundamentalAnalysisStage {
  stage: 'BEFORE_RELEASE' | 'AFTER_RELEASE';
  generatedAt: string;
  headlineAssessment: string;
  policyImplication: string;
  signalClassification: 'HAWKISH' | 'DOVISH' | 'NEUTRAL' | 'MIXED' | 'INSUFFICIENT_EVIDENCE';
  scenarios?: {
    bullishScenario: string;
    bearishScenario: string;
    neutralScenario: string;
    uncertaintyFactors: string[];
  };
  reportBreakdown: Record<string, any>;
  assetImpacts: Record<SupportedSymbol, AssetMacroImpact>;
  researchAttribution: {
    officialFacts: string[];
    marketExpectations: string[];
    publishedSources: SourceReference[];
    analyticalInterpretation: string;
  };
  aiInterpretation?: {
    used: boolean;
    model: string | null;
    summary: string | null;
    error?: string;
  };
}

export interface FundamentalEventRecord {
  id: string;
  eventType: MacroEventType;
  title: string;
  referencePeriod: string;
  scheduledAt: string;
  scheduledDisplayNY: string;
  timezone: 'America/New_York';
  importance: 'HIGH';
  status: 'UPCOMING' | 'RELEASED' | 'ANALYSIS_UPDATED' | 'DATA_UNAVAILABLE';
  dataFreshness: 'LIVE' | 'DELAYED' | 'DATA_UNAVAILABLE';
  actualSummary: string | null;
  forecastSummary: string | null;
  previousSummary: string | null;
  revisionSummary: string | null;
  officialMetrics: Record<string, any>;
  sourceUrls: SourceReference[];
  beforeRelease: FundamentalAnalysisStage | null;
  afterRelease: FundamentalAnalysisStage | null;
  lastSyncedAt: string;
}

export interface FundamentalOverviewResponse {
  lastSyncedAt: string | null;
  byCategory: Record<
    MacroEventType,
    {
      latestReleased: FundamentalEventRecord | null;
      nextUpcoming: FundamentalEventRecord | null;
    }
  >;
  upcoming: FundamentalEventRecord[];
  released: FundamentalEventRecord[];
  events: FundamentalEventRecord[];
}

interface FundamentalAnalysisViewProps {
  lang: Language;
  focusSymbol?: SupportedSymbol;
  onInspectTechnicalSymbol?: (sym: SupportedSymbol) => void;
}

const CATEGORIES: MacroEventType[] = ['CPI', 'FOMC', 'PPI', 'NFP'];

export const FundamentalAnalysisView: React.FC<FundamentalAnalysisViewProps> = ({
  lang,
  focusSymbol,
  onInspectTechnicalSymbol,
}) => {
  const t = translations[lang];
  const [overview, setOverview] = useState<FundamentalOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | MacroEventType>('ALL');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<'AFTER_RELEASE' | 'BEFORE_RELEASE'>('AFTER_RELEASE');

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fundamental/overview');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setOverview(data);

      const eventsList: FundamentalEventRecord[] = Array.isArray(data.events) ? data.events : [];
      if (eventsList.length > 0 && !selectedEventId) {
        const latestReleased =
          eventsList.find((ev) => Boolean(ev.afterRelease)) || eventsList[0];
        if (latestReleased) {
          setSelectedEventId(latestReleased.id);
          setSelectedStage(latestReleased.afterRelease ? 'AFTER_RELEASE' : 'BEFORE_RELEASE');
        }
      }
    } catch (err: any) {
      setError(translateApiError(err?.message, lang));
    } finally {
      setLoading(false);
    }
  }, [lang, selectedEventId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleSelectEvent = (ev: FundamentalEventRecord) => {
    setSelectedEventId(ev.id);
    setSelectedStage(ev.afterRelease ? 'AFTER_RELEASE' : 'BEFORE_RELEASE');
  };

  const renderToneBadge = (tone: string) => {
    if (tone === 'HAWKISH') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rose-500/15 text-rose-700 dark:text-rose-400">
          HAWKISH
        </span>
      );
    }
    if (tone === 'DOVISH') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          DOVISH
        </span>
      );
    }
    if (tone === 'MIXED') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-400">
          MIXED
        </span>
      );
    }
    if (tone === 'INSUFFICIENT_EVIDENCE') {
      return (
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
          {t.insufficientDataBadge}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-sky-500/15 text-sky-700 dark:text-sky-400">
        NEUTRAL
      </span>
    );
  };

  const renderStatusBadge = (status: FundamentalEventRecord['status']) => {
    if (status === 'ANALYSIS_UPDATED' || status === 'RELEASED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          <span>{status}</span>
        </span>
      );
    }
    if (status === 'UPCOMING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-400">
          <Clock className="w-3 h-3" />
          <span>UPCOMING</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="w-3 h-3" />
        <span>DATA_UNAVAILABLE</span>
      </span>
    );
  };

  const renderBiasChip = (bias: AssetMacroImpact['bias'], strength: AssetMacroImpact['strength']) => {
    const color =
      bias === 'BULLISH'
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
        : bias === 'BEARISH'
        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
        : bias === 'UNCERTAIN'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300';
    const Icon = bias === 'BULLISH' ? TrendingUp : bias === 'BEARISH' ? TrendingDown : Minus;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${color}`}>
        <Icon className="w-3 h-3" />
        <span>
          {bias} • {strength}
        </span>
      </span>
    );
  };

  if (loading && !overview) {
    return (
      <div className="py-16 text-center rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 text-xs text-zinc-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-60" />
        <span>{t.loadingPage}</span>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={fetchOverview}
          className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  const allEvents = overview?.events || [];
  const filteredEvents =
    selectedCategory === 'ALL'
      ? allEvents
      : allEvents.filter((ev) => ev.eventType === selectedCategory);
  const selectedEvent =
    filteredEvents.find((ev) => ev.id === selectedEventId) ||
    allEvents.find((ev) => ev.id === selectedEventId) ||
    filteredEvents[0] ||
    allEvents[0] ||
    null;

  const activeStageObj: FundamentalAnalysisStage | null = selectedEvent
    ? selectedStage === 'AFTER_RELEASE' && selectedEvent.afterRelease
      ? selectedEvent.afterRelease
      : selectedEvent.beforeRelease || selectedEvent.afterRelease
    : null;

  const sortedAssets = [...ALL_SUPPORTED_SYMBOLS].sort((a, b) => {
    if (a === focusSymbol) return -1;
    if (b === focusSymbol) return 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Section Heading & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            <Landmark className="w-4 h-4" />
            <span>{t.fundamentalTitle}</span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
            {t.fundamentalSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {overview?.lastSyncedAt && (
            <span className="text-[11px] font-mono text-zinc-400" dir="ltr">
              {new Date(overview.lastSyncedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={fetchOverview}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-xs font-semibold flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t.refreshBtn}</span>
          </button>
        </div>
      </div>

      {/* 4 Core Macro Pillars Summary Cards (CPI, FOMC, PPI, NFP) */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {CATEGORIES.map((cat) => {
            const bucket = overview.byCategory[cat];
            const latestRel = bucket?.latestReleased;
            const nextUp = bucket?.nextUpcoming;
            const latestTone =
              latestRel?.afterRelease?.signalClassification ||
              latestRel?.beforeRelease?.signalClassification ||
              'INSUFFICIENT_EVIDENCE';
            const isSelectedCat = selectedCategory === cat;

            return (
              <div
                key={cat}
                className={`rounded-2xl p-4 bg-white dark:bg-[#121214] border transition-all space-y-3 ${
                  isSelectedCat
                    ? 'border-zinc-900 dark:border-white shadow-sm'
                    : 'border-black/10 dark:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(isSelectedCat ? 'ALL' : cat);
                      if (latestRel) handleSelectEvent(latestRel);
                      else if (nextUp) handleSelectEvent(nextUp);
                    }}
                    className="font-extrabold text-sm tracking-tight text-zinc-950 dark:text-white hover:underline"
                    dir="ltr"
                  >
                    {cat}
                  </button>
                  {renderToneBadge(latestTone)}
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                    {t.latestReleaseLabel}
                  </span>
                  {latestRel ? (
                    <button
                      type="button"
                      onClick={() => handleSelectEvent(latestRel)}
                      className="text-start w-full group"
                    >
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:underline line-clamp-1" dir="ltr">
                        {latestRel.referencePeriod}
                      </div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono line-clamp-2" dir="ltr">
                        {latestRel.actualSummary || t.dataUnavailableLabel}
                      </div>
                    </button>
                  ) : (
                    <div className="text-[11px] text-zinc-400">{t.dataUnavailableLabel}</div>
                  )}
                </div>

                <div className="pt-2 border-t border-black/5 dark:border-white/10 space-y-1 text-xs">
                  <span className="text-[10px] font-bold uppercase text-zinc-400 block">
                    {t.nextReleaseLabel}
                  </span>
                  {nextUp ? (
                    <button
                      type="button"
                      onClick={() => handleSelectEvent(nextUp)}
                      className="text-start w-full text-[11px] font-mono text-sky-700 dark:text-sky-400 hover:underline"
                      dir="ltr"
                    >
                      {nextUp.scheduledDisplayNY}
                    </button>
                  ) : (
                    <span className="text-[11px] text-zinc-400">{t.dataUnavailableLabel}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timeline & Category Filter */}
      <div className="rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <span>{t.allEventsTimelineLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  const first = cat === 'ALL' ? allEvents[0] : allEvents.find((ev) => ev.eventType === cat);
                  if (first) handleSelectEvent(first);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  selectedCategory === cat
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {cat === 'ALL' ? t.allCategoriesFilter : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pe-1">
          {filteredEvents.map((ev) => {
            const active = selectedEvent?.id === ev.id;
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => handleSelectEvent(ev)}
                className={`text-start p-3 rounded-xl border transition-all space-y-1.5 ${
                  active
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 border-zinc-950 dark:border-white'
                    : 'bg-zinc-50 dark:bg-zinc-900/60 border-black/5 dark:border-white/10 hover:border-black/20 dark:hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/15" dir="ltr">
                    {ev.eventType}
                  </span>
                  {renderStatusBadge(ev.status)}
                </div>
                <div className="text-xs font-bold leading-snug line-clamp-1" dir="ltr">
                  {ev.title}
                </div>
                <div className={`text-[11px] font-mono ${active ? 'opacity-80' : 'text-zinc-500'}`} dir="ltr">
                  {ev.scheduledDisplayNY}
                </div>
                {ev.actualSummary && (
                  <div className={`text-[11px] font-mono line-clamp-1 ${active ? 'opacity-90' : 'text-zinc-700 dark:text-zinc-300'}`} dir="ltr">
                    {ev.actualSummary}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Event Full Institutional Report */}
      {selectedEvent && (
        <ProtectedContent lang={lang} showBadge={true} className="space-y-5">
          {/* Event Header & Numerical Matrix */}
          <section className="rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-black/5 dark:border-white/10 pb-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-mono text-xs font-extrabold" dir="ltr">
                    {selectedEvent.eventType}
                  </span>
                  {renderStatusBadge(selectedEvent.status)}
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300" dir="ltr">
                    FEED: {selectedEvent.dataFreshness}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-zinc-950 dark:text-white" dir="ltr">
                  {selectedEvent.title}
                </h2>
                <div className="text-xs font-mono text-zinc-500" dir="ltr">
                  {selectedEvent.scheduledDisplayNY} ({selectedEvent.timezone})
                </div>
              </div>

              {/* Two-Stage Historical Preservation Switcher */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!selectedEvent.beforeRelease}
                  onClick={() => setSelectedStage('BEFORE_RELEASE')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 ${
                    selectedStage === 'BEFORE_RELEASE' || !selectedEvent.afterRelease
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                      : 'bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {t.stageBeforeLabel}
                </button>
                <button
                  type="button"
                  disabled={!selectedEvent.afterRelease}
                  onClick={() => setSelectedStage('AFTER_RELEASE')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 ${
                    selectedStage === 'AFTER_RELEASE' && selectedEvent.afterRelease
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                      : 'bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {t.stageAfterLabel}
                </button>
              </div>
            </div>

            {/* Actual / Consensus Forecast / Previous / Revision Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-black/5 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">{t.actualLabel}</span>
                <span className="font-mono font-bold text-zinc-950 dark:text-white block" dir="ltr">
                  {selectedEvent.actualSummary || t.dataUnavailableLabel}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-black/5 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">{t.forecastLabel}</span>
                <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300 block" dir="ltr">
                  {selectedEvent.forecastSummary || t.dataUnavailableLabel}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-black/5 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">{t.previousLabel}</span>
                <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300 block" dir="ltr">
                  {selectedEvent.previousSummary || t.dataUnavailableLabel}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/70 border border-black/5 dark:border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase text-zinc-400 block">{t.revisionLabel}</span>
                <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300 block" dir="ltr">
                  {selectedEvent.revisionSummary || t.notAvailableShort}
                </span>
              </div>
            </div>

            {activeStageObj && (
              <div className="space-y-4 pt-2">
                {/* Headline Assessment & Policy Implication */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-black/5 dark:border-white/10 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white" dir="ltr">
                      {activeStageObj.stage} • {new Date(activeStageObj.generatedAt).toLocaleString()}
                    </span>
                    {renderToneBadge(activeStageObj.signalClassification)}
                  </div>
                  <p className="text-sm font-bold text-zinc-950 dark:text-white" dir="ltr">
                    {activeStageObj.headlineAssessment}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed" dir="ltr">
                    <strong>{t.policyImplicationLabel}:</strong> {activeStageObj.policyImplication}
                  </p>
                  {activeStageObj.reportBreakdown?.mixedReportDetected && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{t.mixedReportFlagLabel}</span>
                    </div>
                  )}
                </div>

                {/* Before-Release Conditional Scenarios */}
                {activeStageObj.scenarios && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
                        {t.bullishScenarioLabel}
                      </span>
                      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed" dir="ltr">
                        {activeStageObj.scenarios.bullishScenario}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1">
                      <span className="font-bold text-rose-700 dark:text-rose-400 block">
                        {t.bearishScenarioLabel}
                      </span>
                      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed" dir="ltr">
                        {activeStageObj.scenarios.bearishScenario}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-black/10 dark:border-white/10 space-y-1">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                        {t.neutralScenarioLabel}
                      </span>
                      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed" dir="ltr">
                        {activeStageObj.scenarios.neutralScenario}
                      </p>
                    </div>
                  </div>
                )}

                {activeStageObj.scenarios?.uncertaintyFactors &&
                  activeStageObj.scenarios.uncertaintyFactors.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                      <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{t.uncertaintyFactorsLabel}</span>
                      </span>
                      <ul className="list-disc ps-5 text-[11px] text-amber-900 dark:text-amber-200 space-y-0.5" dir="ltr">
                        {activeStageObj.scenarios.uncertaintyFactors.map((uf, i) => (
                          <li key={i}>{uf}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                {/* Event-Specific Report Breakdown & FOMC Statement Diff */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-black/5 dark:border-white/10 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
                    <FileText className="w-4 h-4 text-zinc-500" />
                    <span>{t.reportBreakdownLabel}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 text-xs">
                    {Object.entries(activeStageObj.reportBreakdown || {})
                      .filter(
                        ([k, val]) =>
                          !['newOrChangedParagraphs', 'removedPriorParagraphs', 'scenarios', 'pressConferenceSource'].includes(k) &&
                          (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null)
                      )
                      .map(([k, val]) => (
                        <div
                          key={k}
                          className="p-2.5 rounded-lg bg-white dark:bg-[#121214] border border-black/5 dark:border-white/5"
                        >
                          <span className="text-[10px] font-mono text-zinc-400 block truncate" dir="ltr">
                            {k}
                          </span>
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs" dir="ltr">
                            {val === null ? t.notAvailableShort : String(val)}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* FOMC Statement Diff Paragraphs */}
                  {selectedEvent.eventType === 'FOMC' &&
                    ((activeStageObj.reportBreakdown?.newOrChangedParagraphs?.length || 0) > 0 ||
                      (activeStageObj.reportBreakdown?.hawkishSignalsDetected?.length || 0) > 0 ||
                      (activeStageObj.reportBreakdown?.dovishSignalsDetected?.length || 0) > 0) && (
                      <div className="pt-3 border-t border-black/5 dark:border-white/10 space-y-2 text-xs">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <GitCompare className="w-3.5 h-3.5 text-sky-500" />
                          <span>{t.statementDiffLabel}</span>
                        </div>
                        <div className="flex flex-wrap gap-2" dir="ltr">
                          {(activeStageObj.reportBreakdown.hawkishSignalsDetected || []).map((sig: string) => (
                            <span key={sig} className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-mono">
                              Hawkish phrase: "{sig}"
                            </span>
                          ))}
                          {(activeStageObj.reportBreakdown.dovishSignalsDetected || []).map((sig: string) => (
                            <span key={sig} className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono">
                              Dovish phrase: "{sig}"
                            </span>
                          ))}
                        </div>
                        {(activeStageObj.reportBreakdown.newOrChangedParagraphs || []).map((para: string, idx: number) => (
                          <p
                            key={idx}
                            className="p-2.5 rounded-lg bg-white dark:bg-[#121214] border-s-2 border-sky-500 text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed"
                            dir="ltr"
                          >
                            {para}
                          </p>
                        ))}
                      </div>
                    )}
                </div>

                {/* 8-Asset Market Impact Matrix */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-950 dark:text-white">
                    <Layers className="w-4 h-4 text-zinc-500" />
                    <span>{t.assetImpactMatrixLabel}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {sortedAssets.map((sym) => {
                      const imp = activeStageObj.assetImpacts?.[sym];
                      if (!imp) return null;
                      const isFocused = sym === focusSymbol;
                      const alignColor =
                        imp.technicalAlignment?.status === 'ALIGNED'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                          : imp.technicalAlignment?.status === 'CONFLICT'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                          : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-black/5 dark:border-white/10';

                      return (
                        <div
                          key={sym}
                          className={`p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border space-y-2.5 text-xs ${
                            isFocused
                              ? 'border-sky-500/60 ring-1 ring-sky-500/30'
                              : 'border-black/5 dark:border-white/10'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-sm text-zinc-950 dark:text-white" dir="ltr">
                                {sym}
                              </span>
                              {renderBiasChip(imp.bias, imp.strength)}
                            </div>
                            {onInspectTechnicalSymbol && (
                              <button
                                type="button"
                                onClick={() => onInspectTechnicalSymbol(sym)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
                              >
                                <span>{t.technicalViewBtn}</span>
                                <ArrowUpRight className="w-3 h-3 rtl:rotate-[-90deg]" />
                              </button>
                            )}
                          </div>

                          <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed" dir="ltr">
                            {imp.reasoning}
                          </p>

                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1" dir="ltr">
                            <div>
                              <strong className="text-zinc-700 dark:text-zinc-300">
                                {t.transmissionMechanismLabel}:
                              </strong>{' '}
                              {imp.transmissionMechanism}
                            </div>
                            {imp.invalidationConditions?.length > 0 && (
                              <div>
                                <strong className="text-zinc-700 dark:text-zinc-300">
                                  {t.invalidationLabel}:
                                </strong>{' '}
                                {imp.invalidationConditions.join(' • ')}
                              </div>
                            )}
                          </div>

                          {/* Post-Release Market Price Reaction */}
                          {imp.postReleaseReaction && imp.postReleaseReaction.available && (
                            <div className="p-2 rounded-lg bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2" dir="ltr">
                              <span className="text-zinc-500 font-sans font-semibold">{t.postReactionLabel}:</span>
                              <span>
                                {imp.postReleaseReaction.referencePriceBefore} → {imp.postReleaseReaction.observedPriceAfter}{' '}
                                ({(imp.postReleaseReaction.pctMove ?? 0) >= 0 ? '+' : ''}
                                {imp.postReleaseReaction.pctMove}%)
                              </span>
                              <span
                                className={`font-bold ${
                                  imp.postReleaseReaction.directionConfirmed === 'CONFIRMED'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : imp.postReleaseReaction.directionConfirmed === 'CONTRADICTED'
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}
                              >
                                {imp.postReleaseReaction.directionConfirmed}
                              </span>
                            </div>
                          )}

                          {/* Fundamental vs Technical Connection */}
                          {imp.technicalAlignment && (
                            <div className={`p-2.5 rounded-lg border text-[11px] space-y-0.5 ${alignColor}`}>
                              <div className="flex items-center justify-between gap-2 font-bold">
                                <span>{t.techConnectionLabel}</span>
                                <span dir="ltr">{imp.technicalAlignment.status}</span>
                              </div>
                              <p dir="ltr" className="opacity-90 leading-snug">
                                {imp.technicalAlignment.note}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4-Tier Verifiable Research Attribution */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-black/5 dark:border-white/10 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-zinc-950 dark:text-white">
                      {t.sourceAttributionLabel}
                    </span>
                    {activeStageObj.aiInterpretation?.used && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                        <Sparkles className="w-3 h-3" />
                        <span>{activeStageObj.aiInterpretation.model}</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                        {t.officialFactsTier}
                      </span>
                      <ul className="list-disc ps-4 text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5" dir="ltr">
                        {activeStageObj.researchAttribution.officialFacts.map((fact, idx) => (
                          <li key={idx}>{fact}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                        {t.marketExpectationsTier}
                      </span>
                      <ul className="list-disc ps-4 text-[11px] text-zinc-600 dark:text-zinc-400 space-y-0.5" dir="ltr">
                        {activeStageObj.researchAttribution.marketExpectations.map((exp, idx) => (
                          <li key={idx}>{exp}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                        {t.publishedSourcesTier}
                      </span>
                      <div className="flex flex-col gap-1" dir="ltr">
                        {activeStageObj.researchAttribution.publishedSources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            <span className="truncate">{src.institution}: {src.label}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                        {t.interpretationTier}
                      </span>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed" dir="ltr">
                        {activeStageObj.researchAttribution.analyticalInterpretation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </ProtectedContent>
      )}
    </div>
  );
};
