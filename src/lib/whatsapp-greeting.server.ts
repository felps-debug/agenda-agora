// Saudação automática do WhatsApp (aba "Saudação" em /painel/lembretes).
// Quando alguém manda mensagem no número do negócio, o provedor (UazAPI ou
// Evolution) avisa via webhook em /api/public/whatsapp-incoming e este módulo
// decide se responde com a saudação configurada (máx. 1 por remetente a cada 30 min).
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { bookingLinkForSlug, renderMessage } from "./whatsapp-notify.server";
import { getPublicAppUrl, getWhatsAppWebhookSecret } from "@/lib/env-security.server";
import { loadPanel1Config } from "@/lib/panel1-config.storage";

export const GREETING_COOLDOWN_MS = 30 * 60 * 1_000;

export type IncomingWhatsappMessage = {
  fromMe: boolean;
  isGroup: boolean;
  /** Dígitos com DDI (ex.: 5598999990000). */
  senderPhone: string;
  pushName: string | null;
  text: string;
  messageId: string | null;
  messageTimestamp: number | null;
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
  if (typeof m["text"] === "string") return m["text"];
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
 * formatos da UazAPI (envelope oficial messages e formato legado) e da Evolution
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
    const normalized =
      c["message"] && typeof c["message"] === "object"
        ? (c["message"] as Record<string, unknown>)
        : {};
    const key =
      c["key"] && typeof c["key"] === "object" ? (c["key"] as Record<string, unknown>) : {};
    const remoteJid =
      typeof key["remoteJid"] === "string"
        ? key["remoteJid"]
        : typeof c["remoteJid"] === "string"
          ? c["remoteJid"]
          : typeof normalized["chatid"] === "string"
            ? normalized["chatid"]
            : typeof normalized["sender"] === "string"
              ? normalized["sender"]
              : null;
    const remoteJidAlt =
      typeof key["remoteJidAlt"] === "string"
        ? key["remoteJidAlt"]
        : typeof c["remoteJidAlt"] === "string"
          ? c["remoteJidAlt"]
          : null;
    const fromMe = key["fromMe"] === true || c["fromMe"] === true || normalized["fromMe"] === true;
    if (fromMe) continue;
    if (remoteJid?.endsWith("@g.us") || normalized["isGroup"] === true) continue;
    const senderPhone =
      digitsOf(remoteJid) ??
      digitsOf(remoteJidAlt) ??
      digitsOf(c["sender"]) ??
      digitsOf(c["from"]) ??
      digitsOf(c["number"]);
    if (!senderPhone) continue;
    const pushName =
      typeof c["pushName"] === "string"
        ? c["pushName"]
        : typeof normalized["senderName"] === "string"
          ? normalized["senderName"]
          : typeof data["pushName"] === "string"
            ? data["pushName"]
            : null;
    const text =
      messageText(c["message"] ?? c).trim() +
      (typeof c["text"] === "string" && !c["message"] ? c["text"].trim() : "");
    const messageId =
      [normalized["id"], normalized["messageid"], key["id"], c["id"]].find(
        (value): value is string => typeof value === "string" && value.length > 0,
      ) ?? null;
    const timestamp =
      normalized["messageTimestamp"] ?? c["messageTimestamp"] ?? data["messageTimestamp"];
    const messageTimestamp =
      typeof timestamp === "number" && Number.isFinite(timestamp) ? timestamp : null;
    return {
      fromMe: false,
      isGroup: false,
      senderPhone,
      pushName,
      text,
      messageId,
      messageTimestamp,
    };
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

/** true quando o remetente não recebeu saudação nos últimos 30 min. */
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

async function claimGreeting(
  supabaseAdmin: SupabaseClient<Database>,
  businessId: string,
  senderPhone: string,
) {
  const db = supabaseAdmin as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
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
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
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

const GREETING_MAX_ATTEMPTS = 10;
const GREETING_PROCESSING_LEASE_MS = 5 * 60_000;
const GREETING_EVENT_RETENTION_MS = 30 * 24 * 60 * 60_000;

function greetingRetryDelayMs(attempt: number): number {
  return Math.min(60, 2 ** Math.max(0, attempt - 1)) * 60_000;
}

async function enqueueIncomingGreeting(
  db: SupabaseClient<Database>,
  businessId: string,
  incoming: IncomingWhatsappMessage,
) {
  const fallbackWindow = Math.floor(Date.now() / (5 * 60_000));
  const identity = incoming.messageId
    ? `message:${incoming.messageId}`
    : incoming.messageTimestamp != null
      ? `timestamp:${incoming.messageTimestamp}:${incoming.senderPhone}`
      : `fallback:${fallbackWindow}:${incoming.senderPhone}:${incoming.text}`;
  const dedupeHash = createHash("sha256").update(`${businessId}:${identity}`, "utf8").digest("hex");
  const { data: inserted, error: insertError } = await db
    .from("whatsapp_incoming_greeting_events")
    .insert({
      business_id: businessId,
      dedupe_hash: dedupeHash,
      sender_phone: incoming.senderPhone,
      sender_name: incoming.pushName,
      status: "pending",
      attempts: 0,
      available_at: new Date().toISOString(),
    })
    .select("id, status")
    .maybeSingle();
  if (!insertError && inserted) return inserted;
  if (insertError && (insertError as { code?: string }).code === "23505") {
    const { data: existing, error } = await db
      .from("whatsapp_incoming_greeting_events")
      .select("id, status")
      .eq("dedupe_hash", dedupeHash)
      .maybeSingle();
    if (!error && existing) return existing;
  }
  throw new Error("Não foi possível registrar a mensagem recebida para processamento.");
}

async function sendQueuedGreeting(
  supabaseAdmin: SupabaseClient<Database>,
  event: { id: string; business_id: string; sender_phone: string; sender_name: string | null },
) {
  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .select("id, name, slug, greeting, saudacao_template, whatsapp_instance_token")
    .eq("id", event.business_id)
    .maybeSingle();
  if (businessError) throw new Error("Falha ao consultar o negócio da saudação.");
  if (!business) return { sent: false as const };
  const { preferences } = await loadPanel1Config(supabaseAdmin, event.business_id);
  const template = business.saudacao_template?.trim();
  if (!preferences.greeting_enabled || !template) return { sent: false as const };
  const { loadWhatsappProvider } = await import("./whatsapp-provider.server");
  const { readWhatsappCredential } = await import("./whatsapp-credentials.server");
  const credential = await readWhatsappCredential(supabaseAdmin, event.business_id).catch(
    () => null,
  );
  const token = credential?.instanceToken ?? business.whatsapp_instance_token;
  if (!token) return { sent: false as const };

  const claimToken = await claimGreeting(supabaseAdmin, event.business_id, event.sender_phone);
  if (!claimToken) return { sent: false as const };
  try {
    const provider = await loadWhatsappProvider();
    await provider.sendTextMessage(
      token,
      event.sender_phone,
      buildGreetingMessage(template, business, event.sender_name),
    );
  } catch (sendError) {
    await finishGreeting(supabaseAdmin, event.business_id, event.sender_phone, claimToken, false);
    throw sendError;
  }
  const finalized = await finishGreeting(
    supabaseAdmin,
    event.business_id,
    event.sender_phone,
    claimToken,
    true,
  );
  if (!finalized) console.error("A saudação foi enviada, mas o claim não pôde ser finalizado.");
  return { sent: true as const };
}

/** Processa fila durável de saudações; também é chamado pelo cron horário. */
export async function processPendingIncomingWhatsappGreetings(
  options: {
    eventId?: string;
    limit?: number;
  } = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin;
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseBefore = new Date(now.getTime() - GREETING_PROCESSING_LEASE_MS).toISOString();
  const table = () => db.from("whatsapp_incoming_greeting_events");

  const { data: stale, error: staleError } = await table()
    .select("id")
    .eq("status", "processing")
    .lt("locked_at", leaseBefore)
    .limit(50);
  if (staleError) throw new Error("Não foi possível recuperar a fila de saudações.");
  for (const event of stale ?? []) {
    await table()
      .update({ status: "pending", locked_at: null, available_at: nowIso })
      .eq("id", event.id)
      .eq("status", "processing");
  }

  await table()
    .delete()
    .in("status", ["sent", "skipped"])
    .lt("processed_at", new Date(now.getTime() - GREETING_EVENT_RETENTION_MS).toISOString());

  let pendingQuery = table()
    .select("id, business_id, sender_phone, sender_name, attempts")
    .eq("status", "pending")
    .lte("available_at", nowIso)
    .order("received_at", { ascending: true })
    .limit(Math.max(1, Math.min(options.limit ?? 20, 50)));
  if (options.eventId) pendingQuery = pendingQuery.eq("id", options.eventId);
  const { data: pending, error: pendingError } = await pendingQuery;
  if (pendingError) throw new Error("Não foi possível consultar a fila de saudações.");

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of pending ?? []) {
    const attempts = row.attempts + 1;
    const { data: event, error: claimError } = await table()
      .update({ status: "processing", attempts, locked_at: nowIso })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id, business_id, sender_phone, sender_name")
      .maybeSingle();
    if (claimError) {
      failed++;
      continue;
    }
    if (!event) continue;

    try {
      const result = await sendQueuedGreeting(db, event);
      const status = result.sent ? "sent" : "skipped";
      const { error } = await table()
        .update({ status, locked_at: null, processed_at: nowIso, last_error: null })
        .eq("id", event.id)
        .eq("status", "processing");
      if (error) throw new Error("Falha ao finalizar evento de saudação.");
      if (result.sent) sent++;
      else skipped++;
    } catch (error) {
      const terminal = attempts >= GREETING_MAX_ATTEMPTS;
      const { error: retryError } = await table()
        .update({
          status: terminal ? "error" : "pending",
          available_at: new Date(now.getTime() + greetingRetryDelayMs(attempts)).toISOString(),
          locked_at: null,
          processed_at: terminal ? nowIso : null,
          last_error: "Falha ao enviar ou registrar a saudação pelo WhatsApp.",
        })
        .eq("id", event.id)
        .eq("status", "processing");
      if (retryError) console.error("Falha ao reagendar evento de saudação", { eventId: event.id });
      if (terminal)
        console.error("Saudação esgotou tentativas; requer revisão", { eventId: event.id });
      failed++;
    }
  }
  return { processed: sent + skipped + failed, sent, skipped, failed };
}

export type GreetingOutcome =
  { replied: true; businessId: string; senderPhone: string } | { replied: false; reason: string };

/**
 * Processa um payload de webhook de mensagem recebida e envia a saudação
 * quando aplicável. Só lança erro se não conseguir registrar o evento durável.
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
        : typeof root["token"] === "string"
          ? root["token"]
          : null;
  if (!instanceToken) return { replied: false, reason: "sem instância" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const business = await resolveBusinessByInstanceToken(supabaseAdmin, instanceToken);
  if (!business) return { replied: false, reason: "negócio não encontrado" };
  const event = await enqueueIncomingGreeting(supabaseAdmin, business.id, incoming);
  let result: Awaited<ReturnType<typeof processPendingIncomingWhatsappGreetings>> | null = null;
  try {
    result = await processPendingIncomingWhatsappGreetings({ eventId: event.id, limit: 1 });
  } catch {
    console.error("Evento de saudação ficou na fila após falha no processamento", {
      eventId: event.id,
    });
  }
  if (!result) return { replied: false, reason: "mensagem registrada para processamento" };
  if (result.sent)
    return { replied: true, businessId: business.id, senderPhone: incoming.senderPhone };
  return { replied: false, reason: "mensagem registrada para processamento ou retry" };
}
function greetingWebhookUrl(): string | null {
  try {
    return `${getPublicAppUrl().replace(/\/+$/, "")}/api/public/whatsapp-incoming`;
  } catch {
    return null;
  }
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
  const { data: appointment, error: appointmentError } = await supabaseAdmin
    .from("appointments")
    .select("id, customer_phone, status")
    .eq("id", appointmentId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (appointmentError) {
    throw new Error(
      "Não foi possível consultar o atendimento para agendar a mensagem pós-atendimento.",
    );
  }
  if (!appointment || appointment.status !== "concluido" || !appointment.customer_phone)
    return false;
  const { error } = await supabaseAdmin.from("post_service_message_queue").insert({
    appointment_id: appointmentId,
    scheduled_at: new Date(Date.now() + preferences.post_service_minutes * 60_000).toISOString(),
  });
  if (error && !/duplicate key|unique constraint/i.test(error.message))
    throw new Error("Não foi possível agendar a mensagem pós-atendimento.");
  return !error;
}

/**
 * Um cliente escolhido na tela de Configurações é guardado por id: o UUID do cadastro
 * manual ou `appointment:<telefone>` para quem só agendou. Agendamento público grava
 * `customer_id` nulo, então comparar só o id fazia "somente para…" nunca enviar e
 * "todos exceto…" enviar também para os excluídos. Por isso o telefone também conta.
 */
export function postServiceSelectionMatches(
  selected: Set<string>,
  customerId: string | null,
  customerPhone: string | null,
  selectedPhones: Set<string> = new Set(),
) {
  if (customerId && selected.has(customerId)) return true;
  const digits = (customerPhone ?? "").replace(/\D/g, "");
  if (!digits) return false;
  return selected.has(`appointment:${digits}`) || selectedPhones.has(digits);
}

export function shouldSendPostService(
  preferences: Awaited<ReturnType<typeof loadPanel1Config>>["preferences"],
  customerId: string | null,
  customerPhone: string | null = null,
  selectedPhones: Set<string> = new Set(),
) {
  if (!preferences.post_service_enabled) return false;
  const selected = new Set(
    preferences.post_service_clients
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const isSelected = postServiceSelectionMatches(
    selected,
    customerId,
    customerPhone,
    selectedPhones,
  );
  if (preferences.post_service_send_to === "somente_para") return isSelected;
  if (preferences.post_service_send_to === "todos_exceto") return !isSelected;
  return true;
}

/** Processa a fila de mensagens pós-atendimento com claim atômico do banco. */
export async function processPostServiceMessages(limit = 50) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin;
  const now = new Date().toISOString();
  const { data: claimedRows, error } = await db.rpc("claim_post_service_messages", {
    p_limit: limit,
  });
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
    const { data: appointment, error: appointmentError } = await supabaseAdmin
      .from("appointments")
      .select("id, business_id, customer_id, customer_name, customer_phone, status")
      .eq("id", item.appointment_id)
      .maybeSingle();
    if (appointmentError) {
      await updateQueue(item.id, {
        last_error: `falha ao consultar atendimento: ${appointmentError.message}`.slice(0, 500),
      });
      continue;
    }
    if (!appointment || appointment.status !== "concluido") {
      await updateQueue(item.id, {
        processed_at: now,
        last_error: "atendimento não está concluído",
      });
      skipped += 1;
      continue;
    }

    const { preferences } = await loadPanel1Config(supabaseAdmin, appointment.business_id);
    // Cliente cadastrado à mão e escolhido por UUID, mas agendamento sem `customer_id`:
    // resolve pelo telefone do cadastro.
    const selectedPhones = new Set<string>();
    const selectedUuids = preferences.post_service_clients
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id && !id.startsWith("appointment:"));
    if (selectedUuids.length && !appointment.customer_id) {
      const { data: chosen, error: chosenError } = await supabaseAdmin
        .from("customers")
        .select("phone")
        .eq("business_id", appointment.business_id)
        .in("id", selectedUuids);
      if (chosenError) {
        await updateQueue(item.id, {
          last_error: `falha ao consultar clientes selecionados: ${chosenError.message}`.slice(
            0,
            500,
          ),
        });
        continue;
      }
      for (const row of chosen ?? []) {
        const digits = (row.phone ?? "").replace(/\D/g, "");
        if (digits) selectedPhones.add(digits);
      }
    }

    if (
      !shouldSendPostService(
        preferences,
        appointment.customer_id,
        appointment.customer_phone,
        selectedPhones,
      ) ||
      !appointment.customer_phone
    ) {
      await updateQueue(item.id, {
        processed_at: now,
        last_error: "envio desativado ou cliente sem telefone",
      });
      skipped += 1;
      continue;
    }

    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, name, slug, whatsapp_instance_token")
      .eq("id", appointment.business_id)
      .maybeSingle();
    if (businessError) {
      await updateQueue(item.id, {
        last_error: `falha ao consultar negócio: ${businessError.message}`.slice(0, 500),
      });
      continue;
    }
    const { isWhatsappCredentialStoreUnavailable, readWhatsappCredential } =
      await import("./whatsapp-credentials.server");
    let credential = null;
    try {
      credential = await readWhatsappCredential(supabaseAdmin, appointment.business_id);
    } catch (credentialError) {
      if (!isWhatsappCredentialStoreUnavailable(credentialError)) {
        const detail =
          credentialError instanceof Error ? credentialError.message : String(credentialError);
        await updateQueue(item.id, {
          last_error: `falha ao consultar credencial WhatsApp: ${detail}`.slice(0, 500),
        });
        continue;
      }
    }
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
        last_error:
          sendError instanceof Error ? sendError.message.slice(0, 500) : "falha ao enviar",
      });
    }
  }
  return { sent, skipped, pending: pending.length - sent - skipped };
}
