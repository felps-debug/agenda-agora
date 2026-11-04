import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin } from "@/test-support/fake-admin";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
  sendTextMessage: vi.fn(async () => undefined),
  preferences: {
    post_service_enabled: true,
    post_service_minutes: 60,
    post_service_send_to: "todos",
    post_service_clients: "",
    post_service_template: "{Cliente}, obrigado por vir à {negocio}! {Link}",
  } as Record<string, unknown>,
}));

vi.mock("@/lib/env-security.server", () => ({
  getPublicAppUrl: () => "https://app.agendagora.test",
  getWhatsAppWebhookSecret: () => "x".repeat(40),
}));
vi.mock("@/lib/panel1-config.storage", () => ({
  loadPanel1Config: async () => ({ preferences: runtime.preferences }),
}));
vi.mock("./whatsapp-notify.server", () => ({
  bookingLinkForSlug: (slug: string) => `https://agendar.test/${slug}`,
  renderMessage: (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? ""),
}));
vi.mock("./whatsapp-provider.server", () => ({
  loadWhatsappProvider: async () => ({ sendTextMessage: runtime.sendTextMessage }),
}));
vi.mock("./whatsapp-credentials.server", () => ({
  readWhatsappCredential: async () => ({ instanceToken: "token-inst" }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const query = runtime.fake!.client.from(table) as unknown as Record<string, unknown>;
      // O fake devolve "duplicate key" para a segunda fila do mesmo atendimento (UNIQUE no banco).
      if (table === "post_service_message_queue") {
        const insert = query["insert"] as (value: Record<string, unknown>) => unknown;
        query["insert"] = (value: Record<string, unknown>) => {
          const exists = runtime.fake!.tables["post_service_message_queue"]?.some(
            (row) => row["appointment_id"] === value["appointment_id"],
          );
          if (exists) {
            return {
              then: (resolve: (v: unknown) => unknown) =>
                Promise.resolve({
                  data: null,
                  error: { message: "duplicate key value violates unique constraint" },
                }).then(resolve),
            };
          }
          return insert(value);
        };
      }
      return query;
    },
    rpc: (name: string, args: Record<string, unknown>) => runtime.fake!.client.rpc(name, args),
  },
}));

await import("@/integrations/supabase/client.server");
const { enqueuePostServiceMessage, processPostServiceMessages } =
  await import("./whatsapp-greeting.server");

const BUSINESS = "b-1";

function appointment(overrides: Record<string, unknown> = {}) {
  return {
    id: "a-1",
    business_id: BUSINESS,
    customer_id: "c-1",
    customer_name: "Maria",
    customer_phone: "5511999990000",
    status: "concluido",
    ...overrides,
  };
}

beforeEach(() => {
  runtime.sendTextMessage.mockClear();
  runtime.preferences = {
    post_service_enabled: true,
    post_service_minutes: 60,
    post_service_send_to: "todos",
    post_service_clients: "",
    post_service_template: "{Cliente}, obrigado por vir à {negocio}! {Link}",
  };
  runtime.fake = createFakeAdmin({
    appointments: [appointment()],
    businesses: [
      { id: BUSINESS, name: "Barbearia", slug: "barbearia", whatsapp_instance_token: "token-inst" },
    ],
    post_service_message_queue: [],
  });
  runtime.fake.rpcHandlers["claim_post_service_messages"] = () =>
    runtime
      .fake!.tables["post_service_message_queue"]!.filter((row) => !row["processed_at"])
      .map((row) => ({
        id: row["id"],
        appointment_id: row["appointment_id"],
      }));
});

describe("mensagem pós-atendimento (US7)", () => {
  it("atendimento concluído entra na fila com a hora configurada", async () => {
    const before = Date.now();
    await expect(enqueuePostServiceMessage("a-1", BUSINESS)).resolves.toBe(true);
    const queued = runtime.fake!.tables["post_service_message_queue"]!;
    expect(queued).toHaveLength(1);
    const delay = Date.parse(String(queued[0]!["scheduled_at"])) - before;
    expect(delay).toBeGreaterThanOrEqual(59 * 60_000);
    expect(delay).toBeLessThanOrEqual(61 * 60_000);
  });

  it("nunca entra na fila quando o recurso está desabilitado", async () => {
    runtime.preferences["post_service_enabled"] = false;
    await expect(enqueuePostServiceMessage("a-1", BUSINESS)).resolves.toBe(false);
    expect(runtime.fake!.tables["post_service_message_queue"]).toHaveLength(0);
  });

  it("atendimento que não está concluído ou sem telefone não entra na fila", async () => {
    runtime.fake!.tables["appointments"]![0]!["status"] = "agendado";
    await expect(enqueuePostServiceMessage("a-1", BUSINESS)).resolves.toBe(false);
    runtime.fake!.tables["appointments"]![0]!["status"] = "concluido";
    runtime.fake!.tables["appointments"]![0]!["customer_phone"] = null;
    await expect(enqueuePostServiceMessage("a-1", BUSINESS)).resolves.toBe(false);
    expect(runtime.fake!.tables["post_service_message_queue"]).toHaveLength(0);
  });

  it("concluir duas vezes o mesmo atendimento não duplica a fila", async () => {
    await enqueuePostServiceMessage("a-1", BUSINESS);
    await expect(enqueuePostServiceMessage("a-1", BUSINESS)).resolves.toBe(false);
    expect(runtime.fake!.tables["post_service_message_queue"]).toHaveLength(1);
  });

  it("envia uma única vez por atendimento concluído", async () => {
    await enqueuePostServiceMessage("a-1", BUSINESS);
    const first = await processPostServiceMessages();
    const second = await processPostServiceMessages();
    expect(first).toMatchObject({ sent: 1, skipped: 0 });
    expect(second).toMatchObject({ sent: 0, skipped: 0 });
    expect(runtime.sendTextMessage).toHaveBeenCalledTimes(1);
    expect(runtime.sendTextMessage).toHaveBeenCalledWith(
      "token-inst",
      "5511999990000",
      "Maria, obrigado por vir à Barbearia! https://agendar.test/barbearia",
    );
  });

  it("se o recurso for desligado depois de enfileirar, nada é enviado", async () => {
    await enqueuePostServiceMessage("a-1", BUSINESS);
    runtime.preferences["post_service_enabled"] = false;
    const result = await processPostServiceMessages();
    expect(result).toMatchObject({ sent: 0, skipped: 1 });
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("respeita a lista 'somente para' e 'todos exceto'", async () => {
    await enqueuePostServiceMessage("a-1", BUSINESS);
    runtime.preferences["post_service_send_to"] = "somente_para";
    runtime.preferences["post_service_clients"] = "outro-cliente";
    expect(await processPostServiceMessages()).toMatchObject({ sent: 0, skipped: 1 });

    runtime.fake!.tables["post_service_message_queue"]![0]!["processed_at"] = null;
    runtime.preferences["post_service_send_to"] = "todos_exceto";
    runtime.preferences["post_service_clients"] = "c-1";
    expect(await processPostServiceMessages()).toMatchObject({ sent: 0, skipped: 1 });
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("falha do provedor mantém o item pendente para nova tentativa", async () => {
    await enqueuePostServiceMessage("a-1", BUSINESS);
    runtime.sendTextMessage.mockRejectedValueOnce(new Error("sem conexão"));
    expect(await processPostServiceMessages()).toMatchObject({ sent: 0, skipped: 0 });
    expect(runtime.fake!.tables["post_service_message_queue"]![0]!["processed_at"]).toBeUndefined();
    expect(runtime.fake!.tables["post_service_message_queue"]![0]!["last_error"]).toBe(
      "sem conexão",
    );
    expect(await processPostServiceMessages()).toMatchObject({ sent: 1 });
  });
});
