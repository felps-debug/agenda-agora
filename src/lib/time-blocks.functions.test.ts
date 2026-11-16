import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverFnMock } from "@/test-support/fake-admin";

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

const { createTimeBlock } = await import("./time-blocks.functions");
const callCreateTimeBlock = createTimeBlock as unknown as (args: {
  data: {
    businessId: string;
    recurring: boolean;
    weekday: number | null;
    blockDate: string | null;
    startsAt: string;
    endsAt: string;
    reason: string | null;
    professionalId?: string | null;
  };
  context: { userId: string; supabase: ReturnType<typeof makeSupabase> };
}) => Promise<{ ok: true }>;

const businessId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";

function makeSupabase(permissions: Record<string, boolean>) {
  const insert = vi.fn(async () => ({ error: null }));
  const businessQuery = {
    select: () => businessQuery,
    eq: () => businessQuery,
    maybeSingle: async () => ({ data: { id: businessId }, error: null }),
  };
  return {
    from: vi.fn((table: string) => (table === "businesses" ? businessQuery : { insert })),
    rpc: vi.fn(async (_name: string, args: Record<string, unknown>) => ({
      data: permissions[String(args["_permission"] ?? "")] ?? false,
      error: null,
    })),
    insert,
  };
}

const blockInput = {
  businessId,
  recurring: false,
  weekday: null,
  blockDate: "2026-11-15",
  startsAt: "09:00",
  endsAt: "10:00",
  reason: "Teste isolado",
};

beforeEach(() => vi.clearAllMocks());

describe("createTimeBlock permissions", () => {
  it.each(["block_schedule", "block_agenda"])("permits staff with %s", async (permission) => {
    const supabase = makeSupabase({ [permission]: true });

    await expect(
      callCreateTimeBlock({ data: blockInput, context: { userId, supabase } }),
    ).resolves.toEqual({ ok: true });

    expect(supabase.insert).toHaveBeenCalledOnce();
  });

  it("rejects a staff member without either block permission", async () => {
    const supabase = makeSupabase({});

    await expect(
      callCreateTimeBlock({ data: blockInput, context: { userId, supabase } }),
    ).rejects.toThrow("Permissao insuficiente");

    expect(supabase.insert).not.toHaveBeenCalled();
  });
});
