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
const { createBroadcast } = await import("./broadcasts.functions");
const create = createBroadcast as unknown as (arg: {
  data: unknown;
  context: unknown;
}) => Promise<{ ok: true }>;

const master = { userId: "master-1", claims: { aal: "aal2" } };
const input = {
  title: "Aviso segmentado",
  message: "Mensagem para profissionais especificos",
  audiences: ["assinantes"],
  displayDays: 3,
};

beforeEach(() => {
  runtime.fake = createFakeAdmin({
    user_roles: [{ user_id: "master-1", role: "super_admin" }],
  });
});

describe("createBroadcast", () => {
  it("falha fechado quando o schema nao tem colunas de audiencia", async () => {
    runtime.fake!.failureSequences["broadcasts:insert"] = [
      { code: "42703", message: "column broadcasts.audiences does not exist" },
      null,
    ];

    await expect(create({ data: input, context: master })).rejects.toThrow(
      "column broadcasts.audiences does not exist",
    );
    expect(runtime.fake!.calls.inserts).toHaveLength(0);
  });
});
