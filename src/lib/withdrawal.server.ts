import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  MIN_WITHDRAWAL_CENTS,
  WITHDRAWAL_FEE_CENTS,
  savePaymentRulesInput,
  saveWithdrawalPinInput,
  saveWithdrawalPixKeyInput,
} from "@/lib/withdrawal.functions";
import { AgpayAmbiguousResponseError, AgpayApiError, createCashoutPix } from "@/lib/agpay.server";
import { requestWithdrawal, settleWithdrawal } from "@/lib/ledger.server";
import { checkLock, registerFailure, registerSuccess } from "@/lib/login-attempts.server";

/**
 * Taxa fixa de saque da plataforma: R$ 3,00, independente do valor (decisão comercial de
 * 05/10/2026). O valor pedido sai inteiro da carteira; o Pix enviado ao dono é o valor
 * menos esta taxa. Estorno de saque falho devolve o valor pedido inteiro. A AgPay exige
 * Pix líquido de no mínimo R$ 10,00, por isso o pedido mínimo é R$ 13,00.
 */
export { WITHDRAWAL_FEE_CENTS };

const WITHDRAWAL_PIN_ATTEMPT_LIMIT = {
  limit: 5,
  windowMs: 15 * 60_000,
  lockMs: 30 * 60_000,
} as const;

async function assertWithdrawalPin(
  businessId: string,
  userId: string,
  pin: string,
  storedHash: string | null | undefined,
) {
  const attemptKey = `withdrawal-pin:${userId}:${businessId}`;
  const lock = await checkLock(attemptKey);
  if (lock.locked) throw new Error(`TOO_MANY_ATTEMPTS:${lock.retryAfterSeconds}`);
  if (!storedHash) throw new Error("Configure a senha de transferência na carteira Ag Pay.");

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${businessId}:${pin}`),
  );
  const pinHash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (pinHash !== storedHash) {
    const failure = await registerFailure(attemptKey, WITHDRAWAL_PIN_ATTEMPT_LIMIT);
    if (failure.locked) throw new Error(`TOO_MANY_ATTEMPTS:${failure.retryAfterSeconds}`);
    throw new Error("Senha de transferência incorreta.");
  }
  await registerSuccess(attemptKey);
}

async function persistAmbiguousCashoutReview(
  supabase: SupabaseClient<Database>,
  input: { withdrawalId: string; businessId: string; amountCents: number; path: string },
) {
  const dedupeHash = createHash("sha256")
    .update(`cashout.response_ambiguous:${input.withdrawalId}`, "utf8")
    .digest("hex");
  const lastError = "AgPay respondeu sem referência do saque; é necessária revisão manual.";
  const { error } = await supabase.from("agpay_webhook_events").upsert(
    {
      dedupe_hash: dedupeHash,
      event_type: "cashout.response_ambiguous",
      transaction_uuid: null,
      payload: {
        source: "cashout_response",
        withdrawal_id: input.withdrawalId,
        business_id: input.businessId,
        amount_cents: input.amountCents,
        path: input.path,
      },
      status: "error",
      attempts: 1,
      locked_at: null,
      processed_at: null,
      last_error: lastError,
    },
    { onConflict: "dedupe_hash" },
  );
  if (error) throw new Error("Não foi possível registrar o saque ambíguo para revisão.");
}

export async function createWithdrawal(
  client: SupabaseClient<Database>,
  userId: string,
  businessId: string,
  amountCents: number,
  idempotencyKey: string,
  pin: string,
) {
  const ownerDb = client;
  const { data: business, error } = await ownerDb
    .from("businesses")
    .select("id, agpay_withdrawal_blocked, agpay_access_blocked")
    .eq("id", businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error || !business) throw new Error("Negócio não encontrado.");
  if (business.agpay_access_blocked)
    throw new Error("Sua carteira Ag Pay está bloqueada pelo suporte.");
  if (business.agpay_withdrawal_blocked)
    throw new Error("Os saques da sua carteira estão bloqueados pelo suporte.");
  const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
  const { data: privateFields, error: privateFieldsError } = await supabase
    .from("businesses")
    .select("withdrawal_pix_key, withdrawal_pix_key_type, withdrawal_pin_hash")
    .eq("id", business.id)
    .maybeSingle();
  if (privateFieldsError || !privateFields)
    throw new Error("Não foi possível consultar a carteira.");
  if (!privateFields.withdrawal_pix_key)
    throw new Error("Cadastre uma chave Pix antes de solicitar o saque.");
  if (!privateFields.withdrawal_pix_key_type)
    throw new Error("A chave Pix de saque não está aprovada para uso.");
  if (!Number.isInteger(amountCents) || amountCents < MIN_WITHDRAWAL_CENTS)
    throw new Error("O saque mínimo é R$ 13,00.");
  if (!privateFields.withdrawal_pin_hash) {
    throw new Error("Configure a senha de transferência na carteira Ag Pay.");
  }
  await assertWithdrawalPin(business.id, userId, pin, privateFields.withdrawal_pin_hash);
  const { data: approvedKey, error: approvalError } = await supabase
    .from("pix_key_approvals")
    .select("id")
    .eq("business_id", business.id)
    .eq("key_type", privateFields.withdrawal_pix_key_type)
    .eq("key", privateFields.withdrawal_pix_key)
    .eq("status", "aprovado")
    .limit(1)
    .maybeSingle();
  if (approvalError || !approvedKey) {
    throw new Error("A chave Pix de saque não está aprovada para uso.");
  }
  const { data: existing } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing && existing.business_id !== business.id)
    throw new Error("Esta chave de idempotencia ja esta vinculada a outro negocio.");
  if (existing) return { withdrawal: existing };
  const { data: inserted, error: insertError } = await supabase
    .from("withdrawals")
    .insert({
      business_id: business.id,
      amount_cents: amountCents,
      status: "requested",
      idempotency_key: idempotencyKey,
      pix_key_snapshot: privateFields.withdrawal_pix_key,
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
      if (!duplicate || duplicate.business_id !== business.id)
        throw new Error("Esta chave de idempotencia ja esta vinculada a outro negocio.");
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
      pixKey: privateFields.withdrawal_pix_key,
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
    if (updateError) {
      const reviewMessage = `Falha ao persistir a referência do cashout do saque ${inserted.id}: ${updateError.message}`;
      const dedupeHash = createHash("sha256")
        .update(`cashout.reference_persist_failed:${inserted.id}:${payout.providerRef}`, "utf8")
        .digest("hex");
      try {
        const { error: reviewError } = await supabase.from("agpay_webhook_events").upsert(
          {
            dedupe_hash: dedupeHash,
            event_type: "cashout.reference_persist_failed",
            transaction_uuid: payout.providerRef,
            payload: {
              source: "cashout_reference_persist",
              withdrawal_id: inserted.id,
              business_id: business.id,
              amount_cents: amountCents,
              provider_fee_cents: payout.providerFeeCents,
              provider_ref: payout.providerRef,
            },
            status: "error",
            attempts: 1,
            locked_at: null,
            processed_at: null,
            last_error: reviewMessage.slice(0, 1000),
          },
          { onConflict: "dedupe_hash" },
        );
        if (reviewError) throw reviewError;
      } catch (reviewError) {
        console.error("Falha ao registrar cashout para revisão manual", {
          withdrawalId: inserted.id,
          businessId: business.id,
          providerRef: payout.providerRef,
          message: reviewError instanceof Error ? reviewError.message : String(reviewError),
        });
      }
      throw new Error("Saque registrado em processamento e encaminhado para revisão manual.");
    }
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
    // Only HTTP 422 or the adapter's explicit success=false mapping is currently
    // treated as a definitive rejection. Other statuses keep the reservation locked.
    const definitiveProviderRejection = cause instanceof AgpayApiError && cause.status === 422;
    const locallyRejectedAmount = cause instanceof Error && cause.message.includes("mínimo");
    if (definitiveProviderRejection || locallyRejectedAmount) {
      await settleWithdrawal(supabase, { withdrawalId: inserted.id, outcome: "failed" });
      if (definitiveProviderRejection && cause instanceof AgpayApiError) {
        // Uma rejeição HTTP do provedor não é sucesso de saque. Propagar a falha
        // evita que a UI mostre o toast verde enquanto o saldo já foi estornado.
        throw new Error(
          "O provedor de pagamento recusou o saque. Confirme a configuração de saque automático e tente novamente.",
        );
      }
      throw cause;
    }
    if (cause instanceof AgpayAmbiguousResponseError) {
      try {
        await persistAmbiguousCashoutReview(supabase, {
          withdrawalId: inserted.id,
          businessId: business.id,
          amountCents,
          path: cause.path,
        });
      } catch (reviewError) {
        console.error("Falha ao registrar cashout ambíguo para revisão manual", {
          withdrawalId: inserted.id,
          businessId: business.id,
          message: reviewError instanceof Error ? reviewError.message : String(reviewError),
        });
      }
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

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
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

export async function getWithdrawalPixKeyForOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: unknown,
) {
  const validData = z.object({ businessId: z.string().guid() }).parse(data);
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", validData.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (!business) throw new Error("Negócio não encontrado.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: privateFields, error } = await supabaseAdmin
    .from("businesses")
    .select("withdrawal_pix_key, withdrawal_pix_key_type")
    .eq("id", validData.businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    businessId: validData.businessId,
    withdrawal_pix_key: privateFields?.withdrawal_pix_key ?? null,
    withdrawal_pix_key_type: privateFields?.withdrawal_pix_key_type ?? null,
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

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: savedPin, error } = await supabaseAdmin
    .from("businesses")
    .update({ withdrawal_pin_hash: hash })
    .eq("id", validData.businessId)
    .is("withdrawal_pin_hash", null)
    .select("id")
    .maybeSingle();
  if (error) {
    if ((error as { code?: string }).code === "42703") {
      throw new Error(
        "Atualize o banco: aplique a migration 20261013000000_withdrawal_pin no Supabase.",
      );
    }
    throw new Error(error.message);
  }
  if (!savedPin) throw new Error("A senha de transferência já foi cadastrada.");
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
    .select("id")
    .eq("id", validData.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) throw new Error("Negócio não encontrado.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: privateFields, error } = await supabaseAdmin
    .from("businesses")
    .select("withdrawal_pin_hash")
    .eq("id", validData.businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  await assertWithdrawalPin(
    validData.businessId,
    userId,
    validData.pin,
    privateFields?.withdrawal_pin_hash,
  );
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
    .select("id")
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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: privateFields, error: privateError } = await supabaseAdmin
    .from("businesses")
    .select("withdrawal_pin_hash")
    .eq("id", validData.businessId)
    .maybeSingle();
  if (privateError) throw new Error(privateError.message);
  return { pinSet: !!privateFields?.withdrawal_pin_hash };
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
