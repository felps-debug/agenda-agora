import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/auth/require-super-admin";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Owner envia a chave Pix para aprovação. */
export const submitPixKeyApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        keyType: z.string().min(1),
        key: z.string().min(3),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    // O acesso continua validado pelo RLS do client do usuário: só insere chave
    // para um estabelecimento que ele já pode ler.
    const { data: biz } = await context.supabase
      .from("businesses")
      .select("id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (!biz) throw new Error("Estabelecimento não encontrado para este acesso.");

    // Aprovação é SEMPRE manual: toda chave enviada fica pendente e aparece no
    // menu "Pix em Aprovação" do Painel 3 para o master validar.
    const { data: pendingRows } = await supabaseAdmin
      .from("pix_key_approvals")
      .select("id")
      .eq("business_id", data.businessId)
      .eq("status", "pendente");
    if (pendingRows && pendingRows.length > 0) {
      throw new Error("Já existe uma chave Pix em análise. Aguarde a aprovação.");
    }

    const { data: inserted, error } = await context.supabase
      .from("pix_key_approvals")
      .insert({
        business_id: data.businessId,
        key_type: data.keyType,
        key: data.key,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, autoAprovado: false as const };
  });

/** Owner lê o status da última solicitação. */
export const getLatestPixKeyApproval = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ businessId: z.string().uuid() }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("pix_key_approvals")
      .select("id, key_type, key, status, created_at")
      .eq("business_id", data.businessId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

/** Master lista todas as solicitações. */
export const listPixKeyApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data, error } = await supabaseAdmin
      .from("pix_key_approvals")
      .select("id, business_id, key_type, key, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: businesses } = await supabaseAdmin
      .from("businesses")
      .select("id, name, phone, category, owner_id, withdrawal_pin_hash");
    const names = new Map((businesses ?? []).map((b) => [b.id, b]));
    const { data: owners } = await supabaseAdmin.from("profiles").select("id, full_name");
    const ownerNames = new Map((owners ?? []).map((o) => [o.id, o.full_name]));
    return (data ?? []).map((row) => {
      const b = names.get(row.business_id);
      return {
        id: row.id,
        businessId: row.business_id,
        businessName: b?.name ?? "—",
        businessPhone: b?.phone ?? null,
        ownerName: b?.owner_id ? (ownerNames.get(b.owner_id) ?? null) : null,
        keyType: row.key_type,
        key: row.key,
        status: row.status,
        createdAt: row.created_at,
        hasTransferPin: !!b?.withdrawal_pin_hash,
      };
    });
  });

const pixKeyTypeEnum = z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]);

/** Master edita a chave Pix (e o tipo) de uma solicitação; espelha na carteira se aprovada. */
export const updatePixKeyApprovalEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        keyType: pixKeyTypeEnum,
        key: z.string().trim().min(3).max(140),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: row } = await supabaseAdmin
      .from("pix_key_approvals")
      .select("id, business_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Solicitação não encontrada.");
    const { error } = await supabaseAdmin
      .from("pix_key_approvals")
      .update({ key: data.key, key_type: data.keyType })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row.status === "aprovado") {
      // A chave fixa de saque do estabelecimento acompanha a edição do master.
      const { error: bizError } = await supabaseAdmin
        .from("businesses")
        .update({ withdrawal_pix_key: data.key, withdrawal_pix_key_type: data.keyType })
        .eq("id", row.business_id);
      if (bizError) throw new Error(bizError.message);
    }
    return { ok: true };
  });

/** Master visualiza/altera a senha de transferência do estabelecimento. */
export const updateBusinessTransferPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        pin: z.string().regex(/^\d{4}$/, "A senha deve ter 4 dígitos numéricos."),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${data.businessId}:${data.pin}`),
    );
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({ withdrawal_pin_hash: hash })
      .eq("id", data.businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Master aprova ou recusa. Aprovar também devolve o acesso AG Pay caso a
 * conta esteja com o Bloqueio de Acesso ligado. */
export const setPixKeyApprovalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["aprovado", "recusado"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: row } = await supabaseAdmin
      .from("pix_key_approvals")
      .select("business_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("pix_key_approvals")
      .update({
        status: data.status,
        approved_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.status === "aprovado" && row?.business_id) {
      // Aprovar a chave novamente também libera o uso da carteira.
      await supabaseAdmin
        .from("businesses")
        .update({ agpay_access_blocked: false })
        .eq("id", row.business_id);
    }
    return { ok: true };
  });
