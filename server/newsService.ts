import crypto from 'crypto';
import { SupportedSymbol } from '../src/lib/tradingMath.js';

export type MarketNewsCategory =
  | 'GOLD'
  | 'US_INDICES'
  | 'FOREX'
  | 'CRYPTO'
  | 'OIL_COMMODITIES'
  | 'US_MACRO';

export type NewsImpactLevel = 'High' | 'Medium' | 'Low';

export interface RealNewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
  marketCategory: MarketNewsCategory;
  marketCategories: MarketNewsCategory[];
  relatedInstruments: SupportedSymbol[];
  impactLevel: NewsImpactLevel;
  macroEventLink?: 'CPI' | 'FOMC' | 'PPI' | 'NFP';
  freshness: 'live' | 'recent' | 'archive';
  ageHours: number;
}

export type HistoricalArchiveItem = RealNewsItem;

const LIVE_WIRE_MAX_AGE_MS = 72 * 60 * 60 * 1000;
const ARCHIVE_MAX_AGE_DAYS = 365;

function computeFreshnessAndAge(publishedIso: string): { freshness: 'live' | 'recent' | 'archive'; ageHours: number } {
  const ts = new Date(publishedIso).getTime();
  if (!Number.isFinite(ts)) return { freshness: 'archive', ageHours: 999 };
  const ageMs = Math.max(0, Date.now() - ts);
  const ageHours = Math.round((ageMs / 3_600_000) * 10) / 10;
  if (ageHours <= 12) return { freshness: 'live', ageHours };
  if (ageHours <= 72) return { freshness: 'recent', ageHours };
  return { freshness: 'archive', ageHours };
}

interface ClassificationResult {
  relevant: boolean;
  marketCategory: MarketNewsCategory;
  marketCategories: MarketNewsCategory[];
  displayCategory: string;
  relatedInstruments: SupportedSymbol[];
  impactLevel: NewsImpactLevel;
  macroEventLink?: 'CPI' | 'FOMC' | 'PPI' | 'NFP';
}

function classifyArticle(
  title: string,
  summary: string,
  feedHint: { marketHint?: MarketNewsCategory; labelHint: string }
): ClassificationResult {
  const titleLower = title.toLowerCase();
  const text = `${title} ${summary}`.toLowerCase();

  const isCpi = /\b(u\.s\. cpi|cpi\b|consumer price index|core cpi|pce price)\b/.test(text);
  const isFomc = /\b(fomc|federal reserve|fed rate|fed decision|fed survey|fed officials|jerome powell|chair powell|monetary policy|fed funds)\b/.test(text);
  const isPpi = /\b(u\.s\. ppi|ppi\b|producer price|wholesale prices)\b/.test(text);
  const isNfp = /\b(nfp\b|nonfarm|non-farm|payrolls|unemployment rate|jobless claims|employment situation|jobs report)\b/.test(text);
  const isUsYieldsOrMacro = /\b(treasury yield|treasury yields|10-year yield|2-year yield|real yield|u\.s\. gdp|u\.s\. retail sales|ism manufacturing|ism services|u\.s\. inflation|bls|bureau of labor)\b/.test(text);

  const isGoldOrMetals = /\b(gold|xau|xauusd|bullion|precious metal|silver|xagusd|gold price|gold futures|spot gold|barrick|newmont|gold miner|gld|comex gold|hard assets)\b/.test(text);
  const isNasdaqTech = /\b(nasdaq|us100|ndx|nvidia|nvda|apple|aapl|microsoft|msft|alphabet|googl|amazon|amzn|meta|tesla|tsla|broadcom|amd|semiconductor|chipmaker|ai trade|ai stock|big tech|tech stock)\b/.test(text);
  const isDowOrSp500 = /\b(dow jones|us30|djia|s&p 500|spx|wall street|u\.s\. stocks|us equities|stock futures|equity market|stocks fall|stocks rally|stocks slide)\b/.test(text);
  const isEuro = /\b(euro\b|eur\/usd|eurusd|eurozone|ecb|european central bank|lagarde|knot)\b/.test(text);
  const isPound = /\b(pound|sterling|gbp\/usd|gbpusd|bank of england|boe|uk inflation|uk economy|britain)\b/.test(text);
  const isYen = /\b(yen\b|usd\/jpy|usdjpy|bank of japan|boj|tokyo inflation|japan rate|ueda)\b/.test(text);
  const isUsdDollar = /\b(u\.s\. dollar|us dollar|dollar index|dxy|greenback|fx market|currency market|currencies)\b/.test(text);
  const isOilEnergy = /\b(crude oil|oil price|oil prices|wti|brent|usoil|opec|opec\+|hormuz|oil tanker|tankers|heating oil|diesel|gasoline|natural gas|energy supply|energy market|refinery|barrels per day|oil output)\b/.test(text);
  const isCommodities = /\b(commodity|commodities|copper|metals market|metals\b)\b/.test(text);
  const isCryptoTitle = /\b(bitcoin|btc|btcusd|ethereum|eth\b|crypto|cryptocurrency|digital asset|bitcoin etf|solana|xrp|stablecoin|binance|coinbase|crypto)\b/.test(titleLower);
  const isCrypto = isCryptoTitle || /\b(bitcoin|btcusd|cryptocurrency|bitcoin etf|spot crypto|digital asset|xrp|solana)\b/.test(text);

  const marketSet = new Set<MarketNewsCategory>();
  const assetSet = new Set<SupportedSymbol>();

  if (isGoldOrMetals) {
    marketSet.add('GOLD');
    assetSet.add('XAUUSD');
  }
  if (isNasdaqTech || isDowOrSp500) {
    marketSet.add('US_INDICES');
    if (isNasdaqTech) assetSet.add('NASDAQ');
    if (isDowOrSp500) assetSet.add('US30');
    if (marketSet.has('US_INDICES') && !assetSet.has('NASDAQ') && !assetSet.has('US30')) {
      assetSet.add('NASDAQ');
    }
  }
  if (isEuro || isPound || isYen || isUsdDollar) {
    marketSet.add('FOREX');
    if (isEuro) assetSet.add('EURUSD');
    if (isPound) assetSet.add('GBPUSD');
    if (isYen) assetSet.add('USDJPY');
    if (isUsdDollar && !isEuro && !isPound && !isYen) {
      assetSet.add('EURUSD');
      assetSet.add('USDJPY');
    }
  }
  if (isOilEnergy || isCommodities) {
    marketSet.add('OIL_COMMODITIES');
    if (isOilEnergy) assetSet.add('USOIL');
  }
  if (isCrypto) {
    marketSet.add('CRYPTO');
    assetSet.add('BTCUSD');
  }

  const isMacroCore = isCpi || isFomc || isPpi || isNfp || isUsYieldsOrMacro;
  if (isMacroCore && !isCryptoTitle) {
    marketSet.add('US_MACRO');
    if (isFomc || isCpi || isPpi || isNfp || isUsYieldsOrMacro) {
      assetSet.add('XAUUSD');
      assetSet.add('NASDAQ');
      assetSet.add('EURUSD');
      assetSet.add('USDJPY');
    }
    if (/\b(treasury|yield|fed|fomc|cpi|nfp|ppi|wholesale prices)\b/.test(titleLower)) {
      if (isUsdDollar || /\b(fed|fomc|cpi|nfp)\b/.test(titleLower)) marketSet.add('FOREX');
      if (/\b(treasury|yield|cpi|fomc|nfp)\b/.test(titleLower)) marketSet.add('GOLD');
    }
  }

  // Feed-level safe fallback ONLY if no direct keyword matched yet, and ONLY if headline clearly touches finance/markets
  if (marketSet.size === 0 && feedHint.marketHint) {
    const looksFinancial = /\b(market|markets|price|prices|stock|stocks|shares|bond|yield|rate|bank|economy|economic|trade|tariff|export|import|earnings|forecast|investor|inflation|recession|output|supply|demand|gdp|futures|commodity|oil|gold|silver|copper|currency|dollar|euro|yen|pound|bitcoin|crypto)\b/.test(text);
    if (looksFinancial) {
      marketSet.add(feedHint.marketHint);
      if (feedHint.marketHint === 'GOLD') assetSet.add('XAUUSD');
      else if (feedHint.marketHint === 'US_INDICES') assetSet.add('NASDAQ');
      else if (feedHint.marketHint === 'FOREX') assetSet.add('EURUSD');
      else if (feedHint.marketHint === 'OIL_COMMODITIES') assetSet.add('USOIL');
      else if (feedHint.marketHint === 'CRYPTO') assetSet.add('BTCUSD');
      else if (feedHint.marketHint === 'US_MACRO') {
        assetSet.add('XAUUSD');
        assetSet.add('NASDAQ');
        assetSet.add('EURUSD');
      }
    }
  }

  if (marketSet.size === 0 || assetSet.size === 0) {
    return {
      relevant: false,
      marketCategory: feedHint.marketHint || 'US_MACRO',
      marketCategories: [],
      displayCategory: feedHint.labelHint,
      relatedInstruments: [],
      impactLevel: 'Low',
    };
  }

  // Determine primary category with preference matching actual core topic
  let primary: MarketNewsCategory = feedHint.marketHint || Array.from(marketSet)[0];
  if (isCryptoTitle) primary = 'CRYPTO';
  else if (isOilEnergy && !isMacroCore && !isGoldOrMetals) primary = 'OIL_COMMODITIES';
  else if (isGoldOrMetals && !isCrypto) primary = 'GOLD';
  else if ((isEuro || isPound || isYen || isUsdDollar) && !isCrypto && !isOilEnergy && !isMacroCore) primary = 'FOREX';
  else if ((isNasdaqTech || isDowOrSp500) && !isCrypto && !isOilEnergy && !isGoldOrMetals && !isMacroCore) primary = 'US_INDICES';
  else if (isMacroCore) primary = 'US_MACRO';
  else if (!marketSet.has(primary)) primary = Array.from(marketSet)[0];

  let displayCategory = feedHint.labelHint;
  if (isCpi) displayCategory = 'CPI / Inflation';
  else if (isFomc) displayCategory = 'FOMC / Central Bank';
  else if (isPpi) displayCategory = 'PPI / Producer Prices';
  else if (isNfp) displayCategory = 'NFP / Labor';
  else if (primary === 'GOLD') displayCategory = 'Gold & Precious Metals';
  else if (primary === 'US_INDICES') displayCategory = 'NASDAQ / US Indices';
  else if (primary === 'FOREX') displayCategory = 'Forex & Central Banks';
  else if (primary === 'OIL_COMMODITIES') displayCategory = 'Oil & Commodities';
  else if (primary === 'US_MACRO') displayCategory = 'US Economy / Macro';
  else if (primary === 'CRYPTO') displayCategory = 'Crypto / Digital Assets';

  let macroEventLink: 'CPI' | 'FOMC' | 'PPI' | 'NFP' | undefined;
  if (isCpi) macroEventLink = 'CPI';
  else if (isFomc) macroEventLink = 'FOMC';
  else if (isPpi) macroEventLink = 'PPI';
  else if (isNfp) macroEventLink = 'NFP';

  let impactLevel: NewsImpactLevel = 'Medium';
  if (
    isCpi ||
    isFomc ||
    isPpi ||
    isNfp ||
    /\b(opec|hormuz|tariff|crash|surge|plunge|record high|earnings|downgrade|ecb|bank of japan|bank of england|etf)\b/.test(text)
  ) {
    impactLevel = 'High';
  } else if (/\b(takeaways|prediction|outlook|forecast|survey|stocks with p)\b/.test(text)) {
    impactLevel = 'Low';
  }

  return {
    relevant: true,
    marketCategory: primary,
    marketCategories: Array.from(marketSet),
    displayCategory,
    relatedInstruments: Array.from(assetSet).slice(0, 5),
    impactLevel,
    macroEventLink,
  };
}

function cleanReadableSummary(raw: string, title: string): string {
  const decoded = decodeHtmlEntities(raw);
  if (!decoded) return '';
  if (decoded.toLowerCase() === title.trim().toLowerCase()) return '';
  if (decoded.length <= 220) return decoded;
  const sliced = decoded.slice(0, 217);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${(lastSpace > 120 ? sliced.slice(0, lastSpace) : sliced).trim()}...`;
}

let newsCache: {
  items: RealNewsItem[];
  fetchedAt: number;
  sourcesActive: string[];
  categoryCounts: Record<'ALL' | MarketNewsCategory, number>;
} | null = null;
let archiveCache: {
  items: HistoricalArchiveItem[];
  fetchedAt: number;
  sourcesActive: string[];
} | null = null;

const NEWS_TTL_MS = 5 * 60 * 1000;
const ARCHIVE_TTL_MS = 15 * 60 * 1000;

function buildStableArticleId(prefix: string, canonicalParts: string[]): string {
  const normalized = canonicalParts.map((p) => p.trim().toLowerCase()).join('|');
  const digest = crypto.createHash('sha256').update(normalized).digest('base64url').slice(0, 20);
  return `${prefix}-${digest}`;
}

function normalizeUrlForDedupe(url: string): string {
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function deduplicateItems<T extends { id: string; url: string; title: string }>(items: T[]): T[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return items.filter((item) => {
    const normTitle = item.title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*(reuters|cnbc|yahoo finance|investing\.com|oilprice\.com)$/i, '');
    const normUrl = normalizeUrlForDedupe(item.url);

    if (seenIds.has(item.id)) return false;
    if (normUrl && seenUrls.has(normUrl)) return false;
    if (normTitle && seenTitles.has(normTitle)) return false;

    seenIds.add(item.id);
    if (normUrl) seenUrls.add(normUrl);
    if (normTitle) seenTitles.add(normTitle);
    return true;
  });
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(regex);
  return m ? decodeHtmlEntities(m[1]) : '';
}

function parseRssItems(
  xml: string,
  defaultSource: string,
  feedHint: { marketHint?: MarketNewsCategory; labelHint: string },
  prefix: string,
  requireStrongMatch = false
): RealNewsItem[] {
  const items: RealNewsItem[] = [];
  const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];

  for (let i = 0; i < itemMatches.length; i++) {
    const block = itemMatches[i];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const guid = extractTag(block, 'guid');
    const pubDateRaw = extractTag(block, 'pubDate') || extractTag(block, 'dc:date');
    const description = extractTag(block, 'description');

    if (!title || !pubDateRaw || !link) continue;
    const parsedDate = new Date(pubDateRaw);
    if (isNaN(parsedDate.getTime())) continue;

    const publishedIso = parsedDate.toISOString();
    const cleanSummary = cleanReadableSummary(description, title);
    const classified = classifyArticle(
      title,
      cleanSummary,
      requireStrongMatch ? { labelHint: feedHint.labelHint } : feedHint
    );
    if (!classified.relevant) continue;

    const id = buildStableArticleId(prefix, [guid || link, title, publishedIso]);
    const { freshness, ageHours } = computeFreshnessAndAge(publishedIso);

    items.push({
      id,
      title,
      summary: cleanSummary,
      source: defaultSource,
      url: link,
      publishedAt: publishedIso,
      category: classified.displayCategory,
      marketCategory: classified.marketCategory,
      marketCategories: classified.marketCategories,
      relatedInstruments: classified.relatedInstruments,
      impactLevel: classified.impactLevel,
      macroEventLink: classified.macroEventLink,
      freshness,
      ageHours,
    });
  }

  return items;
}

function computeCategoryCounts(items: RealNewsItem[]): Record<'ALL' | MarketNewsCategory, number> {
  const counts: Record<'ALL' | MarketNewsCategory, number> = {
    ALL: items.length,
    GOLD: 0,
    US_INDICES: 0,
    FOREX: 0,
    CRYPTO: 0,
    OIL_COMMODITIES: 0,
    US_MACRO: 0,
  };
  for (const item of items) {
    const cats = new Set<MarketNewsCategory>([item.marketCategory, ...(item.marketCategories || [])]);
    for (const c of cats) {
      counts[c] = (counts[c] || 0) + 1;
    }
  }
  return counts;
}

function buildBalancedMultiMarketWire(candidates: RealNewsItem[]): RealNewsItem[] {
  const byCategory: Record<MarketNewsCategory, RealNewsItem[]> = {
    GOLD: [],
    US_INDICES: [],
    FOREX: [],
    OIL_COMMODITIES: [],
    US_MACRO: [],
    CRYPTO: [],
  };

  const sorted = deduplicateItems(candidates).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  for (const item of sorted) {
    byCategory[item.marketCategory].push(item);
  }

  // Guarantee balanced representation across ALL markets instead of letting high-volume crypto wires crowd out Gold/Indices/Forex/Oil
  const quotas: Record<MarketNewsCategory, number> = {
    GOLD: 7,
    US_INDICES: 8,
    FOREX: 7,
    OIL_COMMODITIES: 7,
    US_MACRO: 7,
    CRYPTO: 5,
  };

  // Round-robin interleave non-crypto & macro leaders first so top headlines across home & news reflect true multi-asset coverage
  const roundOrder: MarketNewsCategory[] = [
    'GOLD',
    'US_INDICES',
    'FOREX',
    'OIL_COMMODITIES',
    'US_MACRO',
    'CRYPTO',
  ];

  const buckets = new Map<MarketNewsCategory, RealNewsItem[]>();
  for (const cat of roundOrder) {
    buckets.set(cat, byCategory[cat].slice(0, quotas[cat]));
  }

  const interleaved: RealNewsItem[] = [];
  const usedIds = new Set<string>();
  let added = true;
  let round = 0;

  while (added && round < 10) {
    added = false;
    for (const cat of roundOrder) {
      const list = buckets.get(cat) || [];
      if (round < list.length) {
        const item = list[round];
        if (!usedIds.has(item.id)) {
          usedIds.add(item.id);
          interleaved.push(item);
        }
        added = true;
      }
    }
    round++;
  }

  return interleaved;
}

export async function fetchVerifiedTodayNews(): Promise<{
  news: RealNewsItem[];
  sourcesActive: string[];
  categoryCounts: Record<'ALL' | MarketNewsCategory, number>;
  lastFetched: string;
}> {
  const now = Date.now();
  if (newsCache && now - newsCache.fetchedAt < NEWS_TTL_MS) {
    return {
      news: newsCache.items,
      sourcesActive: newsCache.sourcesActive,
      categoryCounts: newsCache.categoryCounts,
      lastFetched: new Date(newsCache.fetchedAt).toISOString(),
    };
  }

  const allItems: RealNewsItem[] = [];
  const sourcesActive: string[] = [];

  // 1. Finnhub API (General + Forex categories when configured)
  const finnhubKey = (process.env.FINNHUB_API_KEY || process.env.NEWS_API_KEY)?.trim();
  if (finnhubKey) {
    await Promise.allSettled(
      (['general', 'forex'] as const).map(async (fhCat) => {
        try {
          const res = await fetch(
            `https://finnhub.io/api/v1/news?category=${fhCat}&token=${encodeURIComponent(finnhubKey)}`,
            { signal: AbortSignal.timeout(6000) }
          );
          if (!res.ok) return;
          const raw: any[] = await res.json();
          if (Array.isArray(raw) && raw.length > 0) {
            sourcesActive.push(fhCat === 'forex' ? 'Finnhub Forex Wire' : 'Finnhub Market Wire');
            for (const item of raw.slice(0, 20)) {
              if (!item.headline || !item.datetime || !item.url) continue;
              const publishedIso = new Date(item.datetime * 1000).toISOString();
              const cleanSummary = cleanReadableSummary(item.summary || '', item.headline);
              const classified = classifyArticle(item.headline, cleanSummary, {
                marketHint: fhCat === 'forex' ? 'FOREX' : undefined,
                labelHint: fhCat === 'forex' ? 'Forex & Central Banks' : 'Market Wire',
              });
              if (!classified.relevant) continue;
              const { freshness, ageHours } = computeFreshnessAndAge(publishedIso);
              allItems.push({
                id: item.id
                  ? `fh-${fhCat}-${String(item.id)}`
                  : buildStableArticleId(`fh-${fhCat}`, [item.url, item.headline, publishedIso]),
                title: item.headline,
                summary: cleanSummary,
                source: item.source || 'Finnhub',
                url: item.url,
                publishedAt: publishedIso,
                category: classified.displayCategory,
                marketCategory: classified.marketCategory,
                marketCategories: classified.marketCategories,
                relatedInstruments: classified.relatedInstruments,
                impactLevel: classified.impactLevel,
                macroEventLink: classified.macroEventLink,
                freshness,
                ageHours,
              });
            }
          }
        } catch (err: any) {
          console.warn(`Finnhub (${fhCat}) news fetch warning:`, err.message);
        }
      })
    );
  }

  // 2. Multi-Asset Financial RSS Feeds (Dedicated Gold, US Indices, Forex, Oil/Commodities, US Macro, Official Central Banks, Crypto)
  const feeds: Array<{
    name: string;
    url: string;
    marketHint?: MarketNewsCategory;
    labelHint: string;
    prefix: string;
    limit: number;
    requireStrongMatch?: boolean;
  }> = [
    // GOLD & PRECIOUS METALS
    {
      name: 'Yahoo Finance Metals',
      url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GC=F,SI=F,GLD&region=US&lang=en-US',
      marketHint: 'GOLD',
      labelHint: 'Gold & Precious Metals',
      prefix: 'yf-gold',
      limit: 12,
      requireStrongMatch: true,
    },
    // US INDICES (NASDAQ / US30 / S&P 500)
    {
      name: 'Yahoo Finance US Indices',
      url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5ENDX,%5EDJI,%5EGSPC,NVDA,AAPL,MSFT&region=US&lang=en-US',
      marketHint: 'US_INDICES',
      labelHint: 'NASDAQ / US Indices',
      prefix: 'yf-ndx',
      limit: 12,
      requireStrongMatch: true,
    },
    {
      name: 'Investing.com Equities',
      url: 'https://www.investing.com/rss/news_25.rss',
      marketHint: 'US_INDICES',
      labelHint: 'NASDAQ / US Indices',
      prefix: 'inv-stk',
      limit: 10,
      requireStrongMatch: true,
    },
    {
      name: 'CNBC Markets',
      url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
      labelHint: 'Market Wire',
      prefix: 'cnbc-mkt',
      limit: 10,
      requireStrongMatch: true,
    },
    // FOREX & CENTRAL BANKS
    {
      name: 'Yahoo Finance FX',
      url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=EURUSD=X,GBPUSD=X,USDJPY=X,DX-Y.NYB&region=US&lang=en-US',
      marketHint: 'FOREX',
      labelHint: 'Forex & Central Banks',
      prefix: 'yf-fx',
      limit: 12,
      requireStrongMatch: true,
    },
    {
      name: 'Investing.com Forex',
      url: 'https://www.investing.com/rss/news_1.rss',
      marketHint: 'FOREX',
      labelHint: 'Forex & Central Banks',
      prefix: 'inv-fx',
      limit: 10,
      requireStrongMatch: true,
    },
    // OIL & COMMODITIES
    {
      name: 'Yahoo Finance Energy',
      url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=CL=F,BZ=F,USO&region=US&lang=en-US',
      marketHint: 'OIL_COMMODITIES',
      labelHint: 'Oil & Commodities',
      prefix: 'yf-oil',
      limit: 12,
      requireStrongMatch: true,
    },
    {
      name: 'CNBC Commodities',
      url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19836768',
      marketHint: 'OIL_COMMODITIES',
      labelHint: 'Oil & Commodities',
      prefix: 'cnbc-cmd',
      limit: 10,
      requireStrongMatch: true,
    },
    {
      name: 'Investing.com Commodities',
      url: 'https://www.investing.com/rss/news_11.rss',
      marketHint: 'OIL_COMMODITIES',
      labelHint: 'Oil & Commodities',
      prefix: 'inv-cmd',
      limit: 10,
      requireStrongMatch: true,
    },
    {
      name: 'OilPrice.com',
      url: 'https://oilprice.com/rss/main',
      marketHint: 'OIL_COMMODITIES',
      labelHint: 'Oil & Commodities',
      prefix: 'oilp',
      limit: 8,
      requireStrongMatch: true,
    },
    // US ECONOMY / MACRO & OFFICIAL RELEASES
    {
      name: 'CNBC Economy',
      url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258',
      marketHint: 'US_MACRO',
      labelHint: 'US Economy / Macro',
      prefix: 'cnbc-eco',
      limit: 10,
      requireStrongMatch: true,
    },
    {
      name: 'Investing.com Economy',
      url: 'https://www.investing.com/rss/news_14.rss',
      marketHint: 'US_MACRO',
      labelHint: 'US Economy / Macro',
      prefix: 'inv-eco',
      limit: 10,
      requireStrongMatch: true,
    },
    {
      name: 'Federal Reserve Board',
      url: 'https://www.federalreserve.gov/feeds/press_monetary.xml',
      marketHint: 'US_MACRO',
      labelHint: 'FOMC / Central Bank',
      prefix: 'fed-live',
      limit: 6,
      requireStrongMatch: false,
    },
    {
      name: 'U.S. Bureau of Labor Statistics',
      url: 'https://www.bls.gov/feed/bls_latest.rss',
      marketHint: 'US_MACRO',
      labelHint: 'US Economy / Macro',
      prefix: 'bls-live',
      limit: 6,
      requireStrongMatch: false,
    },
    // CRYPTO (Capped alongside multi-asset feeds so it never dominates)
    {
      name: 'Yahoo Finance Crypto',
      url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=BTC-USD&region=US&lang=en-US',
      marketHint: 'CRYPTO',
      labelHint: 'Crypto / Digital Assets',
      prefix: 'yf-btc',
      limit: 6,
      requireStrongMatch: true,
    },
    {
      name: 'CoinDesk',
      url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
      marketHint: 'CRYPTO',
      labelHint: 'Crypto / Digital Assets',
      prefix: 'cd',
      limit: 5,
      requireStrongMatch: true,
    },
  ];

  await Promise.allSettled(
    feeds.map(async (f) => {
      try {
        const res = await fetch(f.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YOUNEEL-TRADING/1.0)' },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok) return;
        const xml = await res.text();
        const parsed = parseRssItems(
          xml,
          f.name,
          { marketHint: f.marketHint, labelHint: f.labelHint },
          f.prefix,
          Boolean(f.requireStrongMatch)
        );
        const freshOnly = parsed.filter((item) => {
          const ts = new Date(item.publishedAt).getTime();
          return Number.isFinite(ts) && now - ts <= LIVE_WIRE_MAX_AGE_MS;
        });
        if (freshOnly.length > 0) {
          sourcesActive.push(f.name);
          allItems.push(...freshOnly.slice(0, f.limit));
        }
      } catch (err: any) {
        console.warn(`RSS feed ${f.name} unavailable:`, err.message);
      }
    })
  );

  const balanced = buildBalancedMultiMarketWire(allItems);
  const categoryCounts = computeCategoryCounts(balanced);
  const uniqueSources = Array.from(new Set(sourcesActive));

  newsCache = {
    items: balanced,
    fetchedAt: now,
    sourcesActive: uniqueSources,
    categoryCounts,
  };

  return {
    news: balanced,
    sourcesActive: uniqueSources,
    categoryCounts,
    lastFetched: new Date(now).toISOString(),
  };
}

export async function fetchVerifiedHistoricalArchive(): Promise<{
  archive: HistoricalArchiveItem[];
  sourcesActive: string[];
  lastFetched: string;
}> {
  const now = Date.now();
  if (archiveCache && now - archiveCache.fetchedAt < ARCHIVE_TTL_MS) {
    return {
      archive: archiveCache.items,
      sourcesActive: archiveCache.sourcesActive,
      lastFetched: new Date(archiveCache.fetchedAt).toISOString(),
    };
  }

  const allItems: HistoricalArchiveItem[] = [];
  const sourcesActive: string[] = [];

  // Official public central bank & statistical archives
  const officialArchives: Array<{
    name: string;
    url: string;
    marketHint: MarketNewsCategory;
    labelHint: string;
    prefix: string;
  }> = [
    {
      name: 'Federal Reserve Board (Monetary Policy)',
      url: 'https://www.federalreserve.gov/feeds/press_monetary.xml',
      marketHint: 'US_MACRO',
      labelHint: 'FOMC / Central Bank',
      prefix: 'fed',
    },
    {
      name: 'European Central Bank (ECB)',
      url: 'https://www.ecb.europa.eu/rss/press.html',
      marketHint: 'FOREX',
      labelHint: 'Forex & Central Banks',
      prefix: 'ecb',
    },
    {
      name: 'U.S. Bureau of Labor Statistics (BLS)',
      url: 'https://www.bls.gov/feed/bls_latest.rss',
      marketHint: 'US_MACRO',
      labelHint: 'US Economy / Macro',
      prefix: 'bls',
    },
    {
      name: 'The Guardian Economics',
      url: 'https://www.theguardian.com/business/economics/rss',
      marketHint: 'US_MACRO',
      labelHint: 'Macro Archive',
      prefix: 'guard',
    },
  ];

  await Promise.allSettled(
    officialArchives.map(async (src) => {
      try {
        const res = await fetch(src.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YOUNEEL-TRADING/1.0)' },
          signal: AbortSignal.timeout(7000),
        });
        if (!res.ok) return;
        const xml = await res.text();
        const parsed = parseRssItems(
          xml,
          src.name,
          { marketHint: src.marketHint, labelHint: src.labelHint },
          src.prefix,
          src.prefix === 'guard'
        );
        const recentEnough = parsed.filter((item) => item.ageHours <= ARCHIVE_MAX_AGE_DAYS * 24);
        if (recentEnough.length > 0) {
          sourcesActive.push(src.name);
          allItems.push(...recentEnough.slice(0, 8));
        }
      } catch (err: any) {
        console.warn(`Archive feed ${src.name} unavailable:`, err.message);
      }
    })
  );

  const sorted = deduplicateItems(allItems)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 24);

  archiveCache = {
    items: sorted,
    fetchedAt: now,
    sourcesActive: Array.from(new Set(sourcesActive)),
  };

  return {
    archive: sorted,
    sourcesActive: archiveCache.sourcesActive,
    lastFetched: new Date(now).toISOString(),
  };
}
