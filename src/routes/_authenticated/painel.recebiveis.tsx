import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { requireMasterAccess } from "@/lib/master.functions";
import { getReceivablesCalendar } from "@/lib/lifecycle.functions";

export const Route = createFileRoute("/_authenticated/painel/recebiveis")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Agenda de Recebíveis — Painel master" },
      { name: "description", content: "Vencimentos e recebimentos da plataforma." },
    ],
  }),
  component: RecebiveisPage,
});

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Granularity = "dia" | "semana" | "mes" | "ano";
type Period = "hoje" | "7" | "30";

const PERIOD_DAYS: Record<Period, number> = { hoje: 1, "7": 7, "30": 30 };

function RecebiveisPage() {
  const calendarFn = useServerFn(getReceivablesCalendar);
  const calendarQuery = useQuery({
    queryKey: ["receivables-calendar"],
    queryFn: () => calendarFn(),
    refetchInterval: 60000,
  });

  const [period, setPeriod] = useState<Period>("30");
  const [view, setView] = useState<"calendario" | "lista">("calendario");
  const [granularity, setGranularity] = useState<Granularity>("mes");
  const [methodFilter, setMethodFilter] = useState<"todos" | "cartao" | "pix_automatico" | "pix">(
    "todos",
  );
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayKey = dayKey(today);

  // Cobranças por dia: o vencimento rolante de cada assinante (uma data por conta),
  // respeitando o filtro de método (Cartão / PIX Automático / PIX).
  const chargesByDay = useMemo(() => {
    const map = new Map<
      string,
      {
        totalCents: number;
        items: Array<{
          id: string;
          name: string;
          amountCents: number;
          method: "cartao" | "pix_automatico" | "pix";
        }>;
      }
    >();
    for (const item of calendarQuery.data?.upcoming ?? []) {
      if (methodFilter !== "todos" && item.method !== methodFilter) continue;
      const key = dayKey(new Date(item.nextDue));
      const entry = map.get(key) ?? { totalCents: 0, items: [] };
      entry.totalCents += item.amountCents;
      entry.items.push({
        id: item.id,
        name: item.name,
        amountCents: item.amountCents,
        method: item.method,
      });
      map.set(key, entry);
    }
    return map;
  }, [calendarQuery.data, methodFilter]);

  const receivedByDay = useMemo(() => {
    const map = new Map<string, { totalCents: number; count: number }>();
    for (const payment of calendarQuery.data?.received ?? []) {
      const key = dayKey(new Date(payment.paidAt));
      const entry = map.get(key) ?? { totalCents: 0, count: 0 };
      entry.totalCents += payment.amountCents;
      entry.count += 1;
      map.set(key, entry);
    }
    return map;
  }, [calendarQuery.data]);

  const periodDays = PERIOD_DAYS[period];
  const periodEnd = new Date(today.getTime() + (periodDays - 1) * 86_400_000);

  const aReceber = useMemo(() => {
    let totalCents = 0;
    let count = 0;
    for (let i = 0; i < periodDays; i += 1) {
      const entry = chargesByDay.get(dayKey(new Date(today.getTime() + i * 86_400_000)));
      if (entry) {
        totalCents += entry.totalCents;
        count += entry.items.length;
      }
    }
    return { totalCents, count };
  }, [chargesByDay, periodDays, today]);

  const receivedThisMonth = useMemo(() => {
    let totalCents = 0;
    let count = 0;
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    for (const payment of calendarQuery.data?.received ?? []) {
      if (new Date(payment.paidAt).toISOString().slice(0, 7) === monthKey) {
        totalCents += payment.amountCents;
        count += 1;
      }
    }
    return { totalCents, count };
  }, [calendarQuery.data, today]);

  const rangeLabel = `${today.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} - ${periodEnd.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;

  const churnPercent =
    calendarQuery.data &&
    calendarQuery.data.upcoming.length > 0 &&
    calendarQuery.data.churn.count > 0
      ? `${Math.round(
          (calendarQuery.data.churn.count / calendarQuery.data.upcoming.length) * 100,
        )}%`
      : "—";

  // Grade do mês: 42 células (6 semanas), começando no domingo.
  const gridStart = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    return new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  }, [cursor]);

  const monthTotal = useMemo(() => {
    let total = 0;
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      total +=
        chargesByDay.get(dayKey(new Date(cursor.getFullYear(), cursor.getMonth(), day)))
          ?.totalCents ?? 0;
    }
    return total;
  }, [chargesByDay, cursor]);

  // Totais do mês exibido por método de cobrança.
  const methodTotals = useMemo(() => {
    const totals = { cartao: 0, pix_automatico: 0, pix: 0 };
    for (const item of calendarQuery.data?.upcoming ?? []) {
      const due = new Date(item.nextDue);
      if (
        due.getMonth() !== cursor.getMonth() ||
        due.getFullYear() !== cursor.getFullYear()
      ) {
        continue;
      }
      totals[item.method] += item.amountCents;
    }
    return totals;
  }, [calendarQuery.data, cursor]);

  const moveCursor = (direction: -1 | 1) => {
    setCursor((current) => {
      if (granularity === "ano")
        return new Date(current.getFullYear() + direction, current.getMonth(), 1);
      if (granularity === "semana") return new Date(current.getTime() + direction * 7 * 86_400_000);
      if (granularity === "dia") return new Date(current.getTime() + direction * 86_400_000);
      return new Date(current.getFullYear(), current.getMonth() + direction, 1);
    });
  };

  const upcomingList = useMemo(() => {
    const list: Array<{
      date: Date;
      name: string;
      amountCents: number;
      method: "cartao" | "pix_automatico" | "pix";
    }> = [];
    for (let i = 0; i < 60; i += 1) {
      const entry = chargesByDay.get(dayKey(new Date(today.getTime() + i * 86_400_000)));
      if (!entry) continue;
      for (const item of entry.items) {
        list.push({
          date: new Date(today.getTime() + i * 86_400_000),
          name: item.name,
          amountCents: item.amountCents,
          method: item.method,
        });
      }
    }
    return list;
  }, [chargesByDay, today]);

  const yearMonths = useMemo(() => {
    const out: Array<{ label: string; total: number; received: number }> = [];
    for (let month = 0; month < 12; month += 1) {
      const daysInMonth = new Date(cursor.getFullYear(), month + 1, 0).getDate();
      let total = 0;
      for (let day = 1; day <= daysInMonth; day += 1) {
        total +=
          chargesByDay.get(dayKey(new Date(cursor.getFullYear(), month, day)))?.totalCents ?? 0;
      }
      const received = (calendarQuery.data?.received ?? [])
        .filter((p) => {
          const d = new Date(p.paidAt);
          return d.getFullYear() === cursor.getFullYear() && d.getMonth() === month;
        })
        .reduce((sum, p) => sum + p.amountCents, 0);
      out.push({ label: MONTHS[month] ?? "Mês", total, received });
    }
    return out;
  }, [chargesByDay, cursor, calendarQuery.data]);

  const renderDayCell = (date: Date) => {
    const key = dayKey(date);
    const inMonth = date.getMonth() === cursor.getMonth();
    const isToday = key === todayKey;
    const past = date.getTime() < today.getTime();
    const charges = chargesByDay.get(key);
    const received = receivedByDay.get(key);
    const entries = [
      ...(received
        ? [{ label: `Recebido ${brl(received.totalCents)}`, tone: "green" as const }]
        : []),
      ...(!past && charges
        ? charges.items
            .slice(0, 2)
            .map((item) => ({ label: `${item.name} ${brl(item.amountCents)}`, tone: "blue" as const }))
        : []),
    ];
    const extra = charges && !past ? Math.max(0, charges.items.length - 2) : 0;
    return (
      <div
        key={key}
        className={`min-h-[92px] rounded-lg border p-2 text-left transition-colors ${
          isToday
            ? "border-[var(--c-1677ff)] bg-[var(--c-1677ff)]/10"
            : inMonth
              ? "border-white/[0.07] bg-[#10141b]"
              : "border-dashed border-white/[0.05] opacity-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-semibold ${
              isToday ? "text-[var(--c-69a2ff)]" : inMonth ? "text-[#c9ced6]" : "text-[#5c6470]"
            }`}
          >
            {date.getDate()}
          </span>
          {isToday ? (
            <span className="text-[10px] font-bold text-[var(--c-69a2ff)]">HOJE</span>
          ) : null}
        </div>
        <div className="mt-1 space-y-1">
          {entries.map((entry, index) => (
            <p
              key={index}
              className={`truncate rounded px-1 text-[10px] leading-4 ${
                entry.tone === "green"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-[var(--c-1677ff)]/15 text-[var(--c-8fb3ff)]"
              }`}
            >
              {entry.label}
            </p>
          ))}
          {extra > 0 ? (
            <p className="truncate px-1 text-[10px] text-[#777d87]">+{extra} mais</p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl border border-[var(--c-1677ff)]/20 bg-[var(--c-1677ff)]/10 text-[var(--c-5da8ff)]">
          <CalendarClock className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold uppercase tracking-tight">Agenda de Recebíveis</h1>
          <p className="text-sm text-muted-foreground">
            Quando cada cobrança de assinatura cai na sua conta.
          </p>
        </div>
      </div>

      {/* Período */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#9aa1ab]">Quando cada cobrança de assinatura cai na sua conta</p>
        <div className="flex flex-wrap items-center gap-2">
          {(["hoje", "7", "30"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPeriod(option)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                period === option
                  ? "border-[var(--c-1677ff)] bg-[var(--c-1677ff)] text-white"
                  : "border-white/10 bg-[#10141b] text-[#9aa1ab] hover:text-white"
              }`}
            >
              {option === "hoje" ? "Hoje" : `${option} dias`}
            </button>
          ))}
          <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#10141b] px-3 py-1.5 text-xs font-semibold text-[var(--c-e6e9ee)]">
            <CalendarDays className="size-3.5 text-[var(--c-69a2ff)]" />
            {rangeLabel}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`A receber nos próximos ${periodDays} dia(s)`}
          value={brl(aReceber.totalCents)}
          hint={`${aReceber.count} cobrança(s) prevista(s)`}
        />
        <KpiCard
          label={`Recebido em ${MONTHS[today.getMonth()] ?? "mês"}`}
          value={brl(receivedThisMonth.totalCents)}
          hint={`${receivedThisMonth.count} cobrança(s) paga(s)`}
          valueClass="text-emerald-400"
        />
        <KpiCard label="Recusado" value={brl(0)} hint="0 cobranças" />
        <KpiCard
          label="Cancelamentos nos próximos 30 dias (churn)"
          value={`${calendarQuery.data?.churn.count ?? 0} · ${churnPercent}`}
          hint={`${brl(calendarQuery.data?.churn.monthlyCents ?? 0)} por mês · ${
            calendarQuery.data?.churn.count ? `${churnPercent} de churn` : "— de churn"
          }`}
        />
      </div>

      {/* Calendário / Lista */}
      <section className="report-luminous-card report-effect-medium mt-4 p-4">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
            {MONTHS[cursor.getMonth()] ?? "Mês"} de {cursor.getFullYear()}
            <span className="ml-2 text-sm font-normal text-[#777d87]">
              · {brl(monthTotal)} no mês
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {(["dia", "semana", "mes", "ano"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGranularity(option)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold capitalize transition ${
                  granularity === option
                    ? "border-[var(--c-1677ff)] bg-[var(--c-1677ff)] text-white"
                    : "border-white/10 bg-[#10141b] text-[#9aa1ab] hover:text-white"
                }`}
              >
                {option === "mes"
                  ? "Mês"
                  : option === "semana"
                    ? "Semana"
                    : option === "ano"
                      ? "Ano"
                      : "Dia"}
              </button>
            ))}
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => moveCursor(-1)}
                className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-[#10141b] text-[#9aa1ab] transition hover:text-white"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
                }
                className="rounded-lg border border-white/10 bg-[#10141b] px-3 py-1.5 text-xs font-bold text-[#9aa1ab] transition hover:text-white"
              >
                Hoje
              </button>
              <button
                type="button"
                aria-label="Próximo"
                onClick={() => moveCursor(1)}
                className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-[#10141b] text-[#9aa1ab] transition hover:text-white"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setMethodFilter((current) => (current === "cartao" ? "todos" : "cartao"))
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                methodFilter === "cartao"
                  ? "border-violet-400 bg-violet-500/15 text-violet-300"
                  : "border-white/10 bg-black/30 text-[var(--c-e6e9ee)]"
              }`}
            >
              <span className="size-2 rounded-full bg-violet-400" />
              Cartão <span className="font-bold">{brl(methodTotals.cartao)}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setMethodFilter((current) =>
                  current === "pix_automatico" ? "todos" : "pix_automatico",
                )
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                methodFilter === "pix_automatico"
                  ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 bg-black/30 text-[var(--c-e6e9ee)]"
              }`}
            >
              <span className="size-2 rounded-full bg-emerald-400" />
              PIX Automático <span className="font-bold">{brl(methodTotals.pix_automatico)}</span>
            </button>
            <button
              type="button"
              onClick={() => setMethodFilter((current) => (current === "pix" ? "todos" : "pix"))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                methodFilter === "pix"
                  ? "border-[var(--c-1677ff)] bg-[var(--c-1677ff)]/15 text-[var(--c-8fb3ff)]"
                  : "border-white/10 bg-black/30 text-[var(--c-e6e9ee)]"
              }`}
            >
              <span className="size-2 rounded-full bg-[var(--c-1677ff)]" />
              PIX <span className="font-bold">{brl(methodTotals.pix)}</span>
            </button>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-white/10">
            {(["calendario", "lista"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition ${
                  view === option
                    ? "bg-[var(--c-1677ff)] text-white"
                    : "bg-[#10141b] text-[#9aa1ab] hover:text-white"
                }`}
              >
                {option === "calendario" ? (
                  <CalendarDays className="size-3.5" />
                ) : (
                  <List className="size-3.5" />
                )}
                {option === "calendario" ? "Calendário" : "Lista"}
              </button>
            ))}
          </div>
        </div>

        {view === "lista" ? (
          <div className="relative z-10 mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-white/[0.035] text-left text-xs uppercase text-[#777d87]">
                <tr>
                  <th className="px-4 py-3">Data prevista</th>
                  <th className="px-4 py-3">Estabelecimento</th>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {upcomingList.map((item, index) => (
                  <tr key={`${item.name}-${index}`} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      {item.date.toLocaleDateString("pt-BR")}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.date.toLocaleDateString("pt-BR", { weekday: "short" })}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{item.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--c-e6e9ee)]">
                        <span
                          className={`size-2 rounded-full ${
                            item.method === "cartao"
                              ? "bg-violet-400"
                              : item.method === "pix_automatico"
                                ? "bg-emerald-400"
                                : "bg-[var(--c-1677ff)]"
                          }`}
                        />
                        {item.method === "cartao"
                          ? "Cartão"
                          : item.method === "pix_automatico"
                            ? "PIX Automático"
                            : "PIX"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-[var(--c-8fb3ff)]">
                      {brl(item.amountCents)}
                    </td>
                  </tr>
                ))}
                {!upcomingList.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma cobrança prevista nos próximos 60 dias.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : granularity === "ano" ? (
          <div className="relative z-10 mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {yearMonths.map((month) => (
              <div
                key={month.label}
                className="rounded-xl border border-white/[0.07] bg-[#10141b] p-4"
              >
                <p className="text-sm font-semibold text-[var(--c-eef1f6)]">{month.label}</p>
                <p className="mt-2 text-xs text-[#777d87]">A receber</p>
                <p className="text-lg font-bold text-[var(--c-8fb3ff)]">{brl(month.total)}</p>
                <p className="mt-1 text-xs text-[#777d87]">Recebido</p>
                <p className="text-sm font-semibold text-emerald-400">{brl(month.received)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative z-10 mt-4">
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-[#626872]">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-1.5">
              {granularity === "mes"
                ? Array.from({ length: 42 }, (_, index) => {
                    const date = new Date(
                      gridStart.getFullYear(),
                      gridStart.getMonth(),
                      gridStart.getDate() + index,
                    );
                    return renderDayCell(date);
                  })
                : null}
              {granularity === "semana"
                ? (() => {
                    const weekStart = new Date(today.getTime() - today.getDay() * 86_400_000);
                    return Array.from({ length: 7 }, (_, index) => {
                      const date = new Date(weekStart.getTime() + index * 86_400_000);
                      return renderDayCell(date);
                    });
                  })()
                : null}
              {granularity === "dia" ? renderDayCell(cursor) : null}
            </div>
          </div>
        )}

        {/* Legenda */}
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-4 border-t border-white/[0.07] pt-3 text-xs text-[#777d87]">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-white/10" /> Já passou · valor recebido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-[var(--c-1677ff)]" /> Hoje
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded bg-[#10141b]" /> A receber
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-emerald-400" /> Recebido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[var(--c-1677ff)]" /> Previsto (cobrado no dia)
          </span>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  hint: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#10141b] p-4">
      <p className="text-xs leading-relaxed text-[#9aa1ab]">{label}</p>
      <p className={`mt-2 break-words text-2xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-xs text-[#626872]">{hint}</p>
    </div>
  );
}
