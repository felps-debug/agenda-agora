/** Cálculos puros da performance da equipe SDR (Painel 3 Master). */

export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Conversão = vendas ÷ cadastros, em porcentagem inteira. */
export function conversionRate(cadastros: number, vendas: number) {
  if (cadastros <= 0) return 0;
  return Math.round((vendas / cadastros) * 100);
}

/** Variação percentual; `null` quando não há base de comparação. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export type WeekBucket = { start: string; end: string; label: string };

/**
 * Últimas `count` janelas de 7 dias terminando hoje (a mais antiga primeiro).
 * O rótulo é o primeiro dia da janela, em dd/mm.
 */
export function weeklyBuckets(count: number, today = new Date()): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  const endBase = new Date(today);
  endBase.setHours(23, 59, 59, 999);
  for (let index = count - 1; index >= 0; index--) {
    const end = new Date(endBase);
    end.setDate(end.getDate() - index * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    buckets.push({
      start: start.toISOString(),
      end: end.toISOString(),
      label: `${String(start.getDate()).padStart(2, "0")}/${String(start.getMonth() + 1).padStart(2, "0")}`,
    });
  }
  return buckets;
}
