import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const SECRET = "s".repeat(48);

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({ assertSuperAdmin: vi.fn() }));
vi.mock("@/lib/env-security.server", () => ({ getSdrTokenSecret: () => SECRET }));
vi.mock("@/lib/rate-limit.server", () => ({ clientIp: () => "203.0.113.7" }));
vi.mock("@/lib/login-attempts.server", () => ({
  checkLock: vi.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  registerFailure: vi.fn(async () => ({ locked: false, retryAfterSeconds: 0 })),
  registerSuccess: vi.fn(async () => undefined),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => runtime.fake!.client.from(table),
    auth: {
      admin: {
        createUser: (attrs: { email: string; password: string }) =>
          runtime.fake!.client.auth.admin.createUser(attrs),
        updateUserById: (id: string, attrs: Record<string, unknown>) =>
          runtime.fake!.client.auth.admin.updateUserById(id, attrs),
      },
    },
  },
}));

// Aquece o módulo mockado: importações dinâmicas simultâneas podem carregar o real.
await import("@/integrations/supabase/client.server");
const { sdrCreateBusiness } = await import("./sdr.functions");
const { signSdrToken } = await import("./sdr-token");

const call = sdrCreateBusiness as unknown as (arg: { data: unknown }) => Promise<{
  businessId: string;
  slug: string;
  phone: string;
  initialPassword: string;
}>;

function input(overrides: Record<string, unknown> = {}) {
  return {
    token: signSdrToken("sdr-1", SECRET),
    businessName: "Barbearia do Zé",
    category: "barbearia",
    ownerName: "Zé da Silva",
    phone: "(11) 98154-9276",
    password: "senha-forte",
    trialDays: 7,
    ...overrides,
  };
}

beforeEach(() => {
  runtime.fake = createFakeAdmin({
    sdrs: [{ id: "sdr-1", name: "Ana", email: "ana@x.com", active: true, pin: "x" }],
  });
});

describe("sdrCreateBusiness: criação do dono (brecha C1)", () => {
  it("cria o dono e o negócio com telefone novo e devolve a senha inicial uma única vez", async () => {
    const result = await call({ data: input() });
    expect(result).toMatchObject({ phone: "11981549276", initialPassword: "senha-forte" });
    expect(runtime.fake!.calls.authCreates).toHaveLength(1);
    expect(runtime.fake!.calls.authCreates[0]!.email).toBe("11981549276@agenda.local");
    expect(runtime.fake!.calls.inserts.filter((i) => i.table === "businesses")).toHaveLength(1);
    expect(runtime.fake!.calls.inserts[0]!.row["sdr_id"]).toBe("sdr-1");
  });

  it("telefone já cadastrado retorna PHONE_ALREADY_REGISTERED e não troca a senha de ninguém", async () => {
    runtime.fake!.seedAuthUser("11981549276@agenda.local", "user-existente");
    await expect(call({ data: input() })).rejects.toThrow("PHONE_ALREADY_REGISTERED");
    expect(runtime.fake!.calls.authUpdates).toHaveLength(0);
    expect(runtime.fake!.calls.inserts.filter((i) => i.table === "businesses")).toHaveLength(0);
  });

  it("duas chamadas concorrentes com o mesmo telefone: só uma cria o dono", async () => {
    // O segundo pedido sai logo depois do primeiro, com o primeiro ainda em andamento.
    const first = call({ data: input() });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = call({ data: input() });
    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]!.reason.message)).toBe("PHONE_ALREADY_REGISTERED");
    expect(runtime.fake!.calls.authUpdates).toHaveLength(0);
    expect(runtime.fake!.calls.inserts.filter((i) => i.table === "businesses")).toHaveLength(1);
  });

  it("outro erro do Auth não vaza detalhes nem cria negócio", async () => {
    runtime.fake!.failAuthCreate({ code: "unexpected_failure", message: "db password leak?" });
    await expect(call({ data: input() })).rejects.toThrow(
      "Não foi possível criar o acesso do dono.",
    );
    expect(runtime.fake!.calls.inserts.filter((i) => i.table === "businesses")).toHaveLength(0);
  });

  it("recusa token inválido", async () => {
    await expect(call({ data: input({ token: "x".repeat(40) }) })).rejects.toThrow(
      /Sessão expirada/,
    );
    expect(runtime.fake!.calls.authCreates).toHaveLength(0);
  });
});
