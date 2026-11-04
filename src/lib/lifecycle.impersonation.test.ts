import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const BUSINESS_ID = "7b1b0e0e-5b7a-4c1f-8a53-0e9d2f6c1a11";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
  generateLink: vi.fn(),
  pinOk: false,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/env-security.server", () => ({
  getAllowedAppOrigins: () => new Set(["https://app.agendagora.test"]),
}));
vi.mock("@/lib/impersonation-pin.server", () => ({
  masterReturnPinMatches: () => runtime.pinOk,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => runtime.fake!.client.from(table),
    auth: {
      admin: {
        generateLink: (args: unknown) => runtime.generateLink(args),
        createUser: vi.fn(async () => ({ data: { user: { id: "novo" } }, error: null })),
      },
    },
  },
}));

await import("@/integrations/supabase/client.server");
const { impersonateBusinessOwner, returnToMasterSession } = await import("./lifecycle.functions");

const impersonate = impersonateBusinessOwner as unknown as (arg: {
  data: unknown;
  context: unknown;
}) => Promise<{ accessToken: string; refreshToken: string; impersonationToken: string }>;
const giveBack = returnToMasterSession as unknown as (arg: {
  data: unknown;
  context: unknown;
}) => Promise<{ accessToken: string; refreshToken: string }>;

const master = { userId: "master-1", claims: { aal: "aal1" } };
const owner = { userId: "dono-1", claims: { aal: "aal1" } };
const ORIGIN = "https://app.agendagora.test";

beforeEach(() => {
  runtime.pinOk = false;
  runtime.fake = createFakeAdmin({
    user_roles: [{ user_id: "master-1", role: "super_admin" }],
    businesses: [{ id: BUSINESS_ID, name: "Barbearia", owner_id: "dono-1", phone: "11981549276" }],
    profiles: [
      { id: "dono-1", email: "11981549276@agenda.local" },
      { id: "master-1", email: "master@agendagora.test" },
    ],
  });
  runtime.generateLink.mockReset();
  runtime.generateLink.mockResolvedValue({
    data: { properties: { action_link: "https://supabase.test/verify?token=abc" } },
    error: null,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: `${ORIGIN}/painel#access_token=at-123&refresh_token=rt-456` },
        }),
    ),
  );
});

describe("impersonação do master (US2)", () => {
  it("recusa origin fora de ALLOWED_APP_ORIGINS sem criar auditoria nem sessão", async () => {
    await expect(
      impersonate({
        data: { businessId: BUSINESS_ID, origin: "https://evil.example" },
        context: master,
      }),
    ).rejects.toThrow("ORIGIN_NOT_ALLOWED");
    expect(runtime.generateLink).not.toHaveBeenCalled();
    expect(runtime.fake!.calls.inserts).toHaveLength(0);
  });

  it("recusa origin que nem é uma URL", async () => {
    await expect(
      impersonate({ data: { businessId: BUSINESS_ID, origin: "não é url" }, context: master }),
    ).rejects.toThrow("ORIGIN_NOT_ALLOWED");
    expect(runtime.fake!.calls.inserts).toHaveLength(0);
  });

  it("falha ao gravar a auditoria: AUDIT_FAILED e nenhuma sessão criada", async () => {
    runtime.fake!.failures["master_business_events:insert"] = { message: "indisponível" };
    await expect(
      impersonate({ data: { businessId: BUSINESS_ID, origin: ORIGIN }, context: master }),
    ).rejects.toThrow("AUDIT_FAILED");
    expect(runtime.generateLink).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(
      runtime.fake!.calls.inserts.filter((i) => i.table === "master_impersonation_sessions"),
    ).toHaveLength(0);
  });

  it("com origin permitido grava a auditoria antes da sessão, que vale 12 horas", async () => {
    const before = Date.now();
    const result = await impersonate({
      data: { businessId: BUSINESS_ID, origin: ORIGIN },
      context: master,
    });
    expect(result).toMatchObject({ accessToken: "at-123", refreshToken: "rt-456" });
    const order = runtime.fake!.calls.inserts.map((i) => i.table);
    expect(order).toEqual(["master_business_events", "master_impersonation_sessions"]);
    const session = runtime.fake!.calls.inserts[1]!.row;
    expect(session["master_user_id"]).toBe("master-1");
    const ttl = Date.parse(String(session["expires_at"])) - before;
    expect(ttl).toBeGreaterThan(11.9 * 3_600_000);
    expect(ttl).toBeLessThanOrEqual(12 * 3_600_000 + 5_000);
    expect(
      String(
        runtime.generateLink.mock.calls[0]![0] &&
          JSON.stringify(runtime.generateLink.mock.calls[0]![0]),
      ),
    ).toContain(`${ORIGIN}/painel`);
  });

  it("dono comum não impersona ninguém", async () => {
    await expect(
      impersonate({ data: { businessId: BUSINESS_ID, origin: ORIGIN }, context: owner }),
    ).rejects.toThrow("Acesso restrito ao painel master.");
    expect(runtime.fake!.calls.inserts).toHaveLength(0);
  });
});

describe("retorno ao Painel Master", () => {
  const token = "t".repeat(64);
  beforeEach(() => {
    runtime.fake!.tables["master_impersonation_sessions"] = [
      {
        id: "sess-1",
        business_id: BUSINESS_ID,
        master_user_id: "master-1",
        token,
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        attempts: 0,
      },
    ];
  });

  it("recusa origin não autorizado", async () => {
    await expect(
      giveBack({ data: { token, pin: "123456", origin: "https://evil.example" }, context: owner }),
    ).rejects.toThrow("ORIGIN_NOT_ALLOWED");
  });

  it("três PINs errados encerram a sessão de impersonação", async () => {
    for (let i = 0; i < 2; i++) {
      await expect(
        giveBack({ data: { token, pin: "000000", origin: ORIGIN }, context: owner }),
      ).rejects.toThrow("PIN incorreto.");
    }
    await expect(
      giveBack({ data: { token, pin: "000000", origin: ORIGIN }, context: owner }),
    ).rejects.toThrow(/encerrada por segurança/);
    expect(runtime.fake!.tables["master_impersonation_sessions"]).toHaveLength(0);
    runtime.pinOk = true;
    await expect(
      giveBack({ data: { token, pin: "123456", origin: ORIGIN }, context: owner }),
    ).rejects.toThrow("Sessão de acesso não encontrada.");
  });

  it("só o dono do negócio impersonado pode usar o token", async () => {
    runtime.pinOk = true;
    await expect(
      giveBack({
        data: { token, pin: "123456", origin: ORIGIN },
        context: { userId: "outro", claims: {} },
      }),
    ).rejects.toThrow("Sessão de acesso não encontrada.");
  });

  it("PIN correto devolve a sessão do master e consome o token (uso único)", async () => {
    runtime.pinOk = true;
    await expect(
      giveBack({ data: { token, pin: "123456", origin: ORIGIN }, context: owner }),
    ).resolves.toMatchObject({
      accessToken: "at-123",
    });
    expect(runtime.fake!.tables["master_impersonation_sessions"]).toHaveLength(0);
  });
});
