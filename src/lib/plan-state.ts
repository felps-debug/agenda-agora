import { trialInfo } from "@/lib/trial-store";

const DAY_MS = 86_400_000;

export type PlanTone = "ativo" | "teste" | "renovar";

export type PlanState = {
  tone: PlanTone;
  /** Rótulo curto: Ativo | Teste Grátis | Renovar */
  label: string;
  /** Detalhe: dias restantes da assinatura ativa ou do teste. */
  detail: string;
  daysLeft: number | null;
} & {
  /** Classes prontas da pílula de status (aceita o token "destructive"). */
  badgeClass: string;
};

type PlanInput = {
  status?: string;
  access_until?: string | null;
  trial_days?: number | null;
  trial_created_at?: string | null;
};

/**
 * Estado do plano do dono, usado na sidebar, no pop-up do perfil e no card do
 * plano: paga = ATIVO (verde); teste com dias positivos = TESTE GRÁTIS (amarelo,
 * inclusive dias adicionados pelo master — o `access_until` é a fonte única);
 * vencido/suspenso = RENOVAR (vermelho).
 */
export function planState(
  business: PlanInput | null | undefined,
  hasPaid?: boolean | null,
): PlanState {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const until = business?.access_until
    ? new Date(new Date(business.access_until).setHours(0, 0, 0, 0))
    : null;
  const daysLeft = until ? Math.round((until.getTime() - startOfToday.getTime()) / DAY_MS) : null;
  const daysLate = daysLeft != null ? Math.max(-daysLeft, 0) : 0;
  const trial = business ? trialInfo({ trial_days: business.trial_days ?? null, trial_created_at: business.trial_created_at ?? null }) : null;

  const renew = (detail: string): PlanState => ({
    tone: "renovar",
    label: "Renovar",
    detail,
    daysLeft: daysLeft ?? -(trial?.remaining ?? 0),
    badgeClass: "border-destructive/50 bg-destructive/10 text-destructive",
  });

  const ativo = (resto: number): PlanState => ({
    tone: "ativo",
    label: "Ativo",
    detail:
      resto === 0 ? "Assinatura vence hoje" : `Vence em ${resto} dia${resto === 1 ? "" : "s"}`,
    daysLeft: resto,
    badgeClass: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  });

  const teste = (resto: number): PlanState => ({
    tone: "teste",
    label: "Teste Grátis",
    detail:
      resto === 0
        ? "Último dia de teste"
        : `${resto} dia${resto === 1 ? "" : "s"} de teste restante${resto === 1 ? "" : "s"}`,
    daysLeft: resto,
    badgeClass: "border-amber-400/45 bg-amber-400/10 text-amber-300",
  });

  // Dados de pagamento ainda carregando: assume pelo cadastro/dias de teste.
  if (hasPaid == null || hasPaid === undefined) {
    if (business?.status === "suspenso") return renew("Conta suspensa");
    if (trial?.remaining != null && trial.remaining > 0) return teste(trial.remaining);
    if (daysLeft != null && daysLeft >= 0) return ativo(daysLeft);
    return daysLate > 0
      ? renew(`Vencido há ${daysLate} dia${daysLate === 1 ? "" : "s"}`)
      : renew("Renove para continuar");
  }

  if (hasPaid) {
    if (daysLeft == null || daysLeft < 0) {
      return daysLate > 0
        ? renew(`Vencido há ${daysLate} dia${daysLate === 1 ? "" : "s"}`)
        : renew("Renove para continuar");
    }
    return ativo(daysLeft);
  }
  // Nunca pagou: comportamento de teste.
  if (business?.status === "suspenso") return renew("Conta suspensa");
  if (daysLeft != null && daysLeft >= 0) return teste(daysLeft);
  return daysLate > 0
    ? renew(`Teste expirado (${daysLate} dia${daysLate === 1 ? "" : "s"})`)
    : renew("Renove para continuar");
}

/** Tona de cor da pílula da sidebar (.sbp-status). */
export const planStatusClass: Record<PlanTone, string> = {
  ativo: "is-active",
  teste: "is-trial",
  renovar: "is-renew",
};
