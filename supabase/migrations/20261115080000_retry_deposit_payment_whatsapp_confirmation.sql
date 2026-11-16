CREATE TABLE IF NOT EXISTS public.deposit_payment_whatsapp_confirmations (
  deposit_payment_id uuid PRIMARY KEY REFERENCES public.deposit_payments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'skipped')),
  claim_token uuid,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deposit_payment_whatsapp_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.deposit_payment_whatsapp_confirmations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.deposit_payment_whatsapp_confirmations TO service_role;

DROP TRIGGER IF EXISTS deposit_payment_whatsapp_confirmations_updated
  ON public.deposit_payment_whatsapp_confirmations;
CREATE TRIGGER deposit_payment_whatsapp_confirmations_updated
  BEFORE UPDATE ON public.deposit_payment_whatsapp_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_deposit_payment_whatsapp_confirmation(_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_token uuid := gen_random_uuid();
  claimed_token uuid;
BEGIN
  INSERT INTO public.deposit_payment_whatsapp_confirmations (deposit_payment_id)
  SELECT id
  FROM public.deposit_payments
  WHERE id = _payment_id AND status = 'pago' AND appointment_id IS NOT NULL
  ON CONFLICT (deposit_payment_id) DO NOTHING;

  UPDATE public.deposit_payment_whatsapp_confirmations AS confirmation
  SET status = 'processing', claim_token = requested_token, claimed_at = now()
  FROM public.deposit_payments AS payment
  WHERE confirmation.deposit_payment_id = _payment_id
    AND payment.id = confirmation.deposit_payment_id
    AND payment.status = 'pago'
    AND payment.appointment_id IS NOT NULL
    AND (
      confirmation.status = 'pending'
      OR (confirmation.status = 'processing' AND confirmation.claimed_at < now() - interval '5 minutes')
    )
  RETURNING confirmation.claim_token INTO claimed_token;
  RETURN claimed_token;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_deposit_payment_whatsapp_confirmation(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_deposit_payment_whatsapp_confirmation(uuid)
  TO service_role;
