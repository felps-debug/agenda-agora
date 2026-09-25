import { decryptAsaasApiKey, deletePendingPayment, fetchPaymentStatus } from "./asaas.server";

type WebhookPayload = {
  id?: string;
  event?: string;
  account?: { id?: string };
  payment?: { id?: string; status?: string };
};

async function database() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

type Database = Awaited<ReturnType<typeof database>>;

type DepositPixClaim = {
  acquired: boolean;
  reason: string;
  claim_token: string | null;
  attempt_state: string | null;
};

// As RPCs e colunas de claim vêm da migration deposit_pix_retry; os tipos gerados
// ainda refletem o banco vinculado até ela ser aplicada.
function pixRpc(db: Database) {
  return db.rpc.bind(db) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

type CancellableCharge = {
  id: string;
  business_id: string;
  appointment_id: string | null;
  status: string;
  provider_payment_id: string | null;
};

async function readCancellableCharge(db: Database, chargeId: string) {
  const { data, error } = await db
    .from("deposit_payments")
    .select("*")
    .eq("id", chargeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CancellableCharge | null;
}

export async function getBusinessAsaasAccessToken(businessId: string) {
  const db = await database();
  const { data, error } = await db
    .from("asaas_business_credentials")
    .select("api_key_encrypted")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.api_key_encrypted) {
    throw new Error("O estabelecimento ainda não possui uma subconta Asaas configurada.");
  }
  return decryptAsaasApiKey(data.api_key_encrypted);
}

export async function persistAsaasWebhookEvent(input: unknown) {
  if (!input || typeof input !== "object") {
    throw new Error("Evento Asaas inválido.");
  }
  const payload = input as WebhookPayload;
  if (typeof payload.id !== "string" || typeof payload.event !== "string") {
    throw new Error("Evento Asaas sem id ou tipo.");
  }
  const db = await database();
  const { error } = await db.from("asaas_webhook_events").upsert(
    {
      event_id: payload.id,
      event_type: payload.event,
      account_id: payload.account?.id ?? null,
      payment_id: payload.payment?.id ?? null,
      payload: payload as never,
      status: "pending",
    },
    { onConflict: "event_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

async function markAppointmentCancelled(appointmentId: string | null) {
  if (!appointmentId) return;
  const db = await database();
  await db
    .from("appointments")
    .update({ status: "cancelado" })
    .eq("id", appointmentId)
    .neq("status", "cancelado");
}

/**
 * Transição atômica: somente quem altera pendente -> pago envia a confirmação.
 * Isso elimina duplicidade entre Webhook, polling e reprocessamento do cron.
 */
export async function confirmDepositPayment(
  providerPaymentId: string,
  providerStatus = "RECEIVED",
) {
  const db = await database();
  const { data: current, error: currentError } = await db
    .from("deposit_payments")
    .select("id, appointment_id, status")
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();
  if (currentError) throw new Error(currentError.message);
  if (!current) return { outcome: "not_found" as const };

  if (current.status !== "pendente") {
    if (!["pago", "pago_sem_agendamento"].includes(current.status)) {
      await db
        .from("deposit_payments")
        .update({
          status: "pago_sem_agendamento",
          provider_status: providerStatus,
          paid_at: new Date().toISOString(),
          payer_cpf_cnpj: null,
        })
        .eq("id", current.id);
      console.error(
        `Pagamento Asaas ${providerPaymentId} recebido após a reserva ${current.status}.`,
      );
      return { outcome: "paid_after_expiration" as const };
    }
    return { outcome: "already_paid" as const };
  }

  const paidAt = new Date().toISOString();
  const { data: transitioned, error: transitionError } = await db
    .from("deposit_payments")
    .update({
      status: "pago",
      provider_status: providerStatus,
      paid_at: paidAt,
      payer_cpf_cnpj: null,
    })
    .eq("id", current.id)
    .eq("status", "pendente")
    .select("id, appointment_id")
    .maybeSingle();
  if (transitionError) throw new Error(transitionError.message);
  if (!transitioned) return { outcome: "already_paid" as const };

  if (!transitioned.appointment_id) {
    await db
      .from("deposit_payments")
      .update({ status: "pago_sem_agendamento" })
      .eq("id", transitioned.id);
    return { outcome: "paid_without_appointment" as const };
  }

  const { error: appointmentError } = await db
    .from("appointments")
    .update({ status: "agendado", deposit_paid_at: paidAt })
    .eq("id", transitioned.appointment_id);
  if (appointmentError) {
    await db
      .from("deposit_payments")
      .update({ status: "pago_sem_agendamento" })
      .eq("id", transitioned.id);
    console.error(
      `Sinal pago sem confirmar agendamento ${transitioned.appointment_id}: ${appointmentError.message}`,
    );
    return { outcome: "appointment_conflict" as const };
  }

  const { sendBookingConfirmation } = await import("./whatsapp-notify.server");
  await sendBookingConfirmation(transitioned.appointment_id);
  return { outcome: "confirmed" as const };
}

async function expireLocalCharge(
  chargeId: string,
  appointmentId: string | null,
  providerStatus: string,
  claimToken?: string,
) {
  const db = await database();
  let query = db
    .from("deposit_payments")
    .update({
      status: "expirado",
      provider_status: providerStatus,
      provider_deleted_at: new Date().toISOString(),
      payer_cpf_cnpj: null,
      qr_code: null,
      qr_code_base64: null,
      ticket_url: null,
    })
    .eq("id", chargeId)
    .eq("status", "pendente");
  if (claimToken) query = query.filter("pix_claim_token", "eq", claimToken);
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (data) await markAppointmentCancelled(appointmentId);
  return !!data;
}

/**
 * Cancela/expira adquirindo o mesmo claim da geração Pix, para nunca expirar a
 * reserva enquanto outra instância pode estar criando a cobrança no Asaas.
 * `pendente` = adiado (claim ocupado ou POST incerto recente); tente de novo depois.
 */
export async function cancelPendingDeposit(chargeId: string): Promise<{ status: string }> {
  const db = await database();
  const rpc = pixRpc(db);
  const initial = await readCancellableCharge(db, chargeId);
  if (!initial) throw new Error("Cobrança não encontrada.");
  if (initial.status === "pago") throw new Error("Esse sinal já foi pago.");
  if (initial.status !== "pendente") return { status: initial.status };

  const { data: claimRows, error: claimError } = await rpc("claim_deposit_pix", {
    _charge_id: chargeId,
  });
  if (claimError) throw new Error("Não foi possível reservar a cobrança para cancelamento.");
  const claim = (claimRows as DepositPixClaim[] | null)?.[0];
  if (!claim?.acquired || !claim.claim_token) {
    if (claim?.reason === "ocupada") return { status: "pendente" };
    const after = await readCancellableCharge(db, chargeId);
    if (!after) throw new Error("Cobrança não encontrada.");
    if (after.status === "pago") throw new Error("Esse sinal já foi pago.");
    return { status: after.status };
  }
  const claimToken = claim.claim_token;
  let paymentRecorded = false;

  try {
    const charge = await readCancellableCharge(db, chargeId);
    if (!charge) throw new Error("Cobrança não encontrada.");
    if (charge.status === "pago") throw new Error("Esse sinal já foi pago.");
    if (charge.status !== "pendente") return { status: charge.status };
    paymentRecorded = Boolean(charge.provider_payment_id);

    // Sem ID de cobrança não há pagamento conhecido para reconciliar ou excluir.
    // Cancelar localmente também evita exigir a credencial da subconta em negócios
    // aprovados cuja credencial ainda não foi cadastrada.
    if (!charge.provider_payment_id) {
      await expireLocalCharge(charge.id, charge.appointment_id, "NOT_CREATED", claimToken);
      return { status: "expirado" };
    }

    const accessToken = await getBusinessAsaasAccessToken(charge.business_id);
    const providerPaymentId = charge.provider_payment_id;
    const result = await deletePendingPayment(accessToken, providerPaymentId);
    if (result === "received") {
      await confirmDepositPayment(providerPaymentId);
      return { status: "pago" };
    }
    if (result === "confirmed") {
      await db
        .from("deposit_payments")
        .update({ provider_status: "CONFIRMED" })
        .eq("id", charge.id);
      return { status: "aguardando_recebimento" };
    }

    await expireLocalCharge(charge.id, charge.appointment_id, "DELETED", claimToken);
    return { status: "expirado" };
  } finally {
    const { error: releaseError } = await Promise.resolve(
      rpc("release_deposit_pix", {
        _charge_id: chargeId,
        _claim_token: claimToken,
        _outcome: paymentRecorded ? "criado" : "falhou",
      }),
    ).catch((error: unknown) => ({ error: { message: String(error) } }));
    if (releaseError) console.error("Claim de cancelamento não liberado", { chargeId });
  }
}

export async function synchronizeDepositPayment(chargeId: string) {
  const db = await database();
  const { data: charge, error } = await db
    .from("deposit_payments")
    .select("id, business_id, appointment_id, status, provider_payment_id, expires_at")
    .eq("id", chargeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!charge) throw new Error("Cobrança não encontrada.");
  if (charge.status === "pago") return { status: "pago" as const };
  if (charge.status !== "pendente") return { status: "expirado" as const };

  if (charge.expires_at && new Date(charge.expires_at).getTime() <= Date.now()) {
    const cancelled = await cancelPendingDeposit(charge.id);
    if (cancelled.status === "pago") return { status: "pago" as const };
    if (cancelled.status === "pendente") return { status: "pendente" as const };
    return { status: "expirado" as const };
  }
  if (!charge.provider_payment_id) return { status: "pendente" as const };

  const accessToken = await getBusinessAsaasAccessToken(charge.business_id);
  const status = await fetchPaymentStatus(accessToken, charge.provider_payment_id);
  await db.from("deposit_payments").update({ provider_status: status }).eq("id", charge.id);
  if (status === "RECEIVED") {
    await confirmDepositPayment(charge.provider_payment_id, status);
    return { status: "pago" as const };
  }
  if (["OVERDUE", "REFUNDED", "DELETED"].includes(status)) {
    await expireLocalCharge(charge.id, charge.appointment_id, status);
    return { status: "expirado" as const };
  }
  return { status: "pendente" as const };
}

async function processWebhookEvent(row: {
  event_type: string;
  payment_id: string | null;
  payload: unknown;
}) {
  const paymentId = row.payment_id;
  if (!paymentId) return;
  const payload = row.payload as WebhookPayload;
  const providerStatus = payload.payment?.status ?? row.event_type;
  const db = await database();

  if (row.event_type === "PAYMENT_RECEIVED") {
    await confirmDepositPayment(paymentId, "RECEIVED");
    return;
  }
  if (row.event_type === "PAYMENT_CONFIRMED") {
    await db
      .from("deposit_payments")
      .update({ provider_status: "CONFIRMED" })
      .eq("provider_payment_id", paymentId);
    return;
  }
  if (["PAYMENT_OVERDUE", "PAYMENT_DELETED"].includes(row.event_type)) {
    const { data: charge } = await db
      .from("deposit_payments")
      .select("id, appointment_id")
      .eq("provider_payment_id", paymentId)
      .maybeSingle();
    if (charge) {
      await expireLocalCharge(charge.id, charge.appointment_id, providerStatus);
    }
    return;
  }
  if (row.event_type === "PAYMENT_REFUNDED") {
    const { data: charge } = await db
      .from("deposit_payments")
      .update({
        status: "estornado",
        provider_status: "REFUNDED",
        payer_cpf_cnpj: null,
      })
      .eq("provider_payment_id", paymentId)
      .select("appointment_id")
      .maybeSingle();
    if (charge) await markAppointmentCancelled(charge.appointment_id);
    return;
  }
  if (row.event_type === "PAYMENT_SPLIT_DIVERGENCE_BLOCK") {
    throw new Error(
      `Divergência de Split bloqueou o pagamento Asaas ${paymentId}; requer revisão operacional.`,
    );
  }
}

export async function processAsaasWebhookEvents(limit = 25) {
  const db = await database();
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  await db
    .from("asaas_webhook_events")
    .update({
      status: "failed",
      locked_at: null,
      available_at: new Date().toISOString(),
      last_error: "Processamento anterior excedeu cinco minutos.",
    })
    .eq("status", "processing")
    .lt("locked_at", staleBefore);

  const now = new Date().toISOString();
  const { data: candidates, error } = await db
    .from("asaas_webhook_events")
    .select("id, event_type, payment_id, payload, attempts")
    .in("status", ["pending", "failed"])
    .lte("available_at", now)
    .order("received_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let processed = 0;
  let failed = 0;
  for (const candidate of candidates ?? []) {
    const { data: claimed } = await db
      .from("asaas_webhook_events")
      .update({ status: "processing", locked_at: new Date().toISOString() })
      .eq("id", candidate.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      await processWebhookEvent(candidate);
      await db
        .from("asaas_webhook_events")
        .update({
          status: "done",
          processed_at: new Date().toISOString(),
          locked_at: null,
          last_error: null,
        })
        .eq("id", candidate.id);
      processed++;
    } catch (processError) {
      const attempts = candidate.attempts + 1;
      const delaySeconds = Math.min(900, 15 * 2 ** Math.min(attempts, 6));
      await db
        .from("asaas_webhook_events")
        .update({
          status: "failed",
          attempts,
          locked_at: null,
          available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
          last_error: String(
            processError instanceof Error ? processError.message : processError,
          ).slice(0, 1000),
        })
        .eq("id", candidate.id);
      failed++;
    }
  }
  return { processed, failed };
}

export async function expirePendingDeposits(limit = 25) {
  const db = await database();
  const { data: charges, error } = await db
    .from("deposit_payments")
    .select("id")
    .eq("status", "pendente")
    .lte("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let expired = 0;
  let waitingReceipt = 0;
  let deferred = 0;
  let failed = 0;
  for (const charge of charges ?? []) {
    try {
      const result = await cancelPendingDeposit(charge.id);
      if (result.status === "aguardando_recebimento") waitingReceipt++;
      else if (result.status === "expirado") expired++;
      else if (result.status === "pendente") deferred++;
    } catch (expireError) {
      console.error(`Falha ao expirar cobrança ${charge.id}:`, expireError);
      failed++;
    }
  }
  return { expired, waitingReceipt, deferred, failed };
}
