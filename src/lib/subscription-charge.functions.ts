import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin, MASTER_ACCESS_DENIED } from "@/lib/auth/require-super-admin";
import { subscriptionTotalCents, nextAccessAfterPayment } from "@/lib/billing-cycle";
import { isValidCpf } from "@/lib/cpf";
import { cardPaymentEnabled } from "@/lib/payment-methods";
import { isMasterCouponActive } from "@/lib/subscription-coupon";

/**
 * US7 — Cobrança da assinatura (ciclo de 30 dias) via Ag Pay.
 *
 * Pix agora: cria uma cobrança one-off (o AgPay não tem recorrência nativa; o ciclo
 * de 30 dias é controlado pelo nosso backend). Ao pagar (webhook), `access_until` é
 * renovado por `nextAccessAfterPayment` e a cobrança vira `paid`.
 *
 * O valor reusa o plano já configurado no sistema:
 *   subscriptionTotalCents(monthly_fee_cents, profissionais) − cupom ativo (se houver).
 * O pagador é o dono: CPF vem de `businesses.owner_cpf` e é lido pelo servidor.
 */

const digitsOnly = (value: string) => value.replace(/\D/g, "");

async function hasSuperAdminAccess(session: Parameters<typeof assertSuperAdmin>[0]) {
  try {
    await assertSuperAdmin(session);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message === MASTER_ACCESS_DENIED) return false;
    throw error;
  }
}

/**
 * Donos que entram por telefone têm e-mail sintético (`5511999999999@agenda.local`) no Auth.
 * Esse domínio não existe e gateways de pagamento costumam recusá-lo; para a cobrança usamos
 * um endereço válido derivado do mesmo identificador. O e-mail real de login não muda.
 */
export function payerEmailForGateway(authEmail: string): string {
  const [local = "", domain = ""] = authEmail.toLowerCase().split("@");
  return domain === "agenda.local" ? `${local}@agendagora.company` : authEmail;
}

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
  const couponActive = isMasterCouponActive(
    input.couponPercent != null && input.couponExpiresAt != null
      ? { percent: input.couponPercent, expiresAt: input.couponExpiresAt }
      : null,
    now,
  );
  if (!couponActive) return total;
  const discounted = Math.round(total * (1 - input.couponPercent! / 100));
  return Math.max(0, discounted);
}

/**
 * Salva o CPF do responsável (dono) no cadastro do negócio — reusado nas cobranças.
 *
 * A coluna `owner_cpf` NÃO está na lista de colunas que o dono pode atualizar direto
 * (migration 20261103000000_security_hardening: REVOKE UPDATE + trigger de colunas de
 * controle). Gravar com o cliente do usuário dava "permission denied", que a UI mostrava
 * como "Você não tem permissão para fazer isso". Por isso a gravação é feita pelo servidor,
 * depois de confirmar que quem chama é o dono (ou o master) deste negócio.
 */
export const saveOwnerCpf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        businessId: z.string().guid(),
        cpf: z.string().refine((v) => isValidCpf(v), "Informe um CPF válido."),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: business, error } = await context.supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error("Negócio não encontrado.");
    if (business.owner_id !== context.userId && !(await hasSuperAdminAccess(context))) {
      throw new Error("Somente o dono pode alterar o CPF deste negócio.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("businesses")
      .update({ owner_cpf: digitsOnly(data.cpf) })
      .eq("id", data.businessId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true as const };
  });

/**
 * Diz se o dono já tem CPF salvo (para o pop-up de assinatura pedir só na primeira vez).
 * Devolve apenas uma versão mascarada — o CPF completo nunca volta para o navegador.
 */
export const getOwnerCpfStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ businessId: z.string().guid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: business, error } = await context.supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error("Negócio não encontrado.");
    if (business.owner_id !== context.userId && !(await hasSuperAdminAccess(context))) {
      throw new Error("Você não tem permissão para ver este negócio.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: privateFields, error: privateError } = await supabaseAdmin
      .from("businesses")
      .select("owner_cpf")
      .eq("id", data.businessId)
      .maybeSingle();
    if (privateError) throw new Error(privateError.message);
    const cpf = digitsOnly(privateFields?.owner_cpf ?? "");
    if (cpf.length !== 11) return { hasCpf: false as const, masked: null };
    return { hasCpf: true as const, masked: `***.***.***-${cpf.slice(9)}` };
  });

/** Status atual de uma cobrança de assinatura (para a UI poll o pagamento). */
export const getSubscriptionChargeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().guid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: charge, error } = await context.supabase
      .from("subscription_charges")
      .select("id, status, amount_cents, period_end")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!charge) throw new Error("Cobrança não encontrada.");
    return {
      status: charge.status,
      amountCents: charge.amount_cents,
      periodEnd: charge.period_end,
    };
  });

const schema = z.object({
  businessId: z.string().guid(),
  method: z.enum(["pix", "card"]).default("pix"),
});

export const createSubscriptionCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: business, error } = await context.supabase
      .from("businesses")
      .select("id, owner_id, monthly_fee_cents, access_until")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!business) throw new Error("Negócio não encontrado.");
    if (business.owner_id !== context.userId && !(await hasSuperAdminAccess(context))) {
      throw new Error("Você não tem permissão para pagar esta assinatura.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: privateFields, error: privateError } = await supabaseAdmin
      .from("businesses")
      .select("owner_cpf, coupon_percent, coupon_expires_at")
      .eq("id", data.businessId)
      .maybeSingle();
    if (privateError) throw new Error(privateError.message);
    const cpf = digitsOnly(privateFields?.owner_cpf ?? "");
    if (cpf.length !== 11) {
      throw new Error(
        "Informe o CPF do responsável em Configurações antes de pagar a assinatura por Pix.",
      );
    }

    const { createPixCharge, createCardCharge, CARD_MIN_AMOUNT_CENTS } =
      await import("@/lib/agpay.server");
    const isCard = data.method === "card";
    if (isCard && !cardPaymentEnabled()) {
      throw new Error("O pagamento no cartão ainda não está disponível. Pague por Pix.");
    }

    // E-mail do pagador (dono) via Auth.
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(business.owner_id);
    const authEmail = authUser?.user?.email?.trim();
    if (!authEmail) throw new Error("E-mail do responsável não encontrado.");
    const payerEmail = payerEmailForGateway(authEmail);

    const { count: professionalsCount, error: professionalsError } = await supabaseAdmin
      .from("professionals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", data.businessId);
    if (professionalsError || professionalsCount == null)
      throw new Error("Não foi possível calcular o valor da assinatura.");

    const now = new Date();
    const amountCents = subscriptionChargeAmountCents({
      baseCents: business.monthly_fee_cents ?? 8990,
      professionalsCount,
      couponPercent: privateFields?.coupon_percent ?? null,
      couponExpiresAt: privateFields?.coupon_expires_at ?? null,
      now,
    });
    if (amountCents < 1) throw new Error("Valor da assinatura inválido.");
    if (isCard && amountCents < CARD_MIN_AMOUNT_CENTS) {
      throw new Error("O valor mínimo no cartão de crédito é R$ 5,00. Pague por Pix.");
    }

    const payerName = authUser?.user?.user_metadata?.["name"] ?? "Responsável";
    let pix: { providerPaymentId: string; qrCode: string | null; expiresAt: string | null };
    let checkoutUrl: string | null = null;
    try {
      if (isCard) {
        const card = await createCardCharge({
          amountCents,
          payerName,
          payerEmail,
          payerCpf: cpf,
          description: "Assinatura Agenda Agora (30 dias)",
        });
        pix = { providerPaymentId: card.providerPaymentId, qrCode: null, expiresAt: null };
        checkoutUrl = card.checkoutUrl;
      } else {
        pix = await createPixCharge({ amountCents, payerName, payerEmail, payerCpf: cpf });
      }
    } catch (error) {
      // O erro do AgPay perde o `name` ao cruzar a fronteira do server fn e a UI o mostrava
      // como "serviço indisponível". Registra o motivo real e devolve uma mensagem clara.
      const detail = error as { status?: unknown; providerMessage?: unknown; message?: unknown };
      console.error(`Falha ao criar cobrança ${isCard ? "de cartão" : "Pix"} da assinatura`, {
        businessId: data.businessId,
        status: detail.status ?? null,
        providerMessage: detail.providerMessage ?? null,
        message: typeof detail.message === "string" ? detail.message : null,
      });
      throw new Error(
        isCard
          ? "Não foi possível abrir o pagamento no cartão agora. Tente novamente em instantes ou pague por Pix."
          : "Não foi possível gerar o Pix agora. Tente novamente em instantes ou fale com o suporte.",
      );
    }

    const periodEnd = nextAccessAfterPayment(business.access_until ?? null, now);
    const { data: charge, error: insertError } = await supabaseAdmin
      .from("subscription_charges")
      .insert({
        business_id: data.businessId,
        method: data.method,
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
    if (insertError) {
      const message = `Pix criado no AgPay, mas a cobrança não foi salva localmente: ${insertError.message}`;
      const dedupeHash = createHash("sha256")
        .update(`subscription.charge_persist_failed:${pix.providerPaymentId}`, "utf8")
        .digest("hex");
      try {
        const { error: reviewError } = await supabaseAdmin.from("agpay_webhook_events").upsert(
          {
            dedupe_hash: dedupeHash,
            event_type: "subscription.charge_persist_failed",
            transaction_uuid: pix.providerPaymentId,
            payload: {
              business_id: data.businessId,
              amount_cents: amountCents,
              period_start: now.toISOString(),
              period_end: periodEnd,
            },
            status: "error",
            attempts: 1,
            locked_at: null,
            processed_at: null,
            last_error: message.slice(0, 1000),
          },
          { onConflict: "dedupe_hash" },
        );
        if (reviewError) throw reviewError;
      } catch (reviewError) {
        console.error("Falha ao registrar Pix de assinatura para revisão manual", {
          businessId: data.businessId,
          providerPaymentId: pix.providerPaymentId,
          message: reviewError instanceof Error ? reviewError.message : String(reviewError),
        });
      }
      throw new Error(
        "O Pix pode ter sido criado, mas não conseguimos salvar a cobrança. Não tente pagar novamente; fale com o suporte e informe que a referência do AgPay está em revisão.",
      );
    }

    return {
      chargeId: charge.id,
      providerPaymentId: pix.providerPaymentId,
      amountCents,
      status: "pending" as const,
      qrCode: pix.qrCode,
      checkoutUrl,
      expiresAt: pix.expiresAt,
    };
  });
