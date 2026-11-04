-- Sessões de impersonação (master entra no Painel 2 do cliente).
-- O banner de retorno só aparece com um token válido, vinculado ao negócio
-- impersonado e ao master que iniciou; a volta exige o PIN fixo da equipe.
-- Idempotente.

create table if not exists public.master_impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  master_user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Sem políticas públicas: somente o backend (service_role) lê e escreve.
alter table public.master_impersonation_sessions enable row level security;

create index if not exists master_impersonation_sessions_token_idx
  on public.master_impersonation_sessions (token);
