import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgpayApiError,
  agpayFetch,
  createPixCharge,
  createCashoutPix,
  fetchPayment,
  fetchPaymentStatus,
  verifyAgpayWebhookSignature,
} from "./agpay.server";

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env["AGPAY_API_TOKEN"];
  delete process.env["AGPAY_CLIENT_ID"];
  delete process.env["AGPAY_EGRESS_PROXY_URL"];
  delete process.env["AGPAY_EGRESS_PROXY_SECRET"];
});

describe("cliente HTTP AgPay", () => {
  it("envia somente os headers aceitos pela API", async () => {
    process.env["AGPAY_API_TOKEN"] = "token-plataforma";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await agpayFetch("/transactions/tx-1");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://agpay.services/api/v1/transactions/tx-1");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-plataforma");
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-Client-ID")).toBeNull();
    expect(init.redirect).toBe("manual");
  });

  it("trata resposta 3xx como erro explícito", async () => {
    process.env["AGPAY_API_TOKEN"] = "token-plataforma";
    process.env["AGPAY_CLIENT_ID"] = "cliente-plataforma";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 302 })));

    const error = await agpayFetch("/payments/pix", { method: "POST", body: "{}" }).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(AgpayApiError);
    expect(error).toMatchObject({ status: 302, path: "/payments/pix" });
  });

  it("limita a cobrança a oito segundos e sanitiza timeout de rede", async () => {
    process.env["AGPAY_API_TOKEN"] = "token-plataforma";
    process.env["AGPAY_CLIENT_ID"] = "cliente-plataforma";
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const timeout = new Error("deadline exceeded");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    await expect(agpayFetch("/payments/pix", { method: "POST", body: "{}" })).rejects.toThrow(
      "O AgPay não respondeu. Tente novamente em instantes.",
    );
    expect(timeoutSpy).toHaveBeenCalledWith(8_000);
  });

  it("encaminha chamadas pelo proxy com segredo e destino AgPay", async () => {
    process.env["AGPAY_API_TOKEN"] = "token-plataforma";
    process.env["AGPAY_CLIENT_ID"] = "cliente-plataforma";
    process.env["AGPAY_EGRESS_PROXY_URL"] = "https://proxy.example.test/forward";
    process.env["AGPAY_EGRESS_PROXY_SECRET"] = "segredo-proxy";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    await agpayFetch("/transactions/tx-1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://proxy.example.test/forward");
    expect(new Headers(init.headers).get("X-Proxy-Secret")).toBe("segredo-proxy");
    expect(JSON.parse(init.body)).toMatchObject({
      url: "https://agpay.services/api/v1/transactions/tx-1",
      method: "GET",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("extrai message e errors de um 422 JSON sem expor o corpo na mensagem", async () => {
    process.env["AGPAY_API_TOKEN"] = "token-plataforma";
    process.env["AGPAY_CLIENT_ID"] = "cliente-plataforma";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { message: "Dados inválidos", errors: { amount: ["Valor mínimo é 0,01"] } },
            422,
          ),
        ),
    );

    const error = await agpayFetch("/payments/pix?cpf=123", {
      method: "POST",
      body: "{}",
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(AgpayApiError);
    expect(error).toMatchObject({
      status: 422,
      path: "/payments/pix",
      providerMessage: "Dados inválidos",
      errors: { amount: ["Valor mínimo é 0,01"] },
    });
    expect(String(error)).not.toContain("Dados inválidos");
  });
});

describe("assinatura do webhook AgPay", () => {
  const rawBody = '{"event":"deposit.completed","data":{"transaction_uuid":"tx-1"}}';

  it("aceita o HMAC-SHA256 correto", () => {
    process.env["AGPAY_API_TOKEN"] = "segredo-webhook";
    const signature = createHmac("sha256", "segredo-webhook").update(rawBody).digest("hex");

    expect(verifyAgpayWebhookSignature(rawBody, signature)).toBe(true);
  });

  it("rejeita HMAC incorreto", () => {
    process.env["AGPAY_API_TOKEN"] = "segredo-webhook";
    const signature = createHmac("sha256", "outro-segredo").update(rawBody).digest("hex");

    expect(verifyAgpayWebhookSignature(rawBody, signature)).toBe(false);
  });

  it("rejeita assinatura ausente", () => {
    process.env["AGPAY_API_TOKEN"] = "segredo-webhook";

    expect(verifyAgpayWebhookSignature(rawBody, null)).toBe(false);
  });
});

describe("cobranças Pix AgPay", () => {
  it("envia o sinal integral à plataforma e normaliza a resposta do POST", async () => {
    process.env["AGPAY_API_TOKEN"] = "token-plataforma";
    process.env["AGPAY_CLIENT_ID"] = "cliente-plataforma";
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: true,
          data: {
            transaction_uuid: "tx-post-1",
            status: "pending",
            pix_code: "pix-copia-cola",
            qr_code: "pix-copia-cola",
            expires_at: "2026-09-26T12:00:00Z",
          },
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPixCharge({
      amountCents: 10_050,
      payerName: "Cliente Teste",
      payerEmail: "cliente@example.com",
      payerCpf: "52998224725",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://agpay.services/api/v1/payments/pix");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      amount: 100.5,
      payer_name: "Cliente Teste",
      payer_email: "cliente@example.com",
      payer_cpf: "52998224725",
    });
    expect(result).toEqual({
      providerPaymentId: "tx-post-1",
      status: "pending",
      qrCode: "pix-copia-cola",
      qrCodeBase64: null,
      ticketUrl: null,
      expiresAt: "2026-09-26T12:00:00Z",
    });
  });

  it("normaliza uuid do GET e fetchPaymentStatus expõe somente o status", async () => {
    process.env["AGPAY_API_TOKEN"] = "token-plataforma";
    process.env["AGPAY_CLIENT_ID"] = "cliente-plataforma";
    const fetchMock = vi.fn().mockImplementation(async () =>
      jsonResponse({
        success: true,
        data: {
          uuid: "tx-get-1",
          amount: "100.50",
          fee: "5.00",
          amount_net: "95.50",
          type: "pix",
          status: "completed",
          external_id: "external-1",
          created_at: "2026-09-26T10:00:00Z",
          updated_at: "2026-09-26T10:05:00Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPayment("tx/id com espaço")).resolves.toEqual({
      providerPaymentId: "tx-get-1",
      status: "completed",
      amount: "100.50",
      fee: "5.00",
      amountNet: "95.50",
      type: "pix",
      externalId: "external-1",
      createdAt: "2026-09-26T10:00:00Z",
      updatedAt: "2026-09-26T10:05:00Z",
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://agpay.services/api/v1/transactions/tx%2Fid%20com%20espa%C3%A7o",
    );

    await expect(fetchPaymentStatus("tx-get-1")).resolves.toBe("completed");
  });

  it("solicita saque Pix com o Bearer e valor esperados", async () => {
    process.env["AGPAY_API_TOKEN"] = "token-plataforma";
    process.env["AGPAY_CLIENT_ID"] = "cliente-plataforma";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { success: true, withdrawal: { id: 123, status: "processing", fee: "2.50" } },
          201,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(createCashoutPix({ amountCents: 2500, pixKey: "chave-pix" })).resolves.toEqual({
      providerRef: "123",
      status: "processing",
      providerFeeCents: 250,
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://agpay.services/api/v1/cashout/pix");
    expect(JSON.parse(init.body)).toEqual({ amount: 25, pix_key: "chave-pix" });
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-plataforma");
    expect(new Headers(init.headers).get("X-Client-ID")).toBeNull();
  });
});
