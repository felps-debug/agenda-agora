export function pendingCancellationMetric(count: number, monthlyCents: number) {
  return {
    label: "Pedidos de cancelamento em aberto",
    count,
    monthlyCents,
  };
}
