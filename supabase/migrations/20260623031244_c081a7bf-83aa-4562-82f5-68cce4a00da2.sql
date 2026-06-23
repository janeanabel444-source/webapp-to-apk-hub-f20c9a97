
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'developer', 'user');
CREATE TYPE public.app_category AS ENUM ('app', 'game', 'ai_video');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- apps
CREATE TABLE public.apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  icon_url TEXT,
  category public.app_category NOT NULL DEFAULT 'app',
  is_published BOOLEAN NOT NULL DEFAULT true,
  install_count INTEGER NOT NULL DEFAULT 0,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.apps TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.apps TO authenticated;
GRANT ALL ON public.apps TO service_role;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apps_public_read" ON public.apps FOR SELECT USING (is_published = true OR developer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "apps_dev_insert" ON public.apps FOR INSERT TO authenticated WITH CHECK (developer_id = auth.uid());
CREATE POLICY "apps_dev_update" ON public.apps FOR UPDATE TO authenticated USING (developer_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (developer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "apps_dev_delete" ON public.apps FOR DELETE TO authenticated USING (developer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- installs
CREATE TABLE public.installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, app_id)
);
GRANT SELECT, INSERT, DELETE ON public.installs TO authenticated;
GRANT ALL ON public.installs TO service_role;
ALTER TABLE public.installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "installs_self" ON public.installs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  dev_reply TEXT,
  dev_replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, app_id)
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_self_write" ON public.reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews_self_update" ON public.reviews FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND a.developer_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND a.developer_id = auth.uid()));
CREATE POLICY "reviews_self_delete" ON public.reviews FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Profile autocreate trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Recalculate rating on review change
CREATE OR REPLACE FUNCTION public.recalc_app_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_app UUID;
BEGIN
  target_app := COALESCE(NEW.app_id, OLD.app_id);
  UPDATE public.apps SET
    rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE app_id = target_app), 0),
    rating_count = (SELECT COUNT(*) FROM public.reviews WHERE app_id = target_app)
  WHERE id = target_app;
  RETURN NULL;
END;
$$;
CREATE TRIGGER reviews_recalc AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalc_app_rating();

-- Recalculate install count
CREATE OR REPLACE FUNCTION public.recalc_install_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target_app UUID;
BEGIN
  target_app := COALESCE(NEW.app_id, OLD.app_id);
  UPDATE public.apps SET install_count = (SELECT COUNT(*) FROM public.installs WHERE app_id = target_app) WHERE id = target_app;
  RETURN NULL;
END;
$$;
CREATE TRIGGER installs_recalc AFTER INSERT OR DELETE ON public.installs
  FOR EACH ROW EXECUTE FUNCTION public.recalc_install_count();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER apps_touch BEFORE UPDATE ON public.apps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER reviews_touch BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed sample apps so the storefront isn't empty
INSERT INTO public.apps (slug, name, tagline, description, icon_url, category, install_count, rating_avg, rating_count) VALUES
  ('nebula-notes', 'Nebula Notes', 'Calm, fast note-taking', 'A focused, beautifully minimal notes app with offline sync and rich markdown.', null, 'app', 12483, 4.70, 1820),
  ('lumen-mail', 'Lumen Mail', 'Inbox that respects your time', 'A modern email client with smart triage, schedule send, and end-to-end privacy.', null, 'app', 8721, 4.50, 932),
  ('orbit-tasks', 'Orbit Tasks', 'Plan your day in orbit', 'A delightful task planner with natural language, recurring tasks, and calendar sync.', null, 'app', 5430, 4.30, 412),
  ('prism-ai', 'Prism AI', 'Your everyday AI copilot', 'Chat, summarize, draft, and brainstorm with an AI built for daily use.', null, 'app', 23110, 4.80, 4011),
  ('skyline-runner', 'Skyline Runner', 'Endless rooftop dash', 'Fast-paced parkour runner across neon city rooftops. Compete weekly.', null, 'game', 19284, 4.60, 2904),
  ('crystal-quest', 'Crystal Quest', 'Match-3 puzzle adventure', 'A relaxing match-3 puzzle with hand-drawn worlds and gentle progression.', null, 'game', 7654, 4.20, 612),
  ('void-racers', 'Void Racers', 'Hover-bike arcade racing', 'Drift through cosmic tracks. Online multiplayer, daily tournaments.', null, 'game', 11203, 4.40, 901),
  ('cinemind-shorts', 'CineMind Shorts', 'AI-generated 60s stories', 'Watch and remix bite-sized AI-generated cinematic shorts.', null, 'ai_video', 4521, 4.10, 230),
  ('reel-forge', 'Reel Forge', 'Make AI reels in seconds', 'Type an idea, get a polished short video with voice, music, and captions.', null, 'ai_video', 6712, 4.50, 511);
