import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeNowMin,
  computeOpenDays,
  computeSlots,
  generateDepositPix,
  getPublicBookingCatalog,
  hhmm,
  isValidCpfCnpj,
  minutesOf,
  reserveBooking,
  shouldRequireDeposit,
  toIso,
} from "./booking.functions";

const pixRuntime = vi.hoisted(() => ({
  db: { from: vi.fn(), rpc: vi.fn() },
  getBusinessAsaasAccessToken: vi.fn(),
  getOrCreateCustomer: vi.fn(),
  createPixCharge: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate: (data: unknown) => unknown = (data) => data;
    const builder = {
      inputValidator: (fn: (data: unknown) => unknown) => {
        validate = fn;
        return builder;
      },
      handler:
        (fn: (args: { data: unknown }) => Promise<unknown>) =>
        async ({ data }: { data: unknown }) =>
          fn({ data: validate(data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: pixRuntime.db }));
vi.mock("./asaas-events.server", () => ({
  getBusinessAsaasAccessToken: pixRuntime.getBusinessAsaasAccessToken,
}));
vi.mock("./asaas.server", () => ({
  getOrCreateCustomer: pixRuntime.getOrCreateCustomer,
  createPixCharge: pixRuntime.createPixCharge,
  isDefinitivePixAvailabilityRejection: (error: unknown) =>
    Array.isArray((error as { codes?: unknown } | null)?.codes) &&
    (error as { codes: unknown[] }).codes.includes("invalid_billingType"),
}));

describe("isValidCpfCnpj", () => {
  it("valida dígitos verificadores e rejeita sequências", () => {
    expect(isValidCpfCnpj("529.982.247-25")).toBe(true);
    expect(isValidCpfCnpj("04.252.011/0001-10")).toBe(true);
    expect(isValidCpfCnpj("529.982.247-24")).toBe(false);
    expect(isValidCpfCnpj("111.111.111-11")).toBe(false);
  });
});

describe("minutesOf / hhmm", () => {
  it("converte HH:mm pra minutos e volta", () => {
    expect(minutesOf("09:30")).toBe(570);
    expect(minutesOf("00:00")).toBe(0);
    expect(hhmm(570)).toBe("09:30");
    expect(hhmm(0)).toBe("00:00");
  });
});

describe("toIso", () => {
  it("interpreta a data/hora no fuso de São Paulo (UTC-3)", () => {
    // 09:00 em São Paulo é 12:00 UTC.
    expect(toIso("2026-09-15", "09:00")).toBe("2026-09-15T12:00:00.000Z");
  });
});

describe("computeSlots", () => {
  const hours = [{ starts_at: "09:00:00", ends_at: "12:00:00" }];

  it("gera slots de 30 em 30 min que cabem o serviço inteiro dentro do expediente", () => {
    const slots = computeSlots({ hours, busy: [], durationMinutes: 60, nowMin: -1 });
    // último slot possível é 11:00 (11:00-12:00); 11:30 já estouraria o expediente
    expect(slots).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });

  it("não gera slot nenhum se o serviço não cabe no expediente", () => {
    const slots = computeSlots({ hours, busy: [], durationMinutes: 240, nowMin: -1 });
    expect(slots).toEqual([]);
  });

  it("remove slots que colidem com horário ocupado (agendamento ou bloqueio)", () => {
    // ocupado das 10:00 às 11:00
    const slots = computeSlots({ hours, busy: [[600, 660]], durationMinutes: 30, nowMin: -1 });
    expect(slots).not.toContain("10:00");
    expect(slots).not.toContain("10:30");
    expect(slots).toContain("09:30");
    expect(slots).toContain("11:00");
  });

  it("um agendamento que só encosta na borda (sem sobrepor) não bloqueia o slot vizinho", () => {
    // ocupado das 10:00 às 10:30 exatamente
    const slots = computeSlots({ hours, busy: [[600, 630]], durationMinutes: 30, nowMin: -1 });
    expect(slots).toContain("09:30"); // termina 10:00, não sobrepõe
    expect(slots).not.toContain("10:00"); // exatamente o horário ocupado
    expect(slots).toContain("10:30"); // começa quando o ocupado termina
  });

  it("corta horários que já passaram quando é hoje (nowMin >= 0)", () => {
    const slots = computeSlots({ hours, busy: [], durationMinutes: 30, nowMin: 600 }); // 10:00
    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("09:30");
    expect(slots).not.toContain("10:00"); // <= nowMin é excluído, não só <
    expect(slots).toContain("10:30");
  });
});

// T013 (US3) — escrito antes de T018/T019 existirem (data-model.md, FR-012).
// `shouldRequireDeposit` ainda não existe em booking.functions.ts: esse teste
// começa falhando até T018/T019 extraírem a checagem de `service.requires_deposit`
// usada por `reserveBooking` (hoje só olha `deposit_cents`, ver linha ~260) para
// essa função pura, com a assinatura esperada
// `shouldRequireDeposit(service: { requires_deposit: boolean; deposit_cents: number }): boolean`.
describe("shouldRequireDeposit", () => {
  it("não cobra sinal quando requires_deposit é false, mesmo com deposit_cents > 0", () => {
    expect(shouldRequireDeposit({ requires_deposit: false, deposit_cents: 5000 })).toBe(false);
  });

  it("cobra sinal quando requires_deposit é true e deposit_cents > 0", () => {
    expect(shouldRequireDeposit({ requires_deposit: true, deposit_cents: 5000 })).toBe(true);
  });

  it("não cobra sinal sem deposit_cents configurado, mesmo com requires_deposit true", () => {
    expect(shouldRequireDeposit({ requires_deposit: true, deposit_cents: 0 })).toBe(false);
  });
});

// T025 (US5) — computeNowMin/computeOpenDays extraídas de getAvailability/getOpenDays
// pra provar, sem banco, que minimum_notice_hours e list_dates_days do Panel1Config
// (contracts/server-functions.md, savePanel1Config) realmente mudam o resultado.
describe("computeNowMin (minimum_notice_hours do Panel1Config afeta getAvailability)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 15/09/2026 23:30 em São Paulo (UTC-3) = 16/09/2026 02:30 UTC.
    vi.setSystemTime(new Date("2026-09-16T02:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("com antecedência mínima 0, o corte é o minuto atual do próprio dia", () => {
    expect(computeNowMin("2026-09-15", "America/Sao_Paulo", 0)).toBe(23 * 60 + 30);
  });

  it("aumentar minimum_notice_hours pode bloquear o resto do dia de hoje", () => {
    // +2h de antecedência empurra o corte pra 01:30 do dia 16 — o dia 15 inteiro
    // (hoje) fica dentro da antecedência mínima e nenhum horário deve sobrar.
    expect(computeNowMin("2026-09-15", "America/Sao_Paulo", 2)).toBe(1440);
  });

  it("um dia bem no futuro continua livre de corte, independente da antecedência", () => {
    expect(computeNowMin("2026-09-20", "America/Sao_Paulo", 2)).toBe(-1);
  });
});

describe("computeOpenDays (list_dates_days do Panel1Config afeta getOpenDays)", () => {
  const allWeekdaysOpen = new Set([0, 1, 2, 3, 4, 5, 6]);

  it("retorna exatamente `target` dias quando o negócio abre todos os dias", () => {
    const seven = computeOpenDays({
      openWeekdays: allWeekdaysOpen,
      timezone: "America/Sao_Paulo",
      target: 7,
    });
    const fifteen = computeOpenDays({
      openWeekdays: allWeekdaysOpen,
      timezone: "America/Sao_Paulo",
      target: 15,
    });
    expect(seven).toHaveLength(7);
    expect(fifteen).toHaveLength(15);
  });

  it("só lista dias cujo weekday está aberto", () => {
    const onlyMonday = computeOpenDays({
      openWeekdays: new Set([1]),
      timezone: "America/Sao_Paulo",
      target: 3,
    });
    expect(onlyMonday).toHaveLength(3);
    expect(onlyMonday.every((d) => d.weekday === 1)).toBe(true);
  });
});

const chargeId = "11111111-1111-4111-8111-111111111111";
const businessId = "22222222-2222-4222-8222-222222222222";
const pixResponse = {
  providerPaymentId: "pay_test_1",
  status: "PENDING",
  qrCode: "pix-copia-e-cola",
  qrCodeBase64: "imagem-base64",
  ticketUrl: "https://example.test/ticket",
};

function setupDepositPix(
  options: {
    subaccountStatus?: string;
    expiresAt?: string;
    qrCode?: string | null;
    asaasCustomerId?: string | null;
    payerCpfCnpj?: string | null;
    failCustomerUpdate?: boolean;
    failQrUpdate?: boolean;
    providerPaymentId?: string | null;
    markAllowed?: boolean;
    releaseFails?: boolean;
    onClaim?: (charge: Record<string, unknown>) => void;
  } = {},
) {
  const charge = {
    id: chargeId,
    business_id: businessId,
    amount_cents: 2500,
    status: "pendente",
    payer_name: "Cliente Teste",
    payer_phone: "11999990000",
    payer_cpf_cnpj: options.payerCpfCnpj === undefined ? "52998224725" : options.payerCpfCnpj,
    asaas_customer_id: options.asaasCustomerId ?? null,
    provider_payment_id: (options.providerPaymentId ?? null) as string | null,
    qr_code: options.qrCode ?? null,
    qr_code_base64: options.qrCode ? "imagem-base64" : null,
    ticket_url: options.qrCode ? "https://example.test/ticket" : null,
    expires_at: options.expiresAt ?? new Date(Date.now() + 5 * 60_000).toISOString(),
  };
  const updates: Array<Record<string, unknown>> = [];
  let pixState = "nao_tentado";
  const releases: string[] = [];
  const updateFilters: Array<[string, string, unknown]> = [];
  pixRuntime.db.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "claim_deposit_pix") {
      options.onClaim?.(charge);
      return {
        data: [{ acquired: true, reason: "ok", claim_token: chargeId, attempt_state: pixState }],
        error: null,
      };
    }
    if (name === "mark_deposit_pix_post_started") {
      if (options.markAllowed === false) return { data: false, error: null };
      pixState = "post_enviado";
      return { data: true, error: null };
    }
    if (name === "release_deposit_pix") {
      releases.push(String(args["_outcome"]));
      if (options.releaseFails) return { data: null, error: { message: "rpc indisponível" } };
      pixState = args["_outcome"] === "criado" ? "criado" : "post_incerto";
      return { data: true, error: null };
    }
    throw new Error(`RPC inesperada: ${name}`);
  });
  const payments = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: { ...charge }, error: null })),
      })),
    })),
    update: vi.fn((patch: Record<string, unknown>) => {
      const updateQuery = {
        eq: vi.fn((column: string, value: unknown) => {
          updateFilters.push([column, "eq", value]);
          return updateQuery;
        }),
        gt: vi.fn((column: string, value: unknown) => {
          updateFilters.push([column, "gt", value]);
          return updateQuery;
        }),
        filter: vi.fn((column: string, op: string, value: unknown) => {
          updateFilters.push([column, op, value]);
          return updateQuery;
        }),
        is: vi.fn((column: string, value: unknown) => {
          updateFilters.push([column, "is", value]);
          return updateQuery;
        }),
        select: vi.fn(() => updateQuery),
        maybeSingle: vi.fn(async () => {
          updates.push(patch);
          if (options.failCustomerUpdate && "payer_cpf_cnpj" in patch) {
            return { data: null, error: { message: "falha no update do cliente" } };
          }
          if (options.failQrUpdate && "qr_code" in patch) {
            return { data: null, error: { message: "falha no update do QR" } };
          }
          Object.assign(charge, patch);
          return { data: { id: charge.id }, error: null };
        }),
      };
      return updateQuery;
    }),
  };
  const businesses = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            asaas_wallet_id: "wallet_test",
            asaas_subaccount_status: options.subaccountStatus ?? "aprovada",
            asaas_commission_percent: 0,
          },
          error: null,
        })),
      })),
    })),
  };
  pixRuntime.db.from.mockImplementation((table: string) => {
    if (table === "deposit_payments") return payments;
    if (table === "businesses") return businesses;
    throw new Error(`Tabela inesperada no teste: ${table}`);
  });
  pixRuntime.getBusinessAsaasAccessToken.mockResolvedValue("token-de-teste");
  pixRuntime.getOrCreateCustomer.mockResolvedValue("cus_test_1");
  pixRuntime.createPixCharge.mockResolvedValue(pixResponse);
  return { charge, updates, payments, releases, updateFilters };
}

describe("generateDepositPix: retry e estados da cobrança", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reutiliza cliente após falha externa e permite retry sem pedir CPF novamente", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockRejectedValueOnce(
      new Error("Asaas temporariamente indisponível"),
    );

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.charge.asaas_customer_id).toBe("cus_test_1");
    expect(db.charge.payer_cpf_cnpj).toBeNull();

    await expect(generateDepositPix({ data: { chargeId } })).resolves.toMatchObject({
      qrCode: pixResponse.qrCode,
      qrCodeBase64: pixResponse.qrCodeBase64,
    });
    expect(pixRuntime.getOrCreateCustomer).toHaveBeenCalledOnce();
    expect(pixRuntime.createPixCharge).toHaveBeenCalledTimes(2);
    expect(pixRuntime.createPixCharge).toHaveBeenLastCalledWith(
      expect.objectContaining({ customerId: "cus_test_1", externalReference: chargeId }),
    );
  });

  it("serializa chamadas simultâneas da mesma cobrança e cria apenas um Pix", async () => {
    setupDepositPix();
    let releasePix = () => {};
    const pixPending = new Promise<void>((resolve) => {
      releasePix = resolve;
    });
    pixRuntime.createPixCharge.mockImplementation(async () => {
      await pixPending;
      return pixResponse;
    });

    const first = generateDepositPix({ data: { chargeId } });
    await vi.waitFor(() => expect(pixRuntime.createPixCharge).toHaveBeenCalledOnce());
    const second = generateDepositPix({ data: { chargeId } });
    const resultsPromise = Promise.allSettled([first, second]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    releasePix();

    const results = await resultsPromise;
    expect(results).toEqual([
      { status: "fulfilled", value: expect.objectContaining({ qrCode: pixResponse.qrCode }) },
      { status: "fulfilled", value: expect.objectContaining({ qrCode: pixResponse.qrCode }) },
    ]);
    expect(pixRuntime.createPixCharge).toHaveBeenCalledOnce();
  });

  it("não consulta Asaas quando outra instância já detém o claim", async () => {
    setupDepositPix();
    pixRuntime.db.rpc.mockResolvedValueOnce({
      data: [{ acquired: false, reason: "ocupada", claim_token: null, attempt_state: null }],
      error: null,
    });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(/sendo gerado/i);
    expect(pixRuntime.getBusinessAsaasAccessToken).not.toHaveBeenCalled();
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
  });

  it("em POST anterior incerto, só permite novo POST se o banco aceitar o anúncio", async () => {
    setupDepositPix({ asaasCustomerId: "cus_salvo", payerCpfCnpj: null, markAllowed: false });
    pixRuntime.db.rpc.mockResolvedValueOnce({
      data: [
        { acquired: true, reason: "ok", claim_token: chargeId, attempt_state: "post_incerto" },
      ],
      error: null,
    });
    let announced: boolean | undefined;
    pixRuntime.createPixCharge.mockImplementationOnce(
      async (input: { beforeCreate: () => Promise<boolean> }) => {
        announced = await input.beforeCreate();
        throw new Error("A cobrança anterior ainda está sendo conciliada.");
      },
    );

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(announced).toBe(false);
    expect(pixRuntime.db.rpc).toHaveBeenCalledWith(
      "mark_deposit_pix_post_started",
      expect.objectContaining({ _claim_token: chargeId }),
    );
  });

  it("não anuncia POST antes da busca: mark só roda via beforeCreate", async () => {
    setupDepositPix();

    await generateDepositPix({ data: { chargeId } });
    expect(pixRuntime.db.rpc).not.toHaveBeenCalledWith(
      "mark_deposit_pix_post_started",
      expect.anything(),
    );
    expect(pixRuntime.createPixCharge).toHaveBeenCalledWith(
      expect.objectContaining({ allowCreate: true, beforeCreate: expect.any(Function) }),
    );
  });

  it("com provider_payment_id salvo, consulta a cobrança conhecida e nunca permite POST", async () => {
    setupDepositPix({
      asaasCustomerId: "cus_salvo",
      payerCpfCnpj: null,
      providerPaymentId: "pay_salvo",
    });

    await generateDepositPix({ data: { chargeId } });
    expect(pixRuntime.createPixCharge).toHaveBeenCalledWith(
      expect.objectContaining({ knownPaymentId: "pay_salvo", allowCreate: false }),
    );
  });

  it("libera como criado quando o ID foi gravado mesmo se o QR falhou", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockImplementationOnce(
      async (input: {
        onPaymentLocated: (payment: { id: string; status: string }) => Promise<void>;
      }) => {
        await input.onPaymentLocated({ id: "pay_test_1", status: "PENDING" });
        throw new Error("QR indisponível");
      },
    );

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.releases).toEqual(["criado"]);
  });

  it("libera como falhou quando nenhuma cobrança foi localizada", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockRejectedValueOnce(new Error("Asaas fora do ar"));

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.releases).toEqual(["falhou"]);
  });

  it("releases immediately for definitive Asaas Pix rejection", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockRejectedValueOnce(
      Object.assign(new Error("Provider rejected billing type."), {
        codes: ["invalid_billingType"],
      }),
    );

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(
      /habilitou pix.*sandbox/i,
    );
    expect(db.releases).toEqual(["rejeitado"]);
  });

  it("grava o ID do provedor filtrando por token e sem sobrescrever outro ID", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockImplementationOnce(
      async (input: {
        onPaymentLocated: (payment: { id: string; status: string }) => Promise<void>;
      }) => {
        await input.onPaymentLocated({ id: "pay_test_1", status: "PENDING" });
        return pixResponse;
      },
    );

    await generateDepositPix({ data: { chargeId } });
    expect(db.updateFilters).toContainEqual(["pix_claim_token", "eq", chargeId]);
    expect(db.updateFilters).toContainEqual(["provider_payment_id", "is", null]);
  });

  it("relê após o claim: usa cliente salvo por outra instância sem exigir o CPF apagado", async () => {
    setupDepositPix({
      onClaim: (charge) => {
        charge["asaas_customer_id"] = "cus_outra_instancia";
        charge["payer_cpf_cnpj"] = null;
      },
    });

    await expect(generateDepositPix({ data: { chargeId } })).resolves.toMatchObject({
      qrCode: pixResponse.qrCode,
    });
    expect(pixRuntime.getOrCreateCustomer).not.toHaveBeenCalled();
    expect(pixRuntime.createPixCharge).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_outra_instancia" }),
    );
  });

  it("relê após o claim: devolve QR persistido por outra instância sem chamar o Asaas", async () => {
    const db = setupDepositPix({
      onClaim: (charge) => {
        charge["provider_payment_id"] = "pay_outra_instancia";
        charge["qr_code"] = "pix-outra-instancia";
        charge["qr_code_base64"] = "imagem-outra-instancia";
      },
    });

    await expect(generateDepositPix({ data: { chargeId } })).resolves.toMatchObject({
      qrCode: "pix-outra-instancia",
    });
    expect(pixRuntime.getBusinessAsaasAccessToken).not.toHaveBeenCalled();
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
    expect(db.releases).toEqual(["criado"]);
  });

  it("relê após o claim: cobrança expirada no intervalo não chama o Asaas", async () => {
    const db = setupDepositPix({
      onClaim: (charge) => {
        charge["status"] = "expirado";
      },
    });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(
      /não está mais ativa/i,
    );
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
    expect(db.releases).toEqual(["falhou"]);
  });

  it("todas as gravações exigem status pendente e token do claim", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockImplementationOnce(
      async (input: {
        onPaymentLocated: (payment: { id: string; status: string }) => Promise<void>;
      }) => {
        await input.onPaymentLocated({ id: "pay_test_1", status: "PENDING" });
        return pixResponse;
      },
    );

    await generateDepositPix({ data: { chargeId } });
    const statusFilters = db.updateFilters.filter(
      ([column, op, value]) => column === "status" && op === "eq" && value === "pendente",
    );
    const tokenFilters = db.updateFilters.filter(([column]) => column === "pix_claim_token");
    expect(statusFilters).toHaveLength(3);
    expect(tokenFilters).toHaveLength(3);
    expect(db.updateFilters.some(([column, op]) => column === "expires_at" && op === "gt")).toBe(
      true,
    );
  });

  it("cobrança criada depois do vencimento: grava o id para cancelamento e não expõe o QR", async () => {
    const db = setupDepositPix();
    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, "now");
    pixRuntime.createPixCharge.mockImplementationOnce(
      async (input: {
        onPaymentLocated: (payment: { id: string; status: string }) => Promise<void>;
      }) => {
        await input.onPaymentLocated({ id: "pay_tardio", status: "PENDING" });
        nowSpy.mockReturnValue(realNow + 60 * 60_000);
        return pixResponse;
      },
    );

    try {
      await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(/prazo/i);
    } finally {
      nowSpy.mockRestore();
    }
    expect(db.charge.provider_payment_id).toBe("pay_tardio");
    expect(db.charge.qr_code).toBeNull();
    expect(db.releases).toEqual(["criado"]);
  });

  it("falha no release não mascara o erro original nem desfaz um Pix já gravado", async () => {
    setupDepositPix({ releaseFails: true });
    await expect(generateDepositPix({ data: { chargeId } })).resolves.toMatchObject({
      qrCode: pixResponse.qrCode,
    });

    vi.resetAllMocks();
    setupDepositPix({ releaseFails: true });
    pixRuntime.createPixCharge.mockRejectedValueOnce(new Error("Asaas fora do ar"));
    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(
      /não foi possível gerar o pix agora/i,
    );
  });

  it("persiste o ID do provedor antes de uma falha ao buscar o QR", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockImplementationOnce(
      async (input: {
        onPaymentLocated: (payment: { id: string; status: string }) => Promise<void>;
      }) => {
        await input.onPaymentLocated({ id: "pay_test_1", status: "PENDING" });
        throw new Error("QR indisponível");
      },
    );

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.charge.provider_payment_id).toBe("pay_test_1");
  });

  it.each([null, "pix-antigo"])(
    "rejeita cobrança expirada antes de devolver ou criar QR (%s)",
    async (qrCode) => {
      setupDepositPix({ expiresAt: "2020-01-01T00:00:00.000Z", qrCode });

      await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
      expect(pixRuntime.getBusinessAsaasAccessToken).not.toHaveBeenCalled();
      expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
    },
  );

  it("usa asaas_customer_id já salvo mesmo quando CPF temporário foi apagado", async () => {
    setupDepositPix({ asaasCustomerId: "cus_salvo", payerCpfCnpj: null });

    await expect(generateDepositPix({ data: { chargeId } })).resolves.toMatchObject({
      qrCode: pixResponse.qrCode,
    });
    expect(pixRuntime.getOrCreateCustomer).not.toHaveBeenCalled();
    expect(pixRuntime.createPixCharge).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_salvo" }),
    );
  });

  it("interrompe antes de criar Pix se falhar o update que vincula cliente e apaga CPF", async () => {
    const db = setupDepositPix({ failCustomerUpdate: true });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.charge.payer_cpf_cnpj).toBe("52998224725");
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
  });

  it("não declara sucesso se falhar o update do QR e do provider_payment_id", async () => {
    const db = setupDepositPix({ failQrUpdate: true });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.charge.provider_payment_id).toBeNull();
    expect(db.charge.qr_code).toBeNull();
  });

  it.each([
    ["payload", { qrCode: "", qrCodeBase64: pixResponse.qrCodeBase64 }],
    ["imagem", { qrCode: pixResponse.qrCode, qrCodeBase64: null }],
  ])("não devolve sucesso com %s do QR ausente", async (_part, missing) => {
    setupDepositPix();
    pixRuntime.createPixCharge.mockResolvedValue({ ...pixResponse, ...missing });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
  });

  it("mantém subconta em análise bloqueada sem chamar Asaas", async () => {
    setupDepositPix({ subaccountStatus: "em_analise" });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(
      /não está habilitado/i,
    );
    expect(pixRuntime.getBusinessAsaasAccessToken).not.toHaveBeenCalled();
    expect(pixRuntime.getOrCreateCustomer).not.toHaveBeenCalled();
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
  });
});

// T036 (US5) — sinal calculado no servidor a partir de deposit_mode/deposit_percent_bps.
type Call = { table: string; method: string; args: unknown[] };

/** Query encadeável do Supabase: qualquer filtro devolve a própria query; await/single resolvem `result`. */
function fakeQuery(table: string, result: unknown, calls: Call[]): unknown {
  const query: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject);
        }
        if (prop === "maybeSingle" || prop === "single") return async () => result;
        return (...args: unknown[]) => {
          calls.push({ table, method: String(prop), args });
          return query;
        };
      },
    },
  );
  return query;
}

const serviceId = "33333333-3333-4333-8333-333333333333";
const appointmentId = "44444444-4444-4444-8444-444444444444";

function setupReserve(
  service: Partial<{
    requires_deposit: boolean;
    deposit_mode: string;
    deposit_percent_bps: number;
    price_cents: number;
    deposit_cents: number;
  }>,
  subaccountStatus = "aprovada",
) {
  const calls: Call[] = [];
  const results: Record<string, unknown> = {
    businesses: {
      data: { id: businessId, status: "ativo", asaas_subaccount_status: subaccountStatus },
      error: null,
    },
    services: {
      data: {
        id: serviceId,
        name: "Corte",
        duration_minutes: 30,
        requires_deposit: true,
        deposit_mode: "fixed",
        deposit_percent_bps: 0,
        price_cents: 10_000,
        deposit_cents: 0,
        ...service,
      },
      error: null,
    },
    service_professionals: { data: [], error: null },
    appointments: { data: { id: appointmentId }, error: null },
    deposit_payments: { data: { id: chargeId }, error: null },
  };
  pixRuntime.db.from.mockImplementation((table: string) => {
    if (!(table in results)) throw new Error(`Tabela inesperada no teste: ${table}`);
    // A primeira leitura de `appointments` é a checagem de conflito: lista vazia.
    const firstAppointmentsRead = table === "appointments" && !calls.some((c) => c.table === table);
    return fakeQuery(
      table,
      firstAppointmentsRead ? { data: [], error: null } : results[table],
      calls,
    );
  });
  const inserted = (table: string) =>
    calls
      .filter((c) => c.table === table && c.method === "insert")
      .map((c) => c.args[0] as Record<string, unknown>);
  return { calls, inserted };
}

const reserveInput = {
  slug: "barbearia",
  serviceId,
  date: "2099-01-05",
  time: "10:00",
  customerName: "Cliente Teste",
  customerPhone: "11999990000",
  customerCpfCnpj: "529.982.247-25",
};

describe("reserveBooking: snapshot do sinal (fixo/percentual)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("10% de R$ 100 grava o mesmo snapshot de R$ 10 no agendamento e na cobrança", async () => {
    const db = setupReserve({
      deposit_mode: "percent",
      deposit_percent_bps: 1_000,
      deposit_cents: 9_999, // sombra desatualizada: não pode ser usada
    });

    const result = await reserveBooking({ data: reserveInput });

    expect(result.amountCents).toBe(1_000);
    expect(result.chargeId).toBe(chargeId);
    expect(db.inserted("appointments")[0]).toMatchObject({
      status: "aguardando_sinal",
      deposit_cents: 1_000,
    });
    expect(db.inserted("deposit_payments")[0]).toMatchObject({ amount_cents: 1_000 });
  });

  it("serviço fixo legado mantém deposit_cents como snapshot", async () => {
    const db = setupReserve({ deposit_mode: "fixed", deposit_cents: 2_500 });

    const result = await reserveBooking({ data: reserveInput });

    expect(result.amountCents).toBe(2_500);
    expect(db.inserted("appointments")[0]).toMatchObject({ deposit_cents: 2_500 });
    expect(db.inserted("deposit_payments")[0]).toMatchObject({ amount_cents: 2_500 });
  });

  it.each([
    ["0%", { deposit_percent_bps: 0, price_cents: 10_000 }],
    ["preço zero", { deposit_percent_bps: 5_000, price_cents: 0 }],
  ])(
    "%s no modo percentual confirma sem cobrança, sem Asaas e sem deposit_payments",
    async (_label, config) => {
      // Subconta pendente não bloqueia: não há sinal a receber.
      const db = setupReserve({ deposit_mode: "percent", ...config }, "pendente");

      const result = await reserveBooking({ data: reserveInput });

      expect(result).toMatchObject({ chargeId: null, amountCents: 0 });
      expect(db.inserted("appointments")[0]).toMatchObject({
        status: "agendado",
        deposit_cents: 0,
      });
      expect(db.calls.some((c) => c.table === "deposit_payments")).toBe(false);
      expect(pixRuntime.getOrCreateCustomer).not.toHaveBeenCalled();
      expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
    },
  );

  it("fixo legado exigindo sinal sem valor continua recusado", async () => {
    const db = setupReserve({ deposit_mode: "fixed", deposit_cents: 0 });

    await expect(reserveBooking({ data: reserveInput })).rejects.toThrow(
      "Este serviço ainda não tem valor de sinal configurado.",
    );
    expect(db.inserted("appointments")).toHaveLength(0);
  });

  it("configuração de sinal inválida é recusada antes de reservar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = setupReserve({ deposit_mode: "percent", deposit_percent_bps: 12_000 });

    await expect(reserveBooking({ data: reserveInput })).rejects.toThrow(
      "O sinal deste serviço está configurado incorretamente.",
    );
    expect(db.inserted("appointments")).toHaveLength(0);
  });
});

describe("reserveBooking: CPF/CNPJ condicional ao sinal efetivo (T038)", () => {
  beforeEach(() => vi.resetAllMocks());

  const withoutDocument = { ...reserveInput, customerCpfCnpj: undefined };

  it("sinal zero reserva sem CPF/CNPJ", async () => {
    const db = setupReserve({ deposit_mode: "percent", deposit_percent_bps: 0 });

    const result = await reserveBooking({ data: withoutDocument });

    expect(result).toMatchObject({ chargeId: null, amountCents: 0 });
    expect(db.inserted("appointments")[0]).toMatchObject({ status: "agendado" });
  });

  it.each([undefined, "", "   "])(
    "sinal positivo recusa documento ausente (%j) antes de reservar",
    async (customerCpfCnpj) => {
      const db = setupReserve({ deposit_mode: "fixed", deposit_cents: 2_500 });

      await expect(reserveBooking({ data: { ...reserveInput, customerCpfCnpj } })).rejects.toThrow(
        "Informe um CPF ou CNPJ válido para gerar o Pix.",
      );
      expect(db.inserted("appointments")).toHaveLength(0);
    },
  );

  it("sinal positivo grava o documento normalizado para o Asaas", async () => {
    const db = setupReserve({ deposit_mode: "fixed", deposit_cents: 2_500 });

    await reserveBooking({ data: reserveInput });

    expect(db.inserted("deposit_payments")[0]).toMatchObject({ payer_cpf_cnpj: "52998224725" });
  });

  it("documento informado mas inválido continua recusado", async () => {
    setupReserve({ deposit_mode: "fixed", deposit_cents: 2_500 });

    await expect(
      reserveBooking({ data: { ...reserveInput, customerCpfCnpj: "529.982.247-24" } }),
    ).rejects.toThrow("CPF ou CNPJ inválido");
  });
});

describe("getPublicBookingCatalog: sinal efetivo calculado no servidor", () => {
  beforeEach(() => vi.resetAllMocks());

  it("expõe o sinal efetivo e omite serviço com sinal inválido", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: Call[] = [];
    const base = {
      name: "Serviço",
      duration_minutes: 30,
      description: null,
      image_path: null,
      show_price: true,
      show_duration: true,
      requires_deposit: true,
      price_cents: 10_000,
    };
    const results: Record<string, unknown> = {
      businesses: {
        data: {
          id: businessId,
          name: "Barbearia",
          category: null,
          phone: null,
          address: null,
          status: "ativo",
          brand_primary: null,
          brand_background: null,
          logo_url: null,
        },
        error: null,
      },
      services: {
        data: [
          {
            ...base,
            id: "percent",
            deposit_mode: "percent",
            deposit_percent_bps: 1_000,
            deposit_cents: 9_999,
          },
          {
            ...base,
            id: "fixed",
            deposit_mode: "fixed",
            deposit_percent_bps: 0,
            deposit_cents: 2_500,
          },
          {
            ...base,
            id: "zero",
            deposit_mode: "percent",
            deposit_percent_bps: 0,
            deposit_cents: 0,
          },
          {
            ...base,
            id: "invalid",
            deposit_mode: "percent",
            deposit_percent_bps: -5,
            deposit_cents: 0,
          },
        ],
        error: null,
      },
    };
    pixRuntime.db.from.mockImplementation((table: string) =>
      fakeQuery(table, results[table], calls),
    );

    const { services } = await getPublicBookingCatalog({ data: { slug: "barbearia" } });

    expect(services.map((s) => [s.id, s.effectiveDepositCents, s.deposit_cents])).toEqual([
      ["percent", 1_000, 1_000],
      ["fixed", 2_500, 2_500],
      ["zero", 0, 0],
    ]);
  });
});
