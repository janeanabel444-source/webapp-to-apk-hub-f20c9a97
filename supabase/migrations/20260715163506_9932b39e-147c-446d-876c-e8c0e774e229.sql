
-- 1) app_versions: hide internal storage file_path from public/authenticated Data API reads.
-- Server code that needs file_path uses the service-role admin client.
REVOKE SELECT (file_path) ON public.app_versions FROM anon;
REVOKE SELECT (file_path) ON public.app_versions FROM authenticated;

-- 2) profiles: scope the public read policy so only rows referenced by public
-- content (developers of published apps, or review authors) are visible via the
-- anonymous/authenticated Data API. Column-level grants continue to restrict
-- premium columns, and the future-column risk is now also mitigated at the RLS
-- row level.
DROP POLICY IF EXISTS profiles_public_safe_columns ON public.profiles;

CREATE POLICY profiles_public_safe_columns
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.apps a
    WHERE a.developer_id = profiles.id AND a.is_published = true
  )
  OR EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.user_id = profiles.id
  )
);
