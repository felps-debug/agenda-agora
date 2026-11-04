/**
 * Ciclo de vida automático das assinaturas — Painel 3 Master.
 *
 * Modelo de VENCIMENTO ROLANTE: cada pagamento confirma +30 dias a partir do
 * fim do acesso vigente (nunca come dias). A categoria é derivada do
 * `accessUntil` real — sem estado armazenado, a movimentação entre os menus
 * (Em teste / Assinantes / Precisa de atenção) é automática.
 */

export type LifecycleCategory = "em_teste" | "assinante" | "atencao";

export type AttentionReason =
  | "teste_expirado"
  | "pagamento_pendente"
  | "assinatura_vencida"
  | "acesso_suspenso"
  | "cancelamento_solicitado"
  | "cancelado";

export const ATTENTION_REASON_LABEL: Record<AttentionReason, string> = {
  teste_expirado: "Teste expirado",
  pagamento_pendente: "Pagamento pendente",
  assinatura_vencida: "Assinatura vencida",
  acesso_suspenso: "Acesso suspenso",
  cancelamento_solicitado: "Cancelamento solicitado",
  cancelado: "Cancelado",
};

const DAY_MS = 86_400_000;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export type LifecycleInput = {
  status: string;
  /** Nunca pagou e foi criado como teste (dias de teste). */
  isTrial: boolean;
  /** Vencimento rolante do acesso (fim do teste ou fim da assinatura paga). */
  accessUntil: string | null;
  cancelRequestedAt: string | null;
  cancelledAt: string | null;
  now?: Date | string;
};

export type LifecycleResult = {
  category: LifecycleCategory;
  reason: AttentionReason | null;
  daysLeft: number;
  /** Aviso do teste: 3 dias restantes, 1 dia ou o último dia. */
  trialAlert: 3 | 1 | 0 | null;
  /** Dias até o próximo vencimento (assinantes), para o alerta de 7/3/1/hoje. */
  dueAlert: 7 | 3 | 1 | 0 | null;
  daysLate: number;
};

export function classifyLifecycle(input: LifecycleInput): LifecycleResult {
  const now = startOfDay(input.now ? new Date(input.now) : new Date());
  const until = input.accessUntil ? startOfDay(new Date(input.accessUntil)) : null;
  const daysLeft = until
    ? Math.round((until.getTime() - now.getTime()) / DAY_MS)
    : -1; // sem vencimento registrado: tratado como expirado
  const daysLate = Math.max(-daysLeft, 0);

  let category: LifecycleCategory;
  let reason: AttentionReason | null = null;

  if (input.cancelledAt) {
    category = "atencao";
    reason = "cancelado";
  } else if (input.cancelRequestedAt && daysLeft < 0) {
    // Cancelamento solicitado sem acesso vigente (respeita o período pago:
    // enquanto o acesso estiver válido, segue como assinante).
    category = "atencao";
    reason = "cancelamento_solicitado";
  } else if (!input.isTrial) {
    if (input.status === "suspenso") {
      category = "atencao";
      reason = "acesso_suspenso";
    } else if (daysLeft >= 0) {
      category = "assinante";
    } else if (daysLate >= 1 && daysLate <= 3) {
      // Dentro dos 3 dias de tolerância: dia 1 aviso, dia 3 último aviso.
      category = "atencao";
      reason = "pagamento_pendente";
    } else {
      category = "atencao";
      reason = "assinatura_vencida";
    }
  } else if (daysLeft >= 0) {
    // Último dia de teste (vencimento hoje) ainda conta como em teste;
    // a atenção por "Teste expirado" começa no dia seguinte ao encerramento.
    category = "em_teste";
  } else {
    category = "atencao";
    reason = "teste_expirado";
  }

  const trialAlert: 3 | 1 | 0 | null =
    category === "em_teste"
      ? daysLeft === 3
        ? 3
        : daysLeft === 1
          ? 1
          : daysLeft === 0
            ? 0
            : null
      : null;
  const dueAlert: 7 | 3 | 1 | 0 | null =
    category === "assinante" &&
    (daysLeft === 7 || daysLeft === 3 || daysLeft === 1 || daysLeft === 0)
      ? (daysLeft as 7 | 3 | 1 | 0)
      : null;

  return {
    category,
    reason,
    daysLeft,
    trialAlert,
    dueAlert,
    daysLate: category === "atencao" ? daysLate : 0,
  };
}

/** Dias de atraso a partir dos quais a assinatura inadimplente pode ser cancelada sozinha. */
export const AUTO_CANCEL_AFTER_DAYS = 15;

/**
 * Regra do dia 15: só cancela quando a chave do master está ligada, a conta já foi assinante
 * (não é teste), ainda não foi cancelada e está vencida há pelo menos 15 dias.
 */
export function shouldAutoCancel(input: {
  autoCancelEnabled: boolean;
  isTrial: boolean;
  cancelledAt: string | null;
  accessUntil: string | null;
  now?: Date | string;
}): boolean {
  if (!input.autoCancelEnabled || input.isTrial || input.cancelledAt || !input.accessUntil) return false;
  const now = input.now ? new Date(input.now).getTime() : Date.now();
  const overdueDays = Math.floor((now - new Date(input.accessUntil).getTime()) / DAY_MS);
  return overdueDays >= AUTO_CANCEL_AFTER_DAYS;
}
