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
    if (last && Date.now() - last < 24 * 3_600_000) return null;
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

  it("a segunda mensagem do mesmo contato na janela de 24h é ignorada", async () => {
    await post({ request: request(payload()) });
    const second = await post({ request: request(payload("5511999990000", "tem horário?")) });
    expect(await second.json()).toMatchObject({
      received: true,
      replied: false,
      reason: "cooldown de 24h",
    });
    expect(runtime.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it("outro contato recebe a própria saudação", async () => {
    await post({ request: request(payload("5511999990000")) });
    await post({ request: request(payload("5511888880000")) });
    expect(runtime.sendTextMessage).toHaveBeenCalledTimes(2);
  });

  it("greeting_enabled=false não envia", async () => {
    runtime.greetingEnabled = false;
    const response = await post({ request: request(payload()) });
    expect(await response.json()).toMatchObject({ replied: false, reason: "saudação desativada" });
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
      reason: "sem credencial",
    });
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("falha do provedor responde 200 e libera nova tentativa depois", async () => {
    runtime.sendTextMessage.mockRejectedValueOnce(new Error("provedor fora do ar"));
    const failed = await post({ request: request(payload()) });
    expect(failed.status).toBe(200);
    const retry = await post({ request: request(payload()) });
    expect(await retry.json()).toMatchObject({ replied: true });
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
