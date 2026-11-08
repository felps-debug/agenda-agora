CREATE TABLE public.client_error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('ui_error', 'unhandled_rejection', 'request_failed')),
  message text NOT NULL CHECK (length(message) <= 2000),
  source text NOT NULL CHECK (length(source) <= 500),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (octet_length(detail::text) <= 16000),
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  app_version text CHECK (length(app_version) <= 120)
);
CREATE INDEX client_error_log_occurred_idx ON public.client_error_log (occurred_at DESC, id DESC);
CREATE INDEX client_error_log_kind_occurred_idx ON public.client_error_log (kind, occurred_at DESC);
CREATE INDEX client_error_log_business_idx ON public.client_error_log (business_id);
CREATE INDEX client_error_log_user_idx ON public.client_error_log (user_id);
ALTER TABLE public.client_error_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.client_error_log TO service_role;
GRANT INSERT, SELECT ON public.client_error_log TO authenticated;
CREATE POLICY client_error_log_insert ON public.client_error_log FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND (business_id IS NULL OR EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = client_error_log.business_id AND b.owner_id = (SELECT auth.uid())
  ) OR EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.business_id = client_error_log.business_id AND p.user_id = (SELECT auth.uid())
  ))
);
CREATE POLICY client_error_log_select ON public.client_error_log FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'super_admin'));
