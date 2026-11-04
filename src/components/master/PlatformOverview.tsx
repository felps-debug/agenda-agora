import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  CreditCard,
  FlaskConical,
  HeartPulse,
  ListChecks,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BusinessQuickCard } from "@/components/master/BusinessQuickCard";
import { LifecycleAutoCancelControl } from "@/components/master/LifecycleAutoCancelControl";
import { matchesBusinessSearch } from "@/lib/master/business-search";
import { formatPrice } from "@/lib/format";
import { categoryLabel } from "@/lib/format";
import type { PlatformBusinessRow } from "@/lib/master/platform-overview.functions";
import type { AttentionReason, LifecycleCategory } from "@/lib/subscription-lifecycle";

/**
 * Visão geral da plataforma (Painel 3 Master).
 *
 * Layout conforme a referência de design do painel master:
 * cartões de indicadores do SaaS, faixa de cobranças em aberto, resumo da saúde
 * dos assinantes, tabela de estabelecimentos com plano/atividade/pagamento/saúde
 * e, na lateral, os alertas que exigem ação e o acesso rápido.
 */

export type PlatformOverviewData = {
  generatedAt: string;
  currentMonth: string;
  previousMonth: string;
  kpis: {
    activeBusinesses: number;
    totalBusinesses: number;
    suspendedBusinesses: number;
    mrrCents: number;
    paidThisMonthCents: number;
    paidThisMonthCount: number;
    pendingCount: number;
    appointmentsThisMonth: number;
    appointmentsVariation: number | null;
    riskAccounts: number;
    healthCounts: { saudavel: number; atencao: number; risco: number; sem_dados: number };
    lifecycle: {
      emTeste: number;
      assinantes: number;
      vencemSete: number;
      atencao: number;
      semAcessoSete: number;
      testeExpiradoCount: number;
    };
  };
  rows: PlatformBusinessRow[];
  alerts: Array<{
    id: string;
    severity: "atencao" | "critico";
    title: string;
    description: string;
    count: number;
    href?: string | undefined;
  }>;
  recentEvents: Array<{
    id: string;
    businessName: string;
    type: string;
    title: string;
    description: string | null;
    createdAt: string;
  }>;
  sections: {
    agendamentos: {
      total: number;
      byStatus: Array<{ status: string; count: number }>;
      byBusiness: Array<{ businessId: string; name: string; count: number }>;
    };
    desempenho: {
      mrrCents: number;
      receivedCents: number;
      pendingCents: number;
      depositsPaid: number;
      depositsTotal: number;
      platformCommissionCents: number;
      avgAppointmentsPerBusiness: number;
    };
    assinatura: {
      mrrCents: number;
      paidThisMonthCents: number;
      pendingCount: number;
      paidThisMonthCount: number;
      history: Array<{
        businessId: string;
        businessName: string;
        referenceMonth: string;
        status: string;
        amountCents: number;
        paidAt: string | null;
      }>;
    };
    atividade: Array<{
      id: string;
      businessId: string;
      businessName: string;
      type: string;
      title: string;
      description: string | null;
      createdAt: string;
    }>;
    suporte: Array<{
      id: string;
      businessId: string;
      businessName: string;
      body: string;
      nextStep: string | null;
      createdAt: string;
    }>;
  };
};

type LegacyBusinessRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  agpay_split_status: string;
  agpay_split_email: string | null;
  agpay_commission_percent: number;
  agpay_schema_ready: boolean;
};

type HealthStyle = { label: string; className: string };

const HEALTH_STYLE: Record<string, HealthStyle> = {
  saudavel: { label: "Saudável", className: "bg-emerald-500/15 text-emerald-400" },
  atencao: { label: "Atenção", className: "bg-amber-500/15 text-amber-400" },
  risco: { label: "Em risco", className: "bg-destructive/15 text-destructive" },
  sem_dados: { label: "Sem dados", className: "bg-white/5 text-[#9aa1ab]" },
};

const SEM_DADOS_STYLE: HealthStyle = {
  label: "Sem dados",
  className: "bg-white/5 text-[#9aa1ab]",
};

const PAGE_SIZE = 5;

/** Tons do ícone dos cartões — mesma paleta da linha de navegação do Painel 2. */
export const TONE_BLUE = {
  color: "#69a2ff",
  background: "rgba(22, 119, 255, 0.09)",
  border: "rgba(51, 125, 255, 0.29)",
  glow: "rgba(22, 119, 255, 0.22)",
};
export const TONE_GREEN = {
  color: "#4ade80",
  background: "rgba(34, 197, 94, 0.09)",
  border: "rgba(34, 197, 94, 0.28)",
  glow: "rgba(34, 197, 94, 0.2)",
};
export const TONE_AMBER = {
  color: "#f0b429",
  background: "rgba(250, 204, 21, 0.09)",
  border: "rgba(250, 204, 21, 0.28)",
  glow: "rgba(250, 204, 21, 0.2)",
};
export const TONE_VIOLET = {
  color: "#b79cff",
  background: "rgba(139, 92, 246, 0.1)",
  border: "rgba(139, 92, 246, 0.3)",
  glow: "rgba(139, 92, 246, 0.22)",
};
export const TONE_RED = {
  color: "#ff7b86",
  background: "rgba(239, 51, 80, 0.1)",
  border: "rgba(239, 51, 80, 0.32)",
  glow: "rgba(239, 51, 80, 0.24)",
};

function initials(name: string) {
  return name.trim().charAt(0).toUpperCase() || "E";
}

function relativeDays(days: number | null) {
  if (days == null) return "Sem acesso";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return `Há ${days} dias`;
}

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const diff = Date.parse(iso) - Date.now();
  if (!Number.isFinite(diff)) return null;
  return Math.ceil(diff / 86_400_000);
}

export function PlatformOverview({
  overview,
  legacyRows,
  isPending,
  isError,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onOpenDetails,
  onSuspend,
  onReactivate,
  onRemove,
  onOpenBilling,
}: {
  overview: PlatformOverviewData | undefined;
  legacyRows: LegacyBusinessRow[];
  isPending: boolean;
  isError: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: "todos" | "ativo" | "suspenso";
  onStatusFilterChange: (value: "todos" | "ativo" | "suspenso") => void;
  onOpenDetails: (businessId: string) => void;
  onSuspend: (business: { id: string; name: string }) => void;
  onReactivate: (businessId: string) => void;
  onRemove: (business: { id: string; name: string }) => void;
  onOpenBilling: () => void;
}) {
  const [page, setPage] = useState(1);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PlatformBusinessRow | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchRect, setSearchRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  const legacyById = useMemo(() => new Map(legacyRows.map((row) => [row.id, row])), [legacyRows]);

  const filtered = useMemo(() => {
    const rows = overview?.rows ?? [];
    return rows.filter((row) => {
      const matchesSearch = matchesBusinessSearch(row, search);
      const matchesStatus =
        statusFilter === "todos" ||
        (statusFilter === "ativo" ? row.status !== "suspenso" : row.status === "suspenso");
      return matchesSearch && matchesStatus;
    });
  }, [overview?.rows, search, statusFilter]);

  const searchTerm = search.trim();
  const suggestions = searchTerm.length > 0 ? filtered.slice(0, 6) : [];
  const showSuggestions = searchOpen && suggestions.length > 0 && !selectedRow;

  const measureSearch = () => {
    const el = searchBoxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 340), window.innerWidth - 24);
    const left = Math.min(Math.max(rect.left, 12), Math.max(12, window.innerWidth - width - 12));
    setSearchRect({ top: rect.bottom + 6, left, width });
  };

  useEffect(() => {
    if (!searchOpen) return;
    measureSearch();
    const onViewportChange = () => measureSearch();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
    // A medição só precisa ser refeita quando a busca muda de tamanho/conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen, search]);

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (searchBoxRef.current?.contains(target)) return;
      if (target.closest("[data-aa-search-results]")) return;
      setSearchOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [searchOpen]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (isError) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive"
      >
        Não foi possível carregar a visão geral da plataforma. Atualize a página e tente novamente.
      </p>
    );
  }

  if (isPending || !overview) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="report-luminous-card report-effect-strong report-metric-card h-[104px] animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  const { kpis } = overview;

  return (
    <div className="space-y-4">
      <LifecycleAutoCancelControl />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={<Building2 className="size-[1.05rem]" strokeWidth={1.8} />}
          tone={TONE_BLUE}
          label="Estabelecimentos ativos"
          value={String(kpis.activeBusinesses)}
          hint={`de ${kpis.totalBusinesses} cadastrados`}
        />
        <KpiCard
          icon={<CircleDollarSign className="size-[1.05rem]" strokeWidth={1.8} />}
          tone={TONE_GREEN}
          label="MRR previsto"
          value={formatPrice(kpis.mrrCents)}
          hint="com base nas assinaturas ativas"
        />
        <KpiCard
          icon={<Wallet className="size-[1.05rem]" strokeWidth={1.8} />}
          tone={TONE_AMBER}
          label="Recebido neste mês"
          value={formatPrice(kpis.paidThisMonthCents)}
          hint={
            kpis.paidThisMonthCount > 0
              ? `${kpis.paidThisMonthCount} mensalidade(s) paga(s)`
              : "ainda não há recebimentos"
          }
        />
        <KpiCard
          icon={<CalendarDays className="size-[1.05rem]" strokeWidth={1.8} />}
          tone={TONE_VIOLET}
          label="Agendamentos no mês"
          value={String(kpis.appointmentsThisMonth)}
          hint="em todos os estabelecimentos"
        />
        <KpiCard
          icon={<TriangleAlert className="size-[1.05rem]" strokeWidth={1.8} />}
          tone={TONE_RED}
          label="Contas em risco"
          value={String(kpis.lifecycle.atencao)}
          hint="precisam de atenção"
        />
      </div>

      {/* Resumo do ciclo de assinaturas — mesmos critérios dos três menus. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LifecycleChip
          to="/painel/em-teste"
          label="Em teste"
          value={kpis.lifecycle.emTeste}
        />
        <LifecycleChip
          to="/painel/assinantes"
          label="Assinantes"
          value={kpis.lifecycle.assinantes}
        />
        <LifecycleChip
          to="/painel/precisa-de-atencao"
          label="Precisa de atenção"
          value={kpis.lifecycle.atencao}
        />
        <LifecycleChip
          to="/painel/precisa-de-atencao"
          label="Sem acesso há 7 dias ou mais"
          value={kpis.lifecycle.semAcessoSete}
        />
      </div>

      {/* Saúde das assinaturas — eventos do ciclo de cobrança. */}
      <section className="report-luminous-card report-effect-medium p-4">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="report-icon-box">
              <HeartPulse className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
                Saúde das assinaturas
              </h2>
              <p className="text-sm text-[#777d87]">
                Acompanhe o status financeiro e de uso das contas da plataforma.
              </p>
            </div>
          </div>
          <Link to="/painel/assinantes">
            <Button type="button" variant="secondary" size="sm">
              Ver relatório completo
            </Button>
          </Link>
        </div>
        <div className="relative z-10 mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HealthBox
            to="/painel/assinantes"
            icon={<BadgeCheck className="size-5" />}
            iconClass="border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
            label="Assinaturas ativas"
            value={kpis.lifecycle.assinantes}
            hint="pagas e vigentes"
          />
          <HealthBox
            to="/painel/assinantes"
            icon={<CalendarDays className="size-5" />}
            iconClass="border-[var(--c-1677ff)]/25 bg-[var(--c-1677ff)]/10 text-[var(--c-69a2ff)]"
            label="Vencem em 7 dias"
            value={kpis.lifecycle.vencemSete}
            hint="acompanhamento preventivo"
          />
          <HealthBox
            to="/painel/precisa-de-atencao"
            icon={<Wallet className="size-5" />}
            iconClass="border-amber-500/25 bg-amber-500/10 text-amber-400"
            label="Pagamentos pendentes"
            value={kpis.pendingCount}
            hint="aguardando confirmação"
          />
          <HealthBox
            to="/painel/precisa-de-atencao"
            icon={<FlaskConical className="size-5" />}
            iconClass="border-violet-500/25 bg-violet-500/10 text-violet-400"
            label="Testes expirados"
            value={kpis.lifecycle.testeExpiradoCount}
            hint="encerraram sem contratar"
          />
        </div>
      </section>

      {kpis.pendingCount > 0 && (
        <div className="report-luminous-card report-effect-medium flex flex-wrap items-center gap-4 p-4">
          <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/12 text-amber-400">
            <TriangleAlert className="size-5" />
          </span>
          <div className="relative z-10 min-w-0 flex-1">
            <p className="font-semibold text-amber-200">
              {kpis.pendingCount} mensalidade(s) aguardando pagamento
            </p>
            <p className="text-sm text-amber-200/70">
              Existem mensalidades em aberto que precisam ser pagas pelos estabelecimentos.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="relative z-10 border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
            onClick={onOpenBilling}
          >
            Ver cobranças <ArrowRight className="size-4" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <section className="report-luminous-card report-effect-strong p-4">
            <div className="relative z-10 flex flex-wrap items-center gap-4">
              <div className="report-icon-box">
                <Building2 className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
                  Últimos estabelecimentos
                </h2>
                <p className="text-sm text-[#777d87]">
                  Atividade recente na plataforma — prioridade para contas que exigem atenção.
                </p>
              </div>
              <div className="relative z-10 ml-auto flex flex-wrap items-center gap-2">
                <div className="relative" ref={searchBoxRef}>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f757f]" />
                  <Input
                    type="search"
                    placeholder="Buscar por nome, responsável ou telefone..."
                    value={search}
                    onFocus={() => {
                      measureSearch();
                      setSearchOpen(true);
                    }}
                    onChange={(event) => {
                      onSearchChange(event.target.value);
                      setPage(1);
                      setSearchOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && filtered.length > 0) {
                        const first = filtered[0];
                        if (first) {
                          event.preventDefault();
                          setSelectedRow(first);
                          setSearchOpen(false);
                        }
                      }
                      if (event.key === "Escape") {
                        setSearchOpen(false);
                      }
                    }}
                    className="w-72 border-white/10 bg-black/40 pl-9 pr-8 text-[var(--c-e6e9ee)] placeholder:text-[#666c76] [&::-webkit-search-cancel-button]:hidden"
                  />
                  {search ? (
                    <button
                      type="button"
                      aria-label="Limpar busca"
                      onClick={() => {
                        onSearchChange("");
                        setPage(1);
                        setSearchOpen(false);
                      }}
                      className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-[#777d87] transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
                {showSuggestions && searchRect && typeof document !== "undefined"
                  ? createPortal(
                      <div
                        data-aa-search-results
                        className="fixed z-[90] overflow-hidden rounded-xl border border-[#2a2f37] bg-[#0d1015] shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
                        style={{
                          top: searchRect.top,
                          left: searchRect.left,
                          width: searchRect.width,
                        }}
                      >
                        <p className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#626872]">
                          {filtered.length} resultado{filtered.length === 1 ? "" : "s"} — clique
                          para abrir o card
                        </p>
                        <ul className="max-h-72 overflow-y-auto p-1">
                          {suggestions.map((row) => (
                            <li key={row.id}>
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setSelectedRow(row);
                                  setSearchOpen(false);
                                }}
                                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
                              >
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--c-1677ff)]/15 text-xs font-bold text-[var(--c-60a5fa)]">
                                  {initials(row.name)}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm text-[var(--c-e6e9ee)]">
                                    {row.name}
                                  </span>
                                  <span className="block truncate text-xs text-[#777d87]">
                                    {row.ownerName ?? "Sem responsável"} ·{" "}
                                    {row.phone ? formatPhone(row.phone) : "sem telefone"}
                                  </span>
                                </span>
                                {row.status === "suspenso" ? (
                                  <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                                    Suspenso
                                  </span>
                                ) : null}
                                <ChevronRight className="size-4 shrink-0 text-[#626872]" />
                              </button>
                            </li>
                          ))}
                        </ul>
                        <p className="border-t border-white/[0.06] px-3 py-1.5 text-[10px] text-[#626872]">
                          Enter abre o primeiro resultado · Esc fecha
                        </p>
                      </div>,
                      document.body,
                    )
                  : null}
                <select
                  aria-label="Filtrar por status"
                  value={statusFilter}
                  onChange={(event) => {
                    onStatusFilterChange(event.target.value as typeof statusFilter);
                    setPage(1);
                  }}
                  className="h-10 rounded-md border border-white/10 bg-black/40 px-3 text-sm text-[var(--c-e6e9ee)]"
                >
                  <option value="todos">Todos os status</option>
                  <option value="ativo">Ativos</option>
                  <option value="suspenso">Suspensos</option>
                </select>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto report-x-scroll rounded-xl border border-border bg-card">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-white/[0.035] text-left text-xs uppercase text-[#777d87]">
                  <tr>
                    <th className="px-4 py-3">Estabelecimento</th>
                    <th className="px-4 py-3">Responsável</th>
                    <th className="px-4 py-3">Plano / Mensalidade</th>
                    <th className="px-4 py-3">Última atividade</th>
                    <th className="px-4 py-3">Agendamentos (30 dias)</th>
                    <th className="px-4 py-3">Pagamento</th>
                    <th className="px-4 py-3">Saúde da conta</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const legacy = legacyById.get(row.id);
                    const suspended = row.status === "suspenso";
                    const health = HEALTH_STYLE[row.health] ?? SEM_DADOS_STYLE;
                    const dueIn = daysUntil(row.nextChargeAt);
                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--c-3b82f6)]/15 text-sm font-bold text-[var(--c-60a5fa)]">
                              {initials(row.name)}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium">{row.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {row.phone ? formatPhone(row.phone) : "—"} ·{" "}
                                {categoryLabel(row.category)}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block">{row.ownerName ?? "—"}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.ownerEmail ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block font-medium">{row.planLabel}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatPrice(row.monthlyFeeCents)}/mês
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block">{relativeDays(row.daysSinceLastAccess)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {row.lastAccessAt
                              ? new Date(row.lastAccessAt).toLocaleString("pt-BR")
                              : "Último acesso não registrado"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block font-medium">{row.appointments30}</span>
                          {row.appointmentsVariation != null && (
                            <span
                              className={`block text-xs ${
                                row.appointmentsVariation >= 0
                                  ? "text-emerald-400"
                                  : "text-destructive"
                              }`}
                            >
                              {row.appointmentsVariation >= 0 ? "↑" : "↓"}{" "}
                              {Math.abs(row.appointmentsVariation)}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.paymentStatus === "pago" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-400" />
                              Pago
                            </span>
                          ) : (
                            <span className="inline-flex flex-col gap-0.5">
                              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                                <span className="size-1.5 rounded-full bg-amber-400" />
                                {row.paymentStatus === "pendente" ? "Em aberto" : "Sem cobrança"}
                              </span>
                              {dueIn != null && dueIn >= 0 && (
                                <span className="text-[11px] text-amber-400/80">
                                  Vence em {dueIn} dia(s)
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${health.className}`}
                          >
                            <span className="size-1.5 rounded-full bg-current" />
                            {health.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onOpenDetails(row.id)}
                            >
                              Ver detalhes <ChevronRight className="size-4" />
                            </Button>
                            {suspended ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onReactivate(row.id)}
                              >
                                Reativar
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onSuspend({ id: row.id, name: row.name })}
                              >
                                Suspender
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Remover ${row.name}`}
                              onClick={() => onRemove({ id: row.id, name: row.name })}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!visible.length && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum estabelecimento encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="relative z-10 mt-3 flex items-center justify-between gap-3 text-sm text-[#777d87]">
              <p>
                Mostrando {visible.length} de {filtered.length} estabelecimentos
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Anterior
                </Button>
                {Array.from({ length: pageCount }).map((_, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant={currentPage === index + 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(index + 1)}
                    aria-current={currentPage === index + 1 ? "page" : undefined}
                  >
                    {index + 1}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="report-luminous-card report-effect-medium p-4">
            <div className="relative z-10">
              <p className="flex items-center gap-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
                <TriangleAlert className="size-4 text-destructive" />
                Alertas que precisam de ação
              </p>
              {overview.alerts.length === 0 ? (
                <p className="mt-3 text-sm text-[#777d87]">
                  Nenhum alerta no momento. Todos os assinantes estão dentro do esperado.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {overview.alerts.map((alert) => {
                    const body = (
                      <>
                        <span
                          className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${
                            alert.severity === "critico"
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-amber-500/25 bg-amber-500/12 text-amber-400"
                          }`}
                        >
                          {alert.id === "sem-acesso" ? (
                            <UserRound className="size-4" />
                          ) : alert.id === "configuracao" ? (
                            <ListChecks className="size-4" />
                          ) : alert.id === "testes" ? (
                            <FlaskConical className="size-4" />
                          ) : alert.id === "vencimentos" ? (
                            <CalendarDays className="size-4" />
                          ) : (
                            <CreditCard className="size-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--c-e6e9ee)]">{alert.title}</p>
                          <p className="text-xs text-[#777d87]">{alert.description}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-bold text-[var(--c-e6e9ee)]">
                          {alert.count}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-[#626872]" />
                      </>
                    );
                    return alert.href ? (
                      <li key={alert.id}>
                        <Link
                          to={alert.href}
                          className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/25 p-3 transition hover:border-[var(--c-1677ff)]/30"
                        >
                          {body}
                        </Link>
                      </li>
                    ) : (
                      <li
                        key={alert.id}
                        className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-black/25 p-3"
                      >
                        {body}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="report-luminous-card report-effect-medium p-4">
            <div className="relative z-10 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
                <Clock className="size-4 text-[var(--c-69a2ff)]" />
                Atividades recentes
              </p>
              <button
                type="button"
                className="text-xs font-medium text-[var(--c-8fb3ff)] transition-colors hover:text-white"
                onClick={() => setShowAllEvents((value) => !value)}
              >
                {showAllEvents ? "Mostrar menos" : "Ver todas"}
              </button>
            </div>
            <ul className="relative z-10 mt-3 space-y-2">
              {overview.recentEvents
                .slice(0, showAllEvents ? undefined : 5)
                .map((event) => (
                  <li
                    key={event.id}
                    className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-black/25 p-3"
                  >
                    <span className="mt-0.5 shrink-0">{eventIcon(event.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--c-e6e9ee)]">
                        {event.title}
                      </p>
                      <p className="truncate text-xs text-[#777d87]">
                        {event.businessName}
                        {event.description ? ` · ${event.description}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-[#626872]">
                      {new Date(event.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              {!overview.recentEvents.length && (
                <li className="rounded-lg border border-white/[0.06] bg-black/25 p-3 text-center text-xs text-[#777d87]">
                  Nenhuma atividade registrada ainda.
                </li>
              )}
            </ul>
            <p className="relative z-10 mt-2 text-[10px] text-[#626872]">
              Histórico completo na ficha de cada estabelecimento.
            </p>
          </section>

          <p className="report-luminous-card report-effect-subtle flex items-start gap-2 p-3 text-xs text-[#777d87]">
            <ShieldCheck className="relative z-10 mt-0.5 size-4 shrink-0" />
            <span className="relative z-10">
              Os dados são atualizados em tempo real e podem sofrer pequenas variações.
            </span>
          </p>
        </aside>
      </div>

      {selectedRow ? (
        <BusinessQuickCard
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onOpenDetails={(businessId) => {
            setSelectedRow(null);
            onOpenDetails(businessId);
          }}
          onSuspend={(business) => {
            setSelectedRow(null);
            onSuspend(business);
          }}
          onReactivate={(businessId) => {
            setSelectedRow(null);
            onReactivate(businessId);
          }}
          onRemove={(business) => {
            setSelectedRow(null);
            onRemove(business);
          }}
        />
      ) : null}
    </div>
  );
}

/** Caixa clicável da saúde das assinaturas. */
function HealthBox({
  to,
  icon,
  iconClass,
  label,
  value,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-white/[0.07] bg-[#10151E] p-4 transition hover:border-[var(--c-1677ff)]/30"
    >
      <span className={`flex size-10 items-center justify-center rounded-xl border ${iconClass}`}>
        {icon}
      </span>
      <p className="mt-3 text-xs leading-relaxed text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </Link>
  );
}

/** Ícone do evento na lista de atividades recentes. */
function eventIcon(type: string) {
  if (type === "pagamento") return <CheckCircle2 className="size-4 text-emerald-400" />;
  if (type === "suspensao") return <TriangleAlert className="size-4 text-destructive" />;
  if (type === "reativacao") return <ShieldCheck className="size-4 text-[var(--c-69a2ff)]" />;
  if (type === "cadastro") return <Building2 className="size-4 text-[var(--c-69a2ff)]" />;
  return <CreditCard className="size-4 text-[var(--c-69a2ff)]" />;
}

function Trash2Icon() {  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Contador do ciclo de assinaturas — atalho para o menu correspondente. */
function LifecycleChip({ to, label, value }: { to: string; label: string; value: number }) {
  return (
    <Link
      to={to}
      className="report-luminous-card report-effect-subtle flex items-center justify-between gap-3 p-3 transition hover:border-[var(--c-1677ff)]/30"
    >
      <span className="relative z-10 min-w-0 text-xs leading-snug text-[#9aa1ab]">{label}</span>
      <span className="relative z-10 text-xl font-extrabold text-[var(--c-f2f4f8)]">{value}</span>
    </Link>
  );
}

function HealthBadge({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${className}`}
    >
      {icon}
      <span>
        {label} <span className="text-sm font-bold">{value}</span>
      </span>
    </span>
  );
}

export function KpiCard({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: { color: string; background: string; border: string; glow: string };
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="report-luminous-card report-effect-strong report-metric-card p-4">
      <span
        className="report-icon-box relative z-10"
        style={
          {
            "--report-icon-color": tone.color,
            "--report-icon-background": tone.background,
            "--report-icon-border": tone.border,
            "--report-icon-glow": tone.glow,
          } as React.CSSProperties
        }
      >
        {icon}
      </span>
      <div className="relative z-10 mt-4">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[#70757f]">
          {label}
        </p>
        <p className="mt-1.5 text-[1.35rem] font-semibold leading-none tracking-[-0.025em] text-[var(--c-f2f4f8)]">
          {value}
        </p>
        {hint && <p className="mt-2 text-xs leading-relaxed text-[#777d87]">{hint}</p>}
      </div>
    </article>
  );
}

function formatPhone(value: string | null) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
