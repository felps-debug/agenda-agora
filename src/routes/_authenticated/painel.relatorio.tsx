import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";

// recharts é pesado (~90kB gzip) e só é usado nesta tela; lazy-load pra não
// entrar no bundle das rotas de agendamento/agenda.
const ReportChart = lazy(() =>
  import("@/components/painel/ReportChart").then((module) => ({
    default: module.ReportChart,
  })),
);

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
    const priceOf = (serviceId: string | null) =>
      data?.services.find((s) => s.id === serviceId)?.price_cents ?? 0;

    const done = appts.filter((a) => a.status === "concluido" || a.status === "confirmado");
    const canceled = appts.filter((a) => a.status === "cancelado");
    const revenue = done.reduce((sum, a) => sum + priceOf(a.service_id), 0);
    const deposits = appts
      .filter((a) => a.deposit_paid_at)
      .reduce((sum, a) => sum + (a.deposit_cents ?? 0), 0);

    const byService = (data?.services ?? [])
      .map((s) => ({
        name: s.name,
        total: appts.filter((a) => a.service_id === s.id).length,
        valor: appts.filter((a) => a.service_id === s.id).length * s.price_cents,
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total);

    const byProfessional = (data?.professionals ?? [])
      .map((p) => ({
        name: p.name,
        total: appts.filter((a) => a.professional_id === p.id).length,
      }))
      .filter((p) => p.total > 0)
      .sort((a, b) => b.total - a.total);

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
      done: done.length,
      canceled: canceled.length,
      revenue,
      deposits,
      byService,
      byProfessional,
      chart,
      clients: clients.size,
      ticket: done.length ? Math.round(revenue / done.length) : 0,
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
        <Card label="Faturamento" value={formatPrice(report.revenue)} hint="Serviços concluídos" />
        <Card
          label="Sinais recebidos"
          value={formatPrice(report.deposits)}
          hint="Pagos pelo cliente"
        />
        <Card
          label="Atendimentos"
          value={String(report.total)}
          hint={`${report.done} concluídos · ${report.canceled} cancelados`}
        />
        <Card
          label="Ticket médio"
          value={formatPrice(report.ticket)}
          hint={`${report.clients} cliente(s) no período`}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">Atendimentos por dia</h2>
        {report.chart.length ? (
          <div className="h-64">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Carregando gráfico...
                </div>
              }
            >
              <ReportChart chart={report.chart} />
            </Suspense>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum atendimento no período.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="Serviços mais vendidos"
          rows={report.byService.map((s) => ({
            name: s.name,
            value: `${s.total}x · ${formatPrice(s.valor)}`,
          }))}
        />
        <ListCard
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

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: { name: string; value: string }[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {rows.length ? (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.name} className="flex justify-between gap-3 border-b border-border pb-2">
              <span>{r.name}</span>
              <span className="text-muted-foreground">{r.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>
      )}
    </div>
  );
}
