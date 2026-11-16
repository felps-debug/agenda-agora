export function calendarWeekDays(cursor: Date): Date[] {
  const start = new Date(
    cursor.getFullYear(),
    cursor.getMonth(),
    cursor.getDate() - cursor.getDay(),
  );
  return Array.from(
    { length: 7 },
    (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}
