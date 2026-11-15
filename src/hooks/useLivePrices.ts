import { useState, useEffect, useCallback, useRef } from 'react';
import { SupportedSymbol } from '../lib/tradingMath';

export type FreshnessState =
  | 'live'
  | 'delayed'
  | 'stale'
  | 'market_closed'
  | 'disconnected'
  | 'unavailable';
export type ProviderStatus = 'ok' | 'rate_limited' | 'fallback' | 'error';

export interface MarketQuote {
  symbol: SupportedSymbol;
  displayName: string;
  marketType: string;
  instrument?: string;
  price: number;
  bid?: number;
  ask?: number;
  spread?: number;
  change24h: number;
  high24h: number;
  low24h: number;
  source: string;
  providerStatus: ProviderStatus;
  sourceTimestamp: string;
  fetchedAt: string;
  lastSuccessfulUpdate?: string;
  freshness: FreshnessState;
  isLive: boolean;
  isWebSocketStream?: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: string;
}

export interface SymbolQuoteError {
  message: string;
  isRateLimited: boolean;
}

function hasQuoteChanged(prev: MarketQuote | undefined, next: MarketQuote): boolean {
  if (!prev) return true;
  return (
    prev.price !== next.price ||
    prev.bid !== next.bid ||
    prev.ask !== next.ask ||
    prev.change24h !== next.change24h ||
    prev.freshness !== next.freshness ||
    prev.isLive !== next.isLive ||
    prev.source !== next.source ||
    prev.sourceTimestamp !== next.sourceTimestamp ||
    prev.fallbackUsed !== next.fallbackUsed
  );
}

export function useLivePrices() {
  const [prices, setPrices] = useState<Record<string, MarketQuote>>({});
  const [symbolErrors, setSymbolErrors] = useState<Record<string, SymbolQuoteError>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const reconnectAttemptsRef = useRef(0);
  const lastRestFetchMsRef = useRef(0);

  const fetchPrices = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRestFetchMsRef.current < 4000) return;
    lastRestFetchMsRef.current = now;

    try {
      const res = await fetch('/api/all-prices');
      if (res.status === 429) {
        setError('Market quotes rate limited. Retrying automatically.');
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      const incoming: Record<string, MarketQuote> = data.prices || {};

      setPrices((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [sym, q] of Object.entries(incoming)) {
          if (hasQuoteChanged(prev[sym], q)) {
            next[sym] = q;
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      setSymbolErrors(data.errors || {});
      setLastFetchedAt(data.fetchedAt || new Date().toISOString());
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Market quote feed unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  // Adaptive REST polling:
  // - Initial bootstrap on mount
  // - Slow 60s reconciliation when WS stream is active
  // - 15s polling only when WS is disconnected
  // - Pauses automatically when browser tab is hidden
  useEffect(() => {
    fetchPrices(true);

    const pollIntervalMs = wsConnected ? 60000 : 15000;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchPrices(false);
    }, pollIntervalMs);

    const handleVisibility = () => {
      if (!document.hidden && !wsConnected) {
        fetchPrices(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchPrices, wsConnected]);

  // Real-time WebSocket stream on /ws/market with clean exponential backoff
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer) return;
      const attempt = reconnectAttemptsRef.current;
      const delayMs = Math.min(15000, 2000 * Math.pow(1.6, attempt));
      reconnectAttemptsRef.current = Math.min(attempt + 1, 6);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (disposed) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/ws/market`;
        ws = new WebSocket(url);

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
          setWsConnected(true);
        };

        ws.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (payload.type === 'snapshot' && payload.prices) {
              const incoming: Record<string, MarketQuote> = payload.prices;
              setPrices((prev) => {
                let changed = false;
                const next = { ...prev };
                for (const [sym, q] of Object.entries(incoming)) {
                  if (hasQuoteChanged(prev[sym], q)) {
                    next[sym] = q;
                    changed = true;
                  }
                }
                return changed ? next : prev;
              });
              setLastFetchedAt(payload.timestamp || new Date().toISOString());
              setLoading(false);
            } else if (payload.type === 'quote' && payload.quote?.symbol) {
              const q: MarketQuote = payload.quote;
              setPrices((prev) => {
                if (!hasQuoteChanged(prev[q.symbol], q)) return prev;
                return { ...prev, [q.symbol]: q };
              });
              setSymbolErrors((prev) => {
                if (!prev[q.symbol]) return prev;
                const next = { ...prev };
                delete next[q.symbol];
                return next;
              });
              setLastFetchedAt(payload.timestamp || new Date().toISOString());
            }
          } catch {
            // ignore malformed frame
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          scheduleReconnect();
        };

        ws.onerror = () => {
          setWsConnected(false);
          try {
            ws?.close();
          } catch {
            // ignore
          }
        };
      } catch {
        setWsConnected(false);
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  const refreshPrices = useCallback(() => fetchPrices(true), [fetchPrices]);

  return {
    prices,
    symbolErrors,
    loading,
    error,
    lastFetchedAt,
    wsConnected,
    refreshPrices,
  };
}
