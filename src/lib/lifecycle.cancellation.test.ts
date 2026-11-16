import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverFnMock } from "@/test-support/fake-admin";

const runtime = vi.hoisted(() => ({
  adminFrom: vi.fn(),
  businessUpdate: vi.fn(),
  auditError: null as { message: string } | null,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  assertSuperAdmin: async () => ({ from: runtime.adminFrom }),
}));

const { setBusinessCancellation } = await import("./lifecycle.functions");
const cancelBusiness = setBusinessCancellation as unknown as (args: {
  data: { businessId: string; action: "solicitar" | "efetivar" | "reverter" };
  context: { userId: string };
}) => Promise<{ ok: true }>;

const businessId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
  runtime.auditError = null;
  const businessQuery = { eq: async () => ({ error: null }) };
  runtime.businessUpdate.mockReturnValue(businessQuery);
  runtime.adminFrom.mockImplementation((table: string) =>
    table === "businesses"
      ? { update: runtime.businessUpdate }
      : { insert: async () => ({ error: runtime.auditError }) },
  );
});

describe("setBusinessCancellation", () => {
  it("reverter limpa datas e restaura status ativo", async () => {
    await expect(
      cancelBusiness({
        data: { businessId, action: "reverter" },
        context: { userId: "master-user" },
      }),
    ).resolves.toEqual({ ok: true });

    expect(runtime.businessUpdate).toHaveBeenCalledWith({
      status: "ativo",
      cancel_requested_at: null,
      cancelled_at: null,
    });
  });

  it("não informa sucesso se o evento obrigatório falhar depois da alteração", async () => {
    runtime.auditError = { message: "offline" };
    await expect(
      cancelBusiness({
        data: { businessId, action: "efetivar" },
        context: { userId: "master-user" },
      }),
    ).rejects.toThrow(/alteração foi aplicada.*auditoria/i);
    expect(runtime.businessUpdate).toHaveBeenCalledWith({ cancelled_at: expect.any(String) });
  });
});
