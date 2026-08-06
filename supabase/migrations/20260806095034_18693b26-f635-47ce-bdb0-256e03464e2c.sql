DROP POLICY IF EXISTS authenticated_inserts_impressions ON public.ad_impressions;
DROP POLICY IF EXISTS authenticated_inserts_clicks ON public.ad_clicks;
REVOKE INSERT, UPDATE, DELETE ON public.ad_impressions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ad_clicks FROM authenticated, anon;
GRANT ALL ON public.ad_impressions TO service_role;
GRANT ALL ON public.ad_clicks TO service_role;