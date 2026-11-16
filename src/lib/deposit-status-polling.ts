const NORMAL_POLL_DELAY_MS = 15_000;
const MAX_FAILURE_BACKOFF_MS = 60_000;

export function getDepositStatusPollDelay(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return NORMAL_POLL_DELAY_MS;
  return Math.min(NORMAL_POLL_DELAY_MS * 2 ** consecutiveFailures, MAX_FAILURE_BACKOFF_MS);
}
