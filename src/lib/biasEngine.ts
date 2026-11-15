import { SupportedSymbol, SupportedTimeframe, INSTRUMENT_SPECS, roundPrice } from './tradingMath.js';
import {
  CandleData,
  TimeframeAnalysisResult,
  analyzeTimeframe,
  KeyLevelZone,
  LiquidityPool,
  LiquiditySweepEvent,
  FairValueGap,
  OrderBlock,
  MarketRegime,
} from './analysisEngine.js';

export type DailyBiasRating =
  | 'Strong Bullish'
  | 'Bullish'
  | 'Neutral'
  | 'Bearish'
  | 'Strong Bearish'
  | 'INSUFFICIENT DATA';

export type IntradayValidityStatus = 'VALID' | 'WEAKENING' | 'INVALIDATED';

export interface BiasWeights {
  higherTimeframe: number; // MN + W1 (default 0.30)
  daily: number;           // D1 (default 0.25)
  h4: number;              // H4 (default 0.20)
  h1: number;              // H1 (default 0.15)
  momentumVolatility: number; // Momentum & ADX (default 0.10)
}

export const DEFAULT_BIAS_WEIGHTS: BiasWeights = {
  higherTimeframe: 0.30,
  daily: 0.25,
  h4: 0.20,
  h1: 0.15,
  momentumVolatility: 0.10,
};

export interface ScoringComponentDetail {
  component: string;
  weightPct: number;
  available: boolean;
  rawScore: number; // -100 to +100
  weightedContribution: number;
  note: string;
}

export interface MultiTimeframeRow {
  timeframe: SupportedTimeframe;
  barCount: number;
  sufficient: boolean;
  regime: MarketRegime;
  directionalLean: TimeframeAnalysisResult['directionalLean'];
  structureScore: number;
  latestEvent: string;
  rsi14: number | null;
  adx14: number | null;
  atr14: number | null;
  emaAlignment: string;
  premiumDiscountZone: string;
  latestTimestamp: string;
}

export interface DailyAnalysisSnapshot {
  id: string;
  symbol: SupportedSymbol;
  displayName: string;
  marketType: string;
  tradingDate: string;          // YYYY-MM-DD in America/New_York market date
  timezone: string;             // 'America/New_York'
  analysisTimestamp: string;    // ISO UTC timestamp
  modelVersion: string;
  referencePrice: number;
  dataQuality: {
    status: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT';
    availableWeightPct: number;
    missingTimeframes: SupportedTimeframe[];
    notes: string[];
  };
  marketDataRef: {
    quoteSource: string;
    quoteTimestamp: string;
    timeframeSources: Record<string, { source: string; bars: number; latestBar: string }>;
  };
  dailyBias: DailyBiasRating;
  bullishScore: number;          // 0 - 100
  bearishScore: number;          // 0 - 100
  netScore: number;              // -100 to +100
  directionalAlignmentScore: number; // 0 - 100 (transparent weighted directional agreement, NOT probability)
  scoringBreakdown: ScoringComponentDetail[];
  weightsUsed: BiasWeights;
  timeframeConflicts: string[];
  mtfTable: MultiTimeframeRow[];
  marketStructure: {
    primaryRegime: MarketRegime;
    dailySummary: string;
    h4Summary: string;
    h1Summary: string;
    recentEvents: {
      type: string;
      direction: string;
      level: number;
      timeframe: SupportedTimeframe;
      timestamp: string;
      status: string;
      invalidation: string;
    }[];
  };
  liquidity: {
    buySide: LiquidityPool[];
    sellSide: LiquidityPool[];
    recentSweeps: LiquiditySweepEvent[];
  };
  importantZones: {
    supports: KeyLevelZone[];
    resistances: KeyLevelZone[];
    orderBlocks: OrderBlock[];
    fairValueGaps: FairValueGap[];
    premiumDiscount: TimeframeAnalysisResult['premiumDiscount'];
  };
  keyLevels: KeyLevelZone[];
  bullishScenario: {
    trigger: string;
    targets: number[];
    rationale: string;
  };
  bearishScenario: {
    trigger: string;
    targets: number[];
    rationale: string;
  };
  invalidationConditions: {
    primaryInvalidationPrice: number | null;
    direction: 'above' | 'below' | 'range_break';
    rule: string;
    secondaryRules: string[];
  };
  marketConditions: {
    volatilityState: string;
    atrDaily: number | null;
    atrDailyPct: number | null;
    trendStrengthAdx: number | null;
    volumeAssessment: string;
    relevantNews: { title: string; source: string; publishedAt: string; url: string }[];
  };
  summary: string;
  aiAnalyst: {
    used: boolean;
    model: string | null;
    structureExplanation?: string;
    evidenceSummary?: string;
    bullishNarrative?: string;
    bearishNarrative?: string;
    conflictsNarrative?: string;
    invalidationExplanation?: string;
    conclusion?: string;
    error?: string;
  };
}

export interface IntradayUpdateRecord {
  id: string;
  snapshotId: string;
  symbol: SupportedSymbol;
  tradingDate: string;
  timestamp: string;
  currentPrice: number;
  priceDeltaFromSnapshot: number;
  priceDeltaPct: number;
  originalBias: DailyBiasRating;
  validityStatus: IntradayValidityStatus;
  h1Score: number;
  m15Score: number;
  reason: string;
}

export interface TimeframeCandleInput {
  timeframe: SupportedTimeframe;
  candles: CandleData[];
  source: string;
}

export function getMarketTradingDateNY(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function summarizeEmaAlignment(res: TimeframeAnalysisResult): string {
  const { ema20, ema50, ema200 } = res.indicators;
  const p = res.latestPrice;
  if (ema20 === null && ema50 === null) return 'Insufficient bars';
  if (ema20 !== null && ema50 !== null && ema200 !== null) {
    if (p > ema20 && ema20 > ema50 && ema50 > ema200) return 'Bullish Stack (P>20>50>200)';
    if (p < ema20 && ema20 < ema50 && ema50 < ema200) return 'Bearish Stack (P<20<50<200)';
    return `Mixed (20:${ema20} / 50:${ema50} / 200:${ema200})`;
  }
  if (ema20 !== null && ema50 !== null) {
    if (p > ema20 && ema20 > ema50) return 'Bullish (P>20>50)';
    if (p < ema20 && ema20 < ema50) return 'Bearish (P<20<50)';
    return `Mixed (20:${ema20} / 50:${ema50})`;
  }
  return ema20 !== null ? (p > ema20 ? `Above EMA20 (${ema20})` : `Below EMA20 (${ema20})`) : 'Partial';
}

export function computeDailyMarketAnalysis(params: {
  symbol: SupportedSymbol;
  referencePrice: number;
  quoteSource: string;
  quoteTimestamp: string;
  candlesByTimeframe: Partial<Record<SupportedTimeframe, TimeframeCandleInput>>;
  relevantNews?: { title: string; source: string; publishedAt: string; url: string }[];
  weights?: BiasWeights;
  now?: Date;
}): DailyAnalysisSnapshot {
  const {
    symbol,
    referencePrice,
    quoteSource,
    quoteTimestamp,
    candlesByTimeframe,
    relevantNews = [],
    weights = DEFAULT_BIAS_WEIGHTS,
    now = new Date(),
  } = params;

  const spec = INSTRUMENT_SPECS[symbol];
  const dec = spec.decimals;
  const tradingDate = getMarketTradingDateNY(now);
  const analysisTimestamp = now.toISOString();

  const orderedTfs: SupportedTimeframe[] = ['MN', 'W1', 'D1', 'H4', 'H1', 'M15', 'M5'];
  const analyses: Partial<Record<SupportedTimeframe, TimeframeAnalysisResult>> = {};
  const timeframeSources: Record<string, { source: string; bars: number; latestBar: string }> = {};
  const missingTimeframes: SupportedTimeframe[] = [];
  const dataNotes: string[] = [];

  for (const tf of orderedTfs) {
    const input = candlesByTimeframe[tf];
    if (!input || input.candles.length === 0) {
      missingTimeframes.push(tf);
      dataNotes.push(`${tf}: No candles retrieved from upstream provider.`);
      continue;
    }
    const res = analyzeTimeframe(symbol, tf, input.candles);
    analyses[tf] = res;
    timeframeSources[tf] = {
      source: input.source,
      bars: input.candles.length,
      latestBar: res.latestTimestamp,
    };
    if (!res.sufficient) {
      missingTimeframes.push(tf);
      if (res.sufficiencyNote) dataNotes.push(res.sufficiencyNote);
    }
  }

  const mn = analyses.MN;
  const w1 = analyses.W1;
  const d1 = analyses.D1;
  const h4 = analyses.H4;
  const h1 = analyses.H1;
  const m15 = analyses.M15;

  // Compute deterministic weighted scoring components
  const scoringBreakdown: ScoringComponentDetail[] = [];
  let activeWeightSum = 0;
  let weightedRawSum = 0;

  // 1. Higher-Timeframe Structure (MN + W1 = 30%)
  const htfAvailable = Boolean((mn && mn.sufficient) || (w1 && w1.sufficient));
  let htfRaw = 0;
  let htfNote = '';
  if (mn?.sufficient && w1?.sufficient) {
    htfRaw = Math.round(mn.structureScore * 0.5 + w1.structureScore * 0.5);
    htfNote = `MN=${mn.directionalLean} (${mn.structureScore}), W1=${w1.directionalLean} (${w1.structureScore})`;
  } else if (w1?.sufficient) {
    htfRaw = w1.structureScore;
    htfNote = `W1=${w1.directionalLean} (${w1.structureScore}); MN insufficient`;
  } else if (mn?.sufficient) {
    htfRaw = mn.structureScore;
    htfNote = `MN=${mn.directionalLean} (${mn.structureScore}); W1 insufficient`;
  } else {
    htfNote = 'MN and W1 historical depth insufficient';
  }
  if (htfAvailable) {
    activeWeightSum += weights.higherTimeframe;
    weightedRawSum += htfRaw * weights.higherTimeframe;
  }
  scoringBreakdown.push({
    component: 'Higher-Timeframe Structure (MN + W1)',
    weightPct: Math.round(weights.higherTimeframe * 100),
    available: htfAvailable,
    rawScore: htfRaw,
    weightedContribution: Number((htfRaw * weights.higherTimeframe).toFixed(2)),
    note: htfNote,
  });

  // 2. Daily Structure (25%)
  const d1Available = Boolean(d1 && d1.sufficient);
  const d1Raw = d1Available ? d1!.structureScore : 0;
  if (d1Available) {
    activeWeightSum += weights.daily;
    weightedRawSum += d1Raw * weights.daily;
  }
  scoringBreakdown.push({
    component: 'Daily Structure (D1)',
    weightPct: Math.round(weights.daily * 100),
    available: d1Available,
    rawScore: d1Raw,
    weightedContribution: Number((d1Raw * weights.daily).toFixed(2)),
    note: d1Available ? `D1=${d1!.directionalLean} (${d1!.regime})` : 'D1 candles insufficient',
  });

  // 3. 4H Structure (20%)
  const h4Available = Boolean(h4 && h4.sufficient);
  const h4Raw = h4Available ? h4!.structureScore : 0;
  if (h4Available) {
    activeWeightSum += weights.h4;
    weightedRawSum += h4Raw * weights.h4;
  }
  scoringBreakdown.push({
    component: '4H Structure (H4)',
    weightPct: Math.round(weights.h4 * 100),
    available: h4Available,
    rawScore: h4Raw,
    weightedContribution: Number((h4Raw * weights.h4).toFixed(2)),
    note: h4Available ? `H4=${h4!.directionalLean} (${h4!.regime})` : 'H4 candles insufficient',
  });

  // 4. 1H Confirmation (15%)
  const h1Available = Boolean(h1 && h1.sufficient);
  const h1Raw = h1Available ? h1!.structureScore : 0;
  if (h1Available) {
    activeWeightSum += weights.h1;
    weightedRawSum += h1Raw * weights.h1;
  }
  scoringBreakdown.push({
    component: '1H Confirmation (H1)',
    weightPct: Math.round(weights.h1 * 100),
    available: h1Available,
    rawScore: h1Raw,
    weightedContribution: Number((h1Raw * weights.h1).toFixed(2)),
    note: h1Available ? `H1=${h1!.directionalLean} (${h1!.regime})` : 'H1 candles insufficient',
  });

  // 5. Momentum & Volatility (10%): Derived from D1/H4 RSI, MACD Hist, ADX +DI/-DI
  const momSource = d1?.sufficient ? d1 : h4?.sufficient ? h4 : h1?.sufficient ? h1 : null;
  let momAvailable = false;
  let momRaw = 0;
  let momNotes: string[] = [];
  if (momSource) {
    let mPts = 0;
    let mDenom = 0;
    const ind = momSource.indicators;
    if (ind.rsi14 !== null) {
      mDenom += 35;
      if (ind.rsi14 >= 55) mPts += 35;
      else if (ind.rsi14 <= 45) mPts -= 35;
      momNotes.push(`RSI=${ind.rsi14}`);
    }
    if (ind.macdHist !== null && ind.macd !== null && ind.macdSignal !== null) {
      mDenom += 35;
      if (ind.macd > ind.macdSignal && ind.macdHist > 0) mPts += 35;
      else if (ind.macd < ind.macdSignal && ind.macdHist < 0) mPts -= 35;
      momNotes.push(`MACD_Hist=${ind.macdHist}`);
    }
    if (ind.adx14 !== null && ind.plusDI14 !== null && ind.minusDI14 !== null) {
      mDenom += 30;
      const strengthScale = ind.adx14 >= 22 ? 1 : 0.45;
      if (ind.plusDI14 > ind.minusDI14) mPts += Math.round(30 * strengthScale);
      else if (ind.minusDI14 > ind.plusDI14) mPts -= Math.round(30 * strengthScale);
      momNotes.push(`ADX=${ind.adx14} (+DI:${ind.plusDI14}/-DI:${ind.minusDI14})`);
    }
    if (mDenom > 0) {
      momAvailable = true;
      momRaw = Math.round((mPts / mDenom) * 100);
    }
  }
  if (momAvailable) {
    activeWeightSum += weights.momentumVolatility;
    weightedRawSum += momRaw * weights.momentumVolatility;
  }
  scoringBreakdown.push({
    component: 'Momentum & Volatility (RSI / MACD / ADX)',
    weightPct: Math.round(weights.momentumVolatility * 100),
    available: momAvailable,
    rawScore: momRaw,
    weightedContribution: Number((momRaw * weights.momentumVolatility).toFixed(2)),
    note: momAvailable ? momNotes.join(', ') : 'Insufficient bars for momentum/volatility suite',
  });

  const availableWeightPct = Math.round(activeWeightSum * 100);
  const normalizedNetScore = activeWeightSum > 0 ? Math.round(weightedRawSum / activeWeightSum) : 0;

  // Compute explicit Bullish Score & Bearish Score (0 - 100) from components
  let bullAccum = 0;
  let bearAccum = 0;
  for (const comp of scoringBreakdown) {
    if (!comp.available) continue;
    const w = comp.weightPct / Math.max(1, availableWeightPct);
    if (comp.rawScore > 0) bullAccum += (comp.rawScore / 100) * w * 100;
    else if (comp.rawScore < 0) bearAccum += (Math.abs(comp.rawScore) / 100) * w * 100;
  }
  const bullishScore = Math.round(bullAccum);
  const bearishScore = Math.round(bearAccum);
  const directionalAlignmentScore = Math.min(100, Math.abs(normalizedNetScore));

  // Detect Timeframe Conflicts
  const timeframeConflicts: string[] = [];
  const coreTfs: [string, TimeframeAnalysisResult | undefined][] = [
    ['Monthly', mn],
    ['Weekly', w1],
    ['Daily', d1],
    ['4H', h4],
    ['1H', h1],
  ];
  for (let i = 0; i < coreTfs.length; i++) {
    for (let j = i + 1; j < coreTfs.length; j++) {
      const [nA, a] = coreTfs[i];
      const [nB, b] = coreTfs[j];
      if (!a?.sufficient || !b?.sufficient) continue;
      if (
        (a.directionalLean === 'Bullish' && b.directionalLean === 'Bearish') ||
        (a.directionalLean === 'Bearish' && b.directionalLean === 'Bullish')
      ) {
        timeframeConflicts.push(
          `${nA} (${a.directionalLean}, score ${a.structureScore}) diverges from ${nB} (${b.directionalLean}, score ${b.structureScore})`
        );
      }
    }
  }

  // Strict Data Quality Gate: never invent a bias if D1 is missing or < 55% total weight is available
  let dataQualityStatus: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT' = 'COMPLETE';
  if (!d1Available || availableWeightPct < 55) {
    dataQualityStatus = 'INSUFFICIENT';
  } else if (missingTimeframes.length > 0) {
    dataQualityStatus = 'PARTIAL';
  }

  let dailyBias: DailyBiasRating = 'INSUFFICIENT DATA';
  if (dataQualityStatus !== 'INSUFFICIENT') {
    const hasMajorConflict = Boolean(
      w1?.sufficient &&
        d1?.sufficient &&
        w1.directionalLean !== 'Neutral' &&
        d1.directionalLean !== 'Neutral' &&
        w1.directionalLean !== d1.directionalLean
    );

    if (normalizedNetScore >= 55 && !hasMajorConflict) dailyBias = 'Strong Bullish';
    else if (normalizedNetScore >= 18) dailyBias = 'Bullish';
    else if (normalizedNetScore <= -55 && !hasMajorConflict) dailyBias = 'Strong Bearish';
    else if (normalizedNetScore <= -18) dailyBias = 'Bearish';
    else dailyBias = 'Neutral';
  }

  // Build MTF comparison table across all 7 timeframes
  const mtfTable: MultiTimeframeRow[] = orderedTfs.map((tf) => {
    const r = analyses[tf];
    if (!r) {
      return {
        timeframe: tf,
        barCount: 0,
        sufficient: false,
        regime: 'Insufficient Data',
        directionalLean: 'Insufficient Data',
        structureScore: 0,
        latestEvent: 'Unavailable',
        rsi14: null,
        adx14: null,
        atr14: null,
        emaAlignment: 'No data',
        premiumDiscountZone: 'N/A',
        latestTimestamp: '',
      };
    }
    const lastEv = r.structureEvents[r.structureEvents.length - 1];
    return {
      timeframe: tf,
      barCount: r.barCount,
      sufficient: r.sufficient,
      regime: r.regime,
      directionalLean: r.directionalLean,
      structureScore: r.structureScore,
      latestEvent: lastEv
        ? `${lastEv.direction === 'bullish' ? 'Bullish' : 'Bearish'} ${lastEv.type} @ ${lastEv.brokenLevel.toFixed(dec)}`
        : 'Range / Equilibrium',
      rsi14: r.indicators.rsi14,
      adx14: r.indicators.adx14,
      atr14: r.indicators.atr14,
      emaAlignment: summarizeEmaAlignment(r),
      premiumDiscountZone: r.premiumDiscount
        ? `${r.premiumDiscount.currentZone} (${r.premiumDiscount.positionPct}%)`
        : 'N/A',
      latestTimestamp: r.latestTimestamp,
    };
  });

  // Aggregate Liquidity, Important Zones & Key Levels from D1, H4, H1
  const sourceResults = [d1, h4, h1].filter((x): x is TimeframeAnalysisResult => Boolean(x?.sufficient));

  const buySide = sourceResults
    .flatMap((r) => r.liquidityPools.filter((l) => l.kind === 'BSL' || l.kind === 'EQH'))
    .sort((a, b) => a.price - b.price)
    .slice(0, 6);

  const sellSide = sourceResults
    .flatMap((r) => r.liquidityPools.filter((l) => l.kind === 'SSL' || l.kind === 'EQL'))
    .sort((a, b) => b.price - a.price)
    .slice(0, 6);

  const recentSweeps = sourceResults
    .flatMap((r) => r.liquiditySweeps)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  const supports = sourceResults
    .flatMap((r) => r.supports)
    .sort((a, b) => b.price - a.price)
    .slice(0, 4);

  const resistances = sourceResults
    .flatMap((r) => r.resistances)
    .sort((a, b) => a.price - b.price)
    .slice(0, 4);

  const orderBlocks = sourceResults
    .flatMap((r) => r.orderBlocks)
    .filter((o) => o.status !== 'INVALIDATED')
    .slice(-6);

  const fairValueGaps = sourceResults
    .flatMap((r) => r.fairValueGaps)
    .filter((f) => f.status !== 'INVALIDATED')
    .slice(-6);

  const recentEvents = sourceResults
    .flatMap((r) =>
      r.structureEvents.slice(-2).map((e) => ({
        type: e.type,
        direction: e.direction,
        level: e.brokenLevel,
        timeframe: e.timeframe,
        timestamp: e.timestamp,
        status: e.status,
        invalidation: e.invalidationCondition,
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  const keyLevels: KeyLevelZone[] = [
    ...resistances.slice(0, 2),
    ...supports.slice(0, 2),
    ...buySide.slice(0, 2).map((b) => ({
      label: `${b.kind} (${b.timeframe})`,
      category: 'liquidity' as const,
      price: b.price,
      high: b.upperBound,
      low: b.lowerBound,
      timeframe: b.timeframe,
      timestamp: b.timestamp,
      status: b.status,
      invalidationCondition: b.invalidationCondition,
    })),
    ...sellSide.slice(0, 2).map((s) => ({
      label: `${s.kind} (${s.timeframe})`,
      category: 'liquidity' as const,
      price: s.price,
      high: s.upperBound,
      low: s.lowerBound,
      timeframe: s.timeframe,
      timestamp: s.timestamp,
      status: s.status,
      invalidationCondition: s.invalidationCondition,
    })),
    ...orderBlocks.slice(-2).map((ob) => ({
      label: `${ob.direction === 'bullish' ? 'Bullish' : 'Bearish'} OB (${ob.timeframe})`,
      category: 'order_block' as const,
      price: ob.midpoint,
      high: ob.high,
      low: ob.low,
      timeframe: ob.timeframe,
      timestamp: ob.timestamp,
      status: ob.status,
      invalidationCondition: ob.invalidationCondition,
    })),
    ...fairValueGaps.slice(-2).map((f) => ({
      label: `${f.direction === 'bullish' ? 'Bullish' : 'Bearish'} FVG (${f.timeframe})`,
      category: 'fvg' as const,
      price: f.midpoint,
      high: f.high,
      low: f.low,
      timeframe: f.timeframe,
      timestamp: f.timestamp,
      status: f.status,
      invalidationCondition: f.invalidationCondition,
    })),
  ];

  // Primary Anchor Levels for Scenarios & Invalidation
  const activePrice = referencePrice || d1?.latestPrice || h4?.latestPrice || h1?.latestPrice || 0;
  const nearRes = resistances[0]?.price ?? buySide[0]?.price ?? roundPrice(activePrice * 1.01, symbol);
  const farRes = buySide[1]?.price ?? resistances[1]?.price ?? roundPrice(activePrice * 1.022, symbol);
  const nearSup = supports[0]?.price ?? sellSide[0]?.price ?? roundPrice(activePrice * 0.99, symbol);
  const farSup = sellSide[1]?.price ?? supports[1]?.price ?? roundPrice(activePrice * 0.978, symbol);

  const bullOB = [...orderBlocks].reverse().find((o) => o.direction === 'bullish');
  const bearOB = [...orderBlocks].reverse().find((o) => o.direction === 'bearish');

  const bullishTriggerLevel =
    dailyBias === 'Bearish' || dailyBias === 'Strong Bearish'
      ? nearRes
      : bullOB?.high ?? nearSup;

  const bearishTriggerLevel =
    dailyBias === 'Bullish' || dailyBias === 'Strong Bullish'
      ? nearSup
      : bearOB?.low ?? nearRes;

  const bullishScenario = {
    trigger:
      dailyBias === 'Bullish' || dailyBias === 'Strong Bullish'
        ? `Hold above ${nearSup.toFixed(dec)} demand / confirm 1H BOS above ${nearRes.toFixed(dec)}`
        : `Reclaim and close H4 candle above ${bullishTriggerLevel.toFixed(dec)} to trigger bullish CHoCH`,
    targets: [nearRes, farRes].filter((v) => v > 0),
    rationale: `Requires buyer defense of ${nearSup.toFixed(dec)} (${supports[0]?.timeframe ?? 'H4'}) and expansion toward resting BSL at ${farRes.toFixed(dec)}.`,
  };

  const bearishScenario = {
    trigger:
      dailyBias === 'Bearish' || dailyBias === 'Strong Bearish'
        ? `Reject below ${nearRes.toFixed(dec)} supply / confirm 1H breakdown below ${nearSup.toFixed(dec)}`
        : `Break and close H4 candle below ${bearishTriggerLevel.toFixed(dec)} to shift H4 structure bearish`,
    targets: [nearSup, farSup].filter((v) => v > 0),
    rationale: `Requires seller defense at ${nearRes.toFixed(dec)} and liquidity draw into SSL at ${farSup.toFixed(dec)}.`,
  };

  // Explicit Invalidation Rule based on active bias
  let primaryInvalidationPrice: number | null = null;
  let invDirection: 'above' | 'below' | 'range_break' = 'range_break';
  let invRule = '';

  if (dailyBias === 'Bullish' || dailyBias === 'Strong Bullish') {
    primaryInvalidationPrice = bullOB?.low ?? nearSup;
    invDirection = 'below';
    invRule = `H4 or D1 candle close below ${primaryInvalidationPrice.toFixed(dec)} invalidates the bullish structural bias.`;
  } else if (dailyBias === 'Bearish' || dailyBias === 'Strong Bearish') {
    primaryInvalidationPrice = bearOB?.high ?? nearRes;
    invDirection = 'above';
    invRule = `H4 or D1 candle close above ${primaryInvalidationPrice.toFixed(dec)} invalidates the bearish structural bias.`;
  } else {
    primaryInvalidationPrice = nearRes;
    invDirection = 'range_break';
    invRule = `Sustained H4 close outside [${nearSup.toFixed(dec)} – ${nearRes.toFixed(dec)}] breaks current neutral equilibrium.`;
  }

  const secondaryRules: string[] = [];
  if (h1?.latestCHoCH && h1.latestCHoCH.status === 'VALIDATED') {
    secondaryRules.push(h1.latestCHoCH.invalidationCondition);
  }
  if (d1?.premiumDiscount) {
    secondaryRules.push(
      `Equilibrium threshold sits at ${d1.premiumDiscount.equilibrium.toFixed(dec)} (Daily 50% level).`
    );
  }

  // Volatility & Market Conditions
  const d1Atr = d1?.indicators.atr14 ?? null;
  const d1AtrPct = d1?.indicators.atrPct ?? null;
  const d1Adx = d1?.indicators.adx14 ?? h4?.indicators.adx14 ?? null;
  let volatilityState = 'Insufficient Volatility Data';
  if (d1AtrPct !== null) {
    volatilityState =
      d1AtrPct >= 1.8 ? 'Elevated / Expanding' : d1AtrPct <= 0.45 ? 'Compressed / Low' : 'Normal / Balanced';
  }
  const volAssessment =
    d1?.indicators.volume.available
      ? `${d1.indicators.volume.bias} (RVOL ${d1.indicators.volume.relativeVolume}x vs 20-bar avg)`
      : d1?.indicators.volume.reason || 'Volume unavailable on upstream spot/index feed';

  const summary =
    dailyBias === 'INSUFFICIENT DATA'
      ? `${symbol} daily bias is marked INSUFFICIENT DATA on ${tradingDate} because critical historical series (${missingTimeframes.join(', ')}) did not meet minimum mathematical bar thresholds.`
      : `${symbol} carries a ${dailyBias} deterministic daily bias on ${tradingDate} (${tradingDate} NY session) with a ${directionalAlignmentScore}% directional alignment score (Bullish ${bullishScore} vs Bearish ${bearishScore}). ${
          timeframeConflicts.length > 0
            ? `Caution: ${timeframeConflicts[0]}.`
            : 'Higher and intraday structures show constructive alignment.'
        } Key invalidation: ${invRule}`;

  return {
    id: `${symbol}_${tradingDate}`,
    symbol,
    displayName: spec.displayName,
    marketType: spec.marketType,
    tradingDate,
    timezone: 'America/New_York',
    analysisTimestamp,
    modelVersion: 'YOUNEEL-QUANT-v2.0',
    referencePrice: roundPrice(activePrice, symbol),
    dataQuality: {
      status: dataQualityStatus,
      availableWeightPct,
      missingTimeframes,
      notes: dataNotes,
    },
    marketDataRef: {
      quoteSource,
      quoteTimestamp,
      timeframeSources,
    },
    dailyBias,
    bullishScore,
    bearishScore,
    netScore: normalizedNetScore,
    directionalAlignmentScore,
    scoringBreakdown,
    weightsUsed: weights,
    timeframeConflicts,
    mtfTable,
    marketStructure: {
      primaryRegime: d1?.regime ?? h4?.regime ?? 'Insufficient Data',
      dailySummary: d1?.sufficient
        ? `D1 ${d1.regime} | Score ${d1.structureScore} | Latest: ${d1.structureEvents[d1.structureEvents.length - 1]?.type || 'Swing'} @ ${d1.latestPrice.toFixed(dec)}`
        : 'D1 structure unavailable (insufficient bars)',
      h4Summary: h4?.sufficient
        ? `H4 ${h4.regime} | Score ${h4.structureScore} | PD: ${h4.premiumDiscount?.currentZone || 'N/A'}`
        : 'H4 structure unavailable (insufficient bars)',
      h1Summary: h1?.sufficient
        ? `H1 ${h1.regime} | Score ${h1.structureScore} | RSI ${h1.indicators.rsi14 ?? 'N/A'}`
        : 'H1 structure unavailable (insufficient bars)',
      recentEvents,
    },
    liquidity: {
      buySide,
      sellSide,
      recentSweeps,
    },
    importantZones: {
      supports,
      resistances,
      orderBlocks,
      fairValueGaps,
      premiumDiscount: d1?.premiumDiscount ?? h4?.premiumDiscount ?? null,
    },
    keyLevels,
    bullishScenario,
    bearishScenario,
    invalidationConditions: {
      primaryInvalidationPrice,
      direction: invDirection,
      rule: invRule,
      secondaryRules,
    },
    marketConditions: {
      volatilityState,
      atrDaily: d1Atr,
      atrDailyPct: d1AtrPct,
      trendStrengthAdx: d1Adx,
      volumeAssessment: volAssessment,
      relevantNews,
    },
    summary,
    aiAnalyst: {
      used: false,
      model: null,
    },
  };
}

/**
 * Evaluates current live market action against today's immutable Daily Snapshot
 * without rewriting historical data.
 */
export function evaluateIntradayValidity(params: {
  snapshot: DailyAnalysisSnapshot;
  currentPrice: number;
  h1Analysis?: TimeframeAnalysisResult | null;
  m15Analysis?: TimeframeAnalysisResult | null;
  now?: Date;
}): IntradayUpdateRecord {
  const { snapshot, currentPrice, h1Analysis, m15Analysis, now = new Date() } = params;
  const dec = INSTRUMENT_SPECS[snapshot.symbol].decimals;
  const ref = snapshot.referencePrice || currentPrice;
  const delta = roundPrice(currentPrice - ref, snapshot.symbol);
  const deltaPct = ref > 0 ? Number(((delta / ref) * 100).toFixed(2)) : 0;

  const invPrice = snapshot.invalidationConditions.primaryInvalidationPrice;
  const invDir = snapshot.invalidationConditions.direction;
  const h1Score = h1Analysis?.sufficient ? h1Analysis.structureScore : 0;
  const m15Score = m15Analysis?.sufficient ? m15Analysis.structureScore : 0;

  let validityStatus: IntradayValidityStatus = 'VALID';
  let reason = `Price (${currentPrice.toFixed(dec)}) respects the original ${snapshot.dailyBias} bias parameters.`;

  if (snapshot.dailyBias === 'INSUFFICIENT DATA') {
    validityStatus = 'WEAKENING';
    reason = 'Original daily snapshot had insufficient multi-timeframe data.';
  } else if (invPrice !== null) {
    if (invDir === 'below' && currentPrice < invPrice) {
      validityStatus = 'INVALIDATED';
      reason = `Price (${currentPrice.toFixed(dec)}) breached below daily invalidation level ${invPrice.toFixed(dec)}.`;
    } else if (invDir === 'above' && currentPrice > invPrice) {
      validityStatus = 'INVALIDATED';
      reason = `Price (${currentPrice.toFixed(dec)}) breached above daily invalidation level ${invPrice.toFixed(dec)}.`;
    } else if (
      (snapshot.dailyBias.includes('Bullish') && h1Score <= -25) ||
      (snapshot.dailyBias.includes('Bearish') && h1Score >= 25)
    ) {
      validityStatus = 'WEAKENING';
      reason = `1H intraday structure shifted opposite (${h1Score}) against ${snapshot.dailyBias} daily bias while invalidation (${invPrice.toFixed(dec)}) remains intact.`;
    }
  }

  return {
    id: `${snapshot.symbol}_${snapshot.tradingDate}_${now.getTime()}`,
    snapshotId: snapshot.id,
    symbol: snapshot.symbol,
    tradingDate: snapshot.tradingDate,
    timestamp: now.toISOString(),
    currentPrice: roundPrice(currentPrice, snapshot.symbol),
    priceDeltaFromSnapshot: delta,
    priceDeltaPct: deltaPct,
    originalBias: snapshot.dailyBias,
    validityStatus,
    h1Score,
    m15Score,
    reason,
  };
}
