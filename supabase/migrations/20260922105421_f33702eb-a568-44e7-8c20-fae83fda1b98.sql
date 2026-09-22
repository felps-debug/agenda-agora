-- Flag "sem sinal" por serviço, chave PIX de saque do negócio e templates
-- de divulgação gerenciados pelo super_admin (specs/001-novo-layout-e-templates).

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS requires_deposit boolean NOT NULL DEFAULT true;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS withdrawal_pix_key text,
  ADD COLUMN IF NOT EXISTS withdrawal_pix_key_type text;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_withdrawal_pix_key_type_check,
  ADD CONSTRAINT businesses_withdrawal_pix_key_type_check
    CHECK (withdrawal_pix_key_type IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria'));

CREATE TABLE IF NOT EXISTS public.outreach_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  usage_type text NOT NULL CHECK (usage_type IN ('story', 'whatsapp', 'outro')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.outreach_templates TO authenticated;
GRANT ALL ON public.outreach_templates TO service_role;
ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS outreach_templates_updated ON public.outreach_templates;
CREATE TRIGGER outreach_templates_updated
  BEFORE UPDATE ON public.outreach_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leitura: qualquer usuário autenticado vinculado a um negócio (owner_id = auth.uid())
-- vê os templates ativos. Super_admin também lê (inclusive inativos) via segunda policy.
CREATE POLICY "outreach_templates_business_read" ON public.outreach_templates
FOR SELECT TO authenticated
USING (
  active = true
  AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.owner_id = auth.uid())
);

CREATE POLICY "outreach_templates_super_admin_all" ON public.outreach_templates
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
