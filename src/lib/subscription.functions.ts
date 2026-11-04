import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasSuperAdminRole } from "@/lib/auth/require-super-admin";
import {
  computeAccessCycle,
  computeInvoiceStatus,
  subscriptionTotalCents,
} from "@/lib/billing-cycle";

const schema = z.object({ businessId: z.string().uuid() });

/**
 * Ciclo de acesso do estabelecimento (vencimento rolante) — visto pelo dono:
 * dias restantes, estágio de aviso atual do Painel 2 e o histórico de faturas
 * pagas (uma caixa verde por pagamento confirmado).
 */
export const getBillingCycle = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: business } = await context.supabase
      .from("businesses")
      .select(
        "owner_id, monthly_fee_cents, access_until, cancel_requested_at, cancelled_at, trial_days, coupon_code, coupon_percent, coupon_expires_at",
      )
      .eq("id", data.businessId)
      .maybeSingle();
    if (!business) throw new Error("Negócio não encontrado.");
    if (business.owner_id !== context.userId && !(await hasSuperAdminRole(context.userId))) {
      throw new Error("Você não tem permissão para ver esta assinatura.");
    }

    // Histórico real: cada pagamento confirmado é uma caixa "Pago" permanente.
    const { data: payments } = await context.supabase
      .from("subscription_payments")
      .select("id, amount_cents, paid_at, created_at")
      .eq("business_id", data.businessId)
      .eq("status", "pago")
      .order("paid_at", { ascending: false })
      .limit(60);
    const pagoHistory = (payments ?? []).map((p) => ({
      id: p.id,
      amountCents: p.amount_cents ?? 0,
      paidAt: p.paid_at ?? p.created_at,
    }));

    // Valor da assinatura: base + R$ 10 por profissional adicional (1º é grátis).
    const { count: professionalsCount } = await context.supabase
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", data.businessId);
    const amountCents = subscriptionTotalCents(
      business.monthly_fee_cents ?? 8990,
      professionalsCount ?? 0,
    );

    const now = new Date();
    const cycle = computeAccessCycle({ accessUntil: business.access_until, now });
    const statusCard = computeInvoiceStatus(business.access_until, now);

    // Cupom ativo: só existe se o master criou e ainda não expirou.
    const coupon =
      business.coupon_code && business.coupon_percent && business.coupon_expires_at
        ? new Date(business.coupon_expires_at) > now
          ? {
              code: business.coupon_code as string,
              percent: business.coupon_percent as number,
              expiresAt: business.coupon_expires_at as string,
            }
          : null
        : null;

    return {
      stage: cycle.stage,
      daysLeft: cycle.daysLeft,
      accessUntil: cycle.accessUntil,
      baseCents: business.monthly_fee_cents ?? 8990,
      professionalsCount: professionalsCount ?? 0,
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
  businessId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .min(2, "Informe o nome do cupom.")
    .max(40, "Nome do cupom muito longo."),
  percent: z.number().int().min(1, "Desconto precisa de pelo menos 1%.").max(90, "Desconto máximo de 90%."),
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
    if (!(await hasSuperAdminRole(context.userId))) {
      throw new Error("Somente o master da plataforma pode gerenciar cupons.");
    }
    const expiresAt = new Date(Date.now() + data.days * 86_400_000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
  .inputValidator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    if (!(await hasSuperAdminRole(context.userId))) {
      throw new Error("Somente o master da plataforma pode gerenciar cupons.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    if (!(await hasSuperAdminRole(context.userId))) {
      throw new Error("Somente o master da plataforma pode ver cupons.");
    }
    const { data: business, error } = await context.supabase
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
