-- A permissão "Bloquear agenda" (block_agenda) equivale a "Criar horários
-- bloqueados" (block_schedule) na gestão de bloqueios de horário.
DROP POLICY IF EXISTS "time_blocks_professional_manage" ON public.time_blocks;

CREATE POLICY "time_blocks_professional_manage" ON public.time_blocks
FOR ALL TO authenticated
USING (
  public.has_business_permission(business_id, 'block_schedule')
  OR public.has_business_permission(business_id, 'block_agenda')
)
WITH CHECK (
  public.has_business_permission(business_id, 'block_schedule')
  OR public.has_business_permission(business_id, 'block_agenda')
);
