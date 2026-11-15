import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  X,
  Lock,
  Sliders,
  BellRing,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  Edit3,
  Trash2,
  Search,
  Image as ImageIcon,
} from 'lucide-react';
import { Language, translations, translateApiError } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';
import { useTradeEngine } from '../hooks/useTradeEngine';
import { MarketQuote } from '../hooks/useLivePrices';
import {
  ALL_SUPPORTED_SYMBOLS,
  INSTRUMENT_SPECS,
  SupportedSymbol,
  Trade,
  calculateLotSizeSafe,
  calculateRequiredMarginSafe,
} from '../lib/supabase';

interface JournalPageProps {
  lang: Language;
  onOpenAuth: () => void;
  quotes: Record<string, MarketQuote>;
}

export const JournalPage: React.FC<JournalPageProps> = ({ lang, onOpenAuth, quotes }) => {
  const t = translations[lang];
  const { user, updateStartingCapital } = useAuth();
  const tradeEngine = useTradeEngine(quotes);

  // Capital editor modal state
  const [editingCapital, setEditingCapital] = useState(false);
  const [newCapitalInput, setNewCapitalInput] = useState<string>('10000');
  const [capitalError, setCapitalError] = useState<string | null>(null);
  const [savingCapital, setSavingCapital] = useState(false);

  // New Trade modal state
  const [newTradeOpen, setNewTradeOpen] = useState(false);
  const [tradeSymbol, setTradeSymbol] = useState<SupportedSymbol>('XAUUSD');
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy');
  const [stopLoss, setStopLoss] = useState<number>(0);
  const [takeProfit, setTakeProfit] = useState<number>(0);
  const [riskPct, setRiskPct] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [strategy, setStrategy] = useState<string>('');
  const [entryReason, setEntryReason] = useState<string>('');
  const [emotions, setEmotions] = useState<string>('');
  const [screenshotUrl, setScreenshotUrl] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);

  // Edit / Delete journal entry modal state
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStrategy, setEditStrategy] = useState('');
  const [editEntryReason, setEditEntryReason] = useState('');
  const [editExitReason, setEditExitReason] = useState('');
  const [editEmotions, setEditEmotions] = useState('');
  const [editMistakes, setEditMistakes] = useState('');
  const [editScreenshotUrl, setEditScreenshotUrl] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // History filters
  const [filterSymbol, setFilterSymbol] = useState<string>('ALL');
  const [filterStrategy, setFilterStrategy] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const liveQuote = quotes[tradeSymbol];
  const liveReferencePrice = liveQuote?.price ?? 0;

  const availableStrategies = useMemo(() => {
    const set = new Set<string>();
    for (const tr of tradeEngine.trades) {
      if (tr.strategy && tr.strategy.trim()) set.add(tr.strategy.trim());
    }
    return Array.from(set).sort();
  }, [tradeEngine.trades]);

  useEffect(() => {
    if (newTradeOpen && liveReferencePrice > 0) {
      const symSpec = INSTRUMENT_SPECS[tradeSymbol];
      const defaultSL =
        tradeSide === 'buy'
          ? liveReferencePrice - symSpec.defaultSlOffset
          : liveReferencePrice + symSpec.defaultSlOffset;
      const defaultTP =
        tradeSide === 'buy'
          ? liveReferencePrice + symSpec.defaultTpOffset
          : liveReferencePrice - symSpec.defaultTpOffset;
      setStopLoss(Number(defaultSL.toFixed(symSpec.decimals)));
      setTakeProfit(Number(defaultTP.toFixed(symSpec.decimals)));
      setFormError(null);
    }
  }, [newTradeOpen, tradeSymbol, tradeSide, liveReferencePrice]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
          {t.loginRequired}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
          {t.loginRequiredDesc}
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-3 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold text-sm hover:opacity-90 transition-all shadow-sm"
        >
          {t.signIn}
        </button>
      </div>
    );
  }

  const spec = INSTRUMENT_SPECS[tradeSymbol];
  const computedLot =
    liveReferencePrice > 0
      ? calculateLotSizeSafe(tradeEngine.balance, riskPct, liveReferencePrice, stopLoss, tradeSymbol)
      : spec.minLot;
  const estMargin =
    liveReferencePrice > 0
      ? calculateRequiredMarginSafe(liveReferencePrice, computedLot, tradeSymbol)
      : 0;

  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!liveQuote || liveReferencePrice <= 0) {
      setFormError(translateApiError(`Live market quote unavailable for ${tradeSymbol}`, lang));
      return;
    }

    if (tradeSide === 'buy') {
      if (stopLoss >= liveReferencePrice || takeProfit <= liveReferencePrice) {
        setFormError(t.invalidSlTpBuy);
        return;
      }
    } else {
      if (stopLoss <= liveReferencePrice || takeProfit >= liveReferencePrice) {
        setFormError(t.invalidSlTpSell);
        return;
      }
    }

    setSubmittingOrder(true);
    try {
      await tradeEngine.createTrade({
        symbol: tradeSymbol,
        side: tradeSide,
        sl: stopLoss,
        tp: takeProfit,
        risk_pct: riskPct,
        notes,
        strategy,
        entry_reason: entryReason,
        emotions,
        screenshot_url: screenshotUrl,
      });
      setNewTradeOpen(false);
      setNotes('');
      setStrategy('');
      setEntryReason('');
      setEmotions('');
      setScreenshotUrl('');
    } catch (err: any) {
      setFormError(translateApiError(err?.message, lang));
    } finally {
      setSubmittingOrder(false);
    }
  };

  const openEditJournalModal = (tr: Trade) => {
    setEditingTrade(tr);
    setEditNotes(tr.notes || '');
    setEditStrategy(tr.strategy || '');
    setEditEntryReason(tr.entry_reason || '');
    setEditExitReason(tr.exit_reason || '');
    setEditEmotions(tr.emotions || '');
    setEditMistakes(tr.mistakes || '');
    setEditScreenshotUrl(tr.screenshot_url || '');
    setJournalError(null);
  };

  const handleSaveJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrade) return;
    setSavingJournal(true);
    setJournalError(null);
    try {
      await tradeEngine.updateTradeJournal(editingTrade.id, {
        notes: editNotes,
        strategy: editStrategy,
        entry_reason: editEntryReason,
        exit_reason: editExitReason,
        emotions: editEmotions,
        mistakes: editMistakes,
        screenshot_url: editScreenshotUrl,
      });
      setEditingTrade(null);
    } catch (err: any) {
      setJournalError(translateApiError(err?.message, lang));
    } finally {
      setSavingJournal(false);
    }
  };

  const handleDeleteTradeRecord = async (tradeId: string) => {
    setJournalError(null);
    try {
      await tradeEngine.deleteTrade(tradeId);
      setConfirmDeleteId(null);
    } catch (err: any) {
      setJournalError(translateApiError(err?.message, lang));
    }
  };

  const handleScreenshotFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setJournalError(t.uploadMimeError);
      return;
    }
    if (file.size > 300 * 1024) {
      setJournalError(lang === 'ar' ? 'يجب ألا يتجاوز حجم اللقطة 300 كيلوبايت.' : 'Screenshot must be 300 KB or less.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClosePosition = async (tradeId: string) => {
    setClosingId(tradeId);
    try {
      await tradeEngine.closeTrade(tradeId);
    } catch {
      // engineError displays server message
    } finally {
      setClosingId(null);
    }
  };

  const handleSaveCapital = async () => {
    setCapitalError(null);
    const val = parseFloat(newCapitalInput);
    if (!Number.isFinite(val) || val < 10 || val > 100000000) {
      setCapitalError(t.capitalRangeError);
      return;
    }
    setSavingCapital(true);
    const res = await updateStartingCapital(val);
    setSavingCapital(false);
    if (!res.success) {
      setCapitalError(translateApiError(res.error, lang));
      return;
    }
    setEditingCapital(false);
    await tradeEngine.refreshTrades();
  };

  const filteredClosedTrades = tradeEngine.closedTrades.filter((tr) => {
    if (filterSymbol !== 'ALL' && tr.symbol !== filterSymbol) return false;
    if (filterStrategy !== 'ALL' && (tr.strategy || '').trim() !== filterStrategy) return false;
    if (filterDate && !tr.opened_at.startsWith(filterDate)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const hay = `${tr.symbol} ${tr.strategy || ''} ${tr.notes || ''} ${tr.entry_reason || ''} ${tr.exit_reason || ''} ${tr.mistakes || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Equity curve geometry
  const curvePoints = tradeEngine.stats.equityCurve;
  const hasMultiplePoints = curvePoints.length > 1;
  const rawMin = Math.min(...curvePoints.map((p) => p.equity));
  const rawMax = Math.max(...curvePoints.map((p) => p.equity));
  const minEquity = rawMin * 0.99;
  const maxEquity = rawMax === rawMin ? rawMax * 1.01 : rawMax * 1.01;
  const svgWidth = 600;
  const svgHeight = 160;
  const pointsStr = curvePoints
    .map((p, i) => {
      const x = (i / Math.max(1, curvePoints.length - 1)) * svgWidth;
      const range = maxEquity - minEquity || 1;
      const y = svgHeight - ((p.equity - minEquity) / range) * (svgHeight - 20) - 10;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {t.journalTitle}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
              <ShieldCheck className="w-3 h-3" />
              {t.serverValidatedBadge}
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t.journalSubtitle}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setNewCapitalInput(tradeEngine.startingCapital.toString());
              setCapitalError(null);
              setEditingCapital(true);
            }}
            className="px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121214] text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t.setCapital}</span>
          </button>

          <button
            onClick={() => {
              setFormError(null);
              setNewTradeOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold text-xs hover:opacity-90 transition-all shadow-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t.newTrade}</span>
          </button>
        </div>
      </div>

      {/* Engine error or Auto-close trigger alerts */}
      {tradeEngine.engineError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{translateApiError(tradeEngine.engineError, lang)}</span>
        </div>
      )}

      {tradeEngine.autoCloseAlerts.length > 0 && (
        <div className="space-y-2">
          {tradeEngine.autoCloseAlerts.map((alertText, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 shrink-0 text-sky-500" />
                <span className="font-medium">{alertText}</span>
              </div>
              <button
                onClick={() => tradeEngine.dismissAlert(idx)}
                className="p-1 rounded-lg hover:bg-sky-500/10 text-sky-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Account Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block mb-1">
            {t.balance}
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono tabular-nums text-zinc-950 dark:text-white" dir="ltr">
            ${tradeEngine.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {t.initialCapitalPrefix} ${tradeEngine.startingCapital.toLocaleString()}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block mb-1">
            {t.equity}
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono tabular-nums text-zinc-950 dark:text-white" dir="ltr">
            ${tradeEngine.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">{t.balancePlusFloating}</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block mb-1">
            {t.floatingPnl}
          </span>
          <div
            dir="ltr"
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono tabular-nums ${
              tradeEngine.floatingPnl > 0
                ? 'text-emerald-500'
                : tradeEngine.floatingPnl < 0
                ? 'text-rose-500'
                : 'text-zinc-500'
            }`}
          >
            {tradeEngine.floatingPnl >= 0 ? '+' : ''}$
            {tradeEngine.floatingPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">{t.includesCommSwap}</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block mb-1">
            {t.freeMargin}
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono tabular-nums text-zinc-950 dark:text-white" dir="ltr">
            ${tradeEngine.freeMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block">
            {t.marginUsedPrefix} ${tradeEngine.marginUsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            {tradeEngine.marginLevel !== null ? ` (${tradeEngine.marginLevel}%)` : ''}
          </span>
        </div>
      </div>

      {/* Open Positions */}
      <div className="rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white">
            {t.openTrades}
          </h2>
          <span className="text-xs text-zinc-400 font-mono">
            {t.activePositionsPrefix} {tradeEngine.openTrades.length}
          </span>
        </div>

        {tradeEngine.openTrades.length === 0 ? (
          <div className="py-10 text-center text-zinc-400 text-sm">{t.noOpenTrades}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/10 text-zinc-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 text-start">{t.colSymbol}</th>
                  <th className="py-2.5 px-3 text-start">{t.side}</th>
                  <th className="py-2.5 px-3 text-end">{t.colLots}</th>
                  <th className="py-2.5 px-3 text-end">{t.colEntry}</th>
                  <th className="py-2.5 px-3 text-end">{t.colLiveQuote}</th>
                  <th className="py-2.5 px-3 text-end">S/L</th>
                  <th className="py-2.5 px-3 text-end">T/P</th>
                  <th className="py-2.5 px-3 text-end">{t.colCommSwap}</th>
                  <th className="py-2.5 px-3 text-end">{t.colNetPnlUsd}</th>
                  <th className="py-2.5 px-3 text-center">{t.colAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 font-mono tabular-nums">
                {tradeEngine.openTrades.map((trade) => {
                  const pnl = trade.floatingPnl ?? 0;
                  const isProfit = pnl >= 0;
                  const commSwap = (trade.commission ?? 0) + (trade.swap ?? 0);
                  return (
                    <tr key={trade.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-bold text-zinc-900 dark:text-white font-sans">
                        {trade.symbol}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            trade.side === 'buy'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {trade.side === 'buy' ? t.buyShort : t.sellShort}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-end">{trade.lot}</td>
                      <td className="py-3 px-3 text-end">{trade.entry}</td>
                      <td className="py-3 px-3 text-end font-bold text-zinc-900 dark:text-zinc-100">
                        {trade.hasVerifiedQuote ? trade.currentPrice : t.feedWaitLabel}
                      </td>
                      <td className="py-3 px-3 text-end text-rose-500">{trade.sl}</td>
                      <td className="py-3 px-3 text-end text-emerald-500">{trade.tp}</td>
                      <td className="py-3 px-3 text-end text-zinc-400" dir="ltr">
                        ${commSwap.toFixed(2)}
                      </td>
                      <td
                        dir="ltr"
                        className={`py-3 px-3 text-end font-bold text-sm ${
                          isProfit ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {isProfit ? '+' : ''}${pnl.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditJournalModal(trade)}
                            className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-zinc-600 dark:text-zinc-300"
                            title={t.editLabel}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleClosePosition(trade.id)}
                            disabled={closingId === trade.id}
                            className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-rose-600 hover:text-white transition-colors text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 font-sans disabled:opacity-50"
                          >
                            {closingId === trade.id ? '...' : t.manualClose}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">{t.winRate}</span>
          <span className="text-xl font-bold font-mono tabular-nums text-zinc-950 dark:text-white mt-1 block" dir="ltr">
            {tradeEngine.stats.winRate}%
          </span>
          <span className="text-[10px] text-zinc-400 font-mono" dir="ltr">
            {tradeEngine.stats.winningCount ?? 0}W / {tradeEngine.stats.losingCount ?? 0}L
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">{t.netPnl}</span>
          <span
            dir="ltr"
            className={`text-xl font-bold font-mono tabular-nums mt-1 block ${
              tradeEngine.stats.netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {tradeEngine.stats.netPnl >= 0 ? '+' : ''}${tradeEngine.stats.netPnl}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">{t.profitFactor}</span>
          <span className="text-xl font-bold font-mono tabular-nums text-zinc-950 dark:text-white mt-1 block" dir="ltr">
            {tradeEngine.stats.profitFactor}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">{t.avgRR}</span>
          <span className="text-xl font-bold font-mono tabular-nums text-zinc-950 dark:text-white mt-1 block" dir="ltr">
            1 : {tradeEngine.stats.avgRR}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">{t.maxDrawdownLabel}</span>
          <span className="text-xl font-bold font-mono tabular-nums text-rose-500 mt-1 block truncate" dir="ltr">
            -${(tradeEngine.stats.maxDrawdownUsd ?? 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono" dir="ltr">
            ({(tradeEngine.stats.maxDrawdownPct ?? 0).toFixed(2)}%)
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">{t.bestTrade}</span>
          <span className="text-xl font-bold font-mono tabular-nums text-emerald-500 mt-1 block truncate" dir="ltr">
            {tradeEngine.stats.bestTrade ? `$${tradeEngine.stats.bestTrade.pnl}` : '---'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 block">{t.worstTrade}</span>
          <span className="text-xl font-bold font-mono tabular-nums text-rose-500 mt-1 block truncate" dir="ltr">
            {tradeEngine.stats.worstTrade ? `$${tradeEngine.stats.worstTrade.pnl}` : '---'}
          </span>
        </div>
      </div>

      {/* Cumulative Equity Curve */}
      <div className="rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            {t.equityCurve}
          </h3>
          <span className="text-xs font-mono text-zinc-500">
            {curvePoints.length} {t.pointsCountSuffix}
          </span>
        </div>

        {!hasMultiplePoints ? (
          <div className="py-10 text-center text-xs text-zinc-400">
            {t.closeOneTradePrompt}
          </div>
        ) : (
          <div className="w-full overflow-hidden pt-2" dir="ltr">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-36 overflow-visible">
              <polyline
                fill="none"
                stroke={tradeEngine.balance >= tradeEngine.startingCapital ? '#16a34a' : '#dc2626'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsStr}
              />
            </svg>
          </div>
        )}
      </div>

      {/* Closed History */}
      <div className="rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white">
            {t.tradeHistory}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute start-2.5 top-2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.journalSearchPlaceholder}
                className="ps-8 pe-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium w-44"
              />
            </div>

            <select
              aria-label={t.filterSymbol}
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium"
            >
              <option value="ALL">{t.filterAll}</option>
              {ALL_SUPPORTED_SYMBOLS.map((sym) => (
                <option key={sym} value={sym}>
                  {sym}
                </option>
              ))}
            </select>

            {availableStrategies.length > 0 && (
              <select
                aria-label={t.journalStrategyLabel}
                value={filterStrategy}
                onChange={(e) => setFilterStrategy(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium"
              >
                <option value="ALL">{t.allStrategiesFilter}</option>
                {availableStrategies.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900 text-xs font-medium"
            />

            {(filterSymbol !== 'ALL' || filterStrategy !== 'ALL' || filterDate !== '' || searchQuery !== '') && (
              <button
                onClick={() => {
                  setFilterSymbol('ALL');
                  setFilterStrategy('ALL');
                  setFilterDate('');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t.resetBtn}</span>
              </button>
            )}
          </div>
        </div>

        {filteredClosedTrades.length === 0 ? (
          <div className="py-10 text-center text-zinc-400 text-sm">{t.noClosedTrades}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs font-mono tabular-nums">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/10 text-zinc-400 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3 text-start font-sans">{t.colSymbol}</th>
                  <th className="py-2.5 px-3 text-start font-sans">{t.side}</th>
                  <th className="py-2.5 px-3 text-end font-sans">{t.colLots}</th>
                  <th className="py-2.5 px-3 text-end font-sans">{t.colEntry}</th>
                  <th className="py-2.5 px-3 text-end font-sans">{t.colExit}</th>
                  <th className="py-2.5 px-3 text-center font-sans">{t.colTrigger}</th>
                  <th className="py-2.5 px-3 text-end font-sans">{t.colNetPnlUsd}</th>
                  <th className="py-2.5 px-3 text-end font-sans">{t.openedAt}</th>
                  <th className="py-2.5 px-3 text-end font-sans">{t.closedAt}</th>
                  <th className="py-2.5 px-3 text-center font-sans">{t.colAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredClosedTrades.map((tr) => {
                  const isProfit = (tr.pnl || 0) >= 0;
                  return (
                    <tr key={tr.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-bold text-zinc-900 dark:text-white font-sans">
                        <div>{tr.symbol}</div>
                        {tr.strategy && (
                          <span className="text-[10px] font-medium text-sky-600 dark:text-sky-400 block">
                            {tr.strategy}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            tr.side === 'buy'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {tr.side === 'buy' ? t.buyShort : t.sellShort}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-end">{tr.lot}</td>
                      <td className="py-3 px-3 text-end">{tr.entry}</td>
                      <td className="py-3 px-3 text-end">{tr.exit_price ?? '---'}</td>
                      <td className="py-3 px-3 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                            tr.close_reason === 'tp'
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                              : tr.close_reason === 'sl'
                              ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400'
                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          {tr.close_reason ?? 'manual'}
                        </span>
                      </td>
                      <td
                        dir="ltr"
                        className={`py-3 px-3 text-end font-bold text-sm ${
                          isProfit ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {isProfit ? '+' : ''}${tr.pnl?.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-end text-[10px] text-zinc-400">
                        {new Date(tr.opened_at).toLocaleString([], {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3 text-end text-[10px] text-zinc-400">
                        {tr.closed_at
                          ? new Date(tr.closed_at).toLocaleString([], {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '---'}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1">
                          {tr.screenshot_url && <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />}
                          <button
                            type="button"
                            onClick={() => openEditJournalModal(tr)}
                            className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-zinc-600 dark:text-zinc-300"
                            title={t.editLabel}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === tr.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDeleteTradeRecord(tr.id)}
                                className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold"
                              >
                                {t.confirmBtn}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-[10px]"
                              >
                                {t.cancelBtn}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(tr.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              title={t.deleteLabel}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Trade Modal */}
      {newTradeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#18181b] rounded-2xl p-6 sm:p-8 shadow-2xl border border-black/10 dark:border-white/10 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setNewTradeOpen(false)}
              aria-label={t.closeBtn}
              className="absolute top-5 end-5 p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold tracking-tight mb-1">{t.newTrade}</h2>
            <p className="text-[11px] text-zinc-400 mb-4">{t.serverExecNotice}</p>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTrade} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                    {t.symbol}
                  </label>
                  <select
                    value={tradeSymbol}
                    onChange={(e) => setTradeSymbol(e.target.value as SupportedSymbol)}
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-sm font-semibold"
                  >
                    {ALL_SUPPORTED_SYMBOLS.map((sym) => (
                      <option key={sym} value={sym}>
                        {sym} — {INSTRUMENT_SPECS[sym].shortName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                    {t.side}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900">
                    <button
                      type="button"
                      onClick={() => setTradeSide('buy')}
                      className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                        tradeSide === 'buy'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {t.buyShort}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeSide('sell')}
                      className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                        tradeSide === 'sell'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {t.sellShort}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-black/5 dark:border-white/10 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-zinc-500 font-sans block text-[11px]">
                    {t.execQuoteLabel} ({liveQuote?.source || t.statusUnavailable})
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {liveQuote?.sourceTimestamp
                      ? new Date(liveQuote.sourceTimestamp).toLocaleTimeString()
                      : t.feedOfflineLabel}
                  </span>
                </div>
                <span className="font-bold text-zinc-900 dark:text-white text-base tabular-nums" dir="ltr">
                  {liveReferencePrice > 0 ? liveReferencePrice : t.statusUnavailable}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-rose-500 mb-1">
                    {t.stopLoss}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    dir="ltr"
                    value={stopLoss || ''}
                    onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 text-sm font-mono tabular-nums text-rose-600 dark:text-rose-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-emerald-500 mb-1">
                    {t.takeProfit}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    dir="ltr"
                    value={takeProfit || ''}
                    onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-sm font-mono tabular-nums text-emerald-600 dark:text-emerald-400"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {t.riskPct}
                  </label>
                  <div className="flex items-center gap-1" dir="ltr">
                    <input
                      type="number"
                      step="0.25"
                      min="0.1"
                      max="10"
                      value={riskPct}
                      onChange={(e) => setRiskPct(parseFloat(e.target.value) || 1)}
                      className="w-16 p-1.5 text-end rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-black text-xs font-bold font-mono"
                    />
                    <span className="text-xs font-semibold text-zinc-400">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/10 text-xs">
                  <div>
                    <span className="text-zinc-400 block text-[11px]">{t.lotSize}</span>
                    <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
                      {computedLot} {t.lotsUnit}
                    </span>
                  </div>
                  <div className="text-end text-[11px] text-zinc-400 font-mono">
                    <span>
                      {t.marginEstPrefix} ${estMargin.toFixed(2)}
                    </span>
                    <span className="block opacity-75">
                      {t.maxRiskPrefix} ${((tradeEngine.balance * riskPct) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                    {t.journalStrategyLabel}
                  </label>
                  <input
                    type="text"
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    placeholder="SMC / Liquidity Sweep / Trend"
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                    {t.journalEmotionsLabel}
                  </label>
                  <input
                    type="text"
                    value={emotions}
                    onChange={(e) => setEmotions(e.target.value)}
                    placeholder="Calm / Disciplined"
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  {t.journalEntryReasonLabel}
                </label>
                <input
                  type="text"
                  value={entryReason}
                  onChange={(e) => setEntryReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  {t.strategyNotesLabel}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.strategyNotesPlaceholder}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  {t.journalScreenshotLabel}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    dir="ltr"
                    value={screenshotUrl}
                    onChange={(e) => setScreenshotUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  />
                  <label className="px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-semibold cursor-pointer">
                    <span>{t.chooseImageFileBtn}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleScreenshotFileUpload(e, setScreenshotUrl)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingOrder || liveReferencePrice <= 0}
                className="w-full py-3.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold text-sm shadow-sm transition-all disabled:opacity-50"
              >
                {submittingOrder ? t.executingLabel : t.openTradeBtn}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Journal Entry Modal */}
      {editingTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#18181b] rounded-2xl p-6 sm:p-8 shadow-2xl border border-black/10 dark:border-white/10 text-zinc-900 dark:text-zinc-100 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setEditingTrade(null)}
              aria-label={t.closeBtn}
              className="absolute top-5 end-5 p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold mb-1">
              {t.editJournalTitle} — {editingTrade.symbol}
            </h2>
            <p className="text-[11px] text-zinc-400 mb-4" dir="ltr">
              {editingTrade.side.toUpperCase()} · {editingTrade.lot} lots @ {editingTrade.entry}
            </p>

            {journalError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
                {journalError}
              </div>
            )}

            <form onSubmit={handleSaveJournalEntry} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">{t.journalStrategyLabel}</label>
                  <input
                    value={editStrategy}
                    onChange={(e) => setEditStrategy(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">{t.journalEmotionsLabel}</label>
                  <input
                    value={editEmotions}
                    onChange={(e) => setEditEmotions(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{t.journalEntryReasonLabel}</label>
                <input
                  value={editEntryReason}
                  onChange={(e) => setEditEntryReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{t.journalExitReasonLabel}</label>
                <input
                  value={editExitReason}
                  onChange={(e) => setEditExitReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{t.journalMistakesLabel}</label>
                <input
                  value={editMistakes}
                  onChange={(e) => setEditMistakes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{t.strategyNotesLabel}</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{t.journalScreenshotLabel}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={editScreenshotUrl}
                    onChange={(e) => setEditScreenshotUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                  />
                  <label className="px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-semibold cursor-pointer">
                    <span>{t.chooseImageFileBtn}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleScreenshotFileUpload(e, setEditScreenshotUrl)}
                      className="hidden"
                    />
                  </label>
                </div>
                {editScreenshotUrl && (
                  <img
                    src={editScreenshotUrl}
                    alt="Trade chart screenshot"
                    referrerPolicy="no-referrer"
                    className="mt-2 max-h-40 rounded-xl border border-black/10 dark:border-white/10 object-cover"
                  />
                )}
              </div>
              <button
                type="submit"
                disabled={savingJournal}
                className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold text-xs disabled:opacity-50"
              >
                {savingJournal ? t.savingLabel : t.saveJournalBtn}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Starting Capital Modal */}
      {editingCapital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-sm bg-white dark:bg-[#18181b] rounded-2xl p-6 shadow-2xl border border-black/10 dark:border-white/10 text-zinc-900 dark:text-zinc-100">
            <button
              onClick={() => setEditingCapital(false)}
              aria-label={t.closeBtn}
              className="absolute top-4 end-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold mb-2">{t.setCapital}</h3>
            <p className="text-xs text-zinc-500 mb-4">{t.capitalRangeHelp}</p>
            {capitalError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs">
                {capitalError}
              </div>
            )}
            <div className="mb-4">
              <input
                type="number"
                dir="ltr"
                value={newCapitalInput}
                onChange={(e) => setNewCapitalInput(e.target.value)}
                className="w-full p-3 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 font-mono text-base font-bold"
              />
            </div>
            <button
              onClick={handleSaveCapital}
              disabled={savingCapital}
              className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold text-xs transition-colors disabled:opacity-50"
            >
              {savingCapital ? t.savingLabel : t.saveCapital}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
