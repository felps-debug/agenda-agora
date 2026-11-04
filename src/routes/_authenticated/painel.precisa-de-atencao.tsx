import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Search } from "lucide-react";
import { setBusinessStatus } from "@/lib/admin.functions";
import { requireMasterAccess } from "@/lib/master.functions";
import { getSubscriptionLifecycle, setBusinessCancellation } from "@/lib/lifecycle.functions";
import {
  ATTENTION_REASON_LABEL,
  type AttentionReason,
} from "@/lib/subscription-lifecycle";
import { BusinessDossier } from "@/components/master/BusinessDossier";
import { TONE_RED } from "@/components/master/PlatformOverview";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/painel/precisa-de-atencao")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Precisa de atenção — Painel master" },
      { name: "description", content: "Contas expiradas, vencidas, suspensas ou canceladas." },
    ],
  }),
  component: PrecisaDeAtencaoPage,
});

const REASONS: AttentionReason[] = [
  "teste_expirado",
  "pagamento_pendente",
  "assinatura_vencida",
  "acesso_suspenso",
  "cancelamento_solicitado",
  "cancelado",
];

const REASON_CHIP: Record<AttentionReason, string> = {
  teste_expirado: "bg-amber-500/15 text-amber-400",
  pagamento_pendente: "bg-amber-500/15 text-amber-400",
  assinatura_vencida: "bg-destructive/15 text-destructive",
  acesso_suspenso: "bg-destructive/15 text-destructive",
  cancelamento_solicitado: "bg-[var(--c-3b82f6)]/15 text-[var(--c-60a5fa)]",
  cancelado: "bg-white/5 text-[#9aa1ab]",
};

const formatPhone = (value: string | null) => {
  if (!value) return "—";
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const dateBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

function relativeActivity(days: number | null) {
  if (days == null) return "Sem acesso";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `Há ${days} dias`;
}

function PrecisaDeAtencaoPage() {
  const queryClient = useQueryClient();
  const lifecycleFn = useServerFn(getSubscriptionLifecycle);
  const statusFn = useServerFn(setBusinessStatus);
  const cancelFn = useServerFn(setBusinessCancellation);
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<"todas" | AttentionReason>("todas");
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const lifecycle = useQuery({
    queryKey: ["subscription-lifecycle"],
    queryFn: () => lifecycleFn(),
    refetchInterval: 60000,
  });

  const all = (lifecycle.data?.items ?? []).filter((item) => item.category_ === "atencao");

  const counts = useMemo(() => {
    const map = new Map<AttentionReason, number>();
    for (const reason of REASONS) map.set(reason, 0);
    for (const item of all) if (item.reason) map.set(item.reason, (map.get(item.reason) ?? 0) + 1);
    return map;
  }, [all]);

  const filtered = all.filter(
    (item) =>
      (reasonFilter === "todas" || item.reason === reasonFilter) &&
      (!search.trim() ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.ownerName ?? "").toLowerCase().includes(search.toLowerCase())),
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["subscription-lifecycle"] });
    void queryClient.invalidateQueries({ queryKey: ["master-platform-overview"] });
  };

  const reactivate = useMutation({
    mutationFn: (businessId: string) => statusFn({ data: { id: businessId, status: "ativo" } }),
    onSuccess: () => {
      toast.success("Acesso reativado.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (input: { businessId: string; action: "solicitar" | "efetivar" | "reverter" }) =>
      cancelFn({ data: input }),
    onSuccess: (_result, variables) => {
      toast.success(
        variables.action === "solicitar"
          ? "Cancelamento solicitado registrado."
          : variables.action === "efetivar"
            ? "Cancelamento efetivado."
            : "Cancelamento revertido — conta reativada.",
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="master-skin mx-auto w-full p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <span
          className="report-icon-box report-icon-box-lg relative z-10"
          style={
            {
              "--report-icon-color": TONE_RED.color,
              "--report-icon-background": TONE_RED.background,
              "--report-icon-border": TONE_RED.border,
              "--report-icon-glow": TONE_RED.glow,
            } as React.CSSProperties
          }
        >
          <AlertTriangle className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight">Precisa de atenção</h1>
          <p className="text-sm text-muted-foreground">
            Contas com teste expirado, pagamentos pendentes, assinaturas vencidas, acessos
            suspensos ou cancelamentos — saem daqui automaticamente após a regularização.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card report-luminous-card report-effect-strong p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReasonFilter("todas")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              reasonFilter === "todas"
                ? "border-[var(--c-1677ff)]/40 bg-[var(--c-1677ff)]/10 text-[var(--c-8fb3ff)]"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas ({all.length})
          </button>
          {REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setReasonFilter(reason)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                reasonFilter === reason
                  ? "border-[var(--c-1677ff)]/40 bg-[var(--c-1677ff)]/10 text-[var(--c-8fb3ff)]"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {ATTENTION_REASON_LABEL[reason]} ({counts.get(reason) ?? 0})
            </button>
          ))}
        </div>
      </div>

      <section className="mt-6 overflow-x-auto report-x-scroll rounded-2xl border border-border bg-card report-luminous-card report-effect-strong">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 w-1/5">Estabelecimento</th>
              <th className="px-4 py-3">Motivo do alerta</th>
              <th className="px-4 py-3">Vencimento / fim do teste</th>
              <th className="px-4 py-3">Dias de atraso</th>
              <th className="px-4 py-3">Última atividade</th>
              <th className="px-4 py-3">Cobranças pagas</th>
              <th className="px-4 py-3">Contato comercial</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                  Nenhum cliente precisando de atenção no momento. 🎉
                </td>
              </tr>
            )}
            {filtered.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-sm font-bold">
                      {item.name.charAt(0).toUpperCase()}
                    </span>
                    <span>
                      <span className="block font-semibold uppercase">{item.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.ownerName ?? "—"} · {formatPhone(item.phone)}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {item.reason ? (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${REASON_CHIP[item.reason]}`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {item.reasonLabel}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.reason === "teste_expirado" || item.category_ === "em_teste"
                    ? dateBR(item.trialEnd)
                    : item.dueDate
                      ? dateBR(item.dueDate)
                      : "—"}
                </td>
                <td className="px-4 py-3">
                  {item.reason === "teste_expirado" ||
                  item.reason === "pagamento_pendente" ||
                  item.reason === "assinatura_vencida"
                    ? item.daysLate
                    : "—"}
                </td>
                <td className="px-4 py-3">{relativeActivity(item.daysSinceLastAccess)}</td>
                <td className="px-4 py-3">
                  {item.paymentsCount}
                  {item.paymentsCount > 0 ? (
                    <span className="block text-xs text-muted-foreground">
                      {formatPrice(item.totalPaidCents)} no total
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{item.salesOwner ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailsId(item.id)}
                    >
                      Abrir conta
                    </Button>
                    {item.status === "suspenso" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={reactivate.isPending}
                        onClick={() => reactivate.mutate(item.id)}
                      >
                        Reativar acesso
                      </Button>
                    ) : null}
                    {item.cancelledAt ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate({ businessId: item.id, action: "reverter" })}
                      >
                        Reverter cancelamento
                      </Button>
                    ) : item.cancelRequestedAt ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate({ businessId: item.id, action: "efetivar" })}
                      >
                        Efetivar cancelamento
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={cancel.isPending}
                        onClick={() => cancel.mutate({ businessId: item.id, action: "solicitar" })}
                      >
                        Registrar cancelamento
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <BusinessDossier businessId={detailsId} onClose={() => setDetailsId(null)} />
    </div>
  );
}
