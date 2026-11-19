import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PAYMENT_METHODS,
  descriptionFromNotes,
  notesWithPaymentMethod,
} from "@/lib/payment-method";

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
  .handler(async ({ context, data }) => {    const { data: appt, error: apptError } = await context.supabase
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

/**
 * Prazos das cobranças de sinal pendentes do negócio (fila do Pix obrigatório
 * na agenda do painel 2). deposit_payments não é legível pelo Data API —
 * o dono lê via aqui, autorizado como membro do próprio negócio.
 */
export const getPendingDepositExpiries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    // Mantém a fila do Pix expirando em tempo real também com o painel aberto.
    void import("./agpay-events.server")
      .then((m) => m.sweepExpiredDeposits())
      .catch(() => {});

    const { data: allowed, error: permError } = await context.supabase.rpc(
      "is_business_member",
      { _business_id: data.businessId },
    );
    if (permError) throw new Error(permError.message);
    if (!allowed) throw new Error("Você não tem permissão nesta agenda.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: charges, error } = await supabaseAdmin
      .from("deposit_payments")
      .select("appointment_id, expires_at, amount_cents")
      .eq("business_id", data.businessId)
      .eq("status", "pendente");
    if (error) throw new Error(error.message);
    return (charges ?? [])
      .filter((charge) => charge.appointment_id)
      .map((charge) => ({
        appointmentId: charge.appointment_id as string,
        expiresAt: charge.expires_at as string,
        amountCents: charge.amount_cents as number,
      }));
  });

/**
 * "Pular etapa": o dono dispensa o sinal e confirma o cliente na agenda.
 * A cobrança pendente vira "isento" (sai da fila do Pix para sempre — a
 * varredura nunca cancela esse agendamento) e o horário fica confirmado.
 */export const skipDepositStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ appointmentId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: appt, error: apptError } = await context.supabase
      .from("appointments")
      .select("id, business_id, status")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (apptError) throw new Error(apptError.message);
    if (!appt) throw new Error("Agendamento não encontrado.");

    const { data: allowed, error: permError } = await context.supabase.rpc(
      "is_business_member",
      { _business_id: appt.business_id },
    );
    if (permError) throw new Error(permError.message);
    if (!allowed) throw new Error("Você não tem permissão nesta agenda.");
    if (appt.status !== "aguardando_sinal")
      throw new Error("Esse agendamento não está mais aguardando pagamento.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: chargeError } = await supabaseAdmin
      .from("deposit_payments")
      .update({
        status: "isento",
        expires_at: null,
        qr_code: null,
        qr_code_base64: null,
        ticket_url: null,
      })
      .eq("appointment_id", appt.id)
      .eq("status", "pendente");
    if (chargeError) throw new Error(chargeError.message);

    const { error: statusError } = await supabaseAdmin
      .from("appointments")
      .update({ status: "agendado" })
      .eq("id", appt.id);
    if (statusError) throw new Error(statusError.message);
    return { ok: true };
  });

/**
 * "Finalizar serviço": conclui o atendimento gravando a forma de pagamento
 * escolhida (obrigatória). Pendente de sinal não finaliza — o dono resolve o
 * Pix (ou usa "Pular etapa") primeiro. O registro depois fica somente leitura.
 */
export const finalizeAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), paymentMethod: z.enum(PAYMENT_METHODS) })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: appt, error: apptError } = await context.supabase
      .from("appointments")
      .select("id, business_id, status, notes")
      .eq("id", data.id)
      .maybeSingle();
    if (apptError) throw new Error(apptError.message);
    if (!appt) throw new Error("Agendamento não encontrado.");
    if (appt.status === "aguardando_sinal")
      throw new Error("Resolva o pagamento do sinal (ou use Pular etapa) antes de finalizar.");

    if (appt.status !== "concluido") {
      const { data: allowed, error: permError } = await context.supabase.rpc(
        "has_business_permission",
        { _business_id: appt.business_id, _permission: "complete_appointment" },
      );
      if (permError) throw new Error(permError.message);
      if (!allowed) throw new Error("Você não tem permissão pra finalizar serviços.");

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: updateError } = await supabaseAdmin
        .from("appointments")
        .update({
          status: "concluido",
          notes: notesWithPaymentMethod(appt.notes, data.paymentMethod),
        })
        .eq("id", appt.id);
      if (updateError) throw new Error(updateError.message);
    }
    return { ok: true };
  });

/** "Desfazer registro": devolve o atendimento para a agenda (reagendável). */
export const reopenRealizedAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: appt, error: apptError } = await context.supabase
      .from("appointments")
      .select("id, business_id, status, notes")
      .eq("id", data.id)
      .maybeSingle();
    if (apptError) throw new Error(apptError.message);
    if (!appt) throw new Error("Agendamento não encontrado.");
    if (appt.status !== "concluido")
      throw new Error("Esse atendimento não está finalizado.");

    const { data: allowed, error: permError } = await context.supabase.rpc(
      "is_business_member",
      { _business_id: appt.business_id },
    );
    if (permError) throw new Error(permError.message);
    if (!allowed) throw new Error("Você não tem permissão nesta agenda.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("appointments")
      .update({ status: "agendado", notes: descriptionFromNotes(appt.notes) || null })
      .eq("id", appt.id);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });
