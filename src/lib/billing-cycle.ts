/**
 * Ciclo de acesso por VENCIMENTO ROLANTE:
 * - Cada pagamento confirmado adiciona 30 dias A PARTIR DO FIM DO ACESSO VIGENTE
 *   (nunca a partir do dia do pagamento) — pagar antecipado não come dias;
 * - Pagar com atraso desloca o vencimento para pagamento + 30 dias — nenhum
 *   cliente perde 1 dia sequer;
 * - O dia do vencimento NÃO é fixo: é sempre fim_do_acesso + novo pagamento.
 *
 * Estágios de aviso no Painel 2 do dono (mesma tabela de sempre):
 * - "amanha": 1 dia antes; "venceu_hoje": no dia; "atrasado": 1 dia após;
 * - "urgente": 2º e 3º dias (tolerância); "bloqueado": 4º dia — travado em Pagamentos;
 * - "ok": acesso vigente, sem avisos.
 */

export type BillingStage =
  | "ok"
  | "amanha"
  | "venceu_hoje"
  | "atrasado"
  | "urgente"
  | "bloqueado";

const DAY_MS = 86_400_000;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export type AccessCycleInput = {
  /** Data até a qual o acesso está pago (vencimento rolante). */
  accessUntil: string | null;
  now?: Date | string;
};

export type AccessCycleResult = {
  stage: BillingStage;
  daysLeft: number;
  accessUntil: string;
};

/** Ciclo a partir do vencimento rolante. `daysLeft` pode ser negativo (atraso). */
export function computeAccessCycle(input: AccessCycleInput): AccessCycleResult {
  const now = startOfDay(input.now ? new Date(input.now) : new Date());
  const until = input.accessUntil
    ? startOfDay(new Date(input.accessUntil))
    : startOfDay(new Date(now.getTime() - DAY_MS)); // sem vencimento: tratado como expirado
  const daysLeft = Math.round((until.getTime() - now.getTime()) / DAY_MS);

  const stage: BillingStage =
    daysLeft > 1
      ? "ok"
      : daysLeft === 1
        ? "amanha"
        : daysLeft === 0
          ? "venceu_hoje"
          : daysLeft === -1
            ? "atrasado"
            : daysLeft >= -3
              ? "urgente"
              : "bloqueado";

  return { stage, daysLeft, accessUntil: until.toISOString() };
}

/* Regra de profissionais na assinatura:
 * - O 1º profissional (agenda principal do dono) é INCLUÍDO no plano — grátis;
 * - Cada profissional ADICIONAL (2º em diante) acrescenta R$ 10,00/mês;
 * - Limite de 10 profissionais por estabelecimento. */
export const INCLUDED_PROFESSIONALS = 1;
export const ADDITIONAL_PROFESSIONAL_CENTS = 1000;
export const MAX_PROFESSIONALS = 10;

export function subscriptionTotalCents(baseCents: number, professionalsCount: number): number {
  const extras = Math.max(0, Math.min(professionalsCount, MAX_PROFESSIONALS) - INCLUDED_PROFESSIONALS);
  return baseCents + extras * ADDITIONAL_PROFESSIONAL_CENTS;
}

export type InvoiceCardStatus = {  status: "a_vencer" | "vencida";
  daysLeft: number;
  /**
   * Regra de exibição no menu Assinatura (SEMPRE UMA CAIXA DE STATUS):
   * - a vencer: visível somente nos 10 dias antes do vencimento;
   * - vencida: sempre visível até regularizar;
   * - pago: histórico separado (uma caixa por pagamento confirmado).
   */
  visible: boolean;
};

export function computeInvoiceStatus(
  accessUntil: string | null,
  now: Date | string,
): InvoiceCardStatus {
  const cycle = computeAccessCycle({ accessUntil, now });
  return {
    status: cycle.daysLeft >= 0 ? "a_vencer" : "vencida",
    daysLeft: cycle.daysLeft,
    visible: cycle.daysLeft <= 10,
  };
}

/**
 * Nova data de vencimento após um pagamento confirmado:
 * fim_do_acesso_vigente (ou hoje, se já venceu) + 30 dias. Nunca come dias.
 */
export function nextAccessAfterPayment(
  currentAccessUntil: string | null,
  now: Date | string,
): string {
  const nowDay = startOfDay(new Date(now));
  const current = currentAccessUntil
    ? startOfDay(new Date(currentAccessUntil))
    : new Date(nowDay.getTime() - DAY_MS);
  const base = current.getTime() > nowDay.getTime() ? current : nowDay;
  return new Date(base.getTime() + 30 * DAY_MS).toISOString();
}
