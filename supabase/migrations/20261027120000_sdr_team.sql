-- Equipe SDR do Painel 3 Master: cadastro da equipe, metas, comissão e
-- atribuição de estabelecimentos criados pelos SDRs.
-- Idempotente: pode ser executada mais de uma vez.

create table if not exists public.sdrs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  pin text not null,
  active boolean not null default true,
  signup_goal integer not null default 0,
  sales_goal integer not null default 0,
  commission_cents integer not null default 5000,
  created_at timestamptz not null default now()
);

-- Sem políticas públicas: somente o backend (service_role) lê e escreve.
alter table public.sdrs enable row level security;

-- Atribuição do estabelecimento ao SDR que o cadastrou.
alter table public.businesses
  add column if not exists sdr_id uuid references public.sdrs (id) on delete set null;

create index if not exists businesses_sdr_id_idx on public.businesses (sdr_id);

-- Segredo usado para assinar os tokens de sessão do painel do SDR.
create table if not exists public.sdr_config (
  id boolean primary key default true check (id),
  secret text not null default gen_random_uuid()::text
);

alter table public.sdr_config enable row level security;

insert into public.sdr_config (id) values (true) on conflict (id) do nothing;
