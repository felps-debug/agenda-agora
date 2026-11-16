-- O historico e populado pelo webhook/admin com service_role; clientes autenticados so consultam.
DROP POLICY IF EXISTS subscription_payments_owner ON public.subscription_payments;

REVOKE ALL ON TABLE public.subscription_payments FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.subscription_payments FROM authenticated;
GRANT SELECT ON TABLE public.subscription_payments TO authenticated;
GRANT ALL ON TABLE public.subscription_payments TO service_role;
