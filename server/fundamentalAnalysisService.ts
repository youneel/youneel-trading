import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  ALL_SUPPORTED_SYMBOLS,
  SupportedSymbol,
  roundPrice,
} from '../src/lib/tradingMath.js';
import { getVerifiedMarketData, getVerifiedQuote } from './marketData.js';
import { getAllTodaySummaries } from './dailyAnalysisService.js';
import { getAdminClient } from './supabaseAdmin.js';

export type MacroEventType = 'CPI' | 'FOMC' | 'PPI' | 'NFP';
export type EventLifecycleStatus = 'UPCOMING' | 'RELEASED' | 'ANALYSIS_UPDATED' | 'DATA_UNAVAILABLE';
export type AssetImpactBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'UNCERTAIN';
export type ImpactStrength = 'LOW' | 'MEDIUM' | 'HIGH';
export type SignalTone = 'HAWKISH' | 'DOVISH' | 'NEUTRAL' | 'MIXED' | 'INSUFFICIENT_EVIDENCE';

export interface SourceReference {
  label: string;
  institution: string;
  url: string;
  publishedAt?: string;
}

export interface AssetMacroImpact {
  symbol: SupportedSymbol;
  bias: AssetImpactBias;
  strength: ImpactStrength;
  reasoning: string;
  transmissionMechanism: string;
  supportingEvidence: string[];
  invalidationConditions: string[];
  technicalAlignment: {
    status: 'ALIGNED' | 'CONFLICT' | 'INSUFFICIENT_EVIDENCE';
    technicalBias: string | null;
    referencePrice: number | null;
    note: string;
  };
  postReleaseReaction?: {
    available: boolean;
    referencePriceBefore: number | null;
    observedPriceAfter: number | null;
    pctMove: number | null;
    directionConfirmed: 'CONFIRMED' | 'CONTRADICTED' | 'MIXED' | 'UNAVAILABLE';
    timestamp: string | null;
  };
}

export interface FundamentalAnalysisStage {
  stage: 'BEFORE_RELEASE' | 'AFTER_RELEASE';
  generatedAt: string;
  headlineAssessment: string;
  policyImplication: string;
  signalClassification: SignalTone;
  scenarios?: {
    bullishScenario: string;
    bearishScenario: string;
    neutralScenario: string;
    uncertaintyFactors: string[];
  };
  reportBreakdown: Record<string, any>;
  assetImpacts: Record<SupportedSymbol, AssetMacroImpact>;
  researchAttribution: {
    officialFacts: string[];
    marketExpectations: string[];
    publishedSources: SourceReference[];
    analyticalInterpretation: string;
  };
  aiInterpretation?: {
    used: boolean;
    model: string | null;
    summary: string | null;
    error?: string;
  };
}

export interface FundamentalEventRecord {
  id: string;
  eventType: MacroEventType;
  title: string;
  referencePeriod: string;
  scheduledAt: string; // ISO UTC
  scheduledDisplayNY: string;
  timezone: 'America/New_York';
  importance: 'HIGH';
  status: EventLifecycleStatus;
  dataFreshness: 'LIVE' | 'DELAYED' | 'DATA_UNAVAILABLE';
  actualSummary: string | null;
  forecastSummary: string | null;
  previousSummary: string | null;
  revisionSummary: string | null;
  officialMetrics: Record<string, any>;
  sourceUrls: SourceReference[];
  beforeRelease: FundamentalAnalysisStage | null;
  afterRelease: FundamentalAnalysisStage | null;
  lastSyncedAt: string;
}

export interface FundamentalSyncLog {
  id: string;
  sourceName: string;
  eventType: MacroEventType | 'ALL';
  status: 'success' | 'partial' | 'failed';
  errorMessage: string | null;
  executedAt: string;
}

interface FundamentalStore {
  events: Record<string, FundamentalEventRecord>;
  blsSnapshotHistory: Record<string, { year: string; period: string; value: number; recordedAt: string }[]>;
  syncLogs: FundamentalSyncLog[];
  lastFullSyncAt: string | null;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'fundamental_events.json');

const BLS_SERIES = {
  CPI_HEADLINE: 'CUSR0000SA0',
  CPI_CORE: 'CUSR0000SA0L1E',
  PPI_HEADLINE: 'WPSFD4',
  PPI_CORE: 'WPSFD49116',
  NFP_PAYROLLS: 'CES0000000001',
  NFP_UNEMPLOYMENT: 'LNS14000000',
  NFP_AHE: 'CES0500000003',
  NFP_WEEKLY_HOURS: 'CES0500000002',
  NFP_PARTICIPATION: 'LNS11300000',
} as const;

let store: FundamentalStore = loadStore();
let syncInFlight: Promise<void> | null = null;
let schedulerStarted = false;

function loadStore(): FundamentalStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      return {
        events: parsed.events || {},
        blsSnapshotHistory: parsed.blsSnapshotHistory || {},
        syncLogs: Array.isArray(parsed.syncLogs) ? parsed.syncLogs : [],
        lastFullSyncAt: parsed.lastFullSyncAt || null,
      };
    }
  } catch (err: any) {
    console.warn('Warning loading fundamental_events.json:', err?.message);
  }
  return { events: {}, blsSnapshotHistory: {}, syncLogs: [], lastFullSyncAt: null };
}

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err: any) {
    console.error('Failed saving fundamental_events.json:', err?.message);
  }
}

function addSyncLog(
  sourceName: string,
  eventType: MacroEventType | 'ALL',
  status: 'success' | 'partial' | 'failed',
  errorMessage: string | null = null
) {
  const entry: FundamentalSyncLog = {
    id: `fsync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sourceName,
    eventType,
    status,
    errorMessage,
    executedAt: new Date().toISOString(),
  };
  store.syncLogs.unshift(entry);
  if (store.syncLogs.length > 120) {
    store.syncLogs = store.syncLogs.slice(0, 120);
  }
  const admin = getAdminClient();
  if (admin) {
    Promise.resolve(
      admin.from('fundamental_sync_logs').insert([
        {
          source_name: sourceName,
          event_type: eventType,
          status,
          error_message: errorMessage,
          executed_at: entry.executedAt,
        },
      ])
    ).catch(() => {});
  }
}

// ============================================================================
// DST-AWARE AMERICA/NEW_YORK TIMESTAMP CONVERSION
// ============================================================================
function zonedNewYorkToUtcIso(year: number, month1To12: number, day: number, hour24: number, minute: number): string {
  // Approximate UTC then adjust using real Intl.DateTimeFormat parts for America/New_York (handles EST/EDT cleanly)
  const approxUtc = new Date(Date.UTC(year, month1To12 - 1, day, hour24 + 5, minute, 0));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const getParts = (d: Date) => {
    const map: Record<string, number> = {};
    for (const p of fmt.formatToParts(d)) {
      if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10);
    }
    return map;
  };
  const p = getParts(approxUtc);
  const nyRenderedMs = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, 0);
  const desiredMs = Date.UTC(year, month1To12 - 1, day, hour24, minute, 0);
  const diffMs = desiredMs - nyRenderedMs;
  return new Date(approxUtc.getTime() + diffMs).toISOString();
}

function formatNYDisplay(isoUtc: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(isoUtc));
  } catch {
    return isoUtc;
  }
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function parseMonthName(raw: string): number | null {
  const clean = raw.toLowerCase().replace(/[^a-z]/g, '');
  return MONTH_MAP[clean] || null;
}

// ============================================================================
// OFFICIAL BLS SCHEDULE PARSER (CPI, PPI, EMPLOYMENT SITUATION)
// ============================================================================
interface ScheduledBlsRelease {
  eventType: 'CPI' | 'PPI' | 'NFP';
  referencePeriod: string; // e.g. "October 2026"
  yearMonth: string; // e.g. "2026-10"
  scheduledAt: string;
  scheduledDisplayNY: string;
  sourceUrl: string;
}

async function fetchBlsSchedule(eventType: 'CPI' | 'PPI' | 'NFP'): Promise<ScheduledBlsRelease[]> {
  const url =
    eventType === 'CPI'
      ? 'https://www.bls.gov/schedule/news_release/cpi.htm'
      : eventType === 'PPI'
      ? 'https://www.bls.gov/schedule/news_release/ppi.htm'
      : 'https://www.bls.gov/schedule/news_release/empsit.htm';

  const res = await fetch(url, {
    headers: { 'User-Agent': 'YOUNEEL-TRADING/1.0 (contact@youneel.com)' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`BLS schedule ${eventType} HTTP ${res.status}`);
  const html = await res.text();
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const releases: ScheduledBlsRelease[] = [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    );
    if (cells.length < 3) continue;
    const refText = cells[0];
    const dateText = cells[1];
    const timeText = cells[2];

    const refMatch = refText.match(/^([A-Za-z]+)\s+(\d{4})/);
    const dateMatch = dateText.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})/);
    const timeMatch = timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!refMatch || !dateMatch) continue;

    const refMonth = parseMonthName(refMatch[1]);
    const refYear = parseInt(refMatch[2], 10);
    const relMonth = parseMonthName(dateMatch[1]);
    const relDay = parseInt(dateMatch[2], 10);
    const relYear = parseInt(dateMatch[3], 10);
    if (!refMonth || !relMonth) continue;

    let hour24 = 8;
    let minute = 30;
    if (timeMatch) {
      hour24 = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      if (timeMatch[3].toUpperCase() === 'PM' && hour24 < 12) hour24 += 12;
      if (timeMatch[3].toUpperCase() === 'AM' && hour24 === 12) hour24 = 0;
    }

    const scheduledAt = zonedNewYorkToUtcIso(relYear, relMonth, relDay, hour24, minute);
    releases.push({
      eventType,
      referencePeriod: `${refMatch[1]} ${refYear}`,
      yearMonth: `${refYear}-${String(refMonth).padStart(2, '0')}`,
      scheduledAt,
      scheduledDisplayNY: formatNYDisplay(scheduledAt),
      sourceUrl: url,
    });
  }

  return releases;
}

// ============================================================================
// OFFICIAL BLS PUBLIC API V2 SERIES DATA + REVISION TRACKING
// ============================================================================
interface BlsObs {
  year: string;
  period: string;
  periodName: string;
  yearMonth: string;
  value: number;
  isPreliminary: boolean;
}

async function fetchBlsSeriesBatch(): Promise<Record<string, BlsObs[]>> {
  const currentYear = new Date().getUTCFullYear();
  const startYear = String(currentYear - 2);
  const endYear = String(currentYear + 1);
  const seriesIds = Object.values(BLS_SERIES);
  const apiKey = process.env.BLS_API_KEY?.trim();

  const body: any = {
    seriesid: seriesIds,
    startyear: startYear,
    endyear: endYear,
  };
  if (apiKey) body.registrationkey = apiKey;

  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'YOUNEEL-TRADING/1.0',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`BLS API HTTP ${res.status}`);
  const json: any = await res.json();
  if (json?.status !== 'REQUEST_SUCCEEDED' || !Array.isArray(json?.Results?.series)) {
    throw new Error(`BLS API error: ${JSON.stringify(json?.message || json?.status)}`);
  }

  const out: Record<string, BlsObs[]> = {};
  for (const series of json.Results.series) {
    const list: BlsObs[] = [];
    for (const d of series.data || []) {
      if (!/^M\d{2}$/.test(d.period || '') || d.period === 'M13') continue;
      const val = Number(d.value);
      if (!Number.isFinite(val)) continue;
      const monthNum = d.period.slice(1);
      const footnotes = Array.isArray(d.footnotes) ? d.footnotes : [];
      const isPreliminary = footnotes.some((f: any) => String(f?.code || '').toUpperCase() === 'P');
      list.push({
        year: d.year,
        period: d.period,
        periodName: d.periodName,
        yearMonth: `${d.year}-${monthNum}`,
        value: val,
        isPreliminary,
      });
    }
    list.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
    out[series.seriesID] = list;

    // Revision tracking against stored history
    const prevSnap = store.blsSnapshotHistory[series.seriesID] || [];
    for (const obs of list.slice(0, 6)) {
      const match = prevSnap.find((p) => p.year === obs.year && p.period === obs.period);
      if (!match) {
        prevSnap.push({ year: obs.year, period: obs.period, value: obs.value, recordedAt: new Date().toISOString() });
      }
    }
    store.blsSnapshotHistory[series.seriesID] = prevSnap.slice(-24);
  }
  return out;
}

function findRevisionDelta(seriesId: string, obs: BlsObs | undefined): number | null {
  if (!obs) return null;
  const hist = store.blsSnapshotHistory[seriesId] || [];
  const prior = hist.find((h) => h.year === obs.year && h.period === obs.period);
  if (!prior) return null;
  const delta = obs.value - prior.value;
  return Math.abs(delta) > 1e-6 ? Number(delta.toFixed(3)) : null;
}

// ============================================================================
// FEDERAL RESERVE OFFICIAL FOMC DATA (CALENDAR, RSS STATEMENTS, FRED TARGETS)
// ============================================================================
interface FomcEventRaw {
  year: number;
  monthLabel: string;
  dateRange: string;
  hasSepDotPlot: boolean;
  scheduledAt: string;
  scheduledDisplayNY: string;
  statementUrl: string | null;
  pressConfUrl: string | null;
  upperRate: number | null;
  lowerRate: number | null;
  priorUpperRate: number | null;
  priorLowerRate: number | null;
  statementParagraphs: string[];
  previousStatementParagraphs: string[];
}

async function fetchFredSeriesTail(seriesId: string): Promise<{ date: string; value: number }[]> {
  try {
    const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`, {
      headers: { 'User-Agent': 'YOUNEEL-TRADING/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const csv = await res.text();
    const lines = csv.trim().split('\n').slice(1);
    const out: { date: string; value: number }[] = [];
    for (const line of lines.slice(-180)) {
      const [d, v] = line.split(',');
      const num = Number(v);
      if (d && Number.isFinite(num)) out.push({ date: d.trim(), value: num });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchFomcOfficialData(): Promise<{
  meetings: FomcEventRaw[];
  sourceUrl: string;
}> {
  const calUrl = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
  const rssUrl = 'https://www.federalreserve.gov/feeds/press_monetary.xml';

  const [calRes, rssRes, upperTail, lowerTail] = await Promise.all([
    fetch(calUrl, { headers: { 'User-Agent': 'YOUNEEL-TRADING/1.0' }, signal: AbortSignal.timeout(9000) }),
    fetch(rssUrl, { headers: { 'User-Agent': 'YOUNEEL-TRADING/1.0' }, signal: AbortSignal.timeout(8000) }).catch(() => null),
    fetchFredSeriesTail('DFEDTARU'),
    fetchFredSeriesTail('DFEDTARL'),
  ]);

  if (!calRes.ok) throw new Error(`Federal Reserve FOMC Calendar HTTP ${calRes.status}`);
  const calHtml = await calRes.text();

  // Extract official statement links from RSS for recent meetings
  const statementLinks: { dateIso: string; url: string }[] = [];
  if (rssRes && rssRes.ok) {
    const rssText = await rssRes.text();
    const itemMatches = [...rssText.matchAll(/<item[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<pubDate>([\s\S]*?)<\/pubDate>/gi)];
    for (const m of itemMatches) {
      const title = m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim().toLowerCase();
      const url = m[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const pub = m[3].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      if (title.includes('fomc statement') && url) {
        const dt = new Date(pub);
        if (!isNaN(dt.getTime())) {
          statementLinks.push({ dateIso: dt.toISOString().slice(0, 10), url });
        }
      }
    }
  }

  // Extract yearly panels (e.g. "2026 FOMC Meetings", "2027 FOMC Meetings")
  const panelRegex = /<div class="panel panel-default"[\s\S]*?<h4[^>]*>[\s\S]*?(202[5-9])\s+FOMC Meetings([\s\S]*?)(?=<div class="panel panel-default"|<div id="footer")/gi;
  const meetings: FomcEventRaw[] = [];

  for (const panelMatch of calHtml.matchAll(panelRegex)) {
    const year = parseInt(panelMatch[1], 10);
    const panelBody = panelMatch[2];
    const blocks = panelBody.split(/<div class="[^"]*\brow\s+fomc-meeting\b[^"]*"/i).slice(1);

    for (const block of blocks) {
      const mMonth = block.match(/fomc-meeting__month[^>]*>\s*<strong>([\s\S]*?)<\/strong>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
      const mDate = block.match(/fomc-meeting__date[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
      if (!mMonth || !mDate) continue;

      const hasSepDotPlot = mDate.includes('*');
      // Parse second day of 2-day meeting (release date), handling e.g. "27-28", "Apr/May" "30-1", "16-17*"
      const firstMonthName = mMonth.split('/')[0].trim();
      const secondMonthName = mMonth.includes('/') ? mMonth.split('/')[1].trim() : firstMonthName;
      const monthNum = parseMonthName(secondMonthName) || parseMonthName(firstMonthName);
      if (!monthNum) continue;

      const dayMatch = mDate.match(/(\d{1,2})\s*(?:-|–)?\s*(\d{1,2})?/);
      const releaseDay = dayMatch ? parseInt(dayMatch[2] || dayMatch[1], 10) : null;
      if (!releaseDay || mDate.toLowerCase().includes('notation')) continue;

      const scheduledAt = zonedNewYorkToUtcIso(year, monthNum, releaseDay, 14, 0);
      const stmtHref = block.match(/href="([^"]*pressreleases\/monetary[^"]*\.htm)"/i)?.[1] || null;
      const pressHref = block.match(/href="([^"]*fomcpress?conf[^"]*\.htm)"/i)?.[1] || null;

      const datePrefix = scheduledAt.slice(0, 10);
      const nextDayIso = new Date(new Date(scheduledAt).getTime() + 36 * 3600_000).toISOString().slice(0, 10);
      const rssMatched = statementLinks.find((s) => s.dateIso === datePrefix)?.url || null;
      const statementUrl = stmtHref
        ? `https://www.federalreserve.gov${stmtHref.startsWith('/') ? stmtHref : `/${stmtHref}`}`
        : rssMatched;
      const pressConfUrl = pressHref
        ? `https://www.federalreserve.gov${pressHref.startsWith('/') ? pressHref : `/${pressHref}`}`
        : null;

      // Determine rate range around that meeting date from FRED DFEDTARU/DFEDTARL if released.
      // FOMC decision takes effect the business day after Day-2 (so look up >= nextDayIso, or latest tail if very recent).
      let upperRate: number | null = null;
      let lowerRate: number | null = null;
      let priorUpperRate: number | null = null;
      let priorLowerRate: number | null = null;

      const isReleased = new Date(scheduledAt).getTime() <= Date.now();
      if (isReleased && upperTail.length > 0 && lowerTail.length > 0) {
        const afterObs = upperTail.find((u) => u.date >= nextDayIso) || upperTail[upperTail.length - 1];
        const afterLower = lowerTail.find((u) => u.date >= nextDayIso) || lowerTail[lowerTail.length - 1];
        const beforeObs = [...upperTail].reverse().find((u) => u.date <= datePrefix);
        const beforeLower = [...lowerTail].reverse().find((u) => u.date <= datePrefix);
        upperRate = afterObs?.value ?? null;
        lowerRate = afterLower?.value ?? null;
        priorUpperRate = beforeObs?.value ?? null;
        priorLowerRate = beforeLower?.value ?? null;
      }

      meetings.push({
        year,
        monthLabel: mMonth,
        dateRange: mDate,
        hasSepDotPlot,
        scheduledAt,
        scheduledDisplayNY: formatNYDisplay(scheduledAt),
        statementUrl,
        pressConfUrl,
        upperRate,
        lowerRate,
        priorUpperRate,
        priorLowerRate,
        statementParagraphs: [],
        previousStatementParagraphs: [],
      });
    }
  }

  // Sort chronologically and fetch text for the latest 2 released FOMC statements for statement diffing
  meetings.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const released = meetings.filter((m) => new Date(m.scheduledAt).getTime() <= Date.now() && m.statementUrl);
  const toFetch = released.slice(-2);

  await Promise.allSettled(
    toFetch.map(async (m) => {
      if (!m.statementUrl) return;
      try {
        const r = await fetch(m.statementUrl, {
          headers: { 'User-Agent': 'YOUNEEL-TRADING/1.0' },
          signal: AbortSignal.timeout(7000),
        });
        if (!r.ok) return;
        const html = await r.text();
        const body = html.match(/<div id="article">([\s\S]*?)<div id="lastUpdate/i)?.[1] || '';
        m.statementParagraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
          .map((p) => p[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
          .filter((p) => p.length > 30 && !p.startsWith('For release'));
      } catch {
        // leave empty if unreachable
      }
    })
  );

  for (let i = 1; i < released.length; i++) {
    released[i].previousStatementParagraphs = released[i - 1].statementParagraphs;
  }

  return { meetings, sourceUrl: calUrl };
}

// ============================================================================
// OPTIONAL FINNHUB CONSENSUS FORECASTS (ZERO FABRICATED NUMBERS WHEN ABSENT)
// ============================================================================
interface ConsensusEntry {
  event: string;
  date: string;
  estimate: number | null;
  actual: number | null;
  prev: number | null;
  unit: string;
}

async function fetchFinnhubUsConsensus(): Promise<ConsensusEntry[]> {
  const key = (process.env.FINNHUB_API_KEY || process.env.NEWS_API_KEY)?.trim();
  if (!key) return [];
  try {
    const now = new Date();
    const from = new Date(now.getTime() - 40 * 86400_000).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 45 * 86400_000).toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data: any = await res.json();
    const list = Array.isArray(data?.economicCalendar) ? data.economicCalendar : [];
    return list
      .filter((e: any) => String(e?.country || '').toUpperCase() === 'US')
      .map((e: any) => ({
        event: String(e.event || ''),
        date: String(e.time || ''),
        estimate: Number.isFinite(Number(e.estimate)) ? Number(e.estimate) : null,
        actual: Number.isFinite(Number(e.actual)) ? Number(e.actual) : null,
        prev: Number.isFinite(Number(e.prev)) ? Number(e.prev) : null,
        unit: String(e.unit || '%'),
      }));
  } catch {
    return [];
  }
}

// ============================================================================
// TECHNICAL ALIGNMENT CROSS-CHECK + POST-RELEASE PRICE REACTION
// ============================================================================
function attachTechnicalAlignment(
  symbol: SupportedSymbol,
  fundamentalBias: AssetImpactBias
): AssetMacroImpact['technicalAlignment'] {
  const summaries = getAllTodaySummaries();
  const tech = summaries?.[symbol];
  if (!tech || tech.dailyBias === 'INSUFFICIENT DATA') {
    return {
      status: 'INSUFFICIENT_EVIDENCE',
      technicalBias: tech?.dailyBias || null,
      referencePrice: tech?.referencePrice ?? null,
      note: 'Technical daily bias snapshot currently lacks sufficient verified candles for cross-confirmation.',
    };
  }

  const techDir = tech.dailyBias.includes('Bullish')
    ? 'BULLISH'
    : tech.dailyBias.includes('Bearish')
    ? 'BEARISH'
    : 'NEUTRAL';

  if (fundamentalBias === 'NEUTRAL' || fundamentalBias === 'UNCERTAIN' || techDir === 'NEUTRAL') {
    return {
      status: 'INSUFFICIENT_EVIDENCE',
      technicalBias: tech.dailyBias,
      referencePrice: tech.referencePrice,
      note: `Fundamental assessment is ${fundamentalBias} while daily technical structure is ${tech.dailyBias} (${tech.directionalAlignmentScore}% alignment).`,
    };
  }

  if (fundamentalBias === techDir) {
    return {
      status: 'ALIGNED',
      technicalBias: tech.dailyBias,
      referencePrice: tech.referencePrice,
      note: `Fundamental macro lean (${fundamentalBias}) aligns with daily technical structure (${tech.dailyBias} at ${tech.directionalAlignmentScore}% alignment).`,
    };
  }

  return {
    status: 'CONFLICT',
    technicalBias: tech.dailyBias,
    referencePrice: tech.referencePrice,
    note: `SIGNAL CONFLICT: Fundamental macro lean (${fundamentalBias}) opposes daily technical structure (${tech.dailyBias}). Wait for technical structure confirmation rather than forcing a trade.`,
  };
}

async function computePostReleaseReactions(
  scheduledAtIso: string,
  expectedImpacts: Record<SupportedSymbol, AssetMacroImpact>
): Promise<void> {
  const releaseMs = new Date(scheduledAtIso).getTime();
  if (releaseMs > Date.now() - 15 * 60_000) return;

  await Promise.allSettled(
    ALL_SUPPORTED_SYMBOLS.map(async (sym) => {
      try {
        const mkt = await getVerifiedMarketData(sym, 'H1');
        const candles = mkt.candles || [];
        if (candles.length < 3) throw new Error('Insufficient H1 bars');

        const before = [...candles].reverse().find((c) => c.time * 1000 <= releaseMs);
        const after = candles.find((c) => c.time * 1000 >= releaseMs + 3600_000) || candles[candles.length - 1];
        const liveQuote = await getVerifiedQuote(sym).catch(() => null);
        const afterPrice = after?.close ?? liveQuote?.price ?? null;
        const beforePrice = before?.close ?? null;

        if (beforePrice && afterPrice && beforePrice > 0) {
          const pctMove = Number((((afterPrice - beforePrice) / beforePrice) * 100).toFixed(3));
          const bias = expectedImpacts[sym].bias;
          let directionConfirmed: 'CONFIRMED' | 'CONTRADICTED' | 'MIXED' | 'UNAVAILABLE' = 'MIXED';
          if (Math.abs(pctMove) < 0.05) {
            directionConfirmed = bias === 'NEUTRAL' ? 'CONFIRMED' : 'MIXED';
          } else if (bias === 'BULLISH') {
            directionConfirmed = pctMove > 0 ? 'CONFIRMED' : 'CONTRADICTED';
          } else if (bias === 'BEARISH') {
            directionConfirmed = pctMove < 0 ? 'CONFIRMED' : 'CONTRADICTED';
          } else {
            directionConfirmed = 'MIXED';
          }

          expectedImpacts[sym].postReleaseReaction = {
            available: true,
            referencePriceBefore: roundPrice(beforePrice, sym),
            observedPriceAfter: roundPrice(afterPrice, sym),
            pctMove,
            directionConfirmed,
            timestamp: after ? new Date(after.time * 1000).toISOString() : new Date().toISOString(),
          };
          return;
        }
      } catch {
        // mark unavailable honestly below
      }

      expectedImpacts[sym].postReleaseReaction = {
        available: false,
        referencePriceBefore: null,
        observedPriceAfter: null,
        pctMove: null,
        directionConfirmed: 'UNAVAILABLE',
        timestamp: null,
      };
    })
  );
}

// ============================================================================
// ASSET-SPECIFIC MACRO ENGINE (INDIVIDUAL CAUSAL EVALUATION FOR ALL 8 ASSETS)
// ============================================================================
function buildEightAssetImpacts(params: {
  eventType: MacroEventType;
  tone: SignalTone;
  usdBias: 'HAWKISH_USD_UP' | 'DOVISH_USD_DOWN' | 'NEUTRAL';
  strength: ImpactStrength;
  evidence: string[];
  stage: 'BEFORE_RELEASE' | 'AFTER_RELEASE';
}): Record<SupportedSymbol, AssetMacroImpact> {
  const { eventType, tone, usdBias, strength, evidence, stage } = params;
  const isUncertain = tone === 'MIXED' || tone === 'INSUFFICIENT_EVIDENCE' || usdBias === 'NEUTRAL';
  const effectiveStrength: ImpactStrength = isUncertain ? 'LOW' : strength;

  const mk = (
    symbol: SupportedSymbol,
    bias: AssetImpactBias,
    reasoning: string,
    transmissionMechanism: string,
    invalidationConditions: string[]
  ): AssetMacroImpact => ({
    symbol,
    bias,
    strength: effectiveStrength,
    reasoning,
    transmissionMechanism,
    supportingEvidence: evidence,
    invalidationConditions,
    technicalAlignment: attachTechnicalAlignment(symbol, bias),
  });

  if (stage === 'BEFORE_RELEASE' || isUncertain) {
    const notePrefix =
      stage === 'BEFORE_RELEASE'
        ? `Pre-release baseline pending official ${eventType} release:`
        : `Mixed or inconclusive ${eventType} signal (${tone}):`;

    return {
      XAUUSD: mk(
        'XAUUSD',
        stage === 'BEFORE_RELEASE' ? 'UNCERTAIN' : 'NEUTRAL',
        `${notePrefix} Gold balances US real-yield expectations against safe-haven and positioning flows.`,
        'US Treasury real yields & USD direction vs non-yielding bullion opportunity cost.',
        ['Sustained surprise > 0.2% deviation on Core reading', 'Sharp divergence between US 10Y real yields and DXY']
      ),
      NASDAQ: mk(
        'NASDAQ',
        stage === 'BEFORE_RELEASE' ? 'UNCERTAIN' : 'NEUTRAL',
        `${notePrefix} Long-duration Nasdaq-100 valuations remain sensitive to discount-rate repricing and growth durability.`,
        'Equity risk premium & long-end discount rates vs corporate earnings growth expectations.',
        ['2Y/10Y Treasury yields breaking key intraday structure', 'Mixed wage vs inflation components shifting Fed cut odds']
      ),
      BTCUSD: mk(
        'BTCUSD',
        stage === 'BEFORE_RELEASE' ? 'UNCERTAIN' : 'NEUTRAL',
        `${notePrefix} Bitcoin reacts to global dollar liquidity expectations and cross-asset risk appetite.`,
        'USD liquidity conditions, real-rate expectations, and speculative risk sentiment.',
        ['Sudden shift in equity risk appetite (US100 correlation break)', 'Major liquidity tightening from front-end yields']
      ),
      EURUSD: mk(
        'EURUSD',
        stage === 'BEFORE_RELEASE' ? 'UNCERTAIN' : 'NEUTRAL',
        `${notePrefix} EUR/USD direction hinges on Fed vs ECB rate-differential repricing.`,
        'US–Eurozone front-end yield spread and dollar broad index response.',
        ['Divergent Core vs Headline surprise reversing initial USD spike', 'ECB policy expectations offsetting US rate repricing']
      ),
      GBPUSD: mk(
        'GBPUSD',
        stage === 'BEFORE_RELEASE' ? 'UNCERTAIN' : 'NEUTRAL',
        `${notePrefix} GBP/USD responds to US–UK policy differential and broader risk sentiment.`,
        'US–UK 2-year swap spread and global risk-on/risk-off capital flows.',
        ['UK gilt yield sympathy moves muting USD differential', 'High-beta risk reversal']
      ),
      USDJPY: mk(
        'USDJPY',
        stage === 'BEFORE_RELEASE' ? 'UNCERTAIN' : 'NEUTRAL',
        `${notePrefix} USD/JPY tracks US 10-year nominal yields closely relative to Bank of Japan yield constraints.`,
        'US–Japan sovereign yield spread and carry-trade volatility.',
        ['Abrupt risk-off flight-to-safety strengthening JPY despite higher US yields', 'Official FX intervention risk']
      ),
      US30: mk(
        'US30',
        stage === 'BEFORE_RELEASE' ? 'UNCERTAIN' : 'NEUTRAL',
        `${notePrefix} Dow Jones industrials & financials balance cyclical growth health against higher borrowing costs.`,
        'Cyclical value / financial net-interest-margin sensitivity vs broad rate pressure.',
        ['Recessionary labor deterioration hitting cyclicals even if yields drop', 'Rotation between defensive industrials and growth tech']
      ),
      USOIL: mk(
        'USOIL',
        stage === 'BEFORE_RELEASE' ? 'UNCERTAIN' : 'NEUTRAL',
        `${notePrefix} WTI Crude Oil responds indirectly via US growth/demand outlook and USD purchasing power, alongside independent supply/inventory drivers.`,
        'Macro demand growth impulse + USD denomination effect vs physical inventory/geopolitical supply balance.',
        ['EIA inventory surprises or OPEC+ supply shifts overriding macro USD effect', 'Stagflation signals splitting growth vs inflation channels']
      ),
    };
  }

  const hawk = usdBias === 'HAWKISH_USD_UP';

  return {
    XAUUSD: mk(
      'XAUUSD',
      hawk ? 'BEARISH' : 'BULLISH',
      hawk
        ? `${eventType} reinforces firmer US rate/yield expectations, increasing opportunity cost on non-yielding gold.`
        : `${eventType} eases US rate pressure, supporting gold via softer real yields and weaker dollar pressure.`,
      'Real Treasury yields & USD inverse sensitivity on non-yielding XAU.',
      ['Real yields reversing initial spike within NY session', 'Escalating geopolitical safe-haven bids offsetting higher USD']
    ),
    NASDAQ: mk(
      'NASDAQ',
      hawk ? 'BEARISH' : 'BULLISH',
      hawk
        ? `Firmer ${eventType} data lifts discount-rate expectations, pressuring high-multiple Nasdaq technology valuations.`
        : `Softer ${eventType} pressure supports lower discount-rate pricing, benefiting long-duration tech equities.`,
      'Discount-rate sensitivity on long-duration growth cash flows and 2Y/10Y Treasury yields.',
      ['Strong growth/earnings optimism offsetting rate pressure (e.g., hot NFP without wage inflation)', 'Treasury yields fading lower after initial knee-jerk']
    ),
    BTCUSD: mk(
      'BTCUSD',
      hawk ? 'BEARISH' : 'BULLISH',
      hawk
        ? `Tighter liquidity expectations and stronger USD create headwinds for risk-sensitive digital assets.`
        : `Easing financial-condition expectations and softer USD support crypto liquidity and risk appetite.`,
      'Global USD liquidity proxy + correlation with US100 risk sentiment.',
      ['Crypto-specific ETF inflows decoupling BTC from Nasdaq', 'Yield curve steepening offsetting Fed tightening fears']
    ),
    EURUSD: mk(
      'EURUSD',
      hawk ? 'BEARISH' : 'BULLISH',
      hawk
        ? `Hawkish ${eventType} outcome widens US–Eurozone yield advantage in favor of USD.`
        : `Dovish ${eventType} reading compresses US rate advantage, lifting EUR/USD.`,
      'US–Germany 2Y yield differential & broad USD index momentum.',
      ['Prior-month downward revisions negating headline beat', 'Divergent ECB commentary narrowing spread']
    ),
    GBPUSD: mk(
      'GBPUSD',
      hawk ? 'BEARISH' : 'BULLISH',
      hawk
        ? `Stronger USD yield support and tighter risk appetite weigh on GBP/USD.`
        : `Softer US policy expectations lift GBP/USD on narrowing rate differentials and calmer risk tone.`,
      'US–UK yield differential and pro-cyclical Sterling sensitivity.',
      ['Simultaneous risk-on rally supporting GBP despite firm US yields', 'Prior revision reversal']
    ),
    USDJPY: mk(
      'USDJPY',
      hawk ? 'BULLISH' : 'BEARISH',
      hawk
        ? `Higher US Treasury yields widen the US–Japan carry differential, supporting USD/JPY.`
        : `Lower US yields narrow the US–Japan rate differential, pressuring USD/JPY downward.`,
      'Direct positive transmission through US 10Y yields and US–JPY carry spread.',
      ['Severe equity selloff triggering safe-haven JPY repatriation', 'Japanese official FX intervention warning']
    ),
    US30: mk(
      'US30',
      eventType === 'NFP' && hawk ? 'NEUTRAL' : hawk ? 'BEARISH' : 'BULLISH',
      eventType === 'NFP' && hawk
        ? `Stronger employment supports cyclical Dow earnings, partially offsetting tighter monetary policy rate drag — producing mixed sector rotation.`
        : hawk
        ? `Tighter financial condition expectations weigh on broad industrial and consumer valuations.`
        : `Lower rate expectations ease financing burdens across cyclical and financial Dow constituents.`,
      'Cyclical corporate demand vs borrowing-cost pressure (lower duration sensitivity than US100).',
      ['Financials rallying on steeper yield curves while tech falls', 'Growth slowdown outweighing rate-cut relief']
    ),
    USOIL: mk(
      'USOIL',
      eventType === 'NFP' && hawk ? 'NEUTRAL' : hawk ? 'BEARISH' : 'BULLISH',
      eventType === 'NFP' && hawk
        ? `Stronger US labor activity implies resilient fuel demand, offsetting headwinds from a firmer USD.`
        : hawk
        ? `A stronger USD and tighter-policy demand-cooling risks weigh modestly on WTI Crude.`
        : `Softer USD lowers commodity denomination drag, though physical inventory and OPEC supply remain primary drivers.`,
      'USD inverse denomination effect + macro demand expectation vs physical supply/EIA inventories.',
      ['EIA crude inventory draw/build or geopolitical supply disruption dominating macro print']
    ),
  };
}

// ============================================================================
// OPTIONAL GEMINI INTERPRETATION (EXPLANATION ONLY — GROUNDED ON FACTS)
// ============================================================================
async function generateGroundedAiSummary(
  eventTitle: string,
  stage: 'BEFORE_RELEASE' | 'AFTER_RELEASE',
  facts: string[]
): Promise<{ used: boolean; model: string | null; summary: string | null; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      used: false,
      model: null,
      summary: null,
      error: 'GEMINI_API_KEY not configured; deterministic official-source analysis active.',
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    const prompt = `You are a disciplined institutional macroeconomist at YOUNEEL TRADING.
Write a crisp 3-sentence objective analytical interpretation for: ${eventTitle} (${stage}).
Use ONLY these verified facts — NEVER invent numbers, forecasts, quotes, or institutional opinions:
${facts.map((f) => `- ${f}`).join('\n')}`;

    const call = ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
          },
          required: ['summary'],
        },
      },
    });
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Gemini timeout')), 9000));
    const resp: any = await Promise.race([call, timeout]);
    const parsed = JSON.parse(resp?.text || '{}');
    return {
      used: true,
      model: 'gemini-4-hydrogen',
      summary: String(parsed?.summary || '').trim() || null,
    };
  } catch (err: any) {
    return {
      used: false,
      model: null,
      summary: null,
      error: err?.message || 'Gemini interpretation unavailable',
    };
  }
}

// ============================================================================
// MAIN ORCHESTRATOR: SYNC CPI, PPI, NFP, FOMC EVENTS & TWO-STAGE SNAPSHOTS
// ============================================================================
function pctChange(curr?: BlsObs, prev?: BlsObs): number | null {
  if (!curr || !prev || prev.value === 0) return null;
  return Number((((curr.value - prev.value) / prev.value) * 100).toFixed(2));
}

function findObsForYearMonth(list: BlsObs[] | undefined, ym: string): { obs?: BlsObs; prev?: BlsObs; yoyBase?: BlsObs } {
  if (!list || list.length === 0) return {};
  const idx = list.findIndex((o) => o.yearMonth === ym);
  if (idx < 0) return {};
  const obs = list[idx];
  const prev = list[idx + 1];
  const [y, m] = ym.split('-').map(Number);
  const yoyKey = `${y - 1}-${String(m).padStart(2, '0')}`;
  const yoyBase = list.find((o) => o.yearMonth === yoyKey);
  return { obs, prev, yoyBase };
}

async function persistEventToSupabase(ev: FundamentalEventRecord) {
  const admin = getAdminClient();
  if (!admin) return;
  try {
    await admin.from('fundamental_events').upsert({
      id: ev.id,
      event_type: ev.eventType,
      title: ev.title,
      reference_period: ev.referencePeriod,
      scheduled_at: ev.scheduledAt,
      timezone: ev.timezone,
      importance: ev.importance,
      status: ev.status,
      actual_summary: ev.actualSummary,
      forecast_summary: ev.forecastSummary,
      previous_summary: ev.previousSummary,
      revision_summary: ev.revisionSummary,
      official_metrics: ev.officialMetrics,
      source_urls: ev.sourceUrls,
      data_freshness: ev.dataFreshness,
      last_synced_at: ev.lastSyncedAt,
    });

    for (const stageObj of [ev.beforeRelease, ev.afterRelease]) {
      if (!stageObj) continue;
      await admin
        .from('fundamental_analysis_versions')
        .upsert(
          {
            event_id: ev.id,
            stage: stageObj.stage,
            event_type: ev.eventType,
            headline_assessment: stageObj.headlineAssessment,
            policy_implication: stageObj.policyImplication,
            signal_classification: stageObj.signalClassification,
            report_breakdown: { ...stageObj.reportBreakdown, scenarios: stageObj.scenarios || null },
            asset_impacts: stageObj.assetImpacts,
            post_release_reaction: stageObj.stage === 'AFTER_RELEASE' ? true : null,
            research_attribution: stageObj.researchAttribution,
            ai_interpretation: stageObj.aiInterpretation || null,
          },
          { onConflict: 'event_id,stage', ignoreDuplicates: stageObj.stage === 'BEFORE_RELEASE' }
        );
    }
  } catch {
    // Table may not be migrated yet; file store stays authoritative
  }
}

export async function syncFundamentalEvents(forceAi = false): Promise<{
  syncedAt: string;
  eventCount: number;
  errors: string[];
}> {
  if (syncInFlight) {
    await syncInFlight;
    return {
      syncedAt: store.lastFullSyncAt || new Date().toISOString(),
      eventCount: Object.keys(store.events).length,
      errors: [],
    };
  }

  const errors: string[] = [];

  syncInFlight = (async () => {
    const [cpiSchedRes, ppiSchedRes, nfpSchedRes, blsBatchRes, fomcRes, finnhubRes] = await Promise.allSettled([
      fetchBlsSchedule('CPI'),
      fetchBlsSchedule('PPI'),
      fetchBlsSchedule('NFP'),
      fetchBlsSeriesBatch(),
      fetchFomcOfficialData(),
      fetchFinnhubUsConsensus(),
    ]);

    const blsSeries = blsBatchRes.status === 'fulfilled' ? blsBatchRes.value : {};
    if (blsBatchRes.status === 'rejected') {
      const msg = blsBatchRes.reason?.message || 'BLS timeseries unavailable';
      errors.push(msg);
      addSyncLog('BLS Public API v2', 'ALL', 'failed', msg);
    } else {
      addSyncLog('BLS Public API v2', 'ALL', 'success', null);
    }

    const consensusList = finnhubRes.status === 'fulfilled' ? finnhubRes.value : [];
    const nowMs = Date.now();

    // Helper: pick last 2 released + next 2 upcoming BLS releases for CPI, PPI, NFP
    const processBlsType = async (
      eventType: 'CPI' | 'PPI' | 'NFP',
      schedResult: PromiseSettledResult<ScheduledBlsRelease[]>
    ) => {
      if (schedResult.status === 'rejected') {
        const msg = schedResult.reason?.message || `BLS ${eventType} schedule failed`;
        errors.push(msg);
        addSyncLog(`BLS ${eventType} Schedule`, eventType, 'failed', msg);
        return;
      }
      addSyncLog(`BLS ${eventType} Schedule`, eventType, 'success', null);

      const allSched = schedResult.value.sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
      const past = allSched.filter((s) => new Date(s.scheduledAt).getTime() <= nowMs).slice(-3);
      const future = allSched.filter((s) => new Date(s.scheduledAt).getTime() > nowMs).slice(0, 2);

      for (const rel of [...past, ...future]) {
        const id = `${eventType}_${rel.yearMonth}`;
        const existing = store.events[id];
        const isReleasedTime = new Date(rel.scheduledAt).getTime() <= nowMs;

        // Look up consensus forecast if Finnhub returned a matching release
        const matchedConsensus = consensusList.find((c) => {
          const evUpper = c.event.toUpperCase();
          const sameDay = c.date.slice(0, 10) === rel.scheduledAt.slice(0, 10);
          if (!sameDay) return false;
          if (eventType === 'CPI') return evUpper.includes('CPI') && !evUpper.includes('CORE');
          if (eventType === 'PPI') return evUpper.includes('PPI') && !evUpper.includes('CORE');
          return evUpper.includes('NON FARM') || evUpper.includes('NONFARM') || evUpper.includes('PAYROLL');
        });

        let officialMetrics: Record<string, any> = {};
        let actualSummary: string | null = null;
        let previousSummary: string | null = null;
        let revisionSummary: string | null = null;
        let tone: SignalTone = 'NEUTRAL';
        let usdBias: 'HAWKISH_USD_UP' | 'DOVISH_USD_DOWN' | 'NEUTRAL' = 'NEUTRAL';
        let strength: ImpactStrength = 'MEDIUM';
        let hasActualForPeriod = false;
        let headlineAssessment = '';
        let policyImplication = '';
        let officialFacts: string[] = [];

        if (eventType === 'CPI') {
          const hList = blsSeries[BLS_SERIES.CPI_HEADLINE] || [];
          const cList = blsSeries[BLS_SERIES.CPI_CORE] || [];
          const targetH = findObsForYearMonth(hList, rel.yearMonth);
          const targetC = findObsForYearMonth(cList, rel.yearMonth);
          const latestH = hList[0];
          const prevH = hList[1];
          const latestC = cList[0];
          const prevC = cList[1];

          const useH = targetH.obs ? targetH : (!isReleasedTime ? { obs: undefined, prev: latestH, yoyBase: hList[11] } : {});
          const useC = targetC.obs ? targetC : (!isReleasedTime ? { obs: undefined, prev: latestC, yoyBase: cList[11] } : {});

          const hMom = useH.obs ? pctChange(useH.obs, useH.prev) : null;
          const hYoy = useH.obs ? pctChange(useH.obs, useH.yoyBase) : null;
          const cMom = useC.obs ? pctChange(useC.obs, useC.prev) : null;
          const cYoy = useC.obs ? pctChange(useC.obs, useC.yoyBase) : null;

          const prevMomH = pctChange(latestH, prevH);
          const prevYoyH = pctChange(latestH, hList[12]);
          const prevMomC = pctChange(latestC, prevC);
          const prevYoyC = pctChange(latestC, cList[12]);

          const revH = findRevisionDelta(BLS_SERIES.CPI_HEADLINE, targetH.prev);
          const revC = findRevisionDelta(BLS_SERIES.CPI_CORE, targetC.prev);
          hasActualForPeriod = Boolean(targetH.obs && targetC.obs);

          previousSummary = prevMomH !== null && prevYoyH !== null
            ? `Headline ${prevMomH >= 0 ? '+' : ''}${prevMomH}% MoM (${prevYoyH}% YoY) • Core ${prevMomC !== null ? `${prevMomC >= 0 ? '+' : ''}${prevMomC}%` : 'N/A'} MoM`
            : null;

          if (hasActualForPeriod && hMom !== null && cMom !== null) {
            actualSummary = `Headline ${hMom >= 0 ? '+' : ''}${hMom}% MoM (${hYoy ?? 'N/A'}% YoY) • Core ${cMom >= 0 ? '+' : ''}${cMom}% MoM (${cYoy ?? 'N/A'}% YoY)`;
            if (revH !== null || revC !== null) {
              revisionSummary = `Prior index revised by Headline ${revH ?? 0}, Core ${revC ?? 0}`;
            }

            const prevReleaseMomC = pctChange(targetC.prev, cList[cList.indexOf(targetC.prev!) + 1]);
            const coreAccelerating = prevReleaseMomC !== null ? cMom > prevReleaseMomC + 0.05 : cMom >= 0.3;
            const coreCooling = prevReleaseMomC !== null ? cMom < prevReleaseMomC - 0.05 : cMom <= 0.15;

            if (cMom >= 0.3 || coreAccelerating) {
              tone = 'HAWKISH';
              usdBias = 'HAWKISH_USD_UP';
              strength = cMom >= 0.4 ? 'HIGH' : 'MEDIUM';
              headlineAssessment = `Core CPI (${cMom >= 0 ? '+' : ''}${cMom}% MoM, ${cYoy ?? 'N/A'}% YoY) signals persistent underlying inflation pressure.`;
              policyImplication = 'Supports higher-for-longer Federal Funds rate expectations and dampens near-term rate-cut pricing.';
            } else if (coreCooling || cMom <= 0.15) {
              tone = 'DOVISH';
              usdBias = 'DOVISH_USD_DOWN';
              strength = cMom <= 0.1 ? 'HIGH' : 'MEDIUM';
              headlineAssessment = `Core CPI (${cMom >= 0 ? '+' : ''}${cMom}% MoM, ${cYoy ?? 'N/A'}% YoY) indicates moderating underlying inflation momentum.`;
              policyImplication = 'Supports gradual disinflation confidence and lowers barrier for Federal Reserve easing.';
            } else {
              tone = 'MIXED';
              usdBias = 'NEUTRAL';
              strength = 'LOW';
              headlineAssessment = `Headline (${hMom}% MoM) and Core CPI (${cMom}% MoM) point to steady, mixed disinflation progress.`;
              policyImplication = 'Unlikely alone to force an abrupt shift in Federal Reserve rate guidance.';
            }

            officialFacts = [
              `Headline CPI (${rel.referencePeriod}): ${hMom}% MoM, ${hYoy ?? 'N/A'}% YoY (BLS series ${BLS_SERIES.CPI_HEADLINE}).`,
              `Core CPI ex-Food & Energy: ${cMom}% MoM, ${cYoy ?? 'N/A'}% YoY (BLS series ${BLS_SERIES.CPI_CORE}).`,
              previousSummary ? `Prior Reference Comparison: ${previousSummary}.` : 'Prior comparison pending.',
            ];
          } else {
            officialFacts = [
              `Scheduled Official Release (${rel.referencePeriod}): ${rel.scheduledDisplayNY}.`,
              previousSummary ? `Latest Recorded CPI Baseline: ${previousSummary}.` : 'Latest CPI baseline pending.',
            ];
          }

          officialMetrics = {
            headlineIndex: targetH.obs?.value ?? null,
            headlineMomPct: hMom,
            headlineYoyPct: hYoy,
            coreIndex: targetC.obs?.value ?? null,
            coreMomPct: cMom,
            coreYoyPct: cYoy,
            latestBaselineMomHeadline: prevMomH,
            latestBaselineYoyHeadline: prevYoyH,
            latestBaselineMomCore: prevMomC,
            latestBaselineYoyCore: prevYoyC,
          };
        } else if (eventType === 'PPI') {
          const hList = blsSeries[BLS_SERIES.PPI_HEADLINE] || [];
          const cList = blsSeries[BLS_SERIES.PPI_CORE] || [];
          const targetH = findObsForYearMonth(hList, rel.yearMonth);
          const targetC = findObsForYearMonth(cList, rel.yearMonth);
          const latestH = hList[0];
          const prevH = hList[1];
          const latestC = cList[0];
          const prevC = cList[1];

          const hMom = targetH.obs ? pctChange(targetH.obs, targetH.prev) : null;
          const hYoy = targetH.obs ? pctChange(targetH.obs, targetH.yoyBase) : null;
          const cMom = targetC.obs ? pctChange(targetC.obs, targetC.prev) : null;
          const cYoy = targetC.obs ? pctChange(targetC.obs, targetC.yoyBase) : null;
          const prevMomH = pctChange(latestH, prevH);
          const prevMomC = pctChange(latestC, prevC);
          hasActualForPeriod = Boolean(targetH.obs && targetC.obs);

          const revH = findRevisionDelta(BLS_SERIES.PPI_HEADLINE, targetH.prev);
          const revC = findRevisionDelta(BLS_SERIES.PPI_CORE, targetC.prev);

          previousSummary = prevMomH !== null
            ? `Headline PPI ${prevMomH >= 0 ? '+' : ''}${prevMomH}% MoM • Core PPI ${prevMomC !== null ? `${prevMomC >= 0 ? '+' : ''}${prevMomC}%` : 'N/A'} MoM`
            : null;

          // Compare with same-month CPI if available
          const cpiObs = findObsForYearMonth(blsSeries[BLS_SERIES.CPI_CORE] || [], rel.yearMonth);
          const cpiMom = cpiObs.obs ? pctChange(cpiObs.obs, cpiObs.prev) : null;

          if (hasActualForPeriod && hMom !== null && cMom !== null) {
            actualSummary = `Headline ${hMom >= 0 ? '+' : ''}${hMom}% MoM (${hYoy ?? 'N/A'}% YoY) • Core ${cMom >= 0 ? '+' : ''}${cMom}% MoM (${cYoy ?? 'N/A'}% YoY)`;
            if (revH !== null || revC !== null) {
              revisionSummary = `Prior PPI index revised by Headline ${revH ?? 0}, Core ${revC ?? 0}`;
            }

            if (cMom >= 0.3 && hMom >= 0.25) {
              tone = 'HAWKISH';
              usdBias = 'HAWKISH_USD_UP';
              strength = 'MEDIUM';
              headlineAssessment = `Producer price pipeline firming (Core PPI ${cMom >= 0 ? '+' : ''}${cMom}% MoM) suggests sticky upstream cost pressures.`;
              policyImplication = `Modest hawkish lean; however PPI pass-through to consumer CPI depends on retail margins and PCE-linked healthcare/airfare weights (${cpiMom !== null ? `same-month Core CPI: ${cpiMom}% MoM` : 'awaiting consumer read'}).`;
            } else if (cMom <= 0.1 && hMom <= 0.1) {
              tone = 'DOVISH';
              usdBias = 'DOVISH_USD_DOWN';
              strength = 'MEDIUM';
              headlineAssessment = `Cooling wholesale prices (Core PPI ${cMom >= 0 ? '+' : ''}${cMom}% MoM) point to easing upstream pipeline inflation.`;
              policyImplication = `Supports benign PCE/CPI pipeline expectations, though service margins can still diverge from goods wholesale prices.`;
            } else {
              tone = 'MIXED';
              usdBias = 'NEUTRAL';
              strength = 'LOW';
              headlineAssessment = `Mixed producer inflation report (Headline ${hMom}% MoM, Core ${cMom}% MoM) shows uneven pass-through pressure.`;
              policyImplication = 'Limited standalone policy shift; traders cross-check PPI subcomponents that directly feed Core PCE.';
            }

            officialFacts = [
              `Headline Final Demand PPI (${rel.referencePeriod}): ${hMom}% MoM, ${hYoy ?? 'N/A'}% YoY (BLS ${BLS_SERIES.PPI_HEADLINE}).`,
              `Core Final Demand PPI: ${cMom}% MoM, ${cYoy ?? 'N/A'}% YoY (BLS ${BLS_SERIES.PPI_CORE}).`,
              'Analytical Limitation: Producer prices do not pass through 1-for-1 to CPI; margins and volatile energy/food swings frequently create divergence.',
            ];
          } else {
            officialFacts = [
              `Scheduled Official Release (${rel.referencePeriod}): ${rel.scheduledDisplayNY}.`,
              previousSummary ? `Latest Recorded PPI Baseline: ${previousSummary}.` : 'Latest PPI baseline pending.',
            ];
          }

          officialMetrics = {
            headlineMomPct: hMom,
            headlineYoyPct: hYoy,
            coreMomPct: cMom,
            coreYoyPct: cYoy,
            samePeriodCoreCpiMomPct: cpiMom,
            preliminaryFlag: targetH.obs?.isPreliminary || false,
          };
        } else {
          // NFP (Employment Situation)
          const pList = blsSeries[BLS_SERIES.NFP_PAYROLLS] || [];
          const uList = blsSeries[BLS_SERIES.NFP_UNEMPLOYMENT] || [];
          const aheList = blsSeries[BLS_SERIES.NFP_AHE] || [];
          const hrsList = blsSeries[BLS_SERIES.NFP_WEEKLY_HOURS] || [];
          const partList = blsSeries[BLS_SERIES.NFP_PARTICIPATION] || [];

          const tP = findObsForYearMonth(pList, rel.yearMonth);
          const tU = findObsForYearMonth(uList, rel.yearMonth);
          const tA = findObsForYearMonth(aheList, rel.yearMonth);
          const tH = findObsForYearMonth(hrsList, rel.yearMonth);
          const tPart = findObsForYearMonth(partList, rel.yearMonth);

          const latestPayChange = pList[0] && pList[1] ? Math.round(pList[0].value - pList[1].value) : null;
          previousSummary = latestPayChange !== null && uList[0]
            ? `Payrolls ${latestPayChange >= 0 ? '+' : ''}${latestPayChange}K • Unemp ${uList[0].value}% • AHE ${pctChange(aheList[0], aheList[1]) ?? 'N/A'}% MoM`
            : null;

          hasActualForPeriod = Boolean(tP.obs && tP.prev && tU.obs && tA.obs);
          if (hasActualForPeriod && tP.obs && tP.prev && tU.obs && tA.obs) {
            const payrollChangeK = Math.round(tP.obs.value - tP.prev.value);
            const unempRate = tU.obs.value;
            const prevUnemp = tU.prev?.value ?? null;
            const aheMom = pctChange(tA.obs, tA.prev);
            const aheYoy = pctChange(tA.obs, tA.yoyBase);
            const weeklyHours = tH.obs?.value ?? null;
            const participation = tPart.obs?.value ?? null;
            const revP = findRevisionDelta(BLS_SERIES.NFP_PAYROLLS, tP.prev);

            actualSummary = `Payrolls ${payrollChangeK >= 0 ? '+' : ''}${payrollChangeK}K • Unemp ${unempRate}% • Wages ${aheMom !== null ? `${aheMom >= 0 ? '+' : ''}${aheMom}%` : 'N/A'} MoM`;
            if (revP !== null) {
              revisionSummary = `Prior month nonfarm payroll level revised by ${revP > 0 ? '+' : ''}${revP}K`;
            }

            // NEVER judge NFP on payrolls alone — require consistency across payrolls, unemployment, and wages!
            const strongJobs = payrollChangeK >= 150;
            const weakJobs = payrollChangeK <= 95;
            const firmWages = (aheMom ?? 0) >= 0.35;
            const coolWages = (aheMom ?? 0) <= 0.2;
            const risingUnemp = prevUnemp !== null ? unempRate >= prevUnemp + 0.2 : false;
            const tightUnemp = prevUnemp !== null ? unempRate <= prevUnemp : unempRate <= 4.2;

            if (strongJobs && firmWages && tightUnemp && !risingUnemp) {
              tone = 'HAWKISH';
              usdBias = 'HAWKISH_USD_UP';
              strength = 'HIGH';
              headlineAssessment = `Tight labor market across headline payrolls (+${payrollChangeK}K), low unemployment (${unempRate}%), and firm hourly earnings (${aheMom}% MoM).`;
              policyImplication = 'Reduces urgency for Fed rate cuts because robust job creation paired with firm wage inflation can sustain services inflation.';
            } else if ((weakJobs || risingUnemp) && coolWages) {
              tone = 'DOVISH';
              usdBias = 'DOVISH_USD_DOWN';
              strength = 'HIGH';
              headlineAssessment = `Broad labor-market cooling across payroll growth (+${payrollChangeK}K), unemployment (${unempRate}%), and wage moderation (${aheMom}% MoM).`;
              policyImplication = 'Increases focus on the Federal Reserve employment mandate, reinforcing expectations for policy easing.';
            } else {
              tone = 'MIXED';
              usdBias = 'NEUTRAL';
              strength = 'LOW';
              headlineAssessment = `Mixed Employment Report: Payrolls (+${payrollChangeK}K), Unemployment (${unempRate}%), and Wage Growth (${aheMom ?? 'N/A'}% MoM) give diverging policy signals.`;
              policyImplication = 'Headline payrolls alone are insufficient: diverging unemployment or wage inflation prevents a clean hawkish/dovish consensus.';
            }

            officialFacts = [
              `Nonfarm Payrolls Change (${rel.referencePeriod}): ${payrollChangeK >= 0 ? '+' : ''}${payrollChangeK}K (BLS ${BLS_SERIES.NFP_PAYROLLS}).`,
              `Unemployment Rate: ${unempRate}% (Prior: ${prevUnemp ?? 'N/A'}%), Participation Rate: ${participation ?? 'N/A'}%.`,
              `Average Hourly Earnings: $${tA.obs.value.toFixed(2)} (${aheMom ?? 'N/A'}% MoM, ${aheYoy ?? 'N/A'}% YoY) • Weekly Hours: ${weeklyHours ?? 'N/A'}h.`,
            ];

            officialMetrics = {
              payrollChangeK,
              unemploymentRatePct: unempRate,
              prevUnemploymentPct: prevUnemp,
              avgHourlyEarningsUsd: tA.obs.value,
              avgHourlyEarningsMomPct: aheMom,
              avgHourlyEarningsYoyPct: aheYoy,
              avgWeeklyHours: weeklyHours,
              participationRatePct: participation,
            };
          } else {
            officialFacts = [
              `Scheduled Official Release (${rel.referencePeriod}): ${rel.scheduledDisplayNY}.`,
              previousSummary ? `Latest Recorded Employment Baseline: ${previousSummary}.` : 'Latest NFP baseline pending.',
            ];
            officialMetrics = { latestPayChangeK: latestPayChange, latestUnemploymentPct: uList[0]?.value ?? null };
          }
        }

        const forecastSummary =
          matchedConsensus?.estimate !== null && matchedConsensus?.estimate !== undefined
            ? `${matchedConsensus.estimate}${matchedConsensus.unit}`
            : null;

        const sources: SourceReference[] = [
          {
            label: `BLS Official ${eventType} Release Schedule`,
            institution: 'U.S. Bureau of Labor Statistics',
            url: rel.sourceUrl,
          },
          {
            label: `BLS Public API v2 (${eventType} Series)`,
            institution: 'U.S. Bureau of Labor Statistics',
            url: 'https://www.bls.gov/developers/',
            publishedAt: rel.scheduledAt,
          },
        ];

        // Preserve Stage 1 (BEFORE_RELEASE) immutably once created
        let beforeStage: FundamentalAnalysisStage | null = existing?.beforeRelease || null;
        if (!beforeStage) {
          const beforeImpacts = buildEightAssetImpacts({
            eventType,
            tone: 'NEUTRAL',
            usdBias: 'NEUTRAL',
            strength: 'MEDIUM',
            evidence: officialFacts,
            stage: 'BEFORE_RELEASE',
          });
          beforeStage = {
            stage: 'BEFORE_RELEASE',
            generatedAt: new Date().toISOString(),
            headlineAssessment: `Upcoming ${eventType} (${rel.referencePeriod}) scheduled for ${rel.scheduledDisplayNY}.`,
            policyImplication: 'Policy pricing depends on Core vs Headline alignment, revisions, and surprise magnitude relative to market expectations.',
            signalClassification: 'INSUFFICIENT_EVIDENCE',
            scenarios: {
              bullishScenario: `Softer-than-expected ${eventType} / cooling core & wage components -> softer USD and yields, supportive bias for XAUUSD, US100, EURUSD, GBPUSD.`,
              bearishScenario: `Hotter-than-expected ${eventType} / firm core & wage components -> higher USD & real yields, supportive for USDJPY and headwinds for XAUUSD & US100.`,
              neutralScenario: `In-line or internally conflicting ${eventType} components -> choppy two-way reaction before reverting to prevailing technical structure.`,
              uncertaintyFactors: [
                forecastSummary ? `Market consensus baseline: ${forecastSummary}` : 'Verified institutional consensus forecast feed not configured (marked unavailable).',
                'Prior-month revisions can invert initial headline algorithmic moves.',
              ],
            },
            reportBreakdown: {
              referencePeriod: rel.referencePeriod,
              previousSummary,
              forecastSummary: forecastSummary || 'DATA UNAVAILABLE (Consensus feed not configured)',
              officialMetricsBaseline: officialMetrics,
            },
            assetImpacts: beforeImpacts,
            researchAttribution: {
              officialFacts,
              marketExpectations: forecastSummary
                ? [`Verified Consensus Forecast: ${forecastSummary}`]
                : ['DATA UNAVAILABLE: No verified live consensus forecast provider configured for this event.'],
              publishedSources: sources,
              analyticalInterpretation: `Pre-release conditional framework preserved prior to ${rel.scheduledDisplayNY} release. Conditional scenarios do not represent verified outcomes.`,
            },
          };
        }

        // Stage 2 (AFTER_RELEASE) created/refreshed ONLY when actual official release data is present
        let afterStage: FundamentalAnalysisStage | null = existing?.afterRelease || null;
        let status: EventLifecycleStatus = isReleasedTime
          ? hasActualForPeriod
            ? 'ANALYSIS_UPDATED'
            : 'DATA_UNAVAILABLE'
          : 'UPCOMING';

        if (hasActualForPeriod) {
          const afterImpacts = buildEightAssetImpacts({
            eventType,
            tone,
            usdBias,
            strength,
            evidence: [...officialFacts, ...(revisionSummary ? [revisionSummary] : [])],
            stage: 'AFTER_RELEASE',
          });
          await computePostReleaseReactions(rel.scheduledAt, afterImpacts);

          const aiResult =
            existing?.afterRelease?.aiInterpretation?.used && !forceAi
              ? existing.afterRelease.aiInterpretation
              : await generateGroundedAiSummary(`${eventType} (${rel.referencePeriod})`, 'AFTER_RELEASE', officialFacts);

          afterStage = {
            stage: 'AFTER_RELEASE',
            generatedAt: new Date().toISOString(),
            headlineAssessment,
            policyImplication,
            signalClassification: tone,
            reportBreakdown: {
              referencePeriod: rel.referencePeriod,
              actualSummary,
              previousSummary,
              forecastSummary: forecastSummary || 'DATA UNAVAILABLE',
              revisionSummary: revisionSummary || 'No revision detected against prior tracked BLS snapshot.',
              officialMetrics,
            },
            assetImpacts: afterImpacts,
            researchAttribution: {
              officialFacts,
              marketExpectations: forecastSummary
                ? [`Pre-release Consensus Estimate: ${forecastSummary}`]
                : ['Market consensus estimate unavailable; comparison conducted against verified official prior-month series.'],
              publishedSources: sources,
              analyticalInterpretation: aiResult.summary || `${headlineAssessment} ${policyImplication}`,
            },
            aiInterpretation: aiResult,
          };
        }

        const record: FundamentalEventRecord = {
          id,
          eventType,
          title: `US ${eventType} — ${rel.referencePeriod}`,
          referencePeriod: rel.referencePeriod,
          scheduledAt: rel.scheduledAt,
          scheduledDisplayNY: rel.scheduledDisplayNY,
          timezone: 'America/New_York',
          importance: 'HIGH',
          status,
          dataFreshness: isReleasedTime && !hasActualForPeriod ? 'DELAYED' : 'LIVE',
          actualSummary,
          forecastSummary,
          previousSummary,
          revisionSummary,
          officialMetrics,
          sourceUrls: sources,
          beforeRelease: beforeStage,
          afterRelease: afterStage,
          lastSyncedAt: new Date().toISOString(),
        };

        store.events[id] = record;
        await persistEventToSupabase(record);
      }
    };

    await processBlsType('CPI', cpiSchedRes);
    await processBlsType('PPI', ppiSchedRes);
    await processBlsType('NFP', nfpSchedRes);

    // Process Federal Reserve FOMC meetings
    if (fomcRes.status === 'rejected') {
      const msg = fomcRes.reason?.message || 'Federal Reserve FOMC feed failed';
      errors.push(msg);
      addSyncLog('Federal Reserve FOMC', 'FOMC', 'failed', msg);
    } else {
      addSyncLog('Federal Reserve FOMC', 'FOMC', 'success', null);
      const allFomc = fomcRes.value.meetings;
      const pastFomc = allFomc.filter((m) => new Date(m.scheduledAt).getTime() <= nowMs).slice(-3);
      const futureFomc = allFomc.filter((m) => new Date(m.scheduledAt).getTime() > nowMs).slice(0, 2);

      for (const m of [...pastFomc, ...futureFomc]) {
        const id = `FOMC_${m.scheduledAt.slice(0, 10)}`;
        const existing = store.events[id];
        const isReleased = new Date(m.scheduledAt).getTime() <= nowMs;
        const rateStr =
          m.lowerRate !== null && m.upperRate !== null
            ? `${m.lowerRate.toFixed(2)}%–${m.upperRate.toFixed(2)}%`
            : null;
        const priorRateStr =
          m.priorLowerRate !== null && m.priorUpperRate !== null
            ? `${m.priorLowerRate.toFixed(2)}%–${m.priorUpperRate.toFixed(2)}%`
            : null;

        const sources: SourceReference[] = [
          {
            label: 'Federal Reserve FOMC Calendar & Projections',
            institution: 'Board of Governors of the Federal Reserve System',
            url: fomcRes.value.sourceUrl,
          },
        ];
        if (m.statementUrl) {
          sources.push({
            label: 'Official FOMC Monetary Policy Statement',
            institution: 'Federal Reserve',
            url: m.statementUrl,
            publishedAt: m.scheduledAt,
          });
        }
        if (m.pressConfUrl) {
          sources.push({
            label: 'FOMC Chair Press Conference & Transcript Page',
            institution: 'Federal Reserve',
            url: m.pressConfUrl,
            publishedAt: m.scheduledAt,
          });
        }

        const rateDeltaBps =
          m.upperRate !== null && m.priorUpperRate !== null
            ? Math.round((m.upperRate - m.priorUpperRate) * 100)
            : null;

        let tone: SignalTone = 'NEUTRAL';
        let usdBias: 'HAWKISH_USD_UP' | 'DOVISH_USD_DOWN' | 'NEUTRAL' = 'NEUTRAL';
        let strength: ImpactStrength = 'MEDIUM';

        const stmtJoined = m.statementParagraphs.join(' ').toLowerCase();
        const prevJoined = m.previousStatementParagraphs.join(' ').toLowerCase();
        const hawkishTerms = ['inflation remains somewhat elevated', 'attentive to inflation risks', 'not appropriate to reduce', 'additional firming'];
        const dovishTerms = ['risks to employment', 'easing', 'reduce the target range', 'downside risks to employment'];
        const detectedHawkSignals = hawkishTerms.filter((k) => stmtJoined.includes(k));
        const detectedDovSignals = dovishTerms.filter((k) => stmtJoined.includes(k));

        if (rateDeltaBps !== null && rateDeltaBps < 0) {
          tone = detectedHawkSignals.length > detectedDovSignals.length ? 'MIXED' : 'DOVISH';
          usdBias = tone === 'DOVISH' ? 'DOVISH_USD_DOWN' : 'NEUTRAL';
          strength = 'HIGH';
        } else if (rateDeltaBps !== null && rateDeltaBps > 0) {
          tone = 'HAWKISH';
          usdBias = 'HAWKISH_USD_UP';
          strength = 'HIGH';
        } else if (detectedHawkSignals.length > detectedDovSignals.length) {
          tone = 'HAWKISH';
          usdBias = 'HAWKISH_USD_UP';
        } else if (detectedDovSignals.length > detectedHawkSignals.length) {
          tone = 'DOVISH';
          usdBias = 'DOVISH_USD_DOWN';
        }

        const newDiffLines = m.statementParagraphs.filter(
          (p) => m.previousStatementParagraphs.length > 0 && !m.previousStatementParagraphs.includes(p)
        );
        const removedDiffLines = m.previousStatementParagraphs.filter(
          (p) => m.statementParagraphs.length > 0 && !m.statementParagraphs.includes(p)
        );

        const officialFacts: string[] = [];
        if (rateStr) officialFacts.push(`Federal Funds Target Range: ${rateStr}${priorRateStr ? ` (Prior: ${priorRateStr}, Change: ${rateDeltaBps ?? 0} bps)` : ''}.`);
        if (m.statementParagraphs[0]) officialFacts.push(`Official FOMC Statement Opening: "${m.statementParagraphs[0]}"`);
        if (m.statementParagraphs[1]) officialFacts.push(`Policy Decision Paragraph: "${m.statementParagraphs[1]}"`);
        if (m.hasSepDotPlot) officialFacts.push('Meeting includes Summary of Economic Projections (SEP / Dot Plot).');
        if (officialFacts.length === 0) {
          officialFacts.push(`Scheduled FOMC Decision: ${m.scheduledDisplayNY}${m.hasSepDotPlot ? ' (includes SEP / Dot Plot)' : ''}.`);
        }

        let beforeStage: FundamentalAnalysisStage | null = existing?.beforeRelease || null;
        if (!beforeStage) {
          beforeStage = {
            stage: 'BEFORE_RELEASE',
            generatedAt: new Date().toISOString(),
            headlineAssessment: `Upcoming FOMC Rate Decision (${m.monthLabel} ${m.dateRange}, ${m.year})${m.hasSepDotPlot ? ' with SEP / Dot Plot' : ''}.`,
            policyImplication: 'Markets assess both the Federal Funds target range and forward-guidance shifts in the statement, Dot Plot medians, and Chair Powell press conference.',
            signalClassification: 'INSUFFICIENT_EVIDENCE',
            scenarios: {
              bullishScenario: 'Dovish guidance / lower rate path or Dot Plot -> softer front-end yields & USD, constructive for XAUUSD, US100, BTCUSD, EURUSD.',
              bearishScenario: 'Hawkish hold or higher-for-longer Dot Plot emphasis on inflation -> firmer USD & yields, constructive for USDJPY, pressure on XAUUSD & US100.',
              neutralScenario: 'In-line hold with balanced dual-mandate phrasing -> initial volatility followed by press-conference tone resolution.',
              uncertaintyFactors: [
                'Consensus expected rate depends on live OIS/Fed-Funds futures pricing.',
                'Chair Powell press conference Q&A can reverse initial statement-algos within 30–60 minutes.',
              ],
            },
            reportBreakdown: {
              meetingDates: `${m.monthLabel} ${m.dateRange}, ${m.year}`,
              includesSepDotPlot: m.hasSepDotPlot,
              priorTargetRange: priorRateStr || rateStr || 'See FRED DFEDTARU/DFEDTARL',
            },
            assetImpacts: buildEightAssetImpacts({
              eventType: 'FOMC',
              tone: 'NEUTRAL',
              usdBias: 'NEUTRAL',
              strength: 'MEDIUM',
              evidence: officialFacts,
              stage: 'BEFORE_RELEASE',
            }),
            researchAttribution: {
              officialFacts,
              marketExpectations: ['Rate-path probabilities should be cross-checked against CME FedWatch / OIS futures; no unverified probabilities invented here.'],
              publishedSources: sources,
              analyticalInterpretation: `Pre-meeting conditional framework preserved prior to ${m.scheduledDisplayNY}.`,
            },
          };
        }

        let afterStage: FundamentalAnalysisStage | null = existing?.afterRelease || null;
        const hasActual = isReleased && Boolean(rateStr || m.statementParagraphs.length > 0);
        const status: EventLifecycleStatus = isReleased
          ? hasActual
            ? 'ANALYSIS_UPDATED'
            : 'DATA_UNAVAILABLE'
          : 'UPCOMING';

        if (hasActual) {
          const afterImpacts = buildEightAssetImpacts({
            eventType: 'FOMC',
            tone,
            usdBias,
            strength,
            evidence: officialFacts,
            stage: 'AFTER_RELEASE',
          });
          await computePostReleaseReactions(m.scheduledAt, afterImpacts);

          const headlineAssessment = `FOMC set target range at ${rateStr || 'see official statement'}${
            rateDeltaBps !== null ? ` (${rateDeltaBps === 0 ? 'unchanged' : `${rateDeltaBps > 0 ? '+' : ''}${rateDeltaBps} bps`})` : ''
          } with ${tone} communication balance.`;
          const policyImplication =
            newDiffLines.length > 0
              ? `Statement wording changed across ${newDiffLines.length} paragraph(s) compared with the prior FOMC meeting.`
              : prevJoined === stmtJoined && stmtJoined
              ? 'Statement language unchanged from previous meeting.'
              : 'Review official FOMC statement & Chair Powell press conference transcript via the Federal Reserve source links.';

          const aiResult =
            existing?.afterRelease?.aiInterpretation?.used && !forceAi
              ? existing.afterRelease.aiInterpretation
              : await generateGroundedAiSummary(`FOMC (${m.monthLabel} ${m.year})`, 'AFTER_RELEASE', officialFacts);

          afterStage = {
            stage: 'AFTER_RELEASE',
            generatedAt: new Date().toISOString(),
            headlineAssessment,
            policyImplication,
            signalClassification: tone,
            reportBreakdown: {
              decisionTargetRange: rateStr || 'See official statement',
              priorTargetRange: priorRateStr || 'N/A',
              rateChangeBps: rateDeltaBps,
              includesSepDotPlot: m.hasSepDotPlot,
              hawkishSignalsDetected: detectedHawkSignals,
              dovishSignalsDetected: detectedDovSignals,
              statementChangesCount: newDiffLines.length,
              newOrChangedParagraphs: newDiffLines.slice(0, 3),
              removedPriorParagraphs: removedDiffLines.slice(0, 2),
              pressConferenceSource: m.pressConfUrl || 'Not published separately yet',
            },
            assetImpacts: afterImpacts,
            researchAttribution: {
              officialFacts,
              marketExpectations: ['Actual decision evaluated strictly against official prior target range and published statement changes.'],
              publishedSources: sources,
              analyticalInterpretation: aiResult.summary || `${headlineAssessment} ${policyImplication}`,
            },
            aiInterpretation: aiResult,
          };
        }

        store.events[id] = {
          id,
          eventType: 'FOMC',
          title: `FOMC Rate Decision — ${m.monthLabel} ${m.dateRange}, ${m.year}${m.hasSepDotPlot ? ' (SEP / Dot Plot)' : ''}`,
          referencePeriod: `${m.monthLabel} ${m.year}`,
          scheduledAt: m.scheduledAt,
          scheduledDisplayNY: m.scheduledDisplayNY,
          timezone: 'America/New_York',
          importance: 'HIGH',
          status,
          dataFreshness: isReleased && !hasActual ? 'DELAYED' : 'LIVE',
          actualSummary: rateStr ? `Fed Funds ${rateStr}${rateDeltaBps !== null ? ` (${rateDeltaBps === 0 ? 'Hold' : `${rateDeltaBps > 0 ? '+' : ''}${rateDeltaBps} bps`})` : ''}` : null,
          forecastSummary: null,
          previousSummary: priorRateStr ? `Prior Range ${priorRateStr}` : null,
          revisionSummary: null,
          officialMetrics: {
            upperRate: m.upperRate,
            lowerRate: m.lowerRate,
            priorUpperRate: m.priorUpperRate,
            priorLowerRate: m.priorLowerRate,
            rateDeltaBps,
            hasSepDotPlot: m.hasSepDotPlot,
          },
          sourceUrls: sources,
          beforeRelease: beforeStage,
          afterRelease: afterStage,
          lastSyncedAt: new Date().toISOString(),
        };
        await persistEventToSupabase(store.events[id]);
      }
    }

    store.lastFullSyncAt = new Date().toISOString();
    saveStore();
  })();

  try {
    await syncInFlight;
  } finally {
    syncInFlight = null;
  }

  return {
    syncedAt: store.lastFullSyncAt || new Date().toISOString(),
    eventCount: Object.keys(store.events).length,
    errors,
  };
}

// ============================================================================
// PUBLIC & OWNER QUERY HELPERS
// ============================================================================
export async function getFundamentalOverview() {
  if (Object.keys(store.events).length === 0) {
    await syncFundamentalEvents();
  }

  const all = Object.values(store.events).sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
  );
  const nowMs = Date.now();
  const upcoming = all
    .filter((e) => new Date(e.scheduledAt).getTime() > nowMs)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const released = all.filter((e) => new Date(e.scheduledAt).getTime() <= nowMs);

  const byCategory: Record<MacroEventType, { latestReleased: FundamentalEventRecord | null; nextUpcoming: FundamentalEventRecord | null }> = {
    CPI: {
      latestReleased: released.find((e) => e.eventType === 'CPI') || null,
      nextUpcoming: upcoming.find((e) => e.eventType === 'CPI') || null,
    },
    FOMC: {
      latestReleased: released.find((e) => e.eventType === 'FOMC') || null,
      nextUpcoming: upcoming.find((e) => e.eventType === 'FOMC') || null,
    },
    PPI: {
      latestReleased: released.find((e) => e.eventType === 'PPI') || null,
      nextUpcoming: upcoming.find((e) => e.eventType === 'PPI') || null,
    },
    NFP: {
      latestReleased: released.find((e) => e.eventType === 'NFP') || null,
      nextUpcoming: upcoming.find((e) => e.eventType === 'NFP') || null,
    },
  };

  return {
    lastSyncedAt: store.lastFullSyncAt,
    byCategory,
    upcoming,
    released,
    events: all,
  };
}

export function getFundamentalOwnerDiagnostics() {
  const all = Object.values(store.events).sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
  );
  return {
    schedulerRunning: schedulerStarted,
    lastFullSyncAt: store.lastFullSyncAt,
    totalEvents: all.length,
    unavailableCount: all.filter((e) => e.status === 'DATA_UNAVAILABLE').length,
    events: all.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      scheduledAt: e.scheduledAt,
      status: e.status,
      dataFreshness: e.dataFreshness,
      hasBeforeStage: Boolean(e.beforeRelease),
      hasAfterStage: Boolean(e.afterRelease),
      aiUsed: Boolean(e.afterRelease?.aiInterpretation?.used),
      aiError: e.afterRelease?.aiInterpretation?.error || null,
      lastSyncedAt: e.lastSyncedAt,
    })),
    syncLogs: store.syncLogs.slice(0, 30),
  };
}

export function startFundamentalAnalysisScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Initial sync shortly after server boot
  setTimeout(() => {
    syncFundamentalEvents().catch((err) =>
      console.warn('Initial fundamental analysis sync warning:', err?.message)
    );
  }, 2500);

  // Event-driven adaptive check every 5 min (syncs immediately if release window crossed, else every 30 min)
  setInterval(() => {
    const now = Date.now();
    const events = Object.values(store.events);
    const nearRelease = events.some((e) => {
      const schedMs = new Date(e.scheduledAt).getTime();
      const crossedRecently = schedMs <= now && schedMs >= now - 90 * 60_000 && !e.afterRelease;
      const approachingSoon = schedMs > now && schedMs <= now + 30 * 60_000;
      return crossedRecently || approachingSoon;
    });
    const lastMs = store.lastFullSyncAt ? new Date(store.lastFullSyncAt).getTime() : 0;
    if (nearRelease || now - lastMs >= 30 * 60_000) {
      syncFundamentalEvents().catch((err) =>
        console.warn('Scheduled fundamental sync warning:', err?.message)
      );
    }
  }, 5 * 60_000);
}
