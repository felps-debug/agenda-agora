import { getRequest } from "@tanstack/react-start/server";

/**
 * Limitador de taxa para os endpoints públicos.
 *
 * Janela fixa (fixed window) em memória, por chave. O app roda em processo único
 * (`ops/vps/agenda-agora.service`), então o estado é consistente; um restart zera
 * os contadores, o que é aceitável para proteção contra abuso e não para
 * controle de cota. Se o app passar a rodar em múltiplas instâncias, trocar por
 * um store compartilhado (tabela no Supabase ou Redis).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

export type RateLimitOutcome = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Conta uma ocorrência contra a cota da chave e devolve o resultado.
 * A janela só avança quando expira — várias chamadas dentro da mesma janela
 * compartilham o mesmo contador.
 */
export function consumeRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitOutcome {
  const now = params.now ?? Date.now();
  sweep(now);

  const existing = buckets.get(params.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(params.key, { count: 1, resetAt: now + params.windowMs });
    return { ok: true, remaining: Math.max(0, params.limit - 1), retryAfterSeconds: 0 };
  }
  if (existing.count >= params.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true, remaining: Math.max(0, params.limit - existing.count), retryAfterSeconds: 0 };
}

/** Só para testes. */
export function resetRateLimits(now = Date.now()) {
  buckets.clear();
  lastSweep = now;
}

/**
 * IP de quem chamou. Atrás do Caddy (`ops/vps/Caddyfile`) o IP real chega em
 * `x-forwarded-for`; as demais fontes existem para o caso de o app rodar atrás
 * de outro proxy.
 */
export function clientIp(): string {
  let headers: Headers | undefined;
  try {
    headers = getRequest()?.headers;
  } catch {
    // Fora do runtime de requisição (ex.: teste unitário chamando a function
    // direto) não há request. Sem IP, a cota somece por chave única do ambiente.
    return "sem-request";
  }
  if (!headers) return "desconhecido";
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0],
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (value) return value;
  }
  return "desconhecido";
}

export type RateLimitRule = { scope: string; limit: number; windowMs: number };

/**
 * Cotas dos endpoints públicos. Leituras são largas porque a tela troca data e
 * serviço com frequência; escrita é estreita porque cria registro no banco.
 */
export const PUBLIC_RATE_LIMITS = {
  catalog: { scope: "catalogo", limit: 120, windowMs: 60_000 },
  professionals: { scope: "profissionais", limit: 120, windowMs: 60_000 },
  availability: { scope: "disponibilidade", limit: 180, windowMs: 60_000 },
  openDays: { scope: "dias", limit: 60, windowMs: 60_000 },
  reserve: { scope: "reserva", limit: 10, windowMs: 10 * 60_000 },
  depositPix: { scope: "pix-sinal", limit: 15, windowMs: 10 * 60_000 },
  cancel: { scope: "cancelamento", limit: 20, windowMs: 10 * 60_000 },
  cancelDeposit: { scope: "cancelar-sinal", limit: 20, windowMs: 10 * 60_000 },
  reschedule: { scope: "remarcacao", limit: 20, windowMs: 10 * 60_000 },
  myBookings: { scope: "meus-agendamentos", limit: 60, windowMs: 60_000 },
  depositStatus: { scope: "status-sinal", limit: 120, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Aplica a cota da regra ao IP de quem chamou. Lança quando estoura.
 *
 * A mensagem é genérica de propósito: não revela se a cota é por IP nem quantas
 * requisições ainda restam.
 */
export function enforceRateLimit(rule: RateLimitRule): void {
  const outcome = consumeRateLimit({
    key: `${rule.scope}:${clientIp()}`,
    limit: rule.limit,
    windowMs: rule.windowMs,
  });
  if (!outcome.ok) {
    console.warn("Rate limit excedido", { scope: rule.scope, ip: clientIp() });
    throw new Error("Muitas tentativas. Aguarde um instante e tente novamente.");
  }
}
