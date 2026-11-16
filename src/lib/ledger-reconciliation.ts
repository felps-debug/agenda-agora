export function parseObservedBalanceCents(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  if (!normalized) return null;
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized)) return null;

  const cents = Number(normalized.replaceAll(".", "").replace(",", ".")) * 100;
  return Number.isSafeInteger(Math.round(cents)) ? Math.round(cents) : null;
}

export function hasLedgerDivergence(
  availableCents: number,
  pendingCents: number,
  lockedCents: number,
  platformRevenueCents: number,
  observedBalanceCents: number | null,
): boolean {
  if (observedBalanceCents === null) return false;
  const ledgerLiabilityCents = availableCents + pendingCents + lockedCents + platformRevenueCents;
  return observedBalanceCents < ledgerLiabilityCents;
}
