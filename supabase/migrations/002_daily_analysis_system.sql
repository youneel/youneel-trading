-- YOUNEEL TRADING: Daily Market Analysis Snapshots, Intraday Updates & Scheduler Logs
-- Run this script in your Supabase Project SQL Editor:
-- https://supabase.com/dashboard/project/xhqvlqygqvyniuiqjjzx/sql

CREATE TABLE IF NOT EXISTS public.daily_market_analyses (
  id text PRIMARY KEY,
  symbol text NOT NULL,
  trading_date date NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  analysis_timestamp timestamptz NOT NULL DEFAULT now(),
  model_version text NOT NULL DEFAULT 'YOUNEEL-QUANT-v2.0',
  reference_price numeric(18, 6) NOT NULL,
  daily_bias text NOT NULL,
  directional_alignment_score integer NOT NULL DEFAULT 0,
  data_quality_status text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (symbol, trading_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_analyses_date_symbol
  ON public.daily_market_analyses (trading_date DESC, symbol);

CREATE TABLE IF NOT EXISTS public.intraday_analysis_updates (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES public.daily_market_analyses(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  trading_date date NOT NULL,
  update_timestamp timestamptz NOT NULL DEFAULT now(),
  current_price numeric(18, 6) NOT NULL,
  validity_status text NOT NULL CHECK (validity_status IN ('VALID', 'WEAKENING', 'INVALIDATED')),
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intraday_updates_snapshot
  ON public.intraday_analysis_updates (snapshot_id, update_timestamp DESC);

CREATE TABLE IF NOT EXISTS public.analysis_scheduler_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  symbol text NOT NULL,
  trading_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'retrying', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 1,
  error_message text NULL,
  executed_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS: public read-only access for verified published analyses, server service_role writes
ALTER TABLE public.daily_market_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intraday_analysis_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_scheduler_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read daily analyses" ON public.daily_market_analyses;
CREATE POLICY "Public read daily analyses"
  ON public.daily_market_analyses FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read intraday updates" ON public.intraday_analysis_updates;
CREATE POLICY "Public read intraday updates"
  ON public.intraday_analysis_updates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins read scheduler jobs" ON public.analysis_scheduler_jobs;
CREATE POLICY "Admins read scheduler jobs"
  ON public.analysis_scheduler_jobs FOR SELECT
  USING (public.is_admin_user());
