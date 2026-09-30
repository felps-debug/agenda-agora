import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";
import { completedReportMetrics } from "@/lib/report-metrics";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { ReportChart } from "@/components/painel/ReportChart";
import {
  CalendarCheck2,
  ChartNoAxesColumnIncreasing,
  CircleDollarSign,
  HandCoins,
  Scissors,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

// Antes usava React.lazy() aqui pra manter a recharts fora do bundle das rotas
// de agendamento/agenda, mas isso duplicava o code-splitting que o TanStack
// Start já faz por rota (esta tela já é seu próprio chunk) e causava um bug
// de produção: "TypeError: le is not a function" no chunk minificado da
// recharts, por causa de uma corrida no carregamento dos chunks aninhados.
// Import direto resolve sem perder o isolamento do bundle.

export const Route = createFileRoute("/_authenticated/painel/relatorio")({
  head: () => ({
    meta: [
      { title: "Relatório — Agenda Agora" },
      { name: "description", content: "Desempenho de atendimentos, faturamento e ocupação." },
      { property: "og:title", content: "Relatório — Agenda Agora" },
      { property: "og:description", content: "Desempenho e faturamento do negócio." },
    ],
  }),
  component: RelatorioPage,
});

const RANGES = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

function RelatorioPage() {
  const { businessId } = useBusiness();
  const [days, setDays] = useState(30);

  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days]);

  const { data } = useQuery({
    queryKey: ["report", businessId, days],
    enabled: !!businessId,
    queryFn: async () => {
      const [appts, services, pros] = await Promise.all([
        supabase
          .from("appointments")
          .select(
            "id, starts_at, status, service_id, professional_id, customer_name, deposit_cents, deposit_paid_at",
          )
          .eq("business_id", businessId!)
          .gte("starts_at", since)
          .order("starts_at"),
        supabase.from("services").select("id, name, price_cents").eq("business_id", businessId!),
        supabase.from("professionals").select("id, name").eq("business_id", businessId!),
      ]);
      if (appts.error) throw appts.error;
      return {
        appointments: appts.data ?? [],
        services: services.data ?? [],
        professionals: pros.data ?? [],
      };
    },
  });

  const report = useMemo(() => {
    const appts = (data?.appointments ?? []).filter((a) => a.status !== "bloqueado");
    const metrics = completedReportMetrics(appts, data?.services ?? [], data?.professionals ?? []);
    const done = appts.filter((a) => a.status === "concluido");
    const canceled = appts.filter((a) => a.status === "cancelado");
    const revenue = metrics.revenue;
    // Sinal pago é dinheiro que já entrou, independente do atendimento já ter sido
    // marcado como concluído — por isso não filtra por `done` como o faturamento.
    const deposits = appts
      .filter((a) => a.deposit_paid_at)
      .reduce((sum, a) => sum + (a.deposit_cents ?? 0), 0);
    const { byService, byProfessional } = metrics;

    const perDay = new Map<string, number>();
    for (const a of appts) {
      const key = new Date(a.starts_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    const chart = [...perDay.entries()].map(([dia, total]) => ({ dia, total }));

    const clients = new Set(appts.map((a) => a.customer_name.trim().toLowerCase()));

    return {
      total: appts.length,
      done: metrics.done,
      canceled: canceled.length,
      revenue,
      deposits,
      byService,
      byProfessional,
      chart,
      clients: clients.size,
      ticket: metrics.done ? Math.round(revenue / metrics.done) : 0,
    };
  }, [data]);

  if (!businessId) return <NoBusiness />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório"
        subtitle="Faturamento, atendimentos e ocupação do período."
        action={
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <Button
                key={r.days}
                size="sm"
                variant={days === r.days ? "default" : "outline"}
                onClick={() => setDays(r.days)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          icon={WalletCards}
          effect="strong"
          label="Faturamento"
          value={formatPrice(report.revenue)}
          hint="Serviços concluídos"
        />
        <Card
          icon={HandCoins}
          effect="medium"
          label="Sinais recebidos"
          value={formatPrice(report.deposits)}
          hint="Pagos pelo cliente"
        />
        <Card
          icon={CalendarCheck2}
          effect="subtle"
          label="Atendimentos"
          value={String(report.total)}
          hint={`${report.done} concluídos · ${report.canceled} cancelados`}
        />
        <Card
          icon={CircleDollarSign}
          effect="none"
          label="Ticket médio"
          value={formatPrice(report.ticket)}
          hint={`${report.clients} cliente(s) no período`}
        />
      </div>

      <section className="report-luminous-card report-effect-none report-chart-card p-5 sm:p-6">
        <ReportCardTitle icon={ChartNoAxesColumnIncreasing} title="Atendimentos por dia" />
        {report.chart.length ? (
          <div className="relative z-10 mt-5 h-64">
            <ReportChart chart={report.chart} />
          </div>
        ) : (
          <p className="relative z-10 flex min-h-36 items-center justify-center text-center text-sm text-muted-foreground">
            Nenhum atendimento no período.
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          icon={Scissors}
          title="Serviços mais vendidos"
          rows={report.byService.map((s) => ({
            name: s.name,
            value: `${s.total}x · ${formatPrice(s.valor)}`,
          }))}
        />
        <ListCard
          icon={UsersRound}
          title="Ocupação por profissional"
          rows={report.byProfessional.map((p) => ({
            name: p.name,
            value: `${p.total} atendimento(s)`,
          }))}
        />
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  effect,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  effect: "strong" | "medium" | "subtle" | "none";
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article
      className={`report-luminous-card report-effect-${effect} report-metric-card p-4 sm:p-[1.125rem]`}
    >
      <div className="report-icon-box">
        <Icon className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div className="relative z-10 mt-4">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[#70757f]">
          {label}
        </p>
        <p className="mt-1.5 text-[1.35rem] font-semibold leading-none tracking-[-0.025em] text-[#f2f4f8]">
          {value}
        </p>
        {hint && <p className="mt-2 text-xs leading-relaxed text-[#777d87]">{hint}</p>}
      </div>
    </article>
  );
}

function ReportCardTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="relative z-10 flex items-center gap-3">
      <div className="report-icon-box">
        <Icon className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[#eef1f6]">{title}</h2>
    </div>
  );
}

function ListCard({
  icon,
  title,
  rows,
}: {
  icon: LucideIcon;
  title: string;
  rows: { name: string; value: string }[];
}) {
  return (
    <section className="report-luminous-card report-effect-none report-list-card p-5 sm:p-6">
      <ReportCardTitle icon={icon} title={title} />
      {rows.length ? (
        <ul className="relative z-10 mt-5 space-y-2 text-sm">
          {rows.map((r) => (
            <li
              key={r.name}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.055] bg-black/20 px-3.5 py-3"
            >
              <span className="text-[#dfe3ea]">{r.name}</span>
              <span className="shrink-0 text-[#777d87]">{r.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="relative z-10 flex min-h-32 items-center justify-center text-center text-sm text-muted-foreground">
          Sem dados no período.
        </p>
      )}
    </section>
  );
}
