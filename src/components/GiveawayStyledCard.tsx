import React, { useState } from 'react';
import { Calendar, Trophy, ExternalLink } from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import {
  GiveawayItem,
  resolveGiveawayStyle,
  getFontFamilyCss,
  getRadiusClass,
} from '../lib/giveawayTemplates';

interface GiveawayStyledCardProps {
  item: GiveawayItem;
  lang: Language;
  isPreview?: boolean;
  isSignedIn?: boolean;
  onEnterClick?: (item: GiveawayItem) => void;
  onOpenAuth?: () => void;
}

export const GiveawayStyledCard: React.FC<GiveawayStyledCardProps> = ({
  item,
  lang,
  isPreview = false,
  isSignedIn = false,
  onEnterClick,
  onOpenAuth,
}) => {
  const t = translations[lang];
  const [imgFailed, setImgFailed] = useState(false);

  const { preset, style } = resolveGiveawayStyle(item.design_template, item.style_config);
  const radiusClass = getRadiusClass(style.borderRadius);
  const fontFamily = getFontFamilyCss(style.fontPreset);
  const crop = item.image_crop || { x: 50, y: 50, zoom: 1, aspect: '16:9' };

  const isActive = item.status === 'active';
  const isUpcoming = item.status === 'scheduled';
  const isFull =
    typeof item.max_participants === 'number' &&
    item.max_participants > 0 &&
    typeof item.participantCount === 'number' &&
    item.participantCount >= item.max_participants;

  const statusText =
    item.status === 'active'
      ? t.statusActive
      : item.status === 'scheduled'
      ? t.statusScheduled
      : item.status === 'paused'
      ? t.statusPaused
      : item.status === 'completed' || item.status === 'ended'
      ? t.statusEnded
      : t.statusDraft;

  const aspectHeight =
    crop.aspect === '1:1' ? 'h-64' : crop.aspect === '4:3' ? 'h-56' : 'h-48';

  const buttonLabel = item.cta_label?.trim() || t.enterNow;
  const hasExternalUrl = Boolean(item.external_url && item.external_url.trim().startsWith('http'));

  return (
    <article
      style={{
        background: preset.gradientBackdrop || style.bgColor,
        color: style.textColor,
        fontFamily,
        borderColor: `${style.accentColor}33`,
      }}
      className={`flex flex-col border ${radiusClass} overflow-hidden shadow-sm transition-all`}
    >
      {item.image_url && !imgFailed ? (
        <div className={`relative ${aspectHeight} w-full overflow-hidden`} style={{ backgroundColor: style.surfaceColor }}>
          <img
            src={item.image_url}
            alt={item.title}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            style={{
              objectPosition: `${crop.x}% ${crop.y}%`,
              transform: `scale(${crop.zoom || 1})`,
              transformOrigin: `${crop.x}% ${crop.y}%`,
            }}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        </div>
      ) : null}

      <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
        <div className="space-y-3">
          {/* Unboxed status + end date */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold uppercase tracking-wider" style={{ color: style.accentColor }}>
              {statusText}
            </span>
            <span className="flex items-center gap-1 font-mono tabular-nums" style={{ color: style.mutedColor }}>
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {item.ends_at
                  ? new Date(item.ends_at).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US')
                  : '—'}
              </span>
            </span>
          </div>

          <div>
            <h3 className="text-xl font-bold leading-snug">{item.title || t.previewPlaceholderTitle}</h3>
            {item.subtitle && (
              <p className="text-xs font-medium mt-1" style={{ color: style.accentColor }}>
                {item.subtitle}
              </p>
            )}
            {item.sponsor && (
              <p className="text-[11px] mt-1 font-semibold" style={{ color: style.mutedColor }}>
                {t.giveawaySponsorLabel}: {item.sponsor}
              </p>
            )}
          </div>

          {item.description && (
            <p className="text-xs leading-relaxed" style={{ color: style.mutedColor }}>
              {item.description}
            </p>
          )}

          {/* Prize Highlight */}
          <div
            className="p-3.5 rounded-xl border"
            style={{
              backgroundColor: style.surfaceColor,
              borderColor: `${style.accentColor}40`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wider block"
                style={{ color: style.accentColor }}
              >
                {t.prizePool}
              </span>
              {typeof item.max_participants === 'number' && item.max_participants > 0 && (
                <span className="text-[10px] font-mono tabular-nums" style={{ color: style.mutedColor }}>
                  {item.participantCount ?? 0} / {item.max_participants} {t.entriesSuffix}
                </span>
              )}
            </div>
            <span className="text-base font-bold mt-0.5 block">
              {item.prize || t.previewPlaceholderPrize}
            </span>
          </div>

          {/* Winner Banner */}
          {item.winner_display_name && (
            <div
              className="p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold"
              style={{
                backgroundColor: `${style.accentColor}1a`,
                borderColor: `${style.accentColor}45`,
                color: style.accentColor,
              }}
            >
              <Trophy className="w-4 h-4 shrink-0" />
              <span>
                {t.winnerPrefix} {item.winner_display_name}
              </span>
            </div>
          )}

          {/* Participation Rules & Eligibility */}
          {item.rules && (
            <div>
              <span className="text-xs font-semibold block mb-1" style={{ color: style.textColor }}>
                {t.rules}
              </span>
              <p
                className="text-xs leading-relaxed whitespace-pre-line"
                style={{ color: style.mutedColor }}
              >
                {item.rules}
              </p>
            </div>
          )}

          {item.eligibility_rules && (
            <div className="text-[11px] leading-relaxed" style={{ color: style.mutedColor }}>
              <strong style={{ color: style.textColor }}>{t.giveawayEligibilityLabel}: </strong>
              {item.eligibility_rules}
            </div>
          )}

          {item.country_restrictions && (
            <div className="text-[11px] leading-relaxed" style={{ color: style.mutedColor }}>
              <strong style={{ color: style.textColor }}>{t.giveawayCountryRestrictionsLabel}: </strong>
              {item.country_restrictions}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2 space-y-2">
          {isPreview ? (
            <div
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-center flex items-center justify-center gap-2"
              style={{ backgroundColor: style.accentColor, color: '#09090b' }}
            >
              <span>{buttonLabel}</span>
              {hasExternalUrl && <ExternalLink className="w-3.5 h-3.5 rtl:rotate-180" />}
            </div>
          ) : item.myEntry ? (
            <div
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center border"
              style={{
                backgroundColor: style.surfaceColor,
                borderColor: `${style.accentColor}30`,
                color: style.textColor,
              }}
            >
              {t.enteredStatusPrefix} <span className="uppercase">{item.myEntry.status}</span>
            </div>
          ) : isUpcoming ? (
            <div
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center"
              style={{ backgroundColor: style.surfaceColor, color: style.mutedColor }}
            >
              {t.statusScheduled}
            </div>
          ) : !isActive ? (
            <div
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center"
              style={{ backgroundColor: style.surfaceColor, color: style.mutedColor }}
            >
              {t.statusEnded}
            </div>
          ) : isFull ? (
            <div
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center"
              style={{ backgroundColor: style.surfaceColor, color: style.mutedColor }}
            >
              {t.giveawayCapacityFull}
            </div>
          ) : hasExternalUrl ? (
            <a
              href={item.external_url}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-center flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: style.accentColor, color: '#09090b' }}
            >
              <span>{buttonLabel}</span>
              <ExternalLink className="w-3.5 h-3.5 rtl:rotate-180" />
            </a>
          ) : isSignedIn ? (
            <button
              type="button"
              onClick={() => onEnterClick?.(item)}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-center transition-opacity hover:opacity-90"
              style={{ backgroundColor: style.accentColor, color: '#09090b' }}
            >
              {buttonLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth?.()}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-center transition-opacity hover:opacity-90"
              style={{ backgroundColor: style.accentColor, color: '#09090b' }}
            >
              {t.signInToParticipate}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
