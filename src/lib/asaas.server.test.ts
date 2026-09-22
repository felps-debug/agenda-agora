import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPixCharge,
  createSubaccount,
  decryptAsaasApiKey,
  encryptAsaasApiKey,
  getOrCreateCustomer,
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
