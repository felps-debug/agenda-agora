-- Phase 1: keep provider credentials outside the businesses row exposed to members.
CREATE TABLE IF NOT EXISTS public.business_whatsapp_credentials (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  instance_id text NOT NULL,
  instance_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_whatsapp_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_whatsapp_credentials FROM anon, authenticated;
GRANT ALL ON public.business_whatsapp_credentials TO service_role;

CREATE OR REPLACE FUNCTION public.touch_business_whatsapp_credentials_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS business_whatsapp_credentials_touch_updated_at
  ON public.business_whatsapp_credentials;
CREATE TRIGGER business_whatsapp_credentials_touch_updated_at
BEFORE UPDATE ON public.business_whatsapp_credentials
FOR EACH ROW EXECUTE FUNCTION public.touch_business_whatsapp_credentials_updated_at();

-- Phase 2 is deliberately additive during the rollout. Server code reads this table
-- first and falls back to the legacy columns until all deployed workers are updated.
INSERT INTO public.business_whatsapp_credentials (business_id, instance_id, instance_token)
SELECT id, whatsapp_instance_id, whatsapp_instance_token
FROM public.businesses
WHERE whatsapp_instance_id IS NOT NULL AND whatsapp_instance_token IS NOT NULL
ON CONFLICT (business_id) DO UPDATE
SET instance_id = EXCLUDED.instance_id, instance_token = EXCLUDED.instance_token;

-- After every worker is running the private-credential reader, run a separate
-- verified migration to null the legacy whatsapp_instance_token column.
