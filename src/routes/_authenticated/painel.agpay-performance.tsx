import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { requireMasterAccess } from "@/lib/master.functions";
import { getAgpayPerformance } from "@/lib/agpay-performance.functions";

import { Button } from "@/components/ui/button";
import {
  KpiCard,
  TONE_BLUE,
  TONE_GREEN,
  TONE_AMBER,
  TONE_VIOLET,
  TONE_RED,
} from "@/components/master/PlatformOverview";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  Wallet,
  Building2,
  ArrowDownToLine,
  Activity,
  ClipboardList,
  ChevronDown,
  Check,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/painel/agpay-performance")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Ag Pay — Performance — Painel master" },
      { name: "description", content: "Performance financeira e operacional do Ag Pay." },
    ],
  }),
  component: AgpayPerformancePage,
});

type PeriodKey = "today" | "7d" | "30d" | "90d" | "month" | "prevMonth" | "year";

function periodRange(key: PeriodKey): { from: string; to: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let from: Date;
  let to: Date = new Date(now);
  switch (key) {
    case "today":
      from = startOfDay(now);
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "prevMonth":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

const periodOptions: { value: PeriodKey; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "month", label: "Este mês" },
  { value: "prevMonth", label: "Mês anterior" },
  { value: "year", label: "Este ano" },
];

function periodLabel(key: PeriodKey): string {
  return periodOptions.find((o) => o.value === key)?.label ?? "Últimos 30 dias";
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AgpayPerformancePage() {
  const fn = useServerFn(getAgpayPerformance);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [rankingOpen, setRankingOpen] = useState(false);
  const range = useMemo(() => periodRange(period), [period]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["carteira-desempenho", period],
    queryFn: () => fn({ data: range }),
  });

  const kpi = data?.kpi;

  const withdrawalProfitByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of data?.withdrawals ?? []) {
      const day = w.createdAt.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + (w.platformFeeCents ?? 0));
    }
    return map;
  }, [data?.withdrawals]);

  return (
    <div className="mx-auto w-full p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight">
            Ag Pay — Performance
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhamento financeiro e operacional da carteira.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="prevMonth">Mês anterior</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando indicadores…</p>}
      {isError && <p className="text-destructive">Erro ao carregar dados.</p>}

      {data && kpi && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Volume transacionado"
              value={money(kpi.signalVolumeCents)}
              hint={`${kpi.signalCount} sinais pagos`}
              tone={TONE_BLUE}
              icon={<Activity className="size-[1.05rem]" strokeWidth={1.8} />}
            />
            <KpiCard
              label="Receita Ag Pay"
              value={money(kpi.revenueCents)}
              hint={`Média ${money(kpi.avgRevenuePerTx)}/tx`}
              tone={TONE_GREEN}
              icon={<DollarSign className="size-[1.05rem]" strokeWidth={1.8} />}
            />
            <KpiCard
              label="Lucro (comissão)"
              value={money(kpi.estimatedProfitCents)}
              hint="comissão registrada no ledger no período"
              tone={TONE_AMBER}
              icon={<TrendingUp className="size-[1.05rem]" strokeWidth={1.8} />}
            />
            <KpiCard
              label="Ticket médio sinal"
              value={money(kpi.avgSignalCents)}
              hint={`Receita média ${money(kpi.avgRevenuePerTx)}`}
              tone={TONE_VIOLET}
              icon={<Wallet className="size-[1.05rem]" strokeWidth={1.8} />}
            />
            <KpiCard
              label="Estabelecimentos ativos"
              value={String(kpi.businessesWithSignals)}
              hint={`de ${kpi.totalBusinesses} cadastrados`}
              tone={TONE_BLUE}
              icon={<Building2 className="size-[1.05rem]" strokeWidth={1.8} />}
            />
            <KpiCard
              label="Saques pendentes"
              value={money(kpi.pendingWithdrawalsCents)}
              hint={`${kpi.pendingWithdrawalsCount} solicitações`}
              tone={TONE_RED}
              icon={<ArrowDownToLine className="size-[1.05rem]" strokeWidth={1.8} />}
            />
            <KpiCard
              label="Saques concluídos"
              value={money(kpi.completedWithdrawalsCents)}
              hint={`${kpi.completedWithdrawalsCount} operações`}
              tone={TONE_GREEN}
              icon={<ArrowDownToLine className="size-[1.05rem]" strokeWidth={1.8} />}
            />
            <KpiCard
              label="Taxas de saque"
              value={money(kpi.withdrawalFeesCents)}
              hint="soma registrada no ledger"
              tone={TONE_VIOLET}
              icon={<DollarSign className="size-[1.05rem]" strokeWidth={1.8} />}
            />
          </div>

          {/* Chart */}
          <section className="report-luminous-card report-effect-medium p-4">
            <div className="relative z-10 flex flex-wrap items-center gap-4">
              <span className="report-icon-box">
                <TrendingUp className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
                  Evolução financeira do Ag Pay
                </h2>
                <p className="text-sm text-[#777d87]">
                  Volume, receita e lucro de saques no período.
                </p>
              </div>
            </div>
            <div className="relative z-10 mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.daily.map((d) => ({
                    ...d,
                    profitCents: d.profitCents,
                    withdrawalProfitCents: withdrawalProfitByDay.get(d.date) ?? 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(v), "dd/MM", { locale: ptBR })}
                  />
                  <YAxis tickFormatter={(v) => (v / 100).toLocaleString("pt-BR")} />
                  <Tooltip
                    formatter={(v: number) => money(v)}
                    labelFormatter={(v) => format(new Date(v), "dd/MM/yyyy", { locale: ptBR })}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="volumeCents" name="Volume" stroke="#3b82f6" />
                  <Line
                    type="monotone"
                    dataKey="revenueCents"
                    name="Receita Ag Pay"
                    stroke="#22c55e"
                  />
                  <Line
                    type="monotone"
                    dataKey="withdrawalProfitCents"
                    name="Lucro Saque Ag Pay"
                    stroke="#f59e0b"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Cards de atalho */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/painel/transacoes"
              className="report-luminous-card report-effect-subtle group p-4"
            >
              <span className="report-icon-box relative z-10 transition-transform group-hover:scale-105">
                <ClipboardList className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="relative z-10 mt-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--c-eef1f6)]">
                  Transações
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#777d87]">
                  Histórico
                </p>
              </div>
            </Link>
            <Link
              to="/painel/carteira-config"
              className="report-luminous-card report-effect-subtle group p-4"
            >
              <span className="report-icon-box relative z-10 transition-transform group-hover:scale-105">
                <Settings className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="relative z-10 mt-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--c-eef1f6)]">
                  Configurações
                </h3>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#777d87]">
                  Sistema
                </p>
              </div>
            </Link>
          </div>

          {/* Businesses ranking */}
          <section className="report-luminous-card report-effect-medium p-4">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="report-icon-box">
                  <ClipboardList className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
                    Estabelecimentos no Ag Pay
                  </h2>
                  <p className="text-sm text-[#777d87]">Ranking por volume no período.</p>
                </div>
              </div>
              <div className="relative">
                <button
                  onClick={() => setRankingOpen(!rankingOpen)}
                  className="bg-black/40 border border-white/10 hover:border-white/20 text-xs font-medium text-[var(--c-e6e9ee)] px-4 py-2.5 rounded-xl flex items-center gap-2 transition"
                >
                  <span>{periodLabel(period)}</span>
                  <ChevronDown className="w-4 h-4 text-[#777d87]" />
                </button>
                {rankingOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-[#12141c] border border-white/10 rounded-2xl shadow-2xl py-2 z-50">
                    {periodOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setPeriod(opt.value);
                          setRankingOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-[var(--c-e6e9ee)] hover:bg-white/[0.06] flex items-center justify-between transition"
                      >
                        <span>{opt.label}</span>
                        {period === opt.value && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="relative z-10 mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-white/[0.035] text-left text-xs uppercase text-[#777d87]">
                  <tr>
                    <th className="text-left px-4 py-3">Estabelecimento</th>
                    <th className="text-right px-4 py-3">Sinais</th>
                    <th className="text-right px-4 py-3">Volume</th>
                    <th className="text-right px-4 py-3">Receita</th>
                    <th className="text-right px-4 py-3">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {data.businesses
                    .slice()
                    .sort((a, b) => b.volumeCents - a.volumeCents)
                    .map((b) => (
                      <tr key={b.businessId} className="border-t border-border">
                        <td className="px-4 py-3">{b.name}</td>
                        <td className="px-4 py-3 text-right">{b.signalCount}</td>
                        <td className="px-4 py-3 text-right">{money(b.volumeCents)}</td>
                        <td className="px-4 py-3 text-right">{money(b.revenueCents)}</td>
                        <td className="px-4 py-3 text-right">{money(b.profitCents)}</td>
                      </tr>
                    ))}
                  {!data.businesses.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        Sem dados no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
