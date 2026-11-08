import { dayKey } from "./day-key";

export type AvisoTipo = "broadcast" | "cobranca" | "trial";
export type AvisoStorage = Pick<Storage, "getItem" | "setItem">;
export const AVISOS_KEY = "agenda-agora:avisos-dismissed";
const TYPES: AvisoTipo[] = ["broadcast", "cobranca", "trial"];

function resolveStorage(storage?: AvisoStorage): AvisoStorage | null {
  if (storage) return storage;
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function avisoMarker(tipo: AvisoTipo, estagio: string, date = new Date()): string {
  return `${tipo}:${estagio}:${dayKey(date)}`;
}

export function readDismissed(tipo?: AvisoTipo, storage?: AvisoStorage): Set<string> {
  try {
    const parsed: unknown = JSON.parse(resolveStorage(storage)?.getItem(AVISOS_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return new Set();
    const map = parsed as Record<string, unknown>;
    return new Set(
      (tipo ? [tipo] : TYPES)
        .flatMap((key) => {
          const values = map[key];
          return Array.isArray(values)
            ? values.filter(
                (value): value is string =>
                  typeof value === "string" && value.startsWith(`${key}:`),
              )
            : [];
        })
        .slice(-200),
    );
  } catch {
    return new Set();
  }
}

export function dismissAviso(
  tipo: AvisoTipo,
  estagio: string,
  date = new Date(),
  storage?: AvisoStorage,
): void {
  try {
    const markers = readDismissed(undefined, storage);
    const marker = avisoMarker(tipo, estagio, date);
    markers.delete(marker);
    markers.add(marker);
    const recent = [...markers]
      .sort((a, b) => a.slice(-10).localeCompare(b.slice(-10)))
      .slice(-200);
    const map = Object.fromEntries(
      TYPES.map((key) => [key, recent.filter((value) => value.startsWith(`${key}:`))]),
    );
    resolveStorage(storage)?.setItem(AVISOS_KEY, JSON.stringify(map));
  } catch {
    // Private mode/quota must never prevent closing an aviso.
  }
}

export function shouldShowAviso(
  tipo: AvisoTipo,
  estagio: string,
  date = new Date(),
  storage?: AvisoStorage,
): boolean {
  return !readDismissed(tipo, storage).has(avisoMarker(tipo, estagio, date));
}
