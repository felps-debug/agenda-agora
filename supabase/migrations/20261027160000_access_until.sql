-- Modelo de vencimento rolante: cada pagamento adiciona 30 dias a partir do
-- fim do acesso vigente (nunca come dias). O backfill preserva o vencimento
-- atual calculado pelo modelo antigo (ancora + meses pagos).
-- Idempotente.

alter table public.businesses
  add column if not exists access_until timestamptz;
