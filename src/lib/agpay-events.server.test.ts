import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Filter = [string, "eq" | "neq" | "in" | "lt" | "lte", unknown];

const runtime = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  claim: null as Row | null,
  updates: [] as Array<{ table: string; patch: Row; filters: Filter[] }>,
  fetchPaymentStatus: vi.fn(),
  sendBookingConfirmation: vi.fn(),
  sendPaymentConfirmation: vi.fn(),
  failCreditOnce: false,
}));

class FakeQuery {
  private patch: Row | null = null;
  private filters: Filter[] = [];
  private maxRows: number | null = null;

  constructor(private readonly table: string) {}

  select() {
    return this;
  }
  update(patch: Row) {
    this.patch = patch;
    return this;
  }
  async upsert(row: Row, options: { onConflict?: string; ignoreDuplicates?: boolean }) {
    const rows = (runtime.tables[this.table] ??= []);
    const conflict = options.onConflict;
    if (
      conflict &&
      options.ignoreDuplicates &&
      rows.some((existing) => existing[conflict] === row[conflict])
    ) {
      return { data: null, error: null };
    }
    rows.push({
      id: `event-${rows.length + 1}`,
      attempts: 0,
      available_at: new Date(0).toISOString(),
      received_at: new Date(0).toISOString(),
      ...row,
    });
    return { data: row, error: null };
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, "eq", value]);
    return this;
  }
  is(column: string, value: null) {
    this.filters.push([column, "eq", value]);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push([column, "neq", value]);
    return this;
  }
  filter(column: string, op: string, value: unknown) {
    this.filters.push([column, op as "eq", value]);
    return this;
  }
  in(column: string, value: unknown[]) {
    this.filters.push([column, "in", value]);
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push([column, "lt", value]);
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push([column, "lte", value]);
    return this;
  }
  order() {
    return this;
  }
  limit(value: number) {
    this.maxRows = value;
    return this;
  }
  maybeSingle() {
    return this.exec().then(({ data, error }) => ({ data: data[0] ?? null, error }));
  }
  then<T>(resolve: (value: { data: Row[]; error: null }) => T) {
    return this.exec().then(resolve);
  }

  private matches(row: Row) {
    return this.filters.every(([column, op, value]) => {
      if (op === "neq") return row[column] !== value;
      if (op === "in") return (value as unknown[]).includes(row[column]);
      if (op === "lt") return String(row[column]) < String(value);
      if (op === "lte") return String(row[column]) <= String(value);
      return row[column] === value;
    });
  }

  private async exec() {
    let rows = (runtime.tables[this.table] ??= []).filter((row) => this.matches(row));
    if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);
    if (this.patch) {
      runtime.updates.push({ table: this.table, patch: this.patch, filters: [...this.filters] });
      rows.forEach((row) => Object.assign(row, this.patch));
    }
    return { data: rows.map((row) => ({ ...row })), error: null };
  }
}

const fakeDb = {
  from: (table: string) => new FakeQuery(table),
  rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
    runtime.rpcCalls.push({ name, args });
    if (name === "claim_deposit_pix") return { data: [runtime.claim], error: null };
    if (name === "release_deposit_pix") return { data: true, error: null };
    if (name === "ledger_settle_withdrawal") {
      const withdrawal = (runtime.tables["withdrawals"] ?? []).find(
        (row) => row["id"] === args["_withdrawal_id"],
      );
      if (!withdrawal) return { data: null, error: { message: "Saque não encontrado." } };
      const changed = !["paid", "failed", "canceled"].includes(String(withdrawal["status"]));
      if (changed) {
        withdrawal["status"] = args["_outcome"];
        withdrawal["provider_ref"] = args["_provider_ref"];
      }
      return {
        data: [{ changed, final_status: withdrawal["status"] }],
        error: null,
      };
    }
    if (name === "ledger_credit_payment" || name === "ledger_debit_refund") {
      if (name === "ledger_credit_payment" && runtime.failCreditOnce) {
        runtime.failCreditOnce = false;
        return { data: null, error: { message: "falha transitória" } };
      }
      const entries = (runtime.tables["ledger_entries"] ??= []);
      const key = String(args["_idempotency_key"]);
      const existing = entries.find((entry) => entry["idempotency_key"] === key);
      if (existing) return { data: [{ entry_id: existing["id"], created: false }], error: null };
      const amount = Number(args["_amount_cents"]);
      const delta = name === "ledger_credit_payment" ? amount : -amount;
      const entry = {
        id: `ledger-${entries.length + 1}`,
        business_id: args["_business_id"],
        payment_id: args["_payment_id"],
        type: name === "ledger_credit_payment" ? "payment_credit" : "refund_debit",
        amount_cents: delta,
        idempotency_key: key,
        description: args["_description"],
        metadata: args["_metadata"],
      };
      entries.push(entry);
      const wallet = runtime.tables["wallets"]![0]!;
      wallet["available_cents"] = Number(wallet["available_cents"]) + delta;
      return { data: [{ entry_id: entry.id, created: true }], error: null };
    }
    throw new Error(`RPC inesperada: ${name}`);
  }),
};

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeDb }));
vi.mock("./agpay.server", () => ({ fetchPaymentStatus: runtime.fetchPaymentStatus }));
vi.mock("./whatsapp-notify.server", () => ({
  sendBookingConfirmation: runtime.sendBookingConfirmation,
  sendPaymentConfirmation: runtime.sendPaymentConfirmation,
}));

const {
  cancelPendingDeposit,
  confirmDepositPayment,
  expirePendingDeposits,
  persistAgpayWebhookEvent,
  processAgpayWebhookEvents,
  synchronizeDepositPayment,
} = await import("./agpay-events.server");

const CHARGE = "0e000000-0000-4000-8000-000000000001";
const TOKEN = "0f000000-0000-4000-8000-000000000001";
const PAYMENT = "tx-agpay-1";

function seed(charge: Row = {}, claim: Row = {}) {
  runtime.rpcCalls = [];
  runtime.updates = [];
  runtime.tables = {
    deposit_payments: [
      {
        id: CHARGE,
        appointment_id: "appt-1",
        status: "pendente",
        provider_payment_id: PAYMENT,
        business_id: "biz-1",
        amount_cents: 10000,
        payer_name: "Maria",
        gateway_fee_cents: null,
        platform_commission_percent_snapshot: null,
        platform_commission_flat_cents: null,
        platform_commission_cents: null,
        net_amount_cents: null,
        expires_at: "2020-01-01T00:00:00.000Z",
        pix_claim_token: TOKEN,
        ...charge,
      },
    ],
    appointments: [{ id: "appt-1", status: "aguardando_sinal" }],
    businesses: [{ id: "biz-1", agpay_commission_percent: 0 }],
    wallets: [{ business_id: "biz-1", available_cents: 0 }],
    ledger_entries: [],
    agpay_webhook_events: [],
  };
  runtime.claim = {
    acquired: true,
    reason: "ok",
    claim_token: TOKEN,
    attempt_state: "criado",
    ...claim,
  };
}

const charge = () => runtime.tables["deposit_payments"]![0]!;
const appointment = () => runtime.tables["appointments"]![0]!;

describe("eventos de pagamento AgPay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.sendBookingConfirmation.mockResolvedValue(undefined);
    runtime.sendPaymentConfirmation.mockResolvedValue(undefined);
    runtime.fetchPaymentStatus.mockResolvedValue("pending");
    runtime.failCreditOnce = false;
    seed();
  });

  it("confirma pendente apenas uma vez e não duplica a notificação", async () => {
    await expect(confirmDepositPayment(PAYMENT)).resolves.toEqual({ outcome: "confirmed" });
    await expect(confirmDepositPayment(PAYMENT)).resolves.toEqual({ outcome: "already_paid" });

    expect(charge()["status"]).toBe("pago");
    expect(appointment()["status"]).toBe("agendado");
    expect(runtime.sendPaymentConfirmation).toHaveBeenCalledTimes(1);
    expect(charge()).toMatchObject({
      gateway_fee_cents: 75,
      platform_commission_percent_snapshot: 0,
      platform_commission_flat_cents: 0,
      platform_commission_cents: 0,
      net_amount_cents: 9925,
    });
    expect(runtime.tables["wallets"]![0]!["available_cents"]).toBe(9925);
    expect(runtime.tables["ledger_entries"]).toMatchObject([
      { type: "payment_credit", amount_cents: 9925, description: "Sinal de Maria" },
    ]);
  });

  it("reentrega do mesmo pagamento não recalcula taxas nem duplica crédito", async () => {
    await confirmDepositPayment(PAYMENT);
    const frozen = {
      gateway_fee_cents: charge()["gateway_fee_cents"],
      platform_commission_percent_snapshot: charge()["platform_commission_percent_snapshot"],
      net_amount_cents: charge()["net_amount_cents"],
    };
    runtime.tables["businesses"]![0]!["agpay_commission_percent"] = 10;
    const payload = { event: "deposit.completed", data: { transaction_uuid: PAYMENT } };
    await persistAgpayWebhookEvent(JSON.stringify(payload), payload);
    await processAgpayWebhookEvents();

    expect(charge()).toMatchObject(frozen);
    expect(runtime.tables["ledger_entries"]).toHaveLength(1);
    expect(runtime.tables["wallets"]![0]!["available_cents"]).toBe(9925);
    expect(runtime.sendPaymentConfirmation).toHaveBeenCalledTimes(1);
  });

  it("falha de crédito deixa inbox failed e retry usa o snapshot já congelado", async () => {
    runtime.failCreditOnce = true;
    const payload = { event: "deposit.completed", data: { transaction_uuid: PAYMENT } };
    await persistAgpayWebhookEvent(JSON.stringify(payload), payload);
    await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 0, failed: 1 });
    expect(charge()["status"]).toBe("pago");
    expect(charge()["net_amount_cents"]).toBe(9925);
    expect(runtime.tables["ledger_entries"]).toHaveLength(0);
    expect(runtime.tables["agpay_webhook_events"]![0]!["status"]).toBe("failed");

    runtime.tables["businesses"]![0]!["agpay_commission_percent"] = 10;
    runtime.tables["agpay_webhook_events"]![0]!["available_at"] = new Date(0).toISOString();
    await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(charge()["platform_commission_percent_snapshot"]).toBe(0);
    expect(runtime.tables["ledger_entries"]).toHaveLength(1);
    expect(runtime.tables["wallets"]![0]!["available_cents"]).toBe(9925);
    expect(runtime.sendPaymentConfirmation).toHaveBeenCalledTimes(1);
  });

  it("sincronização de pagamento já pago recupera crédito ausente", async () => {
    seed({ status: "pago" });
    await expect(synchronizeDepositPayment(CHARGE)).resolves.toEqual({ status: "pago" });
    expect(runtime.tables["ledger_entries"]).toMatchObject([
      { type: "payment_credit", amount_cents: 9925 },
    ]);
    expect(runtime.tables["wallets"]![0]!["available_cents"]).toBe(9925);
  });

  it("transaction.refunded debita o líquido original uma vez sem tratar transaction.failed como estorno", async () => {
    await confirmDepositPayment(PAYMENT);
    const payload = {
      event: "transaction.refunded",
      data: { transaction_uuid: PAYMENT, status: "refunded" },
    };
    await persistAgpayWebhookEvent(JSON.stringify(payload), payload);
    await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(runtime.tables["wallets"]![0]!["available_cents"]).toBe(0);
    expect(runtime.tables["ledger_entries"]).toMatchObject([
      { type: "payment_credit", amount_cents: 9925 },
      { type: "refund_debit", amount_cents: -9925 },
    ]);
    await persistAgpayWebhookEvent(JSON.stringify(payload), payload);
    await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 0, failed: 0 });
    expect(runtime.tables["ledger_entries"]).toHaveLength(2);
  });

  it("deduplica o mesmo webhook por sha256 e o worker notifica uma vez", async () => {
    const payload = {
      event: "deposit.completed",
      data: { transaction_uuid: PAYMENT, status: "completed" },
    };
    const rawBody = JSON.stringify(payload);
    await persistAgpayWebhookEvent(rawBody, payload);
    await persistAgpayWebhookEvent(rawBody, payload);

    expect(runtime.tables["agpay_webhook_events"]).toHaveLength(1);
    await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(runtime.sendPaymentConfirmation).toHaveBeenCalledTimes(1);
  });

  it("não confirma cobrança pendente nem notifica antes do webhook de pagamento", async () => {
    const payload = {
      event: "deposit.pending",
      data: { transaction_uuid: PAYMENT, status: "pending" },
    };
    await persistAgpayWebhookEvent(JSON.stringify(payload), payload);
    await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(charge()["status"]).toBe("pendente");
    expect(appointment()["status"]).toBe("aguardando_sinal");
    expect(runtime.sendPaymentConfirmation).not.toHaveBeenCalled();
  });

  it("atualiza saque quando chega withdrawal.completed", async () => {
    runtime.tables["withdrawals"] = [
      { id: "wd-row", provider_ref: "wd-provider", status: "processing" },
    ];
    const payload = {
      event: "withdrawal.completed",
      data: { uuid: "wd-provider", status: "completed" },
    };
    await persistAgpayWebhookEvent(JSON.stringify(payload), payload);
    await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(runtime.tables["withdrawals"]![0]).toMatchObject({
      status: "paid",
      provider_ref: "wd-provider",
    });
    expect(runtime.rpcCalls).toContainEqual({
      name: "ledger_settle_withdrawal",
      args: { _withdrawal_id: "wd-row", _outcome: "paid", _provider_ref: "wd-provider" },
    });
    expect(runtime.updates.filter(({ table }) => table === "withdrawals")).toHaveLength(0);
  });

  it("liquida o saque quando o webhook identifica o saque por withdrawal_id numérico", async () => {
    runtime.tables["withdrawals"] = [{ id: "wd-row", provider_ref: "631", status: "processing" }];
    const payload = {
      event: "withdrawal.completed",
      data: { amount: 10, status: "paid", withdrawal_id: 631 },
    };
    await persistAgpayWebhookEvent(JSON.stringify(payload), payload);
    await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(runtime.tables["withdrawals"]![0]).toMatchObject({
      status: "paid",
      provider_ref: "631",
    });
    expect(runtime.rpcCalls).toContainEqual({
      name: "ledger_settle_withdrawal",
      args: { _withdrawal_id: "wd-row", _outcome: "paid", _provider_ref: "631" },
    });
  });

  it.each([
    ["withdrawal.pending", "processing"],
    ["withdrawal.failed", "failed"],
  ])("reconcilia %s como %s", async (event, status) => {
    runtime.tables["withdrawals"] = [
      { id: "wd-row", provider_ref: "wd-provider", status: "requested" },
    ];
    const payload = { event, data: { uuid: "wd-provider" } };
    await persistAgpayWebhookEvent(JSON.stringify(payload), payload);
    await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(runtime.tables["withdrawals"]![0]).toMatchObject({
      status,
      provider_ref: "wd-provider",
    });
    if (status === "failed") {
      expect(runtime.rpcCalls).toContainEqual({
        name: "ledger_settle_withdrawal",
        args: { _withdrawal_id: "wd-row", _outcome: "failed", _provider_ref: "wd-provider" },
      });
      expect(runtime.updates.filter(({ table }) => table === "withdrawals")).toHaveLength(0);
    }
  });

  it.each(["withdrawal.completed", "withdrawal.failed"])(
    "reentrega de %s não faz UPDATE direto nem muda status terminal",
    async (event) => {
      runtime.tables["withdrawals"] = [
        { id: "wd-row", provider_ref: "wd-provider", status: "processing" },
      ];
      for (const delivery of [1, 2]) {
        const payload = { event, data: { uuid: "wd-provider" }, delivery };
        await persistAgpayWebhookEvent(JSON.stringify(payload), payload);
      }
      await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 2, failed: 0 });
      expect(runtime.tables["withdrawals"]![0]!["status"]).toBe(
        event === "withdrawal.completed" ? "paid" : "failed",
      );
      expect(
        runtime.rpcCalls.filter(({ name }) => name === "ledger_settle_withdrawal"),
      ).toHaveLength(2);
      expect(runtime.updates.filter(({ table }) => table === "withdrawals")).toHaveLength(0);
    },
  );

  it("transaction.failed após deposit.completed não regride pagamento nem reserva", async () => {
    await confirmDepositPayment(PAYMENT);
    runtime.tables["agpay_webhook_events"] = [
      {
        id: "evt-failed",
        event_type: "transaction.failed",
        transaction_uuid: PAYMENT,
        payload: { data: { status: "failed" } },
        status: "pending",
        attempts: 0,
        available_at: new Date(0).toISOString(),
      },
    ];

    await expect(processAgpayWebhookEvents()).resolves.toEqual({ processed: 1, failed: 0 });
    expect(charge()["status"]).toBe("pago");
    expect(appointment()["status"]).toBe("agendado");
    expect(runtime.sendPaymentConfirmation).toHaveBeenCalledTimes(1);
  });

  it("cancelamento é apenas local e pagamento tardio não reabre a reserva", async () => {
    await expect(cancelPendingDeposit(CHARGE)).resolves.toEqual({ status: "expirado" });

    expect(runtime.fetchPaymentStatus).not.toHaveBeenCalled();
    expect(charge()["status"]).toBe("expirado");
    expect(appointment()["status"]).toBe("cancelado");

    await expect(confirmDepositPayment(PAYMENT)).resolves.toEqual({
      outcome: "paid_after_expiration",
    });
    expect(charge()["status"]).toBe("pago_sem_agendamento");
    expect(appointment()["status"]).toBe("cancelado");
    expect(runtime.sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("claim ocupado adia cancelamento sem consultar o AgPay", async () => {
    seed({}, { acquired: false, reason: "ocupada", claim_token: null });
    await expect(cancelPendingDeposit(CHARGE)).resolves.toEqual({ status: "pendente" });
    expect(runtime.fetchPaymentStatus).not.toHaveBeenCalled();
    expect(charge()["status"]).toBe("pendente");
  });

  it("sincronização consulta o AgPay antes de expirar e recupera pagamento tardio", async () => {
    seed();
    runtime.fetchPaymentStatus.mockResolvedValue("completed");
    await expect(synchronizeDepositPayment(CHARGE)).resolves.toEqual({ status: "pago" });
    expect(runtime.fetchPaymentStatus).toHaveBeenCalledWith(PAYMENT);
    expect(charge()["status"]).toBe("pago");
    expect(appointment()["status"]).toBe("agendado");
    expect(runtime.tables["ledger_entries"]).toHaveLength(1);
  });

  it("sincronização ainda expira localmente quando o AgPay segue pendente", async () => {
    seed();
    runtime.fetchPaymentStatus.mockResolvedValue("pending");
    await expect(synchronizeDepositPayment(CHARGE)).resolves.toEqual({ status: "expirado" });
    expect(charge()["status"]).toBe("expirado");
    expect(appointment()["status"]).toBe("cancelado");
  });

  it("expirePendingDeposits recupera cobrança paga no gateway em vez de cancelar", async () => {
    seed();
    runtime.fetchPaymentStatus.mockResolvedValue("completed");
    await expect(expirePendingDeposits()).resolves.toEqual({
      expired: 0,
      recovered: 1,
      waitingReceipt: 0,
      deferred: 0,
      failed: 0,
    });
    expect(charge()["status"]).toBe("pago");
  });

  it("expirePendingDeposits continua cancelando quando o AgPay não confirma o pagamento", async () => {
    seed();
    runtime.fetchPaymentStatus.mockResolvedValue("pending");
    await expect(expirePendingDeposits()).resolves.toEqual({
      expired: 1,
      recovered: 0,
      waitingReceipt: 0,
      deferred: 0,
      failed: 0,
    });
    expect(charge()["status"]).toBe("expirado");
  });
});
