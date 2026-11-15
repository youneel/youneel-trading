import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Instagram, ArrowUpRight } from 'lucide-react';
import { TelegramIcon, OFFICIAL_INSTAGRAM_URL, OFFICIAL_TELEGRAM_URL } from '../components/TelegramIcon';
import { Language, translations } from '../lib/i18n';

interface ContactPageProps {
  lang: Language;
}

interface ChannelCardProps {
  t: (typeof translations)['en'];
  reducedMotion: boolean;
}

const InstagramChannelCard: React.FC<ChannelCardProps> = ({ t, reducedMotion }) => {
  return (
    <motion.a
      href={OFFICIAL_INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="social-card-instagram"
      aria-label={t.followHandleAria}
      title={t.followHandleAria}
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reducedMotion ? undefined : { scale: 1.02 }}
      whileTap={reducedMotion ? undefined : { scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 360, damping: 24 }}
      className="group relative flex flex-col justify-between rounded-3xl p-[1.5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0c0c0e] shadow-sm hover:shadow-xl hover:shadow-rose-500/15 transition-shadow duration-300"
    >
      {/* Instagram gradient border */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#f58529]/60 via-[#dd2a7b]/60 to-[#8134af]/60 opacity-70 group-hover:opacity-100 transition-opacity duration-300"
      />

      {/* Instagram ambient warm glow (unique to Instagram) */}
      {!reducedMotion && (
        <motion.span
          aria-hidden="true"
          animate={{ opacity: [0.18, 0.45, 0.18], scale: [0.99, 1.015, 0.99] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-tr from-[#f58529]/30 via-[#dd2a7b]/25 to-[#8134af]/30 blur-lg -z-10"
        />
      )}

      <div className="relative h-full overflow-hidden rounded-[22.5px] bg-white dark:bg-[#121214] p-6 sm:p-8 flex flex-col justify-between gap-6">
        {!reducedMotion && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-rose-500/8 to-transparent"
          />
        )}

        <div className="relative space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white flex items-center justify-center shadow-md shadow-rose-500/20 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 shrink-0">
              <Instagram className="w-6 h-6" />
            </div>
            <span
              dir="ltr"
              className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/15"
            >
              @youneel.i
            </span>
          </div>

          <div className="space-y-1.5 text-start">
            <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {t.instagramChannelTitle}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t.instagramChannelDesc}
            </p>
          </div>
        </div>

        <div className="relative pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-sm font-bold text-zinc-950 dark:text-white">
          <span>{t.openInstagramBtn}</span>
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 group-hover:bg-gradient-to-tr group-hover:from-[#f58529] group-hover:via-[#dd2a7b] group-hover:to-[#8134af] group-hover:text-white transition-all duration-300">
            <ArrowUpRight className="w-4 h-4 rtl:rotate-[-90deg]" />
          </span>
        </div>
      </div>
    </motion.a>
  );
};

const TelegramChannelCard: React.FC<ChannelCardProps> = ({ t, reducedMotion }) => {
  return (
    <motion.a
      href={OFFICIAL_TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="social-card-telegram"
      aria-label={t.telegramHandleAria}
      title={t.telegramHandleAria}
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reducedMotion ? undefined : { y: -4 }}
      whileTap={reducedMotion ? undefined : { scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20, delay: reducedMotion ? 0 : 0.06 }}
      className="group relative flex flex-col justify-between rounded-3xl p-[1.5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0c0c0e] shadow-sm hover:shadow-xl hover:shadow-sky-500/15 transition-shadow duration-300"
    >
      {/* Telegram directional cyan/sky border */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#0088cc]/55 via-[#229ED9]/65 to-[#38bdf8]/65 opacity-70 group-hover:opacity-100 transition-opacity duration-300"
      />

      {/* Telegram kinetic horizontal drift glow (distinct from Instagram) */}
      {!reducedMotion && (
        <motion.span
          aria-hidden="true"
          animate={{ x: [-4, 4, -4], opacity: [0.16, 0.38, 0.16] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-r from-[#0088cc]/25 via-[#229ED9]/25 to-[#38bdf8]/30 blur-lg -z-10"
        />
      )}

      <div className="relative h-full overflow-hidden rounded-[22.5px] bg-white dark:bg-[#121214] p-6 sm:p-8 flex flex-col justify-between gap-6">
        <div className="relative space-y-4">
          <div className="flex items-center justify-between gap-3">
            {/* Independent floating paper-plane motion */}
            <motion.div
              animate={reducedMotion ? undefined : { y: [0, -5, 0] }}
              transition={reducedMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0088cc] via-[#229ED9] to-[#38bdf8] text-white flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0"
            >
              <span className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                <TelegramIcon className="w-6 h-6" />
              </span>
            </motion.div>

            <span
              dir="ltr"
              className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400 px-3 py-1 rounded-lg bg-sky-500/10 border border-sky-500/15"
            >
              @youne_el_i
            </span>
          </div>

          <div className="space-y-1.5 text-start">
            <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {t.telegramChannelTitle}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t.telegramChannelDesc}
            </p>
          </div>
        </div>

        <div className="relative pt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-sm font-bold text-zinc-950 dark:text-white">
          <span>{t.openTelegramBtn}</span>
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-900 group-hover:bg-gradient-to-tr group-hover:from-[#0088cc] group-hover:to-[#38bdf8] group-hover:text-white transition-all duration-300">
            <ArrowUpRight className="w-4 h-4 rtl:rotate-[-90deg] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
      </div>
    </motion.a>
  );
};

export const ContactPage: React.FC<ContactPageProps> = ({ lang }) => {
  const t = translations[lang];
  const shouldReduceMotion = Boolean(useReducedMotion());

  return (
    <div className="space-y-8 max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="border-b border-black/5 dark:border-white/10 pb-6 text-center sm:text-start">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
          {t.contactTitle}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-2xl">
          {t.contactSubtitle}
        </p>
      </div>

      {/* Two Completely Independent Official Social Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <InstagramChannelCard t={t} reducedMotion={shouldReduceMotion} />
        <TelegramChannelCard t={t} reducedMotion={shouldReduceMotion} />
      </div>
    </div>
  );
};
