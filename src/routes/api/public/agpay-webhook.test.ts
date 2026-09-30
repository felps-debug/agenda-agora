import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  verify: vi.fn(),
  persistedHashes: new Set<string>(),
  persist: vi.fn(async (rawBody: string) => {
    runtime.persistedHashes.add(rawBody);
  }),
}));

vi.mock("@/lib/agpay.server", () => ({
  verifyAgpayWebhookSignature: runtime.verify,
}));
vi.mock("@/lib/agpay-events.server", () => ({
  persistAgpayWebhookEvent: runtime.persist,
}));

const { Route } = await import("./agpay-webhook");
const post = (
  Route.options as unknown as {
    server: { handlers: { POST: (a: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;

function request(rawBody: string, signature?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("X-Webhook-Signature", signature);
  return new Request("https://agenda.test/api/public/agpay-webhook", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/public/agpay-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.persistedHashes.clear();
    runtime.verify.mockImplementation((_rawBody: string, signature: string | null) => {
      return signature === "assinatura-valida";
    });
  });

  it("rejeita assinatura ausente ou inválida antes de persistir", async () => {
    const rawBody = JSON.stringify({ event: "deposit.completed", data: {} });
    const missing = await post({ request: request(rawBody) });
    const invalid = await post({ request: request(rawBody, "forjada") });

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual({ error: "Unauthorized" });
    expect(runtime.persist).not.toHaveBeenCalled();
  });

  it("valida a assinatura sobre o texto bruto antes de tentar JSON.parse", async () => {
    const rawBody = "{not-json";
    const response = await post({ request: request(rawBody, "assinatura-valida") });

    expect(runtime.verify).toHaveBeenCalledWith(rawBody, "assinatura-valida");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
    expect(runtime.persist).not.toHaveBeenCalled();
  });

  it("recusa evento sem event ou data", async () => {
    const response = await post({
      request: request(JSON.stringify({ event: "deposit.completed" }), "assinatura-valida"),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid event" });
    expect(runtime.persist).not.toHaveBeenCalled();
  });

  it("persiste evento válido e responde received", async () => {
    const payload = {
      event: "deposit.completed",
      data: { transaction_uuid: "tx-1", status: "completed" },
    };
    const rawBody = JSON.stringify(payload);
    const response = await post({ request: request(rawBody, "assinatura-valida") });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(runtime.persist).toHaveBeenCalledWith(rawBody, payload);
  });

  it("reenvio do mesmo corpo continua 200 e a persistência deduplica", async () => {
    const rawBody = JSON.stringify({
      event: "deposit.completed",
      data: { transaction_uuid: "tx-1" },
    });

    const first = await post({ request: request(rawBody, "assinatura-valida") });
    const retry = await post({ request: request(rawBody, "assinatura-valida") });

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(runtime.persistedHashes.size).toBe(1);
  });

  it("falha de persistência retorna 500", async () => {
    runtime.persist.mockRejectedValueOnce(new Error("db down"));
    const rawBody = JSON.stringify({ event: "deposit.completed", data: {} });
    const response = await post({ request: request(rawBody, "assinatura-valida") });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Persistence failed" });
  });
});
