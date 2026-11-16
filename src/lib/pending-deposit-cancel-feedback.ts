export type PendingDepositCancelFeedback =
  { kind: "cancelled" } | { kind: "paid" } | { kind: "paid_unconfirmed" } | { kind: "retry" };

export function getPendingDepositCancelFeedback(status: string): PendingDepositCancelFeedback {
  if (status === "expirado") return { kind: "cancelled" };
  if (status === "pago") return { kind: "paid" };
  if (status === "pago_sem_agendamento") return { kind: "paid_unconfirmed" };
  return { kind: "retry" };
}
