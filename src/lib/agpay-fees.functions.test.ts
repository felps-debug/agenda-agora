import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => runtime.fake!.client.from(table) },
}));

await import("@/integrations/supabase/client.server");
const { getAgpayFees, saveAgpayFees, DEFAULT_PLATFORM_FEES } =
  await import("./agpay-fees.functions");
const read = getAgpayFees as unknown as (arg: {
  context: unknown;
}) => Promise<Record<string, number>>;
const save = saveAgpayFees as unknown as (arg: {
  data: unknown;
  context: unknown;
}) => Promise<{ ok: true }>;

const master = { userId: "master-1", claims: {} };
const owner = { userId: "dono-1", claims: {} };

beforeEach(() => {
  runtime.fake = createFakeAdmin({
    user_roles: [
      { user_id: "master-1", role: "super_admin" },
      { user_id: "dono-1", role: "owner" },
    ],
  });
});

describe("taxas do Ag Pay no servidor (US5)", () => {
  it("valores iniciais: R$ 0,75 no depósito e R$ 3,00 no saque", async () => {
    expect(DEFAULT_PLATFORM_FEES).toEqual({ deposit_fixed_cents: 75, withdraw_fixed_cents: 300 });
    await expect(read({ context: master })).resolves.toEqual({
      deposit_fixed_cents: 75,
      withdraw_fixed_cents: 300,
    });
  });

  it("só o master lê", async () => {
    await expect(read({ context: owner })).rejects.toThrow("Acesso restrito ao painel master.");
  });

  it("só o master grava", async () => {
    await expect(
      save({ data: { deposit_fixed_cents: 100, withdraw_fixed_cents: 400 }, context: owner }),
    ).rejects.toThrow("Acesso restrito ao painel master.");
    expect(runtime.fake!.calls.upserts).toHaveLength(0);
  });

  it("grava e devolve o mesmo valor em outra leitura (outro navegador)", async () => {
    await save({ data: { deposit_fixed_cents: 100, withdraw_fixed_cents: 400 }, context: master });
    const row = runtime.fake!.calls.upserts[0]!;
    expect(row.table).toBe("platform_settings");
    expect(row.row).toMatchObject({ key: "agpay_fees", updated_by: "master-1" });
    runtime.fake!.tables["platform_settings"] = [{ key: "agpay_fees", value: row.row["value"] }];
    await expect(read({ context: master })).resolves.toEqual({
      deposit_fixed_cents: 100,
      withdraw_fixed_cents: 400,
    });
  });

  it.each([
    [{ deposit_fixed_cents: -1, withdraw_fixed_cents: 300 }],
    [{ deposit_fixed_cents: 75.5, withdraw_fixed_cents: 300 }],
    [{ deposit_fixed_cents: 75, withdraw_fixed_cents: "300" }],
    [{ deposit_fixed_cents: 75 }],
  ])("recusa valor inválido %j", async (data) => {
    await expect(save({ data, context: master })).rejects.toThrow();
    expect(runtime.fake!.calls.upserts).toHaveLength(0);
  });

  it("aceita zero", async () => {
    await expect(
      save({ data: { deposit_fixed_cents: 0, withdraw_fixed_cents: 0 }, context: master }),
    ).resolves.toEqual({ ok: true });
  });
});
