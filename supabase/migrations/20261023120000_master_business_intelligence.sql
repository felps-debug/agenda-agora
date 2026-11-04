-- Ficha de inteligência do estabelecimento (Painel 3 Master).
--
-- Duas estruturas novas, restritas ao super_admin:
--  - master_business_notes: observações internas do relacionamento (não podem
--    aparecer no Painel 2 do estabelecimento);
--  - master_business_events: trilha de auditoria das ações administrativas
--    (suspensão, reativação, edição de dados, observações, cobrança).
--
-- As leituras/escritas do Painel 3 passam por funções de servidor que exigem
-- a role `super_admin` (ver src/lib/auth/require-super-admin.ts). As policies
-- abaixo são a segunda camada de proteção caso alguém leia direto do banco.
--
-- Rollback: drop table public.master_business_events;
--            drop table public.master_business_notes;
--            alter table public.businesses drop column if exists lead_source,
--              drop column if exists sales_owner,
--              drop column if exists commercial_notes;

CREATE TABLE IF NOT EXISTS public.master_business_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  next_step text CHECK (next_step IS NULL OR char_length(next_step) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS master_business_notes_business_created_idx
  ON public.master_business_notes (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.master_business_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (
    type IN (
      'cadastro',
      'observacao',
      'perfil',
      'comercial',
      'assinatura',
      'pagamento',
      'suporte',
      'suspensao',
      'reativacao'
    )
  ),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS master_business_events_business_created_idx
  ON public.master_business_events (business_id, created_at DESC);

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS lead_source text,
  ADD COLUMN IF NOT EXISTS sales_owner text,
  ADD COLUMN IF NOT EXISTS commercial_notes text;

GRANT ALL ON public.master_business_notes TO service_role;
GRANT ALL ON public.master_business_events TO service_role;
GRANT SELECT ON public.master_business_notes TO authenticated;
GRANT SELECT ON public.master_business_events TO authenticated;

ALTER TABLE public.master_business_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_business_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master_business_notes_super_admin" ON public.master_business_notes;
CREATE POLICY "master_business_notes_super_admin" ON public.master_business_notes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "master_business_events_super_admin" ON public.master_business_events;
CREATE POLICY "master_business_events_super_admin" ON public.master_business_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
