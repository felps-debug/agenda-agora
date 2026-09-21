import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPixCharge,
  createSubaccount,
  decryptAsaasApiKey,
  encryptAsaasApiKey,
  getOrCreateCustomer,
} from "./asaas.server";

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
