import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverFnMock } from "@/test-support/fake-admin";

const runtime = vi.hoisted(() => ({
  businessUpdateError: null as { message: string } | null,
  approvalUpdate: null as Record<string, unknown> | null,
}));

const approvalId = "11111111-1111-4111-8111-111111111111";
const businessId = "22222222-2222-4222-8222-222222222222";

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  assertSuperAdmin: async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "pix_key_approvals" ? { business_id: businessId } : null,
          }),
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          if (table === "pix_key_approvals") runtime.approvalUpdate = values;
          return {
            error: table === "businesses" ? runtime.businessUpdateError : null,
          };
        },
      }),
    }),
  }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { business_id: businessId } }) }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          if (table === "pix_key_approvals") runtime.approvalUpdate = values;
          return {
            error: table === "businesses" ? runtime.businessUpdateError : null,
          };
        },
      }),
    }),
  },
}));

const { setPixKeyApprovalStatus } = await import("./pix-approvals.functions");
type Caller = (arg: { data: unknown; context: unknown }) => Promise<unknown>;
const setStatus = setPixKeyApprovalStatus as unknown as Caller;
const context = { userId: "admin-1", claims: {} };

beforeEach(() => {
  runtime.businessUpdateError = null;
  runtime.approvalUpdate = null;
});

describe("setPixKeyApprovalStatus", () => {
  it("comunica a falha parcial quando aprova a chave mas nao consegue liberar a carteira", async () => {
    runtime.businessUpdateError = { message: "falha ao atualizar negocio" };

    await expect(
      setStatus({ data: { id: approvalId, status: "aprovado" }, context }),
    ).rejects.toThrow("Chave aprovada, mas não foi possível remover o bloqueio de acesso AG Pay.");
    expect(runtime.approvalUpdate).toMatchObject({ status: "aprovado" });
  });

  it("conclui aprovacao e desbloqueio quando ambas as gravacoes funcionam", async () => {
    await expect(
      setStatus({ data: { id: approvalId, status: "aprovado" }, context }),
    ).resolves.toEqual({ ok: true });
  });
});
