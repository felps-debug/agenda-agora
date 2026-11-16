alter table public.businesses
  add column if not exists owner_cpf text;

create table if not exists public.subscription_charges (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  method text not null default 'pix' check (method in ('pix', 'card')),
  provider text not null default 'agpay',
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
create policy "Owners can read own subscription charges" on public.subscription_charges
  for select using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()
  ));
revoke insert, update, delete on public.subscription_charges from anon, authenticated;
grant all on public.subscription_charges to service_role;;
