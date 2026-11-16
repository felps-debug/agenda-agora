import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clientIp,
  consumeRateLimit,
  enforceRateLimit,
  PUBLIC_RATE_LIMITS,
  resetRateLimits,
} from "./rate-limit.server";

const { getRequestMock } = vi.hoisted(() => ({ getRequestMock: vi.fn() }));

vi.mock("@tanstack/react-start/server", () => ({ getRequest: getRequestMock }));

describe("consumeRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("libera até o limite e recusa o excedente", () => {
    const opts = { key: "k", limit: 3, windowMs: 60_000, now: 1_000 };
    expect(consumeRateLimit(opts).ok).toBe(true);
    expect(consumeRateLimit(opts).ok).toBe(true);
    expect(consumeRateLimit(opts).ok).toBe(true);

    const blocked = consumeRateLimit(opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("devolve as requisições restantes", () => {
    expect(consumeRateLimit({ key: "k", limit: 3, windowMs: 60_000 }).remaining).toBe(2);
    expect(consumeRateLimit({ key: "k", limit: 3, windowMs: 60_000 }).remaining).toBe(1);
    expect(consumeRateLimit({ key: "k", limit: 3, windowMs: 60_000 }).remaining).toBe(0);
  });

  it("avança a janela quando ela expira", () => {
    const start = 1_000;
    for (let i = 0; i < 2; i++)
      consumeRateLimit({ key: "k", limit: 2, windowMs: 60_000, now: start });

    // Ainda dentro da janela: continua bloqueado.
    expect(consumeRateLimit({ key: "k", limit: 2, windowMs: 60_000, now: start + 30_000 }).ok).toBe(
      false,
    );

    // Janela nova depois de expirar: libera de novo.
    expect(consumeRateLimit({ key: "k", limit: 2, windowMs: 60_000, now: start + 60_001 }).ok).toBe(
      true,
    );
  });

  it("isola chaves diferentes", () => {
    consumeRateLimit({ key: "ip-a", limit: 1, windowMs: 60_000 });
    expect(consumeRateLimit({ key: "ip-a", limit: 1, windowMs: 60_000 }).ok).toBe(false);
    expect(consumeRateLimit({ key: "ip-b", limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });
});

describe("clientIp", () => {
  beforeEach(() => getRequestMock.mockReset());

  it("retorna endereço desconhecido quando o request não tem headers", () => {
    getRequestMock.mockReturnValue(undefined);
    expect(clientIp()).toBe("desconhecido");
  });

  it("usa o IP acrescentado pelo proxy em vez dos cabeçalhos forjáveis", () => {
    getRequestMock.mockReturnValue({
      headers: new Headers({
        "cf-connecting-ip": "198.51.100.200",
        "x-real-ip": "198.51.100.201",
        "x-forwarded-for": "198.51.100.202, 203.0.113.19",
      }),
    });

    expect(clientIp()).toBe("203.0.113.19");
  });
});

describe("enforceRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("bloqueia escrita repetida depois da cota", () => {
    const rule = { scope: "reserva", limit: 3, windowMs: 60_000 };
    expect(() => enforceRateLimit(rule)).not.toThrow();
    expect(() => enforceRateLimit(rule)).not.toThrow();
    expect(() => enforceRateLimit(rule)).not.toThrow();
    expect(() => enforceRateLimit(rule)).toThrow(/Muitas tentativas/i);
  });

  it("recusa ao estourar a cota de reserva por padrão", () => {
    const { limit } = PUBLIC_RATE_LIMITS.reserve;
    for (let i = 0; i < limit; i++)
      expect(() => enforceRateLimit(PUBLIC_RATE_LIMITS.reserve)).not.toThrow();
    expect(() => enforceRateLimit(PUBLIC_RATE_LIMITS.reserve)).toThrow(/Muitas tentativas/i);
  });

  it("não deixa a cota de leitura esgotar a de escrita", () => {
    const { limit } = PUBLIC_RATE_LIMITS.availability;
    for (let i = 0; i < limit; i++) enforceRateLimit(PUBLIC_RATE_LIMITS.availability);
    // A tela leu muito, mas uma reserva nova ainda passa.
    expect(() => enforceRateLimit(PUBLIC_RATE_LIMITS.reserve)).not.toThrow();
  });

  it("não revela a cota na mensagem de erro", () => {
    const rule = { scope: "reserva", limit: 1, windowMs: 60_000 };
    enforceRateLimit(rule);
    let message = "";
    try {
      enforceRateLimit(rule);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toMatch(/\d/);
    expect(message).not.toMatch(/ip/i);
  });
});
