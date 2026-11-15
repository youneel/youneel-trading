import { SupportedSymbol, SupportedTimeframe, roundPrice, INSTRUMENT_SPECS } from './tradingMath.js';

export interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type ValidationStatus =
  | 'VALIDATED'
  | 'UNMITIGATED'
  | 'PARTIALLY_MITIGATED'
  | 'MITIGATED'
  | 'RESTING'
  | 'CONFIRMED'
  | 'INVALIDATED';

export type MarketRegime =
  | 'Trending Bullish'
  | 'Trending Bearish'
  | 'Ranging'
  | 'Reversing'
  | 'Consolidating'
  | 'Insufficient Data';

export interface SwingPoint {
  index: number;
  time: number;
  timestamp: string;
  price: number;
  kind: 'high' | 'low';
  structureLabel: 'HH' | 'HL' | 'LH' | 'LL' | 'SH' | 'SL';
}

export interface StructureEvent {
  type: 'BOS' | 'CHoCH' | 'MSS';
  direction: 'bullish' | 'bearish';
  brokenLevel: number;
  breakClose: number;
  timeframe: SupportedTimeframe;
  timestamp: string;
  status: ValidationStatus;
  invalidationCondition: string;
}

export interface LiquidityPool {
  kind: 'BSL' | 'SSL' | 'EQH' | 'EQL';
  price: number;
  upperBound?: number;
  lowerBound?: number;
  timeframe: SupportedTimeframe;
  timestamp: string;
  status: ValidationStatus;
  invalidationCondition: string;
}

export interface LiquiditySweepEvent {
  side: 'BSL_SWEEP' | 'SSL_SWEEP';
  sweptLevel: number;
  wickExtreme: number;
  closePrice: number;
  timeframe: SupportedTimeframe;
  timestamp: string;
  status: ValidationStatus;
  invalidationCondition: string;
}

export interface FairValueGap {
  direction: 'bullish' | 'bearish';
  low: number;
  high: number;
  midpoint: number;
  timeframe: SupportedTimeframe;
  timestamp: string;
  status: ValidationStatus;
  invalidationCondition: string;
}

export interface OrderBlock {
  direction: 'bullish' | 'bearish';
  low: number;
  high: number;
  midpoint: number;
  timeframe: SupportedTimeframe;
  timestamp: string;
  status: ValidationStatus;
  invalidationCondition: string;
}

export interface DisplacementMove {
  direction: 'bullish' | 'bearish';
  low: number;
  high: number;
  atrMultiple: number;
  timeframe: SupportedTimeframe;
  timestamp: string;
}

export interface KeyLevelZone {
  label: string;
  category: 'support' | 'resistance' | 'equilibrium' | 'liquidity' | 'order_block' | 'fvg';
  price: number;
  high?: number;
  low?: number;
  timeframe: SupportedTimeframe;
  timestamp: string;
  status: ValidationStatus;
  invalidationCondition: string;
}

export interface PremiumDiscountMatrix {
  rangeHigh: number;
  rangeLow: number;
  equilibrium: number;
  premiumZone: [number, number];
  discountZone: [number, number];
  positionPct: number; // 0 = rangeLow, 100 = rangeHigh
  currentZone: 'PREMIUM' | 'EQUILIBRIUM' | 'DISCOUNT';
  timeframe: SupportedTimeframe;
  timestamp: string;
}

export interface VolumeAnalysis {
  available: boolean;
  reason?: string;
  latestVolume?: number;
  sma20Volume?: number;
  relativeVolume?: number;
  bias?: 'Accumulation' | 'Distribution' | 'Neutral';
}

export interface TechnicalIndicatorsSnapshot {
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  atr14: number | null;
  atrPct: number | null;
  adx14: number | null;
  plusDI14: number | null;
  minusDI14: number | null;
  volume: VolumeAnalysis;
  missingReasons: string[];
}

export interface TimeframeAnalysisResult {
  symbol: SupportedSymbol;
  timeframe: SupportedTimeframe;
  barCount: number;
  sufficient: boolean;
  sufficiencyNote?: string;
  latestPrice: number;
  latestTimestamp: string;
  indicators: TechnicalIndicatorsSnapshot;
  regime: MarketRegime;
  swings: SwingPoint[];
  structureEvents: StructureEvent[];
  latestBOS: StructureEvent | null;
  latestCHoCH: StructureEvent | null;
  latestMSS: StructureEvent | null;
  liquidityPools: LiquidityPool[];
  liquiditySweeps: LiquiditySweepEvent[];
  fairValueGaps: FairValueGap[];
  orderBlocks: OrderBlock[];
  displacements: DisplacementMove[];
  premiumDiscount: PremiumDiscountMatrix | null;
  supports: KeyLevelZone[];
  resistances: KeyLevelZone[];
  pivot: number | null;
  directionalLean: 'Bullish' | 'Bearish' | 'Neutral' | 'Insufficient Data';
  structureScore: number; // -100 to +100
}

// ============================================================================
// CORE MATHEMATICAL INDICATORS (STRICT SUFFICIENCY CHECKS)
// ============================================================================

export function calculateEMASeries(values: number[], period: number): number[] {
  if (values.length < period || period <= 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = new Array(values.length).fill(NaN);

  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  ema[period - 1] = prev;

  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    ema[i] = prev;
  }
  return ema;
}

export function calculateRSISeries(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const rsis: number[] = new Array(closes.length).fill(NaN);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsis[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    rsis[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsis;
}

export function calculateMACDSeries(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: number[]; signal: number[]; histogram: number[] } | null {
  if (closes.length < slow + signal) return null;
  const emaFast = calculateEMASeries(closes, fast);
  const emaSlow = calculateEMASeries(closes, slow);

  const macdLine: number[] = [];
  const macdOffset = slow - 1;
  for (let i = macdOffset; i < closes.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }
  if (macdLine.length < signal) return null;

  const sigSub = calculateEMASeries(macdLine, signal);
  const macdFull = new Array(closes.length).fill(NaN);
  const sigFull = new Array(closes.length).fill(NaN);
  const histFull = new Array(closes.length).fill(NaN);

  for (let i = 0; i < macdLine.length; i++) {
    const idx = i + macdOffset;
    macdFull[idx] = macdLine[i];
    if (Number.isFinite(sigSub[i])) {
      sigFull[idx] = sigSub[i];
      histFull[idx] = macdLine[i] - sigSub[i];
    }
  }
  return { macd: macdFull, signal: sigFull, histogram: histFull };
}

export function calculateATRSeries(candles: CandleData[], period = 14): number[] {
  if (candles.length < period + 1) return [];
  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const pc = candles[i - 1].close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc)));
  }

  const atrs: number[] = new Array(candles.length).fill(NaN);
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trs[i];
  let atr = sum / period;
  atrs[period] = atr;

  for (let i = period + 1; i < candles.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    atrs[i] = atr;
  }
  return atrs;
}

export function calculateADXSnapshot(
  candles: CandleData[],
  period = 14
): { adx: number; plusDI: number; minusDI: number } | null {
  if (candles.length < period * 2 + 1) return null;

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      )
    );
  }

  let smoothTR = 0;
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;
  for (let i = 0; i < period; i++) {
    smoothTR += tr[i];
    smoothPlusDM += plusDM[i];
    smoothMinusDM += minusDM[i];
  }

  const dxValues: number[] = [];
  let lastPlusDI = 0;
  let lastMinusDI = 0;

  for (let i = period; i < tr.length; i++) {
    if (i > period) {
      smoothTR = smoothTR - smoothTR / period + tr[i];
      smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
      smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];
    }
    const pDI = smoothTR > 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const mDI = smoothTR > 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = pDI + mDI;
    const dx = diSum > 0 ? (Math.abs(pDI - mDI) / diSum) * 100 : 0;
    dxValues.push(dx);
    lastPlusDI = pDI;
    lastMinusDI = mDI;
  }

  if (dxValues.length < period) return null;

  let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dxValues.length; i++) {
    adx = (adx * (period - 1) + dxValues[i]) / period;
  }

  return {
    adx: Number(adx.toFixed(2)),
    plusDI: Number(lastPlusDI.toFixed(2)),
    minusDI: Number(lastMinusDI.toFixed(2)),
  };
}

function analyzeVolume(candles: CandleData[]): VolumeAnalysis {
  if (candles.length < 20) {
    return { available: false, reason: 'Insufficient bars for 20-period volume baseline' };
  }
  const recent = candles.slice(-20);
  const nonZero = recent.filter((c) => Number.isFinite(c.volume) && c.volume > 0);
  if (nonZero.length < 15) {
    return {
      available: false,
      reason: 'Spot/Index feed reports zero traded volume for this instrument',
    };
  }
  const sma20 = recent.reduce((acc, c) => acc + c.volume, 0) / 20;
  const latest = recent[recent.length - 1];
  const rvol = sma20 > 0 ? Number((latest.volume / sma20).toFixed(2)) : 1;

  let upVol = 0;
  let downVol = 0;
  for (const c of recent.slice(-10)) {
    if (c.close >= c.open) upVol += c.volume;
    else downVol += c.volume;
  }
  const ratio = downVol > 0 ? upVol / downVol : upVol > 0 ? 2 : 1;
  const bias = ratio > 1.2 ? 'Accumulation' : ratio < 0.82 ? 'Distribution' : 'Neutral';

  return {
    available: true,
    latestVolume: Math.round(latest.volume),
    sma20Volume: Math.round(sma20),
    relativeVolume: rvol,
    bias,
  };
}

// ============================================================================
// STRUCTURAL SWINGS, BOS, CHoCH, ICT/SMC ZONES
// ============================================================================

export function analyzeTimeframe(
  symbol: SupportedSymbol,
  timeframe: SupportedTimeframe,
  rawCandles: CandleData[]
): TimeframeAnalysisResult {
  const candles = [...rawCandles]
    .filter(
      (c) =>
        Number.isFinite(c.time) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
    )
    .sort((a, b) => a.time - b.time)
    .filter((c, i, arr) => i === 0 || c.time > arr[i - 1].time);

  const dec = INSTRUMENT_SPECS[symbol].decimals;
  const latest = candles[candles.length - 1];

  if (!latest || candles.length < 12) {
    return {
      symbol,
      timeframe,
      barCount: candles.length,
      sufficient: false,
      sufficiencyNote: `Only ${candles.length} historical bars available for ${timeframe} (minimum 12 required for swing structure).`,
      latestPrice: latest ? roundPrice(latest.close, symbol) : 0,
      latestTimestamp: latest ? new Date(latest.time * 1000).toISOString() : '',
      indicators: {
        rsi14: null,
        macd: null,
        macdSignal: null,
        macdHist: null,
        ema20: null,
        ema50: null,
        ema200: null,
        atr14: null,
        atrPct: null,
        adx14: null,
        plusDI14: null,
        minusDI14: null,
        volume: { available: false, reason: 'Insufficient candles' },
        missingReasons: [`Need >= 15 bars for RSI/ATR, >= 20 for EMA20, >= 50 for EMA50, >= 200 for EMA200 (got ${candles.length}).`],
      },
      regime: 'Insufficient Data',
      swings: [],
      structureEvents: [],
      latestBOS: null,
      latestCHoCH: null,
      latestMSS: null,
      liquidityPools: [],
      liquiditySweeps: [],
      fairValueGaps: [],
      orderBlocks: [],
      displacements: [],
      premiumDiscount: null,
      supports: [],
      resistances: [],
      pivot: null,
      directionalLean: 'Insufficient Data',
      structureScore: 0,
    };
  }

  const closes = candles.map((c) => c.close);
  const latestPrice = roundPrice(latest.close, symbol);
  const latestTimestamp = new Date(latest.time * 1000).toISOString();

  // Compute indicators strictly where sufficient bars exist
  const missingReasons: string[] = [];
  const rsiSeries = calculateRSISeries(closes, 14);
  const rsi14 = rsiSeries.length > 0 && Number.isFinite(rsiSeries[rsiSeries.length - 1])
    ? Number(rsiSeries[rsiSeries.length - 1].toFixed(2))
    : null;
  if (rsi14 === null) missingReasons.push(`RSI(14) requires >= 15 bars (have ${candles.length})`);

  const macdRes = calculateMACDSeries(closes, 12, 26, 9);
  const lastIdx = candles.length - 1;
  const macd = macdRes && Number.isFinite(macdRes.macd[lastIdx]) ? Number(macdRes.macd[lastIdx].toFixed(4)) : null;
  const macdSignal = macdRes && Number.isFinite(macdRes.signal[lastIdx]) ? Number(macdRes.signal[lastIdx].toFixed(4)) : null;
  const macdHist = macdRes && Number.isFinite(macdRes.histogram[lastIdx]) ? Number(macdRes.histogram[lastIdx].toFixed(4)) : null;
  if (macd === null) missingReasons.push(`MACD(12,26,9) requires >= 35 bars (have ${candles.length})`);

  const ema20Arr = calculateEMASeries(closes, 20);
  const ema50Arr = calculateEMASeries(closes, 50);
  const ema200Arr = calculateEMASeries(closes, 200);

  const ema20 = ema20Arr.length > 0 ? roundPrice(ema20Arr[lastIdx], symbol) : null;
  const ema50 = ema50Arr.length > 0 ? roundPrice(ema50Arr[lastIdx], symbol) : null;
  const ema200 = ema200Arr.length > 0 ? roundPrice(ema200Arr[lastIdx], symbol) : null;
  if (ema20 === null) missingReasons.push(`EMA(20) requires >= 20 bars (have ${candles.length})`);
  if (ema50 === null) missingReasons.push(`EMA(50) requires >= 50 bars (have ${candles.length})`);
  if (ema200 === null) missingReasons.push(`EMA(200) requires >= 200 bars (have ${candles.length})`);

  const atrSeries = calculateATRSeries(candles, 14);
  const atr14 = atrSeries.length > 0 && Number.isFinite(atrSeries[lastIdx])
    ? roundPrice(atrSeries[lastIdx], symbol)
    : null;
  const atrPct = atr14 !== null && latestPrice > 0 ? Number(((atr14 / latestPrice) * 100).toFixed(3)) : null;
  if (atr14 === null) missingReasons.push(`ATR(14) requires >= 15 bars (have ${candles.length})`);

  const adxSnap = calculateADXSnapshot(candles, 14);
  if (!adxSnap) missingReasons.push(`ADX(14) requires >= 29 bars (have ${candles.length})`);

  const volume = analyzeVolume(candles);

  // Fallback volatility unit strictly for geometric tolerances if < 15 bars
  const fallbackRange =
    candles.reduce((acc, c) => acc + (c.high - c.low), 0) / candles.length;
  const volUnit = atr14 && atr14 > 0 ? atr14 : fallbackRange || latestPrice * 0.005;

  // 1. Detect confirmed swing highs & swing lows (no future repainting; requires right-side confirmation)
  const lookback = candles.length >= 25 ? 3 : 2;
  const rawSwings: { index: number; time: number; price: number; kind: 'high' | 'low' }[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= candles[i].high || candles[i + j].high > candles[i].high) {
        isHigh = false;
      }
      if (candles[i - j].low <= candles[i].low || candles[i + j].low < candles[i].low) {
        isLow = false;
      }
    }
    if (isHigh) {
      rawSwings.push({ index: i, time: candles[i].time, price: roundPrice(candles[i].high, symbol), kind: 'high' });
    }
    if (isLow) {
      rawSwings.push({ index: i, time: candles[i].time, price: roundPrice(candles[i].low, symbol), kind: 'low' });
    }
  }

  // Label HH / HL / LH / LL sequentially
  let prevSwingHigh: number | null = null;
  let prevSwingLow: number | null = null;
  const swings: SwingPoint[] = rawSwings.map((sp) => {
    let structureLabel: SwingPoint['structureLabel'] = sp.kind === 'high' ? 'SH' : 'SL';
    if (sp.kind === 'high') {
      if (prevSwingHigh !== null) {
        structureLabel = sp.price > prevSwingHigh ? 'HH' : 'LH';
      }
      prevSwingHigh = sp.price;
    } else {
      if (prevSwingLow !== null) {
        structureLabel = sp.price > prevSwingLow ? 'HL' : 'LL';
      }
      prevSwingLow = sp.price;
    }
    return {
      index: sp.index,
      time: sp.time,
      timestamp: new Date(sp.time * 1000).toISOString(),
      price: sp.price,
      kind: sp.kind,
      structureLabel,
    };
  });

  // 2. Detect Displacement Moves (body >= 1.45 * ATR & high body efficiency)
  const displacements: DisplacementMove[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const body = Math.abs(c.close - c.open);
    const fullRange = c.high - c.low;
    const localAtr = Number.isFinite(atrSeries[i]) && atrSeries[i] > 0 ? atrSeries[i] : volUnit;
    if (localAtr > 0 && fullRange > 0 && body >= 1.45 * localAtr && body / fullRange >= 0.62) {
      displacements.push({
        direction: c.close > c.open ? 'bullish' : 'bearish',
        low: roundPrice(c.low, symbol),
        high: roundPrice(c.high, symbol),
        atrMultiple: Number((body / localAtr).toFixed(2)),
        timeframe,
        timestamp: new Date(c.time * 1000).toISOString(),
      });
    }
  }

  // 3. Detect BOS, CHoCH & MSS chronologically + associated Order Blocks
  const structureEvents: StructureEvent[] = [];
  const orderBlocks: OrderBlock[] = [];
  let structuralTrend: 'bullish' | 'bearish' | 'none' = 'none';
  let activeHigh: SwingPoint | null = null;
  let activeLow: SwingPoint | null = null;
  let brokenHighIndices = new Set<number>();
  let brokenLowIndices = new Set<number>();

  const swingHighByIdx = new Map<number, SwingPoint>();
  const swingLowByIdx = new Map<number, SwingPoint>();
  swings.forEach((s) => {
    if (s.kind === 'high') swingHighByIdx.set(s.index, s);
    else swingLowByIdx.set(s.index, s);
  });

  for (let i = 0; i < candles.length; i++) {
    // A swing confirmed lookback bars ago becomes known at bar i
    const confirmedIdx = i - lookback;
    if (confirmedIdx >= 0) {
      if (swingHighByIdx.has(confirmedIdx)) activeHigh = swingHighByIdx.get(confirmedIdx)!;
      if (swingLowByIdx.has(confirmedIdx)) activeLow = swingLowByIdx.get(confirmedIdx)!;
    }

    const c = candles[i];
    const cTs = new Date(c.time * 1000).toISOString();

    if (activeHigh && !brokenHighIndices.has(activeHigh.index) && c.close > activeHigh.price) {
      brokenHighIndices.add(activeHigh.index);
      const isReversal = structuralTrend === 'bearish';
      const eventType: 'BOS' | 'CHoCH' = isReversal ? 'CHoCH' : 'BOS';
      const hasDisplacement = displacements.some(
        (d) => d.direction === 'bullish' && d.timestamp === cTs
      );
      const finalType: 'BOS' | 'CHoCH' | 'MSS' =
        isReversal && hasDisplacement ? 'MSS' : eventType;

      const invLevel = activeLow ? activeLow.price : roundPrice(c.low, symbol);
      const invalidatedLater = candles
        .slice(i + 1)
        .some((later) => later.close < invLevel);

      structureEvents.push({
        type: finalType,
        direction: 'bullish',
        brokenLevel: activeHigh.price,
        breakClose: roundPrice(c.close, symbol),
        timeframe,
        timestamp: cTs,
        status: invalidatedLater ? 'INVALIDATED' : 'VALIDATED',
        invalidationCondition: `Candle close below ${invLevel.toFixed(dec)}`,
      });

      // Find last bearish candle preceding bullish BOS/CHoCH => Bullish Order Block
      for (let k = i - 1; k >= Math.max(0, i - 8); k--) {
        if (candles[k].close < candles[k].open) {
          const obLow = roundPrice(candles[k].low, symbol);
          const obHigh = roundPrice(candles[k].high, symbol);
          const laterCandles = candles.slice(i + 1);
          const invalidatedOb = laterCandles.some((lc) => lc.close < obLow);
          const mitigatedOb = !invalidatedOb && laterCandles.some((lc) => lc.low <= obHigh);

          orderBlocks.push({
            direction: 'bullish',
            low: obLow,
            high: obHigh,
            midpoint: roundPrice((obLow + obHigh) / 2, symbol),
            timeframe,
            timestamp: new Date(candles[k].time * 1000).toISOString(),
            status: invalidatedOb ? 'INVALIDATED' : mitigatedOb ? 'MITIGATED' : 'UNMITIGATED',
            invalidationCondition: `Close below bullish OB low (${obLow.toFixed(dec)})`,
          });
          break;
        }
      }

      structuralTrend = 'bullish';
    }

    if (activeLow && !brokenLowIndices.has(activeLow.index) && c.close < activeLow.price) {
      brokenLowIndices.add(activeLow.index);
      const isReversal = structuralTrend === 'bullish';
      const eventType: 'BOS' | 'CHoCH' = isReversal ? 'CHoCH' : 'BOS';
      const hasDisplacement = displacements.some(
        (d) => d.direction === 'bearish' && d.timestamp === cTs
      );
      const finalType: 'BOS' | 'CHoCH' | 'MSS' =
        isReversal && hasDisplacement ? 'MSS' : eventType;

      const invLevel = activeHigh ? activeHigh.price : roundPrice(c.high, symbol);
      const invalidatedLater = candles
        .slice(i + 1)
        .some((later) => later.close > invLevel);

      structureEvents.push({
        type: finalType,
        direction: 'bearish',
        brokenLevel: activeLow.price,
        breakClose: roundPrice(c.close, symbol),
        timeframe,
        timestamp: cTs,
        status: invalidatedLater ? 'INVALIDATED' : 'VALIDATED',
        invalidationCondition: `Candle close above ${invLevel.toFixed(dec)}`,
      });

      // Find last bullish candle preceding bearish BOS/CHoCH => Bearish Order Block
      for (let k = i - 1; k >= Math.max(0, i - 8); k--) {
        if (candles[k].close > candles[k].open) {
          const obLow = roundPrice(candles[k].low, symbol);
          const obHigh = roundPrice(candles[k].high, symbol);
          const laterCandles = candles.slice(i + 1);
          const invalidatedOb = laterCandles.some((lc) => lc.close > obHigh);
          const mitigatedOb = !invalidatedOb && laterCandles.some((lc) => lc.high >= obLow);

          orderBlocks.push({
            direction: 'bearish',
            low: obLow,
            high: obHigh,
            midpoint: roundPrice((obLow + obHigh) / 2, symbol),
            timeframe,
            timestamp: new Date(candles[k].time * 1000).toISOString(),
            status: invalidatedOb ? 'INVALIDATED' : mitigatedOb ? 'MITIGATED' : 'UNMITIGATED',
            invalidationCondition: `Close above bearish OB high (${obHigh.toFixed(dec)})`,
          });
          break;
        }
      }

      structuralTrend = 'bearish';
    }
  }

  // 4. Detect Fair Value Gaps (FVG) with mitigation & invalidation tracking
  const fairValueGaps: FairValueGap[] = [];
  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i - 2];
    const c2 = candles[i];
    const fvgTs = new Date(c2.time * 1000).toISOString();

    // Bullish FVG: c0.high < c2.low
    if (c0.high < c2.low && c2.low - c0.high >= volUnit * 0.15) {
      const low = roundPrice(c0.high, symbol);
      const high = roundPrice(c2.low, symbol);
      const mid = roundPrice((low + high) / 2, symbol);
      const later = candles.slice(i + 1);
      const invalidated = later.some((lc) => lc.close < low);
      const fullyFilled = !invalidated && later.some((lc) => lc.low <= low);
      const partial = !invalidated && !fullyFilled && later.some((lc) => lc.low <= mid);

      fairValueGaps.push({
        direction: 'bullish',
        low,
        high,
        midpoint: mid,
        timeframe,
        timestamp: fvgTs,
        status: invalidated
          ? 'INVALIDATED'
          : fullyFilled
          ? 'MITIGATED'
          : partial
          ? 'PARTIALLY_MITIGATED'
          : 'UNMITIGATED',
        invalidationCondition: `Candle close below FVG lower bound (${low.toFixed(dec)})`,
      });
    }

    // Bearish FVG: c0.low > c2.high
    if (c0.low > c2.high && c0.low - c2.high >= volUnit * 0.15) {
      const low = roundPrice(c2.high, symbol);
      const high = roundPrice(c0.low, symbol);
      const mid = roundPrice((low + high) / 2, symbol);
      const later = candles.slice(i + 1);
      const invalidated = later.some((lc) => lc.close > high);
      const fullyFilled = !invalidated && later.some((lc) => lc.high >= high);
      const partial = !invalidated && !fullyFilled && later.some((lc) => lc.high >= mid);

      fairValueGaps.push({
        direction: 'bearish',
        low,
        high,
        midpoint: mid,
        timeframe,
        timestamp: fvgTs,
        status: invalidated
          ? 'INVALIDATED'
          : fullyFilled
          ? 'MITIGATED'
          : partial
          ? 'PARTIALLY_MITIGATED'
          : 'UNMITIGATED',
        invalidationCondition: `Candle close above FVG upper bound (${high.toFixed(dec)})`,
      });
    }
  }

  // 5. Liquidity Pools (BSL / SSL / Equal Highs / Equal Lows) & Liquidity Sweeps
  const liquidityPools: LiquidityPool[] = [];
  const liquiditySweeps: LiquiditySweepEvent[] = [];

  const swingHighs = swings.filter((s) => s.kind === 'high');
  const swingLows = swings.filter((s) => s.kind === 'low');

  // Un-swept swing highs above latest price => BSL
  for (const sh of swingHighs) {
    const laterCandles = candles.slice(sh.index + 1);
    const sweptCandle = laterCandles.find((lc) => lc.high > sh.price);
    if (!sweptCandle && sh.price > latestPrice) {
      liquidityPools.push({
        kind: 'BSL',
        price: sh.price,
        timeframe,
        timestamp: sh.timestamp,
        status: 'RESTING',
        invalidationCondition: `Swept when price trades above ${sh.price.toFixed(dec)}`,
      });
    } else if (sweptCandle && sweptCandle.close < sh.price && sweptCandle.time >= candles[Math.max(0, candles.length - 15)].time) {
      liquiditySweeps.push({
        side: 'BSL_SWEEP',
        sweptLevel: sh.price,
        wickExtreme: roundPrice(sweptCandle.high, symbol),
        closePrice: roundPrice(sweptCandle.close, symbol),
        timeframe,
        timestamp: new Date(sweptCandle.time * 1000).toISOString(),
        status: latestPrice > sweptCandle.high ? 'INVALIDATED' : 'CONFIRMED',
        invalidationCondition: `Acceptance / close above sweep wick high (${sweptCandle.high.toFixed(dec)})`,
      });
    }
  }

  // Un-swept swing lows below latest price => SSL
  for (const sl of swingLows) {
    const laterCandles = candles.slice(sl.index + 1);
    const sweptCandle = laterCandles.find((lc) => lc.low < sl.price);
    if (!sweptCandle && sl.price < latestPrice) {
      liquidityPools.push({
        kind: 'SSL',
        price: sl.price,
        timeframe,
        timestamp: sl.timestamp,
        status: 'RESTING',
        invalidationCondition: `Swept when price trades below ${sl.price.toFixed(dec)}`,
      });
    } else if (sweptCandle && sweptCandle.close > sl.price && sweptCandle.time >= candles[Math.max(0, candles.length - 15)].time) {
      liquiditySweeps.push({
        side: 'SSL_SWEEP',
        sweptLevel: sl.price,
        wickExtreme: roundPrice(sweptCandle.low, symbol),
        closePrice: roundPrice(sweptCandle.close, symbol),
        timeframe,
        timestamp: new Date(sweptCandle.time * 1000).toISOString(),
        status: latestPrice < sweptCandle.low ? 'INVALIDATED' : 'CONFIRMED',
        invalidationCondition: `Acceptance / close below sweep wick low (${sweptCandle.low.toFixed(dec)})`,
      });
    }
  }

  // Equal Highs (EQH) & Equal Lows (EQL)
  const eqTol = volUnit * 0.25;
  for (let a = Math.max(0, swingHighs.length - 8); a < swingHighs.length; a++) {
    for (let b = a + 1; b < swingHighs.length; b++) {
      if (Math.abs(swingHighs[a].price - swingHighs[b].price) <= eqTol) {
        const hi = Math.max(swingHighs[a].price, swingHighs[b].price);
        const lo = Math.min(swingHighs[a].price, swingHighs[b].price);
        if (hi > latestPrice) {
          liquidityPools.push({
            kind: 'EQH',
            price: roundPrice((hi + lo) / 2, symbol),
            upperBound: hi,
            lowerBound: lo,
            timeframe,
            timestamp: swingHighs[b].timestamp,
            status: 'RESTING',
            invalidationCondition: `Swept above ${hi.toFixed(dec)}`,
          });
        }
      }
    }
  }
  for (let a = Math.max(0, swingLows.length - 8); a < swingLows.length; a++) {
    for (let b = a + 1; b < swingLows.length; b++) {
      if (Math.abs(swingLows[a].price - swingLows[b].price) <= eqTol) {
        const hi = Math.max(swingLows[a].price, swingLows[b].price);
        const lo = Math.min(swingLows[a].price, swingLows[b].price);
        if (lo < latestPrice) {
          liquidityPools.push({
            kind: 'EQL',
            price: roundPrice((hi + lo) / 2, symbol),
            upperBound: hi,
            lowerBound: lo,
            timeframe,
            timestamp: swingLows[b].timestamp,
            status: 'RESTING',
            invalidationCondition: `Swept below ${lo.toFixed(dec)}`,
          });
        }
      }
    }
  }

  // 6. Premium / Equilibrium / Discount dealing range over recent 40 bars
  const dealingSlice = candles.slice(-Math.min(40, candles.length));
  const rangeHigh = roundPrice(Math.max(...dealingSlice.map((c) => c.high)), symbol);
  const rangeLow = roundPrice(Math.min(...dealingSlice.map((c) => c.low)), symbol);
  const equilibrium = roundPrice((rangeHigh + rangeLow) / 2, symbol);
  const span = rangeHigh - rangeLow;
  const positionPct = span > 0 ? Math.max(0, Math.min(100, Number((((latestPrice - rangeLow) / span) * 100).toFixed(1)))) : 50;
  const currentZone: PremiumDiscountMatrix['currentZone'] =
    positionPct >= 55 ? 'PREMIUM' : positionPct <= 45 ? 'DISCOUNT' : 'EQUILIBRIUM';

  const premiumDiscount: PremiumDiscountMatrix = {
    rangeHigh,
    rangeLow,
    equilibrium,
    premiumZone: [equilibrium, rangeHigh],
    discountZone: [rangeLow, equilibrium],
    positionPct,
    currentZone,
    timeframe,
    timestamp: latestTimestamp,
  };

  // 7. Support & Resistance Zones from swings + Floor Pivot
  const recent20 = candles.slice(-20);
  const pHigh = Math.max(...recent20.map((c) => c.high));
  const pLow = Math.min(...recent20.map((c) => c.low));
  const pivot = roundPrice((pHigh + pLow + latest.close) / 3, symbol);

  const supports: KeyLevelZone[] = swingLows
    .filter((s) => s.price < latestPrice)
    .sort((a, b) => b.price - a.price)
    .slice(0, 3)
    .map((s, idx) => ({
      label: `S${idx + 1} (${timeframe} Swing Low)`,
      category: 'support',
      price: s.price,
      timeframe,
      timestamp: s.timestamp,
      status: 'VALIDATED',
      invalidationCondition: `Candle close below ${s.price.toFixed(dec)}`,
    }));

  const resistances: KeyLevelZone[] = swingHighs
    .filter((s) => s.price > latestPrice)
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map((s, idx) => ({
      label: `R${idx + 1} (${timeframe} Swing High)`,
      category: 'resistance',
      price: s.price,
      timeframe,
      timestamp: s.timestamp,
      status: 'VALIDATED',
      invalidationCondition: `Candle close above ${s.price.toFixed(dec)}`,
    }));

  // 8. Market Regime Classification & Timeframe Directional Score (-100 to +100)
  const latestBOS = [...structureEvents].reverse().find((e) => e.type === 'BOS') || null;
  const latestCHoCH = [...structureEvents].reverse().find((e) => e.type === 'CHoCH' || e.type === 'MSS') || null;
  const latestMSS = [...structureEvents].reverse().find((e) => e.type === 'MSS') || null;
  const latestEvent = structureEvents[structureEvents.length - 1] || null;

  const recentSwings = swings.slice(-4);
  const hhCount = recentSwings.filter((s) => s.structureLabel === 'HH' || s.structureLabel === 'HL').length;
  const llCount = recentSwings.filter((s) => s.structureLabel === 'LH' || s.structureLabel === 'LL').length;

  let regime: MarketRegime = 'Consolidating';
  if (latestCHoCH && latestCHoCH.status === 'VALIDATED' && latestEvent === latestCHoCH) {
    regime = 'Reversing';
  } else if (structuralTrend === 'bullish' && (adxSnap === null || adxSnap.adx >= 20) && hhCount >= 2) {
    regime = 'Trending Bullish';
  } else if (structuralTrend === 'bearish' && (adxSnap === null || adxSnap.adx >= 20) && llCount >= 2) {
    regime = 'Trending Bearish';
  } else if (adxSnap !== null && adxSnap.adx < 18) {
    regime = 'Ranging';
  } else if (structuralTrend === 'bullish') {
    regime = 'Trending Bullish';
  } else if (structuralTrend === 'bearish') {
    regime = 'Trending Bearish';
  }

  // Compute deterministic structure score (-100 to +100) from verified signals only
  let points = 0;
  let maxWeight = 0;

  // Component A: Structural Trend & Latest Break (weight 45)
  maxWeight += 45;
  if (structuralTrend === 'bullish') points += 30;
  else if (structuralTrend === 'bearish') points -= 30;
  if (latestEvent?.status === 'VALIDATED') {
    points += latestEvent.direction === 'bullish' ? 15 : -15;
  }

  // Component B: EMA Alignment (only counted for EMAs with sufficient data)
  if (ema20 !== null && ema50 !== null) {
    maxWeight += 25;
    if (latestPrice > ema20 && ema20 > ema50) points += 25;
    else if (latestPrice < ema20 && ema20 < ema50) points -= 25;
    else if (latestPrice > ema50) points += 10;
    else if (latestPrice < ema50) points -= 10;
  }
  if (ema200 !== null) {
    maxWeight += 15;
    points += latestPrice > ema200 ? 15 : -15;
  }

  // Component C: Momentum (RSI & MACD when available)
  if (rsi14 !== null) {
    maxWeight += 10;
    if (rsi14 > 54) points += 10;
    else if (rsi14 < 46) points -= 10;
  }
  if (macd !== null && macdSignal !== null && macdHist !== null) {
    maxWeight += 10;
    if (macd > macdSignal && macdHist > 0) points += 10;
    else if (macd < macdSignal && macdHist < 0) points -= 10;
  }

  const structureScore = maxWeight > 0 ? Math.round((points / maxWeight) * 100) : 0;
  const directionalLean: TimeframeAnalysisResult['directionalLean'] =
    structureScore >= 20 ? 'Bullish' : structureScore <= -20 ? 'Bearish' : 'Neutral';

  return {
    symbol,
    timeframe,
    barCount: candles.length,
    sufficient: true,
    latestPrice,
    latestTimestamp,
    indicators: {
      rsi14,
      macd,
      macdSignal,
      macdHist,
      ema20,
      ema50,
      ema200,
      atr14,
      atrPct,
      adx14: adxSnap?.adx ?? null,
      plusDI14: adxSnap?.plusDI ?? null,
      minusDI14: adxSnap?.minusDI ?? null,
      volume,
      missingReasons,
    },
    regime,
    swings: swings.slice(-16),
    structureEvents: structureEvents.slice(-10),
    latestBOS,
    latestCHoCH,
    latestMSS,
    liquidityPools: liquidityPools.slice(-12),
    liquiditySweeps: liquiditySweeps.slice(-6),
    fairValueGaps: fairValueGaps.filter((f) => f.status !== 'INVALIDATED').slice(-8),
    orderBlocks: orderBlocks.filter((o) => o.status !== 'INVALIDATED').slice(-8),
    displacements: displacements.slice(-6),
    premiumDiscount,
    supports,
    resistances,
    pivot,
    directionalLean,
    structureScore,
  };
}
