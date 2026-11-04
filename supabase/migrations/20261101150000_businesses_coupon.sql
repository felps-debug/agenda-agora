-- Cupom de desconto por estabelecimento: criado pelo master no dossier
-- ("Assinatura e cobranças"). Desativado = colunas nulas. Expira sozinho.
alter table public.businesses
  add column if not exists coupon_code text,
  add column if not exists coupon_percent integer,
  add column if not exists coupon_expires_at timestamptz;
