
-- === 1. Profile bio ===
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- === 2. Apps featured / download tracking / suspended status ===
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS featured_at TIMESTAMPTZ;
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;

-- Widen status check to include 'suspended'
ALTER TABLE public.apps DROP CONSTRAINT IF EXISTS apps_status_check;
ALTER TABLE public.apps ADD CONSTRAINT apps_status_check
  CHECK (status IN ('pending','approved','live','rejected','suspended','draft'));

CREATE INDEX IF NOT EXISTS apps_featured_idx ON public.apps(is_featured, featured_at DESC) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS apps_last_updated_idx ON public.apps(last_updated_at DESC);
CREATE INDEX IF NOT EXISTS apps_download_count_idx ON public.apps(download_count DESC);
CREATE INDEX IF NOT EXISTS apps_category_idx ON public.apps(category);

-- === 3. Super admin: email-based admin check ===
-- Auto-grant admin to super admin email on sign-in
CREATE OR REPLACE FUNCTION public.grant_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF LOWER(NEW.email) = 'paschalsoromtochukwu@gmail.com'
     AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_super_admin_insert ON auth.users;
CREATE TRIGGER on_auth_user_super_admin_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_super_admin();

DROP TRIGGER IF EXISTS on_auth_user_super_admin_confirm ON auth.users;
CREATE TRIGGER on_auth_user_super_admin_confirm
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.grant_super_admin();

-- Backfill existing super admin user (if already signed up)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE LOWER(email) = 'paschalsoromtochukwu@gmail.com'
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Public is_admin() usable by RLS in the app schema
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- === 4. Favorites ===
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, app_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_self" ON public.favorites FOR ALL
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS favorites_app_idx ON public.favorites(app_id);

-- === 5. Reports ===
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('malware','broken','inappropriate','copyright','spam','other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert" ON public.reports FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reports_own_read" ON public.reports FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "reports_admin_update" ON public.reports FOR UPDATE
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports(status, created_at DESC);
CREATE TRIGGER reports_touch BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- === 6. Collections ===
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collections TO anon, authenticated;
GRANT ALL ON public.collections TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.collections TO authenticated;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections_public_read" ON public.collections FOR SELECT
  USING (is_published = true OR public.is_admin(auth.uid()));
CREATE POLICY "collections_admin_write" ON public.collections FOR INSERT
  TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "collections_admin_update" ON public.collections FOR UPDATE
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "collections_admin_delete" ON public.collections FOR DELETE
  TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER collections_touch BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.collection_apps (
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, app_id)
);
GRANT SELECT ON public.collection_apps TO anon, authenticated;
GRANT ALL ON public.collection_apps TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.collection_apps TO authenticated;
ALTER TABLE public.collection_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_apps_read" ON public.collection_apps FOR SELECT USING (true);
CREATE POLICY "collection_apps_admin_write" ON public.collection_apps FOR ALL
  TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- === 7. Recently viewed ===
CREATE TABLE IF NOT EXISTS public.recently_viewed (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recently_viewed TO authenticated;
GRANT ALL ON public.recently_viewed TO service_role;
ALTER TABLE public.recently_viewed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recently_viewed_self" ON public.recently_viewed FOR ALL
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS recently_viewed_user_idx ON public.recently_viewed(user_id, viewed_at DESC);

-- === 8. Notifications (update alerts) ===
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID REFERENCES public.apps(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('update','announcement','system')),
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_self_read" ON public.notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_self_update" ON public.notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- === 9. Download counter RPC (used by install flow) ===
CREATE OR REPLACE FUNCTION public.increment_download(_app_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.apps SET download_count = download_count + 1 WHERE id = _app_id;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_download(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_download(uuid) TO authenticated;

-- === 10. Fan-out update notifications when a new app version is published ===
CREATE OR REPLACE FUNCTION public.fanout_update_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE app_row public.apps%ROWTYPE;
BEGIN
  SELECT * INTO app_row FROM public.apps WHERE id = NEW.app_id;
  IF app_row IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, app_id, kind, title, body)
  SELECT i.user_id, NEW.app_id, 'update',
         app_row.name || ' updated to ' || NEW.version,
         COALESCE(NEW.release_notes, 'A new version is available.')
  FROM public.installs i
  WHERE i.app_id = NEW.app_id
    AND (i.installed_version IS NULL OR i.installed_version <> NEW.version);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS app_versions_fanout ON public.app_versions;
CREATE TRIGGER app_versions_fanout
  AFTER INSERT ON public.app_versions
  FOR EACH ROW EXECUTE FUNCTION public.fanout_update_notifications();

-- === 11. Seed default collections (idempotent) ===
INSERT INTO public.collections (slug, title, description, sort_order) VALUES
  ('editors-picks','Editor''s Picks','Hand-picked apps we love this week', 1),
  ('best-ai-apps','Best AI Apps','Apps powered by artificial intelligence', 2),
  ('best-games','Best Games','Top games to install right now', 3),
  ('new-apps','New Apps','Fresh releases from our developers', 4),
  ('productivity','Productivity','Get more done every day', 5),
  ('education','Education','Learn something new', 6),
  ('entertainment','Entertainment','Movies, music, and fun', 7),
  ('trending-week','Trending This Week','What everyone is downloading', 8)
ON CONFLICT (slug) DO NOTHING;
