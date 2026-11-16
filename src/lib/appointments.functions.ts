import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statusValues = ["agendado", "confirmado", "concluido", "cancelado", "bloqueado"] as const;
const reopenableFrom = new Set(["cancelado", "concluido"]);

/** Extraída pra ser testável sem precisar de servidor/banco — ver appointments.functions.test.ts. */
export function permissionForStatusChange(
  currentStatus: string,
  nextStatus: string,
): "reopen_appointment" | "cancel_appointment" | "complete_appointment" | "block_schedule" | null {
  if (currentStatus === "bloqueado" || nextStatus === "bloqueado") return "block_schedule";
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
    z.object({ id: z.string().guid(), status: z.enum(statusValues) }).parse(data),
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

    let allowed: boolean | null;
    let permError: { message: string } | null;
    if (requiredPermission === "block_schedule") {
      const schedulePermission = await context.supabase.rpc("has_business_permission", {
        _business_id: appt.business_id,
        _permission: "block_schedule",
      });
      if (schedulePermission.error) throw new Error(schedulePermission.error.message);
      if (schedulePermission.data) {
        allowed = true;
        permError = null;
      } else {
        const legacyPermission = await context.supabase.rpc("has_business_permission", {
          _business_id: appt.business_id,
          _permission: "block_agenda",
        });
        allowed = legacyPermission.data;
        permError = legacyPermission.error;
      }
    } else if (requiredPermission) {
      const permissionResult = await context.supabase.rpc("has_business_permission", {
        _business_id: appt.business_id,
        _permission: requiredPermission,
      });
      allowed = permissionResult.data;
      permError = permissionResult.error;
    } else {
      const membershipResult = await context.supabase.rpc("is_business_member", {
        _business_id: appt.business_id,
      });
      allowed = membershipResult.data;
      permError = membershipResult.error;
    }
    if (permError) throw new Error(permError.message);
    if (!allowed) throw new Error("Você não tem permissão pra fazer essa mudança de status.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("status", appt.status)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("O agendamento mudou; atualize a tela e tente novamente.");

    if (data.status === "concluido" && appt.status !== "concluido") {
      const { enqueuePostServiceMessage } = await import("@/lib/whatsapp-greeting.server");
      try {
        await enqueuePostServiceMessage(data.id, appt.business_id);
      } catch (queueError) {
        console.error("Falha ao agendar mensagem pós-atendimento:", queueError);
      }
    }
    return { ok: true };
  });
