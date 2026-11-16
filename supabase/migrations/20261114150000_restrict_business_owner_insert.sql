-- Business creation must pass through authorized server functions using service_role.
-- Owners may read and update only their businesses, with update scope bounded by RLS
-- and column privileges granted by the security-hardening migration.
DROP POLICY IF EXISTS "businesses_own" ON public.businesses;
DROP POLICY IF EXISTS businesses_owner_select ON public.businesses;
DROP POLICY IF EXISTS businesses_owner_update ON public.businesses;

CREATE POLICY businesses_owner_select ON public.businesses
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY businesses_owner_update ON public.businesses
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

REVOKE INSERT, DELETE ON public.businesses FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.businesses TO service_role;
