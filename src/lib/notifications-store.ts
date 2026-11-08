/**
 * Persistência client-side do estado "visto/dispensado" dos avisos (US3).
 *
 * Decisão (research.md): o estado fica no localStorage do navegador (por device).
 *  - `broadcasts-seen`: timestamp do último "tudo visto" (abrir o sino) — já existia.
 *  - dispensas usam o store comum de avisos por ID/dia;
 *  - `broadcasts-dismissed` é lido apenas para migrar o estado legado.
 *
 * Carregado sincronamente (lazy initializer) para o popup não piscar "não visto"
 * no primeiro render após navegar/recarregar.
 */

import { dismissAviso, readDismissed } from "./avisos-store";
import { dayKey } from "./day-key";

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
  const suffix = `:${dayKey()}`;
  const currentIds = () =>
    new Set(
      [...readDismissed("broadcast", storage)]
        .filter((marker) => marker.endsWith(suffix))
        .map((marker) => marker.slice("broadcast:".length, -suffix.length)),
    );
  // Migrate old device dismissals once, preserving them for the current day.
  const s = resolveStorage(storage);
  if (!s) return currentIds();
  try {
    const raw = s.getItem(DISMISSED_KEY);
    if (!raw) return currentIds();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const id of parsed
        .filter((x): x is string => typeof x === "string")
        .slice(-MAX_DISMISSED)) {
        dismissAviso("broadcast", id, new Date(), s);
      }
      s.setItem(DISMISSED_KEY, "[]");
    }
    return currentIds();
  } catch {
    return currentIds();
  }
}

/** Adiciona um id ao conjunto de dispensados e persiste. Devolve o novo conjunto. */
export function addDismissed(id: string, storage?: StorageLike): Set<string> {
  const next = readDismissedIds(storage);
  dismissAviso("broadcast", id, new Date(), storage);
  next.add(id);
  return next;
}
