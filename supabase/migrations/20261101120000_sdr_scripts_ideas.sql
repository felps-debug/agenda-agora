-- Kit de scripts do SDR: scripts pré-definidos escritos pelo master,
-- anotações livres do próprio SDR e o "Quadro de ideias" compartilhado.
alter table public.sdrs
  add column if not exists preset_scripts text not null default '',
  add column if not exists script_notes text not null default '';

create table if not exists public.sdr_ideas (
  id uuid primary key default gen_random_uuid(),
  sdr_id uuid not null references public.sdrs (id) on delete cascade,
  title text not null,
  details text not null default '',
  created_by text not null default 'master' check (created_by in ('master', 'sdr')),
  created_at timestamptz not null default now()
);

alter table public.sdr_ideas enable row level security;
-- Acesso somente pelas server functions (chave de serviço) — sem policies públicas.
