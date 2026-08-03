-- 1. Fix publishing/download failure: the RLS helper in the private schema was
-- not executable by the roles that evaluate the storage policy.
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.storage_object_is_public_app_file(text) TO authenticated, anon, service_role;

-- 2. Primary administrator accounts (auto-granted on sign-in / confirmation).
CREATE OR REPLACE FUNCTION public.grant_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF LOWER(NEW.email) IN ('paschalsoromtochukwu@gmail.com', 'novaservices.org1@gmail.com')
     AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill for accounts that already exist.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE LOWER(u.email) IN ('paschalsoromtochukwu@gmail.com', 'novaservices.org1@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;