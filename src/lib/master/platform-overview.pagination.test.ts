import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  assertSuperAdmin: async () => runtime.fake!.client,
}));

const { getPlatformOverview } = await import("./platform-overview.functions");
const getOverview = getPlatformOverview as unknown as (arg: {
  context: unknown;
}) => Promise<Record<string, unknown>>;

beforeEach(() => {
  runtime.fake = createFakeAdmin({
    businesses: [],
    profiles: [],
    appointments: [],
    subscription_payments: [],
    services: [],
    professionals: [],
    business_hours: [],
    customers: [],
    deposit_payments: [],
    master_business_events: [],
    master_business_notes: [],
  });
});

describe("paginação da visão geral Master", () => {
  it("pede páginas para cada fonte que alimenta KPIs e indicadores", async () => {
    const result = await getOverview({ context: { userId: "master-1", claims: { aal: "aal2" } } });
    expect(result).toBeDefined();

    for (const table of [
      "businesses",
      "profiles",
      "appointments",
      "subscription_payments",
      "services",
      "professionals",
      "business_hours",
      "customers",
      "deposit_payments",
    ]) {
      expect(runtime.fake!.calls.ranges).toContainEqual({ table, from: 0, to: 999 });
    }
  });
});
