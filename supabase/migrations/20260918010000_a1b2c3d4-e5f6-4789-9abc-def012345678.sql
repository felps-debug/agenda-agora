-- Integração Asaas multi-tenant.
-- A cobrança é emitida pela subconta do estabelecimento; credenciais e inbox
-- de Webhook são acessíveis somente pelo backend com service_role.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS asaas_wallet_id text,
  ADD COLUMN IF NOT EXISTS asaas_subaccount_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS asaas_commission_percent numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_asaas_subaccount_status_check,
  ADD CONSTRAINT businesses_asaas_subaccount_status_check
    CHECK (asaas_subaccount_status IN ('pendente', 'em_analise', 'aprovada', 'bloqueada')),
  DROP CONSTRAINT IF EXISTS businesses_asaas_commission_percent_check,
  ADD CONSTRAINT businesses_asaas_commission_percent_check
    CHECK (asaas_commission_percent >= 0 AND asaas_commission_percent < 100);

CREATE UNIQUE INDEX IF NOT EXISTS businesses_asaas_wallet_id_unique
  ON public.businesses (asaas_wallet_id)
  WHERE asaas_wallet_id IS NOT NULL;

COMMENT ON COLUMN public.businesses.asaas_subaccount_status IS
  'pendente | em_analise | aprovada | bloqueada';
COMMENT ON COLUMN public.businesses.asaas_commission_percent IS
  'Percentual do netValue enviado da subconta para a carteira master.';

CREATE TABLE IF NOT EXISTS public.asaas_business_credentials (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  asaas_account_id text,
  api_key_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_business_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.asaas_business_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.asaas_business_credentials TO service_role;

DROP TRIGGER IF EXISTS asaas_business_credentials_updated
  ON public.asaas_business_credentials;
CREATE TRIGGER asaas_business_credentials_updated
  BEFORE UPDATE ON public.asaas_business_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.deposit_payments
  ADD COLUMN IF NOT EXISTS payer_cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_account_id text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_deleted_at timestamptz;

ALTER TABLE public.deposit_payments ALTER COLUMN provider SET DEFAULT 'asaas';

-- Esta tabela só é usada por server functions. Evita que CPF/CNPJ temporário,
-- QR Code ou identificadores financeiros sejam lidos pelo Data API do cliente.
REVOKE ALL ON TABLE public.deposit_payments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.deposit_payments TO service_role;
DROP POLICY IF EXISTS deposit_payments_owner ON public.deposit_payments;

CREATE UNIQUE INDEX IF NOT EXISTS deposit_payments_provider_payment_unique
  ON public.deposit_payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  account_id text,
  payment_id text,
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

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.asaas_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.asaas_webhook_events TO service_role;

CREATE INDEX IF NOT EXISTS asaas_webhook_events_pending_idx
  ON public.asaas_webhook_events (status, available_at, received_at);
CREATE INDEX IF NOT EXISTS asaas_webhook_events_payment_idx
  ON public.asaas_webhook_events (payment_id, received_at DESC);

DROP TRIGGER IF EXISTS asaas_webhook_events_updated
  ON public.asaas_webhook_events;
CREATE TRIGGER asaas_webhook_events_updated
  BEFORE UPDATE ON public.asaas_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
