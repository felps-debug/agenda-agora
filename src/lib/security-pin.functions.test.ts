import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const MASTER_PIN = "482913";

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
  attempts: new Map<string, { failures: number; lockedUntil: number }>(),
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/env-security.server", () => ({ getMasterSecurityPin: () => MASTER_PIN }));
vi.mock("@/lib/login-attempts.server", () => ({
  checkLock: async (key: string) => {
    const row = runtime.attempts.get(key);
    const remaining = row ? Math.max(0, Math.ceil((row.lockedUntil - Date.now()) / 1000)) : 0;
    return { locked: remaining > 0, retryAfterSeconds: remaining };
  },
  registerFailure: async (key: string, o: { limit: number; lockMs: number }) => {
    const row = runtime.attempts.get(key) ?? { failures: 0, lockedUntil: 0 };
    row.failures += 1;
    if (row.failures >= o.limit) row.lockedUntil = Date.now() + o.lockMs;
    runtime.attempts.set(key, row);
    return row.lockedUntil > Date.now()
      ? { locked: true, retryAfterSeconds: Math.ceil(o.lockMs / 1000) }
      : { locked: false, retryAfterSeconds: 0 };
  },
  registerSuccess: async (key: string) => {
    runtime.attempts.delete(key);
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (table: string) => runtime.fake!.client.from(table) },
}));

await import("@/integrations/supabase/client.server");
const { verifySecurityPin } = await import("./security-pin.functions");
const verify = verifySecurityPin as unknown as (arg: {
  data: unknown;
  context: unknown;
}) => Promise<{ ok: true; validUntil: number }>;

const master = { userId: "master-1", claims: { aal: "aal1" } };
const owner = { userId: "dono-1", claims: { aal: "aal1" } };

beforeEach(() => {
  runtime.attempts.clear();
  runtime.fake = createFakeAdmin({
    user_roles: [
      { user_id: "master-1", role: "super_admin" },
      { user_id: "dono-1", role: "owner" },
    ],
  });
});

describe("PIN de segurança do Master (US2)", () => {
  it("o PIN antigo 1234 não libera nada", async () => {
    await expect(verify({ data: { pin: "1234" }, context: master })).rejects.toThrow();
  });

  it("PIN do ambiente libera por 10 minutos", async () => {
    const before = Date.now();
    const result = await verify({ data: { pin: MASTER_PIN }, context: master });
    expect(result.ok).toBe(true);
    expect(result.validUntil - before).toBeGreaterThanOrEqual(10 * 60_000 - 50);
    expect(result.validUntil - before).toBeLessThanOrEqual(10 * 60_000 + 1_000);
  });

  it("PIN errado de 6 dígitos devolve INVALID_PIN", async () => {
    await expect(verify({ data: { pin: "000000" }, context: master })).rejects.toThrow(
      "INVALID_PIN",
    );
  });

  it("exige a role super_admin: dono comum é recusado mesmo com o PIN certo", async () => {
    await expect(verify({ data: { pin: MASTER_PIN }, context: owner })).rejects.toThrow(
      "Acesso restrito ao painel master.",
    );
  });

  it("bloqueia depois de 5 falhas, inclusive com o PIN certo", async () => {
    for (let i = 0; i < 4; i++) {
      await expect(verify({ data: { pin: "000000" }, context: master })).rejects.toThrow(
        "INVALID_PIN",
      );
    }
    await expect(verify({ data: { pin: "000000" }, context: master })).rejects.toThrow(
      /^TOO_MANY_ATTEMPTS:1800$/,
    );
    await expect(verify({ data: { pin: MASTER_PIN }, context: master })).rejects.toThrow(
      /^TOO_MANY_ATTEMPTS:/,
    );
  });

  it("sucesso zera a contagem de falhas", async () => {
    for (let i = 0; i < 4; i++)
      await verify({ data: { pin: "000000" }, context: master }).catch(() => undefined);
    await verify({ data: { pin: MASTER_PIN }, context: master });
    for (let i = 0; i < 4; i++) {
      await expect(verify({ data: { pin: "000000" }, context: master })).rejects.toThrow(
        "INVALID_PIN",
      );
    }
  });
});
