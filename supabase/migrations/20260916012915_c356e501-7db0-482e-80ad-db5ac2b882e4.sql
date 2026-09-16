-- A leitura pública (anon) de businesses e professionals estava liberada para a linha inteira
-- (GRANT SELECT sem lista de colunas + policy USING (true)/USING (active)), expondo dados que
-- nunca deveriam sair do painel do dono: monthly_fee_cents, reminder_template, confirmation_template,
-- reminder_enabled/hours_before/channel, whatsapp_instance/whatsapp_status, owner_id e created_at em
-- businesses; e user_id, email, avatar_path, permissions (flags de acesso interno) e working_days em
-- professionals. Qualquer pessoa com a anon key (pública no bundle do site) podia consultar a REST API
-- do Supabase direto e ler isso de todo estabelecimento da plataforma, sem passar pela UI.
-- Restringe a leitura anônima às colunas que a página pública de agendamento (agendar.$slug) de fato usa.

REVOKE SELECT ON public.businesses FROM anon;
GRANT SELECT (id, name, category, phone, address, logo_url, status, brand_primary, brand_background)
  ON public.businesses TO anon;

REVOKE SELECT ON public.professionals FROM anon;
GRANT SELECT (id, name, role, active)
  ON public.professionals TO anon;
