-- YOUNEEL TRADING: Security Hardening & Supabase Giveaways Schema
-- Run this script in your Supabase Project SQL Editor:
-- https://supabase.com/dashboard/project/xhqvlqygqvyniuiqjjzx/sql

-- 1. Extend profiles with optional role column (default 'trader')
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'trader';

-- Assign admin role to primary administrator email (update if needed)
-- UPDATE public.profiles SET role = 'admin' WHERE id IN (SELECT id FROM auth.users WHERE email = 'luca666lu@gmail.com');

-- 2. Extend trades with protected accounting columns (commission, swap)
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS commission numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS swap numeric(14, 2) NOT NULL DEFAULT 0;

-- 3. Harden trades RLS: Users can ONLY read their own trades.
-- Direct browser INSERT/UPDATE on protected financial fields is blocked unless performed by service_role.
DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can update own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can select own trades" ON public.trades;
DROP POLICY IF EXISTS "Users can delete own trades" ON public.trades;

CREATE POLICY "Users can select own trades"
  ON public.trades FOR SELECT
  USING (auth.uid() = user_id);

-- Only allow deletion during full account erasure
CREATE POLICY "Users can delete own trades"
  ON public.trades FOR DELETE
  USING (auth.uid() = user_id);

-- Prevent direct browser manipulation of protected financial fields via trigger
CREATE OR REPLACE FUNCTION public.protect_trade_financial_fields()
RETURNS trigger AS $$
BEGIN
  -- Allow server service_role / postgres superuser full authority
  IF current_setting('role', true) = 'service_role' OR current_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  -- Block direct browser mutations on protected fields
  IF TG_OP = 'UPDATE' THEN
    IF NEW.entry IS DISTINCT FROM OLD.entry
      OR NEW.exit_price IS DISTINCT FROM OLD.exit_price
      OR NEW.pnl IS DISTINCT FROM OLD.pnl
      OR NEW.commission IS DISTINCT FROM OLD.commission
      OR NEW.swap IS DISTINCT FROM OLD.swap
      OR NEW.lot IS DISTINCT FROM OLD.lot
      OR NEW.capital_at_open IS DISTINCT FROM OLD.capital_at_open
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.close_reason IS DISTINCT FROM OLD.close_reason
    THEN
      RAISE EXCEPTION 'Protected financial fields can only be modified by the execution server.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_trade_fields ON public.trades;
CREATE TRIGGER trg_protect_trade_fields
  BEFORE UPDATE ON public.trades
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_trade_financial_fields();

-- 4. Giveaways Table
CREATE TABLE IF NOT EXISTS public.giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  prize text NOT NULL,
  rules text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'ended')),
  is_published boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  winner_participant_id uuid NULL,
  winner_display_name text NULL,
  winner_announced_at timestamptz NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Giveaway Participants Table
CREATE TABLE IF NOT EXISTS public.giveaway_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id uuid NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  entry_note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'winner')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (giveaway_id, user_id)
);

-- 6. Foreign Key from winner_participant_id -> giveaway_participants(id) (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_giveaways_winner_participant'
  ) THEN
    ALTER TABLE public.giveaways
      ADD CONSTRAINT fk_giveaways_winner_participant
      FOREIGN KEY (winner_participant_id)
      REFERENCES public.giveaway_participants(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_giveaways_published_status_created
  ON public.giveaways (is_published, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_giveaways_ends_at
  ON public.giveaways (ends_at DESC);

CREATE INDEX IF NOT EXISTS idx_giveaway_participants_giveaway_status
  ON public.giveaway_participants (giveaway_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_giveaway_participants_user_id
  ON public.giveaway_participants (user_id);

-- 8. Auto-update updated_at on giveaways
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_giveaways_updated_at ON public.giveaways;
CREATE TRIGGER trg_giveaways_updated_at
  BEFORE UPDATE ON public.giveaways
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Enable RLS
ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_participants ENABLE ROW LEVEL SECURITY;

-- Helper admin check function
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN (
    (auth.jwt() ->> 'email') = 'luca666lu@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent non-service-role users from self-escalating profiles.role
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR current_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'trader' THEN
    NEW.role := 'trader';
  ELSIF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- Giveaways Policies
DROP POLICY IF EXISTS "Public can view published giveaways" ON public.giveaways;
CREATE POLICY "Public can view published giveaways"
  ON public.giveaways FOR SELECT
  USING (is_published = true OR public.is_admin_user());

DROP POLICY IF EXISTS "Admins manage giveaways" ON public.giveaways;
CREATE POLICY "Admins manage giveaways"
  ON public.giveaways FOR ALL
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Giveaway Participants Policies
DROP POLICY IF EXISTS "Users view own entries and admins view all" ON public.giveaway_participants;
CREATE POLICY "Users view own entries and admins view all"
  ON public.giveaway_participants FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_user());

DROP POLICY IF EXISTS "Users can enter active published giveaways" ON public.giveaway_participants;
CREATE POLICY "Users can enter active published giveaways"
  ON public.giveaway_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.giveaways g
      WHERE g.id = giveaway_id
        AND g.is_published = true
        AND g.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins manage giveaway participants" ON public.giveaway_participants;
CREATE POLICY "Admins manage giveaway participants"
  ON public.giveaway_participants FOR UPDATE
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins delete giveaway participants" ON public.giveaway_participants;
CREATE POLICY "Admins delete giveaway participants"
  ON public.giveaway_participants FOR DELETE
  USING (public.is_admin_user());
