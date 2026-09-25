import type { QueryClient } from "@tanstack/react-query";
import type { Business } from "@/lib/business";

export const businessesQueryKey = (userId: string | undefined) => ["businesses", userId] as const;

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
