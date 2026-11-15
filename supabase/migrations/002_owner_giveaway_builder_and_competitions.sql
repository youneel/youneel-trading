-- YOUNEEL TRADING: Owner Mode, Visual Giveaway Builder & Broker Competitions System
-- Idempotent migration (safe to run after 001_giveaways_and_security.sql or standalone).
-- Run in Supabase Project SQL Editor: https://supabase.com/dashboard/project/xhqvlqygqvyniuiqjjzx/sql

-- ============================================================================
-- 1. OWNER AUTHORIZATION & HARDENED ROLE PROTECTION
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'trader';

-- Dedicated owner check helper (server-side & RLS). Only verified owner email or role='owner'.
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prevent non-service-role clients from assigning or escalating role to admin or owner
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR current_user = 'postgres' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
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

-- Assign owner role server-side if the owner account already exists in auth.users
UPDATE public.profiles
SET role = 'owner'
WHERE id IN (
  SELECT id FROM auth.users WHERE lower(email) = 'younesselidrissi64@gmail.com'
);

-- ============================================================================
-- 2. OWNER 2FA VERIFICATION CODES, SESSIONS, AUDIT LOGS & NOTIFICATIONS
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

-- Strict deny-by-default for client browser reads on OTP hashes & session tokens; only service_role manages OTPs/sessions.
-- Owner can view audit logs & notifications if querying authenticated DB directly.
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
-- 3. YOUNEEL GIVEAWAYS: VISUAL BUILDER, MEDIA & WINNERS (SEPARATE FROM BROKERS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  prize text NOT NULL,
  rules text NOT NULL DEFAULT '',
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

-- Upgrade existing giveaways table columns idempotently
ALTER TABLE public.giveaways
  ADD COLUMN IF NOT EXISTS subtitle text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS image_crop jsonb NOT NULL DEFAULT '{"x":50,"y":50,"zoom":1,"aspect":"16:9"}'::jsonb,
  ADD COLUMN IF NOT EXISTS external_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_label text NOT NULL DEFAULT 'Enter Giveaway',
  ADD COLUMN IF NOT EXISTS design_template text NOT NULL DEFAULT 'premium_dark',
  ADD COLUMN IF NOT EXISTS style_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz NULL;

ALTER TABLE public.giveaways DROP CONSTRAINT IF EXISTS giveaways_status_check;
ALTER TABLE public.giveaways
  ADD CONSTRAINT giveaways_status_check
  CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'ended', 'archived'));

CREATE TABLE IF NOT EXISTS public.giveaway_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id uuid REFERENCES public.giveaways(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'giveaway-media',
  storage_path text NOT NULL,
  public_url text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  width integer NULL,
  height integer NULL,
  crop_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

ALTER TABLE public.giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giveaway_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published giveaways" ON public.giveaways;
CREATE POLICY "Public can view published giveaways"
  ON public.giveaways FOR SELECT
  USING (
    (is_published = true AND is_archived = false AND (publish_at IS NULL OR publish_at <= now()))
    OR public.is_owner_user()
  );

DROP POLICY IF EXISTS "Admins manage giveaways" ON public.giveaways;
DROP POLICY IF EXISTS "Owner manages giveaways" ON public.giveaways;
CREATE POLICY "Owner manages giveaways"
  ON public.giveaways FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

DROP POLICY IF EXISTS "Public views giveaway media" ON public.giveaway_media;
CREATE POLICY "Public views giveaway media"
  ON public.giveaway_media FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner manages giveaway media" ON public.giveaway_media;
CREATE POLICY "Owner manages giveaway media"
  ON public.giveaway_media FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

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
    AND EXISTS (
      SELECT 1 FROM public.giveaways g
      WHERE g.id = giveaway_id
        AND g.is_published = true
        AND g.is_archived = false
        AND g.status = 'active'
    )
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

DROP POLICY IF EXISTS "Public views published giveaway winners" ON public.giveaway_winners;
CREATE POLICY "Public views published giveaway winners"
  ON public.giveaway_winners FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.giveaways g
      WHERE g.id = giveaway_id AND g.is_published = true
    )
    OR public.is_owner_user()
  );

DROP POLICY IF EXISTS "Owner manages giveaway winners" ON public.giveaway_winners;
CREATE POLICY "Owner manages giveaway winners"
  ON public.giveaway_winners FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

-- ============================================================================
-- 4. BROKER COMPETITIONS (TMGM, HFM & EXTENSIBLE BROKERS — STRICTLY SEPARATE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.broker_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_slug text NOT NULL UNIQUE,
  broker_name text NOT NULL,
  official_website_url text NOT NULL,
  competition_source_url text NOT NULL,
  adapter_type text NOT NULL DEFAULT 'manual',
  accent_theme text NOT NULL DEFAULT 'slate',
  is_active boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz NULL,
  last_status text NOT NULL DEFAULT 'pending',
  last_http_status integer NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.broker_sources (broker_slug, broker_name, official_website_url, competition_source_url, adapter_type, accent_theme, is_active)
VALUES
  ('tmgm', 'TMGM', 'https://www.tmgm.com/en', 'https://competition.tmgm.com/en', 'tmgm_html', 'blue', true),
  ('hfm', 'HFM', 'https://www.hfm.com/int/en', 'https://www.hfm.com/int/en/promotions', 'hfm_promotions', 'red', true)
ON CONFLICT (broker_slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.broker_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES public.broker_sources(id) ON DELETE CASCADE,
  broker_slug text NOT NULL,
  external_key text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  prize_pool text NOT NULL DEFAULT '',
  prize_details text NOT NULL DEFAULT '',
  banner_url text NOT NULL DEFAULT '',
  official_source_url text NOT NULL,
  official_registration_url text NOT NULL,
  rules_url text NOT NULL DEFAULT '',
  registration_start timestamptz NULL,
  registration_end timestamptz NULL,
  competition_start timestamptz NULL,
  competition_end timestamptz NULL,
  eligibility_summary text NOT NULL DEFAULT '',
  trading_requirements text NOT NULL DEFAULT '',
  rules_summary text NOT NULL DEFAULT '',
  rankings_summary text NOT NULL DEFAULT '',
  participating_accounts integer NULL,
  status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (
    status IN ('UPCOMING', 'REGISTRATION OPEN', 'LIVE', 'ENDING SOON', 'COMPLETED', 'EXPIRED', 'UNVERIFIED')
  ),
  review_status text NOT NULL DEFAULT 'pending_review' CHECK (
    review_status IN ('pending_review', 'approved', 'auto_published', 'rejected', 'archived')
  ),
  verification_source text NOT NULL DEFAULT 'official_discovery',
  is_published boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  is_potentially_outdated boolean NOT NULL DEFAULT false,
  outdated_reason text NOT NULL DEFAULT '',
  content_hash text NOT NULL DEFAULT '',
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_slug, external_key)
);

CREATE INDEX IF NOT EXISTS idx_broker_comp_public
  ON public.broker_competitions (is_published, is_archived, broker_slug, status);

CREATE TABLE IF NOT EXISTS public.competition_update_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.broker_competitions(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  previous_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_history_comp_detected
  ON public.competition_update_history (competition_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS public.competition_discovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_slug text NOT NULL,
  source_url text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'scheduled',
  fetch_status text NOT NULL CHECK (fetch_status IN ('ok', 'blocked', 'unavailable', 'parse_error')),
  http_status integer NULL,
  discovered_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  queued_count integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  message text NOT NULL DEFAULT '',
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_discovery_checked
  ON public.competition_discovery_logs (checked_at DESC);

ALTER TABLE public.broker_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_update_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_discovery_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads active broker sources" ON public.broker_sources;
CREATE POLICY "Public reads active broker sources"
  ON public.broker_sources FOR SELECT
  USING (is_active = true OR public.is_owner_user());

DROP POLICY IF EXISTS "Owner manages broker sources" ON public.broker_sources;
CREATE POLICY "Owner manages broker sources"
  ON public.broker_sources FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

DROP POLICY IF EXISTS "Public reads published broker competitions" ON public.broker_competitions;
CREATE POLICY "Public reads published broker competitions"
  ON public.broker_competitions FOR SELECT
  USING ((is_published = true AND is_archived = false) OR public.is_owner_user());

DROP POLICY IF EXISTS "Owner manages broker competitions" ON public.broker_competitions;
CREATE POLICY "Owner manages broker competitions"
  ON public.broker_competitions FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

DROP POLICY IF EXISTS "Owner views competition history" ON public.competition_update_history;
CREATE POLICY "Owner views competition history"
  ON public.competition_update_history FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

DROP POLICY IF EXISTS "Owner views discovery logs" ON public.competition_discovery_logs;
CREATE POLICY "Owner views discovery logs"
  ON public.competition_discovery_logs FOR ALL
  USING (public.is_owner_user())
  WITH CHECK (public.is_owner_user());

-- ============================================================================
-- 5. SUPABASE STORAGE BUCKETS FOR GIVEAWAY MEDIA & COMPETITION BANNERS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('giveaway-media', 'giveaway-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('competition-banners', 'competition-banners', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public reads media buckets" ON storage.objects;
CREATE POLICY "Public reads media buckets"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('giveaway-media', 'competition-banners'));

DROP POLICY IF EXISTS "Owner uploads media buckets" ON storage.objects;
CREATE POLICY "Owner uploads media buckets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('giveaway-media', 'competition-banners') AND public.is_owner_user());

DROP POLICY IF EXISTS "Owner deletes media buckets" ON storage.objects;
CREATE POLICY "Owner deletes media buckets"
  ON storage.objects FOR DELETE
  USING (bucket_id IN ('giveaway-media', 'competition-banners') AND public.is_owner_user());
