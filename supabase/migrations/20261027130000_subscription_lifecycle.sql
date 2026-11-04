-- Ciclo automático de assinaturas (Painel 3 Master):
-- registros de cancelamento solicitado/efetivado por estabelecimento.
-- As demais categorias (em teste, assinante, atenção) são derivadas das datas
-- reais (teste, vencimento, pagamentos confirmados) sem estado armazenado.
-- Idempotente.

alter table public.businesses
  add column if not exists cancel_requested_at timestamptz,
  add column if not exists cancelled_at timestamptz;
