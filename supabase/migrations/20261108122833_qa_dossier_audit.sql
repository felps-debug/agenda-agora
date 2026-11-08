ALTER TABLE public.master_business_events
  DROP CONSTRAINT IF EXISTS master_business_events_type_check;
ALTER TABLE public.master_business_events
  ADD CONSTRAINT master_business_events_type_check CHECK (
    type IN (
      'cadastro', 'observacao', 'perfil', 'comercial', 'assinatura', 'pagamento',
      'suporte', 'suspensao', 'reativacao', 'security', 'edicao_ficha', 'troca_senha_dono'
    )
  );
