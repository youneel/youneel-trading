-- ============================================================================
-- YOUNEEL TRADING: Unified Idempotent Migration 006
-- Complete Owner Mode Auth Persistence + YOUNEEL GIVEAWAYS + Storage RLS
--
-- SAFE & NON-DESTRUCTIVE:
--   - Does NOT drop tables, truncate records, delete user/trade/giveaway data,
--     or disable Row Level Security on any table.
--   - Safe to run standalone OR on top of migrations 001..005.
--
-- Execute in Supabase Project SQL Editor:
--   https://supabase.com/dashboard/project/xhqvlqygqvyniuiqjjzx/sql
-- ============================================================================

-- ============================================================================
-- 1. OWNER PROFILE ROLE PROTECTION & OWNERSHIP ASSIGNMENT
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'trader';

CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles (role);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

UPDATE public.profiles
SET role = 'owner'
WHERE id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'younesselidrissi64@gmail.com'
);

CREATE OR REPLACE FUNCTION public.is_owner_user()
RETURNS boolean AS $$
BEGIN
  RETURN (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'younesselidrissi64@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. OWNER 2FA VERIFICATION CODES, CROSS-INSTANCE SESSIONS & AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.owner_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz NULL,
  expires_at timestamptz NOT NULL,
  requested_ip text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_codes_email_created
  ON public.owner_verification_codes (lower(owner_email), created_at DESC);

CREATE TABLE IF NOT EXISTS public.owner_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_email text NOT NULL,
  session_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  ip_address text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_sessions_expires
  ON public.owner_sessions (expires_at DESC);

CREATE TABLE IF NOT EXISTS public.owner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_email text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL DEFAULT '',
  resource_id text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_audit_created
  ON public.owner_audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.owner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('competition_discovered', 'competition_updated', 'source_unavailable', 'giveaway_winner', 'security')),
  title text NOT NULL,
  message text NOT NULL,
  link_url text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_notifications_unread
  ON public.owner_notifications (is_read, created_at DESC);

ALTER TABLE public.owner_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner views own audit logs" ON public.owner_audit_logs;
CREATE POLICY "Owner views own audit logs"
  ON public.owner_audit_logs FOR SELECT
  USING (public.is_owner_user());

DROP POLICY IF EXISTS "Owner views notifications" ON public.owner_notifications;
CREATE POLICY "Owner views notifications"
  ON public.owner_notifications FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

-- ============================================================================
-- 3. YOUNEEL GIVEAWAYS CORE TABLES & COLUMNS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  prize text NOT NULL,
  rules text NOT NULL DEFAULT '',
  sponsor text NOT NULL DEFAULT '',
  eligibility_rules text NOT NULL DEFAULT '',
  country_restrictions text NOT NULL DEFAULT '',
  max_participants integer NULL CHECK (max_participants IS NULL OR max_participants >= 1),
  image_url text NOT NULL DEFAULT '',
  image_crop jsonb NOT NULL DEFAULT '{"x":50,"y":50,"zoom":1,"aspect":"16:9"}'::jsonb,
  external_url text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT 'Enter Giveaway',
  design_template text NOT NULL DEFAULT 'premium_dark',
  style_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  is_published boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  publish_at timestamptz NULL,
  paused_at timestamptz NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  winner_participant_id uuid NULL,
  winner_display_name text NULL,
  winner_announced_at timestamptz NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Upgrade existing public.giveaways idempotently if created from an earlier migration
ALTER TABLE public.giveaways
  ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rules text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sponsor text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS eligibility_rules text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country_restrictions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_participants integer NULL,
  ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_crop jsonb NOT NULL DEFAULT '{"x":50,"y":50,"zoom":1,"aspect":"16:9"}'::jsonb,
  ADD COLUMN IF NOT EXISTS external_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_label text NOT NULL DEFAULT 'Enter Giveaway',
  ADD COLUMN IF NOT EXISTS design_template text NOT NULL DEFAULT 'premium_dark',
  ADD COLUMN IF NOT EXISTS style_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS winner_participant_id uuid NULL,
  ADD COLUMN IF NOT EXISTS winner_display_name text NULL,
  ADD COLUMN IF NOT EXISTS winner_announced_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.giveaways DROP CONSTRAINT IF EXISTS giveaways_status_check;
ALTER TABLE public.giveaways
  ADD CONSTRAINT giveaways_status_check
  CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'ended', 'completed', 'archived'));

ALTER TABLE public.giveaways DROP CONSTRAINT IF EXISTS giveaways_max_participants_check;
ALTER TABLE public.giveaways
  ADD CONSTRAINT giveaways_max_participants_check
  CHECK (max_participants IS NULL OR max_participants >= 1);

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

CREATE TABLE IF NOT EXISTS public.giveaway_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id uuid REFERENCES public.giveaways(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'giveaway-media',
  storage_path text NOT NULL,
  public_url text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  width integer NULL,
  height integer NULL,
  crop_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.giveaway_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id uuid NOT NULL REFERENCES public.giveaways(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.giveaway_participants(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  prize_awarded text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  announced_at timestamptz NOT NULL DEFAULT now(),
  selected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (giveaway_id, participant_id)
);

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

-- ============================================================================
-- 4. INDEXES & UPDATED_AT TRIGGER
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_giveaways_published_status_created
  ON public.giveaways (is_published, is_archived, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_giveaways_ends_at
  ON public.giveaways (ends_at DESC);

CREATE INDEX IF NOT EXISTS idx_giveaway_participants_giveaway_status
  ON public.giveaway_participants (giveaway_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_giveaway_participants_user_id
  ON public.giveaway_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_giveaway_media_giveaway_id
  ON public.giveaway_media (giveaway_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_giveaway_winners_giveaway_id
  ON public.giveaway_winners (giveaway_id, announced_at DESC);

DROP TRIGGER IF EXISTS trg_giveaways_updated_at ON public.giveaways;
CREATE TRIGGER trg_giveaways_updated_at
  BEFORE UPDATE ON public.giveaways
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================================
-- 5. ENTRY ELIGIBILITY HELPER & ROW LEVEL SECURITY POLICIES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_giveaway_open_for_entry(p_giveaway_id uuid)
RETURNS boolean AS $$
DECLARE
  v_max integer;
  v_count integer;
  v_open boolean;
BEGIN
  SELECT
    (
      g.is_published = true
      AND g.is_archived = false
      AND g.status = 'active'
      AND (g.publish_at IS NULL OR g.publish_at <= now())
      AND g.starts_at <= now()
      AND g.ends_at >= now()
    ),
    g.max_participants
  INTO v_open, v_max
  FROM public.giveaways g
  WHERE g.id = p_giveaway_id;

  IF NOT coalesce(v_open, false) THEN
    RETURN false;
  END IF;

  IF v_max IS NOT NULL AND v_max > 0 THEN
    SELECT count(*) INTO v_count
    FROM public.giveaway_participants gp
    WHERE gp.giveaway_id = p_giveaway_id;

    IF v_count >= v_max THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_winners ENABLE ROW LEVEL SECURITY;

-- Public reads ONLY published, non-archived giveaways whose publish_at has arrived; owner reads all
DROP POLICY IF EXISTS "Public can view published giveaways" ON public.giveaways;
CREATE POLICY "Public can view published giveaways"
  ON public.giveaways FOR SELECT
  USING (
    (is_published = true AND is_archived = false AND (publish_at IS NULL OR publish_at <= now()))
    OR public.is_owner_user()
  );

DROP POLICY IF EXISTS "Admins manage giveaways" ON public.giveaways;
DROP POLICY IF EXISTS "Owner manages giveaways" ON public.giveaways;
DROP POLICY IF EXISTS "Owner inserts giveaways" ON public.giveaways;
DROP POLICY IF EXISTS "Owner updates giveaways" ON public.giveaways;
DROP POLICY IF EXISTS "Owner deletes giveaways" ON public.giveaways;

CREATE POLICY "Owner inserts giveaways"
  ON public.giveaways FOR INSERT
  WITH CHECK (public.is_owner_user());

CREATE POLICY "Owner updates giveaways"
  ON public.giveaways FOR UPDATE
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

CREATE POLICY "Owner deletes giveaways"
  ON public.giveaways FOR DELETE
  USING (public.is_owner_user());

-- Giveaway Media Policies
DROP POLICY IF EXISTS "Public views giveaway media" ON public.giveaway_media;
CREATE POLICY "Public views giveaway media"
  ON public.giveaway_media FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner manages giveaway media" ON public.giveaway_media;
CREATE POLICY "Owner manages giveaway media"
  ON public.giveaway_media FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

-- Giveaway Participants Policies
DROP POLICY IF EXISTS "Users view own entries and admins view all" ON public.giveaway_participants;
DROP POLICY IF EXISTS "Users view own entries and owner views all" ON public.giveaway_participants;
CREATE POLICY "Users view own entries and owner views all"
  ON public.giveaway_participants FOR SELECT
  USING (auth.uid() = user_id OR public.is_owner_user());

DROP POLICY IF EXISTS "Users can enter active published giveaways" ON public.giveaway_participants;
CREATE POLICY "Users can enter active published giveaways"
  ON public.giveaway_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_giveaway_open_for_entry(giveaway_id)
  );

DROP POLICY IF EXISTS "Admins manage giveaway participants" ON public.giveaway_participants;
DROP POLICY IF EXISTS "Owner updates giveaway participants" ON public.giveaway_participants;
CREATE POLICY "Owner updates giveaway participants"
  ON public.giveaway_participants FOR UPDATE
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

DROP POLICY IF EXISTS "Admins delete giveaway participants" ON public.giveaway_participants;
DROP POLICY IF EXISTS "Owner deletes giveaway participants" ON public.giveaway_participants;
CREATE POLICY "Owner deletes giveaway participants"
  ON public.giveaway_participants FOR DELETE
  USING (public.is_owner_user());

-- Giveaway Winners Policies
DROP POLICY IF EXISTS "Public views published giveaway winners" ON public.giveaway_winners;
CREATE POLICY "Public views published giveaway winners"
  ON public.giveaway_winners FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.giveaways g
      WHERE g.id = giveaway_id
        AND g.is_published = true
        AND g.is_archived = false
        AND (g.publish_at IS NULL OR g.publish_at <= now())
    )
    OR public.is_owner_user()
  );

DROP POLICY IF EXISTS "Owner manages giveaway winners" ON public.giveaway_winners;
CREATE POLICY "Owner manages giveaway winners"
  ON public.giveaway_winners FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

-- ============================================================================
-- 6. SUPABASE STORAGE BUCKETS & RLS FOR COVER IMAGES
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('giveaway-media', 'giveaway-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('competition-banners', 'competition-banners', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public reads giveaway media objects" ON storage.objects;
DROP POLICY IF EXISTS "Public reads media buckets" ON storage.objects;
CREATE POLICY "Public reads media buckets"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('giveaway-media', 'competition-banners'));

DROP POLICY IF EXISTS "Owner uploads giveaway media objects" ON storage.objects;
DROP POLICY IF EXISTS "Owner uploads media buckets" ON storage.objects;
CREATE POLICY "Owner uploads media buckets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('giveaway-media', 'competition-banners') AND public.is_owner_user());

DROP POLICY IF EXISTS "Owner updates giveaway media objects" ON storage.objects;
DROP POLICY IF EXISTS "Owner updates media buckets" ON storage.objects;
CREATE POLICY "Owner updates media buckets"
  ON storage.objects FOR UPDATE
  USING (bucket_id IN ('giveaway-media', 'competition-banners') AND public.is_owner_user())
  WITH CHECK (bucket_id IN ('giveaway-media', 'competition-banners') AND public.is_owner_user());

DROP POLICY IF EXISTS "Owner deletes giveaway media objects" ON storage.objects;
DROP POLICY IF EXISTS "Owner deletes media buckets" ON storage.objects;
CREATE POLICY "Owner deletes media buckets"
  ON storage.objects FOR DELETE
  USING (bucket_id IN ('giveaway-media', 'competition-banners') AND public.is_owner_user());

-- ============================================================================
-- 7. RELOAD POSTGREST SCHEMA CACHE
-- ============================================================================
NOTIFY pgrst, 'reload schema';
