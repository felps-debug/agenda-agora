-- Taxa fixa de saque da plataforma (R$ 3,00 em 05/10/2026), registrada por saque para que
-- mudanças futuras do valor não reescrevam o histórico. O valor pedido (amount_cents) sai
-- inteiro da carteira; o Pix enviado ao dono é amount_cents - platform_fee_cents.
-- Saques anteriores ficam com 0 (a plataforma cobria a taxa).

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS platform_fee_cents integer NOT NULL DEFAULT 0
  CHECK (platform_fee_cents >= 0);

-- Rollback: ALTER TABLE public.withdrawals DROP COLUMN IF EXISTS platform_fee_cents;
