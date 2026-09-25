// Envio automático de WhatsApp: confirmação (após pagar o sinal) e lembrete
// (X horas antes do horário, disparado pelo agendador).
import { sendTextMessage } from "./uazapi.server";

function formatDatePtBr(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTimePtBr(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const DEFAULT_CONFIRMATION_MESSAGE =
  "Olá, {nome}! Seu sinal foi recebido e seu horário de {servico} está confirmado para {data} às {hora} em {negocio}. Até lá! ✅";

export const DEFAULT_REMINDER_MESSAGE =
  "Olá, {nome}! Lembrete: seu horário de {servico} em {negocio} é {data} às {hora}. Qualquer imprevisto, avisa a gente! 😊";

export function renderMessage(template: string, vars: Record<string, string>) {
  return template.replace(/\{(nome|servico|hora|data|negocio)\}/g, (_, k) => vars[k] ?? "");
}

type AppointmentRow = {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone: string | null;
  starts_at: string;
  service_id: string | null;
};

async function loadContext(appointmentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select("id, business_id, customer_name, customer_phone, starts_at, service_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt?.customer_phone) return null;

  const { data: business } = await supabaseAdmin
    .from("businesses")
    .select(
      "id, name, whatsapp_instance, whatsapp_status, confirmation_template, reminder_template",
    )
    .eq("id", appt.business_id)
    .maybeSingle();
  if (!business?.whatsapp_instance || business.whatsapp_status !== "conectado") return null;

  let serviceName = "serviço";
  if ((appt as AppointmentRow).service_id) {
    const { data: service } = await supabaseAdmin
      .from("services")
      .select("name")
      .eq("id", (appt as AppointmentRow).service_id!)
      .maybeSingle();
    if (service?.name) serviceName = service.name;
  }

  const row = appt as AppointmentRow;
  const firstName = row.customer_name.split(" ")[0] ?? row.customer_name;
  const vars = {
    nome: firstName,
    servico: serviceName,
    data: formatDatePtBr(row.starts_at),
    hora: formatTimePtBr(row.starts_at),
    negocio: business.name,
  };
  return { row, business, vars };
}

/**
 * Mensagem 1 — confirmação: enviada assim que o sinal Pix é aprovado.
 * Nunca lança erro para não quebrar o fluxo de pagamento.
 */
export async function sendBookingConfirmation(appointmentId: string) {
  try {
    const ctx = await loadContext(appointmentId);
    if (!ctx) return;
    const template = ctx.business.confirmation_template || DEFAULT_CONFIRMATION_MESSAGE;
    await sendTextMessage(ctx.row.customer_phone!, renderMessage(template, ctx.vars));
  } catch (err) {
    console.error("Falha ao enviar WhatsApp de confirmação:", err);
  }
}

/**
 * Mensagem 2 — lembrete: enviada pelo agendador X horas antes do horário.
 * Lança erro para o chamador registrar em reminder_logs.
 */
export async function sendBookingReminder(appointmentId: string) {
  const ctx = await loadContext(appointmentId);
  if (!ctx) throw new Error("Agendamento sem telefone ou WhatsApp desconectado.");
  const template = ctx.business.reminder_template || DEFAULT_REMINDER_MESSAGE;
  await sendTextMessage(ctx.row.customer_phone!, renderMessage(template, ctx.vars));
}
