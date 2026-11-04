import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  MIN_WITHDRAWAL_CENTS,
  WITHDRAWAL_FEE_CENTS,
  savePaymentRulesInput,
  saveWithdrawalPinInput,
  saveWithdrawalPixKeyInput,
} from "@/lib/withdrawal.functions";
import { AgpayApiError, createCashoutPix } from "@/lib/agpay.server";
import { requestWithdrawal, settleWithdrawal } from "@/lib/ledger.server";

/**
 * Taxa fixa de saque da plataforma: R$ 3,00, independente do valor (decisão comercial de
 * 05/10/2026). O valor pedido sai inteiro da carteira; o Pix enviado ao dono é o valor
 * menos esta taxa. Estorno de saque falho devolve o valor pedido inteiro. A AgPay exige
 * Pix líquido de no mínimo R$ 10,00, por isso o pedido mínimo é R$ 13,00.
 */
export { WITHDRAWAL_FEE_CENTS };

export async function createWithdrawal(
  client: SupabaseClient<Database>,
  userId: string,
  businessId: string,
  amountCents: number,
  idempotencyKey: string,
) {
  const ownerDb = client;
  const { data: business, error } = await ownerDb
    .from("businesses")
    .select("id, withdrawal_pix_key, agpay_withdrawal_blocked, agpay_access_blocked")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error || !business) throw new Error("Negócio não encontrado.");
  if (business.agpay_access_blocked)
    throw new Error("Sua carteira Ag Pay está bloqueada pelo suporte.");
  if (business.agpay_withdrawal_blocked)
    throw new Error("Os saques da sua carteira estão bloqueados pelo suporte.");
  if (!business.withdrawal_pix_key)
    throw new Error("Cadastre uma chave Pix antes de solicitar o saque.");
  if (!Number.isInteger(amountCents) || amountCents < MIN_WITHDRAWAL_CENTS)
    throw new Error("O saque mínimo é R$ 13,00.");
  const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) return { withdrawal: existing };
  const { data: inserted, error: insertError } = await supabase
    .from("withdrawals")
    .insert({
      business_id: business.id,
      amount_cents: amountCents,
      status: "requested",
      idempotency_key: idempotencyKey,
      pix_key_snapshot: business.withdrawal_pix_key,
      platform_fee_cents: WITHDRAWAL_FEE_CENTS,
    })
    .select("*")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: duplicate } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .single();
      return { withdrawal: duplicate };
    }
    throw new Error("Não foi possível registrar o saque.");
  }
  let reservation;
  try {
    reservation = await requestWithdrawal(supabase, {
      businessId: business.id,
      withdrawalId: inserted.id,
      amountCents,
    });
  } catch (cause) {
    try {
      await settleWithdrawal(supabase, { withdrawalId: inserted.id, outcome: "canceled" });
    } catch {
      // A falha da compensação não deve ocultar a falha original da reserva.
    }
    throw new Error("Não foi possível reservar o saldo do saque. Tente novamente.", { cause });
  }
  if (!reservation.accepted) {
    await settleWithdrawal(supabase, { withdrawalId: inserted.id, outcome: "canceled" });
    if (reservation.availableCents < 0) {
      throw new Error(
        "Saldo negativo por um estorno: novos saques ficam bloqueados ate a revisao do administrador.",
      );
    }
    throw new Error(
      `Saldo insuficiente. Disponível: R$ ${(reservation.availableCents / 100).toFixed(2).replace(".", ",")}.`,
    );
  }
  try {
    const payout = await createCashoutPix({
      amountCents: amountCents - WITHDRAWAL_FEE_CENTS,
      pixKey: business.withdrawal_pix_key,
    });
    const { data: updated, error: updateError } = await supabase
      .from("withdrawals")
      .update({
        status: "processing",
        provider_ref: payout.providerRef,
        provider_fee_cents: payout.providerFeeCents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id)
      .select("*")
      .single();
    if (updateError) throw new Error("Saque registrado e aguardando confirmação.");
    const providerStatus = payout.status?.trim().toLowerCase();
    // Em contas configuradas para saída automática, o provedor pode confirmar o
    // Pix na própria resposta. Não deixe o ledger local preso esperando um
    // webhook que pode chegar depois (ou nunca chegar).
    if (["completed", "paid", "success"].includes(providerStatus ?? "")) {
      await settleWithdrawal(supabase, {
        withdrawalId: inserted.id,
        outcome: "paid",
        providerRef: payout.providerRef,
      });
      return { withdrawal: { ...updated, status: "paid" } };
    }
    if (["failed", "rejected", "canceled", "cancelled"].includes(providerStatus ?? "")) {
      await settleWithdrawal(supabase, {
        withdrawalId: inserted.id,
        outcome: "failed",
        providerRef: payout.providerRef,
      });
      // Usa o mesmo caminho de rejeição HTTP abaixo. A settlement é idempotente;
      // assim uma resposta 2xx com status de falha nunca cai no ramo de timeout
      // ambíguo, que manteria o saque como processing por engano.
      throw new AgpayApiError(422, "/cashout/pix");
    }
    return { withdrawal: updated };
  } catch (cause) {
    // A chamada pode ter sido aceita antes do timeout. Nunca repetir automaticamente.
    if (
      cause instanceof AgpayApiError ||
      (cause instanceof Error && cause.message.includes("mínimo"))
    ) {
      await settleWithdrawal(supabase, { withdrawalId: inserted.id, outcome: "failed" });
      if (cause instanceof AgpayApiError) {
        // Uma rejeição HTTP do provedor não é sucesso de saque. Propagar a falha
        // evita que a UI mostre o toast verde enquanto o saldo já foi estornado.
        throw new Error(
          "O provedor de pagamento recusou o saque. Confirme a configuração de saque automático e tente novamente.",
        );
      }
      throw cause;
    }
    await supabase.from("withdrawals").update({ status: "processing" }).eq("id", inserted.id);
    return { withdrawal: { ...inserted, status: "processing" } };
  }
}

/**
 * Persists the business owner's Pix withdrawal key without depending on a payment provider.
 */
export async function saveWithdrawalPixKeyForOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: unknown,
) {
  const validData = saveWithdrawalPixKeyInput.parse(data);
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", validData.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) throw new Error("Somente o dono pode cadastrar a chave PIX de saque.");

  const { error } = await supabase
    .from("businesses")
    .update({ withdrawal_pix_key: validData.pixKey, withdrawal_pix_key_type: validData.pixKeyType })
    .eq("id", validData.businessId);
  if (error) throw new Error(error.message);

  return {
    businessId: validData.businessId,
    pixKey: validData.pixKey,
    pixKeyType: validData.pixKeyType,
  };
}

/**
 * Persists the business transfer PIN (4 digits) as a salted SHA-256 hash.
 */
export async function saveWithdrawalPinForOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: unknown,
) {
  const validData = saveWithdrawalPinInput.parse(data);
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", validData.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) throw new Error("Somente o dono pode cadastrar a senha de transferência.");

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${validData.businessId}:${validData.pin}`),
  );
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");

  const { error } = await supabase
    .from("businesses")
    .update({ withdrawal_pin_hash: hash })
    .eq("id", validData.businessId);
  if (error) {
    if ((error as { code?: string }).code === "42703") {
      throw new Error(
        "Atualize o banco: aplique a migration 20261013000000_withdrawal_pin no Supabase.",
      );
    }
    throw new Error(error.message);
  }

  return { businessId: validData.businessId };
}

/** Compara o hash e confirma a senha de transferência do dono. */
export async function verifyWithdrawalPinForOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: unknown,
) {
  const validData = saveWithdrawalPinInput.parse(data);
  const { data: business } = await supabase
    .from("businesses")
    .select("id, withdrawal_pin_hash")
    .eq("id", validData.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) throw new Error("Negócio não encontrado.");
  if (!business.withdrawal_pin_hash) {
    throw new Error("Configure a senha de transferência na carteira Ag Pay.");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${validData.businessId}:${validData.pin}`),
  );
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== business.withdrawal_pin_hash) {
    throw new Error("Senha de transferência incorreta.");
  }
  return { ok: true };
}

/** Tells whether the business already set its transfer PIN. */
export async function getWithdrawalPinStatusForOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: unknown,
) {
  const validData = saveWithdrawalPinInput.pick({ businessId: true }).parse(data) as {
    businessId: string;
  };
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, withdrawal_pin_hash")
    .eq("id", validData.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "42703") {
      throw new Error(
        "Atualize o banco: aplique a migration 20261013000000_withdrawal_pin no Supabase.",
      );
    }
    throw new Error(error.message);
  }
  if (!business) throw new Error("Negócio não encontrado.");
  return { pinSet: !!business.withdrawal_pin_hash };
}

/** Persists the AgPay wallet payment rules (Pix mode + exempt clients). */
export async function savePaymentRulesForOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: unknown,
) {
  const validData = savePaymentRulesInput.parse(data);
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", validData.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) throw new Error("Somente o dono pode configurar as regras de pagamento.");

  const { error } = await supabase
    .from("businesses")
    .update({
      pix_mode: validData.pixMode,
      pix_exception_clients: validData.pixExceptionClients,
    })
    .eq("id", validData.businessId);
  if (error) {
    if ((error as { code?: string }).code === "42703") {
      throw new Error(
        "Atualize o banco: aplique a migration 20261014000000_payment_rules no Supabase.",
      );
    }
    throw new Error(error.message);
  }

  return { businessId: validData.businessId };
}

/** Reads the AgPay wallet payment rules. */
export async function getPaymentRulesForOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: unknown,
) {
  const validData = savePaymentRulesInput.pick({ businessId: true }).parse(data) as {
    businessId: string;
  };
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, pix_mode, pix_exception_clients")
    .eq("id", validData.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "42703") {
      throw new Error(
        "Atualize o banco: aplique a migration 20261014000000_payment_rules no Supabase.",
      );
    }
    throw new Error(error.message);
  }
  if (!business) throw new Error("Negócio não encontrado.");
  return {
    pixMode: (business.pix_mode ?? "opcional") as "desabilitado" | "opcional" | "obrigatorio",
    pixExceptionClients: (business.pix_exception_clients ?? []) as string[],
  };
}
