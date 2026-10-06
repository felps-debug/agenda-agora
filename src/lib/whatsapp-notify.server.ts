// Envio automático de WhatsApp: confirmação (após pagar o sinal) e lembrete
// (X horas antes do horário, disparado pelo agendador).
import { loadWhatsappProvider } from "./whatsapp-provider.server";

async function sendTextMessage(instanceToken: string, phone: string, message: string) {
  const provider = await loadWhatsappProvider();
  await provider.sendTextMessage(instanceToken, phone, message);
}

function formatDatePtBr(iso: string, timezone: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTimePtBr(iso: string, timezone: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: timezone,
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
      "id, name, timezone, greeting, whatsapp_instance, whatsapp_status, whatsapp_instance_token, confirmation_template, reminder_template, payment_confirmation_template",
    )
    .eq("id", appt.business_id)
    .maybeSingle();
  if (!business?.whatsapp_instance) return null;
  const { readWhatsappCredential } = await import("./whatsapp-credentials.server");
  const privateCredential = await readWhatsappCredential(supabaseAdmin, business.id);
  const instanceToken = privateCredential?.instanceToken ?? business.whatsapp_instance_token;
  if (!instanceToken) return null;

  // whatsapp_status no banco só é atualizado quando o dono visita /painel/integracoes;
  // checar a sessão ao vivo aqui evita descartar notificações por status desatualizado.
  const { isConnected } = await loadWhatsappProvider();
  const online = await isConnected(instanceToken).catch(() => false);
  if (!online) return null;
  if (business.whatsapp_status !== "conectado") {
    await supabaseAdmin
      .from("businesses")
      .update({ whatsapp_status: "conectado" })
      .eq("id", business.id);
  }

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
  const timezone = business.timezone || "America/Sao_Paulo";
  const vars = {
    nome: firstName,
    servico: serviceName,
    data: formatDatePtBr(row.starts_at, timezone),
    hora: formatTimePtBr(row.starts_at, timezone),
    negocio: business.name,
  };
  return {
    row,
    business,
    vars,
    greeting: business.greeting,
    instanceToken,
  };
}

/**
 * Mensagem 1 — confirmação de reserva sem sinal: enviada assim que o horário é reservado.
 * (Com sinal, a confirmação é `sendPaymentConfirmation`, após a aprovação do Pix.)
 * Nunca lança erro para não quebrar o fluxo de reserva.
 */
export async function sendBookingConfirmation(appointmentId: string) {
  try {
    const ctx = await loadContext(appointmentId);
    if (!ctx) return;
    const template = ctx.business.confirmation_template || DEFAULT_CONFIRMATION_MESSAGE;
    await sendTextMessage(
      ctx.instanceToken,
      ctx.row.customer_phone!,
      [ctx.greeting?.trim(), renderMessage(template, ctx.vars)].filter(Boolean).join("\n\n"),
    );
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
  await sendTextMessage(
    ctx.instanceToken,
    ctx.row.customer_phone!,
    [ctx.greeting?.trim(), renderMessage(template, ctx.vars)].filter(Boolean).join("\n\n"),
  );
}

export function isReminderDue(startsAt: string, now: Date, leadMinutes: number) {
  const remaining = new Date(startsAt).getTime() - now.getTime();
  return remaining > 0 && remaining <= leadMinutes * 60_000;
}

export async function sendExtraBookingReminder(appointmentId: string, template: string) {
  const ctx = await loadContext(appointmentId);
  if (!ctx) throw new Error("Agendamento sem telefone ou WhatsApp conectado.");
  await sendTextMessage(
    ctx.instanceToken,
    ctx.row.customer_phone!,
    [ctx.greeting?.trim(), renderMessage(template, ctx.vars)].filter(Boolean).join("\n\n"),
  );
}

export async function sendPaymentConfirmation(appointmentId: string) {
  try {
    const ctx = await loadContext(appointmentId);
    if (!ctx) return;
    const template = ctx.business.payment_confirmation_template || DEFAULT_CONFIRMATION_MESSAGE;
    await sendTextMessage(
      ctx.instanceToken,
      ctx.row.customer_phone!,
      [ctx.greeting?.trim(), renderMessage(template, ctx.vars)].filter(Boolean).join("\n\n"),
    );
  } catch (err) {
    console.error("Falha ao enviar confirmação de pagamento pelo WhatsApp:", err);
  }
}
