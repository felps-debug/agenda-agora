import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeNowMin,
  computeOpenDays,
  computeSlots,
  cancelAppointmentPublic,
  generateDepositPix,
  getPublicBookingCatalog,
  getAvailability,
  hhmm,
  isValidCpfCnpj,
  minutesOf,
  reserveBooking,
  rescheduleAppointmentPublic,
  shouldRequireDeposit,
  toIso,
} from "./booking.functions";
import { DEFAULT_PANEL1_APPEARANCE, defaultPanel1Config } from "./panel1-config";
import { formatAppointmentDateTime } from "./booking-history";
import { resetRateLimits } from "./rate-limit.server";
import { sendBookingConfirmation } from "./whatsapp-notify.server";

const pixRuntime = vi.hoisted(() => ({
  db: { from: vi.fn(), rpc: vi.fn() },
  createPixCharge: vi.fn(),
  panel1Config: null as unknown,
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
vi.mock("./agpay.server", () => ({
  createPixCharge: pixRuntime.createPixCharge,
}));
vi.mock("@/lib/panel1-config.storage", () => ({
  loadPanel1Config: async () => pixRuntime.panel1Config ?? defaultPanel1Config(),
}));
vi.mock("./whatsapp-notify.server", () => ({ sendBookingConfirmation: vi.fn() }));

// Todos os testes chamam as functions fora do runtime de requisição, então o
// limitador cai na chave "sem-request" e a cota de 10 reservas acabaria no meio
// da suíte. Resetar por teste mantém cada caso independente.
beforeEach(() => {
  resetRateLimits();
});

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

describe("toIso: fuso do estabelecimento", () => {
  it.each([
    ["America/Sao_Paulo", "2026-01-15T13:00:00.000Z"],
    ["America/Manaus", "2026-01-15T14:00:00.000Z"],
    ["America/Fortaleza", "2026-01-15T13:00:00.000Z"],
    ["Asia/Tokyo", "2026-01-15T01:00:00.000Z"],
  ])("converte 10h corretamente em %s", (timezone, expected) => {
    expect(toIso("2026-01-15", "10:00", timezone)).toBe(expected);
  });
});

describe("computeSlots: intervalo de listagem", () => {
  it("usa o intervalo configurado entre horários", () => {
    expect(
      computeSlots({
        hours: [{ starts_at: "09:00", ends_at: "11:00" }],
        busy: [],
        durationMinutes: 30,
        nowMin: -1,
        listingIntervalMinutes: 20,
      }),
    ).toEqual(["09:00", "09:20", "09:40", "10:00", "10:20"]);
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
  status: "pending",
  qrCode: "pix-copia-e-cola",
  qrCodeBase64: null,
  ticketUrl: null,
};

function setupDepositPix(
  options: {
    expiresAt?: string;
    qrCode?: string | null;
    payerCpfCnpj?: string | null;
    payerEmail?: string | null;
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
    payer_email:
      options.payerEmail === undefined ? "cliente.pagador@example.com" : options.payerEmail,
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
  pixRuntime.db.from.mockImplementation((table: string) => {
    if (table === "deposit_payments") return payments;
    throw new Error(`Tabela inesperada no teste: ${table}`);
  });
  pixRuntime.createPixCharge.mockResolvedValue(pixResponse);
  return { charge, updates, payments, releases, updateFilters };
}

describe("generateDepositPix: retry e estados da cobrança", () => {
  beforeEach(() => vi.resetAllMocks());

  it("mantém o CPF após falha externa e permite retry pelo claim", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockRejectedValueOnce(new Error("AgPay indisponível"));

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.charge.payer_cpf_cnpj).toBe("52998224725");

    await expect(generateDepositPix({ data: { chargeId } })).resolves.toMatchObject({
      qrCode: pixResponse.qrCode,
      qrCodeBase64: pixResponse.qrCodeBase64,
    });
    expect(pixRuntime.createPixCharge).toHaveBeenCalledTimes(2);
    expect(pixRuntime.createPixCharge).toHaveBeenLastCalledWith(
      expect.objectContaining({
        amountCents: 2500,
        payerName: "Cliente Teste",
        payerEmail: "cliente.pagador@example.com",
        payerCpf: "52998224725",
      }),
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

  it("não cria outra cobrança quando outra instância já detém o claim", async () => {
    setupDepositPix();
    pixRuntime.db.rpc.mockResolvedValueOnce({
      data: [{ acquired: false, reason: "ocupada", claim_token: null, attempt_state: null }],
      error: null,
    });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(/sendo gerado/i);
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
  });

  it("em POST anterior incerto, só envia novo POST se o banco aceitar o anúncio", async () => {
    setupDepositPix({ markAllowed: false });
    pixRuntime.db.rpc.mockResolvedValueOnce({
      data: [
        { acquired: true, reason: "ok", claim_token: chargeId, attempt_state: "post_incerto" },
      ],
      error: null,
    });
    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
    expect(pixRuntime.db.rpc).toHaveBeenCalledWith(
      "mark_deposit_pix_post_started",
      expect.objectContaining({ _claim_token: chargeId }),
    );
  });

  it("anuncia o POST pelo RPC imediatamente antes de chamar o AgPay", async () => {
    setupDepositPix();

    await generateDepositPix({ data: { chargeId } });
    expect(pixRuntime.db.rpc).toHaveBeenCalledWith(
      "mark_deposit_pix_post_started",
      expect.anything(),
    );
    expect(pixRuntime.createPixCharge).toHaveBeenCalledWith(
      expect.not.objectContaining({
        knownPaymentId: expect.anything(),
        allowCreate: expect.anything(),
        beforeCreate: expect.anything(),
        onPaymentLocated: expect.anything(),
      }),
    );
  });

  it("com provider_payment_id salvo e sem QR, aguarda conciliação e nunca repete POST", async () => {
    setupDepositPix({
      providerPaymentId: "pay_salvo",
    });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(/conciliação/i);
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
  });

  it("libera como criado quando o ID foi gravado mesmo se o QR falhou", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockResolvedValueOnce({ ...pixResponse, qrCode: "" });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.charge.provider_payment_id).toBe("pay_test_1");
    expect(db.releases).toEqual(["criado"]);
  });

  it("libera como falhou quando nenhuma cobrança foi localizada", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockRejectedValueOnce(new Error("provedor fora do ar"));

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.releases).toEqual(["falhou"]);
  });

  it("normaliza rejeição do AgPay e libera o claim como falhou", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockRejectedValueOnce(
      Object.assign(new Error("Provider rejected billing type."), {
        codes: ["invalid_billingType"],
      }),
    );

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(
      /não foi possível gerar o pix agora/i,
    );
    expect(db.releases).toEqual(["falhou"]);
  });

  it("grava o ID do provedor filtrando por token e sem sobrescrever outro ID", async () => {
    const db = setupDepositPix();

    await generateDepositPix({ data: { chargeId } });
    expect(db.updateFilters).toContainEqual(["pix_claim_token", "eq", chargeId]);
    expect(db.updateFilters).toContainEqual(["provider_payment_id", "is", null]);
  });

  it("relê após o claim: sem CPF não chama o AgPay", async () => {
    setupDepositPix({
      onClaim: (charge) => {
        charge["payer_cpf_cnpj"] = null;
      },
    });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(/CPF\/CNPJ/i);
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
  });

  it("relê após o claim: devolve QR persistido por outra instância", async () => {
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
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
    expect(db.releases).toEqual(["criado"]);
  });

  it("relê após o claim: cobrança expirada no intervalo não cria cobrança", async () => {
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

    await generateDepositPix({ data: { chargeId } });
    const statusFilters = db.updateFilters.filter(
      ([column, op, value]) => column === "status" && op === "eq" && value === "pendente",
    );
    const tokenFilters = db.updateFilters.filter(([column]) => column === "pix_claim_token");
    expect(statusFilters).toHaveLength(2);
    expect(tokenFilters).toHaveLength(2);
    expect(db.updateFilters.some(([column, op]) => column === "expires_at" && op === "gt")).toBe(
      true,
    );
  });

  it("cobrança criada depois do vencimento: grava o id para cancelamento e não expõe o QR", async () => {
    const db = setupDepositPix();
    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, "now");
    pixRuntime.createPixCharge.mockImplementationOnce(async () => {
      nowSpy.mockReturnValue(realNow + 60 * 60_000);
      return { ...pixResponse, providerPaymentId: "pay_tardio" };
    });

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
    pixRuntime.createPixCharge.mockRejectedValueOnce(new Error("provedor fora do ar"));
    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow(
      /não foi possível gerar o pix agora/i,
    );
  });

  it("persiste o ID do provedor antes de rejeitar resposta sem QR", async () => {
    const db = setupDepositPix();
    pixRuntime.createPixCharge.mockResolvedValueOnce({ ...pixResponse, qrCode: "" });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.charge.provider_payment_id).toBe("pay_test_1");
  });

  it.each([null, "pix-antigo"])(
    "rejeita cobrança expirada antes de devolver ou criar QR (%s)",
    async (qrCode) => {
      setupDepositPix({ expiresAt: "2020-01-01T00:00:00.000Z", qrCode });

      await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
      expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
    },
  );

  it("envia ao AgPay apenas os campos suportados pelo novo cliente", async () => {
    setupDepositPix();

    await generateDepositPix({ data: { chargeId } });
    expect(pixRuntime.createPixCharge).toHaveBeenCalledWith({
      amountCents: 2500,
      payerName: "Cliente Teste",
      payerEmail: "cliente.pagador@example.com",
      payerCpf: "52998224725",
    });
  });

  it("não declara sucesso se falhar o update do QR e do provider_payment_id", async () => {
    const db = setupDepositPix({ failQrUpdate: true });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
    expect(db.charge.provider_payment_id).toBe("pay_test_1");
    expect(db.charge.qr_code).toBeNull();
  });

  it("não devolve sucesso sem o payload copia-e-cola", async () => {
    setupDepositPix();
    pixRuntime.createPixCharge.mockResolvedValue({ ...pixResponse, qrCode: "" });

    await expect(generateDepositPix({ data: { chargeId } })).rejects.toThrow();
  });

  it("aceita QR sem imagem base64, como retornado pelo AgPay", async () => {
    setupDepositPix();
    await expect(generateDepositPix({ data: { chargeId } })).resolves.toMatchObject({
      qrCode: pixResponse.qrCode,
      qrCodeBase64: null,
    });
  });

  it("cria cobrança sem e-mail de split ou aprovação prévia", async () => {
    setupDepositPix();

    await expect(generateDepositPix({ data: { chargeId } })).resolves.toMatchObject({
      qrCode: pixResponse.qrCode,
    });
    expect(pixRuntime.createPixCharge).toHaveBeenCalledOnce();
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
const publicCode = "55555555-5555-4555-8555-555555555555";

function setupPublicAppointment(
  options: {
    found?: boolean;
    status?: string;
    startsAt?: string;
    cancellationsEnabled?: boolean;
    cancellationNotice?: number;
    rescheduleEnabled?: boolean;
    rescheduleNotice?: number;
  } = {},
) {
  const row: Record<string, unknown> = {
    id: appointmentId,
    public_code: publicCode,
    business_id: businessId,
    service_id: serviceId,
    professional_id: null,
    customer_name: "Cliente Teste",
    customer_phone: "11999990000",
    starts_at: options.startsAt ?? "2099-01-05T13:00:00.000Z",
    ends_at: "2099-01-05T13:30:00.000Z",
    status: options.status ?? "agendado",
  };
  const config = defaultPanel1Config();
  config.preferences.cancellations_enabled = options.cancellationsEnabled ?? true;
  config.preferences.cancellation_notice_minutes = options.cancellationNotice ?? 60;
  config.preferences.reschedule_enabled = options.rescheduleEnabled ?? true;
  config.preferences.reschedule_notice_minutes = options.rescheduleNotice ?? 60;
  pixRuntime.panel1Config = config;
  const appointmentQuery = {
    select: () => ({
      in: async (_column: string, codes: string[]) => ({
        data: options.found === false || !codes.includes(publicCode) ? [] : [row],
        error: null,
      }),
    }),
    update: (patch: Record<string, unknown>) => {
      const query = {
        eq: () => query,
        select: () => query,
        maybeSingle: async () => {
          Object.assign(row, patch);
          return { data: { id: appointmentId }, error: null };
        },
      };
      return query;
    },
  };
  pixRuntime.db.from.mockImplementation((table: string) => {
    if (table === "appointments") return appointmentQuery;
    throw new Error(`Tabela inesperada no teste: ${table}`);
  });
  return { row };
}

function setupAvailableReschedule(timezone = "America/Sao_Paulo") {
  const row: Record<string, unknown> = {
    id: appointmentId,
    public_code: publicCode,
    business_id: businessId,
    service_id: serviceId,
    professional_id: null,
    customer_name: "Cliente Teste",
    customer_phone: "11999990000",
    starts_at: "2099-01-05T13:00:00.000Z",
    ends_at: "2099-01-05T13:30:00.000Z",
    status: "agendado",
  };
  const config = defaultPanel1Config();
  config.preferences.reschedule_enabled = true;
  config.preferences.reschedule_notice_minutes = 60;
  config.preferences.timezone = timezone;
  pixRuntime.panel1Config = config;
  const from = vi.fn((table: string) => {
    let selected = "";
    let patch: Record<string, unknown> | null = null;
    let result: unknown;
    const query = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "select") return (columns: string) => ((selected = columns), query);
          if (property === "update")
            return (value: Record<string, unknown>) => ((patch = value), query);
          if (property === "in")
            return async (_column: string, codes: string[]) => ({
              data: codes.includes(publicCode) ? [row] : [],
              error: null,
            });
          if (property === "maybeSingle")
            return async () => {
              if (table === "businesses")
                return {
                  data:
                    selected === "slug"
                      ? { slug: "barbearia" }
                      : { id: businessId, status: "ativo" },
                  error: null,
                };
              if (table === "services")
                return {
                  data:
                    selected === "duration_minutes"
                      ? { duration_minutes: 30 }
                      : {
                          id: serviceId,
                          name: "Corte",
                          duration_minutes: 30,
                          requires_deposit: false,
                          deposit_mode: "fixed",
                          deposit_percent_bps: 0,
                          price_cents: 10_000,
                          deposit_cents: 0,
                        },
                  error: null,
                };
              if (table === "appointments" && patch) {
                Object.assign(row, patch);
                return { data: { id: appointmentId }, error: null };
              }
              return { data: null, error: null };
            };
          if (property === "then")
            return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(
                result ??
                  (table === "business_hours"
                    ? { data: [{ starts_at: "09:00", ends_at: "12:00" }], error: null }
                    : { data: [], error: null }),
              ).then(resolve, reject);
          return (..._args: unknown[]) => query;
        },
      },
    );
    return query;
  });
  pixRuntime.db.from.mockImplementation(from);
  return { row };
}

describe("cancelAppointmentPublic: acesso pelo código público", () => {
  beforeEach(() => vi.resetAllMocks());

  it("cancela uma reserva identificada pelo código e repete sem efeito adicional", async () => {
    const db = setupPublicAppointment();
    await expect(cancelAppointmentPublic({ data: { publicCode } })).resolves.toEqual({
      ok: true,
      status: "cancelado",
    });
    expect(db.row["status"]).toBe("cancelado");
    await expect(cancelAppointmentPublic({ data: { publicCode } })).resolves.toEqual({
      ok: true,
      status: "cancelado",
    });
  });

  it("recusa código inexistente ou pertencente a outra reserva", async () => {
    setupPublicAppointment({ found: false });
    await expect(cancelAppointmentPublic({ data: { publicCode } })).rejects.toThrow(
      "Agendamento não encontrado.",
    );
  });

  it("repetir a remarcação para o horário já salvo é idempotente", async () => {
    setupPublicAppointment({
      startsAt: "2099-01-05T13:00:00.000Z",
      rescheduleEnabled: true,
    });
    await expect(
      rescheduleAppointmentPublic({ data: { publicCode, date: "2099-01-05", time: "10:00" } }),
    ).resolves.toMatchObject({ ok: true, startsAt: "2099-01-05T13:00:00.000Z" });
  });

  it("remarca para um horário disponível e preserva o código público", async () => {
    const db = setupAvailableReschedule();
    await expect(
      rescheduleAppointmentPublic({ data: { publicCode, date: "2099-01-06", time: "10:00" } }),
    ).resolves.toMatchObject({ ok: true, startsAt: "2099-01-06T13:00:00.000Z" });
    expect(db.row["starts_at"]).toBe("2099-01-06T13:00:00.000Z");
    expect(db.row["public_code"]).toBe(publicCode);
  });

  it.each([
    ["America/Manaus", "2099-01-06T14:30:00.000Z"],
    ["America/Fortaleza", "2099-01-06T13:30:00.000Z"],
    ["America/Sao_Paulo", "2099-01-06T13:30:00.000Z"],
  ])("fluxo completo mantém 10:30 da lista até o histórico em %s", async (timezone, expected) => {
    const db = setupAvailableReschedule(timezone);
    const availability = await getAvailability({
      data: { slug: "barbearia", serviceId, date: "2099-01-06" },
    });
    const selectedTime = availability.slots.find((slot) => slot === "10:30");
    expect(selectedTime).toBe("10:30");
    await expect(
      rescheduleAppointmentPublic({
        data: { publicCode, date: "2099-01-06", time: selectedTime! },
      }),
    ).resolves.toMatchObject({ startsAt: expected });
    expect(db.row["starts_at"]).toBe(expected);
    expect(formatAppointmentDateTime(String(db.row["starts_at"]), timezone)).toContain("10:30");
  });

  it("respeita recurso desligado e prazo mínimo para cancelar", async () => {
    setupPublicAppointment({ cancellationsEnabled: false });
    await expect(cancelAppointmentPublic({ data: { publicCode } })).rejects.toThrow(
      /cancelamento não está disponível/i,
    );

    setupPublicAppointment({
      startsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      cancellationNotice: 60,
    });
    await expect(cancelAppointmentPublic({ data: { publicCode } })).rejects.toThrow(
      /prazo para cancelar/i,
    );
  });
});

describe("rescheduleAppointmentPublic: acesso pelo código público", () => {
  beforeEach(() => vi.resetAllMocks());

  it("recusa código de outra reserva, recurso desligado e prazo encerrado", async () => {
    setupPublicAppointment({ found: false });
    await expect(
      rescheduleAppointmentPublic({ data: { publicCode, date: "2099-01-06", time: "10:00" } }),
    ).rejects.toThrow("Agendamento não encontrado.");

    setupPublicAppointment({ rescheduleEnabled: false });
    await expect(
      rescheduleAppointmentPublic({ data: { publicCode, date: "2099-01-06", time: "10:00" } }),
    ).rejects.toThrow(/remarcação não está disponível/i);

    setupPublicAppointment({
      startsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      rescheduleNotice: 60,
    });
    await expect(
      rescheduleAppointmentPublic({ data: { publicCode, date: "2099-01-06", time: "10:00" } }),
    ).rejects.toThrow(/prazo para remarcar/i);
  });
});

function setupReserve(
  service: Partial<{
    requires_deposit: boolean;
    deposit_mode: string;
    deposit_percent_bps: number;
    price_cents: number;
    deposit_cents: number;
  }> = {},
  timezone = "America/Sao_Paulo",
  availability: {
    hours?: { starts_at: string; ends_at: string }[];
    blocks?: Record<string, unknown>[];
    minimumNoticeHours?: number;
  } = {},
) {
  const config = defaultPanel1Config();
  config.preferences.timezone = timezone;
  config.preferences.minimum_notice_hours = availability.minimumNoticeHours ?? 0;
  pixRuntime.panel1Config = config;
  const calls: Call[] = [];
  const results: Record<string, unknown> = {
    businesses: {
      data: { id: businessId, status: "ativo" },
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
    // reserveBooking valida expediente/bloqueio antes de gravar. `appointments`
    // volta vazio: a leitura de disponibilidade não encontra conflito e a
    // checagem seguinte também — um `select` do Supabase sempre devolve array.
    business_hours: {
      data: availability.hours ?? [{ starts_at: "00:00", ends_at: "23:59" }],
      error: null,
    },
    time_blocks: { data: availability.blocks ?? [], error: null },
    appointments: { data: [], error: null },
    deposit_payments: { data: { id: chargeId }, error: null },
  };
  pixRuntime.db.from.mockImplementation((table: string) => {
    if (!(table in results)) throw new Error(`Tabela inesperada no teste: ${table}`);
    return fakeQuery(table, results[table], calls);
  });
  const inserted = (table: string) =>
    calls
      .filter((c) => c.table === table && c.method === "insert")
      .map((c) => c.args[0] as Record<string, unknown>);
  return {
    calls,
    inserted,
    service: (results["services"] as { data: Record<string, unknown> }).data,
  };
}

const reserveInput = {
  slug: "barbearia",
  serviceId,
  date: "2099-01-05",
  time: "10:00",
  customerName: "Cliente Teste",
  customerPhone: "11999990000",
  customerEmail: "cliente.pagador@example.com",
  customerCpfCnpj: "529.982.247-25",
};

describe("reserveBooking: snapshot do sinal (fixo/percentual)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("usa o fuso do negócio ao criar o horário, como no fluxo de remarcação", async () => {
    const db = setupReserve(
      { requires_deposit: false, deposit_mode: "fixed", deposit_cents: 0 },
      "America/Manaus",
    );

    await reserveBooking({ data: reserveInput });

    expect(db.inserted("appointments")[0]).toMatchObject({
      starts_at: "2099-01-05T14:00:00.000Z",
      ends_at: "2099-01-05T14:30:00.000Z",
      status: "agendado",
    });
    expect(db.calls.some((call) => call.table === "deposit_payments")).toBe(false);
  });

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

  it("mantém o snapshot do sinal após o serviço ser editado", async () => {
    const db = setupReserve({ deposit_mode: "percent", deposit_percent_bps: 1_000 });
    await reserveBooking({ data: reserveInput });
    const firstAppointment = db.inserted("appointments")[0]!;
    const firstPayment = db.inserted("deposit_payments")[0]!;

    db.service["price_cents"] = 20_000;
    db.service["deposit_percent_bps"] = 2_000;
    await reserveBooking({ data: reserveInput });
    const secondAppointment = db.inserted("appointments")[1]!;

    expect(firstAppointment["deposit_cents"]).toBe(1_000);
    expect(firstPayment["amount_cents"]).toBe(1_000);
    expect(secondAppointment["deposit_cents"]).toBe(4_000);
  });

  it.each([
    ["0%", { requires_deposit: false, deposit_percent_bps: 0, price_cents: 10_000 }],
    ["preço zero", { requires_deposit: false, deposit_percent_bps: 5_000, price_cents: 0 }],
  ])("%s no modo percentual confirma sem cobrança nem deposit_payments", async (_label, config) => {
    const db = setupReserve({ deposit_mode: "percent", ...config });

    const result = await reserveBooking({ data: reserveInput });

    expect(result).toMatchObject({ chargeId: null, amountCents: 0 });
    expect(db.inserted("appointments")[0]).toMatchObject({
      status: "agendado",
      deposit_cents: 0,
    });
    expect(db.calls.some((c) => c.table === "deposit_payments")).toBe(false);
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
  });

  it("serviço legado com exigência e sinal zero confirma sem cobrança", async () => {
    const db = setupReserve({ deposit_mode: "fixed", deposit_cents: 0 });

    await expect(reserveBooking({ data: reserveInput })).resolves.toMatchObject({
      chargeId: null,
      amountCents: 0,
    });
    expect(db.inserted("appointments")[0]).toMatchObject({ status: "agendado", deposit_cents: 0 });
    expect(db.calls.some((call) => call.table === "deposit_payments")).toBe(false);
  });

  it("configuração de sinal inválida é recusada antes de reservar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = setupReserve({ deposit_mode: "percent", deposit_percent_bps: 12_000 });

    await expect(reserveBooking({ data: reserveInput })).rejects.toThrow(
      "Este serviço não está disponível para reserva agora. Tente outro horário ou entre em contato.",
    );
    expect(db.inserted("appointments")).toHaveLength(0);
  });

  it.each([
    ["-1%", -100],
    ["101%", 10_100],
  ])("rejeita percentual de sinal %s antes de reservar", async (_label, percentBps) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const db = setupReserve({ deposit_mode: "percent", deposit_percent_bps: percentBps });
    await expect(reserveBooking({ data: reserveInput })).rejects.toThrow(
      "Este serviço não está disponível para reserva agora. Tente outro horário ou entre em contato.",
    );
    expect(db.inserted("appointments")).toHaveLength(0);
    expect(pixRuntime.createPixCharge).not.toHaveBeenCalled();
  });
});

describe("reserveBooking: CPF/CNPJ condicional ao sinal efetivo (T038)", () => {
  beforeEach(() => vi.resetAllMocks());

  const withoutDocument = { ...reserveInput, customerCpfCnpj: undefined };

  it("sinal zero reserva sem CPF/CNPJ", async () => {
    const db = setupReserve({
      requires_deposit: false,
      deposit_mode: "percent",
      deposit_percent_bps: 0,
    });

    const result = await reserveBooking({ data: withoutDocument });

    expect(result).toMatchObject({ chargeId: null, amountCents: 0 });
    expect(db.inserted("appointments")[0]).toMatchObject({ status: "agendado" });
  });

  it("reserva sem sinal avisa o cliente por WhatsApp uma única vez", async () => {
    // O banco fake responde `appointments` com um array (serve também à checagem de conflito),
    // então o id não é verificável aqui; o que importa é o disparo, uma vez, após gravar.
    const db = setupReserve({ requires_deposit: false });

    await reserveBooking({ data: withoutDocument });

    await vi.waitFor(() => expect(sendBookingConfirmation).toHaveBeenCalledTimes(1));
    expect(db.inserted("appointments")).toHaveLength(1);
  });

  it("reserva com sinal não manda a confirmação de reserva (ela sai após o Pix pago)", async () => {
    setupReserve({ deposit_mode: "fixed", deposit_cents: 2_500 });

    await reserveBooking({ data: reserveInput });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(sendBookingConfirmation).not.toHaveBeenCalled();
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

  it("sinal positivo grava o documento normalizado para o pagamento", async () => {
    const db = setupReserve({ deposit_mode: "fixed", deposit_cents: 2_500 });

    await reserveBooking({ data: reserveInput });

    expect(db.inserted("deposit_payments")[0]).toMatchObject({ payer_cpf_cnpj: "52998224725" });
    expect(db.inserted("deposit_payments")[0]).toMatchObject({
      payer_email: "cliente.pagador@example.com",
    });
  });

  it("documento informado mas inválido continua recusado", async () => {
    setupReserve({ deposit_mode: "fixed", deposit_cents: 2_500 });

    await expect(
      reserveBooking({ data: { ...reserveInput, customerCpfCnpj: "529.982.247-24" } }),
    ).rejects.toThrow("CPF ou CNPJ inválido");
  });

  it.each([undefined, "", "   "])(
    "sinal positivo recusa e-mail ausente (%j) antes de reservar",
    async (customerEmail) => {
      const db = setupReserve({ deposit_mode: "fixed", deposit_cents: 2_500 });

      await expect(reserveBooking({ data: { ...reserveInput, customerEmail } })).rejects.toThrow(
        /e-mail (?:inválido|válido para gerar o Pix)/i,
      );
      expect(db.inserted("appointments")).toHaveLength(0);
    },
  );

  it("sinal positivo recusa e-mail inválido", async () => {
    setupReserve({ deposit_mode: "fixed", deposit_cents: 2_500 });

    await expect(
      reserveBooking({ data: { ...reserveInput, customerEmail: "email-invalido" } }),
    ).rejects.toThrow("E-mail inválido");
  });
});

/**
 * BUG-4 (auditoria QA 03/10/2026): as regras de expediente, bloqueio e
 * antecedência existiam apenas em `getAvailability` (isto é, apenas na UI).
 * `reserveBooking` era um endpoint público que aceitava qualquer horário.
 */
describe("reserveBooking: as regras de agenda valem no servidor, não só na UI", () => {
  beforeEach(() => vi.resetAllMocks());

  const BARBEARIA = { hours: [{ starts_at: "08:30", ends_at: "19:00" }] };

  const dayOffset = (days: number) =>
    new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });

  it("recusa horário fora do expediente", async () => {
    // A auditoria reproduziu reserva aceita às 03:00 com expediente 08:30-19:00.
    const db = setupReserve({ requires_deposit: false }, "America/Sao_Paulo", BARBEARIA);

    await expect(reserveBooking({ data: { ...reserveInput, time: "03:00" } })).rejects.toThrow(
      /não está mais disponível/i,
    );
    expect(db.inserted("appointments")).toHaveLength(0);
  });

  it("recusa data que já passou", async () => {
    // A auditoria reproduziu reserva de 01/09 aceita como 'agendado' no banco.
    const db = setupReserve({ requires_deposit: false });

    await expect(
      reserveBooking({ data: { ...reserveInput, date: "2020-01-05", time: "10:30" } }),
    ).rejects.toThrow(/não está mais disponível/i);
    expect(db.inserted("appointments")).toHaveLength(0);
  });

  it("recusa horário dentro de um bloqueio", async () => {
    const db = setupReserve({ requires_deposit: false }, "America/Sao_Paulo", {
      hours: [{ starts_at: "00:00", ends_at: "23:59" }],
      blocks: [
        {
          starts_at: "09:00",
          ends_at: "11:00",
          recurring: false,
          block_date: "2099-01-05",
          professional_id: null,
        },
      ],
    });

    await expect(reserveBooking({ data: reserveInput })).rejects.toThrow(
      /não está mais disponível/i,
    );
    expect(db.inserted("appointments")).toHaveLength(0);
  });

  it("recusa quando o dia não tem expediente cadastrado", async () => {
    const db = setupReserve({ requires_deposit: false }, "America/Sao_Paulo", { hours: [] });

    await expect(reserveBooking({ data: reserveInput })).rejects.toThrow(
      /não está mais disponível/i,
    );
    expect(db.inserted("appointments")).toHaveLength(0);
  });

  it("respeita a antecedência mínima configurada", async () => {
    // 72h de antecedência com reserva em 2 dias: a data inteira cai dentro da
    // janela, então não sobra horário nenhum.
    const db = setupReserve({ requires_deposit: false }, "America/Sao_Paulo", {
      hours: [{ starts_at: "00:00", ends_at: "23:59" }],
      minimumNoticeHours: 72,
    });

    await expect(reserveBooking({ data: { ...reserveInput, date: dayOffset(2) } })).rejects.toThrow(
      /não está mais disponível/i,
    );
    expect(db.inserted("appointments")).toHaveLength(0);
  });

  it("aceita e grava horário válido dentro do expediente", async () => {
    const db = setupReserve({ requires_deposit: false }, "America/Sao_Paulo", BARBEARIA);

    await reserveBooking({ data: reserveInput });

    expect(db.inserted("appointments")[0]).toMatchObject({
      starts_at: "2099-01-05T13:00:00.000Z",
      status: "agendado",
    });
  });

  it("aceita minuto fora da grade de exibição, desde que dentro do expediente", async () => {
    // A tela lista de 30 em 30, mas o servidor valida a regra, não a grade:
    // 10:20 é um horário legítimo e não pode ser recusado.
    const db = setupReserve({ requires_deposit: false }, "America/Sao_Paulo", BARBEARIA);

    await reserveBooking({ data: { ...reserveInput, time: "10:20" } });

    expect(db.inserted("appointments")).toHaveLength(1);
  });
});

describe("getPublicBookingCatalog: sinal efetivo calculado no servidor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pixRuntime.panel1Config = null;
  });

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

    const { services, appearance } = await getPublicBookingCatalog({ data: { slug: "barbearia" } });

    expect(Object.keys(appearance ?? {}).sort()).toEqual(
      Object.keys(DEFAULT_PANEL1_APPEARANCE).sort(),
    );
    expect(appearance).toEqual(DEFAULT_PANEL1_APPEARANCE);

    expect(services.map((s) => [s.id, s.effectiveDepositCents, s.deposit_cents])).toEqual([
      ["percent", 1_000, 1_000],
      ["fixed", 2_500, 2_500],
      ["zero", 0, 0],
    ]);
  });

  it("retorna as 17 cores salvas na aparência pública", async () => {
    const calls: Call[] = [];
    const savedAppearance = Object.fromEntries(
      Object.keys(DEFAULT_PANEL1_APPEARANCE).map((key, index) => [
        key,
        `#${index.toString(16).padStart(6, "0")}`,
      ]),
    );
    pixRuntime.panel1Config = {
      ...defaultPanel1Config(),
      appearance: savedAppearance,
    };
    pixRuntime.db.from.mockImplementation((table: string) =>
      fakeQuery(
        table,
        table === "businesses"
          ? {
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
            }
          : { data: [], error: null },
        calls,
      ),
    );

    const { appearance } = await getPublicBookingCatalog({ data: { slug: "barbearia" } });

    expect(appearance).toEqual(savedAppearance);
    expect(Object.keys(appearance ?? {})).toHaveLength(
      Object.keys(DEFAULT_PANEL1_APPEARANCE).length,
    );
  });
});
