import type { QueryClient } from "@tanstack/react-query";
import type { Business } from "@/lib/business";

export const businessesQueryKey = (userId: string | undefined) => ["businesses", userId] as const;

/* -------------------------------------------------------------------------- */
/* Cache local (US2): hidrata a lista de negócios a partir do localStorage     */
/* para o primeiro paint não piscar "Carregando estabelecimento..." em reload  */
/* ou sessão nova. A chave é namespaced por usuário (sem vazar entre contas).  */
/* -------------------------------------------------------------------------- */

const BUSINESSES_CACHE_PREFIX = "agendaagora:businesses:";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export const businessesCacheKey = (userId: string | undefined) =>
  `${BUSINESSES_CACHE_PREFIX}${userId ?? "anon"}`;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadCachedBusinesses(
  userId: string | undefined,
  storage?: StorageLike,
): Business[] | undefined {
  const s = resolveStorage(storage);
  if (!s) return undefined;
  try {
    const raw = s.getItem(businessesCacheKey(userId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    // Validação defensiva: cada item precisa ao menos de id string.
    if (!parsed.every((b) => b && typeof b.id === "string")) return undefined;
    return parsed as Business[];
  } catch {
    return undefined;
  }
}

export function saveCachedBusinesses(
  userId: string | undefined,
  list: Business[],
  storage?: StorageLike,
): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.setItem(businessesCacheKey(userId), JSON.stringify(list));
  } catch {
    // Ignora (modo privado / quota).
  }
}

/** Remove todas as entradas de cache de negócios (ex.: logout / troca de conta). */
export function clearCachedBusinesses(storage?: StorageLike): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && (k.startsWith(BUSINESSES_CACHE_PREFIX) || k.startsWith(ROLE_CACHE_PREFIX)))
        keys.push(k);
    }
    for (const k of keys) s.removeItem(k);
  } catch {
    // Ignora.
  }
}

/* Cache do papel de super-admin por usuário (US2): evita o flash de             */
/* "Carregando estabelecimento" enquanto a query de papel resolve em reload.     */
/* Valor apenas de UI — o acesso real é sempre imposto por RLS no servidor.      */

const ROLE_CACHE_PREFIX = "agendaagora:is-admin:";

export const roleCacheKey = (userId: string | undefined) =>
  `${ROLE_CACHE_PREFIX}${userId ?? "anon"}`;

export function loadCachedIsPlatformAdmin(
  userId: string | undefined,
  storage?: StorageLike,
): boolean | undefined {
  const s = resolveStorage(storage);
  if (!s) return undefined;
  try {
    const raw = s.getItem(roleCacheKey(userId));
    if (raw === "true") return true;
    if (raw === "false") return false;
    return undefined;
  } catch {
    return undefined;
  }
}

export function saveCachedIsPlatformAdmin(
  userId: string | undefined,
  value: boolean,
  storage?: StorageLike,
): void {
  const s = resolveStorage(storage);
  if (!s) return;
  try {
    s.setItem(roleCacheKey(userId), value ? "true" : "false");
  } catch {
    // Ignora.
  }
}

const BUSINESS_FIELDS = [
  "name",
  "slug",
  "category",
  "phone",
  "address",
  "status",
  "monthly_fee_cents",
] as const;

/** Aplica a linha devolvida pelo servidor na lista em cache, só com campos de `Business`. */
export function mergeUpdatedBusiness(
  list: Business[] | undefined,
  updated: Partial<Business> & { id: string },
): Business[] | undefined {
  if (!list) return list;
  return list.map((b) => {
    if (b.id !== updated.id) return b;
    const next = { ...b };
    for (const field of BUSINESS_FIELDS) {
      if (updated[field] !== undefined) Object.assign(next, { [field]: updated[field] });
    }
    return next;
  });
}

/**
 * Reflete a edição imediatamente (ex.: cartão do link público lê `business.slug`) e
 * revalida no servidor em seguida.
 */
export function syncUpdatedBusiness(
  queryClient: QueryClient,
  userId: string | undefined,
  updated: Partial<Business> & { id: string },
) {
  queryClient.setQueryData<Business[]>(businessesQueryKey(userId), (list) =>
    mergeUpdatedBusiness(list, updated),
  );
  return queryClient.invalidateQueries({ queryKey: ["businesses"] });
}
