import { beforeEach, describe, expect, it, vi } from "vitest";

// Auditoria T023: cancelamento/expiração não pode expirar a reserva enquanto a geração
// Pix de outra instância detém o claim ou acabou de enviar um POST incerto.

type Row = Record<string, unknown>;

const runtime = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  claim: null as null | Row,
  updates: [] as Array<{ table: string; patch: Row; filters: Array<[string, string, unknown]> }>,
  findPaymentByExternalReference: vi.fn(),
  deletePendingPayment: vi.fn(),
  fetchPaymentStatus: vi.fn(),
  sendBookingConfirmation: vi.fn(),
}));

class FakeQuery {
  private patch: Row | null = null;
  private filters: Array<[string, string, unknown]> = [];
  constructor(private table: string) {}
  select() {
    return this;
  }
  update(patch: Row) {
    this.patch = patch;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, "eq", value]);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push([column, "neq", value]);
    return this;
  }
  filter(column: string, op: string, value: unknown) {
    this.filters.push([column, op, value]);
    return this;
  }
  is(column: string, value: unknown) {
    this.filters.push([column, "is", value]);
    return this;
  }
  maybeSingle() {
    return this.exec().then(({ data, error }) => ({
      data: Array.isArray(data) ? (data[0] ?? null) : data,
      error,
    }));
  }
  then<T>(resolve: (v: { data: unknown; error: null }) => T) {
    return this.exec().then(resolve);
  }
  private matches(row: Row) {
    return this.filters.every(([column, op, value]) => {
      if (op === "neq") return row[column] !== value;
      if (op === "is") return (row[column] ?? null) === value;
      return row[column] === value;
    });
  }
  private async exec() {
    const rows = (runtime.tables[this.table] ??= []).filter((r) => this.matches(r));
    if (this.patch) {
      runtime.updates.push({ table: this.table, patch: this.patch, filters: this.filters });
      rows.forEach((r) => Object.assign(r, this.patch));
    }
    return { data: rows.map((r) => ({ ...r })), error: null };
  }
}

const fakeDb = {
  from: (table: string) => new FakeQuery(table),
  rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
    runtime.rpcCalls.push({ name, args });
    if (name === "claim_deposit_pix") return { data: [runtime.claim], error: null };
    if (name === "release_deposit_pix") return { data: true, error: null };
    throw new Error(`RPC inesperada: ${name}`);
  }),
};

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeDb }));
vi.mock("./asaas.server", () => ({
  decryptAsaasApiKey: () => "token-subconta",
  deletePendingPayment: runtime.deletePendingPayment,
  fetchPaymentStatus: runtime.fetchPaymentStatus,
  findPaymentByExternalReference: runtime.findPaymentByExternalReference,
}));

vi.mock("./whatsapp-notify.server", () => ({
  sendBookingConfirmation: runtime.sendBookingConfirmation,
}));

const { cancelPendingDeposit, synchronizeDepositPayment, confirmDepositPayment } =
  await import("./asaas-events.server");

const CHARGE = "0e000000-0000-4000-8000-000000000001";
const TOKEN = "0f000000-0000-4000-8000-000000000001";

function seed(charge: Row = {}, claim: Row = {}) {
  runtime.rpcCalls = [];
  runtime.updates = [];
  runtime.tables = {
    deposit_payments: [
      {
        id: CHARGE,
        business_id: "biz-1",
        appointment_id: "appt-1",
        status: "pendente",
        provider_payment_id: null,
        expires_at: "2020-01-01T00:00:00.000Z",
        pix_post_started_at: null,
        pix_claim_token: TOKEN,
        ...charge,
      },
    ],
    appointments: [{ id: "appt-1", status: "aguardando_sinal" }],
    asaas_business_credentials: [{ business_id: "biz-1", api_key_encrypted: "v1.x.y.z" }],
  };
  runtime.claim = {
    acquired: true,
    reason: "ok",
    claim_token: TOKEN,
    attempt_state: "nao_tentado",
    ...claim,
  };
}

const chargeRow = () => runtime.tables["deposit_payments"]![0]!;
const releases = () =>
  runtime.rpcCalls.filter((c) => c.name === "release_deposit_pix").map((c) => c.args["_outcome"]);

describe("cancelPendingDeposit serializado com a geração Pix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.findPaymentByExternalReference.mockResolvedValue(null);
    runtime.deletePendingPayment.mockResolvedValue("deleted");
  });

  it("claim ocupado por outra instância: adia sem consultar Asaas nem expirar", async () => {
    seed({}, { acquired: false, reason: "ocupada", claim_token: null, attempt_state: null });

    await expect(cancelPendingDeposit(CHARGE)).resolves.toEqual({ status: "pendente" });
    expect(chargeRow()["status"]).toBe("pendente");
    expect(runtime.findPaymentByExternalReference).not.toHaveBeenCalled();
    expect(releases()).toEqual([]);
  });

  it("sem provider_payment_id cancela localmente mesmo sem credencial Asaas", async () => {
    seed(
      { pix_post_started_at: new Date(Date.now() - 30_000).toISOString() },
      { attempt_state: "post_incerto" },
    );
    runtime.tables["asaas_business_credentials"] = [];

    await expect(cancelPendingDeposit(CHARGE)).resolves.toEqual({ status: "expirado" });
    expect(chargeRow()["status"]).toBe("expirado");
    expect(runtime.findPaymentByExternalReference).not.toHaveBeenCalled();
    expect(runtime.deletePendingPayment).not.toHaveBeenCalled();
    expect(releases()).toEqual(["falhou"]);
  });

  it("POST incerto antigo sem cobrança: expira filtrando pelo token do claim", async () => {
    seed(
      { pix_post_started_at: new Date(Date.now() - 10 * 60_000).toISOString() },
      { attempt_state: "post_incerto" },
    );

    await expect(cancelPendingDeposit(CHARGE)).resolves.toEqual({ status: "expirado" });
    expect(chargeRow()["status"]).toBe("expirado");
    expect(runtime.findPaymentByExternalReference).not.toHaveBeenCalled();
    const expire = runtime.updates.find((u) => u.patch["status"] === "expirado");
    expect(expire?.filters).toContainEqual(["pix_claim_token", "eq", TOKEN]);
    expect(expire?.filters).toContainEqual(["status", "eq", "pendente"]);
    expect(releases()).toEqual(["falhou"]);
  });

  it("com provider_payment_id consulta a credencial e remove a cobrança no Asaas", async () => {
    seed({ provider_payment_id: "pay_1" });

    await expect(cancelPendingDeposit(CHARGE)).resolves.toEqual({ status: "expirado" });
    expect(runtime.deletePendingPayment).toHaveBeenCalledWith("token-subconta", "pay_1");
    expect(chargeRow()["qr_code"]).toBeNull();
    expect(releases()).toEqual(["criado"]);
  });

  it("synchronizeDepositPayment devolve pendente enquanto o cancelamento está adiado", async () => {
    seed({}, { acquired: false, reason: "ocupada", claim_token: null, attempt_state: null });

    await expect(synchronizeDepositPayment(CHARGE)).resolves.toEqual({ status: "pendente" });
    expect(chargeRow()["status"]).toBe("pendente");
  });
});

const appointmentRow = () => runtime.tables["appointments"]![0]!;
const PAY = "pay_e2e_1";

describe("confirmDepositPayment (webhook de pagamento confirmado)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.sendBookingConfirmation.mockResolvedValue(undefined);
  });

  it("sinal pendente + agendamento aguardando_sinal -> pago + agendado, e notifica o cliente", async () => {
    seed({ provider_payment_id: PAY, status: "pendente" });

    await expect(confirmDepositPayment(PAY, "RECEIVED")).resolves.toEqual({
      outcome: "confirmed",
    });
    expect(chargeRow()["status"]).toBe("pago");
    expect(chargeRow()["provider_status"]).toBe("RECEIVED");
    expect(chargeRow()["paid_at"]).toEqual(expect.any(String));
    expect(appointmentRow()["status"]).toBe("agendado");
    expect(appointmentRow()["deposit_paid_at"]).toEqual(expect.any(String));
    expect(runtime.sendBookingConfirmation).toHaveBeenCalledWith("appt-1");
  });

  it("provider_payment_id desconhecido: não encontra nada pra confirmar", async () => {
    seed({ provider_payment_id: PAY, status: "pendente" });

    await expect(confirmDepositPayment("pay_inexistente", "RECEIVED")).resolves.toEqual({
      outcome: "not_found",
    });
    expect(chargeRow()["status"]).toBe("pendente");
    expect(appointmentRow()["status"]).toBe("aguardando_sinal");
    expect(runtime.sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("webhook duplicado (já pago) é idempotente: não reenvia notificação", async () => {
    seed({ provider_payment_id: PAY, status: "pago" });

    await expect(confirmDepositPayment(PAY, "RECEIVED")).resolves.toEqual({
      outcome: "already_paid",
    });
    expect(runtime.sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("pagamento chega após a reserva ser cancelada: marca pago_sem_agendamento e não altera o agendamento", async () => {
    seed({ provider_payment_id: PAY, status: "cancelado" });

    await expect(confirmDepositPayment(PAY, "RECEIVED")).resolves.toEqual({
      outcome: "paid_after_expiration",
    });
    expect(chargeRow()["status"]).toBe("pago_sem_agendamento");
    expect(appointmentRow()["status"]).toBe("aguardando_sinal");
    expect(runtime.sendBookingConfirmation).not.toHaveBeenCalled();
  });

  it("sem appointment_id vinculado: marca pago_sem_agendamento sem tentar notificar", async () => {
    seed({ provider_payment_id: PAY, status: "pendente", appointment_id: null });

    await expect(confirmDepositPayment(PAY, "RECEIVED")).resolves.toEqual({
      outcome: "paid_without_appointment",
    });
    expect(chargeRow()["status"]).toBe("pago_sem_agendamento");
    expect(runtime.sendBookingConfirmation).not.toHaveBeenCalled();
  });
});
