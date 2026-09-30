-- Fundação da integração AgPay. Mantém as tabelas históricas da Asaas para
-- rollback e auditoria durante a migração.

ALTER TABLE public.businesses
  DROP COLUMN asaas_wallet_id,
  DROP COLUMN asaas_subaccount_status;

ALTER TABLE public.businesses
  RENAME COLUMN asaas_commission_percent TO agpay_commission_percent;

ALTER TABLE public.businesses
  RENAME CONSTRAINT businesses_asaas_commission_percent_check
  TO businesses_agpay_commission_percent_check;

ALTER TABLE public.businesses
  ADD COLUMN agpay_split_email text,
  ADD COLUMN agpay_split_status text NOT NULL DEFAULT 'pendente'
    CHECK (agpay_split_status IN ('pendente', 'aprovada', 'bloqueada'));

COMMENT ON COLUMN public.businesses.agpay_split_status IS
  'pendente | aprovada | bloqueada';
COMMENT ON COLUMN public.businesses.agpay_commission_percent IS
  'Percentual da cobrança retido como comissão da plataforma; o restante é enviado ao split do estabelecimento.';

ALTER TABLE public.deposit_payments
  DROP COLUMN asaas_customer_id,
  DROP COLUMN asaas_account_id,
  ALTER COLUMN provider SET DEFAULT 'agpay';

CREATE TABLE public.agpay_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_hash text NOT NULL UNIQUE,
  event_type text NOT NULL,
  transaction_uuid text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agpay_webhook_events_pending_idx
  ON public.agpay_webhook_events (status, available_at, received_at);
CREATE INDEX agpay_webhook_events_transaction_idx
  ON public.agpay_webhook_events (transaction_uuid, received_at DESC);

ALTER TABLE public.agpay_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agpay_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.agpay_webhook_events TO service_role;

CREATE TRIGGER agpay_webhook_events_updated
  BEFORE UPDATE ON public.agpay_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
