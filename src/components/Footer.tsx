import React, { useState } from 'react';
import { Shield, FileText, X, Instagram } from 'lucide-react';
import { TelegramIcon, OFFICIAL_INSTAGRAM_URL, OFFICIAL_TELEGRAM_URL } from './TelegramIcon';
import { Language, translations } from '../lib/i18n';

interface FooterProps {
  lang: Language;
}

export const Footer: React.FC<FooterProps> = ({ lang }) => {
  const t = translations[lang];
  const [modalType, setModalType] = useState<'privacy' | 'terms' | null>(null);

  return (
    <>
      <footer className="w-full border-t border-black/5 dark:border-white/10 bg-white/50 dark:bg-[#0c0c0e]/50 backdrop-blur-md py-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-start">
            <div className="space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="font-extrabold text-base tracking-tight text-zinc-950 dark:text-white" dir="ltr">
                  YOUNEEL TRADING
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
                  {t.institutionalBadge}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md">
                {t.tagline}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
              <button
                onClick={() => setModalType('privacy')}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                {t.privacyPolicy}
              </button>
              <button
                onClick={() => setModalType('terms')}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                {t.termsOfService}
              </button>
              <a
                href={OFFICIAL_INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                aria-label={t.followHandleAria}
                title={t.followHandleAria}
                className="group flex items-center gap-1.5 hover:text-pink-600 dark:hover:text-pink-400 transition-colors"
              >
                <Instagram className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6" />
                <span>@youneel.i</span>
              </a>
              <a
                href={OFFICIAL_TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                aria-label="Contact us on Telegram"
                title="Contact us on Telegram"
                className="group flex items-center gap-1.5 hover:text-sky-500 dark:hover:text-sky-400 transition-colors"
              >
                <TelegramIcon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                <span>@youne_el_i</span>
              </a>
            </div>
          </div>

          <div className="pt-6 border-t border-black/5 dark:border-white/5 text-[11px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed space-y-2">
            <p>{t.paperTradingNote}</p>
            <p>© {new Date().getFullYear()} {t.allRightsReserved}</p>
          </div>
        </div>
      </footer>

      {/* Legal Policy Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#18181b] rounded-3xl p-6 sm:p-8 shadow-2xl border border-black/10 dark:border-white/10 text-zinc-900 dark:text-zinc-100 max-h-[85vh] overflow-y-auto">
            <button
              onClick={() => setModalType(null)}
              aria-label={t.closeBtn}
              className="absolute top-5 end-5 p-2 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            {modalType === 'privacy' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-emerald-500" />
                  <h2 className="text-xl font-bold tracking-tight">{t.privacyPolicy}</h2>
                </div>

                <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-3 leading-relaxed">
                  <p>
                    <strong>{t.privacyClause1Title}</strong> {t.privacyClause1Body}
                  </p>
                  <p>
                    <strong>{t.privacyClause2Title}</strong> {t.privacyClause2Body}
                  </p>
                  <p>
                    <strong>{t.privacyClause3Title}</strong> {t.privacyClause3Body}
                  </p>
                  <p>
                    <strong>{t.privacyClause4Title}</strong> {t.privacyClause4Body}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-sky-500" />
                  <h2 className="text-xl font-bold tracking-tight">{t.termsOfService}</h2>
                </div>

                <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-3 leading-relaxed">
                  <p>
                    <strong>{t.termsClause1Title}</strong> {t.termsClause1Body}
                  </p>
                  <p>
                    <strong>{t.termsClause2Title}</strong> {t.termsClause2Body}
                  </p>
                  <p>
                    <strong>{t.termsClause3Title}</strong> {t.termsClause3Body}
                  </p>
                  <p>
                    <strong>{t.termsClause4Title}</strong> {t.termsClause4Body}
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 mt-6 border-t border-black/5 dark:border-white/10 text-end">
              <button
                onClick={() => setModalType(null)}
                className="px-5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold text-xs"
              >
                {t.closeBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
