import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";

const blockInput = z.object({
  businessId: z.string().uuid(),
  blocked: z.boolean(),
});

const SUPPORT_WELCOME =
  "Olá! Sou o suporte AG. Se for urgente me chama no WhatsApp (11) 98199-8037 que eu te respondo na hora.";

/** Master liga/desliga o bloqueio de uso da Ag Pay do estabelecimento. */
export const setAgpayAccessBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => blockInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({ agpay_access_blocked: data.blocked })
      .eq("id", data.businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Master liga/desliga o bloqueio de saques da carteira Ag Pay. */
export const setAgpayWithdrawalBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => blockInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({ agpay_withdrawal_blocked: data.blocked })
      .eq("id", data.businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Dono lê os flags de bloqueio da própria Ag Pay (dossiê do master). */
export const getAgpayFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => supportBusinessInput.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("businesses")
      .select("agpay_access_blocked, agpay_withdrawal_blocked")
      .eq("id", data.businessId)
      .single();
    if (error) throw new Error(error.message);
    return {
      accessBlocked: row?.agpay_access_blocked === true,
      withdrawalBlocked: row?.agpay_withdrawal_blocked === true,
    };
  });

/* ================= Chat de suporte (Painel 2 ↔ Painel 3) ================= */

export const supportMessageInput = z.object({
  message: z.string().trim().min(1, "Escreva uma mensagem.").max(1000),
});

export const supportBusinessInput = z.object({ businessId: z.string().uuid() });

export const supportThreadInput = z.object({
  businessId: z.string().uuid(),
  /** Marca as respostas do suporte como lidas (só quando o chat está aberto). */
  markRead: z.boolean().default(false),
});

type Message = {
  id: string;
  sender: "user" | "master";
  text: string;
  createdAt: string;
  readByUser: boolean;
};

const mapMessage = (row: {
  id: string;
  sender: string;
  message: string;
  created_at: string;
  read_by_user?: boolean;
}): Message => ({
  id: row.id,
  sender: row.sender === "master" ? "master" : "user",
  text: row.message,
  createdAt: row.created_at,
  readByUser: row.read_by_user !== false,
});

/**
 * Dono lê a conversa do próprio negócio. Semeia a saudação de boas-vindas do
 * suporte na primeira abertura e, se o chat estiver aberto, marca como lidas
 * as respostas recebidas (o badge só zera quando a conversa é vista de fato).
 */
export const getSupportMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => supportThreadInput.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const thread = await context.supabase
      .from("support_messages")
      .select("id, sender, message, created_at, read_by_user")
      .eq("business_id", data.businessId)
      .order("created_at", { ascending: true });
    if (thread.error) throw new Error(thread.error.message);
    let rows = thread.data;
    if (!rows || rows.length === 0) {
      const seeded = await context.supabase
        .from("support_messages")
        .insert({
          business_id: data.businessId,
          sender: "master",
          message: SUPPORT_WELCOME,
          read_by_user: true,
        })
        .select("id, sender, message, created_at, read_by_user");
      if (!seeded.error) rows = seeded.data;
    }
    if (data.markRead) {
      // Visualizou a conversa: respostas do suporte viram lidas.
      await context.supabase
        .from("support_messages")
        .update({ read_by_user: true })
        .eq("business_id", data.businessId)
        .eq("sender", "master")
        .eq("read_by_user", false);
    }
    return { messages: (rows ?? []).map(mapMessage) };
  });

/** Dono pergunta no pop-up de suporte (fica pendente pro master). */
export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    supportBusinessInput.and(supportMessageInput).parse(data),
  )
  .handler(async ({ context, data }) => {
    // Primeiro contato: garante a saudação oficial do suporte antes da pergunta.
    const { data: existing } = await context.supabase
      .from("support_messages")
      .select("id")
      .eq("business_id", data.businessId)
      .limit(1);
    if (!existing || existing.length === 0) {
      await context.supabase.from("support_messages").insert({
        business_id: data.businessId,
        sender: "master",
        message: SUPPORT_WELCOME,
        read_by_user: true,
      });
    }
    const { data: inserted, error } = await context.supabase
      .from("support_messages")
      .insert({
        business_id: data.businessId,
        sender: "user",
        message: data.message,
        read_by_user: true,
        read_by_master: false,
      })
      .select("id, sender, message, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { message: mapMessage(inserted) };
  });

/** Contador de respostas do suporte ainda não vistas pelo dono (badge do FAB). */
export const getSupportUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => supportBusinessInput.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { count, error } = await context.supabase
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("business_id", data.businessId)
      .eq("sender", "master")
      .eq("read_by_user", false);
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

/** Master: lista conversas (mais recente primeiro) com quem tem não lidas. */
export const listSupportConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: rows, error } = await supabaseAdmin
      .from("support_messages")
      .select("business_id, sender, message, read_by_master, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return { conversations: [] };
    const { data: businesses } = await supabaseAdmin
      .from("businesses")
      .select("id, name, category, owner_id, phone");
    const bizMap = new Map((businesses ?? []).map((b) => [b.id, b]));
    const ownerIds = new Set<string>();
    for (const row of rows) ownerIds.add(bizMap.get(row.business_id)?.owner_id ?? "");
    const { data: owners } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", [...ownerIds].filter(Boolean));
    const ownerNames = new Map((owners ?? []).map((o) => [o.id, o.full_name]));
    // Rows desc: a primeira aparição de cada negócio é a mensagem mais recente.
    const perBusiness = new Map<
      string,
      { unread: number; last: { message: string; created_at: string; sender: string } }
    >();
    for (const row of rows) {
      let agg = perBusiness.get(row.business_id);
      if (!agg) {
        agg = { unread: 0, last: { message: row.message, created_at: row.created_at, sender: row.sender } };
        perBusiness.set(row.business_id, agg);
      }
      if (row.sender === "user" && !row.read_by_master) agg.unread += 1;
    }
    const conversations: {
      businessId: string;
      name: string;
      category: string | null;
      phone: string | null;
      ownerName: string | null;
      lastMessage: string;
      lastAt: string;
      lastSender: string;
      unread: number;
    }[] = [];
    for (const [businessId, agg] of perBusiness) {
      const b = bizMap.get(businessId);
      conversations.push({
        businessId,
        name: b?.name ?? "—",
        category: b?.category ?? null,
        phone: b?.phone ?? null,
        ownerName: b?.owner_id ? (ownerNames.get(b.owner_id) ?? null) : null,
        lastMessage: agg.last.message,
        lastAt: agg.last.created_at,
        lastSender: agg.last.sender,
        unread: agg.unread,
      });
    }
    conversations.sort((a, b2) => b2.lastAt.localeCompare(a.lastAt));
    return { conversations };
  });

/** Master abre a conversa: marca as perguntas do dono como lidas. */
export const getSupportThreadForMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => supportBusinessInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: rows, error } = await supabaseAdmin
      .from("support_messages")
      .select("id, sender, message, created_at")
      .eq("business_id", data.businessId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("support_messages")
      .update({ read_by_master: true })
      .eq("business_id", data.businessId)
      .eq("sender", "user")
      .eq("read_by_master", false);
    return { messages: (rows ?? []).map(mapMessage) };
  });

/** Master responde: chega no pop-up do Painel 2 + badge de não lidas. */
export const replySupportAsMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    supportBusinessInput.and(supportMessageInput).parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: inserted, error } = await supabaseAdmin
      .from("support_messages")
      .insert({
        business_id: data.businessId,
        sender: "master",
        message: data.message,
        read_by_master: true,
        read_by_user: false,
      })
      .select("id, sender, message, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { message: mapMessage(inserted) };
  });
