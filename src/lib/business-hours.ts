const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function secondsSinceMidnight(value: string): number {
  const [hours, minutes, seconds = 0] = value.split(":").map(Number);
  return hours! * 3_600 + minutes! * 60 + seconds!;
}

export function validateBusinessHoursRange(startsAt: string, endsAt: string): string | null {
  if (!TIME_PATTERN.test(startsAt) || !TIME_PATTERN.test(endsAt)) {
    return "Informe um horário de início e de fim válidos.";
  }
  if (secondsSinceMidnight(endsAt) <= secondsSinceMidnight(startsAt)) {
    return "O fim deve ser depois do início.";
  }
  return null;
}
