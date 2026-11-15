import React, { useState, useEffect, useCallback } from 'react';
import { Gift, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { Language, translations, translateApiError } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';
import { GiveawayItem } from '../lib/giveawayTemplates';
import { GiveawayStyledCard } from '../components/GiveawayStyledCard';

interface GiveawaysPageProps {
  lang: Language;
  onOpenAuth: () => void;
  onNavigateOwner?: () => void;
}

export const GiveawaysPage: React.FC<GiveawaysPageProps> = ({
  lang,
  onOpenAuth,
  onNavigateOwner,
}) => {
  const t = translations[lang];
  const { user, accessToken, isOwnerAccount, ownerSessionVerified } = useAuth();

  const [giveaways, setGiveaways] = useState<GiveawayItem[]>([]);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<{
    category?: string;
    code?: string;
    message?: string;
    hint?: string;
    migrationFile?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const [enteringGiveaway, setEnteringGiveaway] = useState<GiveawayItem | null>(null);
  const [entryNote, setEntryNote] = useState('');
  const [submittingEntry, setSubmittingEntry] = useState(false);

  const loadPublicGiveaways = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch('/api/giveaways', { headers, credentials: 'same-origin' });
      const data = await res.json();
      setDiagnostic(data.diagnostic || null);
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSchemaMissing(Boolean(data.schemaMissing));
      setGiveaways(Array.isArray(data.giveaways) ? data.giveaways : []);
    } catch (err: any) {
      setError(err?.message || translateApiError(err?.message, lang));
    } finally {
      setLoading(false);
    }
  }, [accessToken, lang]);

  useEffect(() => {
    loadPublicGiveaways();
  }, [loadPublicGiveaways]);

  const handleParticipateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteringGiveaway || !accessToken) return;
    setSubmittingEntry(true);
    setError(null);
    try {
      const res = await fetch(`/api/giveaways/${encodeURIComponent(enteringGiveaway.id)}/enter`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ entry_note: entryNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission rejected');
      setStatusBanner(t.participationRecorded);
      setEnteringGiveaway(null);
      setEntryNote('');
      await loadPublicGiveaways();
    } catch (err: any) {
      setError(translateApiError(err?.message, lang));
    } finally {
      setSubmittingEntry(false);
    }
  };

  const [filterGroup, setFilterGroup] = useState<'all' | 'active' | 'upcoming' | 'completed'>('all');

  const activeGiveaways = giveaways.filter((g) => g.status === 'active');
  const upcomingGiveaways = giveaways.filter((g) => g.status === 'scheduled');
  const completedGiveaways = giveaways.filter((g) => g.status === 'ended' || g.status === 'completed');

  const filteredGiveaways =
    filterGroup === 'active'
      ? activeGiveaways
      : filterGroup === 'upcoming'
      ? upcomingGiveaways
      : filterGroup === 'completed'
      ? completedGiveaways
      : giveaways;

  return (
    <div className="space-y-8 max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            {t.giveawaysTitle}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            {t.giveawaysSubtitle}
          </p>
        </div>

        {/* Owner management shortcut appears ONLY for the verified Owner session */}
        {isOwnerAccount && ownerSessionVerified && onNavigateOwner && (
          <button
            type="button"
            onClick={onNavigateOwner}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{t.ownerStudioLabel}</span>
          </button>
        )}
      </div>

      {/* Category Filter Tabs (Active / Upcoming / Completed) */}
      {!schemaMissing && giveaways.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 w-fit">
          {[
            { id: 'all', label: t.filterAll, count: giveaways.length },
            { id: 'active', label: t.giveawaysGroupActive, count: activeGiveaways.length },
            { id: 'upcoming', label: t.giveawaysGroupUpcoming, count: upcomingGiveaways.length },
            { id: 'completed', label: t.giveawaysGroupCompleted, count: completedGiveaways.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterGroup(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                filterGroup === tab.id
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono text-[10px] opacity-75">({tab.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Feedback / Error Banners */}
      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between">
          <span>{statusBanner}</span>
          <button type="button" onClick={() => setStatusBanner(null)} aria-label={t.closeBtn}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">{error}</div>
              {diagnostic?.category && (
                <div className="font-mono text-[11px] opacity-85" dir="ltr">
                  [{diagnostic.category}] {diagnostic.code ? `(${diagnostic.code})` : ''} {diagnostic.hint || ''}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={loadPublicGiveaways}
            className="px-2.5 py-1 rounded-lg bg-rose-500/15 font-semibold shrink-0"
          >
            {t.refreshBtn}
          </button>
        </div>
      )}

      {schemaMissing ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-[#121214] border border-amber-500/30 text-center space-y-3">
          <Gift className="w-8 h-8 text-amber-500 mx-auto" />
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">
            {t.giveawaysSchemaMissingTitle}
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            {isOwnerAccount ? t.giveawaysUnavailableAdminDesc : t.giveawaysUnavailableDesc}
          </p>
          {diagnostic && (
            <div className="max-w-xl mx-auto p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-black/5 dark:border-white/10 text-[11px] text-zinc-600 dark:text-zinc-400 font-mono text-start space-y-1" dir="ltr">
              <div>Category: {diagnostic.category} {diagnostic.code ? `(${diagnostic.code})` : ''}</div>
              {diagnostic.message && <div>Detail: {diagnostic.message}</div>}
              {isOwnerAccount && diagnostic.migrationFile && (
                <div>Migration: {diagnostic.migrationFile}</div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={loadPublicGiveaways}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold"
          >
            {t.refreshBtn}
          </button>
        </div>
      ) : loading ? (
        <div className="py-16 text-center text-zinc-400 text-sm">{t.loadingGiveaways}</div>
      ) : filteredGiveaways.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 space-y-2">
          <Gift className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {t.noPublishedGiveawaysTitle}
          </p>
          <p className="text-xs text-zinc-500">{t.noPublishedGiveawaysDesc}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGiveaways.map((item) => (
            <GiveawayStyledCard
              key={item.id}
              item={item}
              lang={lang}
              isSignedIn={Boolean(user)}
              onOpenAuth={onOpenAuth}
              onEnterClick={(selected) => {
                setEntryNote('');
                setEnteringGiveaway(selected);
              }}
            />
          ))}
        </div>
      )}

      {/* Participation Modal */}
      {enteringGiveaway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-2xl p-6 shadow-2xl border border-black/10 dark:border-white/10 space-y-4">
            <button
              type="button"
              onClick={() => setEnteringGiveaway(null)}
              aria-label={t.closeBtn}
              className="absolute top-4 end-4 p-2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold text-zinc-950 dark:text-white">
              {t.enterGiveawayHeading} {enteringGiveaway.title}
            </h3>
            <p className="text-xs text-zinc-500">
              {t.submittingAsPrefix}{' '}
              <strong className="text-zinc-800 dark:text-zinc-200" dir="ltr">
                {user?.email}
              </strong>
            </p>
            <form onSubmit={handleParticipateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">
                  {t.verificationNoteLabel}
                </label>
                <textarea
                  rows={3}
                  value={entryNote}
                  onChange={(e) => setEntryNote(e.target.value)}
                  placeholder={t.verificationNotePlaceholder}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={submittingEntry}
                className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold text-xs disabled:opacity-50"
              >
                {submittingEntry ? t.submittingBtn : t.confirmEntryBtn}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
