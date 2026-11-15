export type SupportedSymbol =
  | 'XAUUSD'
  | 'NASDAQ'
  | 'BTCUSD'
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDJPY'
  | 'US30'
  | 'USOIL';

export type SupportedTimeframe = 'M5' | 'M15' | 'H1' | 'H4' | 'D1' | 'W1' | 'MN';

export const ALL_SUPPORTED_SYMBOLS: SupportedSymbol[] = [
  'XAUUSD',
  'NASDAQ',
  'BTCUSD',
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'US30',
  'USOIL',
];

export const ALL_TIMEFRAMES: SupportedTimeframe[] = ['M5', 'M15', 'H1', 'H4', 'D1', 'W1', 'MN'];

export interface InstrumentSpec {
  symbol: SupportedSymbol;
  displayName: string;
  shortName: string;
  marketType: string;
  quoteCurrency: 'USD' | 'JPY';
  contractSize: number;
  decimals: number;
  pipSize: number;
  minLot: number;
  maxLot: number;
  lotStep: number;
  commissionPerLotRoundTurn: number; // USD per 1.00 standard lot (half open, half close)
  swapLongPerLotDay: number;         // USD overnight financing per lot per day
  swapShortPerLotDay: number;
  leverage: number;                  // Paper simulation leverage (e.g. 100 = 1:100)
  defaultSlOffset: number;           // Default SL distance for quick order UI
  defaultTpOffset: number;           // Default TP distance for quick order UI
  tvSymbol: string;                  // Official TradingView symbol
  tvFeedLabel: string;               // Transparent TradingView feed label
}

export const INSTRUMENT_SPECS: Record<SupportedSymbol, InstrumentSpec> = {
  XAUUSD: {
    symbol: 'XAUUSD',
    displayName: 'Gold Spot (XAU/USD)',
    shortName: 'Spot Gold',
    marketType: 'Spot Metal',
    quoteCurrency: 'USD',
    contractSize: 100, // 1.00 lot = 100 troy oz
    decimals: 2,
    pipSize: 0.01,
    minLot: 0.01,
    maxLot: 50,
    lotStep: 0.01,
    commissionPerLotRoundTurn: 7.0,
    swapLongPerLotDay: -4.5,
    swapShortPerLotDay: 1.2,
    leverage: 100,
    defaultSlOffset: 15,
    defaultTpOffset: 30,
    tvSymbol: 'OANDA:XAUUSD',
    tvFeedLabel: 'OANDA:XAUUSD (Spot Gold)',
  },
  NASDAQ: {
    symbol: 'NASDAQ',
    displayName: 'NASDAQ-100 Index (US100)',
    shortName: 'US100 / NDX',
    marketType: 'Equity Index',
    quoteCurrency: 'USD',
    contractSize: 1, // 1.00 lot = $1 per index point
    decimals: 2,
    pipSize: 0.01,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    commissionPerLotRoundTurn: 2.0,
    swapLongPerLotDay: -3.5,
    swapShortPerLotDay: 0.5,
    leverage: 100,
    defaultSlOffset: 100,
    defaultTpOffset: 200,
    tvSymbol: 'NASDAQ:NDX',
    tvFeedLabel: 'NASDAQ:NDX (NASDAQ-100 Index)',
  },
  BTCUSD: {
    symbol: 'BTCUSD',
    displayName: 'Bitcoin Spot (BTC/USD)',
    shortName: 'Bitcoin Spot',
    marketType: 'Crypto Spot',
    quoteCurrency: 'USD',
    contractSize: 1, // 1.00 lot = 1 BTC
    decimals: 2,
    pipSize: 0.01,
    minLot: 0.01,
    maxLot: 20,
    lotStep: 0.01,
    commissionPerLotRoundTurn: 10.0,
    swapLongPerLotDay: -6.0,
    swapShortPerLotDay: -2.0,
    leverage: 20,
    defaultSlOffset: 1000,
    defaultTpOffset: 2500,
    tvSymbol: 'COINBASE:BTCUSD',
    tvFeedLabel: 'COINBASE:BTCUSD (Spot USD)',
  },
  EURUSD: {
    symbol: 'EURUSD',
    displayName: 'Euro / US Dollar (EUR/USD)',
    shortName: 'EUR/USD',
    marketType: 'Forex Spot',
    quoteCurrency: 'USD',
    contractSize: 100000, // 1.00 lot = 100,000 EUR
    decimals: 5,
    pipSize: 0.0001,
    minLot: 0.01,
    maxLot: 50,
    lotStep: 0.01,
    commissionPerLotRoundTurn: 7.0,
    swapLongPerLotDay: -3.2,
    swapShortPerLotDay: 0.8,
    leverage: 100,
    defaultSlOffset: 0.003,
    defaultTpOffset: 0.006,
    tvSymbol: 'OANDA:EURUSD',
    tvFeedLabel: 'OANDA:EURUSD (Spot FX)',
  },
  GBPUSD: {
    symbol: 'GBPUSD',
    displayName: 'British Pound / US Dollar (GBP/USD)',
    shortName: 'GBP/USD',
    marketType: 'Forex Spot',
    quoteCurrency: 'USD',
    contractSize: 100000, // 1.00 lot = 100,000 GBP
    decimals: 5,
    pipSize: 0.0001,
    minLot: 0.01,
    maxLot: 50,
    lotStep: 0.01,
    commissionPerLotRoundTurn: 7.0,
    swapLongPerLotDay: -2.8,
    swapShortPerLotDay: 0.6,
    leverage: 100,
    defaultSlOffset: 0.0035,
    defaultTpOffset: 0.007,
    tvSymbol: 'OANDA:GBPUSD',
    tvFeedLabel: 'OANDA:GBPUSD (Spot FX)',
  },
  USDJPY: {
    symbol: 'USDJPY',
    displayName: 'US Dollar / Japanese Yen (USD/JPY)',
    shortName: 'USD/JPY',
    marketType: 'Forex Spot',
    quoteCurrency: 'JPY',
    contractSize: 100000, // 1.00 lot = 100,000 USD base notional
    decimals: 3,
    pipSize: 0.01,
    minLot: 0.01,
    maxLot: 50,
    lotStep: 0.01,
    commissionPerLotRoundTurn: 7.0,
    swapLongPerLotDay: 2.5,
    swapShortPerLotDay: -5.2,
    leverage: 100,
    defaultSlOffset: 0.45,
    defaultTpOffset: 0.9,
    tvSymbol: 'OANDA:USDJPY',
    tvFeedLabel: 'OANDA:USDJPY (Spot FX)',
  },
  US30: {
    symbol: 'US30',
    displayName: 'Dow Jones 30 Index (US30)',
    shortName: 'US30 / DJI',
    marketType: 'Equity Index',
    quoteCurrency: 'USD',
    contractSize: 1, // 1.00 lot = $1 per index point
    decimals: 2,
    pipSize: 0.01,
    minLot: 0.01,
    maxLot: 100,
    lotStep: 0.01,
    commissionPerLotRoundTurn: 2.5,
    swapLongPerLotDay: -4.0,
    swapShortPerLotDay: 0.5,
    leverage: 100,
    defaultSlOffset: 150,
    defaultTpOffset: 300,
    tvSymbol: 'DJ:DJI',
    tvFeedLabel: 'DJ:DJI (Dow Jones Industrial Average)',
  },
  USOIL: {
    symbol: 'USOIL',
    displayName: 'WTI Crude Oil (USOIL / CL)',
    shortName: 'WTI Crude',
    marketType: 'Energy Commodity',
    quoteCurrency: 'USD',
    contractSize: 1000, // 1.00 lot = 1,000 barrels ($1.00 move = $1,000)
    decimals: 2,
    pipSize: 0.01,
    minLot: 0.01,
    maxLot: 25,
    lotStep: 0.01,
    commissionPerLotRoundTurn: 8.0,
    swapLongPerLotDay: -3.5,
    swapShortPerLotDay: -1.5,
    leverage: 50,
    defaultSlOffset: 0.8,
    defaultTpOffset: 1.6,
    tvSymbol: 'TVC:USOIL',
    tvFeedLabel: 'TVC:USOIL (WTI Crude Benchmark)',
  },
};

export function isSupportedSymbol(s: string): s is SupportedSymbol {
  return ALL_SUPPORTED_SYMBOLS.includes(s as SupportedSymbol);
}

export function isSupportedTimeframe(tf: string): tf is SupportedTimeframe {
  return ALL_TIMEFRAMES.includes(tf as SupportedTimeframe);
}

/**
 * Round USD monetary values safely to 2 decimal places using integer scaling.
 */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Round price strictly to instrument decimal precision.
 */
export function roundPrice(price: number, symbol: SupportedSymbol): number {
  if (!Number.isFinite(price)) return 0;
  const decimals = INSTRUMENT_SPECS[symbol].decimals;
  const factor = Math.pow(10, decimals);
  return Math.round((price + Number.EPSILON) * factor) / factor;
}

/**
 * Decimal-safe lot size calculation from account equity/balance, risk %, entry, and stop-loss.
 * Handles JPY-quoted instruments by converting JPY pip risk into USD via entry price.
 */
export function calculateLotSizeSafe(
  capital: number,
  riskPct: number,
  entry: number,
  sl: number,
  symbol: SupportedSymbol
): number {
  const spec = INSTRUMENT_SPECS[symbol];
  if (!Number.isFinite(capital) || capital <= 0) return spec.minLot;
  if (!Number.isFinite(riskPct) || riskPct <= 0) return spec.minLot;

  const scale = Math.pow(10, spec.decimals);
  const entryInt = Math.round(entry * scale);
  const slInt = Math.round(sl * scale);
  const priceDistance = Math.abs(entryInt - slInt) / scale;

  if (priceDistance <= 0) return spec.minLot;

  const riskUsd = (capital * riskPct) / 100;
  const usdRiskPerLot =
    spec.quoteCurrency === 'JPY' && entry > 0
      ? (priceDistance * spec.contractSize) / entry
      : priceDistance * spec.contractSize;

  if (usdRiskPerLot <= 0) return spec.minLot;

  const rawLot = riskUsd / usdRiskPerLot;
  const steppedLot = Math.floor(rawLot / spec.lotStep) * spec.lotStep;

  return Math.min(
    spec.maxLot,
    Math.max(spec.minLot, Math.round(steppedLot * 100) / 100)
  );
}

/**
 * Decimal-safe gross P&L calculation in USD.
 * For JPY-quoted pairs (USDJPY), converts JPY profit/loss to USD at the exit/current rate.
 */
export function calculateGrossPnLSafe(
  side: 'buy' | 'sell',
  entry: number,
  exitOrCurrent: number,
  lot: number,
  symbol: SupportedSymbol
): number {
  const spec = INSTRUMENT_SPECS[symbol];
  const scale = Math.pow(10, spec.decimals);
  const entryInt = Math.round(entry * scale);
  const exitInt = Math.round(exitOrCurrent * scale);
  const diffInt = side === 'buy' ? exitInt - entryInt : entryInt - exitInt;
  const quoteDiff = (diffInt / scale) * lot * spec.contractSize;
  const usdGross =
    spec.quoteCurrency === 'JPY' && exitOrCurrent > 0
      ? quoteDiff / exitOrCurrent
      : quoteDiff;
  return roundCents(usdGross);
}

/**
 * Calculate half-turn or round-turn commission in USD.
 */
export function calculateCommissionSafe(
  lot: number,
  symbol: SupportedSymbol,
  sides: 1 | 2 = 2
): number {
  const spec = INSTRUMENT_SPECS[symbol];
  const perSide = spec.commissionPerLotRoundTurn / 2;
  return roundCents(-Math.abs(lot * perSide * sides));
}

/**
 * Calculate overnight swap accrual in USD based on holding days.
 */
export function calculateSwapSafe(
  side: 'buy' | 'sell',
  lot: number,
  symbol: SupportedSymbol,
  openedAtIso: string,
  nowIso?: string
): number {
  const spec = INSTRUMENT_SPECS[symbol];
  const startMs = new Date(openedAtIso).getTime();
  const endMs = nowIso ? new Date(nowIso).getTime() : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

  const fullDays = Math.floor((endMs - startMs) / (24 * 3600 * 1000));
  if (fullDays <= 0) return 0;

  const dailyRate = side === 'buy' ? spec.swapLongPerLotDay : spec.swapShortPerLotDay;
  return roundCents(dailyRate * lot * fullDays);
}

/**
 * Calculate required margin for an open position in USD.
 * For USD-base pairs like USDJPY, 1.00 lot notional is already $100,000 USD.
 */
export function calculateRequiredMarginSafe(
  entry: number,
  lot: number,
  symbol: SupportedSymbol
): number {
  const spec = INSTRUMENT_SPECS[symbol];
  const notionalUsd =
    spec.quoteCurrency === 'JPY'
      ? lot * spec.contractSize
      : entry * lot * spec.contractSize;
  return roundCents(notionalUsd / spec.leverage);
}
