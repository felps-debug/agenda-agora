REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owns_business(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_business(UUID) TO authenticated;
GRANT SELECT ON public.businesses TO anon;
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.professionals TO anon;
CREATE POLICY "businesses_public_read" ON public.businesses FOR SELECT TO anon USING (true);
CREATE POLICY "services_public_read" ON public.services FOR SELECT TO anon USING (active);
CREATE POLICY "professionals_public_read" ON public.professionals FOR SELECT TO anon USING (active);;
