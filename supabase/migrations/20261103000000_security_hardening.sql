BEGIN;

-- Rollback: restore the previous table grants and policies, then drop the
-- helper tables and RPC. Do not remove these helpers before rolling back code.

CREATE TABLE IF NOT EXISTS public.auth_attempts (
  key text PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_attempts FROM anon, authenticated;
GRANT ALL ON public.auth_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.register_auth_failure(
  p_key text, p_limit integer, p_window_ms bigint, p_lock_ms bigint
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE retry_seconds integer;
BEGIN
  INSERT INTO public.auth_attempts(key, failures, window_started_at, locked_until, updated_at)
  VALUES (
    p_key, 1, now(),
    CASE WHEN p_limit <= 1 THEN now() + (p_lock_ms * interval '1 millisecond') END,
    now()
  )
  ON CONFLICT (key) DO UPDATE SET
    failures = CASE
      WHEN auth_attempts.locked_until > now() THEN auth_attempts.failures
      WHEN auth_attempts.window_started_at + (p_window_ms * interval '1 millisecond') <= now() THEN 1
      ELSE auth_attempts.failures + 1
    END,
    window_started_at = CASE
      WHEN auth_attempts.locked_until > now() THEN auth_attempts.window_started_at
      WHEN auth_attempts.window_started_at + (p_window_ms * interval '1 millisecond') <= now() THEN now()
      ELSE auth_attempts.window_started_at
    END,
    locked_until = CASE
      WHEN auth_attempts.locked_until > now() THEN auth_attempts.locked_until
      WHEN (CASE WHEN auth_attempts.window_started_at + (p_window_ms * interval '1 millisecond') <= now() THEN 1 ELSE auth_attempts.failures + 1 END) >= p_limit
        THEN now() + (p_lock_ms * interval '1 millisecond')
      ELSE NULL
    END,
    updated_at = now();
  SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (locked_until - now())))::integer)
    INTO retry_seconds FROM public.auth_attempts WHERE key = p_key;
  RETURN COALESCE(retry_seconds, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.register_auth_failure(text, integer, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_auth_failure(text, integer, bigint, bigint) TO service_role;

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_settings FROM anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
CREATE TABLE IF NOT EXISTS public.subscription_lifecycle_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  elapsed_ms integer NOT NULL,
  businesses_scanned integer NOT NULL DEFAULT 0,
  notices_created integer NOT NULL DEFAULT 0,
  cancellations_created integer NOT NULL DEFAULT 0,
  auth_attempts_cleaned integer NOT NULL DEFAULT 0
);
ALTER TABLE public.subscription_lifecycle_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_lifecycle_runs FROM anon, authenticated;
GRANT ALL ON public.subscription_lifecycle_runs TO service_role;
CREATE TABLE IF NOT EXISTS public.post_service_message_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.post_service_message_queue
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.post_service_message_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_service_message_queue FROM anon, authenticated;
GRANT ALL ON public.post_service_message_queue TO service_role;
CREATE OR REPLACE FUNCTION public.claim_post_service_messages(p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, appointment_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due AS (
    SELECT q.id
    FROM public.post_service_message_queue q
    WHERE q.processed_at IS NULL
      AND q.scheduled_at <= now()
      AND (q.locked_at IS NULL OR q.locked_at < now() - interval '10 minutes')
    ORDER BY q.scheduled_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  )
  UPDATE public.post_service_message_queue q
  SET locked_at = now()
  FROM due
  WHERE q.id = due.id
  RETURNING q.id, q.appointment_id;
$$;
REVOKE ALL ON FUNCTION public.claim_post_service_messages(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_post_service_messages(integer) TO service_role;
ALTER TABLE public.whatsapp_greeting_replies
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;
CREATE OR REPLACE FUNCTION public.claim_whatsapp_greeting(p_business_id uuid, p_sender_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_token uuid := gen_random_uuid();
  claimed_token uuid;
BEGIN
  INSERT INTO public.whatsapp_greeting_replies(
    business_id, sender_phone, replied_at, claim_token, claim_expires_at
  ) VALUES (
    p_business_id, p_sender_phone, now() - interval '25 hours', requested_token, now() + interval '5 minutes'
  )
  ON CONFLICT (business_id, sender_phone) DO UPDATE SET
    claim_token = EXCLUDED.claim_token,
    claim_expires_at = EXCLUDED.claim_expires_at
  WHERE whatsapp_greeting_replies.replied_at <= now() - interval '24 hours'
    AND (whatsapp_greeting_replies.claim_expires_at IS NULL OR whatsapp_greeting_replies.claim_expires_at <= now())
  RETURNING claim_token INTO claimed_token;
  RETURN claimed_token;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_greeting(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_greeting(uuid, text) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_whatsapp_greeting(
  p_business_id uuid, p_sender_phone text, p_claim_token uuid, p_sent boolean
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.whatsapp_greeting_replies
  SET replied_at = CASE WHEN p_sent THEN now() ELSE replied_at END,
      claim_token = NULL,
      claim_expires_at = NULL
  WHERE business_id = p_business_id
    AND sender_phone = p_sender_phone
    AND claim_token = p_claim_token;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_whatsapp_greeting(uuid, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_whatsapp_greeting(uuid, text, uuid, boolean) TO service_role;
ALTER TABLE public.agpay_webhook_events
  DROP CONSTRAINT IF EXISTS agpay_webhook_events_status_check;
ALTER TABLE public.agpay_webhook_events
  ADD CONSTRAINT agpay_webhook_events_status_check
  CHECK (status IN ('pending', 'processing', 'done', 'failed', 'error'));
INSERT INTO public.platform_settings(key, value)
VALUES
  ('agpay_fees', '{"deposit_fixed_cents":75,"withdraw_fixed_cents":300}'::jsonb),
  ('lifecycle_auto_cancel_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Owners may update only fields written directly by the owner-facing UI.
REVOKE UPDATE ON public.businesses FROM anon, authenticated;
GRANT UPDATE (
  logo_url, brand_background_image, reminder_enabled, reminder_hours_before,
  theme, pix_mode, pix_exception_clients,
  withdrawal_pin_hash, withdrawal_pix_key, withdrawal_pix_key_type
) ON public.businesses TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_business_control_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles r
       WHERE r.user_id = auth.uid() AND r.role = 'super_admin'
     )
     AND (to_jsonb(NEW) - ARRAY['logo_url','brand_background_image','reminder_enabled','reminder_hours_before','theme','pix_mode','pix_exception_clients','withdrawal_pin_hash','withdrawal_pix_key','withdrawal_pix_key_type','updated_at'])
       IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['logo_url','brand_background_image','reminder_enabled','reminder_hours_before','theme','pix_mode','pix_exception_clients','withdrawal_pin_hash','withdrawal_pix_key','withdrawal_pix_key_type','updated_at'])
  THEN
    RAISE EXCEPTION 'business control fields may only be changed by the platform';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS businesses_guard_control_columns ON public.businesses;
CREATE TRIGGER businesses_guard_control_columns
BEFORE UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.guard_business_control_columns();

ALTER TABLE public.pix_key_approvals
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz;
DROP POLICY IF EXISTS "owner inserts pix approvals for own business" ON public.pix_key_approvals;
DROP POLICY IF EXISTS pix_key_approvals_owner_insert ON public.pix_key_approvals;
CREATE POLICY pix_key_approvals_owner_insert ON public.pix_key_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.owns_business(business_id)
    AND status = 'pendente'
    AND approved_by IS NULL
    AND decided_at IS NULL
  );
REVOKE UPDATE, DELETE ON public.pix_key_approvals FROM anon, authenticated;

REVOKE UPDATE ON public.support_messages FROM anon, authenticated;
REVOKE UPDATE ON public.support_messages FROM PUBLIC;
GRANT UPDATE (read_by_user) ON public.support_messages TO authenticated;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['sdrs','sdr_config','sdr_ideas','master_impersonation_sessions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', table_name);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', table_name);
  END LOOP;
END;
$$;
UPDATE public.sdr_config SET secret = gen_random_uuid()::text WHERE secret IS NOT NULL;

-- Account lockouts are master-visible security events. SDRs are not Auth users,
-- so actor_id remains NULL and the event is attached to their business when one exists.
ALTER TABLE public.master_business_events
  DROP CONSTRAINT IF EXISTS master_business_events_type_check;
ALTER TABLE public.master_business_events
  ADD CONSTRAINT master_business_events_type_check CHECK (
    type IN (
      'cadastro', 'observacao', 'perfil', 'comercial', 'assinatura', 'pagamento',
      'suporte', 'suspensao', 'reativacao', 'security'
    )
  );

CREATE OR REPLACE FUNCTION public.cancel_overdue_business(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.businesses%ROWTYPE;
  cancelled_at_value timestamptz := now();
BEGIN
  SELECT * INTO target
  FROM public.businesses
  WHERE id = p_business_id
  FOR UPDATE;

  IF NOT FOUND
     OR target.trial_days IS NOT NULL
     OR target.cancelled_at IS NOT NULL
     OR target.access_until IS NULL
     OR floor(extract(epoch FROM (cancelled_at_value - target.access_until)) / 86400) < 15
  THEN
    RETURN false;
  END IF;

  UPDATE public.businesses
  SET cancelled_at = cancelled_at_value, status = 'cancelado'
  WHERE id = target.id;

  INSERT INTO public.master_business_events(business_id, actor_id, type, title, description)
  VALUES (
    target.id,
    NULL,
    'assinatura',
    'Acesso cancelado por inadimplência (dia 15)',
    'Cancelamento automático por inadimplência, conforme configuração da plataforma.'
  );

  INSERT INTO public.support_messages(business_id, sender, message, read_by_master, read_by_user)
  VALUES (
    target.id,
    'master',
    'O acesso ao painel foi cancelado por inadimplência, conforme a política da plataforma. Regularize a assinatura para solicitar a reativação.',
    true,
    false
  );

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_overdue_business(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_overdue_business(uuid) TO service_role;

ALTER FUNCTION public.owns_business(uuid) SET search_path = public;
ALTER FUNCTION public.is_business_member(uuid) SET search_path = public;
ALTER FUNCTION public.has_business_permission(uuid, text) SET search_path = public;


-- Public booking pages expose signed business logos only. Keep editor reads
-- available to authenticated owners while narrowing anonymous object reads.
DROP POLICY IF EXISTS "business_logos_images_read" ON storage.objects;
CREATE POLICY "business_logos_images_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND public.business_logos_image_business_id(name) IS NOT NULL
  );
DROP POLICY IF EXISTS "visual_assets_images_read" ON storage.objects;
CREATE POLICY "visual_assets_images_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND public.business_visual_asset_business_id(name) IS NOT NULL
  );
DROP POLICY IF EXISTS "visual_assets_public_logos_read" ON storage.objects;
CREATE POLICY "visual_assets_public_logos_read" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'business-logos'
    AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo-[^/]+\.(png|jpe?g|webp)$'
  );


-- Align the local migration history with the production broadcasts columns.
ALTER TABLE public.broadcasts
  ADD COLUMN IF NOT EXISTS audiences text[],
  ADD COLUMN IF NOT EXISTS display_days integer,
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS icon text;

-- Restore Sunday only for legacy default schedules where the business opens then.
-- The marker makes this data correction one-time and safe to replay.
INSERT INTO public.platform_settings(key, value)
VALUES ('available_days_backfill_done', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE backfill_done boolean;
BEGIN
  SELECT value = 'true'::jsonb INTO backfill_done
  FROM public.platform_settings
  WHERE key = 'available_days_backfill_done'
  FOR UPDATE;

  IF COALESCE(backfill_done, false) THEN
    RETURN;
  END IF;

  UPDATE public.services s
  SET available_days = ARRAY[0,1,2,3,4,5,6]::smallint[]
  WHERE s.available_days = ARRAY[1,2,3,4,5,6]::smallint[]
    AND EXISTS (
      SELECT 1 FROM public.business_hours h
      WHERE h.business_id = s.business_id AND h.weekday = 0
    );

  UPDATE public.platform_settings
  SET value = 'true'::jsonb, updated_at = now()
  WHERE key = 'available_days_backfill_done';
END;
$$;COMMIT;
