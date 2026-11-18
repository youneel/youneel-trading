import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Edit3,
  Copy,
  Pause,
  Archive,
  Trash2,
  Eye,
  EyeOff,
  Users,
  CheckCircle2,
  XCircle,
  Award,
  Send,
  Save,
  Clock,
  X,
  AlertCircle,
  RefreshCw,
  Database,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import { Language, translations, translateApiError } from '../../lib/i18n';
import {
  GIVEAWAY_TEMPLATES,
  GiveawayFontId,
  GiveawayItem,
  GiveawayStyleConfig,
  GiveawayTemplateId,
  ImageCropConfig,
} from '../../lib/giveawayTemplates';
import { ImageCropUploader, ImageCropUploaderHandle } from '../ImageCropUploader';
import { GiveawayStyledCard } from '../GiveawayStyledCard';

interface GiveawayBuilderPanelProps {
  lang: Language;
  accessToken: string;
}

function toLocalDateTimeInput(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function readJsonResponseSafe(res: Response): Promise<any> {
  const raw = await res.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { error: raw.slice(0, 220) || `HTTP ${res.status}` };
  }
}

interface TableDiag {
  ready: boolean;
  category: string;
  detail: string;
  code?: string;
}

interface GiveawayBackendDiagnostics {
  overallStatus: 'ok' | 'missing_tables' | 'missing_permissions' | 'missing_storage' | 'auth_error' | 'other_db_error';
  migrationFile: string;
  tables: {
    giveaways: TableDiag;
    giveaway_participants: TableDiag;
    giveaway_media: TableDiag;
    giveaway_winners: TableDiag;
    extendedColumnsReady: boolean;
  };
  permissions: {
    ready: boolean;
    serviceRoleConfigured: boolean;
    detail: string;
  };
  storage: {
    ready: boolean;
    bucket: string;
    category: string;
    detail: string;
  };
  auth: {
    ready: boolean;
    detail: string;
  };
  otherError: string | null;
}

const DEFAULT_CROP: ImageCropConfig = { x: 50, y: 50, zoom: 1, aspect: '16:9' };

export const GiveawayBuilderPanel: React.FC<GiveawayBuilderPanelProps> = ({
  lang,
  accessToken,
}) => {
  const t = translations[lang];
  const uploaderRef = useRef<ImageCropUploaderHandle>(null);

  const [giveaways, setGiveaways] = useState<GiveawayItem[]>([]);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<GiveawayBackendDiagnostics | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderStep, setBuilderStep] = useState<'content' | 'media' | 'design' | 'schedule'>('content');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [prize, setPrize] = useState('');
  const [sponsor, setSponsor] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [eligibilityRules, setEligibilityRules] = useState('');
  const [countryRestrictions, setCountryRestrictions] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageCrop, setImageCrop] = useState<ImageCropConfig>(DEFAULT_CROP);
  const [externalUrl, setExternalUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Enter Giveaway');
  const [templateId, setTemplateId] = useState<GiveawayTemplateId>('premium_dark');
  const [styleConfig, setStyleConfig] = useState<GiveawayStyleConfig>(
    GIVEAWAY_TEMPLATES.premium_dark.style
  );
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [saving, setSaving] = useState(false);

  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'active_all' | 'archived'>('active_all');

  const ownerHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken]
  );

  const loadGiveaways = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/owner/giveaways', {
        headers: ownerHeaders,
        credentials: 'include',
      });
      const data = await readJsonResponseSafe(res);
      if (data.diagnostics) {
        setDiagnostics(data.diagnostics);
        if (data.diagnostics.overallStatus !== 'ok') {
          setShowDiagnostics(true);
        }
      }
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error(data.error || 'Owner authentication or permissions error.');
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSchemaMissing(Boolean(data.schemaMissing));
      setGiveaways(Array.isArray(data.giveaways) ? data.giveaways : []);
    } catch (err: any) {
      setError(err?.message || translateApiError(err?.message, lang));
    } finally {
      setLoading(false);
    }
  }, [ownerHeaders, lang]);

  useEffect(() => {
    loadGiveaways();
  }, [loadGiveaways]);

  const startNewBuilder = () => {
    setError(null);
    setStatusMsg(null);
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setPrize('');
    setSponsor('');
    setDescription('');
    setRules('');
    setEligibilityRules('');
    setCountryRestrictions('');
    setMaxParticipants('');
    setImageUrl('');
    setImageCrop(DEFAULT_CROP);
    setExternalUrl('');
    setCtaLabel(lang === 'ar' ? 'المشاركة الآن' : 'Enter Giveaway');
    setTemplateId('premium_dark');
    setStyleConfig(GIVEAWAY_TEMPLATES.premium_dark.style);
    setStartsAt(toLocalDateTimeInput(new Date()));
    setEndsAt(toLocalDateTimeInput(new Date(Date.now() + 7 * 86400000)));
    setPublishAt('');
    setBuilderStep('content');
    setBuilderOpen(true);
  };

  const openEditBuilder = (g: GiveawayItem) => {
    setError(null);
    setStatusMsg(null);
    const tid: GiveawayTemplateId =
      g.design_template && g.design_template in GIVEAWAY_TEMPLATES
        ? g.design_template
        : 'premium_dark';
    setEditingId(g.id);
    setTitle(g.title || '');
    setSubtitle(g.subtitle || '');
    setPrize(g.prize || '');
    setSponsor(g.sponsor || '');
    setDescription(g.description || '');
    setRules(g.rules || '');
    setEligibilityRules(g.eligibility_rules || '');
    setCountryRestrictions(g.country_restrictions || '');
    setMaxParticipants(g.max_participants ? String(g.max_participants) : '');
    setImageUrl(g.image_url || '');
    setImageCrop(g.image_crop || DEFAULT_CROP);
    setExternalUrl(g.external_url || '');
    setCtaLabel(g.cta_label || 'Enter Giveaway');
    setTemplateId(tid);
    setStyleConfig({
      ...GIVEAWAY_TEMPLATES[tid].style,
      ...(g.style_config || {}),
    });
    setStartsAt(g.starts_at ? toLocalDateTimeInput(g.starts_at) : '');
    setEndsAt(g.ends_at ? toLocalDateTimeInput(g.ends_at) : '');
    setPublishAt(g.publish_at ? toLocalDateTimeInput(g.publish_at) : '');
    setBuilderStep('content');
    setBuilderOpen(true);
  };

  const applyTemplatePreset = (tid: GiveawayTemplateId) => {
    setTemplateId(tid);
    setStyleConfig(GIVEAWAY_TEMPLATES[tid].style);
  };

  const submitBuilderAction = async (mode: 'draft' | 'publish' | 'schedule') => {
    if (!title.trim() || !prize.trim() || !endsAt) {
      setError(lang === 'ar' ? 'يرجى إدخال العنوان والجائزة وتاريخ الانتهاء.' : 'Title, prize, and end date are required.');
      return;
    }

    const startIso = startsAt ? new Date(startsAt).toISOString() : new Date().toISOString();
    const endDateObj = new Date(endsAt);
    if (Number.isNaN(endDateObj.getTime()) || endDateObj.getTime() <= Date.parse(startIso)) {
      setError(lang === 'ar' ? 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البداية.' : 'End date must be later than the start date.');
      return;
    }

    if (externalUrl.trim() && !/^https?:\/\//i.test(externalUrl.trim())) {
      setError(lang === 'ar' ? 'يجب أن يبدأ رابط المشاركة الخارجي بـ https:// أو http://.' : 'External URL must start with https:// or http://.');
      return;
    }

    const parsedCap = maxParticipants.trim() ? parseInt(maxParticipants.trim(), 10) : null;
    if (maxParticipants.trim() && (!parsedCap || !Number.isFinite(parsedCap) || parsedCap < 1)) {
      setError(lang === 'ar' ? 'الحد الأقصى للمشاركين يجب أن يكون رقماً موجباً.' : 'Max participants must be a positive integer.');
      return;
    }

    if (mode === 'schedule' && !publishAt) {
      setError(lang === 'ar' ? 'يرجى تحديد موعد النشر المجدول.' : 'Scheduled publish timestamp is required.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMsg(null);

    try {
      // Auto-upload any pending cropped local image first so cover image persists cleanly
      let finalImageUrl = imageUrl.trim();
      if (uploaderRef.current?.hasPendingUpload()) {
        const uploaded = await uploaderRef.current.uploadPendingImage();
        if (uploaded) {
          finalImageUrl = uploaded;
          setImageUrl(uploaded);
        }
      }

      const status =
        mode === 'publish' ? 'active' : mode === 'schedule' ? 'scheduled' : 'draft';
      const isPublished = mode === 'publish' || mode === 'schedule';

      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        prize: prize.trim(),
        sponsor: sponsor.trim(),
        description: description.trim(),
        rules: rules.trim(),
        eligibility_rules: eligibilityRules.trim(),
        country_restrictions: countryRestrictions.trim(),
        max_participants: parsedCap && Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : null,
        image_url: finalImageUrl,
        image_crop: imageCrop,
        external_url: externalUrl.trim(),
        cta_label: ctaLabel.trim() || 'Enter Giveaway',
        design_template: templateId,
        style_config: styleConfig,
        starts_at: startIso,
        ends_at: endDateObj.toISOString(),
        publish_at:
          mode === 'schedule' && publishAt ? new Date(publishAt).toISOString() : null,
        status,
        is_published: isPublished,
        is_archived: false,
      };

      const url = editingId
        ? `/api/owner/giveaways/${encodeURIComponent(editingId)}`
        : '/api/owner/giveaways';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: ownerHeaders,
        body: JSON.stringify(payload),
      });
      const data = await readJsonResponseSafe(res);
      if (!res.ok) {
        throw new Error(data.error || `Failed to save giveaway (HTTP ${res.status})`);
      }

      setBuilderOpen(false);
      setStatusMsg(editingId ? t.giveawayUpdatedMsg : t.giveawayCreatedMsg);
      await loadGiveaways();
    } catch (err: any) {
      setError(err?.message || translateApiError(err?.message, lang));
    } finally {
      setSaving(false);
    }
  };

  const quickPatch = async (id: string, updates: Record<string, any>) => {
    setError(null);
    try {
      const res = await fetch(`/api/owner/giveaways/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: ownerHeaders,
        body: JSON.stringify(updates),
      });
      const data = await readJsonResponseSafe(res);
      if (!res.ok) throw new Error(data.error || `Update failed (HTTP ${res.status})`);
      await loadGiveaways();
    } catch (err: any) {
      setError(err?.message || translateApiError(err?.message, lang));
    }
  };

  const handleDuplicate = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/owner/giveaways/${encodeURIComponent(id)}/duplicate`, {
        method: 'POST',
        credentials: 'include',
        headers: ownerHeaders,
      });
      const data = await readJsonResponseSafe(res);
      if (!res.ok) throw new Error(data.error || `Duplicate failed (HTTP ${res.status})`);
      setStatusMsg(t.giveawayCreatedMsg);
      await loadGiveaways();
    } catch (err: any) {
      setError(err?.message || translateApiError(err?.message, lang));
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/owner/giveaways/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: ownerHeaders,
      });
      if (!res.ok) {
        const d = await readJsonResponseSafe(res);
        throw new Error(d.error || `Delete failed (HTTP ${res.status})`);
      }
      setConfirmDeleteId(null);
      setStatusMsg(t.giveawayDeletedMsg);
      await loadGiveaways();
    } catch (err: any) {
      setError(err?.message || translateApiError(err?.message, lang));
    }
  };

  const handleParticipantStatus = async (
    giveawayId: string,
    participantId: string,
    status: 'approved' | 'rejected' | 'pending'
  ) => {
    try {
      const res = await fetch(
        `/api/owner/giveaways/${encodeURIComponent(giveawayId)}/participants/${encodeURIComponent(participantId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: ownerHeaders,
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) {
        const d = await readJsonResponseSafe(res);
        throw new Error(d.error || `Update failed (HTTP ${res.status})`);
      }
      await loadGiveaways();
    } catch (err: any) {
      setError(err?.message || translateApiError(err?.message, lang));
    }
  };

  const previewItem: GiveawayItem = {
    id: editingId || 'preview',
    title,
    subtitle,
    description,
    prize,
    rules,
    sponsor,
    eligibility_rules: eligibilityRules,
    country_restrictions: countryRestrictions,
    max_participants: maxParticipants.trim() ? parseInt(maxParticipants.trim(), 10) || null : null,
    image_url: imageUrl,
    image_crop: imageCrop,
    external_url: externalUrl,
    cta_label: ctaLabel,
    design_template: templateId,
    style_config: styleConfig,
    status: 'active',
    is_published: true,
    starts_at: startsAt || new Date().toISOString(),
    ends_at: endsAt || new Date(Date.now() + 7 * 86400000).toISOString(),
  };

  const visibleList = giveaways.filter((g) =>
    filterMode === 'archived'
      ? Boolean(g.is_archived || g.status === 'archived')
      : !g.is_archived && g.status !== 'archived'
  );

  const inspectingGiveaway = giveaways.find((g) => g.id === inspectingId) || null;

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/10">
          <button
            type="button"
            onClick={() => setFilterMode('active_all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterMode === 'active_all'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500'
            }`}
          >
            {t.giveawaysTitle}
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('archived')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterMode === 'archived'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500'
            }`}
          >
            {t.statusArchived}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDiagnostics((v) => !v)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              diagnostics && diagnostics.overallStatus !== 'ok'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-black/10 dark:border-white/10 bg-white dark:bg-[#121214] text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{t.giveawayDiagnosticsTitle}</span>
          </button>

          <button
            type="button"
            onClick={startNewBuilder}
            data-testid="add-giveaway-btn"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t.newGiveawayBtn}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="font-semibold">{error}</div>
          </div>
          <button type="button" onClick={() => setError(null)} aria-label={t.closeBtn}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Granular 5-Category Backend Diagnostic Panel */}
      {(showDiagnostics || schemaMissing) && diagnostics && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-amber-500/30 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-zinc-900 dark:text-white">
                {t.giveawayDiagnosticsTitle} —{' '}
                <span className="font-mono uppercase">{diagnostics.overallStatus}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={loadGiveaways}
              disabled={loading}
              className="px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{t.refreshBtn}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {[
              {
                label: t.diagTablesLabel,
                ok: diagnostics.tables.giveaways.ready && diagnostics.tables.giveaway_participants.ready && diagnostics.tables.giveaway_media.ready && diagnostics.tables.giveaway_winners.ready,
                detail: [
                  `giveaways: ${diagnostics.tables.giveaways.ready ? 'OK' : diagnostics.tables.giveaways.code || diagnostics.tables.giveaways.category}`,
                  `participants: ${diagnostics.tables.giveaway_participants.ready ? 'OK' : diagnostics.tables.giveaway_participants.code || 'missing'}`,
                  `media: ${diagnostics.tables.giveaway_media.ready ? 'OK' : diagnostics.tables.giveaway_media.code || 'missing'}`,
                  `winners: ${diagnostics.tables.giveaway_winners.ready ? 'OK' : diagnostics.tables.giveaway_winners.code || 'missing'}`,
                ].join(' | '),
                icon: Database,
              },
              {
                label: t.diagPermissionsLabel,
                ok: diagnostics.permissions.ready,
                detail: diagnostics.permissions.detail,
                icon: ShieldCheck,
              },
              {
                label: t.diagStorageLabel,
                ok: diagnostics.storage.ready,
                detail: diagnostics.storage.detail,
                icon: HardDrive,
              },
              {
                label: t.diagAuthLabel,
                ok: diagnostics.auth.ready,
                detail: diagnostics.auth.detail,
                icon: ShieldCheck,
              },
              {
                label: t.diagOtherDbLabel,
                ok: !diagnostics.otherError,
                detail: diagnostics.otherError || 'No unexpected database errors',
                icon: AlertCircle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`p-3 rounded-xl border ${
                    item.ok
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-rose-500/25 bg-rose-500/5'
                  } space-y-1`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        item.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                      }`}
                    >
                      {item.ok ? 'OK' : 'FAIL'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 break-words leading-snug" dir="ltr">
                    {item.detail}
                  </p>
                </div>
              );
            })}
          </div>

          {diagnostics.overallStatus !== 'ok' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
              <p className="font-semibold">{t.diagSqlActionPrompt}</p>
              <p className="font-mono font-bold" dir="ltr">
                {diagnostics.migrationFile}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Visual Giveaway Builder Workbench (Split Editor + Live Card Preview) */}
      {builderOpen && (
        <div className="rounded-2xl bg-white dark:bg-[#121214] border border-black/10 dark:border-white/15 p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              {editingId ? t.editGiveawayTitle : t.createGiveawayTitle}
            </h3>
            <button
              type="button"
              onClick={() => setBuilderOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              aria-label={t.closeBtn}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Step Editor */}
            <div className="lg:col-span-7 space-y-4">
              {/* Step Selector */}
              <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5">
                {[
                  { id: 'content', label: t.builderTabContent },
                  { id: 'media', label: t.builderTabMedia },
                  { id: 'design', label: t.builderTabDesign },
                  { id: 'schedule', label: t.builderTabSchedule },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setBuilderStep(s.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      builderStep === s.id
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {builderStep === 'content' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        {t.fieldTitleRequired}
                      </label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        {t.fieldPrizeRequired}
                      </label>
                      <input
                        value={prize}
                        onChange={(e) => setPrize(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        {t.fieldSubtitle}
                      </label>
                      <input
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        {t.giveawaySponsorLabel}
                      </label>
                      <input
                        value={sponsor}
                        onChange={(e) => setSponsor(e.target.value)}
                        placeholder="YOUNEEL TRADING"
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">
                      {t.fieldDescription}
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">
                      {t.fieldRules}
                    </label>
                    <textarea
                      rows={3}
                      value={rules}
                      onChange={(e) => setRules(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        {t.giveawayEligibilityLabel}
                      </label>
                      <input
                        value={eligibilityRules}
                        onChange={(e) => setEligibilityRules(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        {t.giveawayCountryRestrictionsLabel}
                      </label>
                      <input
                        value={countryRestrictions}
                        onChange={(e) => setCountryRestrictions(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        {t.giveawayMaxParticipantsLabel}
                      </label>
                      <input
                        type="number"
                        min={1}
                        dir="ltr"
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(e.target.value)}
                        placeholder="∞"
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        {t.fieldCtaLabel}
                      </label>
                      <input
                        value={ctaLabel}
                        onChange={(e) => setCtaLabel(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-500 mb-1">
                        {t.fieldExternalUrl}
                      </label>
                      <input
                        type="url"
                        dir="ltr"
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className={builderStep === 'media' ? 'block' : 'hidden'}>
                <ImageCropUploader
                  ref={uploaderRef}
                  lang={lang}
                  bucket="giveaway-media"
                  imageUrl={imageUrl}
                  crop={imageCrop}
                  accessToken={accessToken}
                  onChangeImageUrl={setImageUrl}
                  onChangeCrop={setImageCrop}
                />
              </div>

              {builderStep === 'design' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                      {t.designTemplateLabel}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.values(GIVEAWAY_TEMPLATES).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyTemplatePreset(preset.id)}
                          className={`p-3 rounded-xl border text-start transition-all ${
                            templateId === preset.id
                              ? 'border-emerald-500 ring-1 ring-emerald-500'
                              : 'border-black/10 dark:border-white/10 hover:border-white/25'
                          }`}
                          style={{
                            background: preset.gradientBackdrop || preset.style.bgColor,
                            color: preset.style.textColor,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold">
                              {lang === 'ar' ? preset.nameAr : preset.nameEn}
                            </span>
                            <span
                              className="w-3 h-3 rounded-sm shrink-0"
                              style={{ backgroundColor: preset.style.accentColor }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Customizers */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {[
                      { key: 'bgColor', label: t.colorBgLabel },
                      { key: 'surfaceColor', label: t.colorSurfaceLabel },
                      { key: 'accentColor', label: t.colorAccentLabel },
                      { key: 'textColor', label: t.colorTextLabel },
                    ].map((c) => (
                      <label key={c.key} className="block text-xs space-y-1">
                        <span className="text-zinc-500 block">{c.label}</span>
                        <div className="flex items-center gap-2 p-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900">
                          <input
                            type="color"
                            value={(styleConfig as any)[c.key]}
                            onChange={(e) => {
                              setTemplateId('custom');
                              setStyleConfig({ ...styleConfig, [c.key]: e.target.value });
                            }}
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                          />
                          <span className="font-mono text-[11px] uppercase" dir="ltr">
                            {(styleConfig as any)[c.key]}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Typography & Corner Radius */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">
                        {t.fontPresetLabel}
                      </label>
                      <select
                        value={styleConfig.fontPreset}
                        onChange={(e) =>
                          setStyleConfig({
                            ...styleConfig,
                            fontPreset: e.target.value as GiveawayFontId,
                          })
                        }
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      >
                        <option value="sans_modern">{t.fontSansLabel}</option>
                        <option value="editorial_serif">{t.fontSerifLabel}</option>
                        <option value="condensed_display">{t.fontCondensedLabel}</option>
                        <option value="arabic_ibm">{t.fontArabicLabel}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">
                        {t.cornerRadiusLabel}
                      </label>
                      <select
                        value={styleConfig.borderRadius}
                        onChange={(e) =>
                          setStyleConfig({
                            ...styleConfig,
                            borderRadius: e.target.value as GiveawayStyleConfig['borderRadius'],
                          })
                        }
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      >
                        <option value="md">Compact (8px)</option>
                        <option value="xl">Medium (12px)</option>
                        <option value="2xl">Large (16px)</option>
                        <option value="3xl">Editorial (24px)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {builderStep === 'schedule' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">{t.fieldStartsAt}</label>
                      <input
                        type="datetime-local"
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">{t.fieldEndsAtRequired}</label>
                      <input
                        type="datetime-local"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">{t.fieldPublishAt}</label>
                    <input
                      type="datetime-local"
                      value={publishAt}
                      onChange={(e) => setPublishAt(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-zinc-50 dark:bg-zinc-900 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Builder Publish Action Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-black/5 dark:border-white/10">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitBuilderAction('draft')}
                  className="px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{t.saveDraftBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={saving || !publishAt}
                  onClick={() => submitBuilderAction('schedule')}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t.scheduleBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitBuilderAction('publish')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{saving ? t.savingLabel : t.publishNowBtn}</span>
                </button>
              </div>
            </div>

            {/* Right: Live Styled Preview */}
            <div className="lg:col-span-5 space-y-2">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {t.builderLivePreview}
              </div>
              <GiveawayStyledCard item={previewItem} lang={lang} isPreview />
            </div>
          </div>
        </div>
      )}

      {/* Existing Giveaways Management List */}
      {!schemaMissing && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400">{t.loadingGiveaways}</div>
          ) : visibleList.length === 0 ? (
            <div className="py-14 text-center rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 text-xs text-zinc-500">
              {t.noGiveawaysCreated}
            </div>
          ) : (
            visibleList.map((g) => {
              const count = g.participants?.length || 0;
              return (
                <div
                  key={g.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#121214] border border-black/5 dark:border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-base text-zinc-950 dark:text-white">
                        {g.title}
                      </span>
                      <span aria-hidden="true" className="text-zinc-400">·</span>
                      <span
                        className={`font-bold uppercase ${
                          g.status === 'active'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : g.status === 'paused'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-zinc-500'
                        }`}
                      >
                        {g.status}
                      </span>
                      <span aria-hidden="true" className="text-zinc-400">·</span>
                      <span className="text-zinc-500">
                        {g.is_published ? t.publishedTag : t.unpublishedTag}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {t.prizePool}: <strong className="text-zinc-800 dark:text-zinc-200">{g.prize}</strong> ·{' '}
                      {t.endsPrefix} {new Date(g.ends_at).toLocaleDateString()} · {t.entriesPrefix} {count}
                    </p>
                    {g.winner_display_name && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        {t.winnerAnnouncedPrefix} {g.winner_display_name}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInspectingId(g.id)}
                      className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{t.participantsBtn} ({count})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditBuilder(g)}
                      className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{t.editLabel}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicate(g.id)}
                      className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t.duplicateBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => quickPatch(g.id, { is_published: !g.is_published })}
                      className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold flex items-center gap-1.5"
                    >
                      {g.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{g.is_published ? t.unpublishBtn : t.publishBtn}</span>
                    </button>

                    {g.status === 'active' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => quickPatch(g.id, { status: 'paused', is_published: false })}
                          className="px-3 py-1.5 rounded-lg bg-amber-600/15 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>{t.pauseBtn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => quickPatch(g.id, { status: 'completed', is_published: true })}
                          className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold"
                        >
                          {t.markCompletedBtn}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => quickPatch(g.id, { status: 'active', is_published: true, is_archived: false })}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                      >
                        {t.startBtn}
                      </button>
                    )}

                    {g.is_archived ? (
                      <button
                        type="button"
                        onClick={() => quickPatch(g.id, { is_archived: false, status: 'draft' })}
                        className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-semibold"
                      >
                        {t.unarchiveBtn}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => quickPatch(g.id, { status: 'archived', is_archived: true, is_published: false })}
                        className="p-2 rounded-lg bg-black/5 dark:bg-white/10 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        title={t.archiveBtn}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {confirmDeleteId === g.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelete(g.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                        >
                          {t.confirmBtn}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-xs"
                        >
                          {t.cancelBtn}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(g.id)}
                        className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        title={t.deleteLabel}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Participants & Winner Selection Modal */}
      {inspectingGiveaway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#18181b] rounded-2xl p-6 shadow-2xl border border-black/10 dark:border-white/10 max-h-[85vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setInspectingId(null)}
              aria-label={t.closeBtn}
              className="absolute top-4 end-4 p-2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold">
              {t.participantsModalHeading} — {inspectingGiveaway.title}
            </h3>
            {!inspectingGiveaway.participants || inspectingGiveaway.participants.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-400">{t.noEntriesSubmittedYet}</p>
            ) : (
              <div className="space-y-2">
                {inspectingGiveaway.participants.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-black/5 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <span>{p.display_name || p.user_email}</span>
                        <span className="text-[10px] uppercase text-zinc-500">{p.status}</span>
                      </div>
                      <p className="text-zinc-500 text-[11px]" dir="ltr">
                        {p.user_email}
                      </p>
                      {p.entry_note && (
                        <p className="text-zinc-600 dark:text-zinc-300 mt-1">{p.entry_note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleParticipantStatus(inspectingGiveaway.id, p.id, 'approved')
                        }
                        className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        title={t.approveTitle}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleParticipantStatus(inspectingGiveaway.id, p.id, 'rejected')
                        }
                        className="p-1.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400"
                        title={t.rejectTitle}
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          quickPatch(inspectingGiveaway.id, {
                            winner_participant_id: p.id,
                            is_published: true,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold flex items-center gap-1"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>{t.selectWinnerBtn}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
