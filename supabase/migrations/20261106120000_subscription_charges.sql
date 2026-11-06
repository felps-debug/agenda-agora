-- US7: cobrança da assinatura (ciclo de 30 dias) via Ag Pay. Pix agora; cartão depois.
-- Decisão 2026-11-06: o CPF do dono (pagador) é guardado no cadastro do negócio e
-- reusado em toda cobrança (o e-mail vem do Auth). Coluna nula até o dono informar.
alter table public.businesses
  add column if not exists owner_cpf text;

-- Cobranças de assinatura: uma linha por cobrança (one-off por ciclo; o AgPay não tem
-- recorrência nativa, então o ciclo de 30 dias é controlado pelo nosso backend).
create table if not exists public.subscription_charges (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  method text not null default 'pix' check (method in ('pix', 'card')),
  provider text not null default 'agpay',
  -- Identificador do provedor (transaction_uuid do AgPay). Único para idempotência
  -- do webhook; múltiplos NULL são permitidos (cobrança ainda sem POST ao provedor).
  provider_payment_id text unique,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'expired')),
  period_start timestamptz,
  period_end timestamptz,
  payer_cpf text,
  payer_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists subscription_charges_business_created_idx
  on public.subscription_charges (business_id, created_at desc);

alter table public.subscription_charges enable row level security;
-- Dono lê as próprias cobranças; escrita é exclusiva das funções de servidor (service_role).
create policy "Owners can read own subscription charges" on public.subscription_charges
  for select using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  ));
revoke insert, update, delete on public.subscription_charges from anon, authenticated;
grant all on public.subscription_charges to service_role;

-- Rollback:
-- drop policy "Owners can read own subscription charges" on public.subscription_charges;
-- drop table public.subscription_charges;
-- alter table public.businesses drop column if exists owner_cpf;
