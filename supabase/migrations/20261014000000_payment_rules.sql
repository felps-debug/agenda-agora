-- Regras de pagamento da carteira Ag Pay por negócio: modo do Pix
-- (desabilitado, opcional ou obrigatório) e lista de clientes/assinantes
-- isentos da obrigatoriedade.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS pix_mode text NOT NULL DEFAULT 'opcional',
  ADD COLUMN IF NOT EXISTS pix_exception_clients text[] NOT NULL DEFAULT '{}';
