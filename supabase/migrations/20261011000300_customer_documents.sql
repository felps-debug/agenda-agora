-- Documento e nascimento do cliente (diálogo "Cadastrar Cliente").
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS cnpj text;
