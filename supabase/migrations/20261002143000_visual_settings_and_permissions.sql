-- Published visual settings are intentionally separate from the legacy Storage JSON.
-- The application reads legacy settings until a business explicitly publishes v2.

CREATE TABLE IF NOT EXISTS public.business_visual_settings (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 2 CHECK (schema_version > 0),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  layout_key text NOT NULL DEFAULT 'classic' CHECK (layout_key IN ('classic', 'liquid_glass')),
  niche_id text NOT NULL DEFAULT 'outro',
  palette_id text,
  appearance jsonb NOT NULL DEFAULT '{}'::jsonb,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_visual_settings_updated_at_idx
  ON public.business_visual_settings(updated_at DESC);

ALTER TABLE public.business_visual_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_visual_settings TO authenticated;
GRANT ALL ON public.business_visual_settings TO service_role;

CREATE POLICY "business_visual_settings_member_read"
  ON public.business_visual_settings
  FOR SELECT TO authenticated
  USING (public.is_business_member(business_id));

CREATE POLICY "business_visual_settings_appearance_manage"
  ON public.business_visual_settings
  FOR ALL TO authenticated
  USING (public.has_business_permission(business_id, 'manage_appearance'))
  WITH CHECK (public.has_business_permission(business_id, 'manage_appearance'));

CREATE OR REPLACE FUNCTION public.touch_business_visual_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_visual_settings_touch_updated_at ON public.business_visual_settings;
CREATE TRIGGER business_visual_settings_touch_updated_at
BEFORE UPDATE ON public.business_visual_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_business_visual_settings_updated_at();

-- Existing professionals remain least-privileged; missing keys are treated as false.
ALTER TABLE public.professionals
  ALTER COLUMN permissions SET DEFAULT
  '{"admin":false,"cancel_appointment":false,"complete_appointment":false,"reopen_appointment":false,"view_customer_phone":false,"create_appointment":false,"block_schedule":false,"sell_product":false,"view_product":false,"receive_notification":false,"generate_qrcode":false,"manage_appearance":false,"manage_outreach":false}'::jsonb;

UPDATE public.professionals
SET permissions =
  jsonb_set(
    jsonb_set(COALESCE(permissions, '{}'::jsonb), '{manage_appearance}', 'false'::jsonb, true),
    '{manage_outreach}',
    'false'::jsonb,
    true
  )
WHERE NOT (COALESCE(permissions, '{}'::jsonb) ?& ARRAY['manage_appearance', 'manage_outreach']);
