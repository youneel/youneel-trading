import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from './supabaseAdmin.js';

export type CompetitionStatus =
  | 'UPCOMING'
  | 'REGISTRATION OPEN'
  | 'LIVE'
  | 'ENDING SOON'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'UNVERIFIED';

export type CompetitionReviewStatus =
  | 'pending_review'
  | 'approved'
  | 'auto_published'
  | 'rejected'
  | 'archived';

export interface BrokerSourceRecord {
  id: string;
  broker_slug: string;
  broker_name: string;
  official_website_url: string;
  competition_source_url: string;
  adapter_type: string;
  accent_theme: string;
  is_active: boolean;
  last_checked_at: string | null;
  last_status: string;
  last_http_status: number | null;
  last_error: string | null;
}

export interface BrokerCompetitionRecord {
  id: string;
  broker_id: string;
  broker_slug: string;
  external_key: string;
  title: string;
  subtitle: string;
  prize_pool: string;
  prize_details: string;
  banner_url: string;
  official_source_url: string;
  official_registration_url: string;
  rules_url: string;
  registration_start: string | null;
  registration_end: string | null;
  competition_start: string | null;
  competition_end: string | null;
  eligibility_summary: string;
  trading_requirements: string;
  rules_summary: string;
  rankings_summary: string;
  participating_accounts: number | null;
  status: CompetitionStatus;
  review_status: CompetitionReviewStatus;
  verification_source: string;
  is_published: boolean;
  is_featured: boolean;
  is_archived: boolean;
  is_potentially_outdated: boolean;
  outdated_reason: string;
  content_hash: string;
  raw_metadata: Record<string, any>;
  last_verified_at: string;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryLogRecord {
  id: string;
  broker_slug: string;
  source_url: string;
  trigger_type: string;
  fetch_status: 'ok' | 'blocked' | 'unavailable' | 'parse_error';
  http_status: number | null;
  discovered_count: number;
  updated_count: number;
  queued_count: number;
  duration_ms: number;
  message: string;
  checked_at: string;
}

export interface CompetitionHistoryRecord {
  id: string;
  competition_id: string;
  change_type: string;
  changed_fields: string[];
  previous_snapshot: Record<string, any>;
  new_snapshot: Record<string, any>;
  detected_at: string;
}

export interface OwnerNotificationRecord {
  id: string;
  category: 'competition_discovered' | 'competition_updated' | 'source_unavailable' | 'giveaway_winner' | 'security';
  title: string;
  message: string;
  link_url: string;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface ParsedCompetitionCandidate {
  broker_slug: string;
  external_key: string;
  title: string;
  subtitle: string;
  prize_pool: string;
  prize_details: string;
  banner_url: string;
  official_source_url: string;
  official_registration_url: string;
  rules_url: string;
  registration_start: string | null;
  registration_end: string | null;
  competition_start: string | null;
  competition_end: string | null;
  eligibility_summary: string;
  trading_requirements: string;
  rules_summary: string;
  rankings_summary: string;
  participating_accounts: number | null;
  status: CompetitionStatus;
  complete: boolean;
  raw_metadata: Record<string, any>;
}

const DEFAULT_SYNC_INTERVAL_MS = Math.max(
  15 * 60 * 1000,
  parseInt(process.env.COMPETITION_SYNC_INTERVAL_MS || '21600000', 10) || 21600000
);

// Non-fabricated server cache (holds live discovered records when Supabase 002 migration has not yet been applied)
const memorySources = new Map<string, BrokerSourceRecord>([
  [
    'tmgm',
    {
      id: 'src-tmgm',
      broker_slug: 'tmgm',
      broker_name: 'TMGM',
      official_website_url: 'https://www.tmgm.com/en',
      competition_source_url: 'https://competition.tmgm.com/en',
      adapter_type: 'tmgm_html',
      accent_theme: 'blue',
      is_active: true,
      last_checked_at: null,
      last_status: 'pending',
      last_http_status: null,
      last_error: null,
    },
  ],
  [
    'hfm',
    {
      id: 'src-hfm',
      broker_slug: 'hfm',
      broker_name: 'HFM',
      official_website_url: 'https://www.hfm.com/int/en',
      competition_source_url: 'https://www.hfm.com/int/en/promotions',
      adapter_type: 'hfm_promotions',
      accent_theme: 'red',
      is_active: true,
      last_checked_at: null,
      last_status: 'pending',
      last_http_status: null,
      last_error: null,
    },
  ],
]);

const memoryCompetitions = new Map<string, BrokerCompetitionRecord>();
const memoryDiscoveryLogs: DiscoveryLogRecord[] = [];
const memoryHistory: CompetitionHistoryRecord[] = [];
const memoryNotifications: OwnerNotificationRecord[] = [];

let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let lastSyncStartedAt = 0;
let lastSyncFinishedAt: string | null = null;
let isSyncRunning = false;
let schemaReadyInSupabase: boolean | null = null;

function stripHtmlToLines(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&ge;/gi, '>=')
    .replace(/&le;/gi, '<=');

  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseDotDateToIso(dateStr: string, endOfDay = false): string | null {
  const m = dateStr.match(/(\d{4})[.\-/](\d{2})[.\-/](\d{2})/);
  if (!m) return null;
  const suffix = endOfDay ? 'T23:59:59.000Z' : 'T00:00:00.000Z';
  const iso = `${m[1]}-${m[2]}-${m[3]}${suffix}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export function computeCompetitionStatus(params: {
  regStart: string | null;
  regEnd: string | null;
  compStart: string | null;
  compEnd: string | null;
  nowMs?: number;
}): CompetitionStatus {
  const now = params.nowMs ?? Date.now();
  const cs = params.compStart ? Date.parse(params.compStart) : NaN;
  const ce = params.compEnd ? Date.parse(params.compEnd) : NaN;
  const rs = params.regStart ? Date.parse(params.regStart) : NaN;
  const re = params.regEnd ? Date.parse(params.regEnd) : NaN;

  if (!Number.isNaN(ce) && now > ce) return 'COMPLETED';
  if (!Number.isNaN(ce) && ce - now <= 72 * 3600 * 1000 && (!Number.isNaN(cs) ? now >= cs : true)) {
    return 'ENDING SOON';
  }
  if (!Number.isNaN(cs) && !Number.isNaN(ce) && now >= cs && now <= ce) {
    return 'LIVE';
  }
  if (!Number.isNaN(rs) && !Number.isNaN(re) && now >= rs && now <= re) {
    return 'REGISTRATION OPEN';
  }
  if ((!Number.isNaN(cs) && now < cs) || (!Number.isNaN(rs) && now < rs)) {
    return 'UPCOMING';
  }
  return 'UNVERIFIED';
}

export function computeContentHash(c: Partial<ParsedCompetitionCandidate>): string {
  const payload = JSON.stringify({
    title: c.title || '',
    prize_pool: c.prize_pool || '',
    prize_details: c.prize_details || '',
    registration_start: c.registration_start || null,
    registration_end: c.registration_end || null,
    competition_start: c.competition_start || null,
    competition_end: c.competition_end || null,
    eligibility_summary: c.eligibility_summary || '',
    trading_requirements: c.trading_requirements || '',
    official_registration_url: c.official_registration_url || '',
    rules_url: c.rules_url || '',
    status: c.status || 'UNVERIFIED',
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Pure parser for the official TMGM trading competition page (https://competition.tmgm.com/en).
 * Extracts only factual content explicitly present on the official page.
 */
export function parseTmgmCompetitionHtml(
  html: string,
  sourceUrl = 'https://competition.tmgm.com/en',
  nowMs = Date.now()
): ParsedCompetitionCandidate[] {
  const lines = stripHtmlToLines(html);
  const fullText = lines.join('\n');

  // Extract official page title
  const metaTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
  const editionMatch = fullText.match(/The\s+\d+(?:st|nd|rd|th)\s+TMGM[\s\n]+Trading Competition/i);
  const title = editionMatch
    ? editionMatch[0].replace(/\s+/g, ' ').trim()
    : metaTitle.split('|')[0]?.trim() || '';

  if (!title) return [];

  // Extract prize pool
  const prizePoolMatch =
    fullText.match(/Total prize pool\s*[\n:]+\s*(\$[\d,]+(?:\.\d+)?)/i) ||
    html.match(/Compete for a\s+(\$[\d,]+)\s+prize pool/i);
  const prizePool = prizePoolMatch?.[1] || '';

  const weeklyBonusMatch = html.match(/(\$[\d,]+\s+weekly bonuses)/i);
  const elitePoolMatch = fullText.match(/Elite Division\s*[\n]+.*?Ares Group\s*[\n]+\s*(\$[\d,]+)/i);
  const stdPoolMatch = fullText.match(/Standard Division\s*[\n]+.*?Masters? Group\s*[\n]+\s*(\$[\d,]+)/i);

  const prizeParts: string[] = [];
  if (prizePool) prizeParts.push(`Total Prize Pool: ${prizePool}`);
  if (weeklyBonusMatch?.[1]) prizeParts.push(weeklyBonusMatch[1]);
  if (elitePoolMatch?.[1]) prizeParts.push(`Elite Division (Ares): ${elitePoolMatch[1]}`);
  if (stdPoolMatch?.[1]) prizeParts.push(`Standard Division (Masters): ${stdPoolMatch[1]}`);
  const prizeDetails = prizeParts.join(' · ');

  // Extract Registration & Competition dates
  const regMatch = fullText.match(/Registration:\s*(\d{4}[.\-/]\d{2}[.\-/]\d{2})\s*[–\-—]\s*(\d{4}[.\-/]\d{2}[.\-/]\d{2})/i);
  const compMatch = fullText.match(/Competition:\s*(\d{4}[.\-/]\d{2}[.\-/]\d{2})\s*[–\-—]\s*(\d{4}[.\-/]\d{2}[.\-/]\d{2})/i);

  const regStart = regMatch ? parseDotDateToIso(regMatch[1], false) : null;
  const regEnd = regMatch ? parseDotDateToIso(regMatch[2], true) : null;
  const compStart = compMatch ? parseDotDateToIso(compMatch[1], false) : null;
  const compEnd = compMatch ? parseDotDateToIso(compMatch[2], true) : null;

  // Participating accounts count
  const partMatch = fullText.match(/Participating accounts:\s*([\d,]+)/i);
  const participatingAccounts = partMatch ? parseInt(partMatch[1].replace(/,/g, ''), 10) : null;

  // Eligibility & Trading requirements from lines
  const depositReqs = lines.filter((l) => /Deposit requirement:/i.test(l)).slice(0, 2);
  const validPeriodReqs = lines.filter((l) => /Valid trading period:/i.test(l)).slice(0, 2);
  const lotReqs = lines.filter((l) => /Lot size requirement:|standard lot/i.test(l)).slice(0, 3);

  const eligibilitySummary = [...new Set(depositReqs)].join(' | ');
  const tradingRequirements = [...new Set([...validPeriodReqs, ...lotReqs])].join(' | ');

  // Official banner image & rules PDF directly referenced on page
  const bannerMatch =
    html.match(/https:\/\/[^"'\s]+banner-13\.webp/i) ||
    html.match(/https:\/\/[^"'\s]+banner-bg\.webp/i);
  const rulesPdfMatch = html.match(/href=["'](https:\/\/[^"']*TMGM[^"']*\.pdf)["']/i);

  const editionNum = title.match(/\d+/)?.[0] || 'current';
  const externalKey = `tmgm-trading-competition-${editionNum}`;

  const status = computeCompetitionStatus({
    regStart,
    regEnd,
    compStart,
    compEnd,
    nowMs,
  });

  const complete = Boolean(title && prizePool && compStart && compEnd && sourceUrl);

  return [
    {
      broker_slug: 'tmgm',
      external_key: externalKey,
      title,
      subtitle: 'Official TMGM Global Trading Competition',
      prize_pool: prizePool,
      prize_details: prizeDetails,
      banner_url: bannerMatch?.[0] || '',
      official_source_url: sourceUrl,
      official_registration_url: sourceUrl,
      rules_url: rulesPdfMatch?.[1] || `${sourceUrl}#rules`,
      registration_start: regStart,
      registration_end: regEnd,
      competition_start: compStart,
      competition_end: compEnd,
      eligibility_summary: eligibilitySummary,
      trading_requirements: tradingRequirements,
      rules_summary: rulesPdfMatch?.[1]
        ? 'Official TMGM Competition Rules PDF verified on competition.tmgm.com.'
        : 'Refer to official TMGM competition rules.',
      rankings_summary:
        participatingAccounts !== null
          ? `${participatingAccounts.toLocaleString()} participating accounts recorded on official leaderboard.`
          : 'Live rankings hosted on official TMGM competition portal.',
      participating_accounts: participatingAccounts,
      status: complete ? status : 'UNVERIFIED',
      complete,
      raw_metadata: {
        parsedFrom: sourceUrl,
        edition: editionNum,
        officialWebsite: 'https://www.tmgm.com/en',
      },
    },
  ];
}

const HFM_COMPETITION_KEYWORDS = [
  'competition',
  'contest',
  'traders awards',
  'trader awards',
  'demo contest',
  'virtual to live',
  'trading championship',
  'tournament',
];

const HFM_EXCLUSION_KEYWORDS = [
  'cashback',
  'rebate',
  'deposit bonus',
  'supercharged bonus',
  'top-up bonus',
  'loyalty',
  'zero spread',
  'shield',
  'rofp',
  'return on free margin',
];

export function isGenuineBrokerCompetitionText(text: string): boolean {
  const lower = text.toLowerCase();
  const hasCompetitionTerm = HFM_COMPETITION_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasCompetitionTerm) return false;
  const isExcludedPromo = HFM_EXCLUSION_KEYWORDS.some((kw) => lower.includes(kw));
  return !isExcludedPromo;
}

/**
 * Pure parser for HFM promotions HTML when accessible.
 * Strictly filters OUT ordinary cashback/deposit promos and accepts only genuine contests / Traders Awards.
 */
export function parseHfmPromotionsHtml(
  html: string,
  sourceUrl = 'https://www.hfm.com/int/en/promotions'
): ParsedCompetitionCandidate[] {
  const candidates: ParsedCompetitionCandidate[] = [];
  const seenKeys = new Set<string>();

  // Detect Cloudflare / bot challenge interstitial
  if (/Just a moment\.\.\./i.test(html) || /cf-browser-verification|challenge-platform/i.test(html)) {
    return [];
  }

  // Extract anchor/card blocks referencing contests or traders awards
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRegex.exec(html)) !== null) {
    const href = m[1];
    const innerText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!innerText || innerText.length < 6) continue;

    const combined = `${href} ${innerText}`;
    if (!isGenuineBrokerCompetitionText(combined)) continue;

    let resolvedUrl = sourceUrl;
    try {
      resolvedUrl = new URL(href, sourceUrl).toString();
    } catch {
      continue;
    }

    const slugPart = resolvedUrl
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()
      .slice(0, 60);
    const externalKey = `hfm-${slugPart}`;
    if (seenKeys.has(externalKey)) continue;
    seenKeys.add(externalKey);

    const prizeMatch = innerText.match(/(\$[\d,]+(?:\s*(?:prize|award|cash))?)/i);
    candidates.push({
      broker_slug: 'hfm',
      external_key: externalKey,
      title: innerText.slice(0, 120),
      subtitle: 'HFM Official Competition / Traders Awards',
      prize_pool: prizeMatch?.[1] || '',
      prize_details: '',
      banner_url: '',
      official_source_url: sourceUrl,
      official_registration_url: resolvedUrl,
      rules_url: resolvedUrl,
      registration_start: null,
      registration_end: null,
      competition_start: null,
      competition_end: null,
      eligibility_summary: 'Refer to official HFM contest terms & eligibility.',
      trading_requirements: '',
      rules_summary: '',
      rankings_summary: '',
      participating_accounts: null,
      // Incomplete unless prize & dates are verified -> routed to owner review queue
      status: 'UNVERIFIED',
      complete: false,
      raw_metadata: {
        parsedFrom: sourceUrl,
        discoveredHref: resolvedUrl,
      },
    });
  }

  return candidates;
}

async function addOwnerNotification(
  client: SupabaseClient | null,
  notif: Omit<OwnerNotificationRecord, 'id' | 'is_read' | 'created_at'>
): Promise<void> {
  // Avoid spamming identical unread notification within 12 hours
  const cutoff = Date.now() - 12 * 3600 * 1000;
  const dupInMemory = memoryNotifications.some(
    (n) => n.category === notif.category && n.title === notif.title && Date.parse(n.created_at) > cutoff
  );
  if (!dupInMemory) {
    memoryNotifications.unshift({
      id: crypto.randomUUID(),
      ...notif,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (memoryNotifications.length > 60) memoryNotifications.length = 60;
  }

  if (client && schemaReadyInSupabase !== false) {
    try {
      const { data: recent } = await client
        .from('owner_notifications')
        .select('id')
        .eq('category', notif.category)
        .eq('title', notif.title)
        .eq('is_read', false)
        .gte('created_at', new Date(cutoff).toISOString())
        .limit(1);

      if (!recent || recent.length === 0) {
        await client.from('owner_notifications').insert([notif]);
      }
    } catch {
      // ignore if schema pending
    }
  }
}

async function upsertDiscoveredCandidate(
  client: SupabaseClient | null,
  source: BrokerSourceRecord,
  candidate: ParsedCompetitionCandidate,
  nowIso: string
): Promise<{ created: boolean; updated: boolean; queued: boolean }> {
  const hash = computeContentHash(candidate);
  const compKey = `${candidate.broker_slug}::${candidate.external_key}`;

  // Determine existing record (Supabase primary, memory mirror fallback)
  let existing: BrokerCompetitionRecord | null = memoryCompetitions.get(compKey) || null;
  if (client && schemaReadyInSupabase !== false) {
    const { data, error } = await client
      .from('broker_competitions')
      .select('*')
      .eq('broker_slug', candidate.broker_slug)
      .eq('external_key', candidate.external_key)
      .maybeSingle();

    if (error && (error.code === 'PGRST205' || error.message?.includes('broker_competitions'))) {
      schemaReadyInSupabase = false;
    } else if (!error) {
      schemaReadyInSupabase = true;
      if (data) existing = data as BrokerCompetitionRecord;
    }
  }

  if (!existing) {
    const reviewStatus: CompetitionReviewStatus = candidate.complete ? 'auto_published' : 'pending_review';
    const isPublished = candidate.complete;
    const record: BrokerCompetitionRecord = {
      id: crypto.randomUUID(),
      broker_id: source.id,
      broker_slug: candidate.broker_slug,
      external_key: candidate.external_key,
      title: candidate.title,
      subtitle: candidate.subtitle,
      prize_pool: candidate.prize_pool,
      prize_details: candidate.prize_details,
      banner_url: candidate.banner_url,
      official_source_url: candidate.official_source_url,
      official_registration_url: candidate.official_registration_url,
      rules_url: candidate.rules_url,
      registration_start: candidate.registration_start,
      registration_end: candidate.registration_end,
      competition_start: candidate.competition_start,
      competition_end: candidate.competition_end,
      eligibility_summary: candidate.eligibility_summary,
      trading_requirements: candidate.trading_requirements,
      rules_summary: candidate.rules_summary,
      rankings_summary: candidate.rankings_summary,
      participating_accounts: candidate.participating_accounts,
      status: candidate.status,
      review_status: reviewStatus,
      verification_source: 'official_discovery',
      is_published: isPublished,
      is_featured: false,
      is_archived: false,
      is_potentially_outdated: false,
      outdated_reason: '',
      content_hash: hash,
      raw_metadata: candidate.raw_metadata,
      last_verified_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (client && schemaReadyInSupabase === true) {
      const { data: inserted, error } = await client
        .from('broker_competitions')
        .insert([
          {
            broker_id: source.id,
            broker_slug: candidate.broker_slug,
            external_key: candidate.external_key,
            title: candidate.title,
            subtitle: candidate.subtitle,
            prize_pool: candidate.prize_pool,
            prize_details: candidate.prize_details,
            banner_url: candidate.banner_url,
            official_source_url: candidate.official_source_url,
            official_registration_url: candidate.official_registration_url,
            rules_url: candidate.rules_url,
            registration_start: candidate.registration_start,
            registration_end: candidate.registration_end,
            competition_start: candidate.competition_start,
            competition_end: candidate.competition_end,
            eligibility_summary: candidate.eligibility_summary,
            trading_requirements: candidate.trading_requirements,
            rules_summary: candidate.rules_summary,
            rankings_summary: candidate.rankings_summary,
            participating_accounts: candidate.participating_accounts,
            status: candidate.status,
            review_status: reviewStatus,
            verification_source: 'official_discovery',
            is_published: isPublished,
            is_featured: false,
            is_archived: false,
            is_potentially_outdated: false,
            outdated_reason: '',
            content_hash: hash,
            raw_metadata: candidate.raw_metadata,
            last_verified_at: nowIso,
          },
        ])
        .select()
        .single();
      if (!error && inserted) {
        memoryCompetitions.set(compKey, inserted as BrokerCompetitionRecord);
      } else {
        memoryCompetitions.set(compKey, record);
      }
    } else {
      memoryCompetitions.set(compKey, record);
    }

    await addOwnerNotification(client, {
      category: 'competition_discovered',
      title: `New ${source.broker_name} competition discovered`,
      message: `${candidate.title}${candidate.prize_pool ? ` (${candidate.prize_pool})` : ''} — ${
        candidate.complete ? 'Verified and auto-published' : 'Queued for owner review'
      }.`,
      link_url: candidate.official_source_url,
      metadata: { broker_slug: candidate.broker_slug, external_key: candidate.external_key },
    });

    return { created: true, updated: false, queued: !candidate.complete };
  }

  // Record already exists — compute changed fields & preserve history instead of duplicating
  const trackedFields = [
    'title',
    'prize_pool',
    'prize_details',
    'registration_start',
    'registration_end',
    'competition_start',
    'competition_end',
    'eligibility_summary',
    'trading_requirements',
    'official_registration_url',
    'rules_url',
    'status',
  ] as const;

  const changedFields: string[] = [];
  const prevSnap: Record<string, any> = {};
  const newSnap: Record<string, any> = {};
  for (const field of trackedFields) {
    const oldVal = (existing as any)[field] ?? null;
    const newVal = (candidate as any)[field] ?? null;
    if (oldVal !== newVal) {
      changedFields.push(field);
      prevSnap[field] = oldVal;
      newSnap[field] = newVal;
    }
  }

  const updateFields: Partial<BrokerCompetitionRecord> = {
    last_verified_at: nowIso,
    is_potentially_outdated: false,
    outdated_reason: '',
    participating_accounts: candidate.participating_accounts ?? existing.participating_accounts,
    rankings_summary: candidate.rankings_summary || existing.rankings_summary,
    updated_at: nowIso,
  };

  let didMeaningfulChange = false;
  if (changedFields.length > 0 || existing.content_hash !== hash) {
    didMeaningfulChange = changedFields.length > 0;
    Object.assign(updateFields, {
      title: candidate.title,
      prize_pool: candidate.prize_pool || existing.prize_pool,
      prize_details: candidate.prize_details || existing.prize_details,
      banner_url: existing.banner_url || candidate.banner_url,
      official_registration_url: candidate.official_registration_url || existing.official_registration_url,
      rules_url: candidate.rules_url || existing.rules_url,
      registration_start: candidate.registration_start ?? existing.registration_start,
      registration_end: candidate.registration_end ?? existing.registration_end,
      competition_start: candidate.competition_start ?? existing.competition_start,
      competition_end: candidate.competition_end ?? existing.competition_end,
      eligibility_summary: candidate.eligibility_summary || existing.eligibility_summary,
      trading_requirements: candidate.trading_requirements || existing.trading_requirements,
      status: candidate.status,
      content_hash: hash,
      raw_metadata: candidate.raw_metadata,
    });
  }

  const merged: BrokerCompetitionRecord = { ...existing, ...updateFields };
  memoryCompetitions.set(compKey, merged);

  if (client && schemaReadyInSupabase === true) {
    try {
      await client
        .from('broker_competitions')
        .update(updateFields)
        .eq('id', existing.id);

      if (didMeaningfulChange) {
        await client.from('competition_update_history').insert([
          {
            competition_id: existing.id,
            change_type: changedFields.includes('status') ? 'status_change' : 'fields_updated',
            changed_fields: changedFields,
            previous_snapshot: prevSnap,
            new_snapshot: newSnap,
          },
        ]);
      }
    } catch {
      // ignore optional errors
    }
  }

  if (didMeaningfulChange) {
    memoryHistory.unshift({
      id: crypto.randomUUID(),
      competition_id: existing.id,
      change_type: changedFields.includes('status') ? 'status_change' : 'fields_updated',
      changed_fields: changedFields,
      previous_snapshot: prevSnap,
      new_snapshot: newSnap,
      detected_at: nowIso,
    });
    if (memoryHistory.length > 80) memoryHistory.length = 80;

    await addOwnerNotification(client, {
      category: 'competition_updated',
      title: `${source.broker_name} competition updated`,
      message: `${candidate.title}: updated ${changedFields.join(', ')}.`,
      link_url: candidate.official_source_url,
      metadata: { competition_id: existing.id, changed_fields: changedFields },
    });
  }

  return { created: false, updated: didMeaningfulChange, queued: false };
}

async function markBrokerRecordsPotentiallyOutdated(
  client: SupabaseClient | null,
  brokerSlug: string,
  reason: string
): Promise<void> {
  for (const [k, rec] of memoryCompetitions.entries()) {
    if (rec.broker_slug === brokerSlug && !rec.is_archived) {
      memoryCompetitions.set(k, {
        ...rec,
        is_potentially_outdated: true,
        outdated_reason: reason,
      });
    }
  }
  if (client && schemaReadyInSupabase === true) {
    try {
      await client
        .from('broker_competitions')
        .update({
          is_potentially_outdated: true,
          outdated_reason: reason,
        })
        .eq('broker_slug', brokerSlug)
        .eq('is_archived', false);
    } catch {
      // ignore
    }
  }
}

async function logDiscoveryAttempt(
  client: SupabaseClient | null,
  log: Omit<DiscoveryLogRecord, 'id' | 'checked_at'>
): Promise<void> {
  const nowIso = new Date().toISOString();
  const entry: DiscoveryLogRecord = {
    id: crypto.randomUUID(),
    ...log,
    checked_at: nowIso,
  };
  memoryDiscoveryLogs.unshift(entry);
  if (memoryDiscoveryLogs.length > 80) memoryDiscoveryLogs.length = 80;

  if (client && schemaReadyInSupabase === true) {
    try {
      await client.from('competition_discovery_logs').insert([log]);
    } catch {
      // ignore
    }
  }
}

export async function runDiscoverySync(params?: {
  trigger?: 'scheduled' | 'manual' | 'startup';
  db?: SupabaseClient | null;
  force?: boolean;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  results: Array<{
    broker_slug: string;
    fetch_status: string;
    http_status: number | null;
    discovered_count: number;
    updated_count: number;
    queued_count: number;
    message: string;
  }>;
}> {
  const trigger = params?.trigger || 'scheduled';
  const now = Date.now();
  if (isSyncRunning) {
    return { ok: true, skipped: true, results: [] };
  }
  if (!params?.force && trigger !== 'manual' && now - lastSyncStartedAt < 10 * 60 * 1000) {
    return { ok: true, skipped: true, results: [] };
  }

  isSyncRunning = true;
  lastSyncStartedAt = now;
  const client = params?.db || getAdminClient();
  const results: Array<{
    broker_slug: string;
    fetch_status: string;
    http_status: number | null;
    discovered_count: number;
    updated_count: number;
    queued_count: number;
    message: string;
  }> = [];

  try {
    // Load active broker sources from Supabase if ready, else memorySources
    let sources = Array.from(memorySources.values()).filter((s) => s.is_active);
    if (client && schemaReadyInSupabase !== false) {
      const { data, error } = await client
        .from('broker_sources')
        .select('*')
        .eq('is_active', true);
      if (error && (error.code === 'PGRST205' || error.message?.includes('broker_sources'))) {
        schemaReadyInSupabase = false;
      } else if (!error && Array.isArray(data) && data.length > 0) {
        schemaReadyInSupabase = true;
        sources = data as BrokerSourceRecord[];
        sources.forEach((s) => memorySources.set(s.broker_slug, s));
      }
    }

    for (const src of sources) {
      if (src.adapter_type === 'manual') continue;

      const t0 = Date.now();
      const nowIso = new Date().toISOString();
      let httpStatus: number | null = null;
      let fetchStatus: DiscoveryLogRecord['fetch_status'] = 'ok';
      let discoveredCount = 0;
      let updatedCount = 0;
      let queuedCount = 0;
      let message = '';

      try {
        const res = await fetch(src.competition_source_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; YOUNEEL-TRADING-Monitor/1.0)',
            Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(12000),
        });
        httpStatus = res.status;
        const html = await res.text();

        const isBotBlocked =
          res.status === 403 ||
          res.status === 429 ||
          /Just a moment\.\.\./i.test(html) ||
          /cf-browser-verification|challenge-platform/i.test(html);

        if (isBotBlocked) {
          fetchStatus = 'blocked';
          message = `Official source returned HTTP ${res.status} (automated access protection). Existing verified records preserved.`;
          await markBrokerRecordsPotentiallyOutdated(client, src.broker_slug, message);
          await addOwnerNotification(client, {
            category: 'source_unavailable',
            title: `${src.broker_name} official source blocked automated scan`,
            message: `${src.competition_source_url} returned HTTP ${res.status}. Review or verify HFM competitions manually in Owner Mode without inventing details.`,
            link_url: src.competition_source_url,
            metadata: { broker_slug: src.broker_slug, http_status: res.status },
          });
        } else if (!res.ok) {
          fetchStatus = 'unavailable';
          message = `Official source returned HTTP ${res.status}.`;
          await markBrokerRecordsPotentiallyOutdated(client, src.broker_slug, message);
        } else {
          const parsed =
            src.adapter_type === 'tmgm_html'
              ? parseTmgmCompetitionHtml(html, src.competition_source_url)
              : parseHfmPromotionsHtml(html, src.competition_source_url);

          if (parsed.length === 0) {
            fetchStatus = 'parse_error';
            message = `No competition entries verified on ${src.competition_source_url}.`;
          } else {
            for (const candidate of parsed) {
              const resUpsert = await upsertDiscoveredCandidate(client, src, candidate, nowIso);
              if (resUpsert.created) discoveredCount += 1;
              if (resUpsert.updated) updatedCount += 1;
              if (resUpsert.queued) queuedCount += 1;
            }
            message = `Verified ${parsed.length} official competition(s) (${discoveredCount} new, ${updatedCount} updated, ${queuedCount} queued).`;
          }
        }
      } catch (err: any) {
        fetchStatus = 'unavailable';
        message = err?.message || 'Upstream request failed';
        await markBrokerRecordsPotentiallyOutdated(client, src.broker_slug, message);
      }

      const durationMs = Date.now() - t0;
      const updatedSource: BrokerSourceRecord = {
        ...src,
        last_checked_at: nowIso,
        last_status: fetchStatus,
        last_http_status: httpStatus,
        last_error: fetchStatus === 'ok' ? null : message,
      };
      memorySources.set(src.broker_slug, updatedSource);

      if (client && schemaReadyInSupabase === true) {
        try {
          await client
            .from('broker_sources')
            .update({
              last_checked_at: nowIso,
              last_status: fetchStatus,
              last_http_status: httpStatus,
              last_error: fetchStatus === 'ok' ? null : message,
              updated_at: nowIso,
            })
            .eq('broker_slug', src.broker_slug);
        } catch {
          // ignore
        }
      }

      await logDiscoveryAttempt(client, {
        broker_slug: src.broker_slug,
        source_url: src.competition_source_url,
        trigger_type: trigger,
        fetch_status: fetchStatus,
        http_status: httpStatus,
        discovered_count: discoveredCount,
        updated_count: updatedCount,
        queued_count: queuedCount,
        duration_ms: durationMs,
        message,
      });

      results.push({
        broker_slug: src.broker_slug,
        fetch_status: fetchStatus,
        http_status: httpStatus,
        discovered_count: discoveredCount,
        updated_count: updatedCount,
        queued_count: queuedCount,
        message,
      });
    }

    lastSyncFinishedAt = new Date().toISOString();
    return { ok: true, results };
  } finally {
    isSyncRunning = false;
  }
}

export function startCompetitionDiscoveryScheduler(): void {
  if (schedulerHandle) return;

  // Initial background verification shortly after boot (non-blocking)
  setTimeout(() => {
    void runDiscoverySync({ trigger: 'startup' }).catch((err) => {
      console.warn('[CompetitionScheduler] Startup sync error:', err?.message);
    });
  }, 4000);

  schedulerHandle = setInterval(() => {
    void runDiscoverySync({ trigger: 'scheduled' }).catch((err) => {
      console.warn('[CompetitionScheduler] Scheduled sync error:', err?.message);
    });
  }, DEFAULT_SYNC_INTERVAL_MS);
}

export function getCompetitionSchedulerStatus() {
  return {
    running: Boolean(schedulerHandle),
    intervalMs: DEFAULT_SYNC_INTERVAL_MS,
    lastSyncFinishedAt,
    isSyncRunning,
    supabaseSchemaReady: schemaReadyInSupabase !== false,
  };
}

export async function getPublicBrokerCompetitions(db?: SupabaseClient | null): Promise<{
  competitions: BrokerCompetitionRecord[];
  sources: BrokerSourceRecord[];
  schemaMissing: boolean;
}> {
  const client = db || getAdminClient();
  if (client && schemaReadyInSupabase !== false) {
    try {
      const [{ data: comps, error: cErr }, { data: srcs, error: sErr }] = await Promise.all([
        client
          .from('broker_competitions')
          .select('*')
          .eq('is_published', true)
          .eq('is_archived', false)
          .order('is_featured', { ascending: false })
          .order('last_verified_at', { ascending: false }),
        client
          .from('broker_sources')
          .select('*')
          .eq('is_active', true)
          .order('broker_name', { ascending: true }),
      ]);

      if (cErr && (cErr.code === 'PGRST205' || cErr.message?.includes('broker_competitions'))) {
        schemaReadyInSupabase = false;
      } else if (!cErr && !sErr && Array.isArray(comps)) {
        schemaReadyInSupabase = true;
        return {
          competitions: comps as BrokerCompetitionRecord[],
          sources: (srcs || []) as BrokerSourceRecord[],
          schemaMissing: false,
        };
      }
    } catch {
      // fall through to live memory cache
    }
  }

  const memComps = Array.from(memoryCompetitions.values())
    .filter((c) => c.is_published && !c.is_archived)
    .sort((a, b) => Number(b.is_featured) - Number(a.is_featured));

  return {
    competitions: memComps,
    sources: Array.from(memorySources.values()).filter((s) => s.is_active),
    schemaMissing: schemaReadyInSupabase === false,
  };
}

export async function getOwnerCompetitionsWorkspace(db: SupabaseClient) {
  let competitions = Array.from(memoryCompetitions.values());
  let sources = Array.from(memorySources.values());
  let logs = [...memoryDiscoveryLogs];
  let history = [...memoryHistory];
  let notifications = [...memoryNotifications];
  let schemaMissing = schemaReadyInSupabase === false;

  const { data: dbComps, error: cErr } = await db
    .from('broker_competitions')
    .select('*')
    .order('updated_at', { ascending: false });

  if (cErr && (cErr.code === 'PGRST205' || cErr.message?.includes('broker_competitions'))) {
    schemaMissing = true;
    schemaReadyInSupabase = false;
  } else if (!cErr && Array.isArray(dbComps)) {
    schemaMissing = false;
    schemaReadyInSupabase = true;
    competitions = dbComps as BrokerCompetitionRecord[];

    const [{ data: dbSources }, { data: dbLogs }, { data: dbHistory }, { data: dbNotifs }] =
      await Promise.all([
        db.from('broker_sources').select('*').order('broker_name', { ascending: true }),
        db
          .from('competition_discovery_logs')
          .select('*')
          .order('checked_at', { ascending: false })
          .limit(30),
        db
          .from('competition_update_history')
          .select('*')
          .order('detected_at', { ascending: false })
          .limit(30),
        db
          .from('owner_notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

    if (Array.isArray(dbSources)) sources = dbSources as BrokerSourceRecord[];
    if (Array.isArray(dbLogs)) logs = dbLogs as DiscoveryLogRecord[];
    if (Array.isArray(dbHistory)) history = dbHistory as CompetitionHistoryRecord[];
    if (Array.isArray(dbNotifs)) notifications = dbNotifs as OwnerNotificationRecord[];
  }

  return {
    competitions,
    sources,
    logs,
    history,
    notifications,
    scheduler: getCompetitionSchedulerStatus(),
    schemaMissing,
  };
}

export async function upsertCompetitionDirect(
  db: SupabaseClient,
  payload: Record<string, any>,
  id?: string
): Promise<{ competition: BrokerCompetitionRecord; schemaMissing?: boolean }> {
  const nowIso = new Date().toISOString();
  const brokerSlug = String(payload.broker_slug || 'tmgm').toLowerCase().trim();
  let source = memorySources.get(brokerSlug);

  if (schemaReadyInSupabase !== false) {
    const { data: srcRow } = await db
      .from('broker_sources')
      .select('*')
      .eq('broker_slug', brokerSlug)
      .maybeSingle();
    if (srcRow) source = srcRow as BrokerSourceRecord;
  }

  const externalKey =
    String(payload.external_key || '').trim() ||
    `${brokerSlug}-${String(payload.title || 'comp')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 48)}-${Date.now().toString(36)}`;

  const cleanRow = {
    broker_id: source?.id || 'src-manual',
    broker_slug: brokerSlug,
    external_key: externalKey,
    title: String(payload.title || '').trim(),
    subtitle: String(payload.subtitle || '').trim(),
    prize_pool: String(payload.prize_pool || '').trim(),
    prize_details: String(payload.prize_details || '').trim(),
    banner_url: String(payload.banner_url || '').trim(),
    official_source_url: String(payload.official_source_url || source?.competition_source_url || '').trim(),
    official_registration_url: String(payload.official_registration_url || payload.official_source_url || '').trim(),
    rules_url: String(payload.rules_url || '').trim(),
    registration_start: payload.registration_start || null,
    registration_end: payload.registration_end || null,
    competition_start: payload.competition_start || null,
    competition_end: payload.competition_end || null,
    eligibility_summary: String(payload.eligibility_summary || '').trim(),
    trading_requirements: String(payload.trading_requirements || '').trim(),
    rules_summary: String(payload.rules_summary || '').trim(),
    rankings_summary: String(payload.rankings_summary || '').trim(),
    participating_accounts:
      payload.participating_accounts !== undefined && payload.participating_accounts !== null && payload.participating_accounts !== ''
        ? Number(payload.participating_accounts)
        : null,
    status: (['UPCOMING', 'REGISTRATION OPEN', 'LIVE', 'ENDING SOON', 'COMPLETED', 'EXPIRED', 'UNVERIFIED'].includes(
      payload.status
    )
      ? payload.status
      : 'UNVERIFIED') as CompetitionStatus,
    review_status: (['pending_review', 'approved', 'auto_published', 'rejected', 'archived'].includes(
      payload.review_status
    )
      ? payload.review_status
      : 'approved') as CompetitionReviewStatus,
    verification_source: id ? String(payload.verification_source || 'owner_edited') : 'owner_manual',
    is_published: Boolean(payload.is_published),
    is_featured: Boolean(payload.is_featured),
    is_archived: Boolean(payload.is_archived),
    is_potentially_outdated: Boolean(payload.is_potentially_outdated),
    outdated_reason: String(payload.outdated_reason || ''),
    last_verified_at: nowIso,
    updated_at: nowIso,
  };

  if (schemaReadyInSupabase !== false) {
    if (id) {
      const { data, error } = await db
        .from('broker_competitions')
        .update(cleanRow)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) {
        const comp = data as BrokerCompetitionRecord;
        memoryCompetitions.set(`${comp.broker_slug}::${comp.external_key}`, comp);
        return { competition: comp };
      }
      if (error && (error.code === 'PGRST205' || error.message?.includes('broker_competitions'))) {
        schemaReadyInSupabase = false;
      } else if (error) {
        throw new Error(error.message);
      }
    } else {
      const { data, error } = await db
        .from('broker_competitions')
        .insert([cleanRow])
        .select()
        .single();
      if (!error && data) {
        const comp = data as BrokerCompetitionRecord;
        memoryCompetitions.set(`${comp.broker_slug}::${comp.external_key}`, comp);
        return { competition: comp };
      }
      if (error && (error.code === 'PGRST205' || error.message?.includes('broker_competitions'))) {
        schemaReadyInSupabase = false;
      } else if (error) {
        throw new Error(error.message);
      }
    }
  }

  // Fallback memory update if 002 SQL migration hasn't run yet
  const compKey = `${cleanRow.broker_slug}::${cleanRow.external_key}`;
  const existing = id
    ? Array.from(memoryCompetitions.values()).find((c) => c.id === id)
    : memoryCompetitions.get(compKey);

  const memComp: BrokerCompetitionRecord = {
    ...(existing || {
      id: id || crypto.randomUUID(),
      content_hash: computeContentHash(cleanRow),
      raw_metadata: {},
      created_at: nowIso,
    }),
    ...cleanRow,
  };
  memoryCompetitions.set(`${memComp.broker_slug}::${memComp.external_key}`, memComp);
  return { competition: memComp, schemaMissing: true };
}

export async function addBrokerSourceRecord(
  db: SupabaseClient,
  payload: {
    broker_slug: string;
    broker_name: string;
    official_website_url: string;
    competition_source_url: string;
    accent_theme?: string;
  }
): Promise<BrokerSourceRecord> {
  const cleanSlug = payload.broker_slug.toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  const row = {
    broker_slug: cleanSlug,
    broker_name: payload.broker_name.trim(),
    official_website_url: payload.official_website_url.trim(),
    competition_source_url: payload.competition_source_url.trim(),
    adapter_type: 'manual',
    accent_theme: payload.accent_theme || 'slate',
    is_active: true,
  };

  if (schemaReadyInSupabase !== false) {
    const { data, error } = await db.from('broker_sources').insert([row]).select().single();
    if (!error && data) {
      const src = data as BrokerSourceRecord;
      memorySources.set(src.broker_slug, src);
      return src;
    }
  }

  const memSrc: BrokerSourceRecord = {
    id: `src-${cleanSlug}`,
    ...row,
    last_checked_at: null,
    last_status: 'manual',
    last_http_status: null,
    last_error: null,
  };
  memorySources.set(cleanSlug, memSrc);
  return memSrc;
}

export async function deleteCompetitionRecord(db: SupabaseClient, id: string): Promise<void> {
  for (const [k, rec] of memoryCompetitions.entries()) {
    if (rec.id === id) {
      memoryCompetitions.delete(k);
    }
  }
  if (schemaReadyInSupabase !== false) {
    try {
      await db.from('broker_competitions').delete().eq('id', id);
    } catch {
      // ignore if schema pending
    }
  }
}

export async function markAllNotificationsRead(db: SupabaseClient): Promise<void> {
  for (const n of memoryNotifications) {
    n.is_read = true;
  }
  if (schemaReadyInSupabase !== false) {
    try {
      await db.from('owner_notifications').update({ is_read: true }).eq('is_read', false);
    } catch {
      // ignore if schema pending
    }
  }
}

