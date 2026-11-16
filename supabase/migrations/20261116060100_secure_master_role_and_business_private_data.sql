-- Master access over PostgREST and Server Functions is based on the current DB role.
-- Sensitive business columns remain available only through authorized server code.

CREATE OR REPLACE FUNCTION public.has_super_admin_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.has_role((SELECT auth.uid()), 'super_admin');
$$;

REVOKE ALL ON FUNCTION public.has_super_admin_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_super_admin_role() TO authenticated, service_role;

DROP POLICY IF EXISTS "user_roles_admin_read" ON public.user_roles;
CREATE POLICY "user_roles_admin_read" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_super_admin_role());

DROP POLICY IF EXISTS "businesses_super_admin" ON public.businesses;
CREATE POLICY "businesses_super_admin" ON public.businesses
  FOR ALL TO authenticated
  USING (public.has_super_admin_role())
  WITH CHECK (public.has_super_admin_role());

DROP POLICY IF EXISTS "outreach_templates_super_admin_all" ON public.outreach_templates;
CREATE POLICY "outreach_templates_super_admin_all" ON public.outreach_templates
  FOR ALL TO authenticated
  USING (public.has_super_admin_role())
  WITH CHECK (public.has_super_admin_role());

DROP POLICY IF EXISTS "master_business_notes_super_admin" ON public.master_business_notes;
CREATE POLICY "master_business_notes_super_admin" ON public.master_business_notes
  FOR ALL TO authenticated
  USING (public.has_super_admin_role())
  WITH CHECK (public.has_super_admin_role());

DROP POLICY IF EXISTS "master_business_events_super_admin" ON public.master_business_events;
CREATE POLICY "master_business_events_super_admin" ON public.master_business_events
  FOR ALL TO authenticated
  USING (public.has_super_admin_role())
  WITH CHECK (public.has_super_admin_role());

DROP POLICY IF EXISTS client_error_log_select ON public.client_error_log;
CREATE POLICY client_error_log_select ON public.client_error_log
  FOR SELECT TO authenticated
  USING (public.has_super_admin_role());

-- PostgreSQL's table-level SELECT grant overrides column-level restrictions.
-- Remove it first, then grant only non-secret/non-internal columns to authenticated.
REVOKE SELECT ON public.businesses FROM anon, authenticated;
DO $$
DECLARE
  readable_columns text;
BEGIN
  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum)
  INTO readable_columns
  FROM pg_attribute a
  WHERE a.attrelid = 'public.businesses'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attname NOT IN (
      'owner_cpf',
      'whatsapp_instance_id',
      'whatsapp_instance_token',
      'withdrawal_pin_hash',
      'withdrawal_pix_key',
      'withdrawal_pix_key_type',
      'lead_source',
      'sales_owner',
      'commercial_notes',
      'coupon_code',
      'coupon_percent',
      'coupon_expires_at',
      'agpay_split_email',
      'sdr_id'
    );

  EXECUTE format('GRANT SELECT (%s) ON public.businesses TO authenticated', readable_columns);
END
$$;

-- Public booking reads business data through server functions; anon no longer needs
-- direct access to the businesses table.
DROP POLICY IF EXISTS "businesses_public_read" ON public.businesses;

-- Sensitive values must be written through owner-checked Server Functions/service_role.
REVOKE UPDATE ON public.businesses FROM authenticated;
REVOKE UPDATE (
  owner_cpf,
  whatsapp_instance_id,
  whatsapp_instance_token,
  withdrawal_pin_hash,
  withdrawal_pix_key,
  withdrawal_pix_key_type
) ON public.businesses FROM anon, authenticated;
GRANT UPDATE (
  logo_url,
  brand_background_image,
  reminder_enabled,
  reminder_hours_before,
  theme,
  pix_mode,
  pix_exception_clients
) ON public.businesses TO authenticated;

-- Anonymous booking pages may read published business logos from the private bucket.
DROP POLICY IF EXISTS "visual_assets_public_logos_read" ON storage.objects;
CREATE POLICY "visual_assets_public_logos_read" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'business-logos'
    AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo-[^/]+\.(png|jpe?g|webp)$'
  );
