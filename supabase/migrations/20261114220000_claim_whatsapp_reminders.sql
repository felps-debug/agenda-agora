ALTER TABLE public.reminder_logs
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_reminder(
  p_business_id uuid,
  p_appointment_id uuid,
  p_channel text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_token uuid := gen_random_uuid();
  claimed_token uuid;
BEGIN
  INSERT INTO public.reminder_logs(
    business_id, appointment_id, channel, status, error, claim_token, claim_expires_at
  ) VALUES (
    p_business_id, p_appointment_id, p_channel, 'processing', NULL,
    requested_token, now() + interval '15 minutes'
  )
  ON CONFLICT (appointment_id, channel) DO UPDATE SET
    business_id = EXCLUDED.business_id,
    status = 'processing',
    error = NULL,
    claim_token = EXCLUDED.claim_token,
    claim_expires_at = EXCLUDED.claim_expires_at,
    created_at = now()
  WHERE reminder_logs.status = 'erro'
    OR (reminder_logs.status = 'processing' AND reminder_logs.claim_expires_at <= now())
  RETURNING claim_token INTO claimed_token;
  RETURN claimed_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_whatsapp_reminder(
  p_business_id uuid,
  p_appointment_id uuid,
  p_channel text,
  p_claim_token uuid,
  p_sent boolean,
  p_error text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.reminder_logs
  SET status = CASE WHEN p_sent THEN 'enviado' ELSE 'erro' END,
      error = CASE WHEN p_sent THEN NULL ELSE left(coalesce(p_error, 'Falha ao enviar'), 1000) END,
      claim_token = NULL,
      claim_expires_at = NULL,
      created_at = now()
  WHERE business_id = p_business_id
    AND appointment_id = p_appointment_id
    AND channel = p_channel
    AND claim_token = p_claim_token;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_reminder(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_reminder(uuid, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.finish_whatsapp_reminder(uuid, uuid, text, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_whatsapp_reminder(uuid, uuid, text, uuid, boolean, text) TO service_role;
