-- YOUNEEL TRADING: Complete Platform Schema Extension (Migration 003)
-- Idempotent, non-destructive migration (preserves all existing data, policies, triggers, and users).
-- Run in Supabase Project SQL Editor: https://supabase.com/dashboard/project/xhqvlqygqvyniuiqjjzx/sql

-- ============================================================================
-- 1. EXTEND GIVEAWAYS WITH SPONSOR, ELIGIBILITY, COUNTRY RESTRICTIONS, MAX CAPACITY & COMPLETED STATUS
-- ============================================================================
ALTER TABLE public.giveaways
  ADD COLUMN IF NOT EXISTS sponsor text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS eligibility_rules text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country_restrictions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_participants integer NULL;

ALTER TABLE public.giveaways DROP CONSTRAINT IF EXISTS giveaways_status_check;
ALTER TABLE public.giveaways
  ADD CONSTRAINT giveaways_status_check
  CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'ended', 'completed', 'archived'));

-- ============================================================================
-- 2. EXTEND TRADES WITH STRUCTURED JOURNAL METADATA + SAFE USER UPDATE POLICY
-- ============================================================================
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS strategy text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS entry_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS exit_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS emotions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mistakes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS screenshot_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_trades_user_opened_at
  ON public.trades (user_id, opened_at DESC);

-- Financial fields (entry, exit_price, pnl, commission, swap, lot, capital_at_open, status, close_reason)
-- remain strictly locked by trg_protect_trade_fields (Migration 001).
-- This policy enables users to edit journal metadata (strategy, notes, reasons, emotions, mistakes, screenshots).
DROP POLICY IF EXISTS "Users update own trade journal metadata" ON public.trades;
CREATE POLICY "Users update own trade journal metadata"
  ON public.trades FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. CONTACT INQUIRIES TABLE (SERVER-VALIDATED CONTACT SUBMISSIONS + OWNER INBOX)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  ip_hash text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_inquiries_created
  ON public.contact_inquiries (created_at DESC);

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Strict privacy: only the verified platform owner can view or manage inquiries;
-- public submissions go through server-side validated /api/contact with rate limiting & honeypot checks.
DROP POLICY IF EXISTS "Owner views and manages contact inquiries" ON public.contact_inquiries;
CREATE POLICY "Owner views and manages contact inquiries"
  ON public.contact_inquiries FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

-- ============================================================================
-- 4. PROFILE INDEX FOR OWNER MANAGEMENT VIEW
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles (role);
