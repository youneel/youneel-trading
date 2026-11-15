import { SupportedSymbol, SupportedTimeframe, roundPrice } from './tradingMath.js';
import {
  CandleData,
  analyzeTimeframe,
  calculateEMASeries,
  calculateRSISeries,
  calculateMACDSeries,
  calculateATRSeries,
  TimeframeAnalysisResult,
} from './analysisEngine.js';

export type { CandleData };

export function calculateEMA(prices: number[], period: number): number[] {
  const series = calculateEMASeries(prices, period);
  if (series.length === 0) return [];
  return series.map((v) => (Number.isFinite(v) ? v : prices[0] ?? 0));
}

export function calculateRSI(prices: number[], period = 14): number[] {
  return calculateRSISeries(prices, period);
}

export function calculateMACD(prices: number[], fast = 12, slow = 26, signal = 9) {
  return calculateMACDSeries(prices, fast, slow, signal) || { macd: [], signal: [], histogram: [] };
}

export function calculateATR(candles: CandleData[], period = 14): number[] {
  return calculateATRSeries(candles, period);
}

export interface SupportResistanceLevels {
  resistances: number[];
  supports: number[];
  pivot: number;
}

export interface ComprehensiveAnalysis {
  symbol: string;
  timeframe: SupportedTimeframe;
  bias: 'Bullish' | 'Bearish' | 'Neutral' | 'Insufficient Data';
  alignmentScore: number; // 0 - 100 transparent directional alignment percentage
  confidenceScore: number; // kept for legacy callers, mirrors alignmentScore
  agreementCount: number;
  totalConditions: number;
  indicators: {
    rsi: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHist: number | null;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
    atr: number | null;
    adx: number | null;
  };
  levels: SupportResistanceLevels;
  trendStructure: {
    trend: string;
    description: string;
  };
  smc: TimeframeAnalysisResult;
  writtenRationale: string;
  disclaimer: string;
}

export function performMarketAnalysis(
  symbol: string,
  candles: CandleData[],
  timeframe: SupportedTimeframe = 'H1'
): ComprehensiveAnalysis {
  const sym = symbol as SupportedSymbol;
  const tfAnalysis = analyzeTimeframe(sym, timeframe, candles);
  const disclaimer =
    'DISCLAIMER: Educational technical analysis derived strictly from historical OHLCV calculations. Not financial, investment, or trading advice.';

  if (!tfAnalysis.sufficient) {
    return {
      symbol,
      timeframe,
      bias: 'Insufficient Data',
      alignmentScore: 0,
      confidenceScore: 0,
      agreementCount: 0,
      totalConditions: 0,
      indicators: {
        rsi: tfAnalysis.indicators.rsi14,
        macd: tfAnalysis.indicators.macd,
        macdSignal: tfAnalysis.indicators.macdSignal,
        macdHist: tfAnalysis.indicators.macdHist,
        ema20: tfAnalysis.indicators.ema20,
        ema50: tfAnalysis.indicators.ema50,
        ema200: tfAnalysis.indicators.ema200,
        atr: tfAnalysis.indicators.atr14,
        adx: tfAnalysis.indicators.adx14,
      },
      levels: { resistances: [], supports: [], pivot: 0 },
      trendStructure: {
        trend: 'Insufficient Data',
        description: tfAnalysis.sufficiencyNote || 'Insufficient historical candles for reliable structure.',
      },
      smc: tfAnalysis,
      writtenRationale: tfAnalysis.sufficiencyNote || 'Insufficient historical candle depth.',
      disclaimer,
    };
  }

  const score = tfAnalysis.structureScore;
  const absScore = Math.min(100, Math.abs(score));
  const bias: ComprehensiveAnalysis['bias'] = tfAnalysis.directionalLean;
  const supPrices = tfAnalysis.supports.map((s) => s.price);
  const resPrices = tfAnalysis.resistances.map((r) => r.price);
  const pivot = tfAnalysis.pivot ?? roundPrice(tfAnalysis.latestPrice, sym);

  const ind = tfAnalysis.indicators;
  const descParts: string[] = [`${timeframe} regime: ${tfAnalysis.regime}`];
  if (tfAnalysis.latestBOS) {
    descParts.push(
      `Latest ${tfAnalysis.latestBOS.direction} BOS @ ${tfAnalysis.latestBOS.brokenLevel}`
    );
  }
  if (tfAnalysis.latestCHoCH) {
    descParts.push(
      `Latest ${tfAnalysis.latestCHoCH.direction} ${tfAnalysis.latestCHoCH.type} @ ${tfAnalysis.latestCHoCH.brokenLevel}`
    );
  }
  if (tfAnalysis.premiumDiscount) {
    descParts.push(
      `Price in ${tfAnalysis.premiumDiscount.currentZone} (${tfAnalysis.premiumDiscount.positionPct}% of dealing range)`
    );
  }

  const rationale = `${symbol} (${timeframe}) prints a ${bias} mathematical alignment (${absScore}% directional score). ${descParts.join('. ')}. ${
    ind.rsi14 !== null ? `RSI(14)=${ind.rsi14}` : 'RSI(14) unavailable'
  }${ind.adx14 !== null ? `, ADX(14)=${ind.adx14}` : ''}${
    ind.atr14 !== null ? `, ATR(14)=${ind.atr14}` : ''
  }.`;

  return {
    symbol,
    timeframe,
    bias,
    alignmentScore: absScore,
    confidenceScore: absScore,
    agreementCount: Math.round((absScore / 100) * 6),
    totalConditions: 6,
    indicators: {
      rsi: ind.rsi14,
      macd: ind.macd,
      macdSignal: ind.macdSignal,
      macdHist: ind.macdHist,
      ema20: ind.ema20,
      ema50: ind.ema50,
      ema200: ind.ema200,
      atr: ind.atr14,
      adx: ind.adx14,
    },
    levels: {
      supports: supPrices,
      resistances: resPrices,
      pivot,
    },
    trendStructure: {
      trend: tfAnalysis.regime,
      description: descParts.join(' · '),
    },
    smc: tfAnalysis,
    writtenRationale: rationale,
    disclaimer,
  };
}
