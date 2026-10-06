import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWithdrawal, saveWithdrawalPixKeyForOwner } from "./withdrawal.server";
import { saveWithdrawalPixKeyInput } from "./withdrawal.functions";
import { AgpayApiError } from "./agpay.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const financeRuntime = vi.hoisted(() => ({
  createCashoutPix: vi.fn(),
  requestWithdrawal: vi.fn(),
  settleWithdrawal: vi.fn(),
  adminDb: null as unknown,
}));
vi.mock("@/lib/agpay.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agpay.server")>()),
  createCashoutPix: financeRuntime.createCashoutPix,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return financeRuntime.adminDb;
  },
}));
vi.mock("@/lib/ledger.server", () => ({
  requestWithdrawal: financeRuntime.requestWithdrawal,
  settleWithdrawal: financeRuntime.settleWithdrawal,
}));

class FinanceQuery {
  action: "select" | "insert" | "update" = "select";
  payload: Record<string, unknown> = {};
  filters: Array<{ key: string; value: unknown }> = [];
  constructor(
    private table: string,
    private state: Record<string, Record<string, unknown>[]>,
  ) {}
  select() {
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters.push({ key, value });
    return this;
  }
  insert(row: Record<string, unknown>) {
    this.action = "insert";
    this.payload = row;
    return this;
  }
  update(row: Record<string, unknown>) {
    this.action = "update";
    this.payload = row;
    return this;
  }
  async single() {
    const result = await this.exec();
    return { data: result.data[0] ?? null, error: result.error };
  }
  async maybeSingle() {
    return this.single();
  }
  then(
    resolve: (result: {
      data: Record<string, unknown>[];
      error: { message: string } | null;
    }) => unknown,
  ) {
    return this.exec().then(resolve);
  }
  private async exec() {
    const rows = this.state[this.table] ?? (this.state[this.table] = []);
    if (this.action === "insert") {
      const inserted = {
        id: `wd-${rows.length + 1}`,
        created_at: new Date().toISOString(),
        ...this.payload,
      };
      rows.push(inserted);
      return { data: [{ ...inserted }], error: null };
    }
    const matched = rows.filter((row) =>
      this.filters.every(({ key, value }) => row[key] === value),
    );
    if (this.action === "update") matched.forEach((row) => Object.assign(row, this.payload));
    return { data: matched.map((row) => ({ ...row })), error: null };
  }
}

function makeFinanceDb() {
  const state: Record<string, Record<string, unknown>[]> = {
    businesses: [
      {
        id: "biz-1",
        owner_id: "user-dono",
        withdrawal_pix_key: "pix@example.com",
      },
    ],
    withdrawals: [],
  };
  return {
    state,
    client: {
      from: (table: string) => new FinanceQuery(table, state),
    } as unknown as SupabaseClient<Database>,
  };
}

function makeSupabaseMock({
  businessFound,
  updateError = null,
}: {
  businessFound: boolean;
  updateError?: string | null;
}) {
  const update = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: updateError ? { message: updateError } : null })),
  }));
  const select = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: businessFound ? { id: "biz-1" } : null,
          error: null,
        })),
      })),
    })),
  }));
  return { from: vi.fn(() => ({ select, update })) } as unknown as Parameters<
    typeof saveWithdrawalPixKeyForOwner
  >[0];
}

describe("saveWithdrawalPixKey (chave PIX de saque)", () => {
  it("rejeita usuário que não é owner_id do businessId", async () => {
    const supabase = makeSupabaseMock({ businessFound: false });
    await expect(
      saveWithdrawalPixKeyForOwner(supabase, "user-nao-dono", {
        businessId: "11111111-1111-1111-1111-111111111111",
        pixKey: "11999990000",
        pixKeyType: "telefone",
      }),
    ).rejects.toThrow("Somente o dono pode cadastrar a chave PIX de saque.");
  });

  it("aceita chaves válidas dos 5 tipos", async () => {
    const supabase = makeSupabaseMock({ businessFound: true });
    const examples = [
      ["cpf", "529.982.247-25"],
      ["cnpj", "11.222.333/0001-81"],
      ["email", "pessoa@example.com"],
      ["telefone", "+55 (11) 99999-9999"],
      ["aleatoria", "550e8400-e29b-41d4-a716-446655440000"],
    ] as const;
    for (const [pixKeyType, pixKey] of examples) {
      expect(() =>
        saveWithdrawalPixKeyInput.parse({
          businessId: "11111111-1111-1111-1111-111111111111",
          pixKey,
          pixKeyType,
        }),
      ).not.toThrow();
      await expect(
        saveWithdrawalPixKeyForOwner(supabase, "user-dono", {
          businessId: "11111111-1111-1111-1111-111111111111",
          pixKey,
          pixKeyType,
        }),
      ).resolves.toEqual({
        businessId: "11111111-1111-1111-1111-111111111111",
        pixKey,
        pixKeyType,
      });
    }
  });

  it.each([
    ["cpf", "abc"],
    ["cpf", "11111111111"],
    ["cpf", "52998224724"],
    ["cnpj", "11222333000180"],
    ["email", "sem-arroba"],
    ["telefone", "99999999"],
    ["telefone", "20999999999"],
    ["aleatoria", "chave-aleatoria"],
  ] as const)("rejeita chave inválida do tipo %s", (pixKeyType, pixKey) => {
    expect(() =>
      saveWithdrawalPixKeyInput.parse({
        businessId: "11111111-1111-1111-1111-111111111111",
        pixKey,
        pixKeyType,
      }),
    ).toThrow();
  });

  it("rejeita pixKey vazio ou tipo fora do enum", () => {
    expect(() =>
      saveWithdrawalPixKeyInput.parse({
        businessId: "11111111-1111-1111-1111-111111111111",
        pixKey: "",
        pixKeyType: "telefone",
      }),
    ).toThrow();
    expect(() =>
      saveWithdrawalPixKeyInput.parse({
        businessId: "11111111-1111-1111-1111-111111111111",
        pixKey: "chave-valida",
        pixKeyType: "boleto",
      }),
    ).toThrow();
  });

  it("rejeita CPF inválido no serviço do servidor antes de salvar", async () => {
    const supabase = makeSupabaseMock({ businessFound: true });
    await expect(
      saveWithdrawalPixKeyForOwner(supabase, "user-dono", {
        businessId: "11111111-1111-1111-1111-111111111111",
        pixKey: "abc",
        pixKeyType: "cpf",
      }),
    ).rejects.toThrow("Informe um CPF válido");
  });
});

describe("solicitação de saque", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    financeRuntime.requestWithdrawal.mockResolvedValue({
      entryId: "entry-1",
      accepted: true,
      availableCents: 2000,
    });
    financeRuntime.settleWithdrawal.mockResolvedValue({ changed: true, finalStatus: "failed" });
  });

  it("registra primeiro, solicita ao provedor e retorna o mesmo saque em retry idempotente", async () => {
    vi.clearAllMocks();
    const { client, state } = makeFinanceDb();
    financeRuntime.adminDb = client;
    financeRuntime.createCashoutPix.mockResolvedValue({
      providerRef: "provider-1",
      status: "pending",
      providerFeeCents: 250,
    });
    const request = () =>
      createWithdrawal(client, "user-dono", "biz-1", 2500, "11111111-1111-4111-8111-111111111111");
    await expect(request()).resolves.toMatchObject({
      withdrawal: { status: "processing", provider_ref: "provider-1" },
    });
    await expect(request()).resolves.toMatchObject({
      withdrawal: { status: "processing", provider_ref: "provider-1" },
    });
    expect(state["withdrawals"]).toHaveLength(1);
    expect(financeRuntime.requestWithdrawal).toHaveBeenCalledOnce();
    expect(financeRuntime.createCashoutPix).toHaveBeenCalledOnce();
  });

  it("desconta a taxa fixa de R$ 3,00 do Pix enviado e registra a taxa, qualquer que seja o valor", async () => {
    for (const [amount, key] of [
      [1300, "13131313-1313-4131-8131-131313131313"],
      [5000, "14141414-1414-4141-8141-141414141414"],
      [10000, "15151515-1515-4151-8151-151515151515"],
    ] as const) {
      financeRuntime.createCashoutPix.mockClear();
      const { client, state } = makeFinanceDb();
      financeRuntime.adminDb = client;
      financeRuntime.createCashoutPix.mockResolvedValue({
        providerRef: `provider-${amount}`,
        status: "pending",
        providerFeeCents: null,
      });
      await createWithdrawal(client, "user-dono", "biz-1", amount, key);
      expect(financeRuntime.requestWithdrawal).toHaveBeenLastCalledWith(client, {
        businessId: "biz-1",
        withdrawalId: "wd-1",
        amountCents: amount,
      });
      expect(financeRuntime.createCashoutPix).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: amount - 300 }),
      );
      expect(state["withdrawals"]![0]).toMatchObject({
        amount_cents: amount,
        platform_fee_cents: 300,
      });
    }
  });

  it("recusa pedido cujo Pix líquido ficaria abaixo do mínimo de R$ 10,00 da AgPay", async () => {
    for (const amount of [1000, 1299]) {
      financeRuntime.createCashoutPix.mockClear();
      financeRuntime.requestWithdrawal.mockClear();
      const { client, state } = makeFinanceDb();
      financeRuntime.adminDb = client;
      await expect(
        createWithdrawal(
          client,
          "user-dono",
          "biz-1",
          amount,
          "16161616-1616-4161-8161-161616161616",
        ),
      ).rejects.toThrow("O saque mínimo é R$ 13,00");
      expect(state["withdrawals"]).toHaveLength(0);
      expect(financeRuntime.requestWithdrawal).not.toHaveBeenCalled();
      expect(financeRuntime.createCashoutPix).not.toHaveBeenCalled();
    }
  });

  it("conclui o ledger imediatamente quando a AGPay já confirma o Pix na resposta", async () => {
    const { client } = makeFinanceDb();
    financeRuntime.adminDb = client;
    financeRuntime.createCashoutPix.mockResolvedValue({
      providerRef: "provider-completed",
      status: "completed",
      providerFeeCents: 250,
    });

    await expect(
      createWithdrawal(client, "user-dono", "biz-1", 2500, "12121212-1212-4121-8121-121212121212"),
    ).resolves.toMatchObject({
      withdrawal: { status: "paid", provider_ref: "provider-completed" },
    });
    expect(financeRuntime.settleWithdrawal).toHaveBeenCalledWith(client, {
      withdrawalId: "wd-1",
      outcome: "paid",
      providerRef: "provider-completed",
    });
  });

  it("trata status de falha retornado em 2xx como rejeição, sem deixá-lo em processamento", async () => {
    const { client } = makeFinanceDb();
    financeRuntime.adminDb = client;
    financeRuntime.createCashoutPix.mockResolvedValue({
      providerRef: "provider-rejected",
      status: "rejected",
      providerFeeCents: null,
    });

    await expect(
      createWithdrawal(client, "user-dono", "biz-1", 2500, "13131313-1313-4131-8131-131313131313"),
    ).rejects.toThrow("O provedor de pagamento recusou o saque");
    expect(financeRuntime.settleWithdrawal).toHaveBeenCalledWith(client, {
      withdrawalId: "wd-1",
      outcome: "failed",
      providerRef: "provider-rejected",
    });
  });

  it("cancela via settlement quando o RPC rejeita saldo insuficiente", async () => {
    vi.clearAllMocks();
    const { client, state } = makeFinanceDb();
    financeRuntime.adminDb = client;
    financeRuntime.requestWithdrawal.mockResolvedValue({
      entryId: null,
      accepted: false,
      availableCents: 4500,
    });
    await expect(
      createWithdrawal(client, "user-dono", "biz-1", 4501, "22222222-2222-4222-8222-222222222222"),
    ).rejects.toThrow("Saldo insuficiente. Disponível: R$ 45,00.");
    expect(state["withdrawals"]).toHaveLength(1);
    expect(financeRuntime.requestWithdrawal).toHaveBeenCalledWith(client, {
      businessId: "biz-1",
      withdrawalId: "wd-1",
      amountCents: 4501,
    });
    expect(financeRuntime.settleWithdrawal).toHaveBeenCalledWith(client, {
      withdrawalId: "wd-1",
      outcome: "canceled",
    });
    expect(financeRuntime.createCashoutPix).not.toHaveBeenCalled();
  });

  it("bloqueia saque com saldo negativo por estorno e cancela a solicitação", async () => {
    const { client } = makeFinanceDb();
    financeRuntime.adminDb = client;
    financeRuntime.requestWithdrawal.mockResolvedValue({
      entryId: null,
      accepted: false,
      availableCents: -750,
    });

    await expect(
      createWithdrawal(client, "user-dono", "biz-1", 2000, "77777777-7777-4777-8777-777777777777"),
    ).rejects.toThrow(
      "Saldo negativo por um estorno: novos saques ficam bloqueados ate a revisao do administrador.",
    );
    expect(financeRuntime.settleWithdrawal).toHaveBeenCalledWith(client, {
      withdrawalId: "wd-1",
      outcome: "canceled",
    });
    expect(financeRuntime.createCashoutPix).not.toHaveBeenCalled();
  });

  it("cancela best-effort e preserva a causa quando a reserva falha", async () => {
    const { client, state } = makeFinanceDb();
    financeRuntime.adminDb = client;
    const rpcError = new Error("RPC indisponível");
    financeRuntime.requestWithdrawal.mockRejectedValue(rpcError);
    financeRuntime.settleWithdrawal.mockRejectedValue(new Error("Compensação indisponível"));

    await expect(
      createWithdrawal(client, "user-dono", "biz-1", 2000, "88888888-8888-4888-8888-888888888888"),
    ).rejects.toMatchObject({
      message: "Não foi possível reservar o saldo do saque. Tente novamente.",
      cause: rpcError,
    });
    expect(state["withdrawals"]).toHaveLength(1);
    expect(financeRuntime.settleWithdrawal).toHaveBeenCalledWith(client, {
      withdrawalId: "wd-1",
      outcome: "canceled",
    });
    expect(financeRuntime.createCashoutPix).not.toHaveBeenCalled();
  });

  it("informa saldo zero como insuficiente e nunca chama o provedor", async () => {
    vi.clearAllMocks();
    const { client, state } = makeFinanceDb();
    financeRuntime.adminDb = client;
    financeRuntime.requestWithdrawal.mockResolvedValue({
      entryId: null,
      accepted: false,
      availableCents: 0,
    });

    await expect(
      createWithdrawal(client, "user-dono", "biz-1", 2000, "66666666-6666-4666-8666-666666666666"),
    ).rejects.toThrow("Saldo insuficiente. Disponível: R$ 0,00.");
    expect(financeRuntime.createCashoutPix).not.toHaveBeenCalled();
    expect(state["withdrawals"]).toHaveLength(1);
    expect(financeRuntime.settleWithdrawal).toHaveBeenCalledWith(client, {
      withdrawalId: "wd-1",
      outcome: "canceled",
    });
  });

  it("mantém timeout ambíguo em processamento e nunca repete chamada no retry", async () => {
    vi.clearAllMocks();
    const { client } = makeFinanceDb();
    financeRuntime.adminDb = client;
    financeRuntime.createCashoutPix.mockRejectedValue(
      new Error("O AgPay não respondeu. Tente novamente em instantes."),
    );
    const args = [
      client,
      "user-dono",
      "biz-1",
      2500,
      "33333333-3333-4333-8333-333333333333",
    ] as const;
    await expect(createWithdrawal(...args)).resolves.toMatchObject({
      withdrawal: { status: "processing" },
    });
    await expect(createWithdrawal(...args)).resolves.toMatchObject({
      withdrawal: { status: "processing" },
    });
    expect(financeRuntime.createCashoutPix).toHaveBeenCalledOnce();
  });

  it("conclui atomicamente o saque como failed e informa erro após rejeição HTTP do provedor", async () => {
    vi.clearAllMocks();
    const { client, state } = makeFinanceDb();
    financeRuntime.adminDb = client;
    financeRuntime.createCashoutPix.mockRejectedValue(new AgpayApiError(422, "/cashout/pix"));
    await expect(
      createWithdrawal(client, "user-dono", "biz-1", 2500, "44444444-4444-4444-8444-444444444444"),
    ).rejects.toThrow("O provedor de pagamento recusou o saque");
    expect(financeRuntime.requestWithdrawal).toHaveBeenCalledOnce();
    expect(financeRuntime.settleWithdrawal).toHaveBeenCalledWith(client, {
      withdrawalId: "wd-1",
      outcome: "failed",
    });
    expect(state["withdrawals"]?.[0]?.["status"]).toBe("requested");
  });

  it("reconhece a mensagem de valor mínimo e marca a tentativa como falha", async () => {
    vi.clearAllMocks();
    const { client, state } = makeFinanceDb();
    financeRuntime.adminDb = client;
    financeRuntime.createCashoutPix.mockRejectedValue(
      new Error("O valor mínimo do saque Pix é R$ 10,00."),
    );

    await expect(
      createWithdrawal(client, "user-dono", "biz-1", 2500, "55555555-5555-4555-8555-555555555555"),
    ).rejects.toThrow("O valor mínimo do saque Pix é R$ 10,00.");
    expect(state["withdrawals"]?.[0]?.["status"]).toBe("requested");
    expect(financeRuntime.settleWithdrawal).toHaveBeenCalledWith(client, {
      withdrawalId: "wd-1",
      outcome: "failed",
    });
  });
});
