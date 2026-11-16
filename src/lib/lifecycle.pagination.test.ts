import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  assertSuperAdmin: async () => runtime.fake!.client,
}));

const { getSubscriptionLifecycle } = await import("./lifecycle.functions");
const getLifecycle = getSubscriptionLifecycle as unknown as (arg: {
  context: unknown;
}) => Promise<{ items: Array<Record<string, unknown>> }>;

beforeEach(() => {
  const rows = (prefix: string) =>
    Array.from({ length: 20_001 }, (_, index) => ({
      id: `${prefix}-${index}`,
      business_id: BUSINESS_ID,
    }));
  runtime.fake = createFakeAdmin({
    businesses: [
      {
        id: BUSINESS_ID,
        name: "Studio",
        phone: "5511999990000",
        category: "Beleza",
        status: "ativo",
        created_at: new Date().toISOString(),
        owner_id: "owner-1",
        monthly_fee_cents: 8990,
        trial_days: null,
        trial_created_at: null,
        slug: "studio",
        cancel_requested_at: null,
        cancelled_at: null,
        sales_owner: null,
        access_until: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      },
    ],
    profiles: [],
    subscription_payments: [],
    appointments: rows("appointment"),
    services: rows("service"),
    professionals: rows("professional"),
    business_hours: rows("hours"),
  });
});

describe("paginação dos dados do lifecycle Master", () => {
  it("carrega todas as páginas das quatro fontes de contagem usadas no lifecycle", async () => {
    const result = await getLifecycle({ context: { userId: "master-1", claims: { aal: "aal2" } } });

    expect(result.items[0]).toMatchObject({ appointmentsCount: 20_001 });
    for (const table of ["appointments", "services", "professionals", "business_hours"]) {
      expect(runtime.fake!.calls.ranges).toContainEqual({
        table,
        from: 20_000,
        to: 20_999,
      });
    }
    for (const table of [
      "businesses",
      "profiles",
      "subscription_payments",
      "appointments",
      "services",
      "professionals",
      "business_hours",
    ]) {
      expect(runtime.fake!.calls.ranges).toContainEqual({ table, from: 0, to: 999 });
    }
  });
});
