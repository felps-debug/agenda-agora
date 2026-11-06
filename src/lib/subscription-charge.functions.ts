import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasSuperAdminRole } from "@/lib/auth/require-super-admin";
import { subscriptionTotalCents, nextAccessAfterPayment } from "@/lib/billing-cycle";

/**
 * US7 — Cobrança da assinatura (ciclo de 30 dias) via Ag Pay.
 *
 * Pix agora: cria uma cobrança one-off (o AgPay não tem recorrência nativa; o ciclo
 * de 30 dias é controlado pelo nosso backend). Ao pagar (webhook), `access_until` é
 * renovado por `nextAccessAfterPayment` e a cobrança vira `paid`.
 *
 * O valor reusa o plano já configurado no sistema:
 *   subscriptionTotalCents(monthly_fee_cents, profissionais) − cupom ativo (se houver).
 * O pagador é o dono: CPF vem de `businesses.owner_cpf` (cadastro) e e-mail do Auth.
 */

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** Valor da assinatura em centavos, já com o desconto do cupom ativo aplicado. */
export function subscriptionChargeAmountCents(input: {
  baseCents: number;
  professionalsCount: number;
  couponPercent?: number | null;
  couponExpiresAt?: string | null;
  now?: Date;
}): number {
  const total = subscriptionTotalCents(input.baseCents, input.professionalsCount);
  const now = input.now ?? new Date();
  const couponActive =
    input.couponPercent != null &&
    input.couponPercent > 0 &&
    input.couponExpiresAt != null &&
    new Date(input.couponExpiresAt) > now;
  if (!couponActive) return total;
  const discounted = Math.round(total * (1 - input.couponPercent! / 100));
  return Math.max(0, discounted);
}

/** Salva o CPF do responsável (dono) no cadastro do negócio — reusado nas cobranças. */
export const saveOwnerCpf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        cpf: z.string().refine((v) => digitsOnly(v).length === 11, "CPF inválido."),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: updated, error } = await context.supabase
      .from("businesses")
      .update({ owner_cpf: digitsOnly(data.cpf) })
      .eq("id", data.businessId)
      .eq("owner_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Somente o dono pode alterar o CPF deste negócio.");
    return { ok: true as const };
  });

/** Status atual de uma cobrança de assinatura (para a UI poll o pagamento). */
export const getSubscriptionChargeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: charge, error } = await context.supabase
      .from("subscription_charges")
      .select("id, status, amount_cents, period_end")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!charge) throw new Error("Cobrança não encontrada.");
    return { status: charge.status, amountCents: charge.amount_cents, periodEnd: charge.period_end };
  });

const schema = z.object({
  businessId: z.string().uuid(),
  method: z.enum(["pix"]).default("pix"),
});

export const createSubscriptionCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: business, error } = await context.supabase
      .from("businesses")
      .select(
        "id, owner_id, owner_cpf, monthly_fee_cents, access_until, coupon_percent, coupon_expires_at",
      )
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error("Negócio não encontrado.");
    if (business.owner_id !== context.userId && !(await hasSuperAdminRole(context.userId))) {
      throw new Error("Você não tem permissão para pagar esta assinatura.");
    }

    const cpf = digitsOnly(business.owner_cpf ?? "");
    if (cpf.length !== 11) {
      throw new Error(
        "Informe o CPF do responsável em Configurações antes de pagar a assinatura por Pix.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createPixCharge } = await import("@/lib/agpay.server");

    // E-mail do pagador (dono) via Auth.
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(business.owner_id);
    const payerEmail = authUser?.user?.email?.trim();
    if (!payerEmail) throw new Error("E-mail do responsável não encontrado.");

    const { count: professionalsCount } = await supabaseAdmin
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", data.businessId);

    const now = new Date();
    const amountCents = subscriptionChargeAmountCents({
      baseCents: business.monthly_fee_cents ?? 8990,
      professionalsCount: professionalsCount ?? 0,
      couponPercent: business.coupon_percent,
      couponExpiresAt: business.coupon_expires_at,
      now,
    });
    if (amountCents < 1) throw new Error("Valor da assinatura inválido.");

    const pix = await createPixCharge({
      amountCents,
      payerName: authUser?.user?.user_metadata?.["name"] ?? "Responsável",
      payerEmail,
      payerCpf: cpf,
    });

    const periodEnd = nextAccessAfterPayment(business.access_until ?? null, now);
    const { data: charge, error: insertError } = await supabaseAdmin
      .from("subscription_charges")
      .insert({
        business_id: data.businessId,
        method: "pix",
        provider: "agpay",
        provider_payment_id: pix.providerPaymentId,
        amount_cents: amountCents,
        status: "pending",
        period_start: now.toISOString(),
        period_end: periodEnd,
        payer_cpf: cpf,
        payer_email: payerEmail,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);

    return {
      chargeId: charge.id,
      providerPaymentId: pix.providerPaymentId,
      amountCents,
      status: "pending" as const,
      qrCode: pix.qrCode,
      expiresAt: pix.expiresAt,
    };
  });
