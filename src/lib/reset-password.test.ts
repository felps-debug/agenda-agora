import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";
import { signSdrToken } from "./sdr-token";

const SECRET = "r".repeat(48);
const BUSINESS_ID = "7b1b0e0e-5b7a-4c1f-8a53-0e9d2f6c1a11";
const OTHER_BUSINESS_ID = "9c2c1f1f-6c8b-4d20-9b64-1f0e3a7d2b22";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/env-security.server", () => ({ getSdrTokenSecret: () => SECRET }));
vi.mock("@/lib/rate-limit.server", () => ({ clientIp: () => "198.51.100.2" }));
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

await import("@/integrations/supabase/client.server");
const { resetOwnerPassword } = await import("./reset-password.functions");
const { resetSdrOwnerPassword } = await import("./sdr.functions");

const masterReset = resetOwnerPassword as unknown as (arg: {
  data: unknown;
  context: unknown;
}) => Promise<{ temporaryPassword: string }>;
const sdrReset = resetSdrOwnerPassword as unknown as (arg: {
  data: unknown;
}) => Promise<{ temporaryPassword: string }>;

const master = { userId: "master-1", claims: { aal: "aal1" } };
const owner = { userId: "dono-1", claims: { aal: "aal1" } };

beforeEach(() => {
  runtime.fake = createFakeAdmin({
    user_roles: [
      { user_id: "master-1", role: "super_admin" },
      { user_id: "dono-1", role: "owner" },
    ],
    sdrs: [
      { id: "sdr-1", name: "Ana", email: "ana@x.com", active: true },
      { id: "sdr-2", name: "Beto", email: "beto@x.com", active: true },
    ],
    businesses: [
      { id: BUSINESS_ID, owner_id: "dono-1", sdr_id: "sdr-1" },
      { id: OTHER_BUSINESS_ID, owner_id: "dono-2", sdr_id: "sdr-2" },
    ],
  });
});

describe("redefinição de senha do dono (US3)", () => {
  it("o master gera uma senha aleatória, grava só no Auth e audita sem a senha", async () => {
    const result = await masterReset({ data: { businessId: BUSINESS_ID }, context: master });
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(20);
    expect(runtime.fake!.calls.authUpdates).toEqual([
      { id: "dono-1", attrs: { password: `agendaagora:${result.temporaryPassword}` } },
    ]);
    const events = runtime.fake!.calls.inserts.filter((i) => i.table === "master_business_events");
    expect(events).toHaveLength(1);
    expect(events[0]!.row["actor_id"]).toBe("master-1");
    expect(JSON.stringify(events[0]!.row)).not.toContain(result.temporaryPassword);
  });

  it("duas redefinições geram senhas diferentes", async () => {
    const a = await masterReset({ data: { businessId: BUSINESS_ID }, context: master });
    const b = await masterReset({ data: { businessId: BUSINESS_ID }, context: master });
    expect(a.temporaryPassword).not.toBe(b.temporaryPassword);
  });

  it("dono comum não consegue redefinir senha de ninguém", async () => {
    await expect(
      masterReset({ data: { businessId: BUSINESS_ID }, context: owner }),
    ).rejects.toThrow("Acesso restrito ao painel master.");
    expect(runtime.fake!.calls.authUpdates).toHaveLength(0);
  });

  it("não altera a senha se a auditoria falhar", async () => {
    runtime.fake!.failures["master_business_events:insert"] = { message: "falhou" };
    await expect(
      masterReset({ data: { businessId: BUSINESS_ID }, context: master }),
    ).rejects.toThrow("Não foi possível registrar a auditoria do reset.");
    expect(runtime.fake!.calls.authUpdates).toHaveLength(0);
  });

  it("o SDR dono do negócio consegue redefinir", async () => {
    const result = await sdrReset({
      data: { token: signSdrToken("sdr-1", SECRET), businessId: BUSINESS_ID },
    });
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(20);
    expect(runtime.fake!.calls.authUpdates).toHaveLength(1);
    expect(runtime.fake!.calls.authUpdates[0]!.id).toBe("dono-1");
  });

  it("um SDR não redefine a senha do negócio de outro SDR", async () => {
    await expect(
      sdrReset({ data: { token: signSdrToken("sdr-1", SECRET), businessId: OTHER_BUSINESS_ID } }),
    ).rejects.toThrow("Estabelecimento não encontrado.");
    expect(runtime.fake!.calls.authUpdates).toHaveLength(0);
  });

  it("token de SDR inválido é recusado", async () => {
    await expect(
      sdrReset({ data: { token: "a".repeat(30) + "." + "b".repeat(30), businessId: BUSINESS_ID } }),
    ).rejects.toThrow(/Sessão expirada/);
  });

  it("nenhuma outra função do servidor devolve senha do dono", () => {
    function files(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return files(path);
        return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
      });
    }
    // `types.ts` é gerado do banco: só perde as colunas depois da migration de DROP (T046/T048),
    // então fica fora desta checagem até a regeneração pós-DROP. O resto do código tem de estar limpo.
    const offenders = files(join(process.cwd(), "src"))
      .filter((path) => !path.endsWith(join("integrations", "supabase", "types.ts")))
      .filter((path) => /access_password|withdrawal_pin_plain/.test(readFileSync(path, "utf8")))
      .map((path) => path.replace(process.cwd(), ""));
    expect(offenders).toEqual([]);
  });
});
