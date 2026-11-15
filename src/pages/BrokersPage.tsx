import React from 'react';
import { ShieldCheck, ExternalLink, AlertTriangle } from 'lucide-react';
import { Language, translations } from '../lib/i18n';

interface BrokersPageProps {
  lang: Language;
}

export const BrokersPage: React.FC<BrokersPageProps> = ({ lang }) => {
  const t = translations[lang];

  const brokers = [
    {
      id: 'hfm',
      name: 'HFM (HF Markets)',
      tagline: t.hfmTagline,
      link: 'https://register.hfm.com/sv/en/new-live-account/?refid=30542499',
      logoText: 'HFM',
      accentColor: 'from-red-600 to-rose-700',
    },
    {
      id: 'tmgm',
      name: 'TMGM (TradeMax Global Markets)',
      tagline: t.tmgmTagline,
      link: 'https://portal.tmgm.com/register?r_code=IB1750358678A',
      logoText: 'TMGM',
      accentColor: 'from-blue-600 to-indigo-700',
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="border-b border-black/5 dark:border-white/10 pb-6 text-center sm:text-start">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{t.verifiedBrokerBadge}</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
          {t.brokersTitle}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
          {t.brokersSubtitle}
        </p>
      </div>

      {/* Minimal, Clean, Verified Broker Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {brokers.map((broker) => (
          <div
            key={broker.id}
            className="flex flex-col justify-between rounded-3xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/10 shadow-sm p-6 sm:p-8 space-y-6 hover:shadow-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${broker.accentColor} text-white flex items-center justify-center font-extrabold text-sm tracking-wider shadow-sm shrink-0`}
                  dir="ltr"
                >
                  {broker.logoText}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-zinc-950 dark:text-white leading-tight truncate" dir="ltr">
                    {broker.name}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{broker.tagline}</p>
                </div>
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {t.brokerVerifyDirectNote}
              </p>
            </div>

            <a
              href={broker.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 rounded-2xl bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <span>{t.openLiveAccount}</span>
              <ExternalLink className="w-4 h-4 rtl:rotate-180" />
            </a>
          </div>
        ))}
      </div>

      {/* Disclosures & Risk Warning */}
      <div className="space-y-3 pt-2">
        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-black/5 dark:border-white/10 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {t.affiliateDisclosure}
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <span>{t.riskWarning}</span>
        </div>
      </div>
    </div>
  );
};
