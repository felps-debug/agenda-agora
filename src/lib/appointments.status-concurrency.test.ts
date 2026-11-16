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
const { setAppointmentStatus } = await import("./appointments.functions");
const setStatus = setAppointmentStatus as unknown as (arg: {
  data: { id: string; status: "confirmado" };
  context: unknown;
}) => Promise<{ ok: true }>;

const appointmentId = "7b1b0e0e-5b7a-4c1f-8a53-0e9d2f6c1a11";

beforeEach(() => {
  runtime.fake = createFakeAdmin({
    appointments: [{ id: appointmentId, business_id: "business-1", status: "agendado" }],
  });
});

describe("setAppointmentStatus concorrente", () => {
  it("nao aplica uma transicao neutra quando o status mudou depois da autorizacao", async () => {
    const fake = runtime.fake!;
    const staleAppointment = {
      id: appointmentId,
      business_id: "business-1",
      status: "agendado",
    };
    const query: Record<string, unknown> = {};
    query["select"] = () => query;
    query["eq"] = () => query;
    query["maybeSingle"] = async () => {
      fake.tables["appointments"]![0]!["status"] = "cancelado";
      return { data: staleAppointment, error: null };
    };
    const context = {
      supabase: {
        from: () => query,
        rpc: async () => ({ data: true, error: null }),
      },
    };

    await expect(
      setStatus({ data: { id: appointmentId, status: "confirmado" }, context }),
    ).rejects.toThrow("O agendamento mudou; atualize a tela e tente novamente.");
    expect(fake.tables["appointments"]![0]!["status"]).toBe("cancelado");
  });
});
