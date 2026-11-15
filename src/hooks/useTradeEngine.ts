import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trade,
  SupportedSymbol,
  calculateGrossPnLSafe,
  calculateCommissionSafe,
  calculateSwapSafe,
  calculateRequiredMarginSafe,
  roundCents,
} from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { MarketQuote } from './useLivePrices';

export interface JournalStats {
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netPnl: number;
  profitFactor: number;
  avgRR: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  equityCurve: { time: string; equity: number }[];
  totalCount: number;
  winningCount?: number;
  losingCount?: number;
  maxDrawdownUsd?: number;
  maxDrawdownPct?: number;
}

export function useTradeEngine(liveQuotes: Record<string, MarketQuote>) {
  const { user, accessToken, profile } = useAuth();
  const [serverTrades, setServerTrades] = useState<Trade[]>([]);
  const [serverStartingCapital, setServerStartingCapital] = useState<number>(10000);
  const [serverBalance, setServerBalance] = useState<number>(10000);
  const [serverStats, setServerStats] = useState<JournalStats>({
    winRate: 0,
    totalProfit: 0,
    totalLoss: 0,
    netPnl: 0,
    profitFactor: 0,
    avgRR: 0,
    bestTrade: null,
    worstTrade: null,
    equityCurve: [{ time: 'Start', equity: 10000 }],
    totalCount: 0,
    winningCount: 0,
    losingCount: 0,
    maxDrawdownUsd: 0,
    maxDrawdownPct: 0,
  });
  const [serverProtected, setServerProtected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [autoCloseAlerts, setAutoCloseAlerts] = useState<string[]>([]);

  const applyServerState = useCallback((data: any) => {
    const openList: Trade[] = Array.isArray(data.openTrades) ? data.openTrades : [];
    const closedList: Trade[] = Array.isArray(data.closedTrades) ? data.closedTrades : [];
    setServerTrades([...openList, ...closedList]);
    if (typeof data.startingCapital === 'number') setServerStartingCapital(data.startingCapital);
    if (typeof data.balance === 'number') setServerBalance(data.balance);
    if (data.stats) setServerStats(data.stats);
    setServerProtected(Boolean(data.serverProtected));
    if (Array.isArray(data.autoCloseAlerts) && data.autoCloseAlerts.length > 0) {
      setAutoCloseAlerts((prev) => Array.from(new Set([...prev, ...data.autoCloseAlerts])));
    }
    setEngineError(null);
  }, []);

  const fetchServerState = useCallback(async () => {
    if (!user || !accessToken) {
      setServerTrades([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/journal/state', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setEngineError(data.error || 'Failed to load trading journal state');
      } else {
        applyServerState(data);
      }
    } catch (err: any) {
      setEngineError(err?.message || 'Unable to sync with journal server');
    } finally {
      setLoading(false);
    }
  }, [user, accessToken, applyServerState]);

  useEffect(() => {
    fetchServerState();
  }, [fetchServerState, profile?.starting_capital]);

  // Periodically sync with authoritative server engine (SL/TP trigger check, swaps, settlement)
  const hasOpenTrades = serverTrades.some((t) => t.status === 'open');
  useEffect(() => {
    if (!user || !accessToken) return;
    const intervalMs = hasOpenTrades ? 10000 : 30000;
    const timer = setInterval(fetchServerState, intervalMs);
    return () => clearInterval(timer);
  }, [user, accessToken, hasOpenTrades, fetchServerState]);

  // Live floating metrics computed cleanly against verified liveQuotes
  const liveComputed = useMemo(() => {
    const openRaw = serverTrades.filter((t) => t.status === 'open');
    const closedTrades = serverTrades.filter((t) => t.status === 'closed');

    let totalFloating = 0;
    let totalMarginUsed = 0;

    const openTrades: Trade[] = openRaw.map((t) => {
      const quote = liveQuotes[t.symbol];
      const hasVerifiedQuote = Boolean(quote && Number.isFinite(quote.price));
      const currentPrice = hasVerifiedQuote ? quote.price : t.currentPrice ?? Number(t.entry);
      const quoteTrusted = hasVerifiedQuote || Boolean(t.hasVerifiedQuote);

      const grossPnl = quoteTrusted
        ? calculateGrossPnLSafe(t.side, Number(t.entry), currentPrice, Number(t.lot), t.symbol)
        : 0;
      const commission =
        t.commission !== undefined && t.commission !== null
          ? Number(t.commission)
          : calculateCommissionSafe(Number(t.lot), t.symbol, 1);
      const swap =
        t.swap !== undefined && t.swap !== null
          ? Number(t.swap)
          : calculateSwapSafe(t.side, Number(t.lot), t.symbol, t.opened_at);
      const floatingPnl = roundCents(grossPnl + commission + swap);
      const marginRequired = calculateRequiredMarginSafe(Number(t.entry), Number(t.lot), t.symbol);

      totalFloating = roundCents(totalFloating + floatingPnl);
      totalMarginUsed = roundCents(totalMarginUsed + marginRequired);

      return {
        ...t,
        currentPrice,
        hasVerifiedQuote: quoteTrusted,
        quoteTimestamp: quote?.sourceTimestamp || t.quoteTimestamp || null,
        grossPnl,
        commission,
        swap,
        floatingPnl,
        marginRequired,
      };
    });

    const equity = roundCents(serverBalance + totalFloating);
    const freeMargin = roundCents(Math.max(0, equity - totalMarginUsed));
    const marginLevel = totalMarginUsed > 0 ? Math.round((equity / totalMarginUsed) * 100) : null;

    return {
      openTrades,
      closedTrades,
      floatingPnl: totalFloating,
      marginUsed: totalMarginUsed,
      freeMargin,
      equity,
      marginLevel,
    };
  }, [serverTrades, liveQuotes, serverBalance]);

  // If live quote crosses SL/TP between polls, immediately trigger server verification sync
  useEffect(() => {
    if (!hasOpenTrades || !accessToken) return;
    const hitDetected = liveComputed.openTrades.some((t) => {
      if (!t.hasVerifiedQuote || t.currentPrice === undefined) return false;
      if (t.side === 'buy') {
        return t.currentPrice <= t.sl || t.currentPrice >= t.tp;
      }
      return t.currentPrice >= t.sl || t.currentPrice <= t.tp;
    });

    if (hitDetected) {
      fetchServerState();
    }
  }, [liveComputed.openTrades, hasOpenTrades, accessToken, fetchServerState]);

  // Server-authoritative trade execution (entry price & lot size computed/verified on server)
  const createTrade = async (tradeData: {
    symbol: SupportedSymbol;
    side: 'buy' | 'sell';
    sl: number;
    tp: number;
    risk_pct: number;
    notes?: string;
    strategy?: string;
    entry_reason?: string;
    exit_reason?: string;
    emotions?: string;
    mistakes?: string;
    screenshot_url?: string;
  }) => {
    if (!user || !accessToken) throw new Error('Authentication required');

    const res = await fetch('/api/journal/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(tradeData),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Order rejected by server');
    }

    if (data.state) {
      applyServerState(data.state);
    } else {
      await fetchServerState();
    }
    return data;
  };

  // Server-authoritative manual position close
  const closeTrade = async (tradeId: string) => {
    if (!user || !accessToken) throw new Error('Authentication required');

    const res = await fetch(`/api/journal/orders/${encodeURIComponent(tradeId)}/close`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      setEngineError(data.error || 'Unable to close trade');
      throw new Error(data.error || 'Unable to close trade');
    }

    if (data.state) {
      applyServerState(data.state);
    } else {
      await fetchServerState();
    }
  };

  const updateTradeJournal = async (
    tradeId: string,
    updates: {
      notes?: string;
      strategy?: string;
      entry_reason?: string;
      exit_reason?: string;
      emotions?: string;
      mistakes?: string;
      screenshot_url?: string;
    }
  ) => {
    if (!user || !accessToken) throw new Error('Authentication required');

    const res = await fetch(`/api/journal/orders/${encodeURIComponent(tradeId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(updates),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Unable to update journal entry');
    }

    if (data.state) {
      applyServerState(data.state);
    } else {
      await fetchServerState();
    }
    return data;
  };

  const deleteTrade = async (tradeId: string) => {
    if (!user || !accessToken) throw new Error('Authentication required');

    const res = await fetch(`/api/journal/orders/${encodeURIComponent(tradeId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Unable to delete trade');
    }

    if (data.state) {
      applyServerState(data.state);
    } else {
      await fetchServerState();
    }
  };

  return {
    trades: serverTrades,
    openTrades: liveComputed.openTrades,
    closedTrades: liveComputed.closedTrades,
    loading,
    engineError,
    serverProtected,
    startingCapital: serverStartingCapital,
    balance: serverBalance,
    equity: liveComputed.equity,
    floatingPnl: liveComputed.floatingPnl,
    marginUsed: liveComputed.marginUsed,
    freeMargin: liveComputed.freeMargin,
    marginLevel: liveComputed.marginLevel,
    stats: serverStats,
    autoCloseAlerts,
    dismissAlert: (index: number) => {
      setAutoCloseAlerts((prev) => prev.filter((_, i) => i !== index));
    },
    createTrade,
    closeTrade,
    updateTradeJournal,
    deleteTrade,
    refreshTrades: fetchServerState,
  };
}
