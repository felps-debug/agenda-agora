import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverFnMock } from "@/test-support/fake-admin";

const runtime = vi.hoisted(() => ({
  professionalCount: 1 as number | null,
  professionalError: null as { message: string } | null,
  paymentsError: null as { message: string } | null,
  isSuper: false,
  safeBusinessSelects: [] as string[],
  adminBusinessSelects: [] as string[],
  adminReadTables: [] as string[],
  sessionReadTables: [] as string[],
  coupon: {
    coupon_code: "TESTE",
    coupon_percent: 10,
    coupon_expires_at: "2026-12-01T00:00:00.000Z",
  } as Record<string, unknown> | null,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  MASTER_ACCESS_DENIED: "Acesso restrito ao painel master.",
  hasSuperAdminRole: async () => runtime.isSuper,
  assertSuperAdmin: async () => {
    if (!runtime.isSuper) throw new Error("Acesso restrito ao painel master.");
    return {
      from: (table: string) => {
        if (table === "businesses")
          return {
            select: (columns: string) => {
              runtime.adminBusinessSelects.push(columns);
              return {
                eq: () => ({ maybeSingle: async () => ({ data: runtime.coupon, error: null }) }),
              };
            },
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        throw new Error(`Unexpected authorized table ${table}`);
      },
    };
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      runtime.adminReadTables.push(table);
      if (table === "businesses")
        return {
          select: (columns: string) => {
            runtime.adminBusinessSelects.push(columns);
            return {
              eq: () => ({ maybeSingle: async () => ({ data: runtime.coupon, error: null }) }),
            };
          },
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      if (table === "subscription_payments")
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
            }),
          }),
        };
      if (table === "professionals")
        return {
          select: () => ({
            eq: async () => ({
              count: runtime.professionalCount,
              error: runtime.professionalError,
            }),
          }),
        };
      throw new Error(`Unexpected admin table ${table}`);
    },
  },
}));

const { getBillingCycle, setBusinessCoupon, clearBusinessCoupon, getBusinessCoupon } =
  await import("./subscription.functions");
type Caller = (arg: { data: unknown; context: unknown }) => Promise<Record<string, unknown>>;
const getCycle = getBillingCycle as unknown as Caller;
const setCoupon = setBusinessCoupon as unknown as Caller;
const clearCoupon = clearBusinessCoupon as unknown as Caller;
const getCoupon = getBusinessCoupon as unknown as Caller;
const businessId = "11111111-1111-4111-8111-111111111111";

const context = {
  userId: "owner-1",
  claims: { aal: "aal1" },
  supabase: {
    from: (table: string) => {
      runtime.sessionReadTables.push(table);
      if (table === "businesses")
        return {
          select: (columns: string) => {
            runtime.safeBusinessSelects.push(columns);
            return {
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    owner_id: "owner-1",
                    monthly_fee_cents: 8990,
                    access_until: null,
                    cancel_requested_at: null,
                    cancelled_at: null,
                    trial_days: null,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      if (table === "subscription_payments")
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: runtime.paymentsError }),
                }),
              }),
            }),
          }),
        };
      if (table === "professionals")
        return {
          select: () => ({
            eq: async () => ({
              count: runtime.professionalCount,
              error: runtime.professionalError,
            }),
          }),
        };
      throw new Error(`Unexpected table ${table}`);
    },
  },
};

beforeEach(() => {
  runtime.professionalCount = 1;
  runtime.professionalError = null;
  runtime.paymentsError = null;
  runtime.isSuper = false;
  runtime.safeBusinessSelects = [];
  runtime.adminBusinessSelects = [];
  runtime.adminReadTables = [];
  runtime.sessionReadTables = [];
  runtime.coupon = {
    coupon_code: "TESTE",
    coupon_percent: 10,
    coupon_expires_at: "2026-12-01T00:00:00.000Z",
  };
});

describe("ações de cupom exigem role Master", () => {
  const masterContext = { ...context, userId: "master-1", claims: { aal: "aal1" } };

  beforeEach(() => {
    runtime.isSuper = true;
  });

  it("Master em AAL1 lê o ciclo de outro negócio", async () => {
    await expect(getCycle({ data: { businessId }, context: masterContext })).resolves.toMatchObject(
      {
        amountCents: 8990,
      },
    );
  });

  it("lê o ciclo com os dados privados via serviço", async () => {
    await expect(getCycle({ data: { businessId }, context: masterContext })).resolves.toMatchObject(
      { amountCents: 8990 },
    );
    expect(runtime.safeBusinessSelects[0]).not.toMatch(/coupon_/);
    expect(runtime.adminBusinessSelects).toContain(
      "coupon_code, coupon_percent, coupon_expires_at",
    );
    expect(runtime.adminReadTables).toEqual(
      expect.arrayContaining(["subscription_payments", "professionals"]),
    );
  });

  it("reads Master coupon data through the service client without MFA", async () => {
    await expect(
      getCoupon({ data: { businessId }, context: masterContext }),
    ).resolves.toMatchObject({ coupon: { code: "TESTE", percent: 10 } });
    expect(runtime.adminBusinessSelects).toContain(
      "coupon_code, coupon_percent, coupon_expires_at",
    );
  });

  it("permite ao Master criar, remover e consultar cupom sem MFA", async () => {
    await expect(
      setCoupon({
        data: { businessId, code: "TESTE", percent: 10, days: 1 },
        context: masterContext,
      }),
    ).resolves.toBeDefined();
    await expect(
      clearCoupon({ data: { businessId }, context: masterContext }),
    ).resolves.toBeDefined();
    await expect(
      getCoupon({ data: { businessId }, context: masterContext }),
    ).resolves.toMatchObject({
      coupon: { code: "TESTE", percent: 10 },
    });
  });
});

describe("getBillingCycle: contagem de profissionais", () => {
  it("expõe o mesmo preço calculado com a contagem validada", async () => {
    runtime.professionalCount = 3;
    await expect(getCycle({ data: { businessId }, context })).resolves.toMatchObject({
      professionalsCount: 3,
      amountCents: 10990,
    });
  });

  it("retorna erro em vez de mostrar o preço base quando a contagem falha", async () => {
    runtime.professionalCount = null;
    runtime.professionalError = { message: "falha na contagem" };
    await expect(getCycle({ data: { businessId }, context })).rejects.toThrow(
      "Não foi possível calcular o valor da assinatura.",
    );
  });

  it("nao mostra historico vazio quando a consulta de pagamentos falha", async () => {
    runtime.paymentsError = { message: "falha no historico" };
    await expect(getCycle({ data: { businessId }, context })).rejects.toThrow(
      "Não foi possível consultar o histórico de pagamentos.",
    );
  });
});
