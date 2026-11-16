export function startWithdrawalConfirmation(
  lock: { current: boolean },
  verifyPin: () => void,
): boolean {
  if (lock.current) return false;
  lock.current = true;
  verifyPin();
  return true;
}
