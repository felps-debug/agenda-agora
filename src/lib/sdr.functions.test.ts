import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, scryptSync } from "node:crypto";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const SECRET = "s".repeat(48);

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
  authDeletes: [] as string[],
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  assertSuperAdmin: async () => runtime.fake!.client,
}));
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
        deleteUser: async (id: string) => {
          runtime.authDeletes.push(id);
          return { data: { user: { id } }, error: null };
        },
      },
    },
  },
}));

// Aquece o módulo mockado: importações dinâmicas simultâneas podem carregar o real.
await import("@/integrations/supabase/client.server");
const { sdrCreateBusiness, sdrLogin, sdrLogout, updateSdr, createSdrTemporaryPassword } =
  await import("./sdr.functions");
const { signSdrToken, verifySdrTokenClaims } = await import("./sdr-token");

const call = sdrCreateBusiness as unknown as (arg: { data: unknown }) => Promise<{
  businessId: string;
  slug: string;
  phone: string;
  initialPassword: string;
}>;
const updateCall = updateSdr as unknown as (arg: {
  context: unknown;
  data: unknown;
}) => Promise<unknown>;
const logoutCall = sdrLogout as unknown as (arg: { data: unknown }) => Promise<unknown>;
const loginCall = sdrLogin as unknown as (arg: {
  data: unknown;
}) => Promise<{ token: string; name: string }>;

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
  runtime.authDeletes = [];
  runtime.fake = createFakeAdmin({
    sdrs: [
      { id: "sdr-1", name: "Ana", email: "ana@x.com", active: true, session_version: 0, pin: "x" },
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Bia",
        email: "old@example.test",
        active: true,
        session_version: 0,
        pin: "scrypt$existing$hash",
      },
    ],
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

  it("fails closed and deletes new Auth user when owner role write fails", async () => {
    runtime.fake!.failures["user_roles:upsert"] = { code: "db_error", message: "role failed" };

    await expect(call({ data: input() })).rejects.toThrow();

    expect(runtime.authDeletes).toEqual(["user-1"]);
    expect(runtime.fake!.calls.inserts.filter((row) => row.table === "businesses")).toHaveLength(0);
  });

  it("compensates role and Auth when business insert fails and absence is confirmed", async () => {
    runtime.fake!.failures["businesses:insert"] = { code: "db_error", message: "business failed" };

    await expect(call({ data: input() })).rejects.toThrow("business failed");

    expect(runtime.fake!.calls.deletes.some((row) => row.table === "user_roles")).toBe(true);
    expect(runtime.authDeletes).toEqual(["user-1"]);
  });

  it("recusa token inválido", async () => {
    await expect(call({ data: input({ token: "x".repeat(40) }) })).rejects.toThrow(
      /Sessão expirada/,
    );
    expect(runtime.fake!.calls.authCreates).toHaveLength(0);
  });
});

describe("senha temporária de reset pelo SDR", () => {
  it("sempre usa um formato aceito pelo login, mesmo se o sufixo aleatório não tiver dígitos", async () => {
    const { resolveLoginCredentials, fallbackLoginPassword } = await import("./auth/login-flow");
    const temporaryPassword = createSdrTemporaryPassword("abcdefghijklmnopqrstuvwx");
    const credentials = resolveLoginCredentials("(11) 90000-0000", temporaryPassword);
    expect(credentials.kind).toBe("owner");
    expect(fallbackLoginPassword(credentials, temporaryPassword)).toBe(
      `agendaagora:${temporaryPassword}`,
    );
  });
});

describe("updateSdr credential changes", () => {
  it("requires a new scrypt PIN when the stored credential is a legacy SHA-256 hash", async () => {
    runtime.fake!.tables["sdrs"]![1]!["pin"] = createHash("sha256")
      .update("old@example.test::1234")
      .digest("hex");

    await expect(
      updateCall({
        context: {},
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Bia Lima",
          email: "old@example.test",
          pin: "",
          signupGoal: 1,
          salesGoal: 0,
          commissionCents: 0,
          active: true,
        },
      }),
    ).rejects.toThrow(/legacy PIN must be reset/i);

    expect(runtime.fake!.calls.updates.filter((row) => row.table === "sdrs")).toHaveLength(0);
  });

  it("replaces a legacy PIN with a scrypt hash and revokes existing sessions", async () => {
    runtime.fake!.tables["sdrs"]![1]!["pin"] = createHash("sha256")
      .update("old@example.test::1234")
      .digest("hex");

    await updateCall({
      context: {},
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Bia Lima",
        email: "old@example.test",
        pin: "5678",
        signupGoal: 1,
        salesGoal: 0,
        commissionCents: 0,
        active: true,
      },
    });

    const update = runtime.fake!.calls.updates.find((row) => row.table === "sdrs");
    expect(String(update?.patch["pin"])).toMatch(/^scrypt\$/);
    expect(update?.patch["session_version"]).toBe(1);
  });

  it("requires a replacement PIN when the login email changes", async () => {
    await expect(
      updateCall({
        context: {},
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Bia",
          email: "new@example.test",
          pin: "",
          signupGoal: 0,
          salesGoal: 0,
          commissionCents: 0,
          active: true,
        },
      }),
    ).rejects.toThrow("A new PIN is required when changing the login email.");

    expect(runtime.fake!.calls.updates.filter((row) => row.table === "sdrs")).toHaveLength(0);
  });

  it("accepts the email change when a new PIN is supplied", async () => {
    await updateCall({
      context: {},
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Bia",
        email: "new@example.test",
        pin: "1234",
        signupGoal: 0,
        salesGoal: 0,
        commissionCents: 0,
        active: true,
      },
    });

    const update = runtime.fake!.calls.updates.find((row) => row.table === "sdrs");
    expect(update?.patch["email"]).toBe("new@example.test");
    expect(String(update?.patch["pin"])).toMatch(/^scrypt\$/);
  });

  it("allows editing other fields without changing the email or PIN", async () => {
    await updateCall({
      context: {},
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Bia Lima",
        email: "old@example.test",
        pin: "",
        signupGoal: 1,
        salesGoal: 0,
        commissionCents: 0,
        active: true,
      },
    });

    const update = runtime.fake!.calls.updates.find((row) => row.table === "sdrs");
    expect(update?.patch["name"]).toBe("Bia Lima");
    expect(update?.patch).not.toHaveProperty("pin");
  });
});

describe("SDR session revocation", () => {
  it("does not authenticate with a PIN stored in the legacy fast-hash format", async () => {
    runtime.fake!.tables["sdrs"]![0]!["pin"] = createHash("sha256")
      .update("ana@x.com::1234")
      .digest("hex");

    await expect(loginCall({ data: { email: "ana@x.com", pin: "1234" } })).rejects.toThrow(
      /PIN_RESET_REQUIRED/,
    );
    expect(runtime.fake!.calls.updates.filter((row) => row.table === "sdrs")).toHaveLength(0);
  });

  it("signs new login tokens with the stored session version", async () => {
    const salt = "ab".repeat(16);
    const hash = scryptSync("ana@x.com::1234", salt, 64).toString("hex");
    runtime.fake!.tables["sdrs"]![0]!["pin"] = `scrypt$${salt}$${hash}`;
    runtime.fake!.tables["sdrs"]![0]!["session_version"] = 7;

    const result = await loginCall({ data: { email: "ana@x.com", pin: "1234" } });

    expect(verifySdrTokenClaims(result.token, SECRET)).toMatchObject({
      sdrId: "sdr-1",
      sessionVersion: 7,
    });
  });

  it("rejects a previously signed token after the stored session version changes", async () => {
    const oldToken = signSdrToken("sdr-1", SECRET);
    runtime.fake!.tables["sdrs"]![0]!["session_version"] = 1;

    await expect(call({ data: input({ token: oldToken }) })).rejects.toThrow(/Sess.*expirada/);
    expect(runtime.fake!.calls.inserts.filter((row) => row.table === "businesses")).toHaveLength(0);
  });

  it("logout increments the session version and revokes the current token", async () => {
    const token = signSdrToken("sdr-1", SECRET);

    await logoutCall({ data: { token } });

    expect(runtime.fake!.tables["sdrs"]![0]!["session_version"]).toBe(1);
    await expect(call({ data: input({ token }) })).rejects.toThrow(/Sess.*expirada/);
  });
});

describe("SDR credential session version", () => {
  it("increments the version when email or PIN credentials change", async () => {
    await updateCall({
      context: {},
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Bia",
        email: "new@example.test",
        pin: "1234",
        signupGoal: 0,
        salesGoal: 0,
        commissionCents: 0,
        active: true,
      },
    });

    const update = runtime.fake!.calls.updates.find((row) => row.table === "sdrs");
    expect(update?.patch["session_version"]).toBe(1);
    expect(runtime.fake!.tables["sdrs"]![1]!["session_version"]).toBe(1);
  });
});

describe("credential changes revoke signed SDR sessions", () => {
  it("rejects a token that predates an email and PIN update", async () => {
    const oldToken = signSdrToken("11111111-1111-4111-8111-111111111111", SECRET);
    await updateCall({
      context: {},
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Bia",
        email: "new@example.test",
        pin: "1234",
        signupGoal: 0,
        salesGoal: 0,
        commissionCents: 0,
        active: true,
      },
    });

    await expect(call({ data: input({ token: oldToken }) })).rejects.toThrow(/Sess.*expirada/);
  });

  it("increments the version when a SDR is disabled", async () => {
    await updateCall({
      context: {},
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Bia",
        email: "old@example.test",
        pin: "",
        signupGoal: 0,
        salesGoal: 0,
        commissionCents: 0,
        active: false,
      },
    });

    expect(runtime.fake!.tables["sdrs"]![1]!["session_version"]).toBe(1);
  });
});
