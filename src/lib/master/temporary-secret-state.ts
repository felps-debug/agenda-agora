export type TemporarySecretState = { businessId: string; value: string };

export function retainTemporarySecretForBusiness(
  secret: TemporarySecretState | null,
  businessId: string | null,
): TemporarySecretState | null {
  return secret?.businessId === businessId ? secret : null;
}

export function visibleTemporaryPassword(
  secret: TemporarySecretState | null,
  businessId: string | null,
): string | null {
  return retainTemporarySecretForBusiness(secret, businessId)?.value ?? null;
}
