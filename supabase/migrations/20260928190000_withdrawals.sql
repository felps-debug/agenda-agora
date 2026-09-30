-- T026: saques solicitados pelo dono, com escrita exclusiva por funções de servidor.
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 1000),
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'paid', 'failed', 'canceled')),
  idempotency_key text not null unique,
  pix_key_snapshot text not null,
  provider_ref text,
  provider_fee_cents integer check (provider_fee_cents is null or provider_fee_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawals_business_created_idx
  on public.withdrawals (business_id, created_at desc);

alter table public.withdrawals enable row level security;
create policy "Owners can read own withdrawals" on public.withdrawals
  for select using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  ));
revoke insert, update, delete on public.withdrawals from anon, authenticated;
grant all on public.withdrawals to service_role;

-- Rollback: drop policy "Owners can read own withdrawals" on public.withdrawals;
-- drop table public.withdrawals;
