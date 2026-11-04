// Saudação automática do WhatsApp (aba "Saudação" em /painel/lembretes).
// Quando alguém manda mensagem no número do negócio, o provedor (UazAPI ou
// Evolution) avisa via webhook em /api/public/whatsapp-incoming e este módulo
// decide se responde com a saudação configurada (máx. 1 por remetente a cada 24h).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { bookingLinkForSlug, renderMessage } from "./whatsapp-notify.server";
import { getPublicAppUrl, getWhatsAppWebhookSecret } from "@/lib/env-security.server";
import { loadPanel1Config } from "@/lib/panel1-config.storage";

export const GREETING_COOLDOWN_MS = 24 * 60 * 60 * 1_000;

export type IncomingWhatsappMessage = {
  fromMe: boolean;
  isGroup: boolean;
  /** Dígitos com DDI (ex.: 5598999990000). */
  senderPhone: string;
  pushName: string | null;
  text: string;
};

function digitsOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // LIDs (@lid) e IDs internos não são discáveis: só aceita JID de usuário.
  if (!value.includes("@s.whatsapp.net")) return null;
  const digits = value.slice(0, value.indexOf("@")).replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  return digits;
}

function messageText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const m = message as Record<string, unknown>;
  if (typeof m["conversation"] === "string") return m["conversation"];
  for (const key of ["extendedTextMessage", "imageMessage", "videoMessage", "documentMessage"]) {
    const part = m[key];
    if (part && typeof part === "object") {
      const record = part as Record<string, unknown>;
      if (typeof record["text"] === "string") return record["text"];
      if (typeof record["caption"] === "string") return record["caption"];
    }
  }
  return "";
}

/**
 * Extrai a primeira mensagem recebida de um payload de webhook, aceitando os
 * formatos da UazAPI ({ event: "messages", instance, data }) e da Evolution
 * (MESSAGES_UPSERT, com data.messages[] ou data direto). Retorna null quando
 * não há mensagem de um cliente (própria, grupo, remetente inválido).
 */
export function parseIncomingWhatsapp(payload: unknown): IncomingWhatsappMessage | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data =
    root["data"] && typeof root["data"] === "object"
      ? (root["data"] as Record<string, unknown>)
      : root;
  const candidates: unknown[] = Array.isArray(data["messages"]) ? data["messages"] : [data];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const c = candidate as Record<string, unknown>;
    const key =
      c["key"] && typeof c["key"] === "object" ? (c["key"] as Record<string, unknown>) : {};
    const remoteJid =
      typeof key["remoteJid"] === "string"
        ? key["remoteJid"]
        : typeof c["remoteJid"] === "string"
          ? c["remoteJid"]
          : null;
    const fromMe = key["fromMe"] === true || c["fromMe"] === true;
    if (fromMe) continue;
    if (remoteJid?.endsWith("@g.us")) continue;
    const senderPhone =
      digitsOf(remoteJid) ?? digitsOf(c["sender"]) ?? digitsOf(c["from"]) ?? digitsOf(c["number"]);
    if (!senderPhone) continue;
    const pushName =
      typeof c["pushName"] === "string"
        ? c["pushName"]
        : typeof data["pushName"] === "string"
          ? data["pushName"]
          : null;
    const text =
      messageText(c["message"] ?? c).trim() +
      (typeof c["text"] === "string" && !c["message"] ? c["text"].trim() : "");
    return { fromMe: false, isGroup: false, senderPhone, pushName, text };
  }
  return null;
}

type GreetingBusiness = {
  id: string;
  name: string;
  slug: string;
  greeting: string | null;
  saudacao_template: string | null;
  whatsapp_instance: string | null;
  whatsapp_instance_token: string | null;
};

function isMissingColumnError(error: { message: string }): boolean {
  return (
    error.message.includes("saudacao_template") &&
    /does not exist|schema cache|column/i.test(error.message)
  );
}

/** Localiza o negócio dono da instância que recebeu a mensagem. */
export async function resolveBusinessByInstanceToken(
  supabaseAdmin: SupabaseClient<Database>,
  instanceToken: string,
): Promise<GreetingBusiness | null> {
  const { data: credential } = await supabaseAdmin
    .from("business_whatsapp_credentials")
    .select("business_id")
    .eq("instance_token", instanceToken)
    .maybeSingle();
  const query = supabaseAdmin
    .from("businesses")
    .select(
      "id, name, slug, greeting, saudacao_template, whatsapp_instance, whatsapp_instance_token",
    );
  const { data, error } = await (credential
    ? query.eq("id", credential.business_id).maybeSingle()
    : query.eq("whatsapp_instance_token", instanceToken).maybeSingle());
  if (error) {
    // Banco ainda sem a migration: trata como saudação desativada.
    if (isMissingColumnError(error)) {
      const retry = await supabaseAdmin
        .from("businesses")
        .select("id, name, slug, greeting, whatsapp_instance, whatsapp_instance_token")
        .eq("id", credential ? credential.business_id : "")
        .maybeSingle();
      if (retry.error || !retry.data) return null;
      return { ...retry.data, saudacao_template: null };
    }
    throw new Error(error.message);
  }
  return (data as GreetingBusiness | null) ?? null;
}

type GreetingRepliesTable = {
  select(columns?: string): GreetingRepliesTable;
  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): GreetingRepliesTable;
  eq(column: string, value: unknown): GreetingRepliesTable;
  gt(column: string, value: unknown): GreetingRepliesTable;
  maybeSingle(): Promise<{ data: unknown | null; error: { message: string } | null }>;
};

/** true quando o remetente não recebeu saudação nas últimas 24h. */
export async function shouldSendGreeting(
  supabaseAdmin: SupabaseClient<Database>,
  businessId: string,
  senderPhone: string,
): Promise<boolean> {
  const table = (supabaseAdmin as unknown as { from(t: string): GreetingRepliesTable }).from(
    "whatsapp_greeting_replies",
  );
  const since = new Date(Date.now() - GREETING_COOLDOWN_MS).toISOString();
  const { data, error } = await table
    .select("replied_at")
    .eq("business_id", businessId)
    .eq("sender_phone", senderPhone)
    .gt("replied_at", since)
    .maybeSingle();
  if (error) {
    console.error("Falha ao checar saudação recente:", error.message);
    return false;
  }
  return !data;
}

async function claimGreeting(supabaseAdmin: SupabaseClient<Database>, businessId: string, senderPhone: string) {
  const db = supabaseAdmin as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await db.rpc("claim_whatsapp_greeting", {
    p_business_id: businessId,
    p_sender_phone: senderPhone,
  });
  if (error) throw new Error("Não foi possível reservar o envio da saudação.");
  return typeof data === "string" ? data : null;
}

async function finishGreeting(
  supabaseAdmin: SupabaseClient<Database>,
  businessId: string,
  senderPhone: string,
  claimToken: string,
  sent: boolean,
) {
  const db = supabaseAdmin as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await db.rpc("finish_whatsapp_greeting", {
    p_business_id: businessId,
    p_sender_phone: senderPhone,
    p_claim_token: claimToken,
    p_sent: sent,
  });
  if (error) throw new Error("Não foi possível finalizar o registro da saudação.");
  return data === true;
}

export async function recordGreetingReply(
  supabaseAdmin: SupabaseClient<Database>,
  businessId: string,
  senderPhone: string,
): Promise<void> {
  const table = (supabaseAdmin as unknown as { from(t: string): GreetingRepliesTable }).from(
    "whatsapp_greeting_replies",
  );
  const { error } = await table
    .upsert(
      { business_id: businessId, sender_phone: senderPhone, replied_at: new Date().toISOString() },
      { onConflict: "business_id,sender_phone" },
    )
    .maybeSingle();
  if (error) console.error("Falha ao registrar saudação enviada:", error.message);
}

/** Monta o texto da saudação com {Cliente}, {Saudacao} e {Link} resolvidos. */
export function buildGreetingMessage(
  template: string,
  business: Pick<GreetingBusiness, "name" | "slug" | "greeting">,
  pushName: string | null,
): string {
  const firstName = pushName?.trim().split(/\s+/)[0] || "Cliente";
  return renderMessage(template, {
    nome: firstName,
    negocio: business.name,
    Cliente: firstName,
    Saudacao: business.greeting?.trim() || "Olá!",
    Link: bookingLinkForSlug(business.slug),
  });
}

export type GreetingOutcome =
  { replied: true; businessId: string; senderPhone: string } | { replied: false; reason: string };

/**
 * Processa um payload de webhook de mensagem recebida e envia a saudação
 * quando aplicável. Nunca lança erro (o chamador sempre responde 200).
 */
export async function handleIncomingWhatsapp(payload: unknown): Promise<GreetingOutcome> {
  const incoming = parseIncomingWhatsapp(payload);
  if (!incoming) return { replied: false, reason: "sem mensagem de cliente" };
  const root = payload as Record<string, unknown>;
  const instanceToken =
    typeof root["instance"] === "string"
      ? root["instance"]
      : typeof (root["data"] as Record<string, unknown> | undefined)?.["instanceId"] === "string"
        ? ((root["data"] as Record<string, unknown>)["instanceId"] as string)
        : null;
  if (!instanceToken) return { replied: false, reason: "sem instância" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const business = await resolveBusinessByInstanceToken(supabaseAdmin, instanceToken);
  if (!business) return { replied: false, reason: "negócio não encontrado" };
  const preferences = (await loadPanel1Config(supabaseAdmin, business.id)).preferences;
  if (!preferences.greeting_enabled) return { replied: false, reason: "saudação desativada" };
  const template = business.saudacao_template?.trim();
  if (!template) return { replied: false, reason: "saudação desativada" };
  const { loadWhatsappProvider } = await import("./whatsapp-provider.server");
  const { readWhatsappCredential } = await import("./whatsapp-credentials.server");
  const credential = await readWhatsappCredential(supabaseAdmin, business.id).catch(() => null);
  const token = credential?.instanceToken ?? business.whatsapp_instance_token;
  if (!token) return { replied: false, reason: "sem credencial" };

  const claimToken = await claimGreeting(supabaseAdmin, business.id, incoming.senderPhone);
  if (!claimToken) return { replied: false, reason: "cooldown de 24h" };
  try {
    const provider = await loadWhatsappProvider();
    await provider.sendTextMessage(
      token,
      incoming.senderPhone,
      buildGreetingMessage(template, business, incoming.pushName),
    );
  } catch (sendError) {
    await finishGreeting(supabaseAdmin, business.id, incoming.senderPhone, claimToken, false);
    throw sendError;
  }
  const finalized = await finishGreeting(supabaseAdmin, business.id, incoming.senderPhone, claimToken, true);
  if (!finalized) console.error("A saudação foi enviada, mas o claim não pôde ser finalizado.");
  return { replied: true, businessId: business.id, senderPhone: incoming.senderPhone };
}

function greetingWebhookUrl(): string | null {
  try { return `${getPublicAppUrl().replace(/\/+$/, "")}/api/public/whatsapp-incoming`; } catch { return null; }
}

/**
 * Registra o webhook de mensagens recebidas na instância (melhor esforço:
 * nunca quebra a conexão quando o ambiente não está configurado).
 */
export async function registerGreetingWebhook(instanceToken: string): Promise<boolean> {
  const url = greetingWebhookUrl();
  if (!url) return false;
  try {
    const { loadWhatsappProvider } = await import("./whatsapp-provider.server");
    const provider = (await loadWhatsappProvider()) as unknown as {
      setInstanceWebhook?: (instanceToken: string, url: string, secret: string) => Promise<unknown>;
    };
    if (typeof provider.setInstanceWebhook !== "function") return false;
    await provider.setInstanceWebhook(instanceToken, url, getWhatsAppWebhookSecret());
    return true;
  } catch (error) {
    console.warn(
      "Não foi possível registrar o webhook de saudação:",
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/** Coloca a mensagem pós-atendimento na fila quando o serviço é concluído. */
export async function enqueuePostServiceMessage(appointmentId: string, businessId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { preferences } = await loadPanel1Config(supabaseAdmin, businessId);
  if (!preferences.post_service_enabled || preferences.post_service_minutes <= 0) return false;
  const { data: appointment } = await supabaseAdmin
    .from("appointments")
    .select("id, customer_phone, status")
    .eq("id", appointmentId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!appointment || appointment.status !== "concluido" || !appointment.customer_phone) return false;
  const { error } = await supabaseAdmin.from("post_service_message_queue").insert({
    appointment_id: appointmentId,
    scheduled_at: new Date(Date.now() + preferences.post_service_minutes * 60_000).toISOString(),
  });
  if (error && !/duplicate key|unique constraint/i.test(error.message)) throw new Error("Não foi possível agendar a mensagem pós-atendimento.");
  return !error;
}

function shouldSendPostService(preferences: Awaited<ReturnType<typeof loadPanel1Config>>["preferences"], customerId: string | null) {
  if (!preferences.post_service_enabled) return false;
  const selected = new Set(preferences.post_service_clients.split(",").map((id) => id.trim()).filter(Boolean));
  if (preferences.post_service_send_to === "somente_para") return !!customerId && selected.has(customerId);
  if (preferences.post_service_send_to === "todos_exceto") return !customerId || !selected.has(customerId);
  return true;
}

/** Processa a fila de mensagens pós-atendimento com claim atômico do banco. */
export async function processPostServiceMessages(limit = 50) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin;
  const now = new Date().toISOString();
  const { data: claimedRows, error } = await db.rpc("claim_post_service_messages", { p_limit: limit });
  if (error) throw new Error("Não foi possível carregar as mensagens pós-atendimento.");
  const pending = (claimedRows ?? []) as Array<{ id: string; appointment_id: string }>;
  let sent = 0;
  let skipped = 0;

  const updateQueue = async (id: string, values: Record<string, unknown>) => {
    const { error: updateError } = await db
      .from("post_service_message_queue")
      .update({ ...values, locked_at: null })
      .eq("id", id);
    if (updateError) throw new Error("Não foi possível atualizar a fila pós-atendimento.");
  };

  for (const item of pending) {
    const { data: appointment } = await supabaseAdmin
      .from("appointments")
      .select("id, business_id, customer_id, customer_name, customer_phone, status")
      .eq("id", item.appointment_id)
      .maybeSingle();
    if (!appointment || appointment.status !== "concluido") {
      await updateQueue(item.id, { processed_at: now, last_error: "atendimento não está concluído" });
      skipped += 1;
      continue;
    }

    const { preferences } = await loadPanel1Config(supabaseAdmin, appointment.business_id);
    if (!shouldSendPostService(preferences, appointment.customer_id) || !appointment.customer_phone) {
      await updateQueue(item.id, { processed_at: now, last_error: "envio desativado ou cliente sem telefone" });
      skipped += 1;
      continue;
    }

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, slug, whatsapp_instance_token")
      .eq("id", appointment.business_id)
      .maybeSingle();
    const credential = await import("./whatsapp-credentials.server")
      .then(({ readWhatsappCredential }) => readWhatsappCredential(supabaseAdmin, appointment.business_id))
      .catch(() => null);
    const token = credential?.instanceToken ?? business?.whatsapp_instance_token;
    if (!business || !token) {
      await updateQueue(item.id, { processed_at: now, last_error: "WhatsApp não conectado" });
      skipped += 1;
      continue;
    }

    const message = renderMessage(preferences.post_service_template, {
      nome: appointment.customer_name,
      Cliente: appointment.customer_name,
      negocio: business.name,
      Saudacao: "Olá!",
      Link: bookingLinkForSlug(business.slug),
    });
    try {
      const { loadWhatsappProvider } = await import("./whatsapp-provider.server");
      const provider = await loadWhatsappProvider();
      await provider.sendTextMessage(token, appointment.customer_phone, message);
      await updateQueue(item.id, { processed_at: now, last_error: null });
      sent += 1;
    } catch (sendError) {
      await updateQueue(item.id, {
        last_error: sendError instanceof Error ? sendError.message.slice(0, 500) : "falha ao enviar",
      });
    }
  }
  return { sent, skipped, pending: pending.length - sent - skipped };
}
