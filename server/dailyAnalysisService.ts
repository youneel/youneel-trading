import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  ALL_SUPPORTED_SYMBOLS,
  INSTRUMENT_SPECS,
  SupportedSymbol,
  roundPrice,
} from '../src/lib/tradingMath.js';
import { analyzeTimeframe } from '../src/lib/analysisEngine.js';
import {
  DailyAnalysisSnapshot,
  IntradayUpdateRecord,
  computeDailyMarketAnalysis,
  evaluateIntradayValidity,
  getMarketTradingDateNY,
} from '../src/lib/biasEngine.js';
import { getMultiTimeframeCandles, getVerifiedMarketData, getVerifiedQuote } from './marketData.js';
import { fetchVerifiedTodayNews } from './newsService.js';
import { getAdminClient } from './supabaseAdmin.js';

export interface SchedulerJobLog {
  id: string;
  jobType: 'daily_snapshot' | 'intraday_update';
  symbol: SupportedSymbol;
  tradingDate: string;
  status: 'success' | 'retrying' | 'failed' | 'skipped';
  attempts: number;
  error?: string;
  executedAt: string;
}

export interface HistoricalOutcomeEvaluation {
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

interface StoreData {
  snapshots: Record<string, DailyAnalysisSnapshot>; // key: `${symbol}_${tradingDate}`
  intradayUpdates: Record<string, IntradayUpdateRecord[]>; // key: snapshotId
  jobLogs: SchedulerJobLog[];
}

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
const BUNDLED_STORE_PATH = path.resolve(process.cwd(), 'data', 'daily_analyses.json');
const DATA_DIR = IS_SERVERLESS ? '/tmp/youneel-data' : path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'daily_analyses.json');

const inFlightSnapshots = new Map<string, Promise<DailyAnalysisSnapshot>>();
const aiRetryLastAttempt = new Map<string, number>();
const AI_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const readPath = fs.existsSync(STORE_PATH)
      ? STORE_PATH
      : IS_SERVERLESS && fs.existsSync(BUNDLED_STORE_PATH)
      ? BUNDLED_STORE_PATH
      : null;
    if (readPath) {
      const raw = fs.readFileSync(readPath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        snapshots: parsed.snapshots || {},
        intradayUpdates: parsed.intradayUpdates || {},
        jobLogs: Array.isArray(parsed.jobLogs) ? parsed.jobLogs : [],
      };
    }
  } catch (err: any) {
    console.warn('Warning loading daily_analyses.json:', err?.message);
  }
  return { snapshots: {}, intradayUpdates: {}, jobLogs: [] };
}

let store: StoreData = loadStore();

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err: any) {
    console.error('Failed saving daily_analyses.json:', err?.message);
  }
}

function recordJobLog(entry: Omit<SchedulerJobLog, 'id' | 'executedAt'>) {
  const full: SchedulerJobLog = {
    ...entry,
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    executedAt: new Date().toISOString(),
  };
  store.jobLogs.unshift(full);
  if (store.jobLogs.length > 200) {
    store.jobLogs = store.jobLogs.slice(0, 200);
  }
  saveStore();

  // Best-effort sync to Supabase if service role & table exist
  const admin = getAdminClient();
  if (admin) {
    Promise.resolve(
      admin.from('analysis_scheduler_jobs').insert([
        {
          job_type: full.jobType,
          symbol: full.symbol,
          trading_date: full.tradingDate,
          status: full.status,
          attempts: full.attempts,
          error_message: full.error || null,
          executed_at: full.executedAt,
        },
      ])
    ).catch(() => {});
  }
}

async function persistSnapshotToSupabase(snapshot: DailyAnalysisSnapshot) {
  const admin = getAdminClient();
  if (!admin) return;
  try {
    await admin.from('daily_market_analyses').upsert(
      {
        id: snapshot.id,
        symbol: snapshot.symbol,
        trading_date: snapshot.tradingDate,
        timezone: snapshot.timezone,
        analysis_timestamp: snapshot.analysisTimestamp,
        model_version: snapshot.modelVersion,
        reference_price: snapshot.referencePrice,
        daily_bias: snapshot.dailyBias,
        directional_alignment_score: snapshot.directionalAlignmentScore,
        data_quality_status: snapshot.dataQuality.status,
        payload: snapshot,
      },
      { onConflict: 'symbol,trading_date', ignoreDuplicates: true }
    );
  } catch {
    // Table may not be migrated yet; local durable store remains authoritative
  }
}

async function persistIntradayToSupabase(update: IntradayUpdateRecord) {
  const admin = getAdminClient();
  if (!admin) return;
  try {
    await admin.from('intraday_analysis_updates').insert({
      id: update.id,
      snapshot_id: update.snapshotId,
      symbol: update.symbol,
      trading_date: update.tradingDate,
      update_timestamp: update.timestamp,
      current_price: update.currentPrice,
      validity_status: update.validityStatus,
      payload: update,
    });
  } catch {
    // ignore if migration pending
  }
}

// ============================================================================
// GEMINI INTERPRETATION LAYER (STRICTLY EXPLANATION ONLY — NEVER CHANGES FACTS)
// ============================================================================
async function enrichWithGeminiExplanation(
  snapshot: DailyAnalysisSnapshot
): Promise<DailyAnalysisSnapshot> {
  if (snapshot.dailyBias === 'INSUFFICIENT DATA') {
    return {
      ...snapshot,
      aiAnalyst: {
        used: false,
        model: null,
        error: 'Skipped AI narrative because deterministic data quality is INSUFFICIENT DATA.',
      },
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      ...snapshot,
      aiAnalyst: {
        used: false,
        model: null,
        error: 'GEMINI_API_KEY not configured; displaying mathematical analysis only.',
      },
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const evidencePacket = {
      symbol: snapshot.symbol,
      displayName: snapshot.displayName,
      tradingDate: snapshot.tradingDate,
      referencePrice: snapshot.referencePrice,
      deterministicDailyBias: snapshot.dailyBias,
      directionalAlignmentScore: snapshot.directionalAlignmentScore,
      bullishScore: snapshot.bullishScore,
      bearishScore: snapshot.bearishScore,
      mtfSummary: snapshot.mtfTable.map((r) => ({
        tf: r.timeframe,
        regime: r.regime,
        lean: r.directionalLean,
        score: r.structureScore,
        latestEvent: r.latestEvent,
        rsi14: r.rsi14,
        adx14: r.adx14,
        zone: r.premiumDiscountZone,
      })),
      conflicts: snapshot.timeframeConflicts,
      buySideLiquidity: snapshot.liquidity.buySide.slice(0, 3).map((l) => ({ price: l.price, tf: l.timeframe })),
      sellSideLiquidity: snapshot.liquidity.sellSide.slice(0, 3).map((l) => ({ price: l.price, tf: l.timeframe })),
      supports: snapshot.importantZones.supports.slice(0, 3).map((s) => ({ price: s.price, tf: s.timeframe })),
      resistances: snapshot.importantZones.resistances.slice(0, 3).map((r) => ({ price: r.price, tf: r.timeframe })),
      orderBlocks: snapshot.importantZones.orderBlocks.slice(-3).map((o) => ({
        dir: o.direction,
        low: o.low,
        high: o.high,
        tf: o.timeframe,
        status: o.status,
      })),
      fairValueGaps: snapshot.importantZones.fairValueGaps.slice(-3).map((f) => ({
        dir: f.direction,
        low: f.low,
        high: f.high,
        tf: f.timeframe,
        status: f.status,
      })),
      bullishScenario: snapshot.bullishScenario,
      bearishScenario: snapshot.bearishScenario,
      invalidation: snapshot.invalidationConditions,
      marketConditions: {
        volatilityState: snapshot.marketConditions.volatilityState,
        atrDaily: snapshot.marketConditions.atrDaily,
        trendStrengthAdx: snapshot.marketConditions.trendStrengthAdx,
        relevantHeadlines: snapshot.marketConditions.relevantNews.map((n) => n.title),
      },
    };

    const prompt = `You are an institutional quantitative market analyst.
Your role is STRICTLY to interpret and explain the pre-calculated market facts below.

CRITICAL PROHIBITIONS:
- NEVER invent prices, order blocks, fair value gaps, liquidity levels, or news.
- NEVER change or override the deterministicDailyBias ("${snapshot.dailyBias}").
- NEVER state certainty about future price movement (never say "will definitely go up/down").
- ONLY reference numbers and structures present in the EVIDENCE JSON below.

EVIDENCE JSON:
${JSON.stringify(evidencePacket)}

Produce clear, objective, institutional prose for each section.`;

    const callPromise = ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            structureExplanation: {
              type: Type.STRING,
              description: '2-3 sentences explaining the calculated multi-timeframe market structure and regime.',
            },
            evidenceSummary: {
              type: Type.STRING,
              description: '2-3 sentences summarizing the exact mathematical evidence supporting the bias.',
            },
            bullishNarrative: {
              type: Type.STRING,
              description: '2 sentences explaining the calculated bullish scenario trigger and targets.',
            },
            bearishNarrative: {
              type: Type.STRING,
              description: '2 sentences explaining the calculated bearish scenario trigger and targets.',
            },
            conflictsNarrative: {
              type: Type.STRING,
              description: '1-2 sentences highlighting any timeframe conflicts or noting alignment if none exist.',
            },
            invalidationExplanation: {
              type: Type.STRING,
              description: '1-2 sentences explaining the exact invalidation threshold and why it voids the bias.',
            },
            conclusion: {
              type: Type.STRING,
              description: 'Concise 2-sentence institutional conclusion with no certainty claims.',
            },
          },
          required: [
            'structureExplanation',
            'evidenceSummary',
            'bullishNarrative',
            'bearishNarrative',
            'conflictsNarrative',
            'invalidationExplanation',
            'conclusion',
          ],
        },
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemini explanation request timed out')), 10000)
    );

    const response: any = await Promise.race([callPromise, timeoutPromise]);
    const parsed = JSON.parse((response.text || '{}').trim());

    return {
      ...snapshot,
      aiAnalyst: {
        used: true,
        model: 'gemini-4-hydrogen',
        structureExplanation: parsed.structureExplanation,
        evidenceSummary: parsed.evidenceSummary,
        bullishNarrative: parsed.bullishNarrative,
        bearishNarrative: parsed.bearishNarrative,
        conflictsNarrative: parsed.conflictsNarrative,
        invalidationExplanation: parsed.invalidationExplanation,
        conclusion: parsed.conclusion,
      },
    };
  } catch (err: any) {
    return {
      ...snapshot,
      aiAnalyst: {
        used: false,
        model: null,
        error: err?.message || 'Gemini explanation layer unavailable',
      },
    };
  }
}

// Filter verified news items matching an instrument
function matchRelevantNews(symbol: SupportedSymbol, allNews: any[]): {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
}[] {
  const keywordsBySymbol: Record<SupportedSymbol, string[]> = {
    XAUUSD: ['gold', 'xau', 'fed', 'treasury', 'inflation', 'cpi', 'rate', 'dollar'],
    NASDAQ: ['nasdaq', 'tech', 'ai', 'stock', 'fed', 'yield', 'fomc', 'cpi', 'earnings'],
    BTCUSD: ['bitcoin', 'btc', 'crypto', 'sec', 'etf', 'coinbase', 'digital asset'],
    EURUSD: ['euro', 'ecb', 'eur', 'fed', 'dollar', 'inflation', 'cpi', 'lagarde'],
    GBPUSD: ['pound', 'boe', 'uk', 'gbp', 'bank of england', 'dollar', 'fed'],
    USDJPY: ['yen', 'boj', 'japan', 'jpy', 'yield', 'fed', 'dollar', 'ueda'],
    US30: ['dow', 'industrial', 'stocks', 'fed', 'wall street', 'cpi', 'jobs', 'payroll'],
    USOIL: ['oil', 'crude', 'wti', 'opec', 'energy', 'brent', 'barrel'],
  };

  const keys = keywordsBySymbol[symbol] || [];
  const matched = allNews.filter((item) => {
    const txt = `${item.title} ${item.summary}`.toLowerCase();
    return keys.some((k) => txt.includes(k));
  });

  return matched.slice(0, 4).map((m) => ({
    title: m.title,
    source: m.source,
    publishedAt: m.publishedAt,
    url: m.url,
  }));
}

// ============================================================================
// PUBLIC SERVICE FUNCTIONS
// ============================================================================

/**
 * Ensures an immutable daily snapshot exists for (symbol, today).
 * Never overwrites an existing daily snapshot for that trading date!
 */
export async function ensureDailySnapshot(symbol: SupportedSymbol): Promise<DailyAnalysisSnapshot> {
  const todayNY = getMarketTradingDateNY();
  const key = `${symbol}_${todayNY}`;

  // 1. Check in-memory/local durable store first (strictly immutable once created)
  if (store.snapshots[key]) {
    return store.snapshots[key];
  }

  // 2. Check Supabase if configured & migrated (in case container restarted without local disk)
  const admin = getAdminClient();
  if (admin) {
    try {
      const { data } = await admin
        .from('daily_market_analyses')
        .select('payload')
        .eq('symbol', symbol)
        .eq('trading_date', todayNY)
        .maybeSingle();
      if (data?.payload) {
        store.snapshots[key] = data.payload as DailyAnalysisSnapshot;
        saveStore();
        return store.snapshots[key];
      }
    } catch {
      // ignore if table missing
    }
  }

  // 3. Deduplicate concurrent creation requests
  if (inFlightSnapshots.has(key)) {
    return inFlightSnapshots.get(key)!;
  }

  const jobPromise = (async () => {
    const maxAttempts = 2;
    let lastErr: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const [mtfBundle, newsRes] = await Promise.all([
          getMultiTimeframeCandles(symbol, ['MN', 'W1', 'D1', 'H4', 'H1', 'M15', 'M5']),
          fetchVerifiedTodayNews().catch(() => ({ news: [] })),
        ]);

        const refPrice =
          mtfBundle.quote?.price ||
          mtfBundle.candlesByTimeframe.H1?.candles.slice(-1)[0]?.close ||
          mtfBundle.candlesByTimeframe.D1?.candles.slice(-1)[0]?.close ||
          0;

        const relevantNews = matchRelevantNews(symbol, newsRes.news || []);

        const deterministic = computeDailyMarketAnalysis({
          symbol,
          referencePrice: refPrice,
          quoteSource: mtfBundle.quote?.source || 'Unavailable',
          quoteTimestamp: mtfBundle.quote?.sourceTimestamp || new Date().toISOString(),
          candlesByTimeframe: mtfBundle.candlesByTimeframe,
          relevantNews,
        });

        const enriched = await enrichWithGeminiExplanation(deterministic);

        // Double-check nobody else wrote it while awaiting network
        if (!store.snapshots[key]) {
          store.snapshots[key] = enriched;
          saveStore();
          await persistSnapshotToSupabase(enriched);
        }

        // Create initial intraday checkpoint
        await createOrRefreshIntradayUpdate(symbol, store.snapshots[key]);

        recordJobLog({
          jobType: 'daily_snapshot',
          symbol,
          tradingDate: todayNY,
          status: 'success',
          attempts: attempt,
        });

        return store.snapshots[key];
      } catch (err: any) {
        lastErr = err;
        if (attempt < maxAttempts) {
          recordJobLog({
            jobType: 'daily_snapshot',
            symbol,
            tradingDate: todayNY,
            status: 'retrying',
            attempts: attempt,
            error: err?.message || 'Temporary provider failure',
          });
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    recordJobLog({
      jobType: 'daily_snapshot',
      symbol,
      tradingDate: todayNY,
      status: 'failed',
      attempts: maxAttempts,
      error: lastErr?.message || 'Failed generating daily analysis snapshot',
    });

    throw lastErr || new Error(`Failed to generate daily snapshot for ${symbol}`);
  })().finally(() => {
    inFlightSnapshots.delete(key);
  });

  inFlightSnapshots.set(key, jobPromise);
  return jobPromise;
}

/**
 * Evaluates current live price & H1/M15 structure against today's immutable snapshot
 * and appends an IntradayUpdateRecord separately when price moves or on refresh.
 */
export async function createOrRefreshIntradayUpdate(
  symbol: SupportedSymbol,
  snapshot?: DailyAnalysisSnapshot
): Promise<IntradayUpdateRecord | null> {
  const todayNY = getMarketTradingDateNY();
  const snap = snapshot || store.snapshots[`${symbol}_${todayNY}`];
  if (!snap) return null;

  try {
    const [quote, h1Data, m15Data] = await Promise.all([
      getVerifiedQuote(symbol),
      getVerifiedMarketData(symbol, 'H1').catch(() => null),
      getVerifiedMarketData(symbol, 'M15').catch(() => null),
    ]);

    const h1Analysis = h1Data ? analyzeTimeframe(symbol, 'H1', h1Data.candles) : null;
    const m15Analysis = m15Data ? analyzeTimeframe(symbol, 'M15', m15Data.candles) : null;

    const update = evaluateIntradayValidity({
      snapshot: snap,
      currentPrice: quote.price,
      h1Analysis,
      m15Analysis,
    });

    const list = store.intradayUpdates[snap.id] || [];
    const last = list[0];

    // Append only if first update, validity status changed, or >10 mins elapsed & price moved
    const elapsedMs = last ? Date.now() - new Date(last.timestamp).getTime() : Infinity;
    const priceChanged = !last || last.currentPrice !== update.currentPrice;
    const statusChanged = !last || last.validityStatus !== update.validityStatus;

    if (!last || statusChanged || (elapsedMs >= 10 * 60 * 1000 && priceChanged)) {
      list.unshift(update);
      store.intradayUpdates[snap.id] = list.slice(0, 48);
      saveStore();
      await persistIntradayToSupabase(update);
    }

    return update;
  } catch (err: any) {
    recordJobLog({
      jobType: 'intraday_update',
      symbol,
      tradingDate: todayNY,
      status: 'failed',
      attempts: 1,
      error: err?.message || 'Intraday update failed',
    });
    return null;
  }
}

/**
 * Compares a historical snapshot against subsequent real D1 candles after snapshot.tradingDate
 * without modifying the archived snapshot.
 */
export async function evaluateHistoricalOutcome(
  snapshot: DailyAnalysisSnapshot
): Promise<HistoricalOutcomeEvaluation> {
  const todayNY = getMarketTradingDateNY();
  if (snapshot.tradingDate >= todayNY) {
    return {
      evaluated: false,
      snapshotDate: snapshot.tradingDate,
      snapshotPrice: snapshot.referencePrice,
      subsequentDaysTracked: 0,
      latestObservedClose: null,
      periodHigh: null,
      periodLow: null,
      pctChangeSinceSnapshot: null,
      invalidationTouched: false,
      outcomeNote: 'Current trading session still active; historical close comparison applies to prior trading days.',
    };
  }

  try {
    const d1 = await getVerifiedMarketData(snapshot.symbol, 'D1');
    const snapDayEndSec = Math.floor(new Date(`${snapshot.tradingDate}T23:59:59Z`).getTime() / 1000);
    const laterBars = d1.candles.filter((c) => c.time > snapDayEndSec);

    if (laterBars.length === 0) {
      return {
        evaluated: false,
        snapshotDate: snapshot.tradingDate,
        snapshotPrice: snapshot.referencePrice,
        subsequentDaysTracked: 0,
        latestObservedClose: null,
        periodHigh: null,
        periodLow: null,
        pctChangeSinceSnapshot: null,
        invalidationTouched: false,
        outcomeNote: 'No subsequent settled daily bars available yet after this date.',
      };
    }

    const periodHigh = roundPrice(Math.max(...laterBars.map((b) => b.high)), snapshot.symbol);
    const periodLow = roundPrice(Math.min(...laterBars.map((b) => b.low)), snapshot.symbol);
    const latestObservedClose = roundPrice(laterBars[laterBars.length - 1].close, snapshot.symbol);
    const pctChange =
      snapshot.referencePrice > 0
        ? Number((((latestObservedClose - snapshot.referencePrice) / snapshot.referencePrice) * 100).toFixed(2))
        : 0;

    const inv = snapshot.invalidationConditions.primaryInvalidationPrice;
    const invDir = snapshot.invalidationConditions.direction;
    let invalidationTouched = false;
    if (inv !== null) {
      if (invDir === 'below') invalidationTouched = laterBars.some((b) => b.close < inv);
      else if (invDir === 'above') invalidationTouched = laterBars.some((b) => b.close > inv);
    }

    const dec = INSTRUMENT_SPECS[snapshot.symbol].decimals;
    const outcomeNote = `Across ${laterBars.length} subsequent daily session(s), price moved ${
      pctChange >= 0 ? '+' : ''
    }${pctChange}% (High: ${periodHigh.toFixed(dec)}, Low: ${periodLow.toFixed(dec)}, Latest Close: ${latestObservedClose.toFixed(
      dec
    )}). Daily invalidation threshold ${invalidationTouched ? 'WAS breached' : 'held intact'}.`;

    return {
      evaluated: true,
      snapshotDate: snapshot.tradingDate,
      snapshotPrice: snapshot.referencePrice,
      subsequentDaysTracked: laterBars.length,
      latestObservedClose,
      periodHigh,
      periodLow,
      pctChangeSinceSnapshot: pctChange,
      invalidationTouched,
      outcomeNote,
    };
  } catch (err: any) {
    return {
      evaluated: false,
      snapshotDate: snapshot.tradingDate,
      snapshotPrice: snapshot.referencePrice,
      subsequentDaysTracked: 0,
      latestObservedClose: null,
      periodHigh: null,
      periodLow: null,
      pctChangeSinceSnapshot: null,
      invalidationTouched: false,
      outcomeNote: `Unable to load subsequent D1 bars (${err?.message || 'provider unavailable'}).`,
    };
  }
}

export async function getDailyAnalysisView(symbol: SupportedSymbol, requestedDate?: string): Promise<{
  snapshot: DailyAnalysisSnapshot;
  intradayUpdates: IntradayUpdateRecord[];
  availableDates: string[];
  historicalOutcome: HistoricalOutcomeEvaluation;
  isPresentDay: boolean;
}> {
  const todayNY = getMarketTradingDateNY();
  const targetDate = requestedDate || todayNY;

  let snapshot: DailyAnalysisSnapshot | undefined = store.snapshots[`${symbol}_${targetDate}`];

  if (!snapshot && targetDate === todayNY) {
    snapshot = await ensureDailySnapshot(symbol);
  } else if (!snapshot) {
    // Check Supabase for historical date
    const admin = getAdminClient();
    if (admin) {
      try {
        const { data } = await admin
          .from('daily_market_analyses')
          .select('payload')
          .eq('symbol', symbol)
          .eq('trading_date', targetDate)
          .maybeSingle();
        if (data?.payload) {
          snapshot = data.payload as DailyAnalysisSnapshot;
          store.snapshots[`${symbol}_${targetDate}`] = snapshot;
          saveStore();
        }
      } catch {
        // ignore
      }
    }
  }

  if (!snapshot) {
    throw new Error(`No archived daily analysis exists for ${symbol} on ${targetDate}.`);
  }

  const isPresentDay = snapshot.tradingDate === todayNY;
  const cacheKey = `${symbol}_${targetDate}`;
  if (
    isPresentDay &&
    !snapshot.aiAnalyst?.used &&
    snapshot.dailyBias !== 'INSUFFICIENT DATA' &&
    process.env.GEMINI_API_KEY?.trim() &&
    process.env.GEMINI_API_KEY?.trim() !== 'MY_GEMINI_API_KEY'
  ) {
    const lastAttempt = aiRetryLastAttempt.get(cacheKey) || 0;
    if (Date.now() - lastAttempt > AI_RETRY_COOLDOWN_MS) {
      aiRetryLastAttempt.set(cacheKey, Date.now());
      // Run AI narrative enrichment asynchronously so GET /api/analysis/daily responds in <15ms
      const snapshotForAi = snapshot;
      void enrichWithGeminiExplanation(snapshotForAi).then((withAi) => {
        if (withAi.aiAnalyst.used && store.snapshots[cacheKey]) {
          store.snapshots[cacheKey] = { ...store.snapshots[cacheKey], aiAnalyst: withAi.aiAnalyst };
          saveStore();
        }
      }).catch(() => {});
    }
  }

  let intradayUpdates = store.intradayUpdates[snapshot.id] || [];

  if (isPresentDay) {
    const latestIntraday = await createOrRefreshIntradayUpdate(symbol, snapshot);
    if (latestIntraday) {
      intradayUpdates = store.intradayUpdates[snapshot.id] || [latestIntraday];
    }
  }

  // Collect all archived dates for this symbol
  const datesSet = new Set<string>();
  Object.values(store.snapshots).forEach((s) => {
    if (s.symbol === symbol) datesSet.add(s.tradingDate);
  });
  datesSet.add(todayNY);

  const availableDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  const historicalOutcome = await evaluateHistoricalOutcome(snapshot);

  return {
    snapshot,
    intradayUpdates,
    availableDates,
    historicalOutcome,
    isPresentDay,
  };
}

export function getAllTodaySummaries(): Record<
  string,
  {
    symbol: SupportedSymbol;
    tradingDate: string;
    dailyBias: string;
    directionalAlignmentScore: number;
    validityStatus: string;
    referencePrice: number;
    analysisTimestamp: string;
  }
> {
  const todayNY = getMarketTradingDateNY();
  const result: Record<string, any> = {};

  for (const sym of ALL_SUPPORTED_SYMBOLS) {
    const snap = store.snapshots[`${sym}_${todayNY}`];
    if (snap) {
      const updates = store.intradayUpdates[snap.id] || [];
      result[sym] = {
        symbol: sym,
        tradingDate: snap.tradingDate,
        dailyBias: snap.dailyBias,
        directionalAlignmentScore: snap.directionalAlignmentScore,
        validityStatus: updates[0]?.validityStatus || 'VALID',
        referencePrice: snap.referencePrice,
        analysisTimestamp: snap.analysisTimestamp,
      };
    }
  }
  return result;
}

export function getSchedulerStatus() {
  const todayNY = getMarketTradingDateNY();
  const coverage = ALL_SUPPORTED_SYMBOLS.map((sym) => {
    const snap = store.snapshots[`${sym}_${todayNY}`];
    return {
      symbol: sym,
      hasTodaySnapshot: Boolean(snap),
      dailyBias: snap?.dailyBias || null,
      intradayCount: snap ? (store.intradayUpdates[snap.id]?.length ?? 0) : 0,
    };
  });

  return {
    marketDateNY: todayNY,
    coverage,
    recentJobs: store.jobLogs.slice(0, 30),
  };
}

// ============================================================================
// PERSISTENT SERVER-SIDE SCHEDULER (RUNS INDEPENDENT OF BROWSER TABS)
// ============================================================================
let schedulerRunning = false;

export async function runSchedulerCycle(forceIntraday = false) {
  if (schedulerRunning) return;
  schedulerRunning = true;
  const todayNY = getMarketTradingDateNY();

  try {
    for (const sym of ALL_SUPPORTED_SYMBOLS) {
      const key = `${sym}_${todayNY}`;
      try {
        if (!store.snapshots[key]) {
          await ensureDailySnapshot(sym);
          // Stagger upstream API requests by 1.2s between symbols to avoid provider rate-limits
          await new Promise((r) => setTimeout(r, 1200));
        } else if (forceIntraday) {
          await createOrRefreshIntradayUpdate(sym, store.snapshots[key]);
          await new Promise((r) => setTimeout(r, 600));
        }
      } catch (err: any) {
        console.warn(`Scheduler warning for ${sym}:`, err?.message);
      }
    }
  } finally {
    schedulerRunning = false;
  }
}

export function startDailyAnalysisScheduler(): () => void {
  // Initial staggered bootstrap 4 seconds after server starts
  const startupTimer = setTimeout(() => {
    runSchedulerCycle(true).catch((e) => console.error('Initial scheduler cycle error:', e));
  }, 4000);

  // Every 5 minutes check for missing daily snapshots (new NY trading day rollover or retry failed)
  const snapshotInterval = setInterval(() => {
    runSchedulerCycle(false).catch((e) => console.error('Snapshot scheduler error:', e));
  }, 5 * 60 * 1000);

  // Every 12 minutes evaluate intraday validity updates
  const intradayInterval = setInterval(() => {
    runSchedulerCycle(true).catch((e) => console.error('Intraday scheduler error:', e));
  }, 12 * 60 * 1000);

  return () => {
    clearTimeout(startupTimer);
    clearInterval(snapshotInterval);
    clearInterval(intradayInterval);
  };
}
