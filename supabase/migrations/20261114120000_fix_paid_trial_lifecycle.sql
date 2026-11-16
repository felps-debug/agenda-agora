-- Contas criadas como trial deixam de ser trial quando há pagamento confirmado.
-- Consulta o histórico legado e a tabela de cobranças atual, pois a gravação do
-- histórico em subscription_payments é best-effort no webhook.
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
     OR (
       target.trial_days IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.subscription_payments payment
         WHERE payment.business_id = target.id
           AND payment.status = 'pago'
       )
       AND NOT EXISTS (
         SELECT 1
         FROM public.subscription_charges charge
         WHERE charge.business_id = target.id
           AND charge.status = 'paid'
       )
     )
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
