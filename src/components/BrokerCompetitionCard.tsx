import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Users,
  Trophy,
} from 'lucide-react';
import { Language, translations } from '../lib/i18n';

export interface PublicBrokerCompetition {
  id: string;
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
  status: 'UPCOMING' | 'REGISTRATION OPEN' | 'LIVE' | 'ENDING SOON' | 'COMPLETED' | 'EXPIRED' | 'UNVERIFIED';
  is_featured: boolean;
  is_potentially_outdated: boolean;
  outdated_reason: string;
  last_verified_at: string;
}

interface BrokerCompetitionCardProps {
  competition: PublicBrokerCompetition;
  lang: Language;
}

function BrokerLogoMark({ slug }: { slug: string }) {
  const lower = slug.toLowerCase();
  if (lower === 'tmgm') {
    return (
      <div
        className="w-11 h-11 rounded-xl bg-blue-950 border border-blue-500/30 text-blue-200 flex items-center justify-center shrink-0"
        dir="ltr"
      >
        <svg viewBox="0 0 48 24" className="w-8 h-4 fill-current" aria-hidden="true">
          <path d="M2 5h10v3H8.5v11h-3V8H2V5zm12 0h3.4l3.1 7.6L23.6 5H27v14h-2.8V9.8l-2.8 6.8h-1.8l-2.8-6.8V19H14V5zm16 7c0-4.2 3-7.2 7.2-7.2 2.4 0 4.3.9 5.5 2.5l-2.2 1.8c-.8-.9-1.9-1.5-3.3-1.5-2.5 0-4.2 1.8-4.2 4.4 0 2.6 1.7 4.4 4.2 4.4 1.7 0 2.9-.7 3.5-2h-3.6v-2.4h6.6v1.8c0 3.7-2.6 5.4-6.4 5.4-4.3 0-7.3-3-7.3-7.2z" />
        </svg>
      </div>
    );
  }
  if (lower === 'hfm') {
    return (
      <div
        className="w-11 h-11 rounded-xl bg-rose-950 border border-rose-500/30 text-rose-200 flex items-center justify-center shrink-0"
        dir="ltr"
      >
        <span className="font-extrabold text-xs tracking-wider">HFM</span>
      </div>
    );
  }
  return (
    <div
      className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-200 flex items-center justify-center shrink-0"
      dir="ltr"
    >
      <span className="font-extrabold text-xs uppercase">{slug.slice(0, 4)}</span>
    </div>
  );
}

function formatDateCompact(iso: string | null, lang: Language): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const BrokerCompetitionCard: React.FC<BrokerCompetitionCardProps> = ({
  competition,
  lang,
}) => {
  const t = translations[lang];
  const [imgFailed, setImgFailed] = useState(false);

  const isTmgm = competition.broker_slug.toLowerCase() === 'tmgm';
  const isHfm = competition.broker_slug.toLowerCase() === 'hfm';

  const cardThemeClass = isTmgm
    ? 'border-blue-500/20 dark:border-blue-400/20'
    : isHfm
    ? 'border-rose-500/20 dark:border-rose-400/20'
    : 'border-black/10 dark:border-white/10';

  const bannerGradient = isTmgm
    ? 'from-slate-950 via-blue-950 to-slate-900'
    : isHfm
    ? 'from-zinc-950 via-rose-950 to-zinc-900'
    : 'from-zinc-900 to-zinc-800';

  const statusTone =
    competition.status === 'LIVE' || competition.status === 'REGISTRATION OPEN'
      ? 'text-emerald-700 dark:text-emerald-400'
      : competition.status === 'ENDING SOON' || competition.status === 'UPCOMING'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-zinc-500 dark:text-zinc-400';

  const statusLabel = (() => {
    switch (competition.status) {
      case 'LIVE':
        return t.compStatusLive;
      case 'REGISTRATION OPEN':
        return t.compStatusRegOpen;
      case 'UPCOMING':
        return t.compStatusUpcoming;
      case 'ENDING SOON':
        return t.compStatusEndingSoon;
      case 'COMPLETED':
        return t.compStatusCompleted;
      case 'EXPIRED':
        return t.compStatusExpired;
      default:
        return t.compStatusUnverified;
    }
  })();

  const ctaBgClass = isTmgm
    ? 'bg-blue-700 hover:bg-blue-600 text-white'
    : isHfm
    ? 'bg-rose-700 hover:bg-rose-600 text-white'
    : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950';

  return (
    <article
      className={`flex flex-col rounded-2xl bg-white dark:bg-[#121214] border ${cardThemeClass} overflow-hidden transition-colors`}
    >
      {/* Official Banner / Fallback Container */}
      <div className={`relative h-48 w-full bg-gradient-to-br ${bannerGradient} overflow-hidden`}>
        {competition.banner_url && !imgFailed ? (
          <img
            src={competition.banner_url}
            alt={competition.title}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white/90">
            <Trophy className="w-8 h-8 mb-2 opacity-75" />
            <p className="text-sm font-bold tracking-tight max-w-xs">{competition.title}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute bottom-3 start-4 end-4 flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrokerLogoMark slug={competition.broker_slug} />
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-white/80" dir="ltr">
                {competition.broker_slug.toUpperCase()}
              </div>
              <div className="text-xs text-white/75 truncate">
                {competition.subtitle || t.officialBrokerContest}
              </div>
            </div>
          </div>
          {competition.prize_pool && (
            <div className="text-end shrink-0" dir="ltr">
              <div className="text-[10px] uppercase tracking-wider text-white/70">
                {t.prizePool}
              </div>
              <div className="text-lg font-extrabold font-mono tabular-nums text-white">
                {competition.prize_pool}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
        <div className="space-y-4">
          {/* Unboxed status + verified metadata line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className={`font-bold flex items-center gap-1 ${statusTone}`}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{statusLabel}</span>
            </span>
            {competition.participating_accounts !== null && (
              <>
                <span aria-hidden="true" className="text-zinc-400">·</span>
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 tabular-nums">
                  <Users className="w-3.5 h-3.5" />
                  <span>{competition.participating_accounts.toLocaleString()} {t.accountsLabel}</span>
                </span>
              </>
            )}
            <span aria-hidden="true" className="text-zinc-400">·</span>
            <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
              {t.verifiedPrefix} {formatDateCompact(competition.last_verified_at, lang)}
            </span>
          </div>

          <h3 className="text-xl font-bold text-zinc-950 dark:text-white leading-snug">
            {competition.title}
          </h3>

          {competition.is_potentially_outdated && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t.compPotentiallyOutdatedNotice}</span>
            </div>
          )}

          {competition.prize_details && (
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {competition.prize_details}
            </p>
          )}

          {/* Key Schedule Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-black/5 dark:border-white/10 text-xs">
            <div>
              <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{t.compRegDeadlineLabel}</span>
              </div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {formatDateCompact(competition.registration_end, lang)}
              </div>
            </div>
            <div>
              <div className="text-zinc-400 flex items-center gap-1 mb-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{t.compDatesLabel}</span>
              </div>
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {formatDateCompact(competition.competition_start, lang)} —{' '}
                {formatDateCompact(competition.competition_end, lang)}
              </div>
            </div>
          </div>

          {/* Eligibility & Requirements */}
          {(competition.eligibility_summary || competition.trading_requirements) && (
            <div className="space-y-2 pt-3 border-t border-black/5 dark:border-white/10 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {competition.eligibility_summary && (
                <div>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 me-1.5">
                    {t.compEligibilityLabel}:
                  </span>
                  <span>{competition.eligibility_summary}</span>
                </div>
              )}
              {competition.trading_requirements && (
                <div>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 me-1.5">
                    {t.compRequirementsLabel}:
                  </span>
                  <span>{competition.trading_requirements}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Official Links & Participate CTA */}
        <div className="pt-3 border-t border-black/5 dark:border-white/10 space-y-2.5">
          <a
            href={competition.official_registration_url || competition.official_source_url}
            target="_blank"
            rel="noreferrer"
            className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 ${ctaBgClass}`}
          >
            <span>{t.participateOfficialBtn}</span>
            <ExternalLink className="w-3.5 h-3.5 rtl:rotate-180" />
          </a>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
            <a
              href={competition.official_source_url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 underline underline-offset-4 flex items-center gap-1"
            >
              <span>{t.officialSourceLinkLabel}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            {competition.rules_url && (
              <a
                href={competition.rules_url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-zinc-900 dark:hover:text-zinc-200 underline underline-offset-4 flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                <span>{t.officialRulesLabel}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
