import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdmin, serverFnMock } from "@/test-support/fake-admin";

const SECRET = "l".repeat(48);

const runtime = vi.hoisted(() => ({
  fake: null as null | ReturnType<typeof import("@/test-support/fake-admin").createFakeAdmin>,
  attempts: new Map<string, { failures: number; lockedUntil: number }>(),
  ip: "198.51.100.1",
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({ assertSuperAdmin: vi.fn() }));
vi.mock("@/lib/env-security.server", () => ({ getSdrTokenSecret: () => SECRET }));
vi.mock("@/lib/rate-limit.server", () => ({ clientIp: () => runtime.ip }));
// Mesmo contrato do módulo real (testado em login-attempts.server.test.ts).
vi.mock("@/lib/login-attempts.server", () => ({
  checkLock: async (key: string) => {
    const row = runtime.attempts.get(key);
    const remaining = row ? Math.max(0, Math.ceil((row.lockedUntil - Date.now()) / 1000)) : 0;
    return { locked: remaining > 0, retryAfterSeconds: remaining };
  },
  registerFailure: async (key: string, o: { limit: number; windowMs: number; lockMs: number }) => {
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
const { sdrLogin } = await import("./sdr.functions");
const { verifySdrToken } = await import("./sdr-token");
const login = sdrLogin as unknown as (arg: {
  data: unknown;
}) => Promise<{ token: string; name: string }>;

const legacyHash = (pin: string, email: string) =>
  createHash("sha256").update(`${email}::${pin}`).digest("hex");

beforeEach(() => {
  runtime.attempts.clear();
  runtime.ip = "198.51.100.1";
  runtime.fake = createFakeAdmin({
    sdrs: [
      {
        id: "sdr-1",
        name: "Ana",
        email: "ana@x.com",
        active: true,
        pin: legacyHash("1234", "ana@x.com"),
      },
    ],
    businesses: [{ id: "biz-1", sdr_id: "sdr-1" }],
  });
});

describe("login do SDR com limite de tentativas (US2)", () => {
  it("entra com a senha correta e devolve token válido por 7 dias", async () => {
    const result = await login({ data: { email: "ana@x.com", pin: "1234" } });
    expect(result.name).toBe("Ana");
    expect(verifySdrToken(result.token, SECRET)).toBe("sdr-1");
    expect(verifySdrToken(result.token, SECRET, Date.now() + 6 * 86_400_000)).toBe("sdr-1");
    expect(verifySdrToken(result.token, SECRET, Date.now() + 8 * 86_400_000)).toBeNull();
  });

  it("converte o hash legado em scrypt no primeiro login e continua entrando depois", async () => {
    await login({ data: { email: "ana@x.com", pin: "1234" } });
    const stored = String(runtime.fake!.tables["sdrs"]![0]!["pin"]);
    expect(stored.startsWith("scrypt$")).toBe(true);
    await expect(login({ data: { email: "ana@x.com", pin: "1234" } })).resolves.toMatchObject({
      name: "Ana",
    });
    await expect(login({ data: { email: "ana@x.com", pin: "9999" } })).rejects.toThrow(
      "E-mail ou senha incorretos.",
    );
  });

  it("bloqueia na quinta senha errada com TOO_MANY_ATTEMPTS e tempo restante", async () => {
    for (let i = 0; i < 4; i++) {
      await expect(login({ data: { email: "ana@x.com", pin: "0000" } })).rejects.toThrow(
        "E-mail ou senha incorretos.",
      );
    }
    await expect(login({ data: { email: "ana@x.com", pin: "0000" } })).rejects.toThrow(
      /^TOO_MANY_ATTEMPTS:1800$/,
    );
  });

  it("o bloqueio persiste: a senha certa também é recusada enquanto bloqueado", async () => {
    for (let i = 0; i < 5; i++)
      await login({ data: { email: "ana@x.com", pin: "0000" } }).catch(() => undefined);
    await expect(login({ data: { email: "ana@x.com", pin: "1234" } })).rejects.toThrow(
      /^TOO_MANY_ATTEMPTS:/,
    );
  });

  it("sucesso zera a contagem de falhas", async () => {
    for (let i = 0; i < 4; i++)
      await login({ data: { email: "ana@x.com", pin: "0000" } }).catch(() => undefined);
    await login({ data: { email: "ana@x.com", pin: "1234" } });
    for (let i = 0; i < 4; i++) {
      await expect(login({ data: { email: "ana@x.com", pin: "0000" } })).rejects.toThrow(
        "E-mail ou senha incorretos.",
      );
    }
  });

  it("e-mail inexistente e senha errada recebem exatamente a mesma mensagem", async () => {
    const unknown = await login({ data: { email: "ninguem@x.com", pin: "1234" } }).catch(
      (e: Error) => e.message,
    );
    const wrong = await login({ data: { email: "ana@x.com", pin: "0000" } }).catch(
      (e: Error) => e.message,
    );
    expect(unknown).toBe("E-mail ou senha incorretos.");
    expect(wrong).toBe(unknown);
  });

  it("SDR inativo é tratado como credencial inválida", async () => {
    runtime.fake!.tables["sdrs"]![0]!["active"] = false;
    await expect(login({ data: { email: "ana@x.com", pin: "1234" } })).rejects.toThrow(
      "E-mail ou senha incorretos.",
    );
  });

  it("registra o bloqueio em master_business_events sem a senha tentada", async () => {
    for (let i = 0; i < 5; i++)
      await login({ data: { email: "ana@x.com", pin: "0000" } }).catch(() => undefined);
    const events = runtime.fake!.calls.inserts.filter((i) => i.table === "master_business_events");
    expect(events).toHaveLength(1);
    expect(events[0]!.row["type"]).toBe("security");
    expect(JSON.stringify(events[0]!.row)).not.toContain("0000");
  });

  it("limite por IP: 30 falhas de e-mails diferentes bloqueiam o endereço", async () => {
    for (let i = 0; i < 30; i++) {
      await login({ data: { email: `x${i}@x.com`, pin: "0000" } }).catch(() => undefined);
    }
    await expect(login({ data: { email: "ana@x.com", pin: "1234" } })).rejects.toThrow(
      /^TOO_MANY_ATTEMPTS:/,
    );
  });

  it("recusa PIN que não tem 4 dígitos", async () => {
    await expect(login({ data: { email: "ana@x.com", pin: "12345" } })).rejects.toThrow();
  });
});
