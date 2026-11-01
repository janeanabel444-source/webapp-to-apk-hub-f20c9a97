-- VirusTotal scan gating + APK certificate fingerprint locking

ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS scan_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS cert_fingerprint_sha256 TEXT;

ALTER TABLE public.app_versions ADD COLUMN IF NOT EXISTS vt_scan_id TEXT;
ALTER TABLE public.app_versions ADD COLUMN IF NOT EXISTS vt_positives INTEGER;
ALTER TABLE public.app_versions ADD COLUMN IF NOT EXISTS vt_total INTEGER;
ALTER TABLE public.app_versions ADD COLUMN IF NOT EXISTS vt_permalink TEXT;

COMMENT ON COLUMN public.apps.scan_status IS 'VirusTotal gate: none | verifying | clean | malicious | unscanned';
COMMENT ON COLUMN public.apps.cert_fingerprint_sha256 IS 'SHA-256 certificate fingerprint locked on first upload; updates must match';

CREATE TABLE IF NOT EXISTS public.vt_scan_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL,
  app_version_id UUID,
  file_path TEXT NOT NULL,
  sha256 TEXT,
  size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vt_rate_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_request_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z'
);
INSERT INTO public.vt_rate_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Server-only tables: no client access.
ALTER TABLE public.vt_scan_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vt_rate_state ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.vt_scan_queue TO service_role;
GRANT ALL ON public.vt_rate_state TO service_role;

CREATE INDEX IF NOT EXISTS vt_scan_queue_status_idx ON public.vt_scan_queue (status, created_at);