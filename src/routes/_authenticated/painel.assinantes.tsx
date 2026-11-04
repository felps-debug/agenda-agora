import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck } from "lucide-react";
import { requireMasterAccess } from "@/lib/master.functions";
import { getSubscriptionLifecycle } from "@/lib/lifecycle.functions";
import { BusinessDossier } from "@/components/master/BusinessDossier";
import { TONE_GREEN } from "@/components/master/PlatformOverview";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/painel/assinantes")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Assinantes — Painel master" },
      { name: "description", content: "Comércios com assinatura do Agenda Agora." },
    ],
  }),
  component: AssinantesPage,
});

const dateBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

function AssinantesPage() {
  const lifecycleFn = useServerFn(getSubscriptionLifecycle);
  const lifecycle = useQuery({
    queryKey: ["subscription-lifecycle"],
    queryFn: () => lifecycleFn(),
    refetchInterval: 60000,
  });
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const rows = (lifecycle.data?.items ?? []).filter((item) => item.category_ === "assinante");
  const mrrTotal = rows
    .filter((item) => item.status !== "suspenso")
    .reduce((sum, item) => sum + item.monthlyFeeCents, 0);

  return (
    <div className="master-skin mx-auto w-full p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="report-icon-box report-icon-box-lg relative z-10"
          style={
            {
              "--report-icon-color": TONE_GREEN.color,
              "--report-icon-background": TONE_GREEN.background,
              "--report-icon-border": TONE_GREEN.border,
              "--report-icon-glow": TONE_GREEN.glow,
            } as React.CSSProperties
          }
        >
          <BadgeCheck className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-bold">(Assinantes)</h1>
          <p className="text-sm text-muted-foreground">
            Comércios com a fatura do ciclo atual paga — entrada e saída automáticas conforme os
            pagamentos confirmados.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
            MRR contabilizado: {formatPrice(mrrTotal)}
          </span>
          <Link to="/painel/master">
            <Button variant="secondary">Voltar</Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto report-x-scroll rounded-xl border border-border bg-card report-luminous-card report-effect-strong">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Estabelecimento</th>
              <th className="px-4 py-3">Plano / valor</th>
              <th className="px-4 py-3">1ª assinatura</th>
              <th className="px-4 py-3">Último pagamento</th>
              <th className="px-4 py-3">Próximo vencimento</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">MRR</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">
                  {item.name}
                  <span className="block text-xs text-muted-foreground">
                    {item.ownerName ?? "—"} · {item.ownerEmail ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {item.planLabel}
                  <span className="block text-xs text-muted-foreground">
                    {formatPrice(item.monthlyFeeCents)}/mês
                  </span>
                </td>
                <td className="px-4 py-3">{dateBR(item.firstPaymentAt)}</td>
                <td className="px-4 py-3">{dateBR(item.lastPaymentAt)}</td>
                <td className="px-4 py-3">
                  {dateBR(item.nextDue)}
                  {item.dueInDays != null && item.dueInDays <= 7 ? (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        item.dueInDays <= 1
                          ? "bg-destructive/15 text-destructive"
                          : item.dueInDays <= 3
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-[var(--c-3b82f6)]/15 text-[var(--c-60a5fa)]"
                      }`}
                    >
                      {item.dueInDays === 0 ? "vence hoje" : `vence em ${item.dueInDays} dia(s)`}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {item.cancelRequestedAt ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                      Cancelamento solicitado
                    </span>
                  ) : item.status === "suspenso" ? (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                      Suspenso
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                      Pago
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.status !== "suspenso" ? formatPrice(item.monthlyFeeCents) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDetailsId(item.id)}>
                    Detalhes da conta
                  </Button>
                </td>
              </tr>
            ))}
            {!lifecycle.isPending && !rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum assinante com a fatura vigente no momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <BusinessDossier businessId={detailsId} onClose={() => setDetailsId(null)} />
    </div>
  );
}
