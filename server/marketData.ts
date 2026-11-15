import WebSocket from 'ws';
import {
  ALL_SUPPORTED_SYMBOLS,
  INSTRUMENT_SPECS,
  SupportedSymbol,
  SupportedTimeframe,
  roundPrice,
} from '../src/lib/tradingMath.js';

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type FreshnessState =
  | 'live'
  | 'delayed'
  | 'stale'
  | 'market_closed'
  | 'disconnected'
  | 'unavailable';
export type ProviderStatus = 'ok' | 'rate_limited' | 'fallback' | 'error';

export interface VerifiedQuote {
  symbol: SupportedSymbol;
  displayName: string;
  marketType: string;
  instrument: string;
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
  lastSuccessfulUpdate: string;
  freshness: FreshnessState;
  isLive: boolean;
  isWebSocketStream?: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  error?: string;
}

export interface VerifiedMarketDataResponse {
  symbol: SupportedSymbol;
  timeframe: SupportedTimeframe;
  displayName: string;
  marketType: string;
  instrument: string;
  source: string;
  providerStatus: ProviderStatus;
  sourceTimestamp: string;
  fetchedAt: string;
  lastSuccessfulUpdate: string;
  freshness: FreshnessState;
  isLive: boolean;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  timeframeNote?: string;
  quote: VerifiedQuote;
  candles: Candle[];
}

export interface CandleBundle {
  candles: Candle[];
  instrument: string;
  source: string;
  providerStatus: ProviderStatus;
  sourceTimestamp: string;
  lastSuccessfulUpdate: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  timeframeNote?: string;
}

interface CacheEntry<T> {
  data: T;
  fetchedAtMs: number;
}

const quoteCache = new Map<string, CacheEntry<VerifiedQuote>>();
const lastGoodQuoteCache = new Map<string, CacheEntry<VerifiedQuote>>();
const candleCache = new Map<string, CacheEntry<CandleBundle>>();
const lastGoodCandleCache = new Map<string, CacheEntry<CandleBundle>>();

// Single-flight promise coalescing to eliminate duplicate simultaneous upstream requests
const inFlightQuotes = new Map<string, Promise<VerifiedQuote>>();
const inFlightCandles = new Map<string, Promise<CandleBundle>>();

const QUOTE_CACHE_TTL_MS = 10 * 1000; // 10 seconds
const CANDLE_TTL_BY_TF: Record<SupportedTimeframe, number> = {
  M5: 120 * 1000,   // 2 minutes
  M15: 120 * 1000,  // 2 minutes
  H1: 300 * 1000,   // 5 minutes
  H4: 600 * 1000,   // 10 minutes
  D1: 900 * 1000,   // 15 minutes
  W1: 1800 * 1000,  // 30 minutes
  MN: 1800 * 1000,  // 30 minutes
};
const REQUEST_TIMEOUT_MS = 8000;

// Twelve Data quota manager (protects 8 credits/min plans against burst rate limits)
const TWELVE_DATA_WINDOW_MS = 60 * 1000;
const TWELVE_DATA_MAX_PER_WINDOW = 6;
const TWELVE_DATA_COOLDOWN_MS = 65 * 1000;
let twelveDataCooldownUntil = 0;
let twelveDataLastCooldownLogAt = 0;
const twelveDataCallTimestamps: number[] = [];

function canUseTwelveData(): { allowed: boolean; reason?: string } {
  const now = Date.now();
  if (now < twelveDataCooldownUntil) {
    const waitSec = Math.ceil((twelveDataCooldownUntil - now) / 1000);
    return { allowed: false, reason: `Twelve Data rate-limit cooldown active (${waitSec}s remaining)` };
  }
  while (twelveDataCallTimestamps.length > 0 && now - twelveDataCallTimestamps[0] >= TWELVE_DATA_WINDOW_MS) {
    twelveDataCallTimestamps.shift();
  }
  if (twelveDataCallTimestamps.length >= TWELVE_DATA_MAX_PER_WINDOW) {
    return { allowed: false, reason: 'Twelve Data local per-minute quota guard reached' };
  }
  return { allowed: true };
}

function recordTwelveDataAttempt() {
  twelveDataCallTimestamps.push(Date.now());
}

function triggerTwelveDataCooldown(reason: string) {
  const now = Date.now();
  twelveDataCooldownUntil = now + TWELVE_DATA_COOLDOWN_MS;
  if (now - twelveDataLastCooldownLogAt > 30000) {
    twelveDataLastCooldownLogAt = now;
    console.warn(`Twelve Data XAU/USD fallback to GoldBroker (${TWELVE_DATA_COOLDOWN_MS / 1000}s cooldown): ${reason}`);
  }
}

export function computeFreshness(
  sourceTimestampIso: string,
  symbol: SupportedSymbol,
  options?: { fallbackUsed?: boolean; forcedStale?: boolean }
): { freshness: FreshnessState; isLive: boolean } {
  const tsMs = new Date(sourceTimestampIso).getTime();
  if (!Number.isFinite(tsMs)) {
    return { freshness: 'unavailable', isLive: false };
  }

  const ageSec = (Date.now() - tsMs) / 1000;
  const nowDate = new Date();
  const dayUtc = nowDate.getUTCDay();
  const hourUtc = nowDate.getUTCHours();

  // Traditional FX/Commodity/Index markets are closed from Fri ~22:00 UTC through Sun ~22:00 UTC
  const isTraditionalWeekend =
    dayUtc === 6 || (dayUtc === 0 && hourUtc < 22) || (dayUtc === 5 && hourUtc >= 22);

  if (options?.forcedStale) {
    if (symbol !== 'BTCUSD' && isTraditionalWeekend) {
      return { freshness: 'market_closed', isLive: false };
    }
    return { freshness: 'stale', isLive: false };
  }

  // Fallback data is NEVER marked LIVE
  if (options?.fallbackUsed) {
    if (symbol !== 'BTCUSD' && (isTraditionalWeekend || ageSec > 1800)) {
      return { freshness: ageSec > 1800 && !isTraditionalWeekend ? 'stale' : 'market_closed', isLive: false };
    }
    if (ageSec <= 900) {
      return { freshness: 'delayed', isLive: false };
    }
    return { freshness: 'stale', isLive: false };
  }

  // Weekend traditional feeds (including providers that echo weekend timestamps) are market_closed
  if (symbol !== 'BTCUSD' && isTraditionalWeekend) {
    return { freshness: 'market_closed', isLive: false };
  }

  if (ageSec <= 120) {
    return { freshness: 'live', isLive: true };
  }
  if (ageSec <= 900) {
    return { freshness: 'delayed', isLive: false };
  }
  if (symbol !== 'BTCUSD' && ageSec > 1800) {
    return { freshness: 'market_closed', isLive: false };
  }
  return { freshness: 'stale', isLive: false };
}

function validateXAUUSDSpotPrice(price: number, timestampIso?: string): string | null {
  if (!Number.isFinite(price) || price < 800 || price > 15000) {
    return `Out-of-range XAU/USD spot price (${price})`;
  }
  if (timestampIso) {
    const ts = new Date(timestampIso).getTime();
    if (!Number.isFinite(ts) || ts > Date.now() + 5 * 60 * 1000) {
      return `Invalid XAU/USD spot timestamp (${timestampIso})`;
    }
  }
  return null;
}

function assertValidXAUUSDSpotPrice(price: number, timestampIso?: string) {
  const err = validateXAUUSDSpotPrice(price, timestampIso);
  if (err) throw new Error(err);

  const prev = lastGoodQuoteCache.get('XAUUSD');
  if (prev && Date.now() - prev.fetchedAtMs < 24 * 3600 * 1000 && prev.data.price > 0) {
    const dev = Math.abs(price - prev.data.price) / prev.data.price;
    if (dev > 0.15) {
      throw new Error(
        `Rejected anomalous XAU/USD fallback price ${price} (>15% deviation from verified spot ${prev.data.price})`
      );
    }
  }
}

function validateCandleSeries(candles: Candle[], symbol: SupportedSymbol): Candle[] {
  const valid = candles.filter(
    (c) =>
      Number.isFinite(c.time) &&
      c.time > 0 &&
      c.time <= Math.floor(Date.now() / 1000) + 86400 &&
      Number.isFinite(c.open) &&
      Number.isFinite(c.high) &&
      Number.isFinite(c.low) &&
      Number.isFinite(c.close) &&
      c.open > 0 &&
      c.high >= c.low &&
      c.close > 0 &&
      (symbol !== 'XAUUSD' || (c.close >= 800 && c.close <= 15000))
  );
  if (valid.length === 0) {
    throw new Error(`No valid OHLC candles returned for ${symbol}`);
  }
  return valid;
}

function finalizeBar(bar: Candle, decimals: number): Candle {
  const f = Math.pow(10, decimals);
  return {
    time: bar.time,
    open: Math.round(bar.open * f) / f,
    high: Math.round(bar.high * f) / f,
    low: Math.round(bar.low * f) / f,
    close: Math.round(bar.close * f) / f,
    volume: Math.round(bar.volume * 100) / 100,
  };
}

function resampleCandles(candles: Candle[], blockSeconds: number, decimals: number): Candle[] {
  if (candles.length === 0) return [];
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const resampled: Candle[] = [];

  let currentBlock = Math.floor(sorted[0].time / blockSeconds) * blockSeconds;
  let bar: Candle = {
    time: currentBlock,
    open: sorted[0].open,
    high: sorted[0].high,
    low: sorted[0].low,
    close: sorted[0].close,
    volume: sorted[0].volume,
  };

  for (let i = 1; i < sorted.length; i++) {
    const c = sorted[i];
    const block = Math.floor(c.time / blockSeconds) * blockSeconds;
    if (block === currentBlock) {
      bar.high = Math.max(bar.high, c.high);
      bar.low = Math.min(bar.low, c.low);
      bar.close = c.close;
      bar.volume += c.volume;
    } else {
      resampled.push(finalizeBar(bar, decimals));
      currentBlock = block;
      bar = {
        time: currentBlock,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      };
    }
  }
  resampled.push(finalizeBar(bar, decimals));
  return resampled;
}

function resampleDailyToCalendar(candles: Candle[], period: 'W1' | 'MN', decimals: number): Candle[] {
  if (candles.length === 0) return [];
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const buckets = new Map<string, Candle>();

  for (const c of sorted) {
    const d = new Date(c.time * 1000);
    let keyTimeSec: number;
    if (period === 'MN') {
      keyTimeSec = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000);
    } else {
      const day = d.getUTCDay(); // 0 Sun .. 6 Sat
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday));
      keyTimeSec = Math.floor(monday.getTime() / 1000);
    }

    const key = String(keyTimeSec);
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        time: keyTimeSec,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      });
    } else {
      existing.high = Math.max(existing.high, c.high);
      existing.low = Math.min(existing.low, c.low);
      existing.close = c.close;
      existing.volume += c.volume;
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map((b) => finalizeBar(b, decimals));
}

class RateLimitError extends Error {
  isRateLimited = true;
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// ADAPTER 1: TWELVE DATA (Authenticated adapter when TWELVE_DATA_API_KEY set)
// ============================================================================
async function fetchTwelveDataCandles(
  twelveSymbol: string,
  symbol: SupportedSymbol,
  timeframe: SupportedTimeframe,
  apiKey: string
): Promise<CandleBundle> {
  const gate = canUseTwelveData();
  if (!gate.allowed) {
    throw new RateLimitError(gate.reason || 'Twelve Data quota guard');
  }

  const intervalMap: Record<SupportedTimeframe, string> = {
    M5: '5min',
    M15: '15min',
    H1: '1h',
    H4: '4h',
    D1: '1day',
    W1: '1week',
    MN: '1month',
  };

  recordTwelveDataAttempt();
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(
    twelveSymbol
  )}&interval=${intervalMap[timeframe]}&outputsize=240&timezone=UTC&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (res.status === 429) {
    triggerTwelveDataCooldown('Twelve Data rate limit reached');
    throw new RateLimitError('Twelve Data rate limit reached');
  }
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);

  const json: any = await res.json();
  if (json.status === 'error') {
    if (json.code === 429 || (json.message && json.message.toLowerCase().includes('credit'))) {
      triggerTwelveDataCooldown(json.message || 'Twelve Data credit limit reached');
      throw new RateLimitError(json.message);
    }
    throw new Error(json.message || 'Twelve Data error');
  }

  if (!Array.isArray(json.values) || json.values.length === 0) {
    throw new Error('Twelve Data returned empty series');
  }

  const parsed: Candle[] = json.values
    .map((v: any) => ({
      time: Math.floor(
        new Date(v.datetime.includes('T') ? v.datetime : v.datetime.replace(' ', 'T') + 'Z').getTime() / 1000
      ),
      open: roundPrice(parseFloat(v.open), symbol),
      high: roundPrice(parseFloat(v.high), symbol),
      low: roundPrice(parseFloat(v.low), symbol),
      close: roundPrice(parseFloat(v.close), symbol),
      volume: v.volume ? parseFloat(v.volume) : 0,
    }))
    .reverse();

  const candles = validateCandleSeries(parsed, symbol);
  const latest = candles[candles.length - 1];
  const tsIso = new Date(latest.time * 1000).toISOString();

  return {
    candles,
    instrument: twelveSymbol,
    source: `Twelve Data (${twelveSymbol})`,
    providerStatus: 'ok',
    sourceTimestamp: tsIso,
    lastSuccessfulUpdate: new Date().toISOString(),
    fallbackUsed: false,
  };
}

// ============================================================================
// ADAPTER 2: BTCUSD -> GENUINE BTC/USD SPOT (Coinbase Exchange + Kraken + Yahoo BTC-USD for W1/MN)
// ============================================================================
async function fetchCoinbaseBTCUSD(
  timeframe: SupportedTimeframe
): Promise<CandleBundle> {
  if (timeframe === 'W1' || timeframe === 'MN') {
    return fetchYahooExactCandles(
      'BTC-USD',
      'BTCUSD',
      timeframe,
      `Yahoo Finance (BTC-USD Spot ${timeframe})`
    );
  }

  const granMap: Record<string, number> = {
    M5: 300,
    M15: 900,
    H1: 3600,
    H4: 3600,
    D1: 86400,
  };

  const url = `https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${granMap[timeframe]}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'YOUNEEL-TRADING/2.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 429) throw new RateLimitError('Coinbase rate limit reached');
  if (!res.ok) throw new Error(`Coinbase HTTP ${res.status}`);

  const raw: any[] = await res.json();
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Coinbase returned empty candles');
  }

  let candles: Candle[] = raw
    .map((k) => ({
      time: Number(k[0]),
      low: roundPrice(Number(k[1]), 'BTCUSD'),
      high: roundPrice(Number(k[2]), 'BTCUSD'),
      open: roundPrice(Number(k[3]), 'BTCUSD'),
      close: roundPrice(Number(k[4]), 'BTCUSD'),
      volume: Number(k[5]) || 0,
    }))
    .sort((a, b) => a.time - b.time);

  if (timeframe === 'H4') {
    candles = resampleCandles(candles, 4 * 3600, INSTRUMENT_SPECS.BTCUSD.decimals);
  }

  candles = validateCandleSeries(candles.slice(-260), 'BTCUSD');
  const latest = candles[candles.length - 1];

  return {
    candles,
    instrument: 'BTC-USD',
    source: 'Coinbase Exchange (BTC-USD Spot)',
    providerStatus: 'ok',
    sourceTimestamp: new Date(latest.time * 1000).toISOString(),
    lastSuccessfulUpdate: new Date().toISOString(),
    fallbackUsed: false,
  };
}

async function fetchKrakenBTCUSD(
  timeframe: SupportedTimeframe,
  fallbackReason?: string
): Promise<CandleBundle> {
  const intervalMap: Record<SupportedTimeframe, number> = {
    M5: 5,
    M15: 15,
    H1: 60,
    H4: 240,
    D1: 1440,
    W1: 10080,
    MN: 21600,
  };

  const url = `https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=${intervalMap[timeframe]}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (res.status === 429) throw new RateLimitError('Kraken rate limit reached');
  if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);

  const json: any = await res.json();
  if (json.error && json.error.length > 0) {
    throw new Error(json.error.join(', '));
  }
  const rows: any[] = json.result?.XXBTZUSD || [];
  if (rows.length === 0) throw new Error('Kraken returned empty OHLC');

  const parsed: Candle[] = rows.slice(-260).map((r) => ({
    time: Number(r[0]),
    open: roundPrice(parseFloat(r[1]), 'BTCUSD'),
    high: roundPrice(parseFloat(r[2]), 'BTCUSD'),
    low: roundPrice(parseFloat(r[3]), 'BTCUSD'),
    close: roundPrice(parseFloat(r[4]), 'BTCUSD'),
    volume: parseFloat(r[6]) || 0,
  }));

  const candles = validateCandleSeries(parsed, 'BTCUSD');
  const latest = candles[candles.length - 1];
  return {
    candles,
    instrument: 'XBT/USD',
    source: 'Kraken Spot (XBT/USD)',
    providerStatus: fallbackReason ? 'fallback' : 'ok',
    sourceTimestamp: new Date(latest.time * 1000).toISOString(),
    lastSuccessfulUpdate: new Date().toISOString(),
    fallbackUsed: Boolean(fallbackReason),
    fallbackReason,
  };
}

async function fetchBTCUSDQuote(): Promise<VerifiedQuote> {
  let primaryError: string | undefined;
  try {
    const [tickerRes, statsRes] = await Promise.all([
      fetch('https://api.exchange.coinbase.com/products/BTC-USD/ticker', {
        headers: { 'User-Agent': 'YOUNEEL-TRADING/2.0' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }),
      fetch('https://api.exchange.coinbase.com/products/BTC-USD/stats', {
        headers: { 'User-Agent': 'YOUNEEL-TRADING/2.0' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }),
    ]);

    if (tickerRes.status === 429) throw new RateLimitError('Coinbase ticker rate limited');
    if (tickerRes.ok) {
      const ticker: any = await tickerRes.json();
      const stats: any = statsRes.ok ? await statsRes.json() : {};
      const price = roundPrice(parseFloat(ticker.price), 'BTCUSD');
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Coinbase returned invalid BTC-USD price');
      }
      const bid = roundPrice(parseFloat(ticker.bid), 'BTCUSD');
      const ask = roundPrice(parseFloat(ticker.ask), 'BTCUSD');
      const spread = Number.isFinite(bid) && Number.isFinite(ask) ? roundPrice(ask - bid, 'BTCUSD') : undefined;
      const open24h = parseFloat(stats.open) || price;
      const high24h = roundPrice(parseFloat(stats.high) || price, 'BTCUSD');
      const low24h = roundPrice(parseFloat(stats.low) || price, 'BTCUSD');
      const change24h = open24h > 0 ? Number((((price - open24h) / open24h) * 100).toFixed(2)) : 0;
      const sourceTimestamp = ticker.time || new Date().toISOString();
      const nowIso = new Date().toISOString();
      const { freshness, isLive } = computeFreshness(sourceTimestamp, 'BTCUSD');

      return {
        symbol: 'BTCUSD',
        displayName: INSTRUMENT_SPECS.BTCUSD.displayName,
        marketType: INSTRUMENT_SPECS.BTCUSD.marketType,
        instrument: 'BTC-USD',
        price,
        bid,
        ask,
        spread,
        change24h,
        high24h,
        low24h,
        source: 'Coinbase Exchange (BTC-USD Spot)',
        providerStatus: 'ok',
        sourceTimestamp,
        fetchedAt: nowIso,
        lastSuccessfulUpdate: nowIso,
        freshness,
        isLive,
        fallbackUsed: false,
      };
    }
    primaryError = `Coinbase HTTP ${tickerRes.status}`;
  } catch (err: any) {
    primaryError = err?.message || 'Coinbase unavailable';
  }

  const krRes = await fetch('https://api.kraken.com/0/public/Ticker?pair=XBTUSD', {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (krRes.status === 429) throw new RateLimitError('Kraken rate limited');
  if (!krRes.ok) throw new Error(`Kraken Ticker HTTP ${krRes.status}`);
  const krJson: any = await krRes.json();
  const pairData = krJson.result?.XXBTZUSD;
  if (!pairData) throw new Error('Kraken ticker unavailable');

  const price = roundPrice(parseFloat(pairData.c[0]), 'BTCUSD');
  if (!Number.isFinite(price) || price <= 0) throw new Error('Kraken returned invalid XBT/USD price');
  const bid = roundPrice(parseFloat(pairData.b[0]), 'BTCUSD');
  const ask = roundPrice(parseFloat(pairData.a[0]), 'BTCUSD');
  const spread = Number.isFinite(bid) && Number.isFinite(ask) ? roundPrice(ask - bid, 'BTCUSD') : undefined;
  const open24h = parseFloat(pairData.o) || price;
  const high24h = roundPrice(parseFloat(pairData.h[1]), 'BTCUSD');
  const low24h = roundPrice(parseFloat(pairData.l[1]), 'BTCUSD');
  const change24h = open24h > 0 ? Number((((price - open24h) / open24h) * 100).toFixed(2)) : 0;
  const sourceTimestamp = new Date().toISOString();
  const fallbackReason = primaryError ? `Coinbase unavailable (${primaryError}); using Kraken Spot (XBT/USD)` : undefined;
  const { freshness, isLive } = computeFreshness(sourceTimestamp, 'BTCUSD', {
    fallbackUsed: Boolean(fallbackReason),
  });

  return {
    symbol: 'BTCUSD',
    displayName: INSTRUMENT_SPECS.BTCUSD.displayName,
    marketType: INSTRUMENT_SPECS.BTCUSD.marketType,
    instrument: 'XBT/USD',
    price,
    bid,
    ask,
    spread,
    change24h,
    high24h,
    low24h,
    source: 'Kraken Spot (XBT/USD)',
    providerStatus: fallbackReason ? 'fallback' : 'ok',
    sourceTimestamp,
    fetchedAt: sourceTimestamp,
    lastSuccessfulUpdate: sourceTimestamp,
    freshness,
    isLive,
    fallbackUsed: Boolean(fallbackReason),
    fallbackReason,
  };
}

// ============================================================================
// ADAPTER 3: XAUUSD -> GENUINE XAU/USD GOLD SPOT (Twelve Data -> GoldBroker / Gold-API)
// ============================================================================
async function fetchGoldBrokerSpotTicks(period: '1d' | '5d' = '5d'): Promise<{
  ticks: { time: number; price: number; bid: number; ask: number }[];
  sourceTimestamp: string;
}> {
  const url = `https://www.goldbroker.com/api/spot-prices?currency=USD&metal=XAU&period=${period}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 429) throw new RateLimitError('GoldBroker rate limited');
  if (!res.ok) throw new Error(`GoldBroker HTTP ${res.status}`);

  const json: any = await res.json();
  const items: any[] = json?._embedded?.items || [];
  if (items.length === 0) throw new Error('GoldBroker returned empty spot items');

  const nowSec = Math.floor(Date.now() / 1000);
  const ticks = items
    .map((it) => ({
      time: Math.floor(new Date(it.date).getTime() / 1000),
      price: Number(it.mid ?? it.value),
      bid: Number(it.bid ?? it.value),
      ask: Number(it.ask ?? it.value),
    }))
    .filter(
      (t) =>
        Number.isFinite(t.time) &&
        t.time > 0 &&
        t.time <= nowSec + 300 &&
        Number.isFinite(t.price) &&
        t.price >= 800 &&
        t.price <= 15000
    )
    .sort((a, b) => a.time - b.time);

  if (ticks.length === 0) {
    throw new Error('GoldBroker returned no valid XAU/USD spot ticks');
  }

  const latestTick = ticks[ticks.length - 1];
  const latestIso = new Date(latestTick.time * 1000).toISOString();
  assertValidXAUUSDSpotPrice(latestTick.price, latestIso);

  return {
    ticks,
    sourceTimestamp: latestIso,
  };
}

async function fetchXAUUSDSpotCandles(
  timeframe: SupportedTimeframe
): Promise<CandleBundle> {
  const twelveKey = (process.env.TWELVE_DATA_API_KEY || process.env.MARKET_DATA_API_KEY)?.trim();
  let twelveFailureReason: string | undefined;

  // Higher timeframes (D1, W1, MN) use GoldBroker 10y XAU/USD spot history natively,
  // conserving Twelve Data credits for intraday XAU/USD bars (M5/M15/H1/H4).
  const isIntraday = timeframe === 'M5' || timeframe === 'M15' || timeframe === 'H1' || timeframe === 'H4';

  if (twelveKey && isIntraday) {
    try {
      return await fetchTwelveDataCandles('XAU/USD', 'XAUUSD', timeframe, twelveKey);
    } catch (err: any) {
      const reason = String(err?.message || 'Twelve Data XAU/USD unavailable');
      twelveFailureReason = reason;
      if (err instanceof RateLimitError) {
        triggerTwelveDataCooldown(reason);
      } else {
        console.warn(`Twelve Data XAU/USD fallback to GoldBroker:`, reason);
      }
    }
  }

  // Higher timeframes (D1, W1, MN): GoldBroker Historical Spot OHLC + today's intraday spot bar
  if (timeframe === 'D1' || timeframe === 'W1' || timeframe === 'MN') {
    const histUrl = 'https://www.goldbroker.com/api/historical-spot-prices?currency=USD&metal=XAU';
    const [histRes, intraday] = await Promise.all([
      fetch(histUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }),
      fetchGoldBrokerSpotTicks('1d').catch(() => null),
    ]);

    if (histRes.status === 429) throw new RateLimitError('GoldBroker historical rate limited');
    if (!histRes.ok) throw new Error(`GoldBroker historical HTTP ${histRes.status}`);

    const histJson: any = await histRes.json();
    const items: any[] = histJson?._embedded?.items || [];
    if (items.length === 0) throw new Error('GoldBroker historical returned no spot bars');

    const dailyCandles = validateCandleSeries(
      items.slice(-3650).map((it) => ({
        time: Math.floor(new Date(`${it.date}T00:00:00Z`).getTime() / 1000),
        open: roundPrice(parseFloat(it.open), 'XAUUSD'),
        high: roundPrice(parseFloat(it.high), 'XAUUSD'),
        low: roundPrice(parseFloat(it.low), 'XAUUSD'),
        close: roundPrice(parseFloat(it.close), 'XAUUSD'),
        volume: 0,
      })),
      'XAUUSD'
    );

    let sourceTimestamp = new Date(dailyCandles[dailyCandles.length - 1].time * 1000).toISOString();

    if (intraday && intraday.ticks.length > 0) {
      const latestTick = intraday.ticks[intraday.ticks.length - 1];
      const todayDaySec = Math.floor(latestTick.time / 86400) * 86400;
      const lastDailySec = dailyCandles[dailyCandles.length - 1].time;
      const todayTicks = intraday.ticks.filter((t) => Math.floor(t.time / 86400) * 86400 === todayDaySec);
      const tickSet = todayTicks.length > 0 ? todayTicks : intraday.ticks;

      const todayBar: Candle = {
        time: todayDaySec,
        open: roundPrice(tickSet[0].price, 'XAUUSD'),
        high: roundPrice(Math.max(...tickSet.map((t) => t.price)), 'XAUUSD'),
        low: roundPrice(Math.min(...tickSet.map((t) => t.price)), 'XAUUSD'),
        close: roundPrice(tickSet[tickSet.length - 1].price, 'XAUUSD'),
        volume: 0,
      };

      if (todayDaySec > lastDailySec) {
        dailyCandles.push(todayBar);
      } else if (todayDaySec === lastDailySec) {
        dailyCandles[dailyCandles.length - 1] = todayBar;
      }
      sourceTimestamp = intraday.sourceTimestamp;
    }

    const nowIso = new Date().toISOString();
    if (timeframe === 'D1') {
      return {
        candles: dailyCandles.slice(-260),
        instrument: 'XAU/USD',
        source: 'GoldBroker Spot (XAU/USD Daily + Live Spot)',
        providerStatus: 'ok',
        sourceTimestamp,
        lastSuccessfulUpdate: nowIso,
        fallbackUsed: false,
      };
    }
    if (timeframe === 'W1') {
      const weekly = resampleDailyToCalendar(dailyCandles, 'W1', 2).slice(-260);
      return {
        candles: weekly,
        instrument: 'XAU/USD',
        source: 'GoldBroker Spot (XAU/USD Weekly Resampled)',
        providerStatus: 'ok',
        sourceTimestamp,
        lastSuccessfulUpdate: nowIso,
        fallbackUsed: false,
      };
    }
    const monthly = resampleDailyToCalendar(dailyCandles, 'MN', 2).slice(-120);
    return {
      candles: monthly,
      instrument: 'XAU/USD',
      source: 'GoldBroker Spot (XAU/USD Monthly Resampled)',
      providerStatus: 'ok',
      sourceTimestamp,
      lastSuccessfulUpdate: nowIso,
      fallbackUsed: false,
    };
  }

  // Intraday M5 / M15 / H1 / H4 fallback from validated GoldBroker 5-day XAU/USD spot feed
  const { ticks, sourceTimestamp } = await fetchGoldBrokerSpotTicks('5d');
  const rawBars: Candle[] = ticks.map((t) => ({
    time: t.time,
    open: t.price,
    high: t.price,
    low: t.price,
    close: t.price,
    volume: 0,
  }));

  const blockSec =
    timeframe === 'M5' ? 300 : timeframe === 'M15' ? 900 : timeframe === 'H1' ? 3600 : 14400;
  const resampled = validateCandleSeries(resampleCandles(rawBars, blockSec, 2), 'XAUUSD');

  const isCooldownOrLimited =
    Boolean(twelveFailureReason?.toLowerCase().includes('rate') || twelveFailureReason?.toLowerCase().includes('cooldown') || twelveFailureReason?.toLowerCase().includes('credit') || twelveFailureReason?.toLowerCase().includes('quota'));

  const fallbackUsed = Boolean(twelveKey);
  const fallbackReason = fallbackUsed
    ? `Twelve Data XAU/USD fallback to GoldBroker Spot: ${twelveFailureReason || 'rate limit guard'}`
    : undefined;

  const timeframeNote = fallbackUsed
    ? `${fallbackReason} (${resampled.length} verified GoldBroker XAU/USD ${timeframe} bars).`
    : resampled.length < 30
    ? `GoldBroker intraday feed currently returns ${resampled.length} ${timeframe} bars. Configure TWELVE_DATA_API_KEY for extended intraday history.`
    : undefined;

  return {
    candles: resampled.slice(-240),
    instrument: 'XAU/USD',
    source: 'GoldBroker Spot (XAU/USD Intraday Feed)',
    providerStatus: isCooldownOrLimited ? 'rate_limited' : fallbackUsed ? 'fallback' : 'ok',
    sourceTimestamp,
    lastSuccessfulUpdate: new Date().toISOString(),
    fallbackUsed,
    fallbackReason,
    timeframeNote,
  };
}

async function fetchXAUUSDQuote(): Promise<VerifiedQuote> {
  let goldBrokerErr: string | undefined;
  try {
    const { ticks, sourceTimestamp } = await fetchGoldBrokerSpotTicks('1d');
    const latest = ticks[ticks.length - 1];
    const first = ticks[0];
    const price = roundPrice(latest.price, 'XAUUSD');
    const bid = roundPrice(latest.bid, 'XAUUSD');
    const ask = roundPrice(latest.ask, 'XAUUSD');
    const spread = roundPrice(Math.max(0, ask - bid), 'XAUUSD');
    const high24h = roundPrice(Math.max(...ticks.map((t) => t.price)), 'XAUUSD');
    const low24h = roundPrice(Math.min(...ticks.map((t) => t.price)), 'XAUUSD');
    const change24h = first.price > 0 ? Number((((latest.price - first.price) / first.price) * 100).toFixed(2)) : 0;
    const nowIso = new Date().toISOString();
    const { freshness, isLive } = computeFreshness(sourceTimestamp, 'XAUUSD');

    return {
      symbol: 'XAUUSD',
      displayName: INSTRUMENT_SPECS.XAUUSD.displayName,
      marketType: INSTRUMENT_SPECS.XAUUSD.marketType,
      instrument: 'XAU/USD',
      price,
      bid,
      ask,
      spread,
      change24h,
      high24h,
      low24h,
      source: 'GoldBroker Spot (XAU/USD)',
      providerStatus: 'ok',
      sourceTimestamp,
      fetchedAt: nowIso,
      lastSuccessfulUpdate: nowIso,
      freshness,
      isLive,
      fallbackUsed: false,
    };
  } catch (err: any) {
    goldBrokerErr = err?.message || 'GoldBroker unavailable';
  }

  const res = await fetch('https://api.gold-api.com/price/XAU', {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 429) throw new RateLimitError('Gold-API rate limited');
  if (!res.ok) throw new Error(`Gold-API HTTP ${res.status}`);

  const json: any = await res.json();
  const price = roundPrice(parseFloat(json.price), 'XAUUSD');
  const sourceTimestamp = json.updatedAt || new Date().toISOString();
  assertValidXAUUSDSpotPrice(price, sourceTimestamp);

  const fallbackReason = `GoldBroker XAU/USD quote fallback to Gold-API Spot: ${goldBrokerErr}`;
  const nowIso = new Date().toISOString();
  const { freshness, isLive } = computeFreshness(sourceTimestamp, 'XAUUSD', { fallbackUsed: true });

  return {
    symbol: 'XAUUSD',
    displayName: INSTRUMENT_SPECS.XAUUSD.displayName,
    marketType: INSTRUMENT_SPECS.XAUUSD.marketType,
    instrument: 'XAU/USD',
    price,
    change24h: 0,
    high24h: price,
    low24h: price,
    source: 'Gold-API Spot (XAU/USD)',
    providerStatus: 'fallback',
    sourceTimestamp,
    fetchedAt: nowIso,
    lastSuccessfulUpdate: nowIso,
    freshness,
    isLive, // strictly false on fallback
    fallbackUsed: true,
    fallbackReason,
  };
}

// ============================================================================
// ADAPTER 4: YAHOO FINANCE / TWELVE DATA EXACT SYMBOL MAP
// Supports: NASDAQ (^NDX), US30 (^DJI), EURUSD (EURUSD=X), GBPUSD (GBPUSD=X),
//           USDJPY (USDJPY=X), USOIL (CL=F WTI Crude Benchmark)
// ============================================================================
const YAHOO_SYMBOL_CONFIG: Record<
  Exclude<SupportedSymbol, 'XAUUSD' | 'BTCUSD'>,
  { yahooTicker: string; twelveSymbol: string; label: string }
> = {
  NASDAQ: {
    yahooTicker: '%5ENDX',
    twelveSymbol: 'NDX',
    label: 'Yahoo Finance (^NDX NASDAQ-100)',
  },
  US30: {
    yahooTicker: '%5EDJI',
    twelveSymbol: 'DJI',
    label: 'Yahoo Finance (^DJI Dow Jones 30)',
  },
  EURUSD: {
    yahooTicker: 'EURUSD=X',
    twelveSymbol: 'EUR/USD',
    label: 'Yahoo Finance (EURUSD=X Spot FX)',
  },
  GBPUSD: {
    yahooTicker: 'GBPUSD=X',
    twelveSymbol: 'GBP/USD',
    label: 'Yahoo Finance (GBPUSD=X Spot FX)',
  },
  USDJPY: {
    yahooTicker: 'USDJPY=X',
    twelveSymbol: 'USD/JPY',
    label: 'Yahoo Finance (USDJPY=X Spot FX)',
  },
  USOIL: {
    yahooTicker: 'CL=F',
    twelveSymbol: 'WTI/USD',
    label: 'Yahoo Finance (CL=F WTI Crude Benchmark)',
  },
};

async function fetchYahooExactCandles(
  yahooTicker: string,
  symbol: SupportedSymbol,
  timeframe: SupportedTimeframe,
  sourceLabel: string
): Promise<CandleBundle> {
  const intervalMap: Record<SupportedTimeframe, { interval: string; range: string }> = {
    M5: { interval: '5m', range: '5d' },
    M15: { interval: '15m', range: '5d' },
    H1: { interval: '60m', range: '1mo' },
    H4: { interval: '60m', range: '3mo' },
    D1: { interval: '1d', range: '2y' },
    W1: { interval: '1wk', range: '5y' },
    MN: { interval: '1mo', range: '10y' },
  };

  const { interval, range } = intervalMap[timeframe];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=${interval}&range=${range}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 429) throw new RateLimitError(`Yahoo Finance rate limited for ${symbol}`);
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);

  const json: any = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result || !Array.isArray(result.timestamp) || !result.indicators?.quote?.[0]) {
    throw new Error(`Invalid upstream series for ${yahooTicker}`);
  }

  const timestamps: number[] = result.timestamp;
  const q = result.indicators.quote[0];
  const rawCandles: Candle[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (o != null && h != null && l != null && c != null && Number.isFinite(o) && Number.isFinite(c)) {
      rawCandles.push({
        time: timestamps[i],
        open: roundPrice(o, symbol),
        high: roundPrice(h, symbol),
        low: roundPrice(l, symbol),
        close: roundPrice(c, symbol),
        volume: q.volume?.[i] ?? 0,
      });
    }
  }

  const validated = validateCandleSeries(rawCandles, symbol);
  const finalCandles =
    timeframe === 'H4'
      ? resampleCandles(validated, 4 * 3600, INSTRUMENT_SPECS[symbol].decimals).slice(-240)
      : validated.slice(-260);

  const regularTimeSec = result.meta?.regularMarketTime;
  const latestCandleSec = finalCandles[finalCandles.length - 1].time;
  const sourceTs = regularTimeSec
    ? new Date(Math.max(regularTimeSec, latestCandleSec) * 1000).toISOString()
    : new Date(latestCandleSec * 1000).toISOString();

  return {
    candles: finalCandles,
    instrument: decodeURIComponent(yahooTicker),
    source: sourceLabel,
    providerStatus: 'ok',
    sourceTimestamp: sourceTs,
    lastSuccessfulUpdate: new Date().toISOString(),
    fallbackUsed: false,
  };
}

async function fetchYahooExactQuote(
  yahooTicker: string,
  symbol: SupportedSymbol,
  sourceLabel: string
): Promise<VerifiedQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?interval=15m&range=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (res.status === 429) throw new RateLimitError(`Yahoo Finance rate limited for ${symbol}`);
  if (!res.ok) throw new Error(`Yahoo Finance HTTP ${res.status}`);

  const json: any = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || !Number.isFinite(meta.regularMarketPrice)) {
    throw new Error(`Missing verified price for ${yahooTicker}`);
  }

  const price = roundPrice(meta.regularMarketPrice, symbol);
  const prevClose = meta.chartPreviousClose || meta.previousClose || price;
  const change24h = prevClose > 0 ? Number((((price - prevClose) / prevClose) * 100).toFixed(2)) : 0;

  const q = result.indicators?.quote?.[0];
  const highs: number[] = (q?.high || []).filter((n: any) => typeof n === 'number' && Number.isFinite(n));
  const lows: number[] = (q?.low || []).filter((n: any) => typeof n === 'number' && Number.isFinite(n));
  const high24h = roundPrice(meta.regularMarketDayHigh || (highs.length ? Math.max(...highs) : price), symbol);
  const low24h = roundPrice(meta.regularMarketDayLow || (lows.length ? Math.min(...lows) : price), symbol);

  const rawBid = Number(meta.bid);
  const rawAsk = Number(meta.ask);
  const hasBBO = Number.isFinite(rawBid) && rawBid > 0 && Number.isFinite(rawAsk) && rawAsk >= rawBid;
  const bid = hasBBO ? roundPrice(rawBid, symbol) : undefined;
  const ask = hasBBO ? roundPrice(rawAsk, symbol) : undefined;
  const spread = bid !== undefined && ask !== undefined ? roundPrice(ask - bid, symbol) : undefined;

  const sourceTimestamp = meta.regularMarketTime
    ? new Date(meta.regularMarketTime * 1000).toISOString()
    : new Date().toISOString();

  const nowIso = new Date().toISOString();
  const { freshness, isLive } = computeFreshness(sourceTimestamp, symbol);

  return {
    symbol,
    displayName: INSTRUMENT_SPECS[symbol].displayName,
    marketType: INSTRUMENT_SPECS[symbol].marketType,
    instrument: decodeURIComponent(yahooTicker),
    price,
    bid,
    ask,
    spread,
    change24h,
    high24h,
    low24h,
    source: sourceLabel,
    providerStatus: 'ok',
    sourceTimestamp,
    fetchedAt: nowIso,
    lastSuccessfulUpdate: nowIso,
    freshness,
    isLive,
    fallbackUsed: false,
  };
}

// ============================================================================
// PUBLIC EXPORTED ADAPTER ENTRYPOINTS (SINGLE-FLIGHT + ADAPTIVE CACHE)
// ============================================================================
export async function getVerifiedQuote(symbol: SupportedSymbol): Promise<VerifiedQuote> {
  const cached = quoteCache.get(symbol);
  const now = Date.now();
  if (cached && now - cached.fetchedAtMs < QUOTE_CACHE_TTL_MS) {
    return cached.data;
  }

  const pending = inFlightQuotes.get(symbol);
  if (pending) {
    return pending;
  }

  const job: Promise<VerifiedQuote> = (async (): Promise<VerifiedQuote> => {
    try {
      let quote: VerifiedQuote;
      if (symbol === 'BTCUSD') {
        quote = await fetchBTCUSDQuote();
      } else if (symbol === 'XAUUSD') {
        quote = await fetchXAUUSDQuote();
      } else {
        const cfg = YAHOO_SYMBOL_CONFIG[symbol];
        quote = await fetchYahooExactQuote(cfg.yahooTicker, symbol, cfg.label);
      }

      const fetchMs = Date.now();
      quoteCache.set(symbol, { data: quote, fetchedAtMs: fetchMs });
      lastGoodQuoteCache.set(symbol, { data: quote, fetchedAtMs: fetchMs });
      return quote;
    } catch (err: any) {
      // Never fabricate prices; only return explicitly marked STALE cached quote if recent (<30m)
      const lastGood = lastGoodQuoteCache.get(symbol);
      if (lastGood && Date.now() - lastGood.fetchedAtMs < 30 * 60 * 1000) {
        const { freshness } = computeFreshness(lastGood.data.sourceTimestamp, symbol, { forcedStale: true });
        const status: ProviderStatus = err?.isRateLimited ? 'rate_limited' : 'fallback';
        return {
          ...lastGood.data,
          providerStatus: status,
          freshness,
          isLive: false,
          fallbackUsed: true,
          fallbackReason: `Serving cached ${symbol} quote due to provider error: ${err?.message || 'unavailable'}`,
        };
      }
      throw err;
    } finally {
      inFlightQuotes.delete(symbol);
    }
  })();

  inFlightQuotes.set(symbol, job);
  return job;
}

export async function getVerifiedMarketData(
  symbol: SupportedSymbol,
  timeframe: SupportedTimeframe
): Promise<VerifiedMarketDataResponse> {
  const cacheKey = `${symbol}_${timeframe}`;
  const now = Date.now();
  const cachedCandles = candleCache.get(cacheKey);
  const ttlMs = CANDLE_TTL_BY_TF[timeframe] ?? 180 * 1000;
  const twelveKey = (process.env.TWELVE_DATA_API_KEY || process.env.MARKET_DATA_API_KEY)?.trim();

  let candleBundle: CandleBundle;

  if (cachedCandles && now - cachedCandles.fetchedAtMs < ttlMs) {
    candleBundle = cachedCandles.data;
  } else {
    let pending = inFlightCandles.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        try {
          let bundle: CandleBundle;
          if (symbol === 'BTCUSD') {
            try {
              bundle = await fetchCoinbaseBTCUSD(timeframe);
            } catch (err: any) {
              if (err instanceof RateLimitError) throw err;
              bundle = await fetchKrakenBTCUSD(timeframe, `Coinbase unavailable (${err?.message}); using Kraken Spot`);
            }
          } else if (symbol === 'XAUUSD') {
            bundle = await fetchXAUUSDSpotCandles(timeframe);
          } else {
            // Route non-XAU instruments through native exact Yahoo endpoints first so
            // Twelve Data credits are preserved for XAU/USD spot intraday candles.
            const cfg = YAHOO_SYMBOL_CONFIG[symbol];
            try {
              bundle = await fetchYahooExactCandles(cfg.yahooTicker, symbol, timeframe, cfg.label);
            } catch (yahooErr: any) {
              if (twelveKey && canUseTwelveData().allowed) {
                const td = await fetchTwelveDataCandles(cfg.twelveSymbol, symbol, timeframe, twelveKey);
                bundle = {
                  ...td,
                  providerStatus: 'fallback',
                  fallbackUsed: true,
                  fallbackReason: `Yahoo unavailable (${yahooErr?.message}); using Twelve Data (${cfg.twelveSymbol})`,
                };
              } else {
                throw yahooErr;
              }
            }
          }

          const savedAt = Date.now();
          candleCache.set(cacheKey, { data: bundle, fetchedAtMs: savedAt });
          lastGoodCandleCache.set(cacheKey, { data: bundle, fetchedAtMs: savedAt });
          return bundle;
        } catch (err: any) {
          const lastGood = lastGoodCandleCache.get(cacheKey);
          if (lastGood && Date.now() - lastGood.fetchedAtMs < 60 * 60 * 1000) {
            return {
              ...lastGood.data,
              providerStatus: err?.isRateLimited ? 'rate_limited' : 'fallback',
              fallbackUsed: true,
              fallbackReason: `Serving cached ${symbol} ${timeframe} bars: ${err?.message || 'provider unavailable'}`,
            };
          }
          throw err;
        } finally {
          inFlightCandles.delete(cacheKey);
        }
      })();
      inFlightCandles.set(cacheKey, pending);
    }

    candleBundle = await pending;
  }

  const quote = await getVerifiedQuote(symbol);
  const combinedFallbackUsed = Boolean(candleBundle.fallbackUsed || quote.fallbackUsed);
  const combinedFallbackReason = candleBundle.fallbackReason || quote.fallbackReason;

  // Align active candle tip with the verified live quote when sharing the same provider family
  // (e.g., Coinbase WS BTC-USD quote -> Coinbase candles, or Yahoo live quote -> Yahoo candles)
  let syncedCandles = candleBundle.candles;
  if (syncedCandles.length > 0 && Number.isFinite(quote.price) && quote.price > 0) {
    const tfSecondsMap: Record<SupportedTimeframe, number> = {
      M5: 300,
      M15: 900,
      H1: 3600,
      H4: 14400,
      D1: 86400,
      W1: 604800,
      MN: 2592000,
    };
    const tfSec = tfSecondsMap[timeframe] || 3600;
    const sameFeedFamily =
      (candleBundle.source.includes('Coinbase') && quote.source.includes('Coinbase')) ||
      (candleBundle.source.includes('Kraken') && quote.source.includes('Kraken')) ||
      (candleBundle.source.includes('Yahoo') && quote.source.includes('Yahoo')) ||
      (candleBundle.source.includes('GoldBroker') && quote.source.includes('GoldBroker'));

    const quoteSec = Math.floor(new Date(quote.sourceTimestamp).getTime() / 1000);
    const lastBar = syncedCandles[syncedCandles.length - 1];
    if (sameFeedFamily && Number.isFinite(quoteSec) && quoteSec >= lastBar.time) {
      const updated = [...syncedCandles];
      const dec = INSTRUMENT_SPECS[symbol].decimals;
      const factor = Math.pow(10, dec);
      const qPrice = Math.round(quote.price * factor) / factor;
      if (quoteSec - lastBar.time < tfSec) {
        updated[updated.length - 1] = {
          ...lastBar,
          high: Math.max(lastBar.high, qPrice),
          low: Math.min(lastBar.low, qPrice),
          close: qPrice,
        };
      } else if (symbol === 'BTCUSD' || quoteSec - lastBar.time < tfSec * 2) {
        const bucketStart = Math.floor(quoteSec / tfSec) * tfSec;
        updated.push({
          time: bucketStart,
          open: lastBar.close,
          high: Math.max(lastBar.close, qPrice),
          low: Math.min(lastBar.close, qPrice),
          close: qPrice,
          volume: 0,
        });
      }
      syncedCandles = updated;
    }
  }

  const { freshness, isLive } = computeFreshness(quote.sourceTimestamp, symbol, {
    fallbackUsed: combinedFallbackUsed,
  });

  const providerStatus: ProviderStatus =
    candleBundle.providerStatus !== 'ok' ? candleBundle.providerStatus : quote.providerStatus;

  return {
    symbol,
    timeframe,
    displayName: INSTRUMENT_SPECS[symbol].displayName,
    marketType: INSTRUMENT_SPECS[symbol].marketType,
    instrument: candleBundle.instrument || quote.instrument,
    source: candleBundle.source,
    providerStatus,
    sourceTimestamp: quote.sourceTimestamp,
    fetchedAt: new Date().toISOString(),
    lastSuccessfulUpdate: candleBundle.lastSuccessfulUpdate || quote.lastSuccessfulUpdate,
    freshness,
    isLive: isLive && !combinedFallbackUsed,
    fallbackUsed: combinedFallbackUsed,
    fallbackReason: combinedFallbackReason,
    timeframeNote: candleBundle.timeframeNote,
    quote,
    candles: syncedCandles,
  };
}

export async function getMultiTimeframeCandles(
  symbol: SupportedSymbol,
  timeframes: SupportedTimeframe[] = ['MN', 'W1', 'D1', 'H4', 'H1', 'M15', 'M5']
): Promise<{
  quote: VerifiedQuote | null;
  quoteError?: string;
  candlesByTimeframe: Partial<Record<SupportedTimeframe, { timeframe: SupportedTimeframe; candles: Candle[]; source: string }>>;
  errorsByTimeframe: Partial<Record<SupportedTimeframe, string>>;
}> {
  let quote: VerifiedQuote | null = null;
  let quoteError: string | undefined;

  const quotePromise = getVerifiedQuote(symbol).catch((e) => {
    quoteError = e?.message || 'Quote feed unavailable';
    return null;
  });

  const candlesByTimeframe: Partial<Record<SupportedTimeframe, { timeframe: SupportedTimeframe; candles: Candle[]; source: string }>> = {};
  const errorsByTimeframe: Partial<Record<SupportedTimeframe, string>> = {};

  if (symbol === 'XAUUSD') {
    // Sequence XAUUSD timeframes gently so intraday Twelve Data credits aren't exhausted in one burst
    for (const tf of timeframes) {
      try {
        const md = await getVerifiedMarketData(symbol, tf);
        candlesByTimeframe[tf] = { timeframe: tf, candles: md.candles, source: md.source };
      } catch (err: any) {
        errorsByTimeframe[tf] = err?.message || `Failed to load ${tf} bars`;
      }
    }
    quote = await quotePromise;
  } else {
    const [quoteRes, tfResults] = await Promise.all([
      quotePromise,
      Promise.allSettled(
        timeframes.map(async (tf) => {
          const md = await getVerifiedMarketData(symbol, tf);
          return { tf, candles: md.candles, source: md.source };
        })
      ),
    ]);
    quote = quoteRes;

    tfResults.forEach((r, idx) => {
      const tf = timeframes[idx];
      if (r.status === 'fulfilled') {
        candlesByTimeframe[tf] = {
          timeframe: tf,
          candles: r.value.candles,
          source: r.value.source,
        };
      } else {
        errorsByTimeframe[tf] = r.reason?.message || `Failed to load ${tf} bars`;
      }
    });
  }

  return { quote, quoteError, candlesByTimeframe, errorsByTimeframe };
}

// ============================================================================
// REAL-TIME UPSTREAM WEBSOCKET ENGINE (Coinbase Exchange BTC-USD + Verified Quote Broadcast)
// ============================================================================
export function startUpstreamMarketStream(onQuoteUpdate: (quote: VerifiedQuote) => void): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let closed = false;
  let lastEmitMs = 0;

  const connectCoinbase = () => {
    if (closed) return;
    try {
      ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

      ws.on('open', () => {
        ws?.send(
          JSON.stringify({
            type: 'subscribe',
            product_ids: ['BTC-USD'],
            channels: ['ticker'],
          })
        );
      });

      ws.on('message', (rawData) => {
        try {
          const msg = JSON.parse(rawData.toString());
          if (msg.type === 'ticker' && msg.product_id === 'BTC-USD' && msg.price) {
            const price = roundPrice(parseFloat(msg.price), 'BTCUSD');
            const bid = msg.best_bid ? roundPrice(parseFloat(msg.best_bid), 'BTCUSD') : undefined;
            const ask = msg.best_ask ? roundPrice(parseFloat(msg.best_ask), 'BTCUSD') : undefined;
            const spread =
              bid !== undefined && ask !== undefined ? roundPrice(Math.max(0, ask - bid), 'BTCUSD') : undefined;
            const open24h = msg.open_24h ? parseFloat(msg.open_24h) : price;
            const high24h = msg.high_24h ? roundPrice(parseFloat(msg.high_24h), 'BTCUSD') : price;
            const low24h = msg.low_24h ? roundPrice(parseFloat(msg.low_24h), 'BTCUSD') : price;
            const change24h =
              open24h > 0 ? Number((((price - open24h) / open24h) * 100).toFixed(2)) : 0;
            const sourceTimestamp = msg.time || new Date().toISOString();

            const quote: VerifiedQuote = {
              symbol: 'BTCUSD',
              displayName: INSTRUMENT_SPECS.BTCUSD.displayName,
              marketType: INSTRUMENT_SPECS.BTCUSD.marketType,
              instrument: 'BTC-USD',
              price,
              bid,
              ask,
              spread,
              change24h,
              high24h,
              low24h,
              source: 'Coinbase WebSocket (BTC-USD Spot)',
              providerStatus: 'ok',
              sourceTimestamp,
              fetchedAt: new Date().toISOString(),
              lastSuccessfulUpdate: new Date().toISOString(),
              freshness: 'live',
              isLive: true,
              isWebSocketStream: true,
              fallbackUsed: false,
            };

            const nowMs = Date.now();
            quoteCache.set('BTCUSD', { data: quote, fetchedAtMs: nowMs });
            lastGoodQuoteCache.set('BTCUSD', { data: quote, fetchedAtMs: nowMs });

            // Throttle client WS broadcasts to max 1 update / 400ms to prevent UI floods
            const now = Date.now();
            if (now - lastEmitMs >= 400) {
              lastEmitMs = now;
              onQuoteUpdate(quote);
            }
          }
        } catch {
          // ignore malformed WS frame
        }
      });

      ws.on('close', () => {
        if (!closed) {
          reconnectTimer = setTimeout(connectCoinbase, 5000);
        }
      });

      ws.on('error', () => {
        try {
          ws?.close();
        } catch {
          // ignore
        }
      });
    } catch {
      if (!closed) {
        reconnectTimer = setTimeout(connectCoinbase, 8000);
      }
    }
  };

  connectCoinbase();

  // Periodic background quote check for the remaining 7 instruments
  const pollInterval = setInterval(async () => {
    if (closed) return;
    await Promise.allSettled(
      ALL_SUPPORTED_SYMBOLS.filter((s) => s !== 'BTCUSD').map(async (sym) => {
        try {
          const q = await getVerifiedQuote(sym);
          onQuoteUpdate(q);
        } catch {
          // Keep per-instrument errors isolated
        }
      })
    );
  }, 10000);

  return () => {
    closed = true;
    clearInterval(pollInterval);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try {
      ws?.close();
    } catch {
      // ignore
    }
  };
}
