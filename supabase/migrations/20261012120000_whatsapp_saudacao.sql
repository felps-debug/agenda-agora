-- Saudação automática do WhatsApp (aba "Saudação" em /painel/lembretes): respondida
-- quando alguém manda mensagem no número do negócio. Tabela auxiliar limita a
-- 1 saudação por remetente a cada 24h.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS saudacao_template text;

CREATE TABLE IF NOT EXISTS public.whatsapp_greeting_replies (
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sender_phone text NOT NULL,
  replied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, sender_phone)
);

ALTER TABLE public.whatsapp_greeting_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_greeting_replies FROM anon, authenticated;
GRANT ALL ON public.whatsapp_greeting_replies TO service_role;
