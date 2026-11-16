import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin } from "@/test-support/fake-admin";

const SECRET = "w".repeat(40);
const BUSINESS_ID = "b-1";
const INSTANCE = "token-da-instancia";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
  sendTextMessage: vi.fn(async () => undefined),
  greetingEnabled: true,
  hasCredential: true,
  claims: new Map<string, number>(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/lib/env-security.server", () => ({
  getWhatsAppWebhookSecret: () => SECRET,
  getPublicAppUrl: () => "https://app.agendagora.test",
}));
vi.mock("@/lib/panel1-config.storage", () => ({
  loadPanel1Config: async () => ({ preferences: { greeting_enabled: runtime.greetingEnabled } }),
}));
vi.mock("@/lib/whatsapp-notify.server", () => ({
  bookingLinkForSlug: (slug: string) => `https://agendar.test/${slug}`,
  renderMessage: (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? ""),
}));
vi.mock("@/lib/whatsapp-provider.server", () => ({
  loadWhatsappProvider: async () => ({ sendTextMessage: runtime.sendTextMessage }),
}));
vi.mock("@/lib/whatsapp-credentials.server", () => ({
  readWhatsappCredential: async () => (runtime.hasCredential ? { instanceToken: INSTANCE } : null),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => runtime.fake!.client.from(table),
    rpc: (name: string, args: Record<string, unknown>) => runtime.fake!.client.rpc(name, args),
  },
}));

await import("@/integrations/supabase/client.server");
const { Route } = await import("./whatsapp-incoming");
const { processPendingIncomingWhatsappGreetings } = await import("@/lib/whatsapp-greeting.server");
const post = (
  Route as unknown as {
    options: { server: { handlers: { POST: (arg: { request: Request }) => Promise<Response> } } };
  }
).options.server.handlers.POST;

function payload(phone = "5511999990000", text = "oi") {
  return {
    event: "messages",
    instance: INSTANCE,
    data: {
      key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: false },
      pushName: "Maria Souza",
      message: { conversation: text },
    },
  };
}

function request(
  body: unknown,
  headers: Record<string, string> = { "x-webhook-secret": SECRET },
  url = "https://app.test/api/public/whatsapp-incoming",
) {
  return new Request(url, { method: "POST", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  runtime.sendTextMessage.mockClear();
  runtime.greetingEnabled = true;
  runtime.hasCredential = true;
  runtime.claims.clear();
  runtime.fake = createFakeAdmin({
    business_whatsapp_credentials: [{ business_id: BUSINESS_ID, instance_token: INSTANCE }],
    businesses: [
      {
        id: BUSINESS_ID,
        name: "Barbearia do Zé",
        slug: "barbearia-do-ze",
        greeting: "Olá!",
        saudacao_template: "{Saudacao} {Cliente}, agende em {Link}",
        whatsapp_instance: "inst",
        whatsapp_instance_token: INSTANCE,
      },
    ],
  });
  runtime.fake.rpcHandlers["claim_whatsapp_greeting"] = (args) => {
    const key = `${args["p_business_id"]}|${args["p_sender_phone"]}`;
    const last = runtime.claims.get(key);
    if (last && Date.now() - last < 30 * 60_000) return null;
    runtime.claims.set(key, Date.now());
    return "claim-token";
  };
  runtime.fake.rpcHandlers["finish_whatsapp_greeting"] = (args) => {
    if (args["p_sent"] === false) {
      runtime.claims.delete(`${args["p_business_id"]}|${args["p_sender_phone"]}`);
    }
    return true;
  };
});

describe("webhook de mensagens do WhatsApp (US7)", () => {
  it("rejects Content-Length above 1 MiB before parsing", async () => {
    const oversized = new Request("https://app.test/api/public/whatsapp-incoming", {
      method: "POST",
      headers: { "x-webhook-secret": SECRET, "content-length": String(1024 * 1024 + 1) },
      body: JSON.stringify(payload()),
    });
    const response = await post({ request: oversized });
    expect(response.status).toBe(413);
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("limits streamed bodies when Content-Length is absent", async () => {
    const body = JSON.stringify({ ...payload(), padding: "x".repeat(1024 * 1024) });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    });
    const oversized = new Request("https://app.test/api/public/whatsapp-incoming", {
      method: "POST",
      headers: { "x-webhook-secret": SECRET },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const response = await post({ request: oversized });
    expect(response.status).toBe(413);
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("sem X-Webhook-Secret responde 401 e não envia nada", async () => {
    const response = await post({ request: request(payload(), {}) });
    expect(response.status).toBe(401);
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("segredo errado responde 401", async () => {
    const response = await post({
      request: request(payload(), { "x-webhook-secret": "x".repeat(40) }),
    });
    expect(response.status).toBe(401);
  });

  it("segredo na query string não vale", async () => {
    const response = await post({
      request: request(
        payload(),
        {},
        `https://app.test/api/public/whatsapp-incoming?secret=${SECRET}&token=${SECRET}`,
      ),
    });
    expect(response.status).toBe(401);
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("segredo com tamanho diferente é recusado sem lançar erro", async () => {
    const response = await post({ request: request(payload(), { "x-webhook-secret": "curto" }) });
    expect(response.status).toBe(401);
  });

  it("mensagem nova gera exatamente uma saudação, com nome e link resolvidos", async () => {
    const response = await post({ request: request(payload()) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, replied: true });
    expect(runtime.sendTextMessage).toHaveBeenCalledTimes(1);
    expect(runtime.sendTextMessage).toHaveBeenCalledWith(
      INSTANCE,
      "5511999990000",
      "Olá! Maria, agende em https://agendar.test/barbearia-do-ze",
    );
  });

  it("autentica e processa o envelope oficial UazAPI usando o token de instância registrado", async () => {
    const officialPayload = {
      EventType: "messages",
      owner: "5511999999999",
      token: INSTANCE,
      BaseUrl: "https://uazapi.test",
      instanceName: "atendimento",
      message: {
        id: "message-1",
        messageid: "message-1",
        chatid: "5511888887777@s.whatsapp.net",
        sender: "5511888887777@s.whatsapp.net",
        senderName: "Contato Teste",
        fromMe: false,
        isGroup: false,
        messageType: "Conversation",
        text: "Olá, gostaria de agendar.",
      },
    };

    const response = await post({ request: request(officialPayload, {}) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, replied: true });
    expect(runtime.sendTextMessage).toHaveBeenCalledWith(
      INSTANCE,
      "5511888887777",
      "Olá! Contato, agende em https://agendar.test/barbearia-do-ze",
    );
  });

  it("recusa token de instância UazAPI desconhecido", async () => {
    const response = await post({
      request: request(
        {
          EventType: "messages",
          token: "token-desconhecido",
          message: {
            sender: "5511888887777@s.whatsapp.net",
            fromMe: false,
            isGroup: false,
            text: "Oi",
          },
        },
        {},
      ),
    });

    expect(response.status).toBe(401);
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("a segunda mensagem do mesmo contato na janela de 30 min é ignorada", async () => {
    await post({ request: request(payload()) });
    const second = await post({ request: request(payload("5511999990000", "tem horário?")) });
    expect(await second.json()).toMatchObject({
      received: true,
      replied: false,
      reason: "mensagem registrada para processamento ou retry",
    });
    expect(runtime.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it("Evolution com remoteJid LID usa remoteJidAlt para responder", async () => {
    const incoming = payload();
    incoming.data.key.remoteJid = "123456789012345@lid";
    Object.assign(incoming.data.key, { remoteJidAlt: "5511999990000@s.whatsapp.net" });

    const response = await post({ request: request(incoming) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, replied: true });
    expect(runtime.sendTextMessage).toHaveBeenCalledWith(
      INSTANCE,
      "5511999990000",
      "Olá! Maria, agende em https://agendar.test/barbearia-do-ze",
    );
  });

  it("outro contato recebe a própria saudação", async () => {
    await post({ request: request(payload("5511999990000")) });
    await post({ request: request(payload("5511888880000")) });
    expect(runtime.sendTextMessage).toHaveBeenCalledTimes(2);
  });

  it("greeting_enabled=false não envia", async () => {
    runtime.greetingEnabled = false;
    const response = await post({ request: request(payload()) });
    expect(await response.json()).toMatchObject({
      replied: false,
      reason: "mensagem registrada para processamento ou retry",
    });
    expect(runtime.fake!.tables["whatsapp_incoming_greeting_events"]![0]).toMatchObject({
      status: "skipped",
    });
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("negócio sem WhatsApp conectado: 200, sem envio e com o motivo", async () => {
    runtime.hasCredential = false;
    runtime.fake!.tables["businesses"]![0]!["whatsapp_instance_token"] = null;
    const response = await post({ request: request(payload()) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      received: true,
      replied: false,
      reason: "mensagem registrada para processamento ou retry",
    });
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("falha do provedor responde 200 e libera nova tentativa depois", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T12:00:00.000Z"));
    runtime.sendTextMessage.mockRejectedValueOnce(new Error("provedor fora do ar"));
    try {
      const failed = await post({ request: request(payload()) });
      expect(failed.status).toBe(200);
      expect(runtime.fake!.tables["whatsapp_incoming_greeting_events"]).toMatchObject([
        {
          status: "pending",
          attempts: 1,
          last_error: "Falha ao enviar ou registrar a saudação pelo WhatsApp.",
          sender_phone: "5511999990000",
        },
      ]);

      vi.setSystemTime(new Date("2026-11-15T12:03:00.000Z"));
      await processPendingIncomingWhatsappGreetings();
      expect(runtime.fake!.tables["whatsapp_incoming_greeting_events"]![0]).toMatchObject({
        status: "sent",
        attempts: 2,
        last_error: null,
      });
      expect(runtime.sendTextMessage).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("mensagem enviada pelo próprio negócio e mensagens de grupo não geram saudação", async () => {
    const own = payload();
    own.data.key.fromMe = true;
    await post({ request: request(own) });
    const group = payload();
    group.data.key.remoteJid = "120363000000@g.us";
    await post({ request: request(group) });
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("webhook repetido com o mesmo ID não cria eventos duplicados", async () => {
    const message = {
      EventType: "messages",
      token: INSTANCE,
      message: {
        id: "same-message-id",
        sender: "5511888887777@s.whatsapp.net",
        senderName: "Contato Teste",
        fromMe: false,
        isGroup: false,
        text: "Oi",
      },
    };
    await post({ request: request(message, {}) });
    await post({ request: request(message, {}) });
    expect(runtime.fake!.tables["whatsapp_incoming_greeting_events"]).toHaveLength(1);
    expect(runtime.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it("corpo que não é JSON responde 200 sem processar", async () => {
    const response = await post({
      request: new Request("https://app.test/api/public/whatsapp-incoming", {
        method: "POST",
        headers: { "x-webhook-secret": SECRET },
        body: "isso não é json",
      }),
    });
    expect(response.status).toBe(200);
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });
});
