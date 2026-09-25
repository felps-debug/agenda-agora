import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statusValues = ["agendado", "confirmado", "concluido", "cancelado", "bloqueado"] as const;
const reopenableFrom = new Set(["cancelado", "concluido"]);

/** Extraída pra ser testável sem precisar de servidor/banco — ver appointments.functions.test.ts. */
export function permissionForStatusChange(
  currentStatus: string,
  nextStatus: string,
): "reopen_appointment" | "cancel_appointment" | "complete_appointment" | null {
  if (reopenableFrom.has(currentStatus) && !reopenableFrom.has(nextStatus))
    return "reopen_appointment";
  if (nextStatus === "cancelado") return "cancel_appointment";
  if (nextStatus === "concluido") return "complete_appointment";
  return null;
}

/**
 * Muda o status de um agendamento, exigindo a permissão granular certa quando a
 * transição é sensível (cancelar / concluir / reabrir). Sem isso, as flags
 * cancel_appointment/complete_appointment/reopen_appointment em
 * professionals.permissions existiam no schema mas não tinham nenhuma policy de
 * RLS de UPDATE em appointments as tornando efetivas — só o dono conseguia mudar
 * status, mesmo marcando a permissão pro funcionário no painel.
 */
export const setAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(statusValues) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: appt, error: apptError } = await context.supabase
      .from("appointments")
      .select("id, business_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (apptError) throw new Error(apptError.message);
    if (!appt) throw new Error("Agendamento não encontrado.");

    const requiredPermission = permissionForStatusChange(appt.status, data.status);

    const { data: allowed, error: permError } = requiredPermission
      ? await context.supabase.rpc("has_business_permission", {
          _business_id: appt.business_id,
          _permission: requiredPermission,
        })
      : await context.supabase.rpc("is_business_member", { _business_id: appt.business_id });
    if (permError) throw new Error(permError.message);
    if (!allowed) throw new Error("Você não tem permissão pra fazer essa mudança de status.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
