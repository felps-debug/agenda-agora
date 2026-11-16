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
    p_business_id, p_sender_phone, now() - interval '31 minutes', requested_token, now() + interval '5 minutes'
  )
  ON CONFLICT (business_id, sender_phone) DO UPDATE SET
    claim_token = EXCLUDED.claim_token,
    claim_expires_at = EXCLUDED.claim_expires_at
  WHERE whatsapp_greeting_replies.replied_at <= now() - interval '30 minutes'
    AND (whatsapp_greeting_replies.claim_expires_at IS NULL OR whatsapp_greeting_replies.claim_expires_at <= now())
  RETURNING claim_token INTO claimed_token;
  RETURN claimed_token;
END;
$$;

COMMENT ON FUNCTION public.claim_whatsapp_greeting(uuid, text) IS
  'Atomically claims one WhatsApp greeting per sender and business every 30 minutes.';
