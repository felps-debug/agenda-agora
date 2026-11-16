-- Bloqueios são usados apenas pela disponibilidade server-side; o REST público
-- não precisa expor horários internos ou o campo livre `reason`.
REVOKE SELECT ON TABLE public.time_blocks FROM anon;
DROP POLICY IF EXISTS time_blocks_public_read ON public.time_blocks;
