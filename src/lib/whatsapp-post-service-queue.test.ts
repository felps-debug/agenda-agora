import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  appointmentError: null as { message: string } | null,
  businessError: null as { message: string } | null,
  customerError: null as { message: string } | null,
  credentialError: null as Error | null,
  selectedClients: null as string | null,
  appointment: {
    id: "appointment-1",
    business_id: "business-1",
    customer_id: null as string | null,
    customer_name: "Ana",
    customer_phone: "5511999990000",
    status: "concluido",
  } as {
    id: string;
    business_id: string;
    customer_id: string | null;
    customer_name: string;
    customer_phone: string;
    status: string;
  } | null,
  business: {
    id: "business-1",
    name: "Studio",
    slug: "studio",
    whatsapp_instance_token: "legacy-token",
  },
  queueUpdates: [] as Array<Record<string, unknown>>,
  insertCalls: 0,
  sendTextMessage: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: async () => ({ data: [{ id: "queue-1", appointment_id: "appointment-1" }], error: null }),
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        in: async () => ({ data: [], error: runtime.customerError }),
        maybeSingle: async () => {
          if (table === "appointments") {
            return {
              data: runtime.appointmentError ? null : runtime.appointment,
              error: runtime.appointmentError,
            };
          }
          if (table === "businesses") {
            return {
              data: runtime.businessError ? null : runtime.business,
              error: runtime.businessError,
            };
          }
          return { data: null, error: null };
        },
        insert: async () => {
          runtime.insertCalls += 1;
          return { error: null };
        },
        update: (values: Record<string, unknown>) => ({
          eq: async () => {
            runtime.queueUpdates.push(values);
            return { error: null };
          },
        }),
      };
      return query;
    },
  },
}));

vi.mock("./panel1-config.storage", () => ({
  loadPanel1Config: async () => ({
    preferences: {
      post_service_enabled: true,
      post_service_minutes: 5,
      post_service_clients: runtime.selectedClients ?? "",
      post_service_send_to: "todos",
      post_service_template: "Obrigado, {Cliente}!",
    },
  }),
}));
vi.mock("./whatsapp-credentials.server", () => ({
  isWhatsappCredentialStoreUnavailable: () => false,
  readWhatsappCredential: async () => {
    if (runtime.credentialError) throw runtime.credentialError;
    return null;
  },
}));
vi.mock("./whatsapp-provider.server", () => ({
  loadWhatsappProvider: async () => ({ sendTextMessage: runtime.sendTextMessage }),
}));

const { enqueuePostServiceMessage, processPostServiceMessages } =
  await import("./whatsapp-greeting.server");

beforeEach(() => {
  runtime.appointmentError = null;
  runtime.businessError = null;
  runtime.customerError = null;
  runtime.credentialError = null;
  runtime.selectedClients = null;
  runtime.appointment = {
    id: "appointment-1",
    business_id: "business-1",
    customer_id: null,
    customer_name: "Ana",
    customer_phone: "5511999990000",
    status: "concluido",
  };
  runtime.queueUpdates = [];
  runtime.insertCalls = 0;
  runtime.sendTextMessage.mockReset().mockResolvedValue(undefined);
});

describe("fila de mensagens pós-atendimento", () => {
  it("não trata erro ao ler appointment como ausência e não agenda silenciosamente", async () => {
    runtime.appointmentError = { message: "database unavailable" };

    await expect(enqueuePostServiceMessage("appointment-1", "business-1")).rejects.toThrow();
    expect(runtime.insertCalls).toBe(0);
  });

  it("mantém a fila pendente e libera o claim quando falha a leitura do appointment", async () => {
    runtime.appointmentError = { message: "database unavailable" };

    await expect(processPostServiceMessages()).resolves.toMatchObject({ pending: 1, skipped: 0 });
    expect(runtime.queueUpdates).toEqual([
      expect.objectContaining({ last_error: expect.any(String), locked_at: null }),
    ]);
    expect(runtime.queueUpdates[0]).not.toHaveProperty("processed_at");
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("mantém a fila pendente e libera o claim quando falha a leitura do business", async () => {
    runtime.businessError = { message: "database unavailable" };

    await expect(processPostServiceMessages()).resolves.toMatchObject({ pending: 1, skipped: 0 });
    expect(runtime.queueUpdates).toEqual([
      expect.objectContaining({ last_error: expect.any(String), locked_at: null }),
    ]);
    expect(runtime.queueUpdates[0]).not.toHaveProperty("processed_at");
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("mantém a fila pendente quando falha a leitura dos clientes selecionados", async () => {
    runtime.selectedClients = "customer-1";
    runtime.customerError = { message: "database unavailable" };

    await expect(processPostServiceMessages()).resolves.toMatchObject({ pending: 1, skipped: 0 });
    expect(runtime.queueUpdates[0]).toMatchObject({
      locked_at: null,
      last_error: expect.stringContaining("clientes selecionados"),
    });
    expect(runtime.queueUpdates[0]).not.toHaveProperty("processed_at");
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("mantém a fila pendente quando há erro real ao consultar a credencial", async () => {
    runtime.credentialError = new Error("database unavailable");

    await expect(processPostServiceMessages()).resolves.toMatchObject({ pending: 1, skipped: 0 });
    expect(runtime.queueUpdates[0]).toMatchObject({
      locked_at: null,
      last_error: expect.stringContaining("credencial WhatsApp"),
    });
    expect(runtime.queueUpdates[0]).not.toHaveProperty("processed_at");
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("encerra a fila somente quando a ausência do appointment é confirmada sem erro", async () => {
    runtime.appointment = null;

    await expect(processPostServiceMessages()).resolves.toMatchObject({ pending: 0, skipped: 1 });
    expect(runtime.queueUpdates[0]).toMatchObject({
      processed_at: expect.any(String),
      last_error: "atendimento não está concluído",
    });
  });
});
