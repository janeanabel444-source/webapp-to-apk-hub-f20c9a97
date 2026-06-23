
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_since timestamptz;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paystack',
  reference text NOT NULL UNIQUE,
  amount_kobo integer NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_self_read ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER payments_touch_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments(user_id);
