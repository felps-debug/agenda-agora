import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverFnMock } from "@/test-support/fake-admin";

/**
 * US6 — Envio de mensagem de teste do WhatsApp em Integrações.
 * Cobre: sucesso (provedor chamado), não conectado (erro claro) e validação
 * de número inválido (schema). O provedor e o store de credenciais são mockados.
 */

const runtime = vi.hoisted(() => ({
  biz: null as Record<string, unknown> | null,
  credential: null as { instanceId: string; instanceToken: string } | null,
  sendTextMessage: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  assertSuperAdmin: vi.fn(),
  hasSuperAdminRole: vi.fn().mockResolvedValue(false),
}));
vi.mock("./whatsapp-credentials.server", () => ({
  readWhatsappCredential: vi.fn(async () => runtime.credential),
  isWhatsappCredentialStoreUnavailable: () => true,
}));
vi.mock("./whatsapp-notify.server", () => ({
  renderMessage: (template: string) => template,
}));
vi.mock("./whatsapp-provider.server", () => ({
  loadWhatsappProvider: async () => ({ sendTextMessage: runtime.sendTextMessage }),
}));

const { sendTestMessage } = await import("./whatsapp.functions");

type Caller = (arg: { data: unknown; context: unknown }) => Promise<unknown>;
const send = sendTestMessage as unknown as Caller;

const businessId = "11111111-1111-4111-8111-111111111111";
const context = {
  userId: "dono-1",
  claims: {},
  supabase: {
    rpc: vi.fn(async () => ({ data: true, error: null })),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: runtime.biz, error: null }),
        }),
      }),
    }),
  },
};

beforeEach(() => {
  runtime.sendTextMessage.mockReset();
  runtime.credential = { instanceId: "inst-1", instanceToken: "tok-1" };
  runtime.biz = {
    id: businessId,
    name: "Barbearia X",
    whatsapp_instance: "inst-1",
    whatsapp_status: "connected",
    whatsapp_instance_id: "inst-1",
    whatsapp_instance_token: "tok-1",
  };
  context.supabase.rpc.mockResolvedValue({ data: true, error: null });
});

describe("sendTestMessage (US6)", () => {
  it("envia a mensagem de teste pelo provedor quando conectado", async () => {
    await expect(
      send({
        data: { businessId, phone: "5511999999999", template: "Teste {{negocio}}" },
        context,
      }),
    ).resolves.toEqual({ ok: true });
    expect(runtime.sendTextMessage).toHaveBeenCalledWith(
      "tok-1",
      "5511999999999",
      expect.any(String),
    );
  });

  it("erro claro quando o WhatsApp não está conectado", async () => {
    runtime.biz = { ...runtime.biz!, whatsapp_instance: null };
    runtime.credential = null;
    await expect(
      send({ data: { businessId, phone: "5511999999999", template: "Teste" }, context }),
    ).rejects.toThrow(/Conecte o WhatsApp/i);
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });

  it("recusa número inválido na validação de entrada (Zod)", async () => {
    await expect(
      send({ data: { businessId, phone: "123", template: "Teste" }, context }),
    ).rejects.toThrow();
    expect(runtime.sendTextMessage).not.toHaveBeenCalled();
  });
});
