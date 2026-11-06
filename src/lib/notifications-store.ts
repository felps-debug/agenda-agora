/**
 * Persistência client-side do estado "visto/dispensado" dos avisos (US3).
 *
 * Decisão (research.md): o estado fica no localStorage do navegador (por device).
 *  - `broadcasts-seen`: timestamp do último "tudo visto" (abrir o sino) — já existia.
 *  - `broadcasts-dismissed`: conjunto de ids dispensados via X do popup — novo.
 *
 * Carregado sincronamente (lazy initializer) para o popup não piscar "não visto"
 * no primeiro render após navegar/recarregar.
 */

export const SEEN_KEY = "agenda-agora:broadcasts-seen";
export const DISMISSED_KEY = "agenda-agora:broadcasts-dismissed";

/** Limite defensivo para o set não crescer indefinidamente. */
const MAX_DISMISSED = 200;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSeenAt(storage?: StorageLike): number {
  const s = resolveStorage(storage);
  if (!s) return 0;
  try {
    const raw = s.getItem(SEEN_KEY);
    const n = Number(raw ?? "0");
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeSeenAt(ts: number, storage?: StorageLike): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.setItem(SEEN_KEY, String(ts));
  } catch {
    // Ignora (modo privado / quota).
  }
}

export function readDismissedIds(storage?: StorageLike): Set<string> {
  const s = resolveStorage(storage);
  if (!s) return new Set();
  try {
    const raw = s.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))
      return new Set(parsed.filter((x): x is string => typeof x === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

/** Adiciona um id ao conjunto de dispensados e persiste. Devolve o novo conjunto. */
export function addDismissed(id: string, storage?: StorageLike): Set<string> {
  const current = readDismissedIds(storage);
  current.add(id);
  // Mantém os últimos MAX_DISMISSED (ordem de inserção do Set).
  let next = current;
  if (current.size > MAX_DISMISSED) {
    next = new Set(Array.from(current).slice(current.size - MAX_DISMISSED));
  }
  const s = resolveStorage(storage);
  if (s) {
    try {
      s.setItem(DISMISSED_KEY, JSON.stringify(Array.from(next)));
    } catch {
      // Ignora.
    }
  }
  return next;
}
