-- A senha de transferência da carteira Ag Pay também fica legível (texto)
-- para o Painel master visualizar e alterar. A validação de transações
-- continua pelo hash SHA-256 (withdrawal_pin_hash).
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS withdrawal_pin_plain text;
