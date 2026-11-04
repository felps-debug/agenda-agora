-- Bloqueios AG Pay controlados pelo Painel master + chat de suporte em tempo real.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS agpay_access_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agpay_withdrawal_blocked boolean NOT NULL DEFAULT false;

-- Conversa de suporte: o dono manda perguntas (sender='user'), o master responde
-- (sender='master') em tempo real; contadores de não lidas para os dois lados.
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user', 'master')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  read_by_master boolean NOT NULL DEFAULT true,
  read_by_user boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_business_created
  ON public.support_messages (business_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_owner_select" ON public.support_messages
  FOR SELECT TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()));

CREATE POLICY "support_owner_insert_user" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    AND sender = 'user'
    AND read_by_user IS NOT NULL
  );

CREATE POLICY "support_owner_update_read" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid()))
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
    AND sender = 'master'
    AND read_by_user
  );
