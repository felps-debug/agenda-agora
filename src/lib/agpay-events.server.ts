import { createHash } from "node:crypto";
import { fetchPaymentStatus } from "./agpay.server";
import {
  computePaymentBreakdown,
  creditPayment,
  debitRefund,
  settleWithdrawal,
} from "./ledger.server";

type WebhookPayload = {
  event?: string;
  data?: {
    transaction_uuid?: string;
    withdrawal_uuid?: string;
    // A AgPay identifica o saque pelo mesmo id numérico devolvido no POST /cashout/pix.
    withdrawal_id?: string | number;
    uuid?: string;
    status?: string;
  };
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

function pixRpc(db: Database) {
  return db.rpc.bind(db) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

type CancellableCharge = {
  id: string;
  appointment_id: string | null;
  status: string;
  provider_payment_id: string | null;
};

type LedgerPayment = {
  id: string;
  appointment_id: string | null;
  business_id: string;
  amount_cents: number;
  payer_name: string | null;
  status: string;
  gateway_fee_cents: number | null;
  platform_commission_percent_snapshot: number | null;
  platform_commission_flat_cents: number | null;
  platform_commission_cents: number | null;
  net_amount_cents: number | null;
};

const LEDGER_PAYMENT_COLUMNS =
  "id, appointment_id, business_id, amount_cents, payer_name, status, gateway_fee_cents, platform_commission_percent_snapshot, platform_commission_flat_cents, platform_commission_cents, net_amount_cents";

async function readLedgerPayment(db: Database, providerPaymentId: string) {
  const { data, error } = await db
    .from("deposit_payments")
    .select(LEDGER_PAYMENT_COLUMNS)
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LedgerPayment | null;
}

async function freezePaymentBreakdown(db: Database, payment: LedgerPayment) {
  const snapshot = [
    payment.gateway_fee_cents,
    payment.platform_commission_percent_snapshot,
    payment.platform_commission_flat_cents,
    payment.platform_commission_cents,
    payment.net_amount_cents,
  ];
  if (snapshot.every((value) => value !== null)) return payment;
  if (snapshot.some((value) => value !== null)) {
    throw new Error("Decomposição financeira incompleta para o pagamento.");
  }
  const { data: business, error: businessError } = await db
    .from("businesses")
    .select("agpay_commission_percent")
    .eq("id", payment.business_id)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (!business) throw new Error("Negócio do pagamento não encontrado.");
  const breakdown = computePaymentBreakdown(
    payment.amount_cents,
    Number(business.agpay_commission_percent),
  );
  if (breakdown.netAmountCents <= 0) {
    throw new Error("Valor líquido do pagamento deve ser positivo.");
  }
  const { data: saved, error: saveError } = await db
    .from("deposit_payments")
    .update({
      gateway_fee_cents: breakdown.gatewayFeeCents,
      platform_commission_percent_snapshot: breakdown.platformCommissionPercentSnapshot,
      platform_commission_flat_cents: breakdown.platformCommissionFlatCents,
      platform_commission_cents: breakdown.platformCommissionCents,
      net_amount_cents: breakdown.netAmountCents,
    })
    .eq("id", payment.id)
    .is("net_amount_cents", null)
    .select(LEDGER_PAYMENT_COLUMNS)
    .maybeSingle();
  if (saveError) throw new Error(saveError.message);
  if (saved) return saved as LedgerPayment;
  const winner = await readLedgerPaymentById(db, payment.id);
  if (!winner || winner.net_amount_cents === null) {
    throw new Error("Não foi possível confirmar a decomposição financeira do pagamento.");
  }
  return freezePaymentBreakdown(db, winner);
}

async function readLedgerPaymentById(db: Database, paymentId: string) {
  const { data, error } = await db
    .from("deposit_payments")
    .select(LEDGER_PAYMENT_COLUMNS)
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LedgerPayment | null;
}

async function creditFrozenPayment(db: Database, payment: LedgerPayment) {
  if (payment.net_amount_cents === null || payment.net_amount_cents <= 0) {
    throw new Error("Pagamento sem valor líquido válido para crédito.");
  }
  return creditPayment(db, {
    businessId: payment.business_id,
    paymentId: payment.id,
    amountCents: payment.net_amount_cents,
    description: `Sinal de ${payment.payer_name?.trim() || "cliente"}`,
    metadata: {
      gross_cents: payment.amount_cents,
      gateway_fee_cents: payment.gateway_fee_cents,
      platform_commission_percent_snapshot: payment.platform_commission_percent_snapshot,
      platform_commission_flat_cents: payment.platform_commission_flat_cents,
      platform_commission_cents: payment.platform_commission_cents,
    },
  });
}

async function readCancellableCharge(db: Database, chargeId: string) {
  const { data, error } = await db
    .from("deposit_payments")
    .select("id, appointment_id, status, provider_payment_id")
    .eq("id", chargeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CancellableCharge | null;
}

export async function persistAgpayWebhookEvent(rawBody: string, input: unknown) {
  if (!input || typeof input !== "object") {
    throw new Error("Evento AgPay inválido.");
  }
  const payload = input as WebhookPayload;
  if (typeof payload.event !== "string" || !payload.data || typeof payload.data !== "object") {
    throw new Error("Evento AgPay sem tipo ou dados.");
  }

  const dedupeHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  const db = await database();
  const { error } = await db.from("agpay_webhook_events").upsert(
    {
      dedupe_hash: dedupeHash,
      event_type: payload.event,
      transaction_uuid:
        typeof payload.data.transaction_uuid === "string" ? payload.data.transaction_uuid : null,
      payload: payload as never,
      status: "pending",
    },
    { onConflict: "dedupe_hash", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

async function markAppointmentCancelled(appointmentId: string | null) {
  if (!appointmentId) return;
  const db = await database();
  const { error } = await db
    .from("appointments")
    .update({ status: "cancelado" })
    .eq("id", appointmentId)
    .neq("status", "cancelado");
  if (error) throw new Error(error.message);
}

/** Somente a instância que efetua pendente -> pago confirma e notifica. */
export async function confirmDepositPayment(
  providerPaymentId: string,
  providerStatus = "completed",
) {
  const db = await database();
  const current = await readLedgerPayment(db, providerPaymentId);
  if (!current) return { outcome: "not_found" as const };
  const paidAt = new Date().toISOString();
  let payment = current;
  let transitioned = false;
  let latePayment = false;
  if (current.status === "pendente" || !["pago", "pago_sem_agendamento"].includes(current.status)) {
    latePayment = current.status !== "pendente";
    const { data, error } = await db
      .from("deposit_payments")
      .update({
        status: latePayment ? "pago_sem_agendamento" : "pago",
        provider_status: providerStatus,
        paid_at: paidAt,
        payer_cpf_cnpj: null,
      })
      .eq("id", current.id)
      .eq("status", current.status)
      .select(LEDGER_PAYMENT_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    transitioned = Boolean(data);
    payment = (data as LedgerPayment | null) ?? (await readLedgerPaymentById(db, current.id))!;
  }

  payment = await freezePaymentBreakdown(db, payment);
  const credited = await creditFrozenPayment(db, payment);
  // Uma falha no crédito sobe ao worker: a inbox fica failed e reprocessa o snapshot congelado.
  if (!transitioned && !credited.created) return { outcome: "already_paid" as const };
  if (latePayment || payment.status === "pago_sem_agendamento") {
    return { outcome: "paid_after_expiration" as const };
  }
  if (!payment.appointment_id) {
    const { error } = await db
      .from("deposit_payments")
      .update({ status: "pago_sem_agendamento" })
      .eq("id", payment.id);
    if (error) throw new Error(error.message);
    return { outcome: "paid_without_appointment" as const };
  }

  const { error: appointmentError } = await db
    .from("appointments")
    .update({ status: "agendado", deposit_paid_at: paidAt })
    .eq("id", payment.appointment_id);
  if (appointmentError) {
    const { error: fallbackError } = await db
      .from("deposit_payments")
      .update({ status: "pago_sem_agendamento" })
      .eq("id", payment.id);
    if (fallbackError) throw new Error(fallbackError.message);
    console.error(
      `Sinal pago sem confirmar agendamento ${payment.appointment_id}: ${appointmentError.message}`,
    );
    return { outcome: "appointment_conflict" as const };
  }

  const { sendPaymentConfirmation } = await import("./whatsapp-notify.server");
  await sendPaymentConfirmation(payment.appointment_id);
  return { outcome: "confirmed" as const };
}

export async function expireLocalCharge(
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
  return Boolean(data);
}

/**
 * Cancela somente no banco local. O AgPay não documenta cancelamento de Pix
 * pendente e FR-010 determina que a cobrança externa expire naturalmente.
 */
export async function cancelPendingDeposit(chargeId: string): Promise<{ status: string }> {
  const db = await database();
  const rpc = pixRpc(db);
  const initial = await readCancellableCharge(db, chargeId);
  if (!initial) throw new Error("Cobrança não encontrada.");
  if (["pago", "pago_sem_agendamento"].includes(initial.status)) {
    throw new Error("Esse sinal já foi pago.");
  }
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
    if (["pago", "pago_sem_agendamento"].includes(after.status)) {
      throw new Error("Esse sinal já foi pago.");
    }
    return { status: after.status };
  }

  const claimToken = claim.claim_token;
  let paymentRecorded = false;

  try {
    const charge = await readCancellableCharge(db, chargeId);
    if (!charge) throw new Error("Cobrança não encontrada.");
    paymentRecorded = Boolean(charge.provider_payment_id);
    if (["pago", "pago_sem_agendamento"].includes(charge.status)) {
      throw new Error("Esse sinal já foi pago.");
    }
    if (charge.status !== "pendente") return { status: charge.status };

    await expireLocalCharge(
      charge.id,
      charge.appointment_id,
      charge.provider_payment_id ? "cancelled_locally" : "not_created",
      claimToken,
    );
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
    .select("id, appointment_id, status, provider_payment_id, expires_at")
    .eq("id", chargeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!charge) throw new Error("Cobrança não encontrada.");
  if (["pago", "pago_sem_agendamento"].includes(charge.status)) {
    if (charge.provider_payment_id) {
      await confirmDepositPayment(charge.provider_payment_id, charge.status);
    }
    return { status: "pago" as const };
  }
  if (charge.status !== "pendente") return { status: "expirado" as const };

  // Consulta o status real no AgPay antes de decidir por expiração: um Pix pode ser
  // confirmado no gateway perto do fim da janela e só chegar aqui depois de expirar
  // localmente (webhook atrasado/ausente). Cancelar sem checar perderia um pagamento já recebido.
  if (charge.provider_payment_id) {
    const status = await fetchPaymentStatus(charge.provider_payment_id);
    await db.from("deposit_payments").update({ provider_status: status }).eq("id", charge.id);
    if (status === "completed") {
      await confirmDepositPayment(charge.provider_payment_id, status);
      return { status: "pago" as const };
    }
    if (status === "failed") {
      await expireLocalCharge(charge.id, charge.appointment_id, status);
      return { status: "expirado" as const };
    }
  }

  if (charge.expires_at && new Date(charge.expires_at).getTime() <= Date.now()) {
    const cancelled = await cancelPendingDeposit(charge.id);
    if (cancelled.status === "pendente") return { status: "pendente" as const };
    return { status: "expirado" as const };
  }

  return { status: "pendente" as const };
}

async function processWebhookEvent(row: {
  event_type: string;
  transaction_uuid: string | null;
  payload: unknown;
}) {
  const payload = row.payload as WebhookPayload;
  const withdrawalRef =
    payload.data?.withdrawal_uuid ??
    (payload.data?.withdrawal_id != null ? String(payload.data.withdrawal_id) : undefined) ??
    payload.data?.uuid ??
    row.transaction_uuid;
  if (row.event_type.startsWith("withdrawal.")) {
    if (!withdrawalRef) return;
    const db = await database();
    const terminalStatus =
      row.event_type === "withdrawal.completed"
        ? "paid"
        : ["withdrawal.failed", "withdrawal.rejected"].includes(row.event_type)
          ? "failed"
          : "processing";
    if (terminalStatus !== "processing") {
      const { data: withdrawal, error: lookupError } = await db
        .from("withdrawals")
        .select("id")
        .eq("provider_ref", withdrawalRef)
        .maybeSingle();
      if (lookupError) throw new Error(lookupError.message);
      if (withdrawal) {
        await settleWithdrawal(db, {
          withdrawalId: withdrawal.id,
          outcome: terminalStatus,
          providerRef: withdrawalRef,
        });
        return;
      }
    }
    const { error } = await db
      .from("withdrawals")
      .update({
        status: terminalStatus,
        provider_ref: withdrawalRef,
        updated_at: new Date().toISOString(),
      })
      .eq("provider_ref", withdrawalRef)
      .in("status", ["requested", "processing"]);
    if (error) throw new Error(error.message);
    return;
  }
  const transactionUuid = row.transaction_uuid;
  if (!transactionUuid) return;
  const providerStatus = payload.data?.status ?? row.event_type;

  if (isRefundEvent(row.event_type, payload.data?.status)) {
    const db = await database();
    const payment = await readLedgerPayment(db, transactionUuid);
    if (!payment || !["pago", "pago_sem_agendamento"].includes(payment.status)) {
      throw new Error("Estorno recebido antes da confirmação do pagamento.");
    }
    const frozen = await freezePaymentBreakdown(db, payment);
    await creditFrozenPayment(db, frozen);
    await debitRefund(db, {
      businessId: frozen.business_id,
      paymentId: frozen.id,
      amountCents: frozen.net_amount_cents!,
      description: `Estorno do sinal de ${frozen.payer_name?.trim() || "cliente"}`,
    });
    return;
  }

  if (row.event_type === "deposit.completed") {
    await confirmDepositPayment(transactionUuid, "completed");
    return;
  }
  if (row.event_type === "transaction.failed") {
    const db = await database();
    const { data: charge, error } = await db
      .from("deposit_payments")
      .select("id, appointment_id")
      .eq("provider_payment_id", transactionUuid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (charge) await expireLocalCharge(charge.id, charge.appointment_id, providerStatus);
  }
  // waiting_payment fica registrado apenas para auditoria.
}

/** Hipótese até o AgPay confirmar o nome oficial do evento de estorno. */
function isRefundEvent(eventType: string, status?: string) {
  return (
    ["transaction.refunded", "deposit.refunded", "transaction.chargeback"].includes(eventType) ||
    (["transaction.updated", "deposit.updated"].includes(eventType) &&
      ["refunded", "chargeback", "charged_back"].includes(status ?? ""))
  );
}

export async function processAgpayWebhookEvents(limit = 25) {
  const db = await database();
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  await db
    .from("agpay_webhook_events")
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
    .from("agpay_webhook_events")
    .select("id, event_type, transaction_uuid, payload, attempts")
    .in("status", ["pending", "failed"])
    .lte("available_at", now)
    .order("received_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let processed = 0;
  let failed = 0;
  for (const candidate of candidates ?? []) {
    const { data: claimed } = await db
      .from("agpay_webhook_events")
      .update({ status: "processing", locked_at: new Date().toISOString() })
      .eq("id", candidate.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      await processWebhookEvent(candidate);
      await db
        .from("agpay_webhook_events")
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
        .from("agpay_webhook_events")
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
  let recovered = 0;
  let deferred = 0;
  let failed = 0;
  for (const charge of charges ?? []) {
    try {
      // synchronizeDepositPayment checa o status real no AgPay antes de expirar: evita
      // cancelar uma cobrança que já foi paga no gateway mas não teve o webhook processado a tempo.
      const result = await synchronizeDepositPayment(charge.id);
      if (result.status === "expirado") expired++;
      else if (result.status === "pendente") deferred++;
      else if (result.status === "pago") recovered++;
    } catch (expireError) {
      console.error(`Falha ao expirar cobrança ${charge.id}:`, expireError);
      failed++;
    }
  }
  return { expired, recovered, waitingReceipt: 0, deferred, failed };
}
