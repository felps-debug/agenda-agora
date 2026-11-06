import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { requireMasterAccess } from "@/lib/master.functions";
import { getTransactions } from "@/lib/transactions.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Hourglass,
  RefreshCw,
  Search,
  Timer,
  Wallet,
  ExternalLink,
} from "lucide-react";
import { BusinessDossier } from "@/components/master/BusinessDossier";
import {
  KpiCard,
  TONE_BLUE,
  TONE_GREEN,
  TONE_RED,
  TONE_VIOLET,
} from "@/components/master/PlatformOverview";

export const Route = createFileRoute("/_authenticated/painel/transacoes")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Transações — Painel master" },
      { name: "description", content: "Gerenciar depósitos e saques de todos os usuários." },
    ],
  }),
  component: TransacoesPage,
});

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Identidade "Visão geral": cartões luminosos + tonalidade por contexto. */
const card =
  "rounded-2xl border border-[#2b2b2e] bg-[var(--c-131519)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_28px_rgba(22,119,255,0.05)]";
const sectionTitle = "flex items-center gap-2 text-[15px] font-semibold text-white";

function TransacoesPage() {
  const fn = useServerFn(getTransactions);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("Todos");
  const [depositStatus, setDepositStatus] = useState("Todos");
  const [withdrawalStatus, setWithdrawalStatus] = useState("Todos");
  const [activeTab, setActiveTab] = useState<"deposits" | "withdrawals">("deposits");
  const [page, setPage] = useState(1);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => fn(),
    refetchInterval: 30000,
  });

  const deposits = data?.deposits ?? [];
  const withdrawals = data?.withdrawals ?? [];

  const filteredDeposits = useMemo(() => {
    if (!search) return deposits;
    const term = search.toLowerCase();
    return deposits.filter(
      (d) =>
        d.clientName.toLowerCase().includes(term) ||
        d.email.toLowerCase().includes(term) ||
        d.id.toLowerCase().includes(term) ||
        d.uuid.toLowerCase().includes(term),
    );
  }, [deposits, search]);

  const filteredWithdrawals = useMemo(() => {
    if (!search) return withdrawals;
    const term = search.toLowerCase();
    return withdrawals.filter(
      (d) =>
        d.clientName.toLowerCase().includes(term) ||
        d.email.toLowerCase().includes(term) ||
        d.id.toLowerCase().includes(term) ||
        d.uuid.toLowerCase().includes(term),
    );
  }, [withdrawals, search]);

  const currentList = activeTab === "deposits" ? filteredDeposits : filteredWithdrawals;
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(currentList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedList = currentList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const metrics = data?.metrics;

  const statusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes("PEND") || s === "AGUARDANDO" || s.includes("SOLICIT")) {
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ color: "#f0b429", background: "rgba(250,204,21,0.09)", border: "1px solid rgba(250,204,21,0.28)" }}
        >
          <span className="size-1.5 rounded-full bg-current" /> {s}
        </span>
      );
    }
    if (s.includes("CONCL") || s.includes("COMPLET") || s === "PAGO" || s === "PAID") {
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ color: "#4ade80", background: "rgba(34,197,94,0.09)", border: "1px solid rgba(34,197,94,0.28)" }}
        >
          <span className="size-1.5 rounded-full bg-current" /> {s}
        </span>
      );
    }
    if (s.includes("EXPIR") || s.includes("FALH") || s === "RECUSADO" || s === "REJECTED") {
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ color: "#ff7b86", background: "rgba(239,51,80,0.1)", border: "1px solid rgba(239,51,80,0.32)" }}
        >
          <span className="size-1.5 rounded-full bg-current" /> {s}
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
        style={{ color: "#69a2ff", background: "rgba(22,119,255,0.09)", border: "1px solid rgba(51,125,255,0.29)" }}
      >
        <span className="size-1.5 rounded-full bg-current" /> {s}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho no visual da Visão geral */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="report-icon-box report-icon-box-lg relative z-10"
            style={
              {
                "--report-icon-color": TONE_VIOLET.color,
                "--report-icon-background": TONE_VIOLET.background,
                "--report-icon-border": TONE_VIOLET.border,
                "--report-icon-glow": TONE_VIOLET.glow,
              } as React.CSSProperties
            }
          >
            <Wallet className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-white">
              Transações
            </h1>
            <p className="text-sm text-muted-foreground">
              Depósitos e saques de todos os usuários do Ag Pay.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-full border border-[#2b2b2e] bg-[var(--c-131519)] px-4 py-2 text-xs font-semibold text-[var(--c-8fb5ff)] transition-colors hover:border-[var(--c-5da8ff)]/50 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </header>

      {isLoading && (
        <div
          className={`${card} flex items-center justify-center gap-2 py-10 text-sm text-[#9aa1ab]`}
          role="status"
        >
          Carregando transações…
        </div>
      )}
      {isError && (
        <div className={`${card} py-10 text-center text-sm text-destructive`}>
          Erro ao carregar dados.
        </div>
      )}

      {metrics && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            icon={<ArrowDownLeft className="size-5" />}
            tone={TONE_BLUE}
            label="Total depósitos"
            value={String(metrics.totalDeposits)}
            hint="sinais recebidos na plataforma"
          />
          <KpiCard
            icon={<ArrowUpRight className="size-5" />}
            tone={TONE_VIOLET}
            label="Total saques"
            value={String(metrics.totalWithdrawals)}
            hint="saques solicitados"
          />
          <KpiCard
            icon={<Timer className="size-5" />}
            tone={TONE_GREEN}
            label="Depósitos pendentes"
            value={String(metrics.pendingDeposits)}
            hint="aguardando confirmação"
          />
          <KpiCard
            icon={<Hourglass className="size-5" />}
            tone={TONE_RED}
            label="Saques pendentes"
            value={String(metrics.pendingWithdrawals)}
            hint="na fila de processamento"
          />
          <KpiCard
            icon={<Wallet className="size-5" />}
            tone={TONE_GREEN}
            label="Total processado"
            value={money(metrics.totalProcessedCents)}
            hint="volume confirmado no Ag Pay"
          />
        </div>
      )}

      {/* Filtros */}
      <section className={card}>
        <p className={`${sectionTitle} mb-3`}>
          <Search className="size-4" style={{ color: TONE_BLUE.color }} />
          Buscar transações
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#686b74]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="UUID, ID, nome…"
              className="w-full rounded-xl border border-[#2b2b2e] bg-[var(--c-0f1114)] py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-[#5b5e66] focus:border-[var(--c-5da8ff)]/40 focus:outline-none"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Tipo"
            className="w-full rounded-xl border border-[#2b2b2e] bg-[var(--c-0f1114)] px-3 py-2.5 text-sm text-white focus:border-[var(--c-5da8ff)]/40 focus:outline-none"
          >
            <option>Todos</option>
            <option>PIX</option>
            <option>SAQUE</option>
          </select>
          <select
            value={depositStatus}
            onChange={(e) => setDepositStatus(e.target.value)}
            aria-label="Status depósito"
            className="w-full rounded-xl border border-[#2b2b2e] bg-[var(--c-0f1114)] px-3 py-2.5 text-sm text-white focus:border-[var(--c-5da8ff)]/40 focus:outline-none"
          >
            <option>Todos</option>
            <option>Aguardando</option>
            <option>Pago</option>
            <option>Falhou</option>
          </select>
          <select
            value={withdrawalStatus}
            onChange={(e) => setWithdrawalStatus(e.target.value)}
            aria-label="Status saque"
            className="w-full rounded-xl border border-[#2b2b2e] bg-[var(--c-0f1114)] px-3 py-2.5 text-sm text-white focus:border-[var(--c-5da8ff)]/40 focus:outline-none"
          >
            <option>Todos</option>
            <option>Pendente</option>
            <option>Concluído</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPage(1)}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--c-2563eb)] px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_22px_rgba(22,119,255,0.35)] transition-colors hover:bg-[var(--c-1677ff)]"
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setType("Todos");
              setDepositStatus("Todos");
              setWithdrawalStatus("Todos");
              setPage(1);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-[#2b2b2e] bg-[var(--c-0f1114)] px-5 py-2.5 text-xs font-bold text-[var(--c-cfd3d9)] transition-colors hover:border-[var(--c-5da8ff)]/40 hover:text-white"
          >
            Limpar
          </button>
        </div>
      </section>

      {/* Abas */}
      <div className="flex gap-2">
        {(
          [
            { key: "deposits", label: `Sinais pagos (${filteredDeposits.length})` },
            { key: "withdrawals", label: `Saques estabelecimento (${filteredWithdrawals.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setActiveTab(t.key);
              setPage(1);
            }}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === t.key
                ? "bg-[var(--c-2563eb)] text-white shadow-[0_0_18px_rgba(22,119,255,0.3)]"
                : "border border-[#2b2b2e] bg-[var(--c-131519)] text-[#9aa1ab] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <section className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#2b2b2e] bg-[var(--c-0f1114)] text-[10px] font-bold uppercase tracking-wider text-[#686b74]">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Valor bruto</th>
                <th className="py-3 px-4">Lucro Ag Pay</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232529] text-xs">
              {paginatedList.map((item, idx) => (
                <tr key={idx} className="transition-colors hover:bg-[var(--c-1677ff)]/[0.04]">
                  <td className="py-3 px-4 font-bold text-white">
                    <div>{item.id}</div>
                    <div className="text-[10px] font-normal text-[#686b74]">
                      {item.uuid.slice(0, 8)}…
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-white">{item.clientName}</div>
                    <div className="text-[11px] text-[#777d87]">{item.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="rounded px-2 py-1 text-[10px] font-bold"
                      style={{
                        color: item.type === "PIX" ? TONE_BLUE.color : TONE_VIOLET.color,
                        background: item.type === "PIX" ? TONE_BLUE.background : TONE_VIOLET.background,
                        border: `1px solid ${item.type === "PIX" ? TONE_BLUE.border : TONE_VIOLET.border}`,
                      }}
                    >
                      {item.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-white">{money(item.grossCents)}</td>
                  <td className="py-3 px-4 font-bold" style={{ color: TONE_GREEN.color }}>
                    {money(item.netCents)}
                  </td>
                  <td className="py-3 px-4">{statusBadge(item.status)}</td>
                  <td className="py-3 px-4 text-[11px] text-[#777d87]">
                    {format(new Date(item.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      disabled={!item.businessId}
                      onClick={() => setDetailsId(item.businessId)}
                      title="Abrir ficha do estabelecimento"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2b2b2e] bg-[var(--c-0f1114)] px-2.5 py-1.5 text-[10.5px] font-bold text-[var(--c-8fb5ff)] transition-colors hover:border-[var(--c-5da8ff)]/50 hover:text-white disabled:opacity-40"
                    >
                      <Building2 className="size-3.5" />
                      Ficha
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedList.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[13px] text-[#9aa1ab]">
                    Nenhuma transação encontrada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#2b2b2e] px-4 py-3">
          <span className="text-[11px] text-[#9aa1ab]">
            Página {safePage} de {totalPages} · {currentList.length} registros
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-[#2b2b2e] bg-[var(--c-0f1114)] px-3 py-1.5 text-xs text-white transition-colors hover:border-[var(--c-5da8ff)]/40 disabled:opacity-40"
            >
              ← Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-[#2b2b2e] bg-[var(--c-0f1114)] px-3 py-1.5 text-xs text-white transition-colors hover:border-[var(--c-5da8ff)]/40 disabled:opacity-40"
            >
              Próxima →
            </button>
          </div>
        </div>
      </section>

      {detailsId && (
        <BusinessDossier businessId={detailsId} onClose={() => setDetailsId(null)} />
      )}
    </div>
  );
}
