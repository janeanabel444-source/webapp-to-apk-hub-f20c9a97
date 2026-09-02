ALTER TABLE public.developer_prompts
  ADD CONSTRAINT developer_prompts_user_kind_app_key
  UNIQUE NULLS NOT DISTINCT (user_id, kind, app_id);