
-- 1) AI images: restrict reads to owner / admin
DROP POLICY IF EXISTS "Premium users can view all AI images" ON public.ai_images;
DROP POLICY IF EXISTS "ai_images_self_read" ON public.ai_images;
CREATE POLICY "ai_images_self_read" ON public.ai_images
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'::app_role));

-- 2) Profiles: split public-safe columns from owner-only fields
DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_public_safe_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;

-- Re-create column-scoped grants (idempotent)
REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, created_at) ON public.profiles TO anon, authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE POLICY "profiles_public_safe_read" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 3) Reviews: split self-update from developer-reply-only update
DROP POLICY IF EXISTS "reviews_self_update" ON public.reviews;
DROP POLICY IF EXISTS "reviews_owner_update" ON public.reviews;
DROP POLICY IF EXISTS "reviews_developer_reply_update" ON public.reviews;

CREATE POLICY "reviews_owner_update" ON public.reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_developer_reply_update" ON public.reviews
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = reviews.app_id AND a.developer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = reviews.app_id AND a.developer_id = auth.uid()));

-- Trigger already enforces dev can only change reply fields; keep it.
