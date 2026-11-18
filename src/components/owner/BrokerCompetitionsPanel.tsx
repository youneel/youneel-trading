import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Plus,
  CheckCircle2,
  XCircle,
  Edit3,
  Star,
  Archive,
  Trash2,
  Eye,
  EyeOff,
  Bell,
  Clock,
  ExternalLink,
  AlertCircle,
  X,
} from 'lucide-react';
import { Language, translations, translateApiError } from '../../lib/i18n';
import { ImageCropUploader } from '../ImageCropUploader';
import { ImageCropConfig } from '../../lib/giveawayTemplates';

interface BrokerSource {
  id: string;
  broker_slug: string;
  broker_name: string;
  official_website_url: string;
  competition_source_url: string;
  last_checked_at: string | null;
  last_status: string;
  last_http_status: number | null;
  last_error: string | null;
}

interface AdminCompetition {
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
  status: string;
  review_status: string;
  is_published: boolean;
  is_featured: boolean;
  is_archived: boolean;
  is_potentially_outdated: boolean;
  outdated_reason: string;
  last_verified_at: string;
}

interface DiscoveryLog {
  id: string;
  broker_slug: string;
  source_url: string;
  trigger_type: string;
  fetch_status: string;
  http_status: number | null;
  discovered_count: number;
  updated_count: number;
  queued_count: number;
  duration_ms: number;
  message: string;
  checked_at: string;
}

interface OwnerNotification {
  id: string;
  category: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface BrokerCompetitionsPanelProps {
  lang: Language;
  accessToken: string;
}

export const BrokerCompetitionsPanel: React.FC<BrokerCompetitionsPanelProps> = ({
  lang,
  accessToken,
}) => {
  const t = translations[lang];
  const [competitions, setCompetitions] = useState<AdminCompetition[]>([]);
  const [sources, setSources] = useState<BrokerSource[]>([]);
  const [logs, setLogs] = useState<DiscoveryLog[]>([]);
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Add / Edit Competition Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brokerSlug, setBrokerSlug] = useState('hfm');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [prizeDetails, setPrizeDetails] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerCrop, setBannerCrop] = useState<ImageCropConfig>({ x: 50, y: 50, zoom: 1, aspect: '16:9' });
  const [officialSourceUrl, setOfficialSourceUrl] = useState('');
  const [officialRegUrl, setOfficialRegUrl] = useState('');
  const [rulesUrl, setRulesUrl] = useState('');
  const [regStart, setRegStart] = useState('');
  const [regEnd, setRegEnd] = useState('');
  const [compStart, setCompStart] = useState('');
  const [compEnd, setCompEnd] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [tradingReqs, setTradingReqs] = useState('');
  const [compStatus, setCompStatus] = useState('REGISTRATION OPEN');
  const [isPublished, setIsPublished] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add Broker Source Form
  const [addBrokerOpen, setAddBrokerOpen] = useState(false);
  const [newBrokerSlug, setNewBrokerSlug] = useState('');
  const [newBrokerName, setNewBrokerName] = useState('');
  const [newBrokerSite, setNewBrokerSite] = useState('');
  const [newBrokerSource, setNewBrokerSource] = useState('');

  const ownerHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken]
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/owner/competitions', {
        headers: ownerHeaders,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCompetitions(Array.isArray(data.competitions) ? data.competitions : []);
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (err: any) {
      setError(translateApiError(err?.message, lang));
    } finally {
      setLoading(false);
    }
  }, [ownerHeaders, lang]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/owner/competitions/sync', {
        method: 'POST',
        headers: ownerHeaders,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setCompetitions(Array.isArray(data.competitions) ? data.competitions : []);
      setSources(Array.isArray(data.sources) ? data.sources : []);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setStatusMsg(
        (data.syncResult?.results || [])
          .map((r: any) => `${r.broker_slug.toUpperCase()}: ${r.message}`)
          .join(' | ')
      );
    } catch (err: any) {
      setError(translateApiError(err?.message, lang));
    } finally {
      setSyncing(false);
    }
  };

  const openNewComp = () => {
    setEditingId(null);
    setBrokerSlug('hfm');
    setTitle('');
    setSubtitle('');
    setPrizePool('');
    setPrizeDetails('');
    setBannerUrl('');
    setOfficialSourceUrl('https://www.hfm.com/int/en/promotions');
    setOfficialRegUrl('https://www.hfm.com/int/en/promotions');
    setRulesUrl('');
    setRegStart('');
    setRegEnd('');
    setCompStart('');
    setCompEnd('');
    setEligibility('');
    setTradingReqs('');
    setCompStatus('REGISTRATION OPEN');
    setIsPublished(true);
    setIsFeatured(false);
    setEditorOpen(true);
  };

  const openEditComp = (c: AdminCompetition) => {
    setEditingId(c.id);
    setBrokerSlug(c.broker_slug);
    setTitle(c.title);
    setSubtitle(c.subtitle || '');
    setPrizePool(c.prize_pool || '');
    setPrizeDetails(c.prize_details || '');
    setBannerUrl(c.banner_url || '');
    setOfficialSourceUrl(c.official_source_url || '');
    setOfficialRegUrl(c.official_registration_url || '');
    setRulesUrl(c.rules_url || '');
    setRegStart(c.registration_start ? c.registration_start.slice(0, 10) : '');
    setRegEnd(c.registration_end ? c.registration_end.slice(0, 10) : '');
    setCompStart(c.competition_start ? c.competition_start.slice(0, 10) : '');
    setCompEnd(c.competition_end ? c.competition_end.slice(0, 10) : '');
    setEligibility(c.eligibility_summary || '');
    setTradingReqs(c.trading_requirements || '');
    setCompStatus(c.status || 'UNVERIFIED');
    setIsPublished(Boolean(c.is_published));
    setIsFeatured(Boolean(c.is_featured));
    setEditorOpen(true);
  };

  const handleSaveCompetition = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      broker_slug: brokerSlug,
      title,
      subtitle,
      prize_pool: prizePool,
      prize_details: prizeDetails,
      banner_url: bannerUrl,
      official_source_url: officialSourceUrl,
      official_registration_url: officialRegUrl || officialSourceUrl,
      rules_url: rulesUrl,
      registration_start: regStart ? `${regStart}T00:00:00.000Z` : null,
      registration_end: regEnd ? `${regEnd}T23:59:59.000Z` : null,
      competition_start: compStart ? `${compStart}T00:00:00.000Z` : null,
      competition_end: compEnd ? `${compEnd}T23:59:59.000Z` : null,
      eligibility_summary: eligibility,
      trading_requirements: tradingReqs,
      status: compStatus,
      review_status: 'approved',
      is_published: isPublished,
      is_featured: isFeatured,
      is_archived: false,
    };

    try {
      const url = editingId
        ? `/api/owner/competitions/${encodeURIComponent(editingId)}`
        : '/api/owner/competitions';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: ownerHeaders,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save competition');
      setEditorOpen(false);
      await loadWorkspace();
    } catch (err: any) {
      setError(translateApiError(err?.message, lang));
    } finally {
      setSaving(false);
    }
  };

  const quickUpdateComp = async (c: AdminCompetition, updates: Record<string, any>) => {
    try {
      const res = await fetch(`/api/owner/competitions/${encodeURIComponent(c.id)}`, {
        method: 'PATCH',
        headers: ownerHeaders,
        credentials: 'include',
        body: JSON.stringify({ ...c, ...updates }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Update failed');
      }
      await loadWorkspace();
    } catch (err: any) {
      setError(translateApiError(err?.message, lang));
    }
  };

  const deleteComp = async (id: string) => {
    try {
      await fetch(`/api/owner/competitions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: ownerHeaders,
        credentials: 'include',
      });
      await loadWorkspace();
    } catch (err: any) {
      setError(translateApiError(err?.message, lang));
    }
  };

  const handleAddBrokerSource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/owner/brokers', {
        method: 'POST',
        headers: ownerHeaders,
        credentials: 'include',
        body: JSON.stringify({
          broker_slug: newBrokerSlug,
          broker_name: newBrokerName,
          official_website_url: newBrokerSite,
          competition_source_url: newBrokerSource,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add broker');
      setAddBrokerOpen(false);
      setNewBrokerSlug('');
      setNewBrokerName('');
      setNewBrokerSite('');
      setNewBrokerSource('');
      await loadWorkspace();
    } catch (err: any) {
      setError(translateApiError(err?.message, lang));
    }
  };

  const markNotificationsRead = async () => {
    await fetch('/api/owner/notifications/read', {
      method: 'POST',
      headers: ownerHeaders,
      credentials: 'include',
    });
    await loadWorkspace();
  };

  const pendingQueue = competitions.filter((c) => c.review_status === 'pending_review');

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={syncing}
            onClick={handleSyncNow}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? t.compSyncingBtn : t.compSyncNowBtn}</span>
          </button>

          <button
            type="button"
            onClick={openNewComp}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t.compAddManualBtn}</span>
          </button>

          <button
            type="button"
            onClick={() => setAddBrokerOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-semibold"
          >
            {t.compAddBrokerBtn}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between gap-2">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Owner Notifications Feed */}
      {notifications.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <span>{t.notificationsHeading}</span>
            </h3>
            <button
              type="button"
              onClick={markNotificationsRead}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              {t.markAllReadBtn}
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {notifications.slice(0, 6).map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-xl border text-xs ${
                  n.is_read
                    ? 'border-black/5 dark:border-white/5 opacity-70'
                    : 'border-amber-500/25 bg-amber-500/5'
                }`}
              >
                <div className="font-bold text-zinc-900 dark:text-white">{n.title}</div>
                <div className="text-zinc-500 dark:text-zinc-400 mt-0.5">{n.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Review Queue */}
      {pendingQueue.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-amber-500/30 space-y-3">
          <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400">
            {t.compQueueHeading} ({pendingQueue.length})
          </h3>
          <div className="space-y-2.5">
            {pendingQueue.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-black/5 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="font-bold text-zinc-950 dark:text-white">
                    [{c.broker_slug.toUpperCase()}] {c.title}
                  </div>
                  <a
                    href={c.official_source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500 hover:underline inline-flex items-center gap-1"
                    dir="ltr"
                  >
                    <span>{c.official_source_url}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditComp(c)}
                    className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 font-semibold"
                  >
                    {t.editLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      quickUpdateComp(c, {
                        review_status: 'approved',
                        is_published: true,
                        status: c.status === 'UNVERIFIED' ? 'LIVE' : c.status,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t.compApprovePublishBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      quickUpdateComp(c, { review_status: 'rejected', is_published: false })
                    }
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{t.compRejectBtn}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Tracked Competitions */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{t.compAllHeading}</h3>
        {loading ? (
          <div className="py-10 text-center text-xs text-zinc-400">{t.loadingPage}</div>
        ) : competitions.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 text-xs text-zinc-500">
            {t.noCompetitionsTitle}
          </div>
        ) : (
          competitions.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold uppercase text-blue-600 dark:text-blue-400" dir="ltr">
                    {c.broker_slug}
                  </span>
                  <span aria-hidden="true" className="text-zinc-400">·</span>
                  <span className="font-bold text-base text-zinc-950 dark:text-white">{c.title}</span>
                  <span aria-hidden="true" className="text-zinc-400">·</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{c.status}</span>
                  {c.is_featured && (
                    <>
                      <span aria-hidden="true" className="text-zinc-400">·</span>
                      <span className="font-semibold text-amber-500">{t.featuredCompetitionsTitle}</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-zinc-500">
                  {c.prize_pool ? `${t.prizePool}: ${c.prize_pool} · ` : ''}
                  {c.is_published ? t.publishedTag : t.unpublishedTag} · {t.verifiedPrefix}{' '}
                  {new Date(c.last_verified_at).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEditComp(c)}
                  className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t.editLabel}</span>
                </button>

                <button
                  type="button"
                  onClick={() => quickUpdateComp(c, { is_published: !c.is_published })}
                  className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold flex items-center gap-1"
                >
                  {c.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{c.is_published ? t.unpublishBtn : t.publishBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={() => quickUpdateComp(c, { is_featured: !c.is_featured })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                    c.is_featured
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      : 'bg-black/5 dark:bg-white/10'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>{c.is_featured ? t.compUnfeatureHomeBtn : t.compFeatureHomeBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    quickUpdateComp(c, {
                      is_archived: !c.is_archived,
                      is_published: c.is_archived ? c.is_published : false,
                      review_status: c.is_archived ? 'approved' : 'archived',
                    })
                  }
                  className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-zinc-500"
                  title={t.archiveBtn}
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => deleteComp(c.id)}
                  className="p-2 rounded-lg bg-rose-500/10 text-rose-500"
                  title={t.deleteLabel}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Discovery Logs */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span>{t.discoveryLogsHeading}</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="text-zinc-400 border-b border-black/5 dark:border-white/10">
                <th className="py-2 pe-3 text-start">{t.compBrokerLabel}</th>
                <th className="py-2 pe-3 text-start">{t.fieldStatus}</th>
                <th className="py-2 pe-3 text-start">HTTP</th>
                <th className="py-2 pe-3 text-start">{t.lastUpdated}</th>
                <th className="py-2 text-start">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {logs.slice(0, 12).map((l) => (
                <tr key={l.id}>
                  <td className="py-2 pe-3 font-bold uppercase" dir="ltr">{l.broker_slug}</td>
                  <td className="py-2 pe-3 font-mono">{l.fetch_status}</td>
                  <td className="py-2 pe-3 font-mono tabular-nums" dir="ltr">{l.http_status ?? '—'}</td>
                  <td className="py-2 pe-3 font-mono tabular-nums text-zinc-500" dir="ltr">
                    {new Date(l.checked_at).toLocaleString()}
                  </td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-300">{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Competition Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#18181b] rounded-2xl p-6 shadow-2xl border border-black/10 dark:border-white/10 max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="absolute top-4 end-4 p-2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold">
              {editingId ? t.editLabel : t.compAddManualBtn}
            </h3>
            <form onSubmit={handleSaveCompetition} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-500 mb-1">{t.compBrokerLabel}</label>
                  <select
                    value={brokerSlug}
                    onChange={(e) => setBrokerSlug(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                  >
                    {sources.map((s) => (
                      <option key={s.broker_slug} value={s.broker_slug}>
                        {s.broker_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">{t.compStatusInputLabel}</label>
                  <select
                    value={compStatus}
                    onChange={(e) => setCompStatus(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                  >
                    {['UPCOMING', 'REGISTRATION OPEN', 'LIVE', 'ENDING SOON', 'COMPLETED', 'EXPIRED', 'UNVERIFIED'].map(
                      (st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-500 mb-1">{t.fieldTitleRequired}</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-500 mb-1">{t.compPrizePoolLabel}</label>
                  <input
                    value={prizePool}
                    onChange={(e) => setPrizePool(e.target.value)}
                    placeholder="$100,000"
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">{t.compPrizeDetailsLabel}</label>
                  <input
                    value={prizeDetails}
                    onChange={(e) => setPrizeDetails(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
              </div>

              <ImageCropUploader
                lang={lang}
                bucket="competition-banners"
                imageUrl={bannerUrl}
                crop={bannerCrop}
                accessToken={accessToken}
                onChangeImageUrl={setBannerUrl}
                onChangeCrop={setBannerCrop}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-500 mb-1">{t.compOfficialSourceLabel}</label>
                  <input
                    required
                    type="url"
                    dir="ltr"
                    value={officialSourceUrl}
                    onChange={(e) => setOfficialSourceUrl(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">{t.compOfficialRegLabel}</label>
                  <input
                    type="url"
                    dir="ltr"
                    value={officialRegUrl}
                    onChange={(e) => setOfficialRegUrl(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-500 mb-1">{t.compRulesUrlLabel}</label>
                <input
                  type="url"
                  dir="ltr"
                  value={rulesUrl}
                  onChange={(e) => setRulesUrl(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-zinc-500 mb-1">{t.compRegStartLabel}</label>
                  <input
                    type="date"
                    value={regStart}
                    onChange={(e) => setRegStart(e.target.value)}
                    className="w-full p-2 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">{t.compRegEndLabel}</label>
                  <input
                    type="date"
                    value={regEnd}
                    onChange={(e) => setRegEnd(e.target.value)}
                    className="w-full p-2 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">{t.compStartLabel}</label>
                  <input
                    type="date"
                    value={compStart}
                    onChange={(e) => setCompStart(e.target.value)}
                    className="w-full p-2 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-zinc-500 mb-1">{t.compEndLabel}</label>
                  <input
                    type="date"
                    value={compEnd}
                    onChange={(e) => setCompEnd(e.target.value)}
                    className="w-full p-2 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-500 mb-1">{t.compEligibilityInputLabel}</label>
                <textarea
                  rows={2}
                  value={eligibility}
                  onChange={(e) => setEligibility(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="block text-zinc-500 mb-1">{t.compTradingReqInputLabel}</label>
                <textarea
                  rows={2}
                  value={tradingReqs}
                  onChange={(e) => setTradingReqs(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 font-semibold">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                  />
                  <span>{t.publishToPublicLabel}</span>
                </label>
                <label className="flex items-center gap-2 font-semibold">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                  />
                  <span>{t.compFeatureHomeBtn}</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold disabled:opacity-50"
              >
                {saving ? t.savingLabel : t.saveCompetitionBtn}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Broker Source Modal */}
      {addBrokerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-white dark:bg-[#18181b] rounded-2xl p-6 shadow-2xl border border-black/10 dark:border-white/10 space-y-4 text-xs">
            <button
              type="button"
              onClick={() => setAddBrokerOpen(false)}
              className="absolute top-4 end-4 p-2 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold">{t.compAddBrokerBtn}</h3>
            <form onSubmit={handleAddBrokerSource} className="space-y-3">
              <input
                required
                dir="ltr"
                value={newBrokerSlug}
                onChange={(e) => setNewBrokerSlug(e.target.value)}
                placeholder={t.brokerSlugPlaceholder}
                className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
              />
              <input
                required
                value={newBrokerName}
                onChange={(e) => setNewBrokerName(e.target.value)}
                placeholder={t.brokerNamePlaceholder}
                className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
              />
              <input
                required
                type="url"
                dir="ltr"
                value={newBrokerSite}
                onChange={(e) => setNewBrokerSite(e.target.value)}
                placeholder={t.brokerSitePlaceholder}
                className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
              />
              <input
                required
                type="url"
                dir="ltr"
                value={newBrokerSource}
                onChange={(e) => setNewBrokerSource(e.target.value)}
                placeholder={t.brokerSourcePlaceholder}
                className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold"
              >
                {t.saveCompetitionBtn}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
