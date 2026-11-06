import { ChevronRight, Wallet } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { PlatformOverviewData } from "@/components/master/PlatformOverview";
import { PLATFORM_SECTIONS, type PlatformSection } from "@/lib/master/platform-sections";

export type { PlatformSection };

/**
 * Seções de SaaS do Painel 3 Master (barra inferior da referência de design):
 * Agendamentos, Desempenho, Assinatura, Atividade e Suporte.
 *
 * Todas as informações vêm do agregador `getPlatformOverview`, que lê as
 * tabelas reais do Supabase — nada é simulado.
 */

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  bloqueado: "Bloqueado",
  aguardando_sinal: "Aguardando sinal",
};

export function PlatformSections({
  section,
  onSectionChange,
  overview,
}: {
  section: PlatformSection;
  onSectionChange: (section: PlatformSection) => void;
  overview: PlatformOverviewData | undefined;
}) {
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-white/[0.07] pb-1">
        {PLATFORM_SECTIONS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-[var(--c-69a2ff)] text-[var(--c-8fb3ff)]"
                  : "border-transparent text-[#777d87] hover:text-[var(--c-e6e9ee)]"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {!overview ? (
        <p className="text-sm text-[#777d87]">Carregando dados da plataforma…</p>
      ) : section === "agendamentos" ? (
        <AgendamentosSection overview={overview} />
      ) : section === "desempenho" ? (
        <DesempenhoSection overview={overview} />
      ) : section === "atividade" ? (
        <AtividadeSection overview={overview} />
      ) : null}
    </div>
  );
}

function AgendamentosSection({ overview }: { overview: PlatformOverviewData }) {
  const { agendamentos } = overview.sections;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Agendamentos no mês" value={String(agendamentos.total)} />
        <StatCard
          label="Estabelecimentos com agendamentos"
          value={String(agendamentos.byBusiness.length)}
        />
        <StatCard
          label="Média por estabelecimento"
          value={String(overview.sections.desempenho.avgAppointmentsPerBusiness)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Distribuição por status">
          {agendamentos.byStatus.length === 0 ? (
            <EmptyState text="Nenhum agendamento registrado no mês corrente." />
          ) : (
            <ul className="space-y-2">
              {agendamentos.byStatus.map((row) => (
                <li
                  key={row.status}
                  className="flex items-center justify-between rounded-lg border border-white/[0.055] bg-black/20 px-3.5 py-2.5 text-sm text-[var(--c-dfe3ea)]"
                >
                  <span>{STATUS_LABEL[row.status] ?? row.status}</span>
                  <span className="font-medium text-[var(--c-f2f4f8)]">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Estabelecimentos com mais agendamentos">
          {agendamentos.byBusiness.length === 0 ? (
            <EmptyState text="Nenhum agendamento registrado no mês corrente." />
          ) : (
            <ul className="space-y-2">
              {agendamentos.byBusiness.map((row) => (
                <li
                  key={row.businessId}
                  className="flex items-center justify-between rounded-lg border border-white/[0.055] bg-black/20 px-3.5 py-2.5 text-sm text-[var(--c-dfe3ea)]"
                >
                  <span className="truncate">{row.name}</span>
                  <span className="font-medium text-[var(--c-f2f4f8)]">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function DesempenhoSection({ overview }: { overview: PlatformOverviewData }) {
  const { desempenho } = overview.sections;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="MRR" value={formatPrice(desempenho.mrrCents)} />
        <StatCard label="Recebido no mês" value={formatPrice(desempenho.receivedCents)} />
        <StatCard label="Sinais Pix pagos" value={String(desempenho.depositsPaid)} />
        <StatCard
          label="Comissão do SaaS"
          value={formatPrice(desempenho.platformCommissionCents)}
        />
      </div>
      <Panel title="Como o número é calculado">
        <ul className="space-y-2 text-sm text-[#777d87]">
          <li>
            <strong className="text-[var(--c-e6e9ee)]">MRR</strong>: soma das mensalidades das
            contas ativas (assinaturas elegíveis), sempayments do estabelecimento.
          </li>
          <li>
            <strong className="text-[var(--c-e6e9ee)]">Recebido no mês</strong>: apenas cobranças
            com status “pago” no mês corrente.
          </li>
          <li>
            <strong className="text-[var(--c-e6e9ee)]">Comissão do SaaS</strong>: comissão da
            plataforma nos sinais Pix efetivamente pagos (Ag Pay).
          </li>
        </ul>
      </Panel>
    </div>
  );
}

function AtividadeSection({ overview }: { overview: PlatformOverviewData }) {
  const { atividade } = overview.sections;
  return (
    <Panel title="Ações administrativas recentes">
      {atividade.length === 0 ? (
        <EmptyState text="Nenhuma ação administrativa registrada até agora." />
      ) : (
        <ol className="space-y-3">
          {atividade.map((event) => (
            <li key={event.id} className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--c-69a2ff)]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--c-e6e9ee)]">{event.title}</p>
                {event.description && (
                  <p className="truncate text-xs text-[#777d87]">{event.description}</p>
                )}
                <p className="text-xs text-[#626872]">
                  {event.businessName} · {new Date(event.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-luminous-card report-effect-medium p-4">
      <p className="relative z-10 mb-3 flex items-center gap-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
        <Wallet className="size-4 text-[var(--c-69a2ff)]" />
        {title}
      </p>
      <div className="relative z-10">{children}</div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-luminous-card report-effect-strong report-metric-card p-4">
      <p className="relative z-10 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[#70757f]">
        {label}
      </p>
      <p className="relative z-10 mt-1.5 text-[1.35rem] font-semibold leading-none tracking-[-0.025em] text-[var(--c-f2f4f8)]">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-[#777d87]">
      <ChevronRight className="size-4" />
      {text}
    </p>
  );
}
