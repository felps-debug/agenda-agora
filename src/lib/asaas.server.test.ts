import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPixCharge,
  createSubaccount,
  decryptAsaasApiKey,
  encryptAsaasApiKey,
  getOrCreateCustomer,
  isDefinitivePixAvailabilityRejection,
  sanitizeAsaasPath,
  saveWithdrawalPixKeyForOwner,
} from "./asaas.server";
import { saveWithdrawalPixKeyInput } from "./withdrawal.functions";

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env["ASAAS_API_KEY"];
  delete process.env["ASAAS_WEBHOOK_TOKEN"];
  delete process.env["ASAAS_WEBHOOK_URL"];
  delete process.env["ASAAS_WEBHOOK_EMAIL"];
  delete process.env["ASAAS_CREDENTIALS_ENCRYPTION_KEY"];
});

describe("clientes Asaas", () => {
  it("reutiliza um cliente existente sem executar POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: "cus_1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getOrCreateCustomer({
        accessToken: "subaccount_key",
        name: "Cliente Teste",
        cpfCnpj: "529.982.247-25",
        externalReference: "charge-1",
      }),
    ).resolves.toBe("cus_1");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("User-Agent")).toBe("AgendaAgora/1.0");
    expect(new Headers(init.headers).get("access_token")).toBe("subaccount_key");
  });
});

describe("logs e erros do Asaas sem CPF/CNPJ", () => {
  const cpf = "52998224725";

  it("erro HTTP na busca de cliente não leva a query com CPF ao log nem ao erro", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ errors: [] }, 500)));

    const error = await getOrCreateCustomer({
      accessToken: "subaccount_key",
      name: "Cliente Teste",
      cpfCnpj: "529.982.247-25",
      externalReference: "charge-1",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(JSON.stringify(error)).not.toContain(cpf);
    expect(String((error as { path?: string }).path ?? "")).not.toContain("?");
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain(cpf);
    consoleSpy.mockRestore();
  });

  it("timeout na busca de cliente não leva a query com CPF ao log", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError")),
    );

    await expect(
      getOrCreateCustomer({
        accessToken: "subaccount_key",
        name: "Cliente Teste",
        cpfCnpj: "529.982.247-25",
        externalReference: "charge-1",
      }),
    ).rejects.toThrow(/não respondeu/i);
    expect(consoleSpy).toHaveBeenCalled();
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain(cpf);
    consoleSpy.mockRestore();
  });

  it("sanitizeAsaasPath remove query e fragmento", () => {
    expect(sanitizeAsaasPath("/customers?cpfCnpj=52998224725&limit=1")).toBe("/customers");
    expect(sanitizeAsaasPath("/payments/pay_1/pixQrCode")).toBe("/payments/pay_1/pixQrCode");
    expect(sanitizeAsaasPath("/payments#x")).toBe("/payments");
  });
});

describe("cobranças Asaas", () => {
  it("reutiliza externalReference existente e não duplica o POST", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ id: "pay_1", status: "PENDING", invoiceUrl: "https://invoice" }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          payload: "pix-copia-cola",
          encodedImage: "base64",
          expirationDate: "2026-09-19T12:00:00Z",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPixCharge({
      accessToken: "subaccount_key",
      amountCents: 2500,
      description: "Sinal",
      customerId: "cus_1",
      externalReference: "charge-1",
    });

    expect(result.providerPaymentId).toBe("pay_1");
    expect(result.qrCode).toBe("pix-copia-cola");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
  });
});

// T021 (spec 002): busca por externalReference, POST incerto, QR/payload faltante e
// não duplicação de cobrança em createPixCharge.
type AsaasRoute = (url: URL, init: RequestInit) => Response | Promise<Response> | undefined;

function asaasRoutes(...routes: AsaasRoute[]) {
  return vi.fn(async (input: string, init: RequestInit) => {
    const url = new URL(input);
    for (const route of routes) {
      const response = await route(url, init);
      if (response) return response;
    }
    throw new Error(`Rota Asaas inesperada: ${init.method} ${url.pathname}`);
  });
}

const isPaymentSearch = (url: URL, init: RequestInit) =>
  init.method === "GET" && url.pathname.endsWith("/payments");
const isPaymentCreate = (url: URL, init: RequestInit) =>
  init.method === "POST" && url.pathname.endsWith("/payments");
const isQrCode = (url: URL, init: RequestInit) =>
  init.method === "GET" && url.pathname.endsWith("/pixQrCode");

const fullQr = {
  payload: "pix-copia-cola",
  encodedImage: "base64",
  expirationDate: "2026-09-19T12:00:00Z",
};

const chargeInput = {
  accessToken: "subaccount_key",
  amountCents: 2500,
  description: "Sinal",
  customerId: "cus_1",
  externalReference: "charge-1",
};

describe("Asaas Pix availability rejection", () => {
  it("identifies a definitive Pix-unavailable response without exposing its body", async () => {
    const fetchMock = asaasRoutes(
      (url, init) => (isPaymentSearch(url, init) ? jsonResponse({ data: [] }) : undefined),
      (url, init) =>
        isPaymentCreate(url, init)
          ? jsonResponse(
              { errors: [{ code: "invalid_billingType", description: "Pix requires approval." }] },
              400,
            )
          : undefined,
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await createPixCharge({
      ...chargeInput,
      beforeCreate: async () => true,
    }).catch((reason: unknown) => reason);

    expect(isDefinitivePixAvailabilityRejection(error)).toBe(true);
    expect(String(error)).not.toContain("Pix requires approval");
  });
});

const countCalls = (fetchMock: ReturnType<typeof asaasRoutes>, method: string) =>
  fetchMock.mock.calls.filter(([, init]) => init.method === method).length;

describe("cobranças Asaas — busca por externalReference", () => {
  it("em estado incerto, não envia novo POST quando a busca ainda não encontrou a cobrança", async () => {
    const fetchMock = asaasRoutes((url, init) =>
      isPaymentSearch(url, init) ? jsonResponse({ data: [] }) : undefined,
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPixCharge({ ...chargeInput, allowCreate: false })).rejects.toThrow(
      /conciliada/i,
    );
    expect(countCalls(fetchMock, "POST")).toBe(0);
  });

  it("registra o id do provedor antes da tentativa de obter o QR", async () => {
    const onPaymentLocated = vi.fn(async () => {});
    const fetchMock = asaasRoutes(
      (url, init) =>
        isPaymentSearch(url, init)
          ? jsonResponse({ data: [{ id: "pay_1", status: "PENDING", value: 25 }] })
          : undefined,
      (url, init) => (isQrCode(url, init) ? jsonResponse({}, 404) : undefined),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPixCharge({ ...chargeInput, onPaymentLocated })).rejects.toThrow();
    expect(onPaymentLocated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pay_1", status: "PENDING" }),
    );
  });

  it("consulta /payments filtrando pelo externalReference da cobrança com a chave da subconta", async () => {
    const fetchMock = asaasRoutes(
      (url, init) =>
        isPaymentSearch(url, init)
          ? jsonResponse({ data: [{ id: "pay_1", status: "PENDING", value: 25 }] })
          : undefined,
      (url, init) => (isQrCode(url, init) ? jsonResponse(fullQr) : undefined),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createPixCharge(chargeInput);

    const [searchUrl, searchInit] = fetchMock.mock.calls[0]!;
    expect(new URL(searchUrl).searchParams.get("externalReference")).toBe("charge-1");
    expect(new Headers(searchInit.headers).get("access_token")).toBe("subaccount_key");
  });

  it("não reaproveita cobrança encontrada com valor diferente do sinal gravado", async () => {
    const fetchMock = asaasRoutes(
      (url, init) =>
        isPaymentSearch(url, init)
          ? jsonResponse({ data: [{ id: "pay_1", status: "PENDING", value: 50 }] })
          : undefined,
      (url, init) => (isQrCode(url, init) ? jsonResponse(fullQr) : undefined),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPixCharge(chargeInput)).rejects.toThrow();
    expect(countCalls(fetchMock, "POST")).toBe(0);
  });
});

describe("cobranças Asaas — claim e ID conhecido (T023)", () => {
  it("com knownPaymentId consulta a cobrança direto, sem busca nem POST", async () => {
    const fetchMock = asaasRoutes(
      (url, init) =>
        init.method === "GET" && url.pathname.endsWith("/payments/pay_salvo")
          ? jsonResponse({
              id: "pay_salvo",
              status: "PENDING",
              value: 25,
              externalReference: "charge-1",
            })
          : undefined,
      (url, init) => (isQrCode(url, init) ? jsonResponse(fullQr) : undefined),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPixCharge({ ...chargeInput, knownPaymentId: "pay_salvo" });

    expect(result.providerPaymentId).toBe("pay_salvo");
    expect(fetchMock.mock.calls.some(([u, init]) => isPaymentSearch(new URL(u), init))).toBe(false);
    expect(countCalls(fetchMock, "POST")).toBe(0);
  });

  it("recusa cobrança conhecida de outra referência", async () => {
    const fetchMock = asaasRoutes((url, init) =>
      init.method === "GET" && url.pathname.endsWith("/payments/pay_outro")
        ? jsonResponse({
            id: "pay_outro",
            status: "PENDING",
            value: 25,
            externalReference: "charge-2",
          })
        : undefined,
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPixCharge({ ...chargeInput, knownPaymentId: "pay_outro" })).rejects.toThrow(
      /não corresponde/i,
    );
  });

  it("beforeCreate false impede o POST quando a busca não achou cobrança", async () => {
    const beforeCreate = vi.fn(async () => false);
    const fetchMock = asaasRoutes((url, init) =>
      isPaymentSearch(url, init) ? jsonResponse({ data: [] }) : undefined,
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPixCharge({ ...chargeInput, beforeCreate })).rejects.toThrow(/conciliada/i);
    expect(beforeCreate).toHaveBeenCalledOnce();
    expect(countCalls(fetchMock, "POST")).toBe(0);
  });

  it("beforeCreate não é chamado quando a busca já encontra a cobrança", async () => {
    const beforeCreate = vi.fn(async () => true);
    const fetchMock = asaasRoutes(
      (url, init) =>
        isPaymentSearch(url, init)
          ? jsonResponse({ data: [{ id: "pay_1", status: "PENDING", value: 25 }] })
          : undefined,
      (url, init) => (isQrCode(url, init) ? jsonResponse(fullQr) : undefined),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createPixCharge({ ...chargeInput, beforeCreate });
    expect(beforeCreate).not.toHaveBeenCalled();
  });

  it("beforeCreate true anuncia e segue com um único POST", async () => {
    const beforeCreate = vi.fn(async () => true);
    const fetchMock = asaasRoutes(
      (url, init) => (isPaymentSearch(url, init) ? jsonResponse({ data: [] }) : undefined),
      (url, init) =>
        isPaymentCreate(url, init)
          ? jsonResponse({ id: "pay_1", status: "PENDING", value: 25 })
          : undefined,
      (url, init) => (isQrCode(url, init) ? jsonResponse(fullQr) : undefined),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createPixCharge({ ...chargeInput, beforeCreate });
    expect(beforeCreate).toHaveBeenCalledOnce();
    expect(countCalls(fetchMock, "POST")).toBe(1);
  });
});

describe("cobranças Asaas — POST incerto", () => {
  it("POST sem resposta, mas cobrança criada: recupera pela busca sem segundo POST", async () => {
    let created = false;
    const fetchMock = asaasRoutes(
      (url, init) =>
        isPaymentSearch(url, init)
          ? jsonResponse({ data: created ? [{ id: "pay_1", status: "PENDING", value: 25 }] : [] })
          : undefined,
      (url, init) => {
        if (!isPaymentCreate(url, init)) return undefined;
        created = true;
        throw new TypeError("fetch failed");
      },
      (url, init) => (isQrCode(url, init) ? jsonResponse(fullQr) : undefined),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPixCharge(chargeInput);

    expect(result.providerPaymentId).toBe("pay_1");
    expect(countCalls(fetchMock, "POST")).toBe(1);
  });

  it("POST com erro 5xx e busca indisponível: falha sem repetir o POST na mesma tentativa", async () => {
    let searches = 0;
    const fetchMock = asaasRoutes(
      (url, init) => {
        if (!isPaymentSearch(url, init)) return undefined;
        searches += 1;
        if (searches === 1) return jsonResponse({ data: [] });
        throw new TypeError("fetch failed");
      },
      (url, init) => (isPaymentCreate(url, init) ? jsonResponse({}, 502) : undefined),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPixCharge(chargeInput)).rejects.toThrow();
    expect(countCalls(fetchMock, "POST")).toBe(1);
  });
});

describe("cobranças Asaas — QR/payload faltante", () => {
  it.each([
    ["sem payload copia-e-cola", { encodedImage: "base64" }],
    ["sem imagem do QR", { payload: "pix-copia-cola" }],
    ["QR vazio", {}],
  ])("não retorna sucesso %s", async (_label, qr) => {
    const fetchMock = asaasRoutes(
      (url, init) =>
        isPaymentSearch(url, init)
          ? jsonResponse({ data: [{ id: "pay_1", status: "PENDING", value: 25 }] })
          : undefined,
      (url, init) => (isQrCode(url, init) ? jsonResponse(qr) : undefined),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPixCharge(chargeInput)).rejects.toThrow();
  });
});

describe("cobranças Asaas — não duplicação", () => {
  it("QR falha após POST bem-sucedido; retry reutiliza a mesma cobrança sem novo POST", async () => {
    const payments: { id: string; status: string; value: number }[] = [];
    let qrAvailable = false;
    const fetchMock = asaasRoutes(
      (url, init) => (isPaymentSearch(url, init) ? jsonResponse({ data: payments }) : undefined),
      (url, init) => {
        if (!isPaymentCreate(url, init)) return undefined;
        const payment = { id: `pay_${payments.length + 1}`, status: "PENDING", value: 25 };
        payments.push(payment);
        return jsonResponse(payment);
      },
      (url, init) =>
        isQrCode(url, init)
          ? qrAvailable
            ? jsonResponse(fullQr)
            : jsonResponse({ errors: [] }, 404)
          : undefined,
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createPixCharge(chargeInput)).rejects.toThrow();
    qrAvailable = true;
    const retry = await createPixCharge(chargeInput);

    expect(retry.providerPaymentId).toBe("pay_1");
    expect(payments).toHaveLength(1);
    expect(countCalls(fetchMock, "POST")).toBe(1);
  });
});

describe("subconta Asaas", () => {
  it("interpreta apiKey e walletId diretos e cadastra o webhook na criação", async () => {
    process.env["ASAAS_API_KEY"] = "root_key";
    process.env["ASAAS_WEBHOOK_TOKEN"] = "t".repeat(32);
    process.env["ASAAS_WEBHOOK_URL"] = "https://agenda.test/api/public/asaas-webhook";
    process.env["ASAAS_WEBHOOK_EMAIL"] = "financeiro@agenda.test";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "acc_1", apiKey: "sub_key", walletId: "wallet_1" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createSubaccount({
      name: "Barbearia Teste",
      email: "dono@agenda.test",
      cpfCnpj: "04.252.011/0001-10",
      mobilePhone: "11999999999",
      birthDate: "1990-01-01",
      incomeValue: 10000,
      address: "Rua Teste",
      addressNumber: "10",
      province: "Centro",
      postalCode: "01001000",
    });

    expect(result).toEqual({ accountId: "acc_1", apiKey: "sub_key", walletId: "wallet_1" });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.webhooks[0].authToken).toBe("t".repeat(32));
    expect(body.webhooks[0].url).toBe("https://agenda.test/api/public/asaas-webhook");
  });
});

describe("credencial Asaas", () => {
  it("criptografa e descriptografa a chave da subconta", () => {
    process.env["ASAAS_CREDENTIALS_ENCRYPTION_KEY"] = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptAsaasApiKey("$aact_subconta");
    expect(encrypted).not.toContain("$aact_subconta");
    expect(decryptAsaasApiKey(encrypted)).toBe("$aact_subconta");
  });
});

// T020 (US4): saveWithdrawalPixKey cadastra a chave PIX de saque do dono em
// businesses.withdrawal_pix_key/withdrawal_pix_key_type (data-model.md).
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

  it("aceita os 5 tipos de chave", async () => {
    const supabase = makeSupabaseMock({ businessFound: true });
    for (const pixKeyType of ["cpf", "cnpj", "email", "telefone", "aleatoria"] as const) {
      await expect(
        saveWithdrawalPixKeyForOwner(supabase, "user-dono", {
          businessId: "11111111-1111-1111-1111-111111111111",
          pixKey: `chave-${pixKeyType}`,
          pixKeyType,
        }),
      ).resolves.toEqual({
        businessId: "11111111-1111-1111-1111-111111111111",
        pixKey: `chave-${pixKeyType}`,
        pixKeyType,
      });
    }
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
});
