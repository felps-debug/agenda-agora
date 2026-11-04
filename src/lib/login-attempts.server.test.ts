import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Simula `auth_attempts` + a função SQL `register_auth_failure` com o mesmo contrato da
 * migration (janela, limite e bloqueio). O estado vive no objeto `store`, fora do módulo
 * testado, então reimportar o módulo (`vi.resetModules`) simula reinício do servidor.
 */
const store = new Map<
  string,
  { failures: number; windowStartedAt: number; lockedUntil: number | null }
>();

function registerAuthFailure(args: Record<string, unknown>) {
  const key = String(args["p_key"]);
  const limit = Number(args["p_limit"]);
  const windowMs = Number(args["p_window_ms"]);
  const lockMs = Number(args["p_lock_ms"]);
  const now = Date.now();
  const row = store.get(key);
  if (!row || now - row.windowStartedAt > windowMs) {
    store.set(key, { failures: 1, windowStartedAt: now, lockedUntil: null });
    return 0;
  }
  row.failures += 1;
  if (row.failures >= limit) {
    row.lockedUntil = now + lockMs;
    return Math.ceil(lockMs / 1000);
  }
  return 0;
}

const fakeDb = {
  rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name !== "register_auth_failure") return { data: null, error: { message: "rpc?" } };
    return { data: registerAuthFailure(args), error: null };
  }),
  from: vi.fn(() => ({
    select: () => ({
      eq: (_column: string, key: string) => ({
        maybeSingle: async () => {
          const row = store.get(key);
          return {
            data: row?.lockedUntil
              ? { locked_until: new Date(row.lockedUntil).toISOString() }
              : null,
            error: null,
          };
        },
      }),
    }),
    delete: () => ({
      eq: async (_column: string, key: string) => {
        store.delete(key);
        return { data: null, error: null };
      },
    }),
  })),
};

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeDb }));

const policy = { limit: 5, windowMs: 15 * 60_000, lockMs: 30 * 60_000 };

async function load() {
  return import("./login-attempts.server");
}

describe("limite de tentativas de login", () => {
  beforeEach(() => {
    store.clear();
    vi.useRealTimers();
    vi.resetModules();
    fakeDb.rpc.mockClear();
  });

  it("conta falhas sem bloquear antes do limite", async () => {
    const { registerFailure, checkLock } = await load();
    for (let i = 0; i < 4; i++) {
      await expect(registerFailure("sdr:a@x.com", policy)).resolves.toEqual({
        locked: false,
        retryAfterSeconds: 0,
      });
    }
    await expect(checkLock("sdr:a@x.com")).resolves.toMatchObject({ locked: false });
  });

  it("bloqueia na quinta falha e informa o tempo restante", async () => {
    const { registerFailure, checkLock } = await load();
    for (let i = 0; i < 4; i++) await registerFailure("sdr:a@x.com", policy);
    await expect(registerFailure("sdr:a@x.com", policy)).resolves.toEqual({
      locked: true,
      retryAfterSeconds: 1800,
    });
    const lock = await checkLock("sdr:a@x.com");
    expect(lock.locked).toBe(true);
    expect(lock.retryAfterSeconds).toBeGreaterThan(1790);
    expect(lock.retryAfterSeconds).toBeLessThanOrEqual(1800);
  });

  it("a janela expira e a contagem recomeça", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
    const { registerFailure } = await load();
    for (let i = 0; i < 4; i++) await registerFailure("sdr:b@x.com", policy);
    vi.setSystemTime(new Date("2026-11-03T10:16:00Z"));
    await expect(registerFailure("sdr:b@x.com", policy)).resolves.toMatchObject({ locked: false });
    expect(store.get("sdr:b@x.com")?.failures).toBe(1);
  });

  it("o bloqueio termina quando locked_until passa", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
    const { registerFailure, checkLock } = await load();
    for (let i = 0; i < 5; i++) await registerFailure("sdr:c@x.com", policy);
    await expect(checkLock("sdr:c@x.com")).resolves.toMatchObject({ locked: true });
    vi.setSystemTime(new Date("2026-11-03T10:31:00Z"));
    await expect(checkLock("sdr:c@x.com")).resolves.toEqual({
      locked: false,
      retryAfterSeconds: 0,
    });
  });

  it("o sucesso zera a contagem e o bloqueio", async () => {
    const { registerFailure, registerSuccess, checkLock } = await load();
    for (let i = 0; i < 5; i++) await registerFailure("sdr:d@x.com", policy);
    await registerSuccess("sdr:d@x.com");
    await expect(checkLock("sdr:d@x.com")).resolves.toMatchObject({ locked: false });
    await expect(registerFailure("sdr:d@x.com", policy)).resolves.toMatchObject({ locked: false });
    expect(store.get("sdr:d@x.com")?.failures).toBe(1);
  });

  it("o bloqueio persiste entre instâncias do módulo (simula reinício)", async () => {
    const first = await load();
    for (let i = 0; i < 5; i++) await first.registerFailure("sdr:e@x.com", policy);
    vi.resetModules();
    const second = await load();
    await expect(second.checkLock("sdr:e@x.com")).resolves.toMatchObject({ locked: true });
  });

  it("chaves diferentes não se misturam (e-mail x IP)", async () => {
    const { registerFailure, checkLock } = await load();
    for (let i = 0; i < 5; i++) await registerFailure("sdr:f@x.com", policy);
    await expect(checkLock("ip:1.2.3.4")).resolves.toMatchObject({ locked: false });
  });

  it("falha do banco vira erro genérico sem vazar detalhes", async () => {
    const { registerFailure } = await load();
    fakeDb.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "relation x does not exist" },
    });
    await expect(registerFailure("k", policy)).rejects.toThrow(
      "Não foi possível registrar a tentativa.",
    );
  });
});
