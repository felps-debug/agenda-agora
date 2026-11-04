import { useState } from "react";
import {
  Calculator,
  Users,
  ShoppingCart,
  Target,
  Trophy,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Wallet,
  CalendarDays,
  ClipboardCheck,
} from "lucide-react";

const money = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const number = (value: string) => Math.max(0, Number(value) || 0);

const initialValues = {
  commission: "50",
  dailyRegistrations: "10",
  workDays: "5",
  weeklySales: "3",
  extraWeeklyBonus: "0",
  dailyBonusThreshold: "20",
  dailyBonusValue: "50",
  bonusDays: "0",
  monthlyWeeks: "4",
};

export default function SDRCalculator() {
  const [values, setValues] = useState(initialValues);
  const [showDetails, setShowDetails] = useState(false);

  const update = (field: keyof typeof initialValues, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const commission = number(values.commission);
  const dailyRegistrations = number(values.dailyRegistrations);
  const workDays = Math.min(7, number(values.workDays));
  const weeklySales = number(values.weeklySales);
  const extraBonus = number(values.extraWeeklyBonus);
  const bonusThreshold = number(values.dailyBonusThreshold);
  const dailyBonus = number(values.dailyBonusValue);
  const bonusDays = Math.min(workDays, number(values.bonusDays));
  const monthlyWeeks = number(values.monthlyWeeks);

  const weeklyRegistrations = dailyRegistrations * workDays;

  const conversion =
    weeklyRegistrations > 0
      ? (weeklySales / weeklyRegistrations) * 100
      : 0;

  const weeklyCommissions = commission * weeklySales;

  // O cenário considera que a meta semanal de vendas foi atingida.
  const weeklyRegistrationBonus = dailyBonus * bonusDays;
  const weeklyEarnings =
    weeklyCommissions + extraBonus + weeklyRegistrationBonus;

  const monthlyEarnings = weeklyEarnings * monthlyWeeks;

  const reset = () => {
    setValues(initialValues);
    setShowDetails(false);
  };

  const inputClass =
    "mt-1 w-full min-w-0 rounded-xl border border-white/10 bg-[#090D14] px-3 py-3 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  const labelClass = "text-xs font-medium text-gray-400";

  function Field({
    label,
    value,
    onChange,
    hint,
    min = 0,
    max,
    step = 1,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    hint?: string;
    min?: number;
    max?: number;
    step?: number;
  }) {
    return (
      <label className="block min-w-0">
        <span className={labelClass}>{label}</span>
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
        {hint && (
          <span className="mt-1 block text-xs leading-relaxed text-gray-500">
            {hint}
          </span>
        )}
      </label>
    );
  }

  function Metric({
    label,
    value,
    icon: Icon,
    color = "text-white",
  }: {
    label: string;
    value: string;
    icon: typeof Users;
    color?: string;
  }) {
    return (
      <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-[#10151E] p-4">
        <Icon className="mb-3 h-5 w-5 text-blue-400" />
        <p className="text-xs leading-relaxed text-gray-400">{label}</p>
        <p className={`mt-1 break-words text-xl font-bold ${color}`}>
          {value}
        </p>
      </div>
    );
  }

  return (
    <main className="w-full bg-[#080B11] p-3 text-white sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Cabeçalho */}
        <header className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-3">
            <Calculator className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Calculadora de metas SDR
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Agenda Agora · Simulador de ganhos e comissões
            </p>
          </div>
        </header>

        {/* Configurações */}
        <section className="space-y-5 rounded-2xl border border-white/10 bg-[#0D1119] p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-400" />
            <h2 className="font-semibold">1. Configurar metas</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Comissão por assinatura (R$)"
              value={values.commission}
              onChange={(v) => update("commission", v)}
              step={0.01}
            />
            <Field
              label="Cadastros confirmados por dia"
              value={values.dailyRegistrations}
              onChange={(v) => update("dailyRegistrations", v)}
            />
            <Field
              label="Dias trabalhados por semana"
              value={values.workDays}
              onChange={(v) => update("workDays", v)}
              min={1}
              max={7}
            />
            <Field
              label="Meta de assinaturas pagas/semana"
              value={values.weeklySales}
              onChange={(v) => update("weeklySales", v)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric
              label="Cadastros previstos por semana"
              value={weeklyRegistrations.toLocaleString("pt-BR")}
              icon={Users}
            />
            <Metric
              label="Conversão estimada"
              value={`${conversion.toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}%`}
              icon={Target}
              color="text-blue-400"
            />
            <Metric
              label="Comissão se atingir a meta"
              value={money(weeklyCommissions)}
              icon={ShoppingCart}
              color="text-emerald-400"
            />
          </div>

          <p className="text-xs leading-relaxed text-gray-500">
            A conversão acima é uma projeção da meta de vendas dividida pelos
            cadastros previstos. Para medir a conversão real, considere apenas
            as turmas de cadastros que já tiveram tempo de completar o ciclo
            de teste, cobrança e tolerância.
          </p>
        </section>

        {/* Bônus */}
        <section className="space-y-5 rounded-2xl border border-white/10 bg-[#0D1119] p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="font-semibold">2. Bônus e incentivos</h2>
          </div>

          <Field
            label="Bônus extra ao bater a meta semanal (R$)"
            value={values.extraWeeklyBonus}
            onChange={(v) => update("extraWeeklyBonus", v)}
            step={0.01}
            hint="Valor adicional no cenário de meta semanal atingida. Use zero se não houver bônus extra."
          />

          <div className="space-y-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-400/10 p-2">
                <ClipboardCheck className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold">
                  Bônus por cadastros confirmados
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-400">
                  Pode ser pago mesmo que nenhuma assinatura tenha sido
                  confirmada, desde que os critérios de cadastro sejam
                  cumpridos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Cadastros necessários por dia"
                value={values.dailyBonusThreshold}
                onChange={(v) => update("dailyBonusThreshold", v)}
              />
              <Field
                label="Valor do bônus por dia (R$)"
                value={values.dailyBonusValue}
                onChange={(v) => update("dailyBonusValue", v)}
                step={0.01}
              />
            </div>

            <Field
              label="Dias em que atingiu a meta de cadastros"
              value={values.bonusDays}
              onChange={(v) => update("bonusDays", v)}
              min={0}
              max={workDays}
              hint={`Informe de 0 a ${workDays} dias. O bônus é calculado pelo número de dias informado, limitado aos dias trabalhados.`}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#090D14] p-3">
              <div>
                <p className="text-sm text-gray-300">
                  Bônus por cadastros na semana
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {bonusDays} dia(s) × {money(dailyBonus)}
                </p>
              </div>
              <p className="text-lg font-bold text-amber-400">
                {money(weeklyRegistrationBonus)}
              </p>
            </div>

            <p className="text-xs leading-relaxed text-gray-500">
              A calculadora não verifica automaticamente se cada dia atingiu
              o limite de cadastros. Informe apenas os dias efetivamente
              elegíveis. Na integração definitiva, essa validação deve vir
              dos registros reais do sistema.
            </p>
          </div>
        </section>

        {/* Resultado semanal */}
        <section className="overflow-hidden rounded-2xl border border-blue-400/20 bg-[#0D1728]">
          <div className="space-y-2 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-blue-300">
              <Wallet className="h-5 w-5" />
              <p className="text-sm font-medium">
                Ganho estimado por semana
              </p>
            </div>

            <p className="break-words text-3xl font-bold tracking-tight sm:text-4xl">
              {money(weeklyEarnings)}
            </p>
            <p className="text-xs text-gray-400">
              Cenário em que a meta de assinaturas pagas é atingida e os
              bônus configurados são elegíveis.
            </p>
          </div>

          <div className="space-y-3 border-t border-white/10 bg-black/10 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-400">
                Comissões ({weeklySales} assinaturas)
              </span>
              <span className="font-medium">{money(weeklyCommissions)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-400">Bônus extra semanal</span>
              <span className="font-medium">{money(extraBonus)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-400">Bônus por cadastros</span>
              <span className="font-medium">
                {money(weeklyRegistrationBonus)}
              </span>
            </div>
          </div>
        </section>

        {/* Resultado mensal */}
        <section className="rounded-2xl border border-white/10 bg-[#0D1119] p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-400" />
            <h2 className="font-semibold">3. Projeção mensal</h2>
          </div>

          <label className="mt-4 block">
            <span className={labelClass}>Semanas consideradas no mês</span>
            <select
              value={values.monthlyWeeks}
              onChange={(e) => update("monthlyWeeks", e.target.value)}
              className={inputClass}
            >
              <option value="4">4 semanas</option>
              <option value="4.33">4,33 semanas (média mensal)</option>
            </select>
          </label>

          <div className="mt-4 rounded-xl bg-[#101C2D] p-4">
            <p className="text-xs text-gray-400">
              Ganho estimado no período
            </p>
            <p className="mt-2 break-words text-3xl font-bold text-blue-400">
              {money(monthlyEarnings)}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">
              Projeção bruta baseada na repetição do mesmo desempenho
              semanal. Não representa garantia de renda nem inclui
              descontos, impostos ou outros ajustes.
            </p>
          </div>
        </section>

        {/* Memória de cálculo */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D1119]">
          <button
            type="button"
            onClick={() => setShowDetails((previous) => !previous)}
            aria-expanded={showDetails}
            className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-white/[0.03]"
          >
            <span className="text-sm font-medium">Memória de cálculo</span>
            {showDetails ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {showDetails && (
            <div className="space-y-3 border-t border-white/10 p-4">
              {[
                [
                  "Cadastros semanais",
                  `${dailyRegistrations} × ${workDays} = ${weeklyRegistrations}`,
                ],
                [
                  "Conversão projetada",
                  `${conversion.toLocaleString("pt-BR", {
                    maximumFractionDigits: 2,
                  })}%`,
                ],
                [
                  "Comissões semanais",
                  money(weeklyCommissions),
                ],
                [
                  "Bônus semanal total",
                  money(extraBonus + weeklyRegistrationBonus),
                ],
                ["Ganho semanal", money(weeklyEarnings)],
                ["Ganho mensal", money(monthlyEarnings)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 text-sm"
                >
                  <span className="text-gray-400">{label}</span>
                  <span className="text-right font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Restaurar */}
        <button
          type="button"
          onClick={reset}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0D1119] px-4 py-3 text-sm font-medium text-gray-300 transition hover:border-blue-400/30 hover:bg-blue-500/5"
        >
          <RotateCcw className="h-4 w-4" />
          Restaurar valores iniciais
        </button>

        <p className="pb-4 text-center text-xs leading-relaxed text-gray-500">
          Simulador de planejamento comercial · Os resultados dependem
          das metas, dos pagamentos confirmados e das regras de comissão
          definidas pela Agenda Agora.
        </p>
      </div>
    </main>
  );
}
