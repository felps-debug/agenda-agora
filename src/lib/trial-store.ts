export type TrialRow = {
  trial_days: number | null;
  trial_created_at: string | null;
  trial_registration_name?: string | null;
};

/** Dias restantes de uma conta de teste a partir das colunas do banco. */
export function trialInfo(row: TrialRow): { days: number; remaining: number } | null {
  if (row.trial_days == null || !row.trial_created_at) return null;
  const elapsed = Math.floor((Date.now() - new Date(row.trial_created_at).getTime()) / 86_400_000);
  const remaining = Math.max(row.trial_days - elapsed, 0);
  return { days: row.trial_days, remaining };
}

export function isExpiredTrial(row: TrialRow): boolean {
  const info = trialInfo(row);
  return !!info && info.remaining <= 0;
}
