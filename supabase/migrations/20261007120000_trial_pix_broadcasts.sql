-- Contas de teste, aprovação de chaves Pix e avisos broadcast.
alter table businesses
  add column if not exists trial_days integer,
  add column if not exists trial_registration_name text,
  add column if not exists trial_created_at timestamptz;

create table if not exists pix_key_approvals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  key_type text not null,
  key text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  created_at timestamptz not null default now()
);

create table if not exists broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table pix_key_approvals enable row level security;
alter table broadcasts enable row level security;

-- Donos inserem e leem apenas as aprovações do próprio negócio.
create policy "owner reads own business pix approvals" on pix_key_approvals
  for select using (business_id in (select id from businesses where owner_id = auth.uid()));
create policy "owner inserts pix approvals for own business" on pix_key_approvals
  for insert with check (business_id in (select id from businesses where owner_id = auth.uid()));

-- Todo usuário autenticado pode ler os avisos broadcast.
create policy "authenticated reads broadcasts" on broadcasts
  for select using (auth.role() = 'authenticated');

-- Gravações (criar/aprovar/excluir) passam pelas server functions com service role (bypass RLS).
