import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const SECRET = "v".repeat(48);

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({ assertSuperAdmin: vi.fn() }));
vi.mock("@/lib/env-security.server", () => ({ getSdrTokenSecret: () => SECRET }));
vi.mock("@/lib/rate-limit.server", () => ({ clientIp: () => "203.0.113.8" }));
vi.mock("@/lib/login-attempts.server", () => ({
  checkLock: vi.fn(),
  registerFailure: vi.fn(),
  registerSuccess: vi.fn(),
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

const { sdrCreateBusiness } = await import("./sdr.functions");
const { signSdrToken } = await import("./sdr-token");
const call = sdrCreateBusiness as unknown as (arg: { data: unknown }) => Promise<unknown>;

const base = () => ({
  token: signSdrToken("sdr-1", SECRET),
  businessName: "Salão Bela",
  category: "salao",
  ownerName: "Maria",
  phone: "11981549276",
  password: "abcd",
  trialDays: 7,
});

beforeEach(() => {
  runtime.fake = createFakeAdmin({
    sdrs: [{ id: "sdr-1", name: "Ana", email: "ana@x.com", active: true, pin: "x" }],
  });
});

describe("validação do cadastro feito pelo SDR (US2)", () => {
  it("aceita um cadastro dentro das regras", async () => {
    await expect(call({ data: base() })).resolves.toMatchObject({ phone: "11981549276" });
  });

  it("recusa período de teste acima de 30 dias", async () => {
    await expect(call({ data: { ...base(), trialDays: 31 } })).rejects.toThrow();
    expect(runtime.fake!.calls.authCreates).toHaveLength(0);
  });

  it("aceita exatamente 30 dias e 0 dias", async () => {
    await expect(call({ data: { ...base(), trialDays: 30 } })).resolves.toBeTruthy();
    await expect(
      call({ data: { ...base(), phone: "11981549277", trialDays: 0 } }),
    ).resolves.toBeTruthy();
  });

  it("recusa período de teste negativo ou fracionado", async () => {
    await expect(call({ data: { ...base(), trialDays: -1 } })).rejects.toThrow();
    await expect(call({ data: { ...base(), trialDays: 1.5 } })).rejects.toThrow();
  });

  it("recusa categoria fora da lista do produto", async () => {
    await expect(call({ data: { ...base(), category: "oficina-mecanica" } })).rejects.toThrow();
    expect(runtime.fake!.calls.authCreates).toHaveLength(0);
  });

  it("recusa telefone sem DDD", async () => {
    await expect(call({ data: { ...base(), phone: "981549276" } })).rejects.toThrow();
    expect(runtime.fake!.calls.authCreates).toHaveLength(0);
  });

  it("recusa telefone com dígitos demais", async () => {
    await expect(call({ data: { ...base(), phone: "5511981549276" } })).rejects.toThrow(/DDD/);
    expect(runtime.fake!.calls.authCreates).toHaveLength(0);
  });

  it("aceita telefone formatado com máscara", async () => {
    await expect(call({ data: { ...base(), phone: "(11) 98154-9276" } })).resolves.toMatchObject({
      phone: "11981549276",
    });
  });
});
