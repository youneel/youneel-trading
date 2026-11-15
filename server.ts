import express, { Request, Response } from 'express';
import http from 'http';
import crypto from 'crypto';
import { WebSocketServer, WebSocket as WsClient } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  getVerifiedMarketData,
  getVerifiedQuote,
  startUpstreamMarketStream,
  VerifiedQuote,
} from './server/marketData.js';
import {
  ensureDailySnapshot,
  getDailyAnalysisView,
  getAllTodaySummaries,
  getSchedulerStatus,
  createOrRefreshIntradayUpdate,
  startDailyAnalysisScheduler,
} from './server/dailyAnalysisService.js';
import {
  fetchVerifiedTodayNews,
  fetchVerifiedHistoricalArchive,
} from './server/newsService.js';
import {
  syncFundamentalEvents,
  getFundamentalOverview,
  getFundamentalOwnerDiagnostics,
  startFundamentalAnalysisScheduler,
} from './server/fundamentalAnalysisService.js';
import {
  authenticateRequest,
  isAuthorizedAdmin,
  isAuthorizedOwner,
  isServiceRoleConfigured,
  verifyAndProvisionOwner,
} from './server/supabaseAdmin.js';
import {
  OTP_RESEND_COOLDOWN_MS,
  OWNER_SESSION_TTL_MS,
  getEmailDeliveryStatus,
  diagnoseEmailDeliveryConfig,
  isOwnerSessionSecretConfigured,
  getActiveOtpSummary,
  requestOwnerVerificationCode,
  verifyOwnerVerificationCode,
  validateOwnerSessionToken,
  revokeOwnerSessionToken,
  recordOwnerAudit,
  getRecentAuditLogs,
} from './server/ownerAuthService.js';
import {
  startCompetitionDiscoveryScheduler,
  runDiscoverySync,
  getPublicBrokerCompetitions,
  getOwnerCompetitionsWorkspace,
  upsertCompetitionDirect,
  addBrokerSourceRecord,
  deleteCompetitionRecord,
  markAllNotificationsRead,
  getCompetitionSchedulerStatus,
} from './server/competitionDiscoveryService.js';
import {
  ALL_SUPPORTED_SYMBOLS,
  ALL_TIMEFRAMES,
  SupportedSymbol,
  isSupportedSymbol,
  isSupportedTimeframe,
  roundCents,
  roundPrice,
  calculateLotSizeSafe,
  calculateGrossPnLSafe,
  calculateCommissionSafe,
  calculateSwapSafe,
  calculateRequiredMarginSafe,
} from './src/lib/tradingMath.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '8mb' }));

// Initialize Gemini SDK with User-Agent when valid key exists
const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
const isGeminiKeyValid = Boolean(geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY');
const ai = isGeminiKeyValid
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

const SUPPORTED_SYMBOLS: SupportedSymbol[] = ALL_SUPPORTED_SYMBOLS;
const VALID_TIMEFRAMES = ALL_TIMEFRAMES;

function normalizeSymbolParam(raw: unknown): string {
  const upper = String(raw || 'XAUUSD').trim().toUpperCase();
  if (upper === 'US100' || upper === 'NAS100' || upper === 'NDX') return 'NASDAQ';
  return upper;
}

// ============================================================================
// HEALTH & SYSTEM CAPABILITIES
// ============================================================================
app.get('/api/health', (_req: Request, res: Response) => {
  const marketKey = (process.env.TWELVE_DATA_API_KEY || process.env.MARKET_DATA_API_KEY)?.trim();
  const newsKey = (process.env.FINNHUB_API_KEY || process.env.NEWS_API_KEY)?.trim();
  res.json({
    status: 'ok',
    name: 'YOUNEEL TRADING API',
    time: new Date().toISOString(),
    supportedSymbols: SUPPORTED_SYMBOLS,
    supportedTimeframes: VALID_TIMEFRAMES,
    capabilities: {
      geminiConfigured: isGeminiKeyValid,
      twelveDataConfigured: Boolean(marketKey),
      finnhubConfigured: Boolean(newsKey),
      serviceRoleConfigured: isServiceRoleConfigured(),
      ownerSessionSecretConfigured: isOwnerSessionSecretConfigured(),
    },
  });
});

// ============================================================================
// 1. VERIFIED MARKET DATA ENDPOINTS
// ============================================================================
app.get('/api/all-prices', async (_req: Request, res: Response) => {
  const prices: Record<string, VerifiedQuote> = {};
  const errors: Record<string, { message: string; isRateLimited: boolean }> = {};

  await Promise.allSettled(
    SUPPORTED_SYMBOLS.map(async (sym) => {
      try {
        prices[sym] = await getVerifiedQuote(sym);
      } catch (err: any) {
        errors[sym] = {
          message: err?.message || 'Market feed unavailable',
          isRateLimited: Boolean(err?.isRateLimited),
        };
      }
    })
  );

  res.json({
    prices,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
    fetchedAt: new Date().toISOString(),
  });
});

app.get('/api/market-data', async (req: Request, res: Response) => {
  const rawSym = normalizeSymbolParam(req.query.symbol || 'XAUUSD');
  const rawTf = String(req.query.timeframe || 'H1').toUpperCase();

  if (!isSupportedSymbol(rawSym)) {
    res.status(400).json({ error: `Unsupported symbol. Supported: ${SUPPORTED_SYMBOLS.join(', ')}` });
    return;
  }

  if (!isSupportedTimeframe(rawTf)) {
    res.status(400).json({ error: `Unsupported timeframe. Supported: ${VALID_TIMEFRAMES.join(', ')}` });
    return;
  }

  try {
    const data = await getVerifiedMarketData(rawSym, rawTf);
    res.json(data);
  } catch (err: any) {
    const isRateLimited = Boolean(err?.isRateLimited);
    res.status(isRateLimited ? 429 : 503).json({
      error: err?.message || `Failed to load verified market data for ${rawSym}`,
      isRateLimited,
      symbol: rawSym,
      timeframe: rawTf,
      providerStatus: isRateLimited ? 'rate_limited' : 'error',
    });
  }
});

// ============================================================================
// 1B. PROFESSIONAL DAILY MARKET BIAS & ARCHIVE ENDPOINTS
// ============================================================================
app.get('/api/analysis/summaries', (_req: Request, res: Response) => {
  res.json({
    summaries: getAllTodaySummaries(),
    scheduler: getSchedulerStatus(),
  });
});

app.get('/api/analysis/daily', async (req: Request, res: Response) => {
  const rawSym = normalizeSymbolParam(req.query.symbol || 'XAUUSD');
  const requestedDate = req.query.date ? String(req.query.date).slice(0, 10) : undefined;

  if (!isSupportedSymbol(rawSym)) {
    res.status(400).json({ error: `Unsupported symbol. Supported: ${SUPPORTED_SYMBOLS.join(', ')}` });
    return;
  }

  try {
    const view = await getDailyAnalysisView(rawSym, requestedDate);
    res.json(view);
  } catch (err: any) {
    res.status(404).json({
      error: err?.message || `Daily analysis unavailable for ${rawSym}`,
    });
  }
});

app.post('/api/analysis/intraday-refresh', async (req: Request, res: Response) => {
  const rawSym = normalizeSymbolParam(req.body?.symbol || req.query.symbol || 'XAUUSD');
  if (!isSupportedSymbol(rawSym)) {
    res.status(400).json({ error: 'Unsupported symbol' });
    return;
  }

  try {
    const snap = await ensureDailySnapshot(rawSym);
    const latestUpdate = await createOrRefreshIntradayUpdate(rawSym, snap);
    const view = await getDailyAnalysisView(rawSym, snap.tradingDate);
    res.json({ ...view, latestUpdate });
  } catch (err: any) {
    res.status(503).json({ error: err?.message || 'Unable to evaluate intraday update' });
  }
});

app.get('/api/analysis/scheduler-status', (_req: Request, res: Response) => {
  res.json(getSchedulerStatus());
});

// ============================================================================
// 2. REAL NEWS & ARCHIVE ENDPOINTS (NO FAKE NEWS)
// ============================================================================
app.get('/api/news', async (_req: Request, res: Response) => {
  try {
    const result = await fetchVerifiedTodayNews();
    res.json(result);
  } catch (err: any) {
    res.status(503).json({
      news: [],
      sourcesActive: [],
      error: err?.message || 'Unable to reach verified news providers',
    });
  }
});

app.get('/api/historical-news', async (_req: Request, res: Response) => {
  try {
    const result = await fetchVerifiedHistoricalArchive();
    res.json(result);
  } catch (err: any) {
    res.status(503).json({
      archive: [],
      sourcesActive: [],
      error: err?.message || 'Unable to reach verifiable historical news archives',
    });
  }
});

// ============================================================================
// 2B. ADVANCED FUNDAMENTAL ANALYSIS (CPI, FOMC, PPI, NFP)
// ============================================================================
app.get('/api/fundamental/overview', async (_req: Request, res: Response) => {
  try {
    const overview = await getFundamentalOverview();
    res.json(overview);
  } catch (err: any) {
    res.status(503).json({
      error: err?.message || 'Unable to load verified fundamental macro analysis',
      events: [],
    });
  }
});

app.get('/api/fundamental/events/:id', async (req: Request, res: Response) => {
  try {
    const overview = await getFundamentalOverview();
    const found = overview.events.find((ev) => ev.id === req.params.id);
    if (!found) {
      res.status(404).json({ error: 'Fundamental event record not found' });
      return;
    }
    res.json({ event: found, lastSyncedAt: overview.lastSyncedAt });
  } catch (err: any) {
    res.status(503).json({ error: err?.message || 'Unable to load fundamental event' });
  }
});

app.post('/api/news-analysis', async (req: Request, res: Response) => {
  const { headline, summary, symbols } = req.body || {};

  if (!headline || typeof headline !== 'string') {
    res.status(400).json({ error: 'Headline is required' });
    return;
  }

  if (!ai) {
    res.status(503).json({
      error: 'AI macro impact analysis requires GEMINI_API_KEY to be configured in server secrets.',
    });
    return;
  }

  const targetSymbols = (Array.isArray(symbols) ? symbols : SUPPORTED_SYMBOLS).filter((s) =>
    isSupportedSymbol(String(s))
  );
  if (targetSymbols.length === 0) {
    res.status(400).json({ error: 'At least one valid symbol is required' });
    return;
  }

  try {
    const properties: Record<string, any> = {};
    for (const sym of targetSymbols) {
      properties[sym] = {
        type: Type.OBJECT,
        properties: {
          impact: {
            type: Type.STRING,
            description: 'Must be exactly Bullish, Bearish, or Neutral.',
          },
          reasoning: {
            type: Type.STRING,
            description: '1-2 concise sentences explaining the causal macro mechanism grounded only on the provided headline.',
          },
        },
        required: ['impact', 'reasoning'],
      };
    }

    const prompt = `You are an institutional macroeconomic analyst.
Evaluate the expected directional impact of the following verified news release on these assets: ${targetSymbols.join(', ')}.

HEADLINE: "${headline}"
SUMMARY: "${summary || 'No summary provided.'}"

Rules:
- Ground your explanation strictly on the actual headline and summary provided.
- For each symbol, set impact to exactly "Bullish", "Bearish", or "Neutral".
- Keep reasoning concise (1-2 factual sentences).`;

    const callPromise = ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: {
              type: Type.OBJECT,
              properties,
              required: targetSymbols,
            },
          },
          required: ['analysis'],
        },
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemini analysis timed out')), 12000)
    );

    const response: any = await Promise.race([callPromise, timeoutPromise]);
    const parsed = JSON.parse((response.text || '{}').trim());
    res.json(parsed);
  } catch (err: any) {
    console.error('Gemini API analysis failed:', err?.message);
    res.status(502).json({
      error: `Gemini analysis unavailable: ${err?.message || 'Upstream AI request failed'}`,
    });
  }
});

// ============================================================================
// 3. SERVER-SIDE VALIDATED PAPER TRADING ENGINE
// ============================================================================
async function syncOpenTradesWithMarket(
  db: any,
  trades: any[]
): Promise<{ trades: any[]; autoCloseAlerts: string[] }> {
  const openTrades = trades.filter((t) => t.status === 'open');
  if (openTrades.length === 0) return { trades, autoCloseAlerts: [] };

  const autoCloseAlerts: string[] = [];
  const updatedTrades = [...trades];

  // Fetch quotes & M15 candles per distinct open symbol
  const symbolsNeeded = Array.from(new Set(openTrades.map((t) => t.symbol).filter(isSupportedSymbol)));
  const marketCache: Record<string, { quote?: VerifiedQuote; candles?: any[] }> = {};

  await Promise.allSettled(
    symbolsNeeded.map(async (sym) => {
      try {
        const md = await getVerifiedMarketData(sym, 'M15');
        marketCache[sym] = { quote: md.quote, candles: md.candles };
      } catch {
        try {
          marketCache[sym] = { quote: await getVerifiedQuote(sym) };
        } catch {
          // Leave unavailable
        }
      }
    })
  );

  for (let i = 0; i < updatedTrades.length; i++) {
    const trade = updatedTrades[i];
    if (trade.status !== 'open' || !isSupportedSymbol(trade.symbol)) continue;

    const sym = trade.symbol as SupportedSymbol;
    const mkt = marketCache[sym];
    if (!mkt) continue;

    let hitReason: 'sl' | 'tp' | null = null;
    let triggerPrice: number | null = null;
    let triggerIso: string | null = null;

    // 1. Check historical M15 candles strictly after opened_at
    if (mkt.candles && mkt.candles.length > 0) {
      const openedSec = Math.floor(new Date(trade.opened_at).getTime() / 1000);
      for (const c of mkt.candles) {
        if (c.time <= openedSec) continue;
        if (trade.side === 'buy') {
          if (c.low <= trade.sl) {
            hitReason = 'sl';
            triggerPrice = trade.sl;
            triggerIso = new Date(c.time * 1000).toISOString();
            break;
          }
          if (c.high >= trade.tp) {
            hitReason = 'tp';
            triggerPrice = trade.tp;
            triggerIso = new Date(c.time * 1000).toISOString();
            break;
          }
        } else {
          if (c.high >= trade.sl) {
            hitReason = 'sl';
            triggerPrice = trade.sl;
            triggerIso = new Date(c.time * 1000).toISOString();
            break;
          }
          if (c.low <= trade.tp) {
            hitReason = 'tp';
            triggerPrice = trade.tp;
            triggerIso = new Date(c.time * 1000).toISOString();
            break;
          }
        }
      }
    }

    // 2. Check current verified quote
    if (!hitReason && mkt.quote && Number.isFinite(mkt.quote.price)) {
      const p = mkt.quote.price;
      if (trade.side === 'buy') {
        if (p <= trade.sl) {
          hitReason = 'sl';
          triggerPrice = trade.sl;
          triggerIso = mkt.quote.sourceTimestamp;
        } else if (p >= trade.tp) {
          hitReason = 'tp';
          triggerPrice = trade.tp;
          triggerIso = mkt.quote.sourceTimestamp;
        }
      } else {
        if (p >= trade.sl) {
          hitReason = 'sl';
          triggerPrice = trade.sl;
          triggerIso = mkt.quote.sourceTimestamp;
        } else if (p <= trade.tp) {
          hitReason = 'tp';
          triggerPrice = trade.tp;
          triggerIso = mkt.quote.sourceTimestamp;
        }
      }
    }

    if (hitReason && triggerPrice !== null && triggerIso) {
      const exitPrice = roundPrice(triggerPrice, sym);
      const grossPnl = calculateGrossPnLSafe(trade.side, trade.entry, exitPrice, trade.lot, sym);
      const commission = calculateCommissionSafe(trade.lot, sym, 2);
      const swap = calculateSwapSafe(trade.side, trade.lot, sym, trade.opened_at, triggerIso);
      const netPnl = roundCents(grossPnl + commission + swap);

      const updatePayload: any = {
        status: 'closed',
        exit_price: exitPrice,
        pnl: netPnl,
        close_reason: hitReason,
        closed_at: triggerIso,
        commission,
        swap,
      };

      const { error: updErr } = await db.from('trades').update(updatePayload).eq('id', trade.id).eq('user_id', trade.user_id);
      if (updErr) {
        // Retry without optional commission/swap columns if DB schema hasn't run migration yet
        const { commission: _c, swap: _s, ...legacyPayload } = updatePayload;
        await db.from('trades').update(legacyPayload).eq('id', trade.id).eq('user_id', trade.user_id);
      }

      updatedTrades[i] = { ...trade, ...updatePayload };
      autoCloseAlerts.push(
        `${sym} ${trade.side.toUpperCase()} triggered ${hitReason.toUpperCase()} at ${exitPrice} (Net P&L: ${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(2)})`
      );
    }
  }

  return { trades: updatedTrades, autoCloseAlerts };
}

async function computeAuthoritativeAccountState(
  db: any,
  userId: string,
  userEmail?: string
) {
  // Load or initialize profile
  let { data: profile } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (!profile) {
    const newProfile = {
      id: userId,
      display_name: userEmail ? userEmail.split('@')[0] : 'Trader',
      starting_capital: 10000,
    };
    await db.from('profiles').insert([newProfile]);
    profile = newProfile;
  }

  const { data: rawTrades, error: tradesErr } = await db
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('opened_at', { ascending: false });

  if (tradesErr) {
    throw new Error(tradesErr.message);
  }

  const { trades, autoCloseAlerts } = await syncOpenTradesWithMarket(db, rawTrades || []);

  // Fetch verified current quotes for open positions
  const openSymbols = Array.from(
    new Set(trades.filter((t) => t.status === 'open').map((t) => t.symbol).filter(isSupportedSymbol))
  ) as SupportedSymbol[];

  const liveQuotes: Record<string, VerifiedQuote> = {};
  await Promise.allSettled(
    openSymbols.map(async (sym) => {
      try {
        liveQuotes[sym] = await getVerifiedQuote(sym);
      } catch {
        // leave missing
      }
    })
  );

  const startingCapital = roundCents(Number(profile.starting_capital) || 10000);
  const closedTrades = trades.filter((t) => t.status === 'closed');
  const openTradesRaw = trades.filter((t) => t.status === 'open');

  const closedNetPnl = roundCents(closedTrades.reduce((acc, t) => acc + Number(t.pnl || 0), 0));
  const balance = roundCents(startingCapital + closedNetPnl);

  let totalFloatingNetPnl = 0;
  let totalMarginUsed = 0;
  let totalCommission = roundCents(closedTrades.reduce((acc, t) => acc + Number(t.commission || 0), 0));
  let totalSwap = roundCents(closedTrades.reduce((acc, t) => acc + Number(t.swap || 0), 0));

  const openTrades = openTradesRaw.map((t) => {
    const sym = isSupportedSymbol(t.symbol) ? t.symbol : 'XAUUSD';
    const quote = liveQuotes[sym];
    const hasVerifiedQuote = Boolean(quote && Number.isFinite(quote.price));
    const currentPrice = hasVerifiedQuote ? quote.price : Number(t.entry);
    const grossPnl = hasVerifiedQuote
      ? calculateGrossPnLSafe(t.side, Number(t.entry), currentPrice, Number(t.lot), sym)
      : 0;
    const openCommission =
      t.commission !== undefined && t.commission !== null
        ? Number(t.commission)
        : calculateCommissionSafe(Number(t.lot), sym, 1);
    const accruedSwap = calculateSwapSafe(t.side, Number(t.lot), sym, t.opened_at);
    const netFloating = roundCents(grossPnl + openCommission + accruedSwap);
    const marginRequired = calculateRequiredMarginSafe(Number(t.entry), Number(t.lot), sym);

    totalFloatingNetPnl = roundCents(totalFloatingNetPnl + netFloating);
    totalMarginUsed = roundCents(totalMarginUsed + marginRequired);
    totalCommission = roundCents(totalCommission + openCommission);
    totalSwap = roundCents(totalSwap + accruedSwap);

    return {
      ...t,
      currentPrice,
      hasVerifiedQuote,
      quoteTimestamp: quote?.sourceTimestamp || null,
      grossPnl,
      commission: openCommission,
      swap: accruedSwap,
      floatingPnl: netFloating,
      marginRequired,
    };
  });

  const equity = roundCents(balance + totalFloatingNetPnl);
  const freeMargin = roundCents(Math.max(0, equity - totalMarginUsed));

  const winningTrades = closedTrades.filter((t) => Number(t.pnl || 0) > 0);
  const losingTrades = closedTrades.filter((t) => Number(t.pnl || 0) < 0);
  const winRate = closedTrades.length > 0 ? Number(((winningTrades.length / closedTrades.length) * 100).toFixed(1)) : 0;
  const totalProfit = roundCents(winningTrades.reduce((acc, t) => acc + Number(t.pnl || 0), 0));
  const totalLoss = roundCents(Math.abs(losingTrades.reduce((acc, t) => acc + Number(t.pnl || 0), 0)));
  const profitFactor = totalLoss > 0 ? Number((totalProfit / totalLoss).toFixed(2)) : totalProfit > 0 ? 99.9 : 0;

  const sortedByPnl = [...closedTrades].sort((a, b) => Number(b.pnl || 0) - Number(a.pnl || 0));
  const bestTrade = sortedByPnl[0] || null;
  const worstTrade = sortedByPnl[sortedByPnl.length - 1] || null;

  const rrSum = closedTrades.reduce((acc, t) => {
    const risk = Math.abs(Number(t.entry) - Number(t.sl));
    const reward = Math.abs(Number(t.tp) - Number(t.entry));
    return acc + (risk > 0 ? reward / risk : 0);
  }, 0);
  const avgRR = closedTrades.length > 0 ? Number((rrSum / closedTrades.length).toFixed(2)) : 0;

  const equityCurve: { time: string; equity: number }[] = [{ time: 'Start', equity: startingCapital }];
  let running = startingCapital;
  [...closedTrades]
    .sort((a, b) => new Date(a.closed_at || a.opened_at).getTime() - new Date(b.closed_at || b.opened_at).getTime())
    .forEach((t) => {
      running = roundCents(running + Number(t.pnl || 0));
      equityCurve.push({
        time: new Date(t.closed_at || t.opened_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        equity: running,
      });
    });

  let peakEquity = startingCapital;
  let maxDrawdownUsd = 0;
  let maxDrawdownPct = 0;
  for (const pt of equityCurve) {
    if (pt.equity > peakEquity) peakEquity = pt.equity;
    const dd = peakEquity - pt.equity;
    if (dd > maxDrawdownUsd) maxDrawdownUsd = dd;
    const ddPct = peakEquity > 0 ? (dd / peakEquity) * 100 : 0;
    if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;
  }

  return {
    profile,
    startingCapital,
    balance,
    equity,
    floatingPnl: totalFloatingNetPnl,
    marginUsed: totalMarginUsed,
    freeMargin,
    commissionTotal: totalCommission,
    swapTotal: totalSwap,
    openTrades,
    closedTrades,
    autoCloseAlerts,
    stats: {
      winRate,
      totalProfit,
      totalLoss,
      netPnl: closedNetPnl,
      profitFactor,
      avgRR,
      bestTrade,
      worstTrade,
      equityCurve,
      totalCount: closedTrades.length,
      winningCount: winningTrades.length,
      losingCount: losingTrades.length,
      maxDrawdownUsd: roundCents(maxDrawdownUsd),
      maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    },
  };
}

app.get('/api/journal/state', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const state = await computeAuthoritativeAccountState(auth.db, auth.user.id, auth.user.email);
    res.json({
      ...state,
      serverProtected: auth.usingServiceRole,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to compute journal state' });
  }
});

app.post('/api/journal/capital', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const capital = Number(req.body?.starting_capital);
  if (!Number.isFinite(capital) || capital < 10 || capital > 100000000) {
    res.status(400).json({ error: 'Starting capital must be between $10 and $100,000,000.' });
    return;
  }

  const cleanCapital = roundCents(capital);
  const { error } = await auth.db.from('profiles').upsert({
    id: auth.user.id,
    display_name: auth.user.email ? auth.user.email.split('@')[0] : 'Trader',
    starting_capital: cleanCapital,
  });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const state = await computeAuthoritativeAccountState(auth.db, auth.user.id, auth.user.email);
  res.json(state);
});

function sanitizeJournalScreenshot(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('https://') && trimmed.length <= 512) return trimmed;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length <= 450000) {
    return trimmed;
  }
  return '';
}

app.post('/api/journal/orders', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const {
    symbol: rawSym,
    side,
    sl: rawSl,
    tp: rawTp,
    risk_pct: rawRisk,
    notes,
    strategy,
    entry_reason,
    exit_reason,
    emotions,
    mistakes,
    screenshot_url,
  } = req.body || {};
  const symbol = normalizeSymbolParam(rawSym || '');

  if (!isSupportedSymbol(symbol)) {
    res.status(400).json({ error: 'Invalid instrument symbol' });
    return;
  }
  if (side !== 'buy' && side !== 'sell') {
    res.status(400).json({ error: 'Side must be buy or sell' });
    return;
  }

  const sl = roundPrice(Number(rawSl), symbol);
  const tp = roundPrice(Number(rawTp), symbol);
  const riskPct = Number(rawRisk);

  if (!Number.isFinite(sl) || sl <= 0 || !Number.isFinite(tp) || tp <= 0) {
    res.status(400).json({ error: 'Stop Loss and Take Profit must be positive finite prices.' });
    return;
  }
  if (!Number.isFinite(riskPct) || riskPct < 0.1 || riskPct > 10) {
    res.status(400).json({ error: 'Risk % must be between 0.1% and 10%.' });
    return;
  }

  // Server fetches authoritative verified market quote (NEVER trusts client entry price!)
  let quote: VerifiedQuote;
  try {
    quote = await getVerifiedQuote(symbol);
  } catch (err: any) {
    res.status(503).json({
      error: `Order rejected: Live market quote unavailable for ${symbol} (${err?.message || 'provider error'})`,
    });
    return;
  }

  const entry = roundPrice(quote.price, symbol);

  // Strict server-side SL/TP geometry validation against authoritative entry
  if (side === 'buy') {
    if (sl >= entry || tp <= entry) {
      res.status(400).json({
        error: `Invalid BUY levels against live execution price ${entry}: SL must be < ${entry} and TP must be > ${entry}.`,
      });
      return;
    }
  } else {
    if (sl <= entry || tp >= entry) {
      res.status(400).json({
        error: `Invalid SELL levels against live execution price ${entry}: SL must be > ${entry} and TP must be < ${entry}.`,
      });
      return;
    }
  }

  // Compute authoritative balance & margin on server
  const currentState = await computeAuthoritativeAccountState(auth.db, auth.user.id, auth.user.email);
  if (currentState.balance <= 0) {
    res.status(400).json({ error: 'Insufficient account balance to open new positions.' });
    return;
  }

  const lot = calculateLotSizeSafe(currentState.balance, riskPct, entry, sl, symbol);
  const requiredMargin = calculateRequiredMarginSafe(entry, lot, symbol);
  if (requiredMargin > currentState.freeMargin) {
    res.status(400).json({
      error: `Insufficient free margin. Required: $${requiredMargin.toFixed(2)}, Available: $${currentState.freeMargin.toFixed(2)}.`,
    });
    return;
  }

  const openingCommission = calculateCommissionSafe(lot, symbol, 1);

  const insertPayload: any = {
    user_id: auth.user.id,
    symbol,
    side,
    entry,
    sl,
    tp,
    lot,
    risk_pct: roundCents(riskPct),
    capital_at_open: currentState.balance,
    status: 'open',
    commission: openingCommission,
    swap: 0,
    notes: typeof notes === 'string' ? notes.slice(0, 500) : '',
    strategy: typeof strategy === 'string' ? strategy.trim().slice(0, 120) : '',
    entry_reason: typeof entry_reason === 'string' ? entry_reason.trim().slice(0, 500) : '',
    exit_reason: typeof exit_reason === 'string' ? exit_reason.trim().slice(0, 500) : '',
    emotions: typeof emotions === 'string' ? emotions.trim().slice(0, 160) : '',
    mistakes: typeof mistakes === 'string' ? mistakes.trim().slice(0, 300) : '',
    screenshot_url: sanitizeJournalScreenshot(screenshot_url),
    opened_at: new Date().toISOString(),
  };

  let { data: inserted, error } = await auth.db.from('trades').insert([insertPayload]).select().single();
  if (error && error.message?.includes('column')) {
    const {
      commission: _c,
      swap: _s,
      strategy: _st,
      entry_reason: _er,
      exit_reason: _xr,
      emotions: _em,
      mistakes: _mk,
      screenshot_url: _sc,
      ...legacyPayload
    } = insertPayload;
    const retry = await auth.db.from('trades').insert([legacyPayload]).select().single();
    inserted = retry.data;
    error = retry.error;
  }

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const updatedState = await computeAuthoritativeAccountState(auth.db, auth.user.id, auth.user.email);
  res.json({
    order: inserted,
    executionQuoteSource: quote.source,
    executionTimestamp: quote.sourceTimestamp,
    state: updatedState,
  });
});

app.post('/api/journal/orders/:id/close', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const tradeId = req.params.id;
  const { data: trade, error: fetchErr } = await auth.db
    .from('trades')
    .select('*')
    .eq('id', tradeId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (fetchErr || !trade) {
    res.status(404).json({ error: 'Trade not found' });
    return;
  }
  if (trade.status !== 'open') {
    res.status(400).json({ error: 'Position is already closed' });
    return;
  }

  const symbol = String(trade.symbol).toUpperCase();
  if (!isSupportedSymbol(symbol)) {
    res.status(400).json({ error: 'Unsupported trade symbol' });
    return;
  }

  // Server fetches authoritative live market quote for closing
  let quote: VerifiedQuote;
  try {
    quote = await getVerifiedQuote(symbol);
  } catch (err: any) {
    res.status(503).json({
      error: `Close rejected: Live market quote unavailable for ${symbol} (${err?.message || 'provider error'})`,
    });
    return;
  }

  const exitPrice = roundPrice(quote.price, symbol);
  const closedAt = new Date().toISOString();
  const grossPnl = calculateGrossPnLSafe(trade.side, Number(trade.entry), exitPrice, Number(trade.lot), symbol);
  const commission = calculateCommissionSafe(Number(trade.lot), symbol, 2);
  const swap = calculateSwapSafe(trade.side, Number(trade.lot), symbol, trade.opened_at, closedAt);
  const netPnl = roundCents(grossPnl + commission + swap);

  const updatePayload: any = {
    status: 'closed',
    exit_price: exitPrice,
    pnl: netPnl,
    close_reason: 'manual',
    closed_at: closedAt,
    commission,
    swap,
  };

  let { error: updErr } = await auth.db
    .from('trades')
    .update(updatePayload)
    .eq('id', tradeId)
    .eq('user_id', auth.user.id);

  if (updErr && updErr.message?.includes('column')) {
    const { commission: _c, swap: _s, ...legacyPayload } = updatePayload;
    const retry = await auth.db
      .from('trades')
      .update(legacyPayload)
      .eq('id', tradeId)
      .eq('user_id', auth.user.id);
    updErr = retry.error;
  }

  if (updErr) {
    res.status(500).json({ error: updErr.message });
    return;
  }

  const updatedState = await computeAuthoritativeAccountState(auth.db, auth.user.id, auth.user.email);
  res.json({ state: updatedState });
});

app.patch('/api/journal/orders/:id', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const tradeId = req.params.id;
  const body = req.body || {};

  // Strictly block client tampering with financial execution fields
  const forbiddenKeys = [
    'entry',
    'exit_price',
    'pnl',
    'commission',
    'swap',
    'lot',
    'sl',
    'tp',
    'capital_at_open',
    'status',
    'close_reason',
    'symbol',
    'side',
    'user_id',
  ];
  for (const key of forbiddenKeys) {
    if (body[key] !== undefined) {
      res.status(400).json({ error: `Protected execution field "${key}" cannot be altered.` });
      return;
    }
  }

  const { data: existing, error: fetchErr } = await auth.db
    .from('trades')
    .select('id')
    .eq('id', tradeId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (fetchErr || !existing) {
    res.status(404).json({ error: 'Trade not found' });
    return;
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof body.notes === 'string') updates.notes = body.notes.trim().slice(0, 500);
  if (typeof body.strategy === 'string') updates.strategy = body.strategy.trim().slice(0, 120);
  if (typeof body.entry_reason === 'string') updates.entry_reason = body.entry_reason.trim().slice(0, 500);
  if (typeof body.exit_reason === 'string') updates.exit_reason = body.exit_reason.trim().slice(0, 500);
  if (typeof body.emotions === 'string') updates.emotions = body.emotions.trim().slice(0, 160);
  if (typeof body.mistakes === 'string') updates.mistakes = body.mistakes.trim().slice(0, 300);
  if (body.screenshot_url !== undefined) {
    const clean = sanitizeJournalScreenshot(body.screenshot_url);
    if (String(body.screenshot_url || '').trim() && !clean) {
      res.status(400).json({ error: 'Screenshot must be a valid HTTPS URL or PNG/JPEG/WEBP image under 330 KB.' });
      return;
    }
    updates.screenshot_url = clean;
  }

  let { data: updated, error: updErr } = await auth.db
    .from('trades')
    .update(updates)
    .eq('id', tradeId)
    .eq('user_id', auth.user.id)
    .select()
    .single();

  if (updErr && updErr.message?.includes('column')) {
    if (updates.notes !== undefined) {
      const retry = await auth.db
        .from('trades')
        .update({ notes: updates.notes })
        .eq('id', tradeId)
        .eq('user_id', auth.user.id)
        .select()
        .single();
      updated = retry.data;
      updErr = retry.error;
    } else {
      res.status(400).json({ error: 'Apply migration 003 in Supabase to enable extended journal metadata fields.' });
      return;
    }
  }

  if (updErr) {
    res.status(500).json({ error: updErr.message });
    return;
  }

  const state = await computeAuthoritativeAccountState(auth.db, auth.user.id, auth.user.email);
  res.json({ order: updated, state });
});

app.delete('/api/journal/orders/:id', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const tradeId = req.params.id;
  const { data: existing, error: fetchErr } = await auth.db
    .from('trades')
    .select('id')
    .eq('id', tradeId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (fetchErr || !existing) {
    res.status(404).json({ error: 'Trade not found' });
    return;
  }

  const { error: delErr } = await auth.db
    .from('trades')
    .delete()
    .eq('id', tradeId)
    .eq('user_id', auth.user.id);

  if (delErr) {
    res.status(500).json({ error: delErr.message });
    return;
  }

  const state = await computeAuthoritativeAccountState(auth.db, auth.user.id, auth.user.email);
  res.json({ deleted: true, state });
});

// ============================================================================
// 4. SUPABASE-BACKED GIVEAWAYS & DIAGNOSTICS ENDPOINTS
// ============================================================================
type GiveawayDiagnosticCategory =
  | 'ok'
  | 'missing_tables'
  | 'missing_permissions'
  | 'missing_storage'
  | 'auth_error'
  | 'other_db_error';

const GIVEAWAYS_MIGRATION_FILE = 'supabase/migrations/004_youneel_giveaways_complete.sql';

function classifyGiveawayDbError(
  err: any,
  context: 'db' | 'storage' = 'db'
): { category: GiveawayDiagnosticCategory; code: string; message: string; hint: string } {
  const code = String(err?.code || err?.statusCode || '');
  const msg = String(err?.message || err || 'Unknown database error');
  const lower = msg.toLowerCase();

  if (
    context === 'storage' &&
    (code === 'NoSuchBucket' ||
      code === '404' ||
      lower.includes('bucket not found') ||
      lower.includes('nosuchbucket'))
  ) {
    return {
      category: 'missing_storage',
      code: code || 'NoSuchBucket',
      message: msg,
      hint: `Storage bucket "giveaway-media" is missing. Execute ${GIVEAWAYS_MIGRATION_FILE} in Supabase SQL Editor.`,
    };
  }

  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42703' ||
    lower.includes('could not find the table') ||
    (lower.includes('relation') && lower.includes('does not exist')) ||
    (lower.includes('column') && lower.includes('does not exist'))
  ) {
    return {
      category: 'missing_tables',
      code: code || 'PGRST205',
      message: msg,
      hint: `Required giveaway tables or columns are missing on Supabase. Execute ${GIVEAWAYS_MIGRATION_FILE} in Supabase SQL Editor.`,
    };
  }

  if (
    code === '401' ||
    lower.includes('jwt') ||
    lower.includes('invalid token') ||
    lower.includes('authentication required') ||
    lower.includes('owner authorization required')
  ) {
    return {
      category: 'auth_error',
      code: code || '401',
      message: msg,
      hint: 'Authenticate as the verified Owner account and complete 2FA verification.',
    };
  }

  if (
    code === '42501' ||
    code === '403' ||
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('insufficient_privilege') ||
    lower.includes('not allowed') ||
    lower.includes('unauthorized')
  ) {
    return {
      category: 'missing_permissions',
      code: code || '42501',
      message: msg,
      hint: `Database or storage RLS permission denied. Verify is_owner_user() policies via ${GIVEAWAYS_MIGRATION_FILE} and/or set SUPABASE_SERVICE_ROLE_KEY on the server.`,
    };
  }

  if (context === 'storage') {
    return {
      category: 'missing_storage',
      code: code || 'STORAGE_ERROR',
      message: msg,
      hint: `Check Supabase Storage bucket "giveaway-media" and owner storage policies in ${GIVEAWAYS_MIGRATION_FILE}.`,
    };
  }

  return {
    category: 'other_db_error',
    code: code || 'DB_ERROR',
    message: msg,
    hint: 'Review the database error code and constraints.',
  };
}

async function runGiveawayDiagnostics(
  db: any,
  opts: { usingServiceRole: boolean; authOk: boolean; authDetail?: string }
) {
  const probeTable = async (table: string) => {
    try {
      const { error } = await db.from(table).select('id').limit(1);
      if (!error) {
        return { ready: true, category: 'ok' as GiveawayDiagnosticCategory, detail: 'Table accessible', code: '' };
      }
      const c = classifyGiveawayDbError(error, 'db');
      return { ready: false, category: c.category, detail: c.message, code: c.code };
    } catch (err: any) {
      const c = classifyGiveawayDbError(err, 'db');
      return { ready: false, category: c.category, detail: c.message, code: c.code };
    }
  };

  const [tGiveaways, tParticipants, tMedia, tWinners] = await Promise.all([
    probeTable('giveaways'),
    probeTable('giveaway_participants'),
    probeTable('giveaway_media'),
    probeTable('giveaway_winners'),
  ]);

  let extendedColumnsReady = false;
  if (tGiveaways.ready) {
    const extRes = await db
      .from('giveaways')
      .select('id, subtitle, sponsor, eligibility_rules, country_restrictions, max_participants, image_crop, design_template, style_config, is_archived, publish_at')
      .limit(1);
    extendedColumnsReady = !extRes.error;
  }

  let storageReady = false;
  let storageCategory: GiveawayDiagnosticCategory = 'ok';
  let storageDetail = 'Bucket "giveaway-media" accessible';
  try {
    const bucketRes = await db.storage.getBucket('giveaway-media');
    if (bucketRes.error) {
      const listRes = await db.storage.from('giveaway-media').list('', { limit: 1 });
      if (listRes.error) {
        const c = classifyGiveawayDbError(listRes.error, 'storage');
        storageCategory = c.category;
        storageDetail = c.message;
      } else {
        storageReady = true;
      }
    } else {
      storageReady = true;
    }
  } catch (err: any) {
    const c = classifyGiveawayDbError(err, 'storage');
    storageCategory = c.category;
    storageDetail = c.message;
  }

  const allTables = [tGiveaways, tParticipants, tMedia, tWinners];
  const anyMissingTables = allTables.some((t) => t.category === 'missing_tables');
  const anyPermErr = allTables.find((t) => t.category === 'missing_permissions') || (storageCategory === 'missing_permissions' ? { detail: storageDetail } : null);
  const anyOtherErr = allTables.find((t) => t.category === 'other_db_error');

  let overallStatus: GiveawayDiagnosticCategory = 'ok';
  if (!opts.authOk) overallStatus = 'auth_error';
  else if (anyMissingTables) overallStatus = 'missing_tables';
  else if (anyPermErr) overallStatus = 'missing_permissions';
  else if (!storageReady) overallStatus = storageCategory === 'ok' ? 'missing_storage' : storageCategory;
  else if (anyOtherErr) overallStatus = 'other_db_error';

  return {
    overallStatus,
    migrationFile: GIVEAWAYS_MIGRATION_FILE,
    tables: {
      giveaways: tGiveaways,
      giveaway_participants: tParticipants,
      giveaway_media: tMedia,
      giveaway_winners: tWinners,
      extendedColumnsReady,
    },
    permissions: {
      ready: !anyPermErr,
      serviceRoleConfigured: opts.usingServiceRole,
      detail: anyPermErr
        ? anyPermErr.detail
        : opts.usingServiceRole
        ? 'Server service_role active'
        : 'Operating via authenticated Owner RLS policies (SUPABASE_SERVICE_ROLE_KEY not set)',
    },
    storage: {
      ready: storageReady,
      bucket: 'giveaway-media',
      category: storageCategory,
      detail: storageDetail,
    },
    auth: {
      ready: opts.authOk,
      detail: opts.authDetail || (opts.authOk ? 'Verified Owner session active' : 'Owner authentication required'),
    },
    otherError: anyOtherErr ? anyOtherErr.detail : null,
  };
}

app.get('/api/giveaways', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);

  const { createClient } = await import('@supabase/supabase-js');
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, getAdminClient } = await import('./server/supabaseAdmin.js');
  const db = getAdminClient() || auth?.db || createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });

  let { data: giveaways, error } = await db
    .from('giveaways')
    .select(
      'id, title, subtitle, description, prize, rules, sponsor, eligibility_rules, country_restrictions, max_participants, image_url, image_crop, external_url, cta_label, design_template, style_config, status, is_published, is_archived, publish_at, starts_at, ends_at, winner_display_name, winner_announced_at, created_at'
    )
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  // Backward-compatible fallback if extended columns are pending migration
  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    const mid = await db
      .from('giveaways')
      .select(
        'id, title, subtitle, description, prize, rules, image_url, image_crop, external_url, cta_label, design_template, style_config, status, is_published, is_archived, publish_at, starts_at, ends_at, winner_display_name, winner_announced_at, created_at'
      )
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    giveaways = mid.data as any;
    error = mid.error;

    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      const legacy = await db
        .from('giveaways')
        .select('id, title, description, prize, rules, image_url, status, is_published, starts_at, ends_at, winner_display_name, winner_announced_at, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false });
      giveaways = legacy.data as any;
      error = legacy.error;
    }
  }

  if (error) {
    const classified = classifyGiveawayDbError(error, 'db');
    if (classified.category === 'missing_tables') {
      res.json({
        giveaways: [],
        schemaMissing: true,
        diagnostic: {
          ...classified,
          migrationFile: GIVEAWAYS_MIGRATION_FILE,
        },
      });
      return;
    }
    res.status(classified.category === 'missing_permissions' ? 403 : 500).json({
      giveaways: [],
      schemaMissing: false,
      error: `${classified.message} (${classified.code})`,
      diagnostic: classified,
    });
    return;
  }

  const nowMs = Date.now();
  const visibleGiveaways = (giveaways || []).filter((g: any) => {
    if (g.is_archived) return false;
    if (g.status === 'draft' || g.status === 'paused' || g.status === 'archived') return false;
    if (g.publish_at && Date.parse(g.publish_at) > nowMs) return false;
    return true;
  });

  // Aggregate participant counts cleanly without exposing participant emails/PII
  const countsByGiveaway: Record<string, number> = {};
  const adminDb = getAdminClient();
  if (adminDb && visibleGiveaways.length > 0) {
    const { data: partRows } = await adminDb
      .from('giveaway_participants')
      .select('giveaway_id')
      .in('giveaway_id', visibleGiveaways.map((g: any) => g.id));
    for (const r of partRows || []) {
      countsByGiveaway[r.giveaway_id] = (countsByGiveaway[r.giveaway_id] || 0) + 1;
    }
  }

  let myEntries: Record<string, any> = {};
  if (auth) {
    const { data: entries } = await auth.db
      .from('giveaway_participants')
      .select('giveaway_id, status, entry_note, submitted_at')
      .eq('user_id', auth.user.id);
    if (Array.isArray(entries)) {
      for (const e of entries) {
        myEntries[e.giveaway_id] = e;
      }
    }
  }

  res.json({
    giveaways: visibleGiveaways.map((g: any) => {
      const startsMs = g.starts_at ? Date.parse(g.starts_at) : 0;
      const endsMs = g.ends_at ? Date.parse(g.ends_at) : 0;
      let resolvedStatus = g.status;
      if (g.status === 'active' || g.status === 'scheduled') {
        if (startsMs && startsMs > nowMs) {
          resolvedStatus = 'scheduled';
        } else if (endsMs && endsMs < nowMs) {
          resolvedStatus = 'ended';
        }
      }
      return {
        ...g,
        status: resolvedStatus,
        participantCount: countsByGiveaway[g.id] ?? undefined,
        myEntry: myEntries[g.id] || null,
      };
    }),
    schemaMissing: false,
  });
});

app.post('/api/giveaways/:id/enter', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Sign in required to enter a giveaway' });
    return;
  }

  const giveawayId = req.params.id;
  const entryNote = typeof req.body?.entry_note === 'string' ? req.body.entry_note.trim().slice(0, 300) : '';

  let { data: g, error: gErr }: any = await auth.db
    .from('giveaways')
    .select('id, is_published, status, starts_at, ends_at, max_participants')
    .eq('id', giveawayId)
    .maybeSingle();

  if (gErr && gErr.message?.includes('column')) {
    const legacyG = await auth.db
      .from('giveaways')
      .select('id, is_published, status, starts_at, ends_at')
      .eq('id', giveawayId)
      .maybeSingle();
    g = legacyG.data;
    gErr = legacyG.error;
  }

  if (gErr || !g) {
    res.status(404).json({ error: 'Giveaway not found' });
    return;
  }

  const nowMs = Date.now();
  if (!g.is_published || g.status !== 'active') {
    res.status(400).json({ error: 'This giveaway is not currently accepting entries.' });
    return;
  }
  if (g.starts_at && Date.parse(g.starts_at) > nowMs) {
    res.status(400).json({ error: 'This giveaway has not started yet.' });
    return;
  }
  if (g.ends_at && Date.parse(g.ends_at) < nowMs) {
    res.status(400).json({ error: 'This giveaway has already ended.' });
    return;
  }

  if (typeof g.max_participants === 'number' && g.max_participants > 0) {
    const { count } = await auth.db
      .from('giveaway_participants')
      .select('id', { count: 'exact', head: true })
      .eq('giveaway_id', giveawayId);
    if (typeof count === 'number' && count >= g.max_participants) {
      res.status(409).json({ error: 'Maximum participant capacity reached for this giveaway.' });
      return;
    }
  }

  const { data: entry, error } = await auth.db
    .from('giveaway_participants')
    .insert([
      {
        giveaway_id: giveawayId,
        user_id: auth.user.id,
        user_email: auth.user.email || '',
        display_name: auth.user.email ? auth.user.email.split('@')[0] : 'Trader',
        entry_note: entryNote,
        status: 'pending',
      },
    ])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'You have already entered this giveaway.' });
      return;
    }
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ entry });
});

app.get('/api/admin/me', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.json({ isAdmin: false });
    return;
  }
  const isAdmin = await isAuthorizedAdmin(auth.user, auth.db);
  res.json({ isAdmin, email: auth.user.email });
});

app.get('/api/admin/giveaways', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!(await isAuthorizedAdmin(auth.user, auth.db))) {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }

  const { data: giveaways, error } = await auth.db
    .from('giveaways')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('giveaways')) {
      res.json({ giveaways: [], schemaMissing: true });
      return;
    }
    res.status(500).json({ error: error.message });
    return;
  }

  const { data: participants } = await auth.db
    .from('giveaway_participants')
    .select('*')
    .order('submitted_at', { ascending: false });

  const participantsByGiveaway: Record<string, any[]> = {};
  for (const p of participants || []) {
    if (!participantsByGiveaway[p.giveaway_id]) participantsByGiveaway[p.giveaway_id] = [];
    participantsByGiveaway[p.giveaway_id].push(p);
  }

  res.json({
    giveaways: (giveaways || []).map((g: any) => ({
      ...g,
      participants: participantsByGiveaway[g.id] || [],
    })),
    schemaMissing: false,
  });
});

app.post('/api/admin/giveaways', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!(await isAuthorizedAdmin(auth.user, auth.db))) {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }

  const { title, description, prize, rules, image_url, status, is_published, starts_at, ends_at } = req.body || {};
  if (!title || !prize || !ends_at) {
    res.status(400).json({ error: 'Title, prize, and end date are required.' });
    return;
  }

  const { data, error } = await auth.db
    .from('giveaways')
    .insert([
      {
        title: String(title).trim(),
        description: String(description || '').trim(),
        prize: String(prize).trim(),
        rules: String(rules || '').trim(),
        image_url: String(image_url || '').trim(),
        status: ['draft', 'active', 'ended'].includes(status) ? status : 'draft',
        is_published: Boolean(is_published),
        starts_at: starts_at || new Date().toISOString(),
        ends_at,
        created_by: auth.user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ giveaway: data });
});

app.patch('/api/admin/giveaways/:id', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!(await isAuthorizedAdmin(auth.user, auth.db))) {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }

  const id = req.params.id;
  const body = req.body || {};
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) updates.title = String(body.title).trim();
  if (body.description !== undefined) updates.description = String(body.description).trim();
  if (body.prize !== undefined) updates.prize = String(body.prize).trim();
  if (body.rules !== undefined) updates.rules = String(body.rules).trim();
  if (body.image_url !== undefined) updates.image_url = String(body.image_url).trim();
  if (body.status !== undefined && ['draft', 'active', 'ended'].includes(body.status)) {
    updates.status = body.status;
  }
  if (body.is_published !== undefined) updates.is_published = Boolean(body.is_published);
  if (body.starts_at !== undefined) updates.starts_at = body.starts_at;
  if (body.ends_at !== undefined) updates.ends_at = body.ends_at;

  // Winner selection & publishing
  if (body.winner_participant_id) {
    const { data: winner } = await auth.db
      .from('giveaway_participants')
      .select('id, display_name, user_email')
      .eq('id', body.winner_participant_id)
      .eq('giveaway_id', id)
      .maybeSingle();

    if (!winner) {
      res.status(404).json({ error: 'Participant not found for this giveaway' });
      return;
    }

    // Reset previous winner status if any, then mark selected winner
    await auth.db
      .from('giveaway_participants')
      .update({ status: 'approved' })
      .eq('giveaway_id', id)
      .eq('status', 'winner');

    await auth.db
      .from('giveaway_participants')
      .update({ status: 'winner' })
      .eq('id', winner.id);

    updates.winner_participant_id = winner.id;
    updates.winner_display_name = winner.display_name || winner.user_email.split('@')[0];
    updates.winner_announced_at = new Date().toISOString();
    updates.status = 'ended';
  }

  const { data, error } = await auth.db
    .from('giveaways')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ giveaway: data });
});

app.patch('/api/admin/giveaways/:id/participants/:participantId', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!(await isAuthorizedAdmin(auth.user, auth.db))) {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }

  const { id, participantId } = req.params;
  const { status } = req.body || {};
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Invalid participant status' });
    return;
  }

  const { data, error } = await auth.db
    .from('giveaway_participants')
    .update({ status })
    .eq('id', participantId)
    .eq('giveaway_id', id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ participant: data });
});

app.delete('/api/admin/giveaways/:id', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!(await isAuthorizedAdmin(auth.user, auth.db))) {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }

  const { error } = await auth.db.from('giveaways').delete().eq('id', req.params.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ deleted: true });
});

// ============================================================================
// 5. PUBLIC BROKER COMPETITIONS ENDPOINTS (SEPARATE FROM YOUNEEL GIVEAWAYS)
// ============================================================================
app.get('/api/competitions', async (_req: Request, res: Response) => {
  const data = await getPublicBrokerCompetitions();
  res.json({
    ...data,
    scheduler: getCompetitionSchedulerStatus(),
  });
});

app.get('/api/competitions/featured', async (_req: Request, res: Response) => {
  const data = await getPublicBrokerCompetitions();
  res.json({
    competitions: data.competitions.filter((c) => c.is_featured),
  });
});

// ============================================================================
// 5B. VALIDATED CONTACT INQUIRIES ENDPOINT (RATE-LIMITED + HONEYPOT GUARDED)
// ============================================================================
export interface ContactInquiryRecord {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip_hash: string;
  status: 'new' | 'reviewed' | 'resolved';
  created_at: string;
}

const CONTACT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_MAX_PER_WINDOW = 5;
const contactRateBuckets = new Map<string, number[]>();
const recentContactInquiries: ContactInquiryRecord[] = [];

function hashIpAddress(ip: string): string {
  return crypto.createHash('sha256').update(`youneel_contact:${ip}`).digest('hex').slice(0, 24);
}

app.post('/api/contact', async (req: Request, res: Response) => {
  const b = req.body || {};
  // Anti-spam honeypot field (hidden in browser UI)
  if (b.website && String(b.website).trim() !== '') {
    res.status(400).json({ error: 'Automated submission rejected.' });
    return;
  }

  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  const subject = String(b.subject || '').trim().slice(0, 200);
  const message = String(b.message || '').trim();

  if (name.length < 2 || name.length > 120) {
    res.status(400).json({ error: 'Name must be between 2 and 120 characters.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 180) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }
  if (message.length < 10 || message.length > 3000) {
    res.status(400).json({ error: 'Message must be between 10 and 3000 characters.' });
    return;
  }

  const ipHash = hashIpAddress(getRequestIp(req));
  const now = Date.now();
  const recentHits = (contactRateBuckets.get(ipHash) || []).filter((ts) => now - ts < CONTACT_WINDOW_MS);
  if (recentHits.length >= CONTACT_MAX_PER_WINDOW) {
    res.status(429).json({ error: 'Too many inquiries sent recently. Please try again in 15 minutes.' });
    return;
  }
  recentHits.push(now);
  contactRateBuckets.set(ipHash, recentHits);

  const record: ContactInquiryRecord = {
    id: crypto.randomUUID(),
    name,
    email,
    subject,
    message,
    ip_hash: ipHash,
    status: 'new',
    created_at: new Date().toISOString(),
  };

  let persistedToDb = false;
  const { getAdminClient } = await import('./server/supabaseAdmin.js');
  const adminDb = getAdminClient();
  if (adminDb) {
    try {
      const { data, error } = await adminDb
        .from('contact_inquiries')
        .insert([
          {
            id: record.id,
            name: record.name,
            email: record.email,
            subject: record.subject,
            message: record.message,
            ip_hash: record.ip_hash,
            status: 'new',
            created_at: record.created_at,
          },
        ])
        .select()
        .single();
      if (!error && data) {
        persistedToDb = true;
      }
    } catch {
      // Fallback to in-memory ring buffer if migration 003 not yet applied
    }
  }

  recentContactInquiries.unshift(record);
  if (recentContactInquiries.length > 100) {
    recentContactInquiries.length = 100;
  }

  res.status(201).json({
    ok: true,
    id: record.id,
    persistedToDb,
    createdAt: record.created_at,
  });
});

// ============================================================================
// 6. PRIVATE YOUNEEL OWNER MODE (EMAIL+PASS + 5-MIN 2FA OTP + SERVER GUARD)
// ============================================================================
const OWNER_SESSION_COOKIE_NAME = 'youneel_owner_session';

function getRequestIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function extractOwnerSessionToken(req: Request): string | undefined {
  const headerTok = (req.headers['x-owner-session'] as string | undefined)?.trim();
  if (headerTok) return headerTok;
  const cookies = parseCookies(req.headers.cookie);
  return cookies[OWNER_SESSION_COOKIE_NAME]?.trim() || undefined;
}

function isSecureRequest(req: Request): boolean {
  return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
}

function setOwnerSessionCookie(req: Request, res: Response, token: string): void {
  const maxAge = Math.floor(OWNER_SESSION_TTL_MS / 1000);
  const parts = [
    `${OWNER_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearOwnerSessionCookie(req: Request, res: Response): void {
  const parts = [
    `${OWNER_SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isSecureRequest(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

async function requireVerifiedOwner(req: Request, res: Response) {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  if (!(await isAuthorizedOwner(auth.user, auth.db, auth.usingServiceRole))) {
    res.status(403).json({ error: 'Owner authorization required' });
    return null;
  }
  const ownerSessionToken = extractOwnerSessionToken(req);
  const check = validateOwnerSessionToken({ token: ownerSessionToken, user: auth.user });
  if (!check.valid) {
    res.status(403).json({
      error: check.reason || 'Email verification code required',
      requiresOwnerOtp: true,
    });
    return null;
  }
  return { ...auth, ownerSessionId: check.sessionId! };
}

app.get('/api/owner/auth/status', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.json({
      isOwnerAccount: false,
      ownerSessionVerified: false,
      deliveryConfigured: false,
    });
    return;
  }

  const verification = await verifyAndProvisionOwner(auth.user, auth.db, auth.usingServiceRole);
  if (!verification.emailMatchesOwner) {
    // Never disclose owner email or internal config to non-owner users or admins
    res.json({
      isOwnerAccount: false,
      ownerSessionVerified: false,
      deliveryConfigured: false,
    });
    return;
  }

  const ownerSessionToken = extractOwnerSessionToken(req);
  const sessionCheck = validateOwnerSessionToken({ token: ownerSessionToken, user: auth.user });
  const deliveryDiag = diagnoseEmailDeliveryConfig();
  const activeOtp = getActiveOtpSummary(auth.user.email || '');

  const authorizationResult = !verification.authorized
    ? verification.reason
    : sessionCheck.valid
    ? 'Authorized (Full 2FA Owner Access)'
    : 'Awaiting 5-minute Email Verification Code';

  res.json({
    isOwnerAccount: verification.authorized,
    ownerSessionVerified: verification.authorized && sessionCheck.valid,
    deliveryConfigured: deliveryDiag.configured,
    deliveryProvider: deliveryDiag.provider,
    diagnostics: {
      supabaseAuthenticated: true,
      userId: auth.user.id,
      emailConfirmed: verification.emailConfirmed,
      ownerRoleStatus: verification.profileRole,
      roleAutoProvisioned: verification.roleAutoProvisioned,
      emailVerificationStatus:
        verification.authorized && sessionCheck.valid
          ? 'verified'
          : activeOtp.hasActiveCode
          ? 'code_pending'
          : 'required',
      activeOtpExpiresAt: activeOtp.expiresAt,
      deliveryConfigured: deliveryDiag.configured,
      deliveryProvider: deliveryDiag.provider,
      deliveryDetail: deliveryDiag.detail,
      deliveryMissingFields: deliveryDiag.missingFields,
      sessionValid: verification.authorized && sessionCheck.valid,
      sessionExpiresAt: sessionCheck.valid ? sessionCheck.expiresAt || null : null,
      sessionReason: sessionCheck.valid ? 'Active verified owner session' : sessionCheck.reason || 'Verification required',
      authorizationResult,
      serviceRoleConfigured: isServiceRoleConfigured(),
      ownerSessionSecretConfigured: isOwnerSessionSecretConfigured(),
    },
  });
});

app.post('/api/owner/auth/request-code', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!(await isAuthorizedOwner(auth.user, auth.db, auth.usingServiceRole))) {
    res.status(403).json({ error: 'Owner authorization required' });
    return;
  }

  const result = await requestOwnerVerificationCode({
    user: auth.user,
    ip: getRequestIp(req),
    db: auth.db,
  });

  if (!result.ok) {
    res.status(result.status).json({
      error: result.error,
      retryAfterSeconds: result.retryAfterSeconds,
    });
    return;
  }

  res.json({
    sent: true,
    expiresInSeconds: result.expiresInSeconds,
    cooldownSeconds: Math.round(OTP_RESEND_COOLDOWN_MS / 1000),
  });
});

app.post('/api/owner/auth/verify-code', async (req: Request, res: Response) => {
  const auth = await authenticateRequest(req.headers.authorization);
  if (!auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!(await isAuthorizedOwner(auth.user, auth.db, auth.usingServiceRole))) {
    res.status(403).json({ error: 'Owner authorization required' });
    return;
  }

  const result = await verifyOwnerVerificationCode({
    user: auth.user,
    code: String(req.body?.code || ''),
    ip: getRequestIp(req),
    userAgent: String(req.headers['user-agent'] || ''),
  });

  if (!result.ok || !result.sessionToken) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  setOwnerSessionCookie(req, res, result.sessionToken);
  res.json({
    verified: true,
    sessionToken: result.sessionToken,
    expiresAt: result.expiresAt,
  });
});

app.post('/api/owner/auth/logout', async (req: Request, res: Response) => {
  const token = extractOwnerSessionToken(req);
  revokeOwnerSessionToken(token);
  clearOwnerSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/owner/security', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const [auditLogs, verification] = await Promise.all([
    getRecentAuditLogs(owner.db),
    verifyAndProvisionOwner(owner.user, owner.db, owner.usingServiceRole),
  ]);
  const ownerSessionToken = extractOwnerSessionToken(req);
  const sessionCheck = validateOwnerSessionToken({ token: ownerSessionToken, user: owner.user });
  const deliveryDiag = diagnoseEmailDeliveryConfig();

  res.json({
    auditLogs,
    delivery: getEmailDeliveryStatus(),
    scheduler: getCompetitionSchedulerStatus(),
    serviceRoleConfigured: isServiceRoleConfigured(),
    diagnostics: {
      supabaseAuthenticated: true,
      userId: owner.user.id,
      emailConfirmed: verification.emailConfirmed,
      ownerRoleStatus: verification.profileRole,
      roleAutoProvisioned: verification.roleAutoProvisioned,
      emailVerificationStatus: 'verified',
      deliveryConfigured: deliveryDiag.configured,
      deliveryProvider: deliveryDiag.provider,
      deliveryDetail: deliveryDiag.detail,
      deliveryMissingFields: deliveryDiag.missingFields,
      sessionValid: sessionCheck.valid,
      sessionExpiresAt: sessionCheck.expiresAt || null,
      authorizationResult: 'Authorized (Full 2FA Owner Access)',
      serviceRoleConfigured: isServiceRoleConfigured(),
      ownerSessionSecretConfigured: isOwnerSessionSecretConfigured(),
    },
  });
});

// --- Owner Overview, Platform Health, Users Management & Inquiries ---
app.get('/api/owner/overview', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const marketKeyConfigured = Boolean((process.env.TWELVE_DATA_API_KEY || process.env.MARKET_DATA_API_KEY)?.trim());
  const newsKeyConfigured = Boolean((process.env.FINNHUB_API_KEY || process.env.NEWS_API_KEY)?.trim());

  const [
    profilesRes,
    tradesRes,
    giveawaysRes,
    participantsRes,
    competitionsRes,
    inquiriesRes,
  ] = await Promise.all([
    owner.db.from('profiles').select('id, role'),
    owner.db.from('trades').select('id, status'),
    owner.db.from('giveaways').select('id, status, is_published, is_archived'),
    owner.db.from('giveaway_participants').select('id', { count: 'exact', head: true }),
    owner.db.from('broker_competitions').select('id, is_published, review_status'),
    owner.db.from('contact_inquiries').select('id, status'),
  ]);

  const trades = tradesRes.data || [];
  const giveaways = giveawaysRes.data || [];
  const competitions = competitionsRes.data || [];
  const dbInquiries = inquiriesRes.data || [];

  res.json({
    serviceRoleConfigured: owner.usingServiceRole,
    counts: {
      profiles: (profilesRes.data || []).length,
      tradesTotal: trades.length,
      tradesOpen: trades.filter((t: any) => t.status === 'open').length,
      tradesClosed: trades.filter((t: any) => t.status === 'closed').length,
      giveawaysTotal: giveaways.length,
      giveawaysActive: giveaways.filter((g: any) => g.status === 'active' && g.is_published && !g.is_archived).length,
      giveawaysParticipants: typeof participantsRes.count === 'number' ? participantsRes.count : 0,
      competitionsPublished: competitions.filter((c: any) => c.is_published).length,
      competitionsPending: competitions.filter((c: any) => c.review_status === 'pending_review').length,
      dailyAnalysesToday: getAllTodaySummaries().length,
      contactInquiries: inquiriesRes.error ? recentContactInquiries.length : dbInquiries.length,
    },
    health: {
      supabaseConnected: !profilesRes.error,
      giveawaysTableReady: !giveawaysRes.error || giveawaysRes.error.code !== 'PGRST205',
      competitionsTableReady: !competitionsRes.error || competitionsRes.error.code !== 'PGRST205',
      inquiriesTableReady: !inquiriesRes.error || inquiriesRes.error.code !== 'PGRST205',
      marketDataKeyConfigured: marketKeyConfigured,
      newsKeyConfigured,
      geminiConfigured: isGeminiKeyValid,
      ownerSessionSecretConfigured: isOwnerSessionSecretConfigured(),
      emailDelivery: getEmailDeliveryStatus(),
      analysisScheduler: getSchedulerStatus(),
      competitionScheduler: getCompetitionSchedulerStatus(),
    },
  });
});

app.get('/api/owner/users', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const { data: profiles, error: profErr } = await owner.db
    .from('profiles')
    .select('id, display_name, starting_capital, role')
    .order('starting_capital', { ascending: false });

  if (profErr) {
    res.status(500).json({ error: profErr.message });
    return;
  }

  const { data: allTrades } = await owner.db
    .from('trades')
    .select('user_id, status, pnl');

  const statsByUser: Record<string, { openTrades: number; closedTrades: number; realizedPnl: number }> = {};
  for (const t of allTrades || []) {
    if (!statsByUser[t.user_id]) {
      statsByUser[t.user_id] = { openTrades: 0, closedTrades: 0, realizedPnl: 0 };
    }
    if (t.status === 'open') {
      statsByUser[t.user_id].openTrades += 1;
    } else if (t.status === 'closed') {
      statsByUser[t.user_id].closedTrades += 1;
      statsByUser[t.user_id].realizedPnl = roundCents(statsByUser[t.user_id].realizedPnl + Number(t.pnl || 0));
    }
  }

  res.json({
    serviceRoleConfigured: owner.usingServiceRole,
    users: (profiles || []).map((p: any) => ({
      id: p.id,
      display_name: p.display_name || 'Trader',
      starting_capital: Number(p.starting_capital || 10000),
      role: p.role || 'trader',
      isSelfOwner: p.id === owner.user.id,
      ...(statsByUser[p.id] || { openTrades: 0, closedTrades: 0, realizedPnl: 0 }),
    })),
  });
});

app.patch('/api/owner/users/:id/role', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  if (!owner.usingServiceRole) {
    res.status(400).json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is required on the server to update user roles across protected profiles.',
    });
    return;
  }

  const targetId = req.params.id;
  const nextRole = String(req.body?.role || '').trim();
  if (!['trader', 'admin'].includes(nextRole)) {
    res.status(400).json({ error: 'Role must be "trader" or "admin". Owner role cannot be reassigned via API.' });
    return;
  }
  if (targetId === owner.user.id) {
    res.status(400).json({ error: 'Owner account role cannot be downgraded.' });
    return;
  }

  const { data: updated, error } = await owner.db
    .from('profiles')
    .update({ role: nextRole })
    .eq('id', targetId)
    .select('id, display_name, starting_capital, role')
    .maybeSingle();

  if (error || !updated) {
    res.status(error ? 500 : 404).json({ error: error?.message || 'User profile not found' });
    return;
  }

  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.user.role_updated',
    resourceType: 'profile',
    resourceId: targetId,
    details: { role: nextRole },
    ip: getRequestIp(req),
    db: owner.db,
  });

  res.json({ user: updated });
});

app.get('/api/owner/inquiries', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const { data: dbRows, error } = await owner.db
    .from('contact_inquiries')
    .select('id, name, email, subject, message, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!error && Array.isArray(dbRows)) {
    const seen = new Set(dbRows.map((r: any) => r.id));
    const merged = [
      ...dbRows,
      ...recentContactInquiries.filter((r) => !seen.has(r.id)).map(({ ip_hash: _ip, ...rest }) => rest),
    ];
    res.json({ inquiries: merged, tableReady: true });
    return;
  }

  res.json({
    inquiries: recentContactInquiries.map(({ ip_hash: _ip, ...rest }) => rest),
    tableReady: false,
  });
});

app.patch('/api/owner/inquiries/:id', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const status = String(req.body?.status || '').trim();
  if (!['new', 'reviewed', 'resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid inquiry status' });
    return;
  }

  const memItem = recentContactInquiries.find((i) => i.id === req.params.id);
  if (memItem) {
    memItem.status = status as any;
  }

  const { data, error } = await owner.db
    .from('contact_inquiries')
    .update({ status })
    .eq('id', req.params.id)
    .select('id, name, email, subject, message, status, created_at')
    .maybeSingle();

  if (error && error.code !== 'PGRST205') {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ inquiry: data || memItem || { id: req.params.id, status } });
});

function validateImageMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 12) return false;
  if (mimeType === 'image/jpeg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  if (mimeType === 'image/webp') {
    return buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mimeType === 'image/avif') {
    return buf.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return false;
}

app.post('/api/owner/storage/upload', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const bucket = String(req.body?.bucket || '');
  const mimeType = String(req.body?.mimeType || '').toLowerCase();
  const dataBase64 = String(req.body?.dataBase64 || '');
  const rawName = String(req.body?.filename || 'image.webp');
  const giveawayId = req.body?.giveawayId ? String(req.body.giveawayId) : null;
  const cropMetadata = req.body?.cropMetadata || {};

  if (!['giveaway-media', 'competition-banners'].includes(bucket)) {
    res.status(400).json({ error: 'Invalid storage bucket' });
    return;
  }

  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (!allowedMime.includes(mimeType)) {
    res.status(400).json({ error: 'Only JPEG, PNG, WEBP, or AVIF images are allowed.' });
    return;
  }

  const cleanBase64 = dataBase64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    res.status(400).json({ error: 'Image must be non-empty and under 5 MB.' });
    return;
  }

  if (!validateImageMagicBytes(buffer, mimeType)) {
    res.status(400).json({ error: 'Uploaded file failed binary image signature validation.' });
    return;
  }

  const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
  const safeBase = rawName.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase().slice(0, 40) || 'asset';
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeBase}.${ext}`;

  const { error: uploadErr } = await owner.db.storage
    .from(bucket)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadErr) {
    const classified = classifyGiveawayDbError(uploadErr, 'storage');
    res.status(classified.category === 'missing_permissions' ? 403 : classified.category === 'missing_storage' ? 404 : 500).json({
      error: `${classified.message} — ${classified.hint}`,
      category: classified.category,
      code: classified.code,
      migrationFile: GIVEAWAYS_MIGRATION_FILE,
    });
    return;
  }

  const { data: pub } = owner.db.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = pub?.publicUrl || '';

  if (bucket === 'giveaway-media') {
    try {
      await owner.db.from('giveaway_media').insert([
        {
          giveaway_id: giveawayId,
          storage_bucket: bucket,
          storage_path: storagePath,
          public_url: publicUrl,
          mime_type: mimeType,
          size_bytes: buffer.length,
          crop_metadata: cropMetadata,
          uploaded_by: owner.user.id,
        },
      ]);
    } catch {
      // Optional metadata table
    }
  }

  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.storage.upload',
    resourceType: bucket,
    resourceId: storagePath,
    details: { mimeType, sizeBytes: buffer.length },
    ip: getRequestIp(req),
    db: owner.db,
  });

  res.json({ url: publicUrl, storagePath, sizeBytes: buffer.length });
});

// --- Owner Giveaway Builder & Management APIs (Separate from Broker Competitions) ---
app.get('/api/owner/giveaways/diagnostics', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const diagnostics = await runGiveawayDiagnostics(owner.db, {
    usingServiceRole: owner.usingServiceRole,
    authOk: true,
    authDetail: `Verified Owner (${owner.user.email})`,
  });
  res.json(diagnostics);
});

app.get('/api/owner/giveaways', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const [giveawaysRes, diagnostics] = await Promise.all([
    owner.db.from('giveaways').select('*').order('created_at', { ascending: false }),
    runGiveawayDiagnostics(owner.db, {
      usingServiceRole: owner.usingServiceRole,
      authOk: true,
      authDetail: `Verified Owner (${owner.user.email})`,
    }),
  ]);

  if (giveawaysRes.error) {
    const classified = classifyGiveawayDbError(giveawaysRes.error, 'db');
    if (classified.category === 'missing_tables') {
      res.json({
        giveaways: [],
        schemaMissing: true,
        diagnostic: classified,
        diagnostics,
      });
      return;
    }
    res.status(classified.category === 'missing_permissions' ? 403 : 500).json({
      giveaways: [],
      schemaMissing: false,
      error: `${classified.message} (${classified.code}) — ${classified.hint}`,
      diagnostic: classified,
      diagnostics,
    });
    return;
  }

  const { data: participants } = await owner.db
    .from('giveaway_participants')
    .select('*')
    .order('submitted_at', { ascending: false });

  const participantsByGiveaway: Record<string, any[]> = {};
  for (const p of participants || []) {
    if (!participantsByGiveaway[p.giveaway_id]) participantsByGiveaway[p.giveaway_id] = [];
    participantsByGiveaway[p.giveaway_id].push(p);
  }

  res.json({
    giveaways: (giveawaysRes.data || []).map((g: any) => ({
      ...g,
      participants: participantsByGiveaway[g.id] || [],
    })),
    schemaMissing: false,
    diagnostics,
  });
});

app.post('/api/owner/giveaways', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const b = req.body || {};
  const titleTrim = typeof b.title === 'string' ? b.title.trim() : '';
  const prizeTrim = typeof b.prize === 'string' ? b.prize.trim() : '';
  if (!titleTrim || !prizeTrim || !b.ends_at) {
    res.status(400).json({ error: 'Title, prize, and end date are required.', category: 'validation_error' });
    return;
  }

  const startsDate = b.starts_at ? new Date(b.starts_at) : new Date();
  const endsDate = new Date(b.ends_at);
  if (Number.isNaN(startsDate.getTime()) || Number.isNaN(endsDate.getTime())) {
    res.status(400).json({ error: 'Start date and end date must be valid timestamps.', category: 'validation_error' });
    return;
  }
  if (endsDate.getTime() <= startsDate.getTime()) {
    res.status(400).json({ error: 'End date must be later than the start date.', category: 'validation_error' });
    return;
  }

  const extUrl = String(b.external_url || '').trim();
  if (extUrl && !/^https?:\/\//i.test(extUrl)) {
    res.status(400).json({ error: 'External participation URL must begin with https:// or http://', category: 'validation_error' });
    return;
  }

  const validStatuses = ['draft', 'scheduled', 'active', 'paused', 'ended', 'completed', 'archived'];
  const parsedMax = b.max_participants !== undefined && b.max_participants !== null && b.max_participants !== ''
    ? Math.max(1, Math.floor(Number(b.max_participants)))
    : null;

  const row: Record<string, any> = {
    title: titleTrim,
    subtitle: String(b.subtitle || '').trim(),
    description: String(b.description || '').trim(),
    prize: prizeTrim,
    rules: String(b.rules || '').trim(),
    sponsor: String(b.sponsor || '').trim(),
    eligibility_rules: String(b.eligibility_rules || '').trim(),
    country_restrictions: String(b.country_restrictions || '').trim(),
    max_participants: Number.isFinite(parsedMax as number) ? parsedMax : null,
    image_url: String(b.image_url || '').trim(),
    image_crop: b.image_crop || { x: 50, y: 50, zoom: 1, aspect: '16:9' },
    external_url: extUrl,
    cta_label: String(b.cta_label || 'Enter Giveaway').trim(),
    design_template: String(b.design_template || 'premium_dark').trim(),
    style_config: b.style_config || {},
    status: validStatuses.includes(b.status) ? b.status : 'draft',
    is_published: Boolean(b.is_published),
    is_archived: Boolean(b.is_archived),
    publish_at: b.publish_at || null,
    starts_at: startsDate.toISOString(),
    ends_at: endsDate.toISOString(),
    created_by: owner.user.id,
  };

  let { data, error } = await owner.db.from('giveaways').insert([row]).select().single();
  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    // Retry without 003/004 columns first
    const {
      sponsor: _sp,
      eligibility_rules: _el,
      country_restrictions: _cr,
      max_participants: _mp,
      ...row002
    } = row;
    if (row002.status === 'completed') row002.status = 'ended';
    const res002 = await owner.db.from('giveaways').insert([row002]).select().single();
    data = res002.data;
    error = res002.error;

    if (error && (error.code === '42703' || error.message?.includes('column'))) {
      const legacyRow = {
        title: row.title,
        description: row.description,
        prize: row.prize,
        rules: row.rules,
        image_url: row.image_url,
        status: ['draft', 'active', 'ended'].includes(row.status) ? row.status : 'draft',
        is_published: row.is_published,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        created_by: owner.user.id,
      };
      const resLegacy = await owner.db.from('giveaways').insert([legacyRow]).select().single();
      data = resLegacy.data;
      error = resLegacy.error;
    }
  }

  if (error) {
    const classified = classifyGiveawayDbError(error, 'db');
    res.status(
      classified.category === 'missing_permissions'
        ? 403
        : classified.category === 'missing_tables'
        ? 503
        : 500
    ).json({
      error: `${classified.message} — ${classified.hint}`,
      category: classified.category,
      code: classified.code,
      migrationFile: GIVEAWAYS_MIGRATION_FILE,
    });
    return;
  }

  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.giveaway.created',
    resourceType: 'giveaway',
    resourceId: data?.id || '',
    details: { title: row.title, status: row.status, published: row.is_published },
    ip: getRequestIp(req),
    db: owner.db,
  });

  res.status(201).json({ giveaway: data });
});

app.post('/api/owner/giveaways/:id/duplicate', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const { data: src, error: fetchErr } = await owner.db
    .from('giveaways')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();

  if (fetchErr || !src) {
    if (fetchErr) {
      const classified = classifyGiveawayDbError(fetchErr, 'db');
      res.status(classified.category === 'missing_permissions' ? 403 : 500).json({
        error: classified.message,
        category: classified.category,
        code: classified.code,
      });
      return;
    }
    res.status(404).json({ error: 'Giveaway not found' });
    return;
  }

  const copyPayload: Record<string, any> = {
    title: `${src.title} (Copy)`,
    subtitle: src.subtitle || '',
    description: src.description || '',
    prize: src.prize,
    rules: src.rules || '',
    sponsor: src.sponsor || '',
    eligibility_rules: src.eligibility_rules || '',
    country_restrictions: src.country_restrictions || '',
    max_participants: src.max_participants ?? null,
    image_url: src.image_url || '',
    image_crop: src.image_crop || { x: 50, y: 50, zoom: 1, aspect: '16:9' },
    external_url: src.external_url || '',
    cta_label: src.cta_label || 'Enter Giveaway',
    design_template: src.design_template || 'premium_dark',
    style_config: src.style_config || {},
    status: 'draft',
    is_published: false,
    is_archived: false,
    publish_at: null,
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    created_by: owner.user.id,
  };

  let { data: created, error } = await owner.db
    .from('giveaways')
    .insert([copyPayload])
    .select()
    .single();

  if (error && (error.code === '42703' || error.message?.includes('column'))) {
    const {
      sponsor: _sp,
      eligibility_rules: _el,
      country_restrictions: _cr,
      max_participants: _mp,
      ...copy002
    } = copyPayload;
    const retry = await owner.db.from('giveaways').insert([copy002]).select().single();
    created = retry.data;
    error = retry.error;
  }

  if (error) {
    const classified = classifyGiveawayDbError(error, 'db');
    res.status(classified.category === 'missing_permissions' ? 403 : 500).json({
      error: `${classified.message} — ${classified.hint}`,
      category: classified.category,
      code: classified.code,
    });
    return;
  }

  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.giveaway.duplicated',
    resourceType: 'giveaway',
    resourceId: created?.id || '',
    details: { sourceId: req.params.id },
    ip: getRequestIp(req),
    db: owner.db,
  });

  res.json({ giveaway: created });
});

app.patch('/api/owner/giveaways/:id', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const id = req.params.id;
  const b = req.body || {};
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  const editableTextFields = [
    'title',
    'subtitle',
    'description',
    'prize',
    'rules',
    'sponsor',
    'eligibility_rules',
    'country_restrictions',
    'image_url',
    'external_url',
    'cta_label',
    'design_template',
  ];
  for (const field of editableTextFields) {
    if (b[field] !== undefined) updates[field] = String(b[field]).trim();
  }
  if (b.max_participants !== undefined) {
    const n = b.max_participants === null || b.max_participants === '' ? null : Math.max(1, Math.floor(Number(b.max_participants)));
    updates.max_participants = Number.isFinite(n as number) ? n : null;
  }
  if (b.image_crop !== undefined) updates.image_crop = b.image_crop;
  if (b.style_config !== undefined) updates.style_config = b.style_config;
  if (b.is_published !== undefined) updates.is_published = Boolean(b.is_published);
  if (b.is_archived !== undefined) updates.is_archived = Boolean(b.is_archived);
  if (b.publish_at !== undefined) updates.publish_at = b.publish_at;
  if (b.starts_at !== undefined) updates.starts_at = b.starts_at;
  if (b.ends_at !== undefined) updates.ends_at = b.ends_at;
  if (
    b.status !== undefined &&
    ['draft', 'scheduled', 'active', 'paused', 'ended', 'completed', 'archived'].includes(b.status)
  ) {
    updates.status = b.status;
    if (b.status === 'paused') updates.paused_at = new Date().toISOString();
    if (b.status === 'archived') {
      updates.is_archived = true;
      updates.is_published = false;
    }
  }

  if (b.winner_participant_id) {
    const { data: winner } = await owner.db
      .from('giveaway_participants')
      .select('id, display_name, user_email')
      .eq('id', b.winner_participant_id)
      .eq('giveaway_id', id)
      .maybeSingle();

    if (!winner) {
      res.status(404).json({ error: 'Participant not found for this giveaway' });
      return;
    }

    await owner.db
      .from('giveaway_participants')
      .update({ status: 'approved' })
      .eq('giveaway_id', id)
      .eq('status', 'winner');

    await owner.db
      .from('giveaway_participants')
      .update({ status: 'winner' })
      .eq('id', winner.id);

    const winnerName = winner.display_name || winner.user_email.split('@')[0];
    updates.winner_participant_id = winner.id;
    updates.winner_display_name = winnerName;
    updates.winner_announced_at = new Date().toISOString();
    updates.status = 'ended';

    try {
      await owner.db.from('giveaway_winners').upsert(
        [
          {
            giveaway_id: id,
            participant_id: winner.id,
            display_name: winnerName,
            selected_by: owner.user.id,
          },
        ],
        { onConflict: 'giveaway_id,participant_id' }
      );
    } catch {
      // Optional table if 002 not yet migrated
    }
  }

  let { data, error } = await owner.db
    .from('giveaways')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error && error.message?.includes('column')) {
    const {
      sponsor: _sp,
      eligibility_rules: _el,
      country_restrictions: _cr,
      max_participants: _mp,
      ...updates002
    } = updates;
    if (updates002.status === 'completed') updates002.status = 'ended';
    const retry002 = await owner.db
      .from('giveaways')
      .update(updates002)
      .eq('id', id)
      .select()
      .single();
    data = retry002.data;
    error = retry002.error;
  }

  if (error) {
    const classified = classifyGiveawayDbError(error, 'db');
    res.status(classified.category === 'missing_permissions' ? 403 : 500).json({
      error: `${classified.message} — ${classified.hint}`,
      category: classified.category,
      code: classified.code,
    });
    return;
  }

  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.giveaway.updated',
    resourceType: 'giveaway',
    resourceId: id,
    details: { keys: Object.keys(updates) },
    ip: getRequestIp(req),
    db: owner.db,
  });

  res.json({ giveaway: data });
});

app.patch('/api/owner/giveaways/:id/participants/:participantId', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const { id, participantId } = req.params;
  const { status } = req.body || {};
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Invalid participant status' });
    return;
  }

  const { data, error } = await owner.db
    .from('giveaway_participants')
    .update({ status })
    .eq('id', participantId)
    .eq('giveaway_id', id)
    .select()
    .single();

  if (error) {
    const classified = classifyGiveawayDbError(error, 'db');
    res.status(classified.category === 'missing_permissions' ? 403 : 500).json({
      error: classified.message,
      category: classified.category,
      code: classified.code,
    });
    return;
  }

  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.giveaway.participant_status',
    resourceType: 'giveaway_participant',
    resourceId: participantId,
    details: { giveawayId: id, status },
    ip: getRequestIp(req),
    db: owner.db,
  });

  res.json({ participant: data });
});

app.delete('/api/owner/giveaways/:id', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const { error } = await owner.db.from('giveaways').delete().eq('id', req.params.id);
  if (error) {
    const classified = classifyGiveawayDbError(error, 'db');
    res.status(classified.category === 'missing_permissions' ? 403 : 500).json({
      error: `${classified.message} — ${classified.hint}`,
      category: classified.category,
      code: classified.code,
    });
    return;
  }

  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.giveaway.deleted',
    resourceType: 'giveaway',
    resourceId: req.params.id,
    ip: getRequestIp(req),
    db: owner.db,
  });

  res.json({ deleted: true });
});

// --- Owner Broker Competitions Management APIs (Independent from Giveaways) ---
app.get('/api/owner/competitions', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const workspace = await getOwnerCompetitionsWorkspace(owner.db);
  res.json(workspace);
});

app.post('/api/owner/competitions/sync', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const syncResult = await runDiscoverySync({
    trigger: 'manual',
    db: owner.db,
    force: true,
  });

  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.competitions.sync',
    resourceType: 'broker_competitions',
    details: { results: syncResult.results },
    ip: getRequestIp(req),
    db: owner.db,
  });

  const workspace = await getOwnerCompetitionsWorkspace(owner.db);
  res.json({ syncResult, ...workspace });
});

app.post('/api/owner/competitions', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const b = req.body || {};
  if (!b.title || !b.official_source_url || !b.broker_slug) {
    res.status(400).json({ error: 'Broker, competition title, and official source URL are required.' });
    return;
  }

  try {
    const result = await upsertCompetitionDirect(owner.db, b);
    await recordOwnerAudit({
      userId: owner.user.id,
      email: owner.user.email || '',
      action: 'owner.competition.created',
      resourceType: 'broker_competition',
      resourceId: result.competition.id,
      details: { title: result.competition.title, broker: result.competition.broker_slug },
      ip: getRequestIp(req),
      db: owner.db,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save broker competition' });
  }
});

app.patch('/api/owner/competitions/:id', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const id = req.params.id;
  const b = req.body || {};

  try {
    const result = await upsertCompetitionDirect(owner.db, b, id);
    await recordOwnerAudit({
      userId: owner.user.id,
      email: owner.user.email || '',
      action: 'owner.competition.updated',
      resourceType: 'broker_competition',
      resourceId: id,
      details: { status: result.competition.status, review_status: result.competition.review_status },
      ip: getRequestIp(req),
      db: owner.db,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update broker competition' });
  }
});

app.delete('/api/owner/competitions/:id', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  await deleteCompetitionRecord(owner.db, req.params.id);
  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.competition.deleted',
    resourceType: 'broker_competition',
    resourceId: req.params.id,
    ip: getRequestIp(req),
    db: owner.db,
  });

  res.json({ deleted: true });
});

app.post('/api/owner/brokers', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const b = req.body || {};
  if (!b.broker_slug || !b.broker_name || !b.official_website_url || !b.competition_source_url) {
    res.status(400).json({ error: 'All broker source fields are required.' });
    return;
  }

  const source = await addBrokerSourceRecord(owner.db, b);
  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.broker_source.added',
    resourceType: 'broker_source',
    resourceId: source.broker_slug,
    details: { name: source.broker_name },
    ip: getRequestIp(req),
    db: owner.db,
  });

  res.json({ source });
});

app.post('/api/owner/notifications/read', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  await markAllNotificationsRead(owner.db);
  res.json({ ok: true });
});

app.get('/api/owner/fundamental/status', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  res.json(getFundamentalOwnerDiagnostics());
});

app.post('/api/owner/fundamental/sync', async (req: Request, res: Response) => {
  const owner = await requireVerifiedOwner(req, res);
  if (!owner) return;

  const forceAi = Boolean(req.body?.forceAi);
  const syncResult = await syncFundamentalEvents(forceAi);
  const diagnostics = getFundamentalOwnerDiagnostics();

  await recordOwnerAudit({
    userId: owner.user.id,
    email: owner.user.email || '',
    action: 'owner.fundamental.sync',
    resourceType: 'fundamental_events',
    details: { eventCount: syncResult.eventCount, errors: syncResult.errors },
    ip: getRequestIp(req),
    db: owner.db,
  });

  res.json({ syncResult, ...diagnostics });
});

// ============================================================================
// VITE / STATIC SPA ENTRYPOINT
// ============================================================================
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        // Always bind Vite's WS handler onto httpServer with explicit path so
        // Vite 8 never defaults @vite/client hmrPort to 24678 in middlewareMode.
        ws: { server: httpServer, path: '/__vite_hmr' },
        hmr: disableHmr ? false : { server: httpServer, path: '/__vite_hmr' },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (pathname === '/ws/market') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async (client: WsClient) => {
    // Push initial verified quotes snapshot immediately on connect
    const snapshot: Record<string, VerifiedQuote> = {};
    await Promise.allSettled(
      SUPPORTED_SYMBOLS.map(async (sym) => {
        try {
          snapshot[sym] = await getVerifiedQuote(sym);
        } catch {
          // skip failed instrument
        }
      })
    );

    if (client.readyState === WsClient.OPEN) {
      client.send(
        JSON.stringify({
          type: 'snapshot',
          prices: snapshot,
          timestamp: new Date().toISOString(),
        })
      );
    }
  });

  startUpstreamMarketStream((quote) => {
    const msg = JSON.stringify({
      type: 'quote',
      quote,
      timestamp: new Date().toISOString(),
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WsClient.OPEN) {
        client.send(msg);
      }
    });
  });

  // Persistent background daily analysis, fundamental macro, & broker competition schedulers
  startDailyAnalysisScheduler();
  startFundamentalAnalysisScheduler();
  startCompetitionDiscoveryScheduler();

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`YOUNEEL TRADING server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
});
