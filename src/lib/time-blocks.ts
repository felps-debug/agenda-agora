export function validateTimeBlockRange(startsAt: string, endsAt: string): string | null {
  const start = /^([01]\d|2[0-3]):[0-5]\d$/.test(startsAt) ? startsAt : "";
  const end = /^([01]\d|2[0-3]):[0-5]\d$/.test(endsAt) ? endsAt : "";
  if (!start || !end) return "Informe horários válidos para o início e o fim.";
  if (end <= start) return "O fim deve ser depois do início.";
  return null;
}

export function assertValidTimeBlockRange(startsAt: string, endsAt: string): void {
  const message = validateTimeBlockRange(startsAt, endsAt);
  if (message) throw new Error(message);
}
