/**
 * Lógica pura de exibição do pop-up de aviso (US3).
 *
 * Um aviso só deve aparecer como pop-up quando:
 *  - é mais novo que o último "tudo visto" (abrir o sino): `createdAt > seenAt`, E
 *  - o seu id ainda não foi dispensado individualmente (fechar no X): `id ∉ dismissedIds`.
 *
 * O controle é por aviso (id), não global — um aviso novo e distinto ainda aparece
 * mesmo que outro tenha sido dispensado.
 */

export type Broadcast = {
  id: string;
  title: string;
  message: string;
  /** ISO string. */
  createdAt: string;
};

export type BroadcastSeenState = {
  /** Timestamp (ms) do último "tudo visto" via sino. */
  seenAt: number;
  /** Ids dispensados individualmente via X do popup. */
  dismissedIds: ReadonlySet<string> | readonly string[];
};

export function shouldShowPopup(
  broadcast: Broadcast | null | undefined,
  { seenAt, dismissedIds }: BroadcastSeenState,
): boolean {
  if (!broadcast) return false;
  const dismissed =
    dismissedIds instanceof Set ? dismissedIds : new Set<string>(dismissedIds as readonly string[]);
  if (dismissed.has(broadcast.id)) return false;
  const created = new Date(broadcast.createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return created > seenAt;
}
