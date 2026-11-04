import { useEffect } from "react";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Mail,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, categoryLabel } from "@/lib/format";
import { formatPhoneBR } from "@/lib/format-phone";
import type { PlatformBusinessRow } from "@/lib/master/platform-overview.functions";

const SEM_DADOS_HEALTH = { label: "Sem dados", className: "bg-white/5 text-[#9aa1ab]" };

const HEALTH_STYLE: Record<string, { label: string; className: string }> = {
  saudavel: { label: "Saudável", className: "bg-emerald-500/15 text-emerald-400" },
  atencao: { label: "Atenção", className: "bg-amber-500/15 text-amber-400" },
  risco: { label: "Em risco", className: "bg-destructive/15 text-destructive" },
  sem_dados: SEM_DADOS_HEALTH,
};

const SEM_COBRANCA = { label: "Sem cobrança", className: "bg-white/5 text-[#9aa1ab]" };

const PAYMENT_STYLE: Record<
  PlatformBusinessRow["paymentStatus"],
  { label: string; className: string }
> = {
  pago: { label: "Pagamento em dia", className: "bg-emerald-500/15 text-emerald-400" },
  pendente: { label: "Pagamento em aberto", className: "bg-amber-500/15 text-amber-400" },
  inexistente: SEM_COBRANCA,
};

function relativeDays(days: number | null) {
  if (days == null) return "Sem acesso";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `Há ${days} dias`;
}

/**
 * Card rápido do estabelecimento aberto pela busca do Painel 3 Master.
 *
 * Mostra os dados principais e as ações administrativas usadas na tabela:
 * ver a ficha completa, suspender/reativar e excluir.
 */
export function BusinessQuickCard({
  row,
  onClose,
  onOpenDetails,
  onSuspend,
  onReactivate,
  onRemove,
}: {
  row: PlatformBusinessRow;
  onClose: () => void;
  onOpenDetails: (businessId: string) => void;
  onSuspend: (business: { id: string; name: string }) => void;
  onReactivate: (businessId: string) => void;
  onRemove: (business: { id: string; name: string }) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const suspended = row.status === "suspenso";
  const health = HEALTH_STYLE[row.health] ?? SEM_DADOS_HEALTH;
  const payment = PAYMENT_STYLE[row.paymentStatus] ?? SEM_COBRANCA;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Estabelecimento ${row.name}`}
      className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-black/65 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="aa-aviso-in relative w-full max-w-md overflow-hidden rounded-2xl border border-[#2a2f37] bg-gradient-to-b from-[#161a21] to-[#0a0d12] shadow-[0_28px_90px_rgba(0,0,0,0.7)]">
        <div className="flex items-start gap-3 border-b border-white/[0.06] p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--c-1677ff)]/15 text-base font-bold text-[var(--c-60a5fa)]">
            {row.name.trim().charAt(0).toUpperCase() || "E"}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[1.05rem] font-semibold text-[var(--c-eef1f6)]">
              {row.name}
            </h2>
            <p className="truncate text-xs text-[#8a919c]">
              {row.phone ? formatPhoneBR(row.phone) : "Sem telefone"} ·{" "}
              {categoryLabel(row.category)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#8a919c] transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 px-4 pt-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
              suspended ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-400"
            }`}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {suspended ? "Suspenso" : "Ativo"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${payment.className}`}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {payment.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${health.className}`}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {health.label}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 p-4 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#70757f]">
              <UserRound className="size-3.5" /> Responsável
            </dt>
            <dd className="mt-1 truncate text-[var(--c-dfe3ea)]">{row.ownerName ?? "—"}</dd>
            {row.ownerEmail ? (
              <dd className="flex items-center gap-1 truncate text-xs text-[#777d87]">
                <Mail className="size-3 shrink-0" /> {row.ownerEmail}
              </dd>
            ) : null}
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#70757f]">
              <CreditCard className="size-3.5" /> Plano
            </dt>
            <dd className="mt-1 truncate text-[var(--c-dfe3ea)]">{row.planLabel}</dd>
            <dd className="truncate text-xs text-[#777d87]">
              {formatPrice(row.monthlyFeeCents)}/mês
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#70757f]">
              <CalendarDays className="size-3.5" /> Última atividade
            </dt>
            <dd className="mt-1 truncate text-[var(--c-dfe3ea)]">
              {relativeDays(row.daysSinceLastAccess)}
            </dd>
            <dd className="truncate text-xs text-[#777d87]">
              {row.lastAccessAt
                ? new Date(row.lastAccessAt).toLocaleString("pt-BR")
                : "Último acesso não registrado"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#70757f]">
              <CalendarDays className="size-3.5" /> Agendamentos (30 dias)
            </dt>
            <dd className="mt-1 truncate text-[var(--c-dfe3ea)]">{row.appointments30}</dd>
            {row.appointmentsVariation != null ? (
              <dd
                className={`truncate text-xs ${
                  row.appointmentsVariation >= 0 ? "text-emerald-400" : "text-destructive"
                }`}
              >
                {row.appointmentsVariation >= 0 ? "↑" : "↓"} {Math.abs(row.appointmentsVariation)}%
                vs. período anterior
              </dd>
            ) : null}
          </div>
        </dl>

        <div className="grid gap-2 border-t border-white/[0.06] p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenDetails(row.id)}
            className="justify-center gap-2 border-[var(--c-1677ff)]/40 bg-[var(--c-1677ff)]/10 text-[var(--c-8fb3ff)] hover:bg-[var(--c-1677ff)]/20 hover:text-white"
          >
            <Building2 className="size-4" /> Ver informações completas
            <ChevronRight className="size-4" />
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {suspended ? (
              <Button type="button" variant="secondary" onClick={() => onReactivate(row.id)}>
                Reativar
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => onSuspend({ id: row.id, name: row.name })}
              >
                Suspender
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onRemove({ id: row.id, name: row.name })}
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
