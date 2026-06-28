
ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS version_code INTEGER,
  ADD COLUMN IF NOT EXISTS apk_size BIGINT,
  ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}'::text[];

ALTER TABLE public.app_versions
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS version_code INTEGER,
  ADD COLUMN IF NOT EXISTS apk_size BIGINT,
  ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS permissions_added TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS permissions_removed TEXT[] DEFAULT '{}'::text[];
