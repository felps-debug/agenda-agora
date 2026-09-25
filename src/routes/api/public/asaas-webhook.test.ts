import { beforeEach, describe, expect, it, vi } from "vitest";

// Confirma que o endpoint que recebe o webhook do Asaas (asaas-access-token) rejeita
// requisições forjadas/sem token e só persiste o evento com o token correto.

const runtime = vi.hoisted(() => ({
  getRequiredWebhookToken: vi.fn(),
  persistAsaasWebhookEvent: vi.fn(),
}));

vi.mock("@/lib/asaas.server", () => ({
  getRequiredWebhookToken: runtime.getRequiredWebhookToken,
}));
vi.mock("@/lib/asaas-events.server", () => ({
  persistAsaasWebhookEvent: runtime.persistAsaasWebhookEvent,
}));

const { Route } = await import("./asaas-webhook");
const post = (
  Route.options as unknown as {
    server: { handlers: { POST: (a: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;

const REAL_TOKEN = "t".repeat(40);

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://agenda.test/api/public/asaas-webhook", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/public/asaas-webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.getRequiredWebhookToken.mockReturnValue(REAL_TOKEN);
    runtime.persistAsaasWebhookEvent.mockResolvedValue(undefined);
  });

  it("rejeita sem o header asaas-access-token", async () => {
    const res = await post({
      request: request({ id: "evt_1", event: "PAYMENT_RECEIVED" }),
    });
    expect(res.status).toBe(401);
    expect(runtime.persistAsaasWebhookEvent).not.toHaveBeenCalled();
  });

  it("rejeita webhook forjado com token incorreto", async () => {
    const res = await post({
      request: request(
        { id: "evt_1", event: "PAYMENT_RECEIVED" },
        { "asaas-access-token": "token-forjado-completamente-diferente" },
      ),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(runtime.persistAsaasWebhookEvent).not.toHaveBeenCalled();
  });

  it("rejeita token com mesmo tamanho mas conteúdo diferente (sem vazar por timing)", async () => {
    const almostRight = "t".repeat(39) + "x";
    const res = await post({
      request: request(
        { id: "evt_1", event: "PAYMENT_RECEIVED" },
        { "asaas-access-token": almostRight },
      ),
    });
    expect(res.status).toBe(401);
    expect(runtime.persistAsaasWebhookEvent).not.toHaveBeenCalled();
  });

  it("aceita e persiste o evento com o token correto", async () => {
    const res = await post({
      request: request(
        { id: "evt_1", event: "PAYMENT_RECEIVED", payment: { id: "pay_1", status: "RECEIVED" } },
        { "asaas-access-token": REAL_TOKEN },
      ),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(runtime.persistAsaasWebhookEvent).toHaveBeenCalledWith({
      id: "evt_1",
      event: "PAYMENT_RECEIVED",
      payment: { id: "pay_1", status: "RECEIVED" },
    });
  });

  it("recusa JSON inválido mesmo com token correto", async () => {
    const res = await post({
      request: request("{not-json", { "asaas-access-token": REAL_TOKEN }),
    });
    expect(res.status).toBe(400);
    expect(runtime.persistAsaasWebhookEvent).not.toHaveBeenCalled();
  });

  it("recusa payload sem id/event mesmo com token correto", async () => {
    const res = await post({
      request: request({ foo: "bar" }, { "asaas-access-token": REAL_TOKEN }),
    });
    expect(res.status).toBe(400);
    expect(runtime.persistAsaasWebhookEvent).not.toHaveBeenCalled();
  });

  it("erro de configuração (token do servidor ausente) nunca chega a validar o header", async () => {
    runtime.getRequiredWebhookToken.mockImplementation(() => {
      throw new Error("ASAAS_WEBHOOK_TOKEN ausente");
    });
    const res = await post({
      request: request(
        { id: "evt_1", event: "PAYMENT_RECEIVED" },
        { "asaas-access-token": REAL_TOKEN },
      ),
    });
    expect(res.status).toBe(500);
    expect(runtime.persistAsaasWebhookEvent).not.toHaveBeenCalled();
  });

  it("falha ao persistir retorna 500 mas já validou o token", async () => {
    runtime.persistAsaasWebhookEvent.mockRejectedValue(new Error("db down"));
    const res = await post({
      request: request(
        { id: "evt_1", event: "PAYMENT_RECEIVED" },
        { "asaas-access-token": REAL_TOKEN },
      ),
    });
    expect(res.status).toBe(500);
  });
});
