-- ============================================================================
-- YOUNEEL TRADING: Fundamental Analysis System (CPI, FOMC, PPI, NFP)
-- Migration 005 — Idempotent, non-destructive.
-- Preserves all existing profiles, trades, giveaways, competitions, and inquiries.
-- ============================================================================

-- 1. Canonical US Macro Economic Events (CPI, FOMC, PPI, NFP)
CREATE TABLE IF NOT EXISTS public.fundamental_events (
  id text PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('CPI', 'FOMC', 'PPI', 'NFP')),
  title text NOT NULL,
  reference_period text NOT NULL DEFAULT '',
  scheduled_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  importance text NOT NULL DEFAULT 'HIGH' CHECK (importance IN ('HIGH', 'MEDIUM', 'LOW')),
  status text NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'RELEASED', 'ANALYSIS_UPDATED', 'DATA_UNAVAILABLE')),
  actual_summary text NULL,
  forecast_summary text NULL,
  previous_summary text NULL,
  revision_summary text NULL,
  official_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_freshness text NOT NULL DEFAULT 'LIVE' CHECK (data_freshness IN ('LIVE', 'DELAYED', 'DATA_UNAVAILABLE')),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fundamental_events_type_scheduled
  ON public.fundamental_events (event_type, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_fundamental_events_status
  ON public.fundamental_events (status, scheduled_at DESC);

-- 2. Immutable Two-Stage Analysis Snapshots (BEFORE_RELEASE preserved when AFTER_RELEASE runs)
CREATE TABLE IF NOT EXISTS public.fundamental_analysis_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL REFERENCES public.fundamental_events(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('BEFORE_RELEASE', 'AFTER_RELEASE')),
  event_type text NOT NULL CHECK (event_type IN ('CPI', 'FOMC', 'PPI', 'NFP')),
  headline_assessment text NOT NULL,
  policy_implication text NOT NULL,
  signal_classification text NOT NULL DEFAULT 'NEUTRAL' CHECK (signal_classification IN ('HAWKISH', 'DOVISH', 'NEUTRAL', 'MIXED', 'INSUFFICIENT_EVIDENCE')),
  report_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  asset_impacts jsonb NOT NULL DEFAULT '{}'::jsonb,
  post_release_reaction jsonb NULL,
  research_attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_interpretation jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_fundamental_versions_event_stage
  ON public.fundamental_analysis_versions (event_id, stage, created_at DESC);

-- 3. Synchronization & Error Audit Logs for Owner Studio
CREATE TABLE IF NOT EXISTS public.fundamental_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  event_type text NULL,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  error_message text NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fundamental_sync_logs_executed
  ON public.fundamental_sync_logs (executed_at DESC);

-- 4. Updated_at trigger
DROP TRIGGER IF EXISTS trg_fundamental_events_updated_at ON public.fundamental_events;
CREATE TRIGGER trg_fundamental_events_updated_at
  BEFORE UPDATE ON public.fundamental_events
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- 5. Strict Row Level Security (Public read-only, Owner write/manage)
ALTER TABLE public.fundamental_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundamental_analysis_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundamental_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads fundamental events" ON public.fundamental_events;
CREATE POLICY "Public reads fundamental events"
  ON public.fundamental_events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner manages fundamental events" ON public.fundamental_events;
CREATE POLICY "Owner manages fundamental events"
  ON public.fundamental_events FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

DROP POLICY IF EXISTS "Public reads fundamental analysis versions" ON public.fundamental_analysis_versions;
CREATE POLICY "Public reads fundamental analysis versions"
  ON public.fundamental_analysis_versions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner manages fundamental analysis versions" ON public.fundamental_analysis_versions;
CREATE POLICY "Owner manages fundamental analysis versions"
  ON public.fundamental_analysis_versions FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

DROP POLICY IF EXISTS "Owner manages fundamental sync logs" ON public.fundamental_sync_logs;
CREATE POLICY "Owner manages fundamental sync logs"
  ON public.fundamental_sync_logs FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

NOTIFY pgrst, 'reload schema';
