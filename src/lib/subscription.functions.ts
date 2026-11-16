import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin, MASTER_ACCESS_DENIED } from "@/lib/auth/require-super-admin";
import {
  computeAccessCycle,
  computeInvoiceStatus,
  subscriptionTotalCents,
} from "@/lib/billing-cycle";

const schema = z.object({ businessId: z.string().guid() });

async function hasMasterAccess(session: Parameters<typeof assertSuperAdmin>[0]) {
  try {
    await assertSuperAdmin(session);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === MASTER_ACCESS_DENIED) return false;
    throw error;
  }
}

/**
 * Ciclo de acesso do estabelecimento (vencimento rolante) — visto pelo dono:
 * dias restantes, estágio de aviso atual do Painel 2 e o histórico de faturas
 * pagas (uma caixa verde por pagamento confirmado).
 */
export const getBillingCycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: business, error: businessError } = await context.supabase
      .from("businesses")
      .select(
        "owner_id, monthly_fee_cents, access_until, cancel_requested_at, cancelled_at, trial_days",
      )
      .eq("id", data.businessId)
      .maybeSingle();
    if (businessError) throw new Error("Não foi possível consultar esta assinatura.");
    if (!business) {
      if (!(await hasMasterAccess(context))) {
        throw new Error("Você não tem permissão para ver esta assinatura.");
      }
      throw new Error("Negócio não encontrado.");
    }
    const isMasterCrossBusiness = business.owner_id !== context.userId;
    if (isMasterCrossBusiness && !(await hasMasterAccess(context))) {
      throw new Error("Você não tem permissão para ver esta assinatura.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dataClient = isMasterCrossBusiness ? supabaseAdmin : context.supabase;
    const { data: couponFields, error: couponError } = await supabaseAdmin
      .from("businesses")
      .select("coupon_code, coupon_percent, coupon_expires_at")
      .eq("id", data.businessId)
      .maybeSingle();
    if (couponError) throw new Error("Não foi possível consultar o cupom da assinatura.");

    // Histórico real: cada pagamento confirmado é uma caixa "Pago" permanente.
    const { data: payments, error: paymentsError } = await dataClient
      .from("subscription_payments")
      .select("id, amount_cents, paid_at, created_at")
      .eq("business_id", data.businessId)
      .eq("status", "pago")
      .order("paid_at", { ascending: false })
      .limit(60);
    if (paymentsError) throw new Error("Não foi possível consultar o histórico de pagamentos.");
    const pagoHistory = (payments ?? []).map((p) => ({
      id: p.id,
      amountCents: p.amount_cents ?? 0,
      paidAt: p.paid_at ?? p.created_at,
    }));

    // Valor da assinatura: base + R$ 10 por profissional adicional (1º é grátis).
    const { count: professionalsCount, error: professionalsError } = await dataClient
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", data.businessId);
    if (professionalsError || professionalsCount == null)
      throw new Error("Não foi possível calcular o valor da assinatura.");
    const amountCents = subscriptionTotalCents(
      business.monthly_fee_cents ?? 8990,
      professionalsCount,
    );

    const now = new Date();
    const cycle = computeAccessCycle({ accessUntil: business.access_until, now });
    const statusCard = computeInvoiceStatus(business.access_until, now);

    // Cupom ativo: só existe se o master criou e ainda não expirou.
    const coupon =
      couponFields?.coupon_code && couponFields.coupon_percent && couponFields.coupon_expires_at
        ? new Date(couponFields.coupon_expires_at) > now
          ? {
              code: couponFields.coupon_code as string,
              percent: couponFields.coupon_percent as number,
              expiresAt: couponFields.coupon_expires_at as string,
            }
          : null
        : null;

    return {
      stage: cycle.stage,
      daysLeft: cycle.daysLeft,
      accessUntil: cycle.accessUntil,
      baseCents: business.monthly_fee_cents ?? 8990,
      professionalsCount,
      amountCents,
      statusCard,
      pagoHistory,
      coupon,
    };
  });

/* ------------------------------------------------------------------ */
/* Cupom de desconto — definido pelo master no dossier do negócio      */
/* ------------------------------------------------------------------ */

const couponSchema = z.object({
  businessId: z.string().guid(),
  code: z.string().trim().min(2, "Informe o nome do cupom.").max(40, "Nome do cupom muito longo."),
  percent: z
    .number()
    .int()
    .min(1, "Desconto precisa de pelo menos 1%.")
    .max(90, "Desconto máximo de 90%."),
  days: z
    .number()
    .int()
    .min(1, "O cupom fica ativo de 1 a 7 dias.")
    .max(7, "O cupom pode ficar ativo no máximo 7 dias."),
});

export const setBusinessCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => couponSchema.parse(d))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const expiresAt = new Date(Date.now() + data.days * 86_400_000).toISOString();
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({
        coupon_code: data.code.toUpperCase(),
        coupon_percent: data.percent,
        coupon_expires_at: expiresAt,
      })
      .eq("id", data.businessId);
    if (error) throw new Error(error.message);
    return { ok: true as const, expiresAt };
  });

export const clearBusinessCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ businessId: z.string().guid() }).parse(d))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({
        coupon_code: null,
        coupon_percent: null,
        coupon_expires_at: null,
      })
      .eq("id", data.businessId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Estado atual do cupom na tela do master (expirado = null). */
export const getBusinessCoupon = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context);
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .select("coupon_code, coupon_percent, coupon_expires_at")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business?.coupon_code || !business.coupon_percent || !business.coupon_expires_at) {
      return { coupon: null };
    }
    if (new Date(business.coupon_expires_at) <= new Date()) return { coupon: null };
    return {
      coupon: {
        code: business.coupon_code as string,
        percent: business.coupon_percent as number,
        expiresAt: business.coupon_expires_at as string,
      },
    };
  });
