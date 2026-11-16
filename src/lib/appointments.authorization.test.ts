import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverFnMock } from "@/test-support/fake-admin";

const runtime = vi.hoisted(() => ({
  adminFrom: vi.fn(),
  adminUpdate: vi.fn(),
  updateData: null as null | { id: string },
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: runtime.adminFrom },
}));

const { setAppointmentStatus } = await import("./appointments.functions");
const updateStatus = setAppointmentStatus as unknown as (arg: {
  data: { id: string; status: string };
  context: {
    supabase: {
      from: (table: string) => unknown;
      rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    };
  };
}) => Promise<unknown>;

const appointmentId = "44444444-4444-4444-8444-444444444444";
const businessId = "33333333-3333-4333-8333-333333333333";

function setup(
  permissions: Record<string, boolean>,
  options: { status?: string; updateData?: { id: string } | null } = {},
) {
  runtime.updateData =
    options.updateData === undefined ? { id: appointmentId } : options.updateData;
  const rowQuery = {
    select: () => rowQuery,
    eq: () => rowQuery,
    maybeSingle: async () => ({
      data: { id: appointmentId, business_id: businessId, status: options.status ?? "bloqueado" },
      error: null,
    }),
  };
  const updateQuery = {
    eq: vi.fn(() => updateQuery),
    select: vi.fn(() => updateQuery),
    maybeSingle: async () => ({ data: runtime.updateData, error: null }),
  };
  const adminUpdate = vi.fn(() => updateQuery);
  runtime.adminUpdate = adminUpdate;
  runtime.adminFrom.mockReturnValue({ update: adminUpdate });
  const supabase = {
    from: vi.fn(() => rowQuery),
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => ({
      data:
        name === "is_business_member"
          ? true
          : (permissions[String(args["_permission"] ?? "")] ?? false),
      error: null,
    })),
  };
  return { supabase, adminUpdate };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setAppointmentStatus: bloqueios de agenda", () => {
  it("recusa converter bloqueio sem permissao mesmo quando e membro do negocio", async () => {
    const { supabase, adminUpdate } = setup({});

    await expect(
      updateStatus({
        data: { id: appointmentId, status: "agendado" },
        context: { supabase },
      }),
    ).rejects.toThrow("Voc\u00ea n\u00e3o tem permiss\u00e3o");

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it("permite operacao com a permissao legada block_agenda", async () => {
    const { supabase, adminUpdate } = setup({ block_agenda: true });

    await expect(
      updateStatus({
        data: { id: appointmentId, status: "agendado" },
        context: { supabase },
      }),
    ).resolves.toEqual({ ok: true });

    expect(adminUpdate).toHaveBeenCalledWith({ status: "agendado" });
  });

  it("nao sobrescreve status terminal se ele mudou depois da autorizacao", async () => {
    const { supabase, adminUpdate } = setup({}, { status: "agendado", updateData: null });

    await expect(
      updateStatus({
        data: { id: appointmentId, status: "confirmado" },
        context: { supabase },
      }),
    ).rejects.toThrow("mudou");

    expect(adminUpdate).toHaveBeenCalledWith({ status: "confirmado" });
  });
});
