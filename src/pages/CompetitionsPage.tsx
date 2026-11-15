import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trophy, Search, RefreshCw, ShieldCheck } from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import {
  BrokerCompetitionCard,
  PublicBrokerCompetition,
} from '../components/BrokerCompetitionCard';

interface BrokerSourcePublic {
  broker_slug: string;
  broker_name: string;
  official_website_url: string;
  competition_source_url: string;
  last_checked_at: string | null;
  last_status: string;
}

interface CompetitionsPageProps {
  lang: Language;
}

export const CompetitionsPage: React.FC<CompetitionsPageProps> = ({ lang }) => {
  const t = translations[lang];
  const [competitions, setCompetitions] = useState<PublicBrokerCompetition[]>([]);
  const [sources, setSources] = useState<BrokerSourcePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [brokerFilter, setBrokerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadCompetitions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/competitions');
      if (res.ok) {
        const data = await res.json();
        setCompetitions(Array.isArray(data.competitions) ? data.competitions : []);
        setSources(Array.isArray(data.sources) ? data.sources : []);
      }
    } catch {
      // Keep previous list on transient network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompetitions();
  }, [loadCompetitions]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return competitions.filter((c) => {
      if (brokerFilter !== 'all' && c.broker_slug.toLowerCase() !== brokerFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.broker_slug.toLowerCase().includes(q) ||
        c.prize_pool.toLowerCase().includes(q) ||
        c.eligibility_summary.toLowerCase().includes(q)
      );
    });
  }, [competitions, brokerFilter, statusFilter, searchQuery]);

  const statusTabs: Array<{ value: string; label: string }> = [
    { value: 'all', label: t.allStatusesFilter },
    { value: 'LIVE', label: t.compStatusLive },
    { value: 'REGISTRATION OPEN', label: t.compStatusRegOpen },
    { value: 'UPCOMING', label: t.compStatusUpcoming },
    { value: 'ENDING SOON', label: t.compStatusEndingSoon },
    { value: 'COMPLETED', label: t.compStatusCompleted },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>{t.officialBrokerContest}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            {t.competitionsTitle}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
            {t.competitionsSubtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={loadCompetitions}
          className="self-start md:self-auto px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t.retry}</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Broker Filter */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 self-start">
          <button
            type="button"
            onClick={() => setBrokerFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              brokerFilter === 'all'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            {t.allBrokersFilter}
          </button>
          {sources.map((src) => (
            <button
              key={src.broker_slug}
              type="button"
              onClick={() => setBrokerFilter(src.broker_slug.toLowerCase())}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                brokerFilter === src.broker_slug.toLowerCase()
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
              dir="ltr"
            >
              {src.broker_name}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute start-3 top-2.5" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchCompetitionsPlaceholder}
            className="w-full ps-9 pe-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#121214] text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white"
          />
        </div>
      </div>

      {/* Status Filter Strip */}
      <div className="flex flex-wrap items-center gap-1.5">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              statusFilter === tab.value
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                : 'bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Competitions Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-96 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 space-y-2.5 px-4">
          <Trophy className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {t.noCompetitionsTitle}
          </p>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            {t.noCompetitionsDesc}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((comp) => (
            <BrokerCompetitionCard key={comp.id} competition={comp} lang={lang} />
          ))}
        </div>
      )}

      {/* Official Transparency Note */}
      <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/10 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
        {t.brokerSourcesNote}
      </div>
    </div>
  );
};
