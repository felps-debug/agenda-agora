-- Senha de transferência da carteira Ag Pay (4 dígitos, armazenada como hash
-- SHA-256 no servidor). Preenchida uma única vez junto da chave Pix.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS withdrawal_pin_hash text;
