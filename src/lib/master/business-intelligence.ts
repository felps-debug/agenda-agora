/**
 * Regras de negócio da ficha de inteligência do estabelecimento (Painel 3 Master).
 *
 * Este módulo é puro (sem I/O) para que os critérios de cálculo fiquem
 * centralizados, documentados e testáveis. A camada de servidor só coleta os
 * dados reais do banco e delega os cálculos para cá.
 */

/** Status de agendamento que representa atendimento concluído. */
export const APPOINTMENT_STATUS_CONCLUDED = "concluido";
/** Status de agendamento que representa cancelamento. */
export const APPOINTMENT_STATUS_CANCELED = "cancelado";

export type MasterAppointmentRow = {
  id: string;
  status: string;
  starts_at: string;
  created_at: string;
  service_id: string | null;
  professional_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
};

export type MasterCustomerRow = {
  id: string;
  name: string | null;
  created_at: string;
};

export type MasterServiceRow = {
  id: string;
  name: string;
  price_cents: number | null;
};

export type MasterProfessionalRow = {
  id: string;
  name: string;
};

export type MasterPaymentRow = {
  reference_month: string;
  status: string;
  amount_cents: number;
  paid_at: string | null;
  created_at: string;
};

export type MasterDepositRow = {
  id: string;
  status: string;
  amount_cents: number;
  net_amount_cents: number | null;
  gateway_fee_cents: number | null;
  platform_commission_cents: number | null;
  created_at: string;
  paid_at: string | null;
};

export type MasterSubscriptionRow = {
  status: string;
  amount_cents: number;
  paid_at: string | null;
  created_at: string;
};

export const WEEKDAY_LABELS: string[] = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const HOUR_LABELS: string[] = Array.from(
  { length: 24 },
  (_, hour) => `${String(hour).padStart(2, "0")}h`,
);

/**
 * Limites da classificação "Saúde da conta". Ficam em um único lugar para que
 * regras de risco não fiquem espalhadas pelo código.
 */
export const HEALTH_THRESHOLDS = {
  /** Dias sem acesso do responsável para entrar em "precisa de atenção". */
  inactivityWarningDays: 10,
  /** Dias sem acesso do responsável para entrar em "em risco". */
  inactivityRiskDays: 30,
  /** Dias sem nenhum agendamento após a ativação da conta. */
  noBookingAfterActivationDays: 14,
  /** Queda percentual contra o período anterior que indica risco de abandono. */
  usageDropPercent: 40,
  /** Dias restantes de teste que já exigem alerta. */
  trialEndingSoonDays: 3,
  /** Percentual mínimo de configuração para a conta ser considerada ativa. */
  setupMinimumPercent: 60,
} as const;

export type HealthStatus = "saudavel" | "atencao" | "risco" | "sem_dados";

export type HealthReason = {
  code: string;
  title: string;
  detail: string;
  severity: "info" | "aviso" | "critico";
};

export type HealthInput = {
  /** Existe algum dado de uso (agendamento, cliente ou pagamento)? */
  hasUsageData: boolean;
  /** Dias desde o último acesso do responsável (null = nunca acessou). */
  daysSinceLastAccess: number | null;
  /** Dias desde o último agendamento (null = nunca houve). */
  daysSinceLastAppointment: number | null;
  /** Agendamentos (não cancelados) no período corrente. */
  periodAppointments: number;
  /** Agendamentos (não cancelados) no período anterior (mesmo tamanho). */
  previousPeriodAppointments: number;
  /** Dias desde a criação da conta. */
  daysSinceSignup: number;
  /** Percentual de configuração inicial concluído (0–100). */
  setupPercent: number;
  /** Situação da cobrança do mês corrente. */
  paymentStatus: "pago" | "pendente" | "inexistente";
  /** Dias restantes do período de teste (null = não está em teste). */
  trialDaysRemaining: number | null;
};

export type HealthEvaluation = {
  status: HealthStatus;
  /** Pontuação explicável (0–100). `null` quando não há dados suficientes. */
  score: number | null;
  reasons: HealthReason[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Classifica a conta e explica o motivo de cada alerta.
 * A pontuação é um indicador operacional, não uma previsão de cancelamento.
 */
export function evaluateAccountHealth(input: HealthInput): HealthEvaluation {
  const reasons: HealthReason[] = [];
  if (!input.hasUsageData) {
    return {
      status: "sem_dados",
      score: null,
      reasons: [
        {
          code: "sem_dados",
          title: "Dados insuficientes",
          detail:
            "A conta ainda não tem agendamentos, clientes ou cobranças para classificar a saúde.",
          severity: "info",
        },
      ],
    };
  }

  let score = 100;

  if (input.daysSinceLastAccess == null) {
    score -= 15;
    reasons.push({
      code: "sem_acesso",
      title: "Responsável nunca acessou a plataforma",
      detail: "Nenhum login registrado para o dono deste estabelecimento.",
      severity: "aviso",
    });
  } else if (input.daysSinceLastAccess >= HEALTH_THRESHOLDS.inactivityRiskDays) {
    score -= 35;
    reasons.push({
      code: "inativo_risco",
      title: `Sem acesso há ${input.daysSinceLastAccess} dias`,
      detail: `O responsável não acessa a plataforma há mais de ${HEALTH_THRESHOLDS.inactivityRiskDays} dias.`,
      severity: "critico",
    });
  } else if (input.daysSinceLastAccess >= HEALTH_THRESHOLDS.inactivityWarningDays) {
    score -= 15;
    reasons.push({
      code: "inativo_atencao",
      title: `Sem acesso há ${input.daysSinceLastAccess} dias`,
      detail: `O responsável não acessa a plataforma há mais de ${HEALTH_THRESHOLDS.inactivityWarningDays} dias.`,
      severity: "aviso",
    });
  }

  if (
    input.daysSinceLastAppointment == null &&
    input.daysSinceSignup >= HEALTH_THRESHOLDS.noBookingAfterActivationDays
  ) {
    score -= 30;
    reasons.push({
      code: "sem_agendamento",
      title: "Nenhum agendamento após a ativação",
      detail: `A conta foi criada há ${input.daysSinceSignup} dias e ainda não recebeu agendamentos.`,
      severity: "critico",
    });
  } else if (
    input.daysSinceLastAppointment != null &&
    input.daysSinceLastAppointment >= HEALTH_THRESHOLDS.inactivityRiskDays
  ) {
    score -= 20;
    reasons.push({
      code: "uso_parado",
      title: `Sem agendamentos há ${input.daysSinceLastAppointment} dias`,
      detail: "A operação de agendamentos está parada há mais de 30 dias.",
      severity: "aviso",
    });
  }

  const previous = input.previousPeriodAppointments;
  if (previous >= 3 && input.periodAppointments < previous) {
    const drop = Math.round(((previous - input.periodAppointments) / previous) * 100);
    if (drop >= HEALTH_THRESHOLDS.usageDropPercent) {
      score -= 20;
      reasons.push({
        code: "queda_uso",
        title: `Queda de ${drop}% no volume`,
        detail: `O período atual tem ${input.periodAppointments} agendamentos contra ${previous} no período anterior.`,
        severity: "aviso",
      });
    }
  }

  if (input.setupPercent < HEALTH_THRESHOLDS.setupMinimumPercent) {
    score -= 15;
    reasons.push({
      code: "configuracao_incompleta",
      title: "Configuração inicial incompleta",
      detail: `Apenas ${input.setupPercent}% das etapas iniciais de configuração foram concluídas.`,
      severity: "aviso",
    });
  }

  if (input.paymentStatus === "pendente") {
    score -= 20;
    reasons.push({
      code: "cobranca_pendente",
      title: "Cobrança do mês em aberto",
      detail: "A mensalidade do mês corrente ainda não foi registrada como paga.",
      severity: "critico",
    });
  }

  if (
    input.trialDaysRemaining != null &&
    input.trialDaysRemaining <= HEALTH_THRESHOLDS.trialEndingSoonDays
  ) {
    score -= 10;
    reasons.push({
      code: "teste_terminando",
      title: `Teste termina em ${input.trialDaysRemaining} dia(s)`,
      detail: "Prepare a renovação ou o contato antes do fim do período gratuito.",
      severity: "aviso",
    });
  }

  score = clamp(score, 0, 100);
  const hasCritical = reasons.some((reason) => reason.severity === "critico");
  const hasWarning = reasons.some((reason) => reason.severity === "aviso");
  // Um alerta crítico (inatividade longa, cobrança em aberto, conta sem uso)
  // já coloca a conta em risco; sem alertas críticos a pontuação decide.
  const status: HealthStatus =
    hasCritical || score < 45 ? "risco" : hasWarning || score < 75 ? "atencao" : "saudavel";
  return { status, score, reasons };
}

export type UsageSummary = {
  /** Agendamentos iniciados dentro do período (inclui cancelados). */
  total: number;
  /** Agendamentos do período que não foram cancelados (uso efetivo). */
  usageCount: number;
  /** Agendamentos não cancelados do período anterior, mesma duração. */
  previousTotal: number;
  /** Variação percentual vs. período anterior (null quando não comparável). */
  variationPercent: number | null;
  completed: number;
  canceled: number;
  pending: number;
  future: number;
  byStatus: Array<{ status: string; count: number }>;
  byService: Array<{ id: string; name: string; count: number }>;
  byProfessional: Array<{ id: string; name: string; count: number }>;
  byHour: Array<{ hour: number; label: string; count: number }>;
  byWeekday: Array<{ weekday: number; label: string; count: number }>;
  /** Evolução diária do volume no período. */
  series: Array<{ date: string; count: number }>;
  lastAppointmentAt: string | null;
  /** Agendamentos concluídos no total (histórico, sem janela de tempo). */
  completedAllTime: number;
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function isCanceled(status: string) {
  return status === APPOINTMENT_STATUS_CANCELED;
}

function isCompleted(status: string) {
  return status === APPOINTMENT_STATUS_CONCLUDED;
}

/**
 * Resume a utilização do módulo de agendamentos em uma janela de tempo.
 *
 * Regras:
 * - o período considera `starts_at` dentro da janela;
 * - cancelados não contam como utilização (mas entram no total de cancelados);
 * - a comparação usa o período anterior de mesma duração;
 * - quando o período anterior tem menos de 3 agendamentos a variação não é
 *   exibida (volume insuficiente para uma taxa confiável).
 */
export function summarizeUsage(
  appointments: MasterAppointmentRow[],
  services: MasterServiceRow[],
  professionals: MasterProfessionalRow[],
  options: { now: Date; periodDays: number },
): UsageSummary {
  const { now, periodDays } = options;
  const periodMs = periodDays * 86_400_000;
  const nowMs = now.getTime();
  const startMs = nowMs - periodMs;
  const previousStartMs = startMs - periodMs;

  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  const professionalName = new Map(professionals.map((p) => [p.id, p.name]));

  let total = 0;
  let usageCount = 0;
  let previousTotal = 0;
  let completed = 0;
  let canceled = 0;
  let pending = 0;
  let future = 0;
  let completedAllTime = 0;
  const statusCount = new Map<string, number>();
  const serviceCount = new Map<string, number>();
  const professionalCount = new Map<string, number>();
  const hourCount = new Map<number, number>();
  const weekdayCount = new Map<number, number>();
  const seriesCount = new Map<string, number>();
  let lastAppointmentAt: string | null = null;

  for (const appointment of appointments) {
    if (isCompleted(appointment.status)) completedAllTime += 1;
    const startsAt = Date.parse(appointment.starts_at);
    if (!Number.isFinite(startsAt)) continue;
    if (lastAppointmentAt == null || appointment.starts_at > lastAppointmentAt) {
      lastAppointmentAt = appointment.starts_at;
    }
    if (startsAt < previousStartMs) continue;

    const canceledRow = isCanceled(appointment.status);
    if (startsAt >= startMs) {
      total += 1;
      if (!canceledRow) {
        usageCount += 1;
        if (startsAt >= nowMs) future += 1;
        const statusKey = appointment.status || "desconhecido";
        statusCount.set(statusKey, (statusCount.get(statusKey) ?? 0) + 1);
        const serviceId = appointment.service_id;
        if (serviceId) {
          serviceCount.set(serviceId, (serviceCount.get(serviceId) ?? 0) + 1);
        }
        const professionalId = appointment.professional_id;
        if (professionalId) {
          professionalCount.set(professionalId, (professionalCount.get(professionalId) ?? 0) + 1);
        }
        const start = new Date(startsAt);
        hourCount.set(start.getHours(), (hourCount.get(start.getHours()) ?? 0) + 1);
        weekdayCount.set(start.getDay(), (weekdayCount.get(start.getDay()) ?? 0) + 1);
        const key = dayKey(appointment.starts_at);
        seriesCount.set(key, (seriesCount.get(key) ?? 0) + 1);
      }
      if (canceledRow) canceled += 1;
      else if (isCompleted(appointment.status)) completed += 1;
      else pending += 1;
    } else if (!canceledRow) {
      previousTotal += 1;
    }
  }

  const variationPercent =
    previousTotal >= 3 ? Math.round(((usageCount - previousTotal) / previousTotal) * 100) : null;

  const series: Array<{ date: string; count: number }> = [];
  for (let index = periodDays - 1; index >= 0; index -= 1) {
    const date = new Date(nowMs - index * 86_400_000).toISOString().slice(0, 10);
    series.push({ date, count: seriesCount.get(date) ?? 0 });
  }

  return {
    total,
    usageCount,
    previousTotal,
    variationPercent,
    completed,
    canceled,
    pending,
    future,
    byStatus: [...statusCount.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    byService: [...serviceCount.entries()]
      .map(([id, count]) => ({ id, name: serviceName.get(id) ?? "Serviço removido", count }))
      .sort((a, b) => b.count - a.count),
    byProfessional: [...professionalCount.entries()]
      .map(([id, count]) => ({
        id,
        name: professionalName.get(id) ?? "Profissional removido",
        count,
      }))
      .sort((a, b) => b.count - a.count),
    byHour: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: HOUR_LABELS[hour] ?? `${String(hour).padStart(2, "0")}h`,
      count: hourCount.get(hour) ?? 0,
    })),
    byWeekday: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      label: WEEKDAY_LABELS[weekday] ?? "",
      count: weekdayCount.get(weekday) ?? 0,
    })),
    series,
    lastAppointmentAt,
    completedAllTime,
  };
}

export type ClientSummary = {
  /** Clientes cadastrados na base do estabelecimento. */
  total: number;
  /** Clientes criados dentro da janela. */
  newInPeriod: number;
  /** Clientes com ao menos um agendamento. */
  withAppointments: number;
  /** Clientes com agendamento futuro. */
  withFutureAppointment: number;
  /** Clientes que voltaram a agendar (mais de um agendamento). */
  recurring: number;
  /** Taxa de retorno sobre os clientes que agendaram (null se sem base). */
  recurrenceRate: number | null;
  /** Clientes sem novo agendamento há 30/60/90 dias. */
  inactive: Array<{ days: number; count: number }>;
};

export type ClientSummaryOptions = {
  now: Date;
  periodDays: number;
};

/**
 * Resume a base de clientes do estabelecimento.
 *
 * "Cliente" é a linha da tabela `customers`; o vínculo com o agendamento usa
 * `customer_id` e, quando ausente, telefone normalizado (mesma regra usada no
 * relatório existente do Painel 2).
 */
export function summarizeClients(
  customers: MasterCustomerRow[],
  appointments: MasterAppointmentRow[],
  options: ClientSummaryOptions,
): ClientSummary {
  const { now, periodDays } = options;
  const nowMs = now.getTime();
  const periodMs = periodDays * 86_400_000;
  const periodStartMs = nowMs - periodMs;

  const appointmentsByCustomer = new Map<string, number[]>();
  for (const appointment of appointments) {
    const key =
      appointment.customer_id ??
      (appointment.customer_phone
        ? `tel:${appointment.customer_phone.replace(/\D/g, "")}`
        : appointment.customer_name
          ? `nome:${appointment.customer_name.trim().toLowerCase()}`
          : null);
    if (!key) continue;
    const list = appointmentsByCustomer.get(key) ?? [];
    list.push(Date.parse(appointment.starts_at));
    appointmentsByCustomer.set(key, list);
  }

  let newInPeriod = 0;
  let withAppointments = 0;
  let withFutureAppointment = 0;
  let recurring = 0;
  const lastSeen: number[] = [];

  for (const customer of customers) {
    if (Date.parse(customer.created_at) >= periodStartMs) newInPeriod += 1;
    const list =
      appointmentsByCustomer.get(customer.id) ??
      appointmentsByCustomer.get(`tel:${(customer.name ?? "").replace(/\D/g, "")}`) ??
      [];
    if (list.length === 0) continue;
    withAppointments += 1;
    const last = Math.max(...list);
    lastSeen.push(last);
    if (list.some((value) => value >= nowMs)) withFutureAppointment += 1;
    if (list.length > 1) recurring += 1;
  }

  const inactive = [30, 60, 90].map((days) => ({
    days,
    count: lastSeen.filter((value) => nowMs - value >= days * 86_400_000).length,
  }));

  return {
    total: customers.length,
    newInPeriod,
    withAppointments,
    withFutureAppointment,
    recurring,
    recurrenceRate: withAppointments > 0 ? Math.round((recurring / withAppointments) * 100) : null,
    inactive,
  };
}

export type SubscriptionSummary = {
  planLabel: string;
  monthlyFeeCents: number;
  currentMonth: string;
  currentStatus: "pago" | "pendente" | "inexistente";
  lastPaidAt: string | null;
  lastPaidAmountCents: number | null;
  /** Próxima cobrança prevista (mês seguinte ao último pagamento pago). */
  nextChargeAt: string | null;
  paidCount: number;
  pendingCount: number;
  paidTotalCents: number;
  /** Meses de referência com cobrança em aberto (inadimplência). */
  delinquentMonths: number;
  history: MasterPaymentRow[];
};

export type SubscriptionSummaryInput = {
  monthlyFeeCents: number;
  payments: MasterPaymentRow[];
  /** Primeiro dia da assinatura (usa a criação da conta como referência). */
  startedAt: string | null;
  now: Date;
  isTrial: boolean;
};

/**
 * Resume a assinatura do estabelecimento usando apenas os registros de
 * `subscription_payments` (pagamentos confirmados de verdade).
 */
export function summarizeSubscription(input: SubscriptionSummaryInput): SubscriptionSummary {
  const { monthlyFeeCents, payments, now, isTrial } = input;
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const history = [...payments].sort((a, b) => b.reference_month.localeCompare(a.reference_month));
  const current = history.find((payment) => payment.reference_month.slice(0, 7) === currentMonth);
  const paid = history.filter((payment) => payment.status === "pago");
  const lastPaid = paid[0] ?? null;

  let nextChargeAt: string | null = null;
  if (lastPaid) {
    const base = new Date(`${lastPaid.reference_month.slice(0, 7)}-01T12:00:00Z`);
    base.setUTCMonth(base.getUTCMonth() + 1);
    nextChargeAt = base.toISOString();
  } else if (!isTrial && input.startedAt) {
    const base = new Date(input.startedAt);
    base.setUTCMonth(base.getUTCMonth() + 1);
    nextChargeAt = base.toISOString();
  }

  return {
    planLabel: isTrial ? "Teste Grátis" : "Plano Premium",
    monthlyFeeCents,
    currentMonth,
    currentStatus: current ? (current.status === "pago" ? "pago" : "pendente") : "inexistente",
    lastPaidAt: lastPaid?.paid_at ?? null,
    lastPaidAmountCents: lastPaid?.amount_cents ?? null,
    nextChargeAt,
    paidCount: paid.length,
    pendingCount: history.filter((payment) => payment.status !== "pago").length,
    paidTotalCents: paid.reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0),
    delinquentMonths: history.filter((payment) => payment.status !== "pago").length,
    history,
  };
}

export type DepositSummary = {
  total: number;
  paid: number;
  pending: number;
  canceled: number;
  volumeCents: number;
  paidVolumeCents: number;
  feesCents: number;
  netCents: number;
  platformCommissionCents: number;
};

/**
 * Resume o processamento de sinais Pix (AG Pay) do estabelecimento.
 * Apenas pagamentos confirmados entram em `paidVolumeCents`.
 */
export function summarizeDeposits(rows: MasterDepositRow[]): DepositSummary {
  const paidRows = rows.filter((row) => row.status === "pago" || row.status === "aprovado");
  const pendingRows = rows.filter((row) => row.status === "pendente");
  const canceledRows = rows.filter(
    (row) => row.status === "cancelado" || row.status === "estornado",
  );
  return {
    total: rows.length,
    paid: paidRows.length,
    pending: pendingRows.length,
    canceled: canceledRows.length,
    volumeCents: rows.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0),
    paidVolumeCents: paidRows.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0),
    feesCents: paidRows.reduce((sum, row) => sum + (row.gateway_fee_cents ?? 0), 0),
    netCents: paidRows.reduce((sum, row) => sum + (row.net_amount_cents ?? 0), 0),
    platformCommissionCents: paidRows.reduce(
      (sum, row) => sum + (row.platform_commission_cents ?? 0),
      0,
    ),
  };
}

export type SetupStep = {
  id: string;
  label: string;
  completed: boolean;
  detail: string;
};

export type SetupInput = {
  hasBasicData: boolean;
  servicesCount: number;
  professionalsCount: number;
  hasBusinessHours: boolean;
  hasPublicLink: boolean;
  usesReminders: boolean;
  usesWhatsapp: boolean;
  usesPix: boolean;
  hasReceivedAppointments: boolean;
};

/**
 * Etapas de configuração inicial do estabelecimento, derivadas de dados reais.
 */
export function summarizeSetup(input: SetupInput): { steps: SetupStep[]; percent: number } {
  const steps: SetupStep[] = [
    {
      id: "dados",
      label: "Dados básicos",
      completed: input.hasBasicData,
      detail: input.hasBasicData
        ? "Nome, segmento e contato preenchidos"
        : "Faltam dados de identificação",
    },
    {
      id: "servicos",
      label: "Serviços cadastrados",
      completed: input.servicesCount > 0,
      detail:
        input.servicesCount > 0
          ? `${input.servicesCount} serviço(s) cadastrado(s)`
          : "Nenhum serviço cadastrado",
    },
    {
      id: "profissionais",
      label: "Profissionais cadastrados",
      completed: input.professionalsCount > 0,
      detail:
        input.professionalsCount > 0
          ? `${input.professionalsCount} profissional(is)`
          : "Nenhum profissional cadastrado",
    },
    {
      id: "horario",
      label: "Horário de funcionamento",
      completed: input.hasBusinessHours,
      detail: input.hasBusinessHours ? "Horários configurados" : "Sem horários configurados",
    },
    {
      id: "link",
      label: "Link de agendamento",
      completed: input.hasPublicLink,
      detail: input.hasPublicLink ? "Página pública disponível" : "Sem página pública",
    },
    {
      id: "agendamentos",
      label: "Agendamentos recebidos",
      completed: input.hasReceivedAppointments,
      detail: input.hasReceivedAppointments
        ? "Já recebeu agendamentos"
        : "Ainda não recebeu agendamentos",
    },
  ];
  const completed = steps.filter((step) => step.completed).length;
  return { steps, percent: Math.round((completed / steps.length) * 100) };
}
