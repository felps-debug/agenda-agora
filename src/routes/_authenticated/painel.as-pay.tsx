import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  History,
  KeyRound,
  Search,
  TrendingDown,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice } from "@/lib/format";
import { formatPhoneBR } from "@/lib/format-phone";
import { getLedgerStatement } from "@/lib/ledger.functions";
import {
  MIN_WITHDRAWAL_CENTS,
  getPaymentRules,
  getWithdrawalPixKeyValidationError,
  requestWithdrawal,
  savePaymentRules,
  saveWithdrawalPin,
  getWithdrawalPinStatus,
  saveWithdrawalPixKey,
  verifyWithdrawalPin,
  withdrawalPixKeyTypes,
} from "@/lib/withdrawal.functions";
import { maskPixKey } from "@/lib/pix-key-format";
import { saveServiceDeposit } from "@/lib/services.functions";
import { convertDepositField, depositFieldText, parseDepositField } from "@/lib/deposit-amount";
import { getLatestPixKeyApproval, submitPixKeyApproval } from "@/lib/pix-approvals.functions";
import { getAgpayFlags } from "@/lib/agpay-support.functions";
import { useAnimatedModal } from "@/lib/use-animated-modal";
import { PageHeader, NoBusiness } from "@/components/painel/PageHeader";
import { AgpayBackground } from "@/components/painel/AgpayBackground";

type WithdrawalPixKeyType = (typeof withdrawalPixKeyTypes)[number];

const pixKeyTypeLabel: Record<WithdrawalPixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
};

const pixKeyMaskHint: Record<WithdrawalPixKeyType, string> = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  email: "seu@email.com",
  telefone: "(00)00000-0000",
  aleatoria: "xxxxxxxx-xxxx-…",
};

const AGPAY_STATS = [
  { end: 120, suffix: "K+", dec: 0, label: "TRANSAÇÕES / DIA" },
  { end: 99.9, suffix: "%", dec: 1, label: "UPTIME GARANTIDO" },
  { end: 94, suffix: "%", dec: 0, label: "TAXA DE APROVAÇÃO" },
  { end: 5, suffix: "min", dec: 0, label: "PARA INTEGRAR" },
] as const;

function formatAgpayStat(value: number, dec: number, suffix: string) {
  return `${dec ? value.toFixed(1) : Math.floor(value)}${suffix}`;
}

const AGPAY_FEATURES = [
  {
    num: "01",
    title: "PIX Instantâneo",
    desc: "Receba em segundos com QR Code ou Código Copia e Cola, com confirmação automática do sinal no momento do agendamento.",
    badge: "Confirmação imediata",
  },
  {
    num: "02",
    title: "Sinal Antecipado",
    desc: "Reduza cancelamentos e faltas cobrando um sinal antecipado no momento em que o cliente agenda.",
    badge: "Menos faltas",
  },
  {
    num: "03",
    title: "Agenda Protegida",
    desc: "Proteja sua agenda contra clientes que reservam e não aparecem, solicitando o sinal antes de confirmar.",
    badge: "Agenda protegida",
  },
] as const;

/** Lista de recursos do AgPay com revelação em cascata. */
function AgpayFeatures() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        setVisible(true);
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="carteira-features mx-auto mt-6 max-w-md">
      {AGPAY_FEATURES.map((f, i) => (
        <div
          key={f.num}
          className={`carteira-feature${visible ? " is-visible" : ""}`}
          style={visible ? { transitionDelay: `${i * 0.12}s` } : undefined}
        >
          <div className="carteira-feature-num">{f.num}</div>
          <p className="carteira-feature-title">{f.title}</p>
          <p className="carteira-feature-desc">{f.desc}</p>
          {f.badge && <span className="carteira-feature-badge">{f.badge}</span>}
        </div>
      ))}
    </div>
  );
}

/** Grade de estatísticas do AgPay com contadores animados. */ function AgpayStats() {
  const ref = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<string[]>(() =>
    AGPAY_STATS.map((t) => formatAgpayStat(0, t.dec, t.suffix)),
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValues(AGPAY_STATS.map((t) => formatAgpayStat(t.end, t.dec, t.suffix)));
      setVisible(true);
      return;
    }
    const timers: number[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        setVisible(true);
        AGPAY_STATS.forEach((t, index) => {
          const dur = 2000;
          const step = 16;
          const inc = t.end / (dur / step);
          let cur = 0;
          const id = window.setInterval(() => {
            cur = Math.min(cur + inc, t.end);
            const text = formatAgpayStat(cur, t.dec, t.suffix);
            setValues((prev) => prev.map((v, i) => (i === index ? text : v)));
            if (cur >= t.end) window.clearInterval(id);
          }, step);
          timers.push(id);
        });
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((id) => window.clearInterval(id));
    };
  }, []);

  return (
    <div ref={ref} className="carteira-stats-section mx-auto mt-14 max-w-md">
      <div className="carteira-stats-header-bar">PIX IMEDIATO ✦ ANTIFRAUDE</div>
      <div className="carteira-stats-grid">
        {AGPAY_STATS.map((t, i) => (
          <div
            key={t.label}
            className={`carteira-stat-card${visible ? " is-visible" : ""}`}
            style={visible ? { transitionDelay: `${i * 0.12}s` } : undefined}
          >
            <div className="carteira-stat-number">{values[i]}</div>
            <div className="carteira-stat-label">{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/painel/as-pay")({
  head: () => ({
    meta: [
      { title: "Ag Pay — Agenda Agora" },
      { name: "description", content: "Saldo dos sinais pagos pelos clientes para agendar." },
      { property: "og:title", content: "Ag Pay — Agenda Agora" },
      { property: "og:description", content: "Saldo dos sinais pagos pelos clientes." },
    ],
  }),
  component: AsPayPage,
});

const PIX_MODES = [
  {
    id: "desabilitado",
    label: "Desabilitado",
    desc: "Quando a função de Pix automático está desabilitada, não é apresentada nenhuma opção de pagamento para o cliente.",
  },
  {
    id: "opcional",
    label: "Opcional",
    desc: "Quando a função opcional está habilitada, o Pix é apresentado ao cliente após a confirmação do agendamento, e ele pode antecipar o pagamento, que será processado e validado automaticamente.",
  },
  {
    id: "obrigatorio",
    label: "Obrigatório",
    desc: "Na função obrigatória, o sistema solicitará o pagamento antes de confirmar o agendamento. O cliente realiza o agendamento, e após isso, entra em uma fila de pendência, tendo o prazo de 5 minutos antes que o agendamento seja cancelado automaticamente. O pagamento é confirmado e validado por meio da nossa plataforma, garantindo o recebimento antes do agendamento definitivo. Enquanto o agendamento estiver aguardando pagamento, o horário escolhido não estará disponível para outros clientes. Caso o pagamento não seja efetuado, o horário volta a ficar disponível automaticamente.",
  },
] as const;

type PixMode = (typeof PIX_MODES)[number]["id"];

/** Interruptor liga/desliga dourado (estilos inline: idêntico em todo lugar). */
function GoldSwitch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        position: "relative",
        height: 24,
        width: 44,
        flexShrink: 0,
        borderRadius: 9999,
        background: on ? "#e8b93e" : "#5a5e68",
        boxShadow: on ? "0 0 10px rgba(232,185,62,0.45)" : "none",
        transition: "background 0.2s",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 2,
          left: on ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          transition: "left 0.2s",
        }}
      />
    </span>
  );
}

/** Painel "Configuração de sinal dos serviços" (atalho na tela de regras). */
function ServiceDepositPanel({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const saveDepositFn = useServerFn(saveServiceDeposit);
  const [unit, setUnit] = useState<"fixed" | "percent">("fixed");
  const [rows, setRows] = useState<
    { id: string; name: string; priceCents: number; requiresDeposit: boolean; amount: string }[]
  >([]);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["rules-services", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select(
          "id, name, price_cents, requires_deposit, deposit_cents, deposit_mode, deposit_percent_bps",
        )
        .eq("business_id", businessId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        name: string;
        price_cents: number | null;
        requires_deposit: boolean | null;
        deposit_cents: number | null;
        deposit_mode: string | null;
        deposit_percent_bps: number | null;
      }[];
    },
  });

  useEffect(() => {
    if (!servicesQuery.data || initializedFor === businessId) return;
    // Abre na unidade que o negócio já usa, para o campo nunca mostrar um número na unidade errada.
    const initialUnit = servicesQuery.data.some(
      (s) => s.requires_deposit && (s.deposit_mode ?? "fixed") === "percent",
    )
      ? "percent"
      : "fixed";
    setUnit(initialUnit);
    setRows(
      servicesQuery.data.map((s) => ({
        id: s.id,
        name: s.name,
        priceCents: s.price_cents ?? 0,
        requiresDeposit: !!s.requires_deposit,
        amount: depositFieldText(
          {
            price_cents: s.price_cents ?? 0,
            deposit_cents: s.deposit_cents ?? 0,
            deposit_mode: (s.deposit_mode ?? "fixed") === "percent" ? "percent" : "fixed",
            deposit_percent_bps: s.deposit_percent_bps ?? 0,
          },
          initialUnit,
        ),
      })),
    );
    setInitializedFor(businessId);
  }, [servicesQuery.data, initializedFor, businessId]);

  const changeUnit = (next: "fixed" | "percent") => {
    if (next === unit) return;
    setRows((prev) =>
      prev.map((r) => ({ ...r, amount: convertDepositField(r.amount, unit, next, r.priceCents) })),
    );
    setUnit(next);
  };

  const saveAll = useMutation({
    mutationFn: async () => {
      for (const row of rows) {
        let amount: number;
        try {
          amount = parseDepositField(row.amount, unit);
        } catch {
          throw new Error(`Valor inválido em "${row.name}".`);
        }
        await saveDepositFn({
          data: {
            businessId,
            serviceId: row.id,
            requiresDeposit: row.requiresDeposit,
            depositMode: unit,
            amount,
          },
        });
      }
    },
    onSuccess: async () => {
      toast.success("Sinal dos serviços salvo.");
      await queryClient.invalidateQueries({ queryKey: ["rules-services", businessId] });
      await queryClient.invalidateQueries({ queryKey: ["services", businessId] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const setAll = (on: boolean) =>
    setRows((prev) => prev.map((r) => ({ ...r, requiresDeposit: on })));
  const allOn = rows.length > 0 && rows.every((r) => r.requiresDeposit);

  return (
    <div className="mx-auto mt-8 max-w-xl">
      <h2 className="text-xl font-bold text-[#e8b93e]">Configuração de sinal dos serviços</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--c-b8bec7)]">
        Configure o valor fixo ou percentual cobrado como sinal nos agendamentos.
      </p>

      <div className="mt-4 inline-flex rounded-lg border border-[#2c2c31] bg-[#101013] p-1" role="group" aria-label="Unidade do sinal">
        <button type="button" onClick={() => changeUnit("fixed")} aria-pressed={unit === "fixed"} className={`rounded-md px-3 py-2 text-sm ${unit === "fixed" ? "bg-[#e8b93e] text-black" : "text-[#b8bec7]"}`}>Valor em reais</button>
        <button type="button" onClick={() => changeUnit("percent")} aria-pressed={unit === "percent"} className={`rounded-md px-3 py-2 text-sm ${unit === "percent" ? "bg-[#e8b93e] text-black" : "text-[#b8bec7]"}`}>Percentual</button>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-[#2c2c31] bg-[#101013]">
        <button
          type="button"
          onClick={() => setAll(!allOn)}
          className="flex w-full items-center gap-3 border-b border-[#2c2c31] bg-[#232327] px-4 py-3"
        >
          <GoldSwitch on={allOn} />
          <span className="text-sm font-bold uppercase tracking-wide text-white">Todos</span>
        </button>
        {servicesQuery.isLoading && (
          <p className="px-4 py-6 text-center text-sm text-[#8b8e96]">Carregando serviços…</p>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center gap-3 border-b border-[#2c2c31] bg-[#232327] px-4 py-3 last:border-b-0"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={row.requiresDeposit}
              aria-label={`Sinal para ${row.name}`}
              onClick={() =>
                setRows((prev) =>
                  prev.map((r) =>
                    r.id === row.id ? { ...r, requiresDeposit: !r.requiresDeposit } : r,
                  ),
                )
              }
            >
              <GoldSwitch on={row.requiresDeposit} />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-white">
              {row.name}
            </span>
            <input
              value={row.amount}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r) =>
                    r.id === row.id
                      ? {
                          ...r,
                          amount: e.target.value
                            .replace(/[^0-9,]/g, "")
                            .slice(0, 8),
                        }
                      : r,
                  ),
                )
              }
              inputMode="decimal"
              aria-label={`${unit === "percent" ? "Percentual" : "Valor do sinal"} para ${row.name}`}
              placeholder={unit === "percent" ? "%" : "R$"}
              className="w-20 shrink-0 rounded-md bg-transparent px-1 py-1 text-right text-sm font-semibold text-white outline-none focus:ring-1 focus:ring-[#e8b93e]/50"
            />
          </div>
        ))}
        {!servicesQuery.isLoading && rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-[#8b8e96]">
            Nenhum serviço cadastrado. Cadastre serviços no menu Serviços.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => saveAll.mutate()}
        disabled={saveAll.isPending}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[10px] border-0 bg-[linear-gradient(90deg,#9a7118_0%,#d9a83f_25%,#f6d97a_50%,#d9a83f_75%,#9a7118_100%)] text-base font-bold text-[#231a03] shadow-[0_10px_24px_rgba(217,168,63,0.35)] transition hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saveAll.isPending ? "Salvando…" : "Salvar alterações"}
      </button>
    </div>
  );
}

/** Tela "Configuração de regras" da carteira AgPay. */
function PaymentRulesView({
  businessId,
  pixKey,
  pixApproved,
  onBack,
}: {
  businessId: string;
  pixKey: string | null;
  pixApproved: boolean;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const getRulesFn = useServerFn(getPaymentRules);
  const saveRulesFn = useServerFn(savePaymentRules);
  const [exceptionSearch, setExceptionSearch] = useState("");

  const rulesQuery = useQuery({
    queryKey: ["payment-rules", businessId],
    queryFn: () => getRulesFn({ data: { businessId } }),
  });
  const mode: PixMode = (rulesQuery.data?.pixMode as PixMode) ?? "opcional";
  const exceptions: string[] = rulesQuery.data?.pixExceptionClients ?? [];

  const customersQuery = useQuery({
    queryKey: ["rules-customers", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("name, phone")
        .eq("business_id", businessId)
        .order("name")
        .limit(200);
      if (error) throw error;
      const seen = new Map<string, string | null>();
      for (const c of data ?? []) {
        const name = (c.name ?? "").trim();
        if (!name || seen.has(name)) continue;
        seen.set(name, (c.phone ?? null) as string | null);
      }
      return [...seen.entries()].map(([name, phone]) => ({ name, phone }));
    },
  });
  const customerNames = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);

  const save = useMutation({
    mutationFn: (input: { pixMode: PixMode; pixExceptionClients: string[] }) =>
      saveRulesFn({ data: { businessId, ...input } }),
    onSuccess: () => {
      toast.success("Regras salvas.");
      void queryClient.invalidateQueries({ queryKey: ["payment-rules", businessId] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const setMode = (next: PixMode) => {
    if (next === mode || save.isPending) return;
    save.mutate({ pixMode: next, pixExceptionClients: exceptions });
  };

  const toggleException = (name: string) => {
    if (save.isPending) return;
    const has = exceptions.includes(name);
    const next = has ? exceptions.filter((n) => n !== name) : [...exceptions, name].slice(0, 200);
    save.mutate({ pixMode: mode, pixExceptionClients: next });
  };

  const searchTerm = exceptionSearch.trim().toLowerCase();
  const suggestions = searchTerm
    ? customerNames
        .filter((c) => c.name.toLowerCase().includes(searchTerm) && !exceptions.includes(c.name))
        .slice(0, 6)
    : [];

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--c-9aa4b2)] transition-colors hover:text-white"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Voltar
      </button>

      <section className="relative mt-4 overflow-hidden rounded-2xl border border-[rgba(201,162,39,0.25)] bg-[#0b0a07] p-4 sm:p-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[8%] top-[-1px] z-10 h-[1px] w-[84%] bg-[linear-gradient(90deg,transparent,rgba(232,185,62,0.5)_22%,rgba(246,217,122,0.9)_50%,rgba(232,185,62,0.5)_78%,transparent)] shadow-[0_0_15px_2px_rgba(217,168,63,0.25)]"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c9a227]/40 bg-[#c9a227]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#e8b93e]">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-[#e8b93e] shadow-[0_0_8px_rgba(232,185,62,0.9)]"
            />
            Regras
          </span>
          <h1 className="mt-2 max-w-2xl font-['Manrope'] text-xl font-black tracking-tight text-white md:text-2xl">
            Configuração de regras
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--c-9aa4b2)]">
            Defina como o Pix aparece para o cliente no agendamento.
          </p>

          <div className="mx-auto mt-6 max-w-xl">
            <p className="text-sm font-semibold text-white">Chave cadastrada</p>
            <div className="relative mr-auto mt-4 w-full max-w-[9rem]">
              <span
                className={`absolute -top-3 left-4 rounded-md px-2.5 py-1 text-xs font-bold ${
                  pixApproved ? "bg-[#1db954] text-white" : "bg-[#8a6d1c] text-white"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="absolute -left-1 -top-1 size-2.5 rounded-full bg-white shadow"
                />
                {pixApproved ? "Verificada" : "Pendente"}
              </span>
              <p className="overflow-x-auto whitespace-nowrap rounded-2xl bg-[#232327] px-4 py-3.5 text-center text-sm text-[var(--c-b8bec7)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {pixKey || "Nenhuma chave cadastrada"}
              </p>
            </div>
          </div>

          <div className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-3">
            <button
              type="button"
              aria-pressed
              className="h-11 rounded-full bg-[linear-gradient(90deg,#9a7118,#f6d97a,#9a7118)] text-sm font-bold uppercase tracking-wide text-[#231a03] shadow-[0_10px_24px_rgba(217,168,63,0.35)]"
            >
              Pix
            </button>
          </div>

          <div className="mx-auto mt-6 max-w-xl space-y-5">
            {PIX_MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(m.id)}
                  className="block w-full text-left"
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`flex size-5 items-center justify-center rounded-[5px] border text-sm leading-none transition-colors ${
                        active
                          ? "border-[#e8b93e] bg-[#e8b93e] text-[#231a03]"
                          : "border-[#4a4e57] bg-transparent text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span
                      className={`text-[0.95rem] font-bold ${active ? "text-[#e8b93e]" : "text-white"}`}
                    >
                      {m.label}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-[var(--c-b8bec7)]">
                    {m.desc}
                  </span>
                </button>
              );
            })}

            <div>
              <p className="text-sm font-semibold text-[#e8b93e]">
                Configure as exceções em que não será obrigatório o pagamento para clientes ou
                assinantes.
              </p>
              <div className="mt-4 border-b border-[#c9a227]/50 pb-1">
                <span className="text-sm font-semibold text-[#e8b93e]">Cliente</span>
              </div>
              <div className="relative mt-3">
                <input
                  value={exceptionSearch}
                  onChange={(e) => setExceptionSearch(e.target.value)}
                  placeholder="Informe o cliente"
                  aria-label="Informe o cliente"
                  className="h-11 w-full rounded-lg bg-[#101013] px-4 pr-10 text-sm text-white outline-none placeholder:text-[#5c5c64] focus:ring-1 focus:ring-[#e8b93e]/50"
                />
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#8b8e96]"
                  aria-hidden="true"
                />
              </div>
              {suggestions.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-lg border border-[#2c2c31] bg-[#101013]">
                  {suggestions.map(({ name, phone }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        toggleException(name);
                        setExceptionSearch("");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#e8b93e]/10"
                    >
                      <UserRound className="size-4 shrink-0 text-[#8b8e96]" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">
                          {name}
                        </span>
                        <span className="block text-xs text-[#8b8e96]">
                          {phone ? formatPhoneBR(phone) : "Sem telefone"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {exceptions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {exceptions.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#c9a227]/50 bg-[#c9a227]/10 px-3 py-1 text-xs text-[#e8b93e]"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => toggleException(name)}
                        aria-label={`Remover ${name} das exceções`}
                        className="text-[#e8b93e]/70 hover:text-white"
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className="text-center text-sm text-[var(--c-9aa4b2)]">
              Todas as transações são intermediadas pela empresa Agenda Agora
            </p>
            <ServiceDepositPanel businessId={businessId} />
            <details className="text-center">
              <summary className="cursor-pointer list-none text-sm font-semibold text-[#e8b93e] underline-offset-4 hover:underline">
                Termos e Regras
              </summary>
              <div className="mx-auto mt-3 max-w-xl rounded-xl border border-[#2c2c31] bg-[#101013] p-4 text-left text-sm leading-relaxed text-[var(--c-b8bec7)]">
                Ao usar a carteira AgPay, você concorda que os sinais recebidos são intermediados
                pela Agenda Agora e liberados conforme as regras configuradas. Saques são enviados
                exclusivamente para a chave Pix aprovada em seu nome. Valores, prazos e taxas podem
                ser atualizados e serão sempre exibidos antes da confirmação.
              </div>
            </details>
          </div>
        </div>
      </section>
    </div>
  );
}

type WalletEntry = {
  id: string;
  type: string;
  amountCents: number;
  description: string;
  date: string;
};

/** Visão detalhada "Sua Carteira" estilo dashboard AgPay. */
function WalletDetailView({
  availableCents,
  pendingCents,
  entries,
  onBack,
  onWithdraw,
  withdrawalBlocked,
}: {
  availableCents: number;
  pendingCents: number;
  entries: WalletEntry[];
  onBack: () => void;
  onWithdraw: () => void;
  withdrawalBlocked: boolean;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTx, setShowTx] = useState(false);
  const [tab, setTab] = useState<"todos" | "entradas" | "saidas">("todos");
  const [period, setPeriod] = useState<"hoje" | "semana" | "mes">("hoje");
  const [customDay, setCustomDay] = useState("");

  const money = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const week = useMemo(() => {
    const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const now = new Date();
    const out: { label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const total = entries
        .filter((e) => e.type === "payment_credit" && e.date.slice(0, 10) === key)
        .reduce((s, e) => s + e.amountCents, 0);
      out.push({ label: labels[d.getDay()] ?? "", total });
    }
    return out;
  }, [entries]);

  const total7 = week.reduce((s, d) => s + d.total, 0);
  const avg7 = total7 / 7;
  const bestIdx = week.reduce((best, d, i) => (d.total > week[best]!.total ? i : best), 0);
  const vendas = entries
    .filter((e) => e.type === "payment_credit")
    .reduce((s, e) => s + e.amountCents, 0);
  const saquesTotal = entries
    .filter((e) => e.amountCents < 0)
    .reduce((s, e) => s + Math.abs(e.amountCents), 0);
  const flowTotal = vendas + saquesTotal;
  const vendasPct = flowTotal > 0 ? Math.round((vendas / flowTotal) * 100) : 0;
  const saquesPct = flowTotal > 0 ? Math.round((saquesTotal / flowTotal) * 100) : 0;
  const now = new Date();
  const monthTotal = entries
    .filter((e) => {
      const d = new Date(e.date);
      return (
        e.type === "payment_credit" &&
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    })
    .reduce((s, e) => s + e.amountCents, 0);
  const maxBar = Math.max(...week.map((d) => d.total));

  const filteredTx = useMemo(() => {
    const nowTx = new Date();
    const startOfToday = new Date(nowTx.getFullYear(), nowTx.getMonth(), nowTx.getDate()).getTime();
    return entries.filter((e) => {
      const t = new Date(e.date).getTime();
      if (tab === "entradas" && e.amountCents < 0) return false;
      if (tab === "saidas" && e.amountCents >= 0) return false;
      if (customDay) {
        return e.date.slice(0, 10) === customDay;
      }
      if (period === "hoje") return t >= startOfToday;
      if (period === "semana") return t >= startOfToday - 6 * 86400000;
      const d = new Date(e.date);
      return d.getFullYear() === nowTx.getFullYear() && d.getMonth() === nowTx.getMonth();
    });
  }, [entries, tab, period, customDay]);

  return (
    <div className="animate-fade-in mx-auto w-full max-w-[1920px] space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--c-9aa4b2)] transition-colors hover:text-white"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Voltar
      </button>

      <div className="carteira-card2">
        <div className="carteira-beam-top" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-neutral-300">
                Saldo Disponível
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-white">R$</span>
                <span className="text-4xl font-light tracking-tighter text-white sm:text-5xl">
                  {(availableCents / 100).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <p className="mt-2 text-xs text-neutral-300">
                Pendente:{" "}
                <span className="font-semibold text-[var(--c-38bdf8)]">{money(pendingCents)}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onWithdraw}
                disabled={withdrawalBlocked}
                title={withdrawalBlocked ? "Saques bloqueados pelo suporte." : undefined}
                className={`carteira-btn-primary group flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-sm font-bold ${
                  withdrawalBlocked ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                <span className="shine" aria-hidden="true" />
                <span className="relative z-10 flex items-center gap-2.5">
                  <ArrowUpRight className="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
                  {withdrawalBlocked ? "Saques Bloqueados" : "Efetuar Saque"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="carteira-card2 flex h-full flex-col">
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h4 className="font-[Chakra_Petch] text-[12px] font-bold tracking-tight text-white">
                    Performance
                  </h4>
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                    Últimos 7 dias
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                      Total
                    </p>
                    <p className="text-sm font-light tracking-tighter text-white">
                      {money(total7)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                      Média/dia
                    </p>
                    <p className="text-sm font-light tracking-tighter text-neutral-400">
                      {money(Math.round(avg7))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                      Melhor dia
                    </p>
                    <p className="text-sm font-light tracking-tighter text-[#d9a83f]">
                      {week[bestIdx]?.label}
                    </p>
                  </div>
                </div>
              </div>
              <div className="min-h-[160px] w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={week} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="carteiraPerf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#d9a83f" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#d9a83f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="rgba(255,255,255,0.03)"
                      strokeDasharray="4 4"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "rgba(163,163,163,0.4)", fontSize: 10, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#d9a83f"
                      strokeWidth={2}
                      fill="url(#carteiraPerf)"
                      dot={{ r: 3, stroke: "#d9a83f", strokeWidth: 1.5, fill: "var(--c-09090b)" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="grid h-auto gap-3 overflow-hidden lg:col-span-4 lg:h-full lg:grid-rows-2">
          <div className="carteira-card2">
            <div className="p-4">
              <h3 className="mb-3 flex items-center gap-2 font-[Chakra_Petch] text-[12px] font-bold text-white">
                <Activity className="size-[14px] text-neutral-700" aria-hidden="true" />
                Fluxo de Caixa
              </h3>
              <div className="space-y-2.5">
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                      <TrendingUp className="size-3 text-emerald-500" aria-hidden="true" />
                      Vendas
                    </span>
                    <span className="text-sm font-light tracking-tighter text-emerald-500">
                      {money(vendas)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${vendasPct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold text-neutral-700">
                      {vendasPct}%
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                      <TrendingDown className="size-3 text-neutral-500" aria-hidden="true" />
                      Saques
                    </span>
                    <span className="text-sm font-light tracking-tighter text-neutral-400">
                      {money(saquesTotal)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className="h-full rounded-full bg-white/[0.12] transition-all duration-500"
                        style={{ width: `${saquesPct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-[10px] font-bold text-neutral-700">
                      {saquesPct}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="carteira-card2 flex flex-1 flex-col">
            <div className="flex flex-1 flex-col p-4">
              <div className="relative z-10 mb-4 flex items-start justify-between">
                <div>
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
                    Este Mês
                  </p>
                  <h3 className="text-xl font-light tracking-tighter text-white">
                    {money(monthTotal)}
                  </h3>
                </div>
              </div>
              <div className="relative z-10 flex min-h-[50px] flex-1 items-end justify-between gap-1">
                {week.map((d, i) => {
                  const pct = maxBar > 0 ? Math.max(10, Math.round((d.total / maxBar) * 100)) : 10;
                  const top = i === bestIdx;
                  return (
                    <div
                      key={`${d.label}-${i}`}
                      className="flex h-full flex-1 flex-col justify-end"
                    >
                      <div
                        className="relative w-full rounded-sm transition-all duration-300"
                        style={{
                          height: `${pct}%`,
                          background: top ? "#d9a83f" : "rgba(255,255,255,0.06)",
                          boxShadow: top ? "0 0 10px rgba(217,168,63,0.35)" : "none",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="carteira-card2 flex flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTx((v) => !v)}
          aria-expanded={showTx}
          className="flex items-center justify-between gap-3 p-4 text-left sm:p-5"
        >
          <div>
            <h3 className="font-[Chakra_Petch] text-[12px] font-bold tracking-tight text-white">
              Histórico de Transações
            </h3>
            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-600">
              {showTx ? "Toque para recolher" : "Toque para ver tudo"}
            </p>
          </div>
          <ChevronDown
            className={`size-5 shrink-0 text-neutral-500 transition-transform duration-300 ${showTx ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <div
          className={`grid transition-all duration-300 ease-in-out ${showTx ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="flex gap-4 border-b border-white/10 text-sm font-semibold">
                {(
                  [
                    ["todos", "Todos"],
                    ["entradas", "Entradas"],
                    ["saidas", "Saídas"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    aria-pressed={tab === id}
                    className={`pb-2 transition-colors ${
                      tab === id
                        ? "border-b-2 border-[#e8b93e] text-[#e8b93e]"
                        : "text-[#8b8e96] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["hoje", "Hoje"],
                    ["semana", "Semana"],
                    ["mes", "Mês"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setPeriod(id);
                      setCustomDay("");
                    }}
                    aria-pressed={period === id && !customDay}
                    className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors ${
                      period === id && !customDay
                        ? "border-[#e8b93e] text-[#e8b93e]"
                        : "border-[#3a3d44] text-[#8b8e96] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {customDay && (
                  <button
                    type="button"
                    onClick={() => setCustomDay("")}
                    className="rounded-lg border border-[#e8b93e] px-3 py-1.5 text-xs font-semibold text-[#e8b93e]"
                  >
                    {customDay.split("-").reverse().join("/")} ✕
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {filteredTx.length === 0 && (
                  <p className="rounded-xl border border-[var(--c-24272e)] bg-[var(--c-0d0e11)] px-4 py-6 text-center text-sm text-[#656871]">
                    Nenhuma transação neste período.
                  </p>
                )}
                {filteredTx.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--c-24272e)] bg-[var(--c-0d0e11)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {e.description || (e.amountCents >= 0 ? "Recebimento" : "Saque")}
                      </p>
                      <p className="text-xs text-[#656871]">
                        {new Date(e.date).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-bold ${e.amountCents >= 0 ? "text-[#22c55e]" : "text-[#f87171]"}`}
                    >
                      {e.amountCents >= 0 ? "+" : ""}
                      {money(e.amountCents)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Formata a chave já salva para exibição (idempotente; ignora erros). */
function displayPixKey(type: WithdrawalPixKeyType | undefined, key: string | null) {
  if (!key) return "—";
  try {
    return type ? maskPixKey(type, key) : key;
  } catch {
    return key;
  }
}

function AsPayPage() {
  const { businessId, business } = useBusiness();
  const queryClient = useQueryClient();
  const saveWithdrawalPixKeyFn = useServerFn(saveWithdrawalPixKey);
  const getLedgerStatementFn = useServerFn(getLedgerStatement);
  const requestWithdrawalFn = useServerFn(requestWithdrawal);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");

  const {
    data: statement,
    isLoading: statementLoading,
    error: statementError,
  } = useQuery({
    queryKey: ["wallet-statement", businessId],
    enabled: !!businessId,
    queryFn: () => getLedgerStatementFn({ data: { businessId: businessId! } }),
  });

  const withdraw = useMutation({
    mutationFn: () =>
      requestWithdrawalFn({
        data: {
          businessId: businessId!,
          amountCents: Math.round(Number(withdrawalAmount.replace(",", ".")) * 100),
          idempotencyKey: crypto.randomUUID(),
        },
      }),
    onSuccess: ({ withdrawal }) => {
      setWithdrawalAmount("");
      closeSaque();
      setSaqueStep("valor");
      setSaquePin("");
      setSaquePinConfirm("");
      setSaqueVerifying(false);
      toast.success(
        withdrawal?.status === "paid"
          ? "Saque concluído via Pix."
          : "Saque enviado para processamento. Aguarde a confirmação do Pix.",
      );
      void queryClient.invalidateQueries({ queryKey: ["wallet-statement", businessId] });
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  // Popup de saque: etapa 1 = valor/chave; etapa 2 = senha de transferência.
  const [saqueStep, setSaqueStep] = useState<"valor" | "senha">("valor");
  const [saquePin, setSaquePin] = useState("");
  const [saquePinConfirm, setSaquePinConfirm] = useState("");
  const [saqueVerifying, setSaqueVerifying] = useState(false);
  const verifyWithdrawalPinFn = useServerFn(verifyWithdrawalPin);
  const confirmSaque = useMutation({
    mutationFn: async () => {
      await verifyWithdrawalPinFn({ data: { businessId: businessId!, pin: saquePin } });
    },
    onSuccess: () => {
      setSaqueVerifying(false);
      withdraw.mutate();
    },
    onError: (error: Error) => {
      setSaqueVerifying(false);
      toast.error(friendlyError(error));
    },
  });

  const { data: withdrawalPixKey } = useQuery({
    queryKey: ["withdrawal-pix-key", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("withdrawal_pix_key, withdrawal_pix_key_type")
        .eq("id", businessId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [pixKey, setPixKey] = useState("");
  const [started, setStarted] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [walletDetail, setWalletDetail] = useState(false);
  const {
    isOpen: saqueOpen,
    closing: saqueClosing,
    open: openSaque,
    close: closeSaque,
  } = useAnimatedModal();
  const {
    isOpen: sheetOpen,
    closing: sheetClosing,
    open: openSheet,
    close: closeSheet,
  } = useAnimatedModal();
  const [sheetTypeOpen, setSheetTypeOpen] = useState(false);
  const [sheetTypeClosing, setSheetTypeClosing] = useState(false);
  const typeWrapRef = useRef<HTMLDivElement>(null);

  const closeTypeDrop = () => {
    if (!sheetTypeOpen || sheetTypeClosing) return;
    setSheetTypeClosing(true);
    window.setTimeout(() => {
      setSheetTypeOpen(false);
      setSheetTypeClosing(false);
    }, 170);
  };

  useEffect(() => {
    if (!sheetTypeOpen) return;
    const onDown = (event: PointerEvent) => {
      if (typeWrapRef.current && !typeWrapRef.current.contains(event.target as Node)) {
        closeTypeDrop();
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetTypeOpen]);
  const [sheetStep, setSheetStep] = useState<"pix" | "pin" | "pending">("pix");
  const [sheetPixKey, setSheetPixKey] = useState("");
  const [sheetPin, setSheetPin] = useState("");
  const [sheetPinConfirm, setSheetPinConfirm] = useState("");
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);

  useEffect(() => {
    setSheetMounted(true);
  }, []);

  const getAgpayFlagsFn = useServerFn(getAgpayFlags);
  const { data: agpayFlags } = useQuery({
    queryKey: ["carteira-flags", businessId],
    enabled: !!businessId,
    queryFn: () => getAgpayFlagsFn({ data: { businessId: businessId! } }),
    refetchInterval: 10000,
  });
  // Bloqueios controlados pelo master no dossiê do estabelecimento (Painel 3).
  const agpayAccessBlocked = agpayFlags?.accessBlocked === true;
  const agpayWithdrawalBlocked = agpayFlags?.withdrawalBlocked === true;

  const openWallet = () => {
    closeSheet();
    if (onboarded) setStarted(true);
  };
  const [pixKeyType, setPixKeyType] = useState<WithdrawalPixKeyType>("cpf");
  const latestPixApprovalFn = useServerFn(getLatestPixKeyApproval);
  const submitPixApprovalFn = useServerFn(submitPixKeyApproval);
  const saveWithdrawalPinFn = useServerFn(saveWithdrawalPin);
  const getWithdrawalPinStatusFn = useServerFn(getWithdrawalPinStatus);
  const { data: pixApproval } = useQuery({
    queryKey: ["pix-key-approval", businessId],
    enabled: !!businessId,
    queryFn: () => latestPixApprovalFn({ data: { businessId: businessId! } }),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  const { data: pinStatus } = useQuery({
    queryKey: ["withdrawal-pin-status", businessId],
    enabled: !!businessId,
    queryFn: () => getWithdrawalPinStatusFn({ data: { businessId: businessId! } }),
  });

  // Preenchido uma única vez e aprovado: vai direto para a carteira.
  // Bloqueio de acesso (master): volta à tela base — carteira inacessível.
  const onboarded =
    !agpayAccessBlocked && pixApproval?.status === "aprovado" && pinStatus?.pinSet === true;
  useEffect(() => {
    if (onboarded) setStarted(true);
  }, [onboarded]);
  useEffect(() => {
    if (agpayAccessBlocked) setStarted(false);
  }, [agpayAccessBlocked]);

  const finishOnboarding = async () => {
    if (!businessId) return;
    if (pixApproval?.status === "pendente") {
      toast.error("Já existe uma chave Pix em análise. Aguarde a aprovação.");
      return;
    }
    const key = sheetPixKey.trim();
    const jaAprovado = pixApproval?.status === "aprovado";
    // Chave já aprovada pelo master: o fluxo pede apenas a senha (a chave é fixa).
    if (!jaAprovado) {
      const keyError = getWithdrawalPixKeyValidationError(pixKeyType, key);
      if (keyError) {
        toast.error(keyError);
        setSheetStep("pix");
        return;
      }
    }
    const pin = sheetPin.trim();
    if (!/^\d{4}$/.test(pin)) {
      toast.error("Digite uma senha de 4 dígitos numéricos.");
      return;
    }
    if (pin !== sheetPinConfirm.trim()) {
      toast.error("As senhas não conferem. Digite novamente.");
      return;
    }
    setSheetSaving(true);
    try {
      const rawMessage = (err: unknown) =>
        err instanceof Error ? err.message : "Erro desconhecido.";
      let pixSubmitResult: { ok: boolean; autoAprovado: boolean } | undefined;
      if (!jaAprovado) {
        setPixKey(key);
        try {
          await saveWithdrawalPixKeyFn({ data: { businessId, pixKey: key, pixKeyType } });
        } catch (err) {
          throw new Error(`Salvar chave: ${rawMessage(err)}`);
        }
        try {
          pixSubmitResult = await submitPixApprovalFn({ data: { businessId, keyType: pixKeyType, key } });
        } catch (err) {
          throw new Error(`Enviar para análise: ${rawMessage(err)}`);
        }
      }
      try {
        await saveWithdrawalPinFn({ data: { businessId, pin } });
      } catch (err) {
        throw new Error(`Salvar senha: ${rawMessage(err)}`);
      }
      const autoAprovado = jaAprovado || pixSubmitResult?.autoAprovado === true;
      toast.success(
        autoAprovado
          ? "Chave Pix já aprovada pelo suporte."
          : "Chave Pix enviada para aprovação.",
      );
      await queryClient.invalidateQueries({ queryKey: ["pix-key-approval", businessId] });
      await queryClient.invalidateQueries({
        queryKey: ["withdrawal-pin-status", businessId],
      });
      if (autoAprovado) {
        closeSheet();
        setStarted(true);
      } else {
        setSheetStep("pending");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir. Tente de novo.");
    } finally {
      setSheetSaving(false);
    }
  };

  useEffect(() => {
    setPixKey(withdrawalPixKey?.withdrawal_pix_key ?? "");
    setPixKeyType((withdrawalPixKey?.withdrawal_pix_key_type as WithdrawalPixKeyType) ?? "cpf");
  }, [withdrawalPixKey]);

  // Chave aprovada no Painel 3 vira a chave fixa de saque da carteira
  // (gravação única, se a chave gravada ainda não for a aprovada).
  const [approvedKeySynced, setApprovedKeySynced] = useState(false);
  useEffect(() => {
    if (approvedKeySynced || !businessId) return;
    if (pixApproval?.status !== "aprovado" || !pixApproval.key) return;
    if (withdrawalPixKey === undefined) return; // consulta ainda carregando
    setApprovedKeySynced(true);
    const chaveAprovada = String(pixApproval.key).trim();
    if (!chaveAprovada || withdrawalPixKey?.withdrawal_pix_key === chaveAprovada) return;
    saveWithdrawalPixKeyFn({
      data: {
        businessId,
        pixKey: chaveAprovada,
        pixKeyType: (pixApproval.key_type as WithdrawalPixKeyType) ?? "cpf",
      },
    })
      .then(() => queryClient.invalidateQueries({ queryKey: ["withdrawal-pix-key", businessId] }))
      .catch(() => {});
  }, [approvedKeySynced, pixApproval, withdrawalPixKey, businessId]);

  // Recusa no Painel master: fecha o pop-up "Configurações do Pix" apenas na
  // TRANSIÇÃO pendente->recusado (uma vez), mantendo o botão "Abrir Carteira"
  // livre para o dono reenviar a chave quantas vezes precisar.
  const prevApprovalStatusRef = useRef<string | null>(null);
  useEffect(() => {
    const anterior = prevApprovalStatusRef.current;
    const atual = (pixApproval?.status as string | undefined) ?? null;
    prevApprovalStatusRef.current = atual;
    if (!started && atual === "recusado" && anterior === "pendente" && sheetOpen) {
      closeSheet();
      setSheetStep("pix");
      setSheetPixKey("");
      setSheetPin("");
      setSheetPinConfirm("");
    }
  }, [started, pixApproval, sheetOpen, closeSheet]);

  if (!businessId) return <NoBusiness />;

  // Chave Pix enviada e aguardando aprovação: mostra a tela "Em análise"
  // (ao reabrir o Carteira enquanto a aprovação não sai) — identidade dourada Carteira.
  if (!started && pixApproval?.status === "pendente") {
    const keyPendente =
      pixApproval.key || withdrawalPixKey?.withdrawal_pix_key?.trim() || pixKey.trim();
    return (
      <div className="carteira-theme carteira-gold-screen carteira-static relative z-10">
        <AgpayBackground accent="#D9A83F" light="#F3D27A" goldEdges goldWash noCanvas words={[]} />
        <div className="relative mx-auto w-full max-w-md px-4 pb-10 pt-12">
          <div className="carteira-saque-card mx-auto text-center">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-[-1px] z-10 h-[2px] bg-[linear-gradient(90deg,transparent,rgba(232,185,62,0.7)_15%,rgba(246,217,122,1)_50%,rgba(232,185,62,0.7)_85%,transparent)] shadow-[0_0_22px_3px_rgba(217,168,63,0.45)]"
            />
            <div className="relative z-10 p-6">
              <p className="flex items-center justify-center gap-2 text-[1.15rem] font-medium tracking-wide text-[#e8b93e]">
                <span aria-hidden="true">❖</span> Configurações do Pix
              </p>
              <p className="mt-6 font-[Chakra_Petch] text-[1.35rem] font-bold text-[#e8b93e] [text-shadow:0_0_22px_rgba(232,185,62,0.55)]">
                Estamos quase lá…
              </p>
              <p className="mx-auto mt-4 max-w-xs font-[Chakra_Petch] text-[1.2rem] font-semibold leading-snug text-[#f3d27a] [text-shadow:0_0_16px_rgba(232,185,62,0.4)]">
                Falta muito pouco para automatizar seus recebimentos, estamos apenas validando suas
                informações!
              </p>
              <div className="relative mx-auto mt-7 w-full max-w-[16rem]">
                <span className="absolute -top-3 left-4 z-10 rounded-md bg-[#e8b93e] px-2.5 py-1 text-xs font-bold text-[#231a03] shadow-[0_0_14px_2px_rgba(232,185,62,0.5)]">
                  <span
                    aria-hidden="true"
                    className="absolute -left-1 -top-1 size-2.5 rounded-full bg-white shadow"
                  />
                  Em análise
                </span>
              <p className="overflow-x-auto whitespace-nowrap rounded-2xl bg-[#1d1a10] px-4 py-3.5 text-center text-sm text-[#f3d27a] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {keyPendente || "—"}
                </p>
              </div>
              <p className="mx-auto mt-6 max-w-xs text-[1.1rem] font-light leading-snug text-white">
                Sua chave pix está em processo de aprovação e após isso sua carteira já está
                liberada, junto com as configurações de sinal. Em até 3 horas úteis sua carteira
                estará disponível aqui nesta tela. Fique de olho 👀
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (rulesOpen) {
    const rulesPixKey = withdrawalPixKey?.withdrawal_pix_key?.trim() || pixKey.trim() || null;
    return (
      <div className="carteira-theme carteira-gold-screen carteira-static carteira-view-rise relative z-10 space-y-6">
        <AgpayBackground accent="#D9A83F" light="#F3D27A" goldEdges goldWash noCanvas words={[]} />
        <PaymentRulesView
          businessId={businessId}
          pixKey={rulesPixKey}
          pixApproved={pixApproval?.status === "aprovado"}
          onBack={() => setRulesOpen(false)}
        />
      </div>
    );
  }

  if (!started) {
    return (
      <div className="carteira-theme space-y-6">
        <section aria-label="Abrir carteira" className="relative w-full px-6 pb-8 pt-10">
          <AgpayBackground
            accent="var(--c-4a90e2)"
            light="var(--c-8abaf0)"
            morphAccentTo="#D9A83F"
            morphLightTo="#F3D27A"
            morphDelayMs={500}
            morphDurationMs={1200}
            goldEdges
            goldWash
            words={["AG PAY", "PIX", "SALDO", "GATEWAY", "AG PAY", "PAGAMENTO", "AG PAY"]}
          />
          <div className="relative z-10 mx-auto max-w-xl text-center">
            <p className="lembretes-hero-eyebrow lembretes-fade-slide-up lembretes-delay-1">
              Ag Pay <span className="ew-white">Ag Pay</span>
            </p>
            <h1 className="lembretes-hero-title lembretes-fade-slide-up lembretes-delay-2 mx-auto mt-4 max-w-md">
              Seu saldo <span>Ag Pay</span>
            </h1>
            <p className="lembretes-hero-sub lembretes-fade-slide-up lembretes-delay-3 mx-auto mt-6 max-w-md">
              Receba sinais via Pix, acompanhe o saldo e crie cobranças com velocidade e segurança.
            </p>
            <button
              type="button"
              disabled={pixApproval === undefined}
              aria-busy={pixApproval === undefined}
              onClick={() => {
                if (!agpayAccessBlocked && pixApproval?.status === "aprovado") {
                  if (pinStatus?.pinSet === true) {
                    setStarted(true);
                    return;
                  }
                  // Chave já aprovada: só falta a senha de transferência.
                  setSheetStep("pin");
                  setSheetPixKey(pixApproval.key || "");
                  openSheet();
                  return;
                }
                setSheetStep("pix");
                setPixKeyType("cpf");
                openSheet();
              }}
              className={`carteira-btn-gold lembretes-fade-slide-up lembretes-delay-4 mt-10 ${
                pixApproval === undefined ? "cursor-wait opacity-70" : ""
              }`}
            >
              Abrir Ag Pay
              <ChevronRight className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Aviso abaixo"
              className="carteira-aviso-outline lembretes-fade-slide-up lembretes-delay-5 mt-10"
            >
              Aviso Abaixo
            </button>
            <div className="lembretes-scroll-cue lembretes-fade-slide-up lembretes-delay-6 mt-10">
              <span>Scroll</span>
              <span aria-hidden="true" className="lembretes-scroll-line" />
            </div>
            <div className="lembretes-fade-slide-up lembretes-delay-7 mx-auto mt-14 max-w-md text-left">
              <p className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-block h-px w-10 shrink-0 bg-[#e8b93e] shadow-[0_0_8px_rgba(232,185,62,0.8)]"
                />
                <span className="lembretes-hero-eyebrow" style={{ textIndent: 0 }}>
                  Receber sinais
                </span>
              </p>
              <h2 className="lembretes-hero-title small mt-3">
                Receba <span>e saque</span>
              </h2>
              <p className="lembretes-hero-sub mt-4">
                Aqui você configura a chave Pix, recebe os sinais dos agendamentos e saca o saldo
                para a sua conta quando quiser.
              </p>
            </div>
            <AgpayStats />
            <AgpayFeatures />
          </div>
        </section>
        {sheetMounted &&
          sheetOpen &&
          createPortal(
            <div
              className="aa-popup-full fixed inset-0 z-[70] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Configurações do Pix"
            >
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => closeSheet()}
                className={`carteira-pix-sheet-backdrop absolute inset-0 h-full w-full cursor-default ${sheetClosing ? "animate-backdrop-out" : "animate-backdrop"}`}
              />
              <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-4">
                <div
                  className={`carteira-pix-sheet pointer-events-auto relative w-full max-w-[28rem] px-6 pb-8 pt-6 text-center ${sheetClosing ? "animate-modal-out" : "animate-modal-in"}`}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-[-1px] z-10 h-[2px] bg-[linear-gradient(90deg,transparent,rgba(232,185,62,0.7)_15%,rgba(246,217,122,1)_50%,rgba(232,185,62,0.7)_85%,transparent)] shadow-[0_0_22px_3px_rgba(217,168,63,0.45)]"
                  />
                  <p className="text-xl font-medium tracking-wide text-[#e8b93e]">
                    <span aria-hidden="true">❖</span> Configurações do Pix
                  </p>
                  {sheetStep === "pix" ? (
                    <>
                      <p className="mt-6 text-[1.29rem] font-light leading-snug text-white">
                      Configure sua <strong className="font-bold">Chave Pix</strong> para o
                      recebimento dos valores que serão intermediados e processados pela empresa{" "}
                      <strong className="font-bold">Agenda Agora</strong>.
                    </p>
                    <div className="carteira-pix-sheet-input mt-8 flex items-center gap-2 !px-3 !text-left">
                      <div ref={typeWrapRef} className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setSheetTypeOpen((v) => !v)}
                          aria-expanded={sheetTypeOpen}
                          aria-label="Tipo de chave Pix"
                          className="flex items-center gap-1 rounded-full bg-black/10 px-2.5 py-1 text-[1.2rem] font-light leading-none tracking-tight text-black"
                        >
                          {pixKeyTypeLabel[pixKeyType]}
                          <ChevronUp
                            className={`size-3.5 transition-transform ${sheetTypeOpen ? "" : "rotate-180"}`}
                            aria-hidden="true"
                          />
                        </button>
                        {sheetTypeOpen && (
                          <div
                            className={`carteira-type-drop absolute left-0 top-full z-10 mt-1 min-w-[9rem] overflow-hidden rounded-xl bg-white shadow-xl ${sheetTypeClosing ? "closing" : ""}`}
                          >
                            {withdrawalPixKeyTypes.map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => {
                                  setPixKeyType(type);
                                  // Reaplica a pontuação do padrão brasileiro Pix ao trocar o tipo.
                                  setSheetPixKey(maskPixKey(type, sheetPixKey));
                                  setSheetTypeOpen(false);
                                  setSheetTypeClosing(false);
                                }}
                                className={`block w-full px-3 py-2 text-left text-[1.2rem] font-light leading-none tracking-tight transition-colors hover:bg-black/5 ${
                                  pixKeyType === type ? "text-black" : "text-[var(--c-9ca3af)]"
                                }`}
                              >
                                {pixKeyTypeLabel[type]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        value={sheetPixKey}
                        onChange={(event) =>
                          setSheetPixKey(maskPixKey(pixKeyType, event.target.value))
                        }
                        onFocus={closeTypeDrop}
                        placeholder={pixKeyMaskHint[pixKeyType]}
                        aria-label="Sua chave Pix"
                        className="min-w-0 flex-1 bg-transparent text-[1.35rem] font-light leading-none tracking-tight text-[var(--c-4b5563)] outline-none placeholder:text-[var(--c-9ca3af)]"
                      />
                    </div>
                    <p className="mt-8 text-[1.2rem] font-light leading-snug text-white">
                      Para a sua segurança, a chave será encaminhada para aprovação e nossa equipe
                      irá validar e verificar sua chave Pix para garantir a titularidade.
                    </p>
                    <button
                      type="button"
                      disabled={!sheetPixKey.trim()}
                      onClick={() => setSheetStep("pin")}
                      className="carteira-pix-sheet-advance mt-8 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Avançar
                      <ChevronRight
                        className="size-5 shrink-0"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={openWallet}
                      className="mt-4 text-[1.15rem] font-medium text-[#e8b93e] transition-colors hover:text-[#f3d27a]"
                    >
                      Configurar mais tarde
                    </button>
                  </>
                ) : sheetStep === "pin" ? (
                  <>
                    <p className="carteira-pix-sheet-title mt-6">Senha de transferência</p>
                    <p className="mt-2 text-[1.1rem] font-light leading-snug text-white/80">
                      É uma senha que será solicitada sempre que você for executar uma transação da
                      sua carteira
                    </p>
                    <label
                      htmlFor="carteira-pin"
                      className="mt-8 block text-[1.1rem] font-light text-white/80"
                    >
                      Digite uma senha de 4 dígitos
                    </label>
                    <input
                      id="carteira-pin"
                      value={sheetPin}
                      onChange={(event) =>
                        setSheetPin(event.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      placeholder="••••"
                      aria-label="Digite uma senha de 4 dígitos"
                      inputMode="numeric"
                      type="password"
                      maxLength={4}
                      autoComplete="new-password"
                      className="carteira-pix-sheet-input mt-3"
                    />
                    <label
                      htmlFor="carteira-pin-confirm"
                      className="mt-6 block text-[1.1rem] font-light text-white/80"
                    >
                      Confirme sua senha
                    </label>
                    <input
                      id="carteira-pin-confirm"
                      value={sheetPinConfirm}
                      onChange={(event) =>
                        setSheetPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      placeholder="••••"
                      aria-label="Confirme sua senha"
                      inputMode="numeric"
                      type="password"
                      maxLength={4}
                      autoComplete="new-password"
                      className="carteira-pix-sheet-input carteira-pix-sheet-input-secondary mt-3"
                    />
                    {sheetPinConfirm.length === 4 && sheetPin !== sheetPinConfirm && (
                      <p role="alert" className="mt-3 text-sm text-red-400">
                        As senhas não conferem.
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={
                        sheetSaving || sheetPin.length !== 4 || sheetPin !== sheetPinConfirm
                      }
                      onClick={() => void finishOnboarding()}
                      className="carteira-pix-sheet-advance mt-8 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sheetSaving ? "Salvando…" : "Avançar"}
                      <ChevronRight
                        className="size-5 shrink-0"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-6 font-[Chakra_Petch] text-[1.35rem] font-bold text-[#e8b93e] [text-shadow:0_0_22px_rgba(232,185,62,0.55)]">
                      Estamos quase lá…
                    </p>
                    <p className="mx-auto mt-4 max-w-xs font-[Chakra_Petch] text-[1.2rem] font-semibold leading-snug text-[#f3d27a] [text-shadow:0_0_16px_rgba(232,185,62,0.4)]">
                      Falta muito pouco para automatizar seus recebimentos, estamos apenas validando
                      suas informações!
                    </p>
                    <p className="mt-6 font-[Chakra_Petch] text-[1.25rem] font-bold text-[#e8b93e] [text-shadow:0_0_22px_rgba(232,185,62,0.55)]">
                      Chave pix aguardando aprovação
                    </p>
                    <div className="relative mx-auto mt-4 w-full max-w-[16rem]">
                      <span className="absolute -top-3 left-4 rounded-md bg-[#e8b93e] px-2.5 py-1 text-xs font-bold text-[#231a03]">
                        <span
                          aria-hidden="true"
                          className="absolute -left-1 -top-1 size-2.5 rounded-full bg-white shadow"
                        />
                        Em análise
                      </span>
                      <p className="overflow-x-auto whitespace-nowrap rounded-2xl bg-[#232327] px-4 py-3.5 text-center text-sm text-[var(--c-b8bec7)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {sheetPixKey.trim() || "—"}
                      </p>
                    </div>
                    <p className="mx-auto mt-6 max-w-xs text-[1.1rem] font-light leading-snug text-white">
                      Sua chave pix está em processo de aprovação e após isso sua carteira já está
                      liberada, junto com as configurações de sinal. Em até 3 horas úteis sua
                      carteira estará disponível aqui nesta tela. Fique de olho 👀
                    </p>
                    <button
                      type="button"
                      onClick={openWallet}
                      className="mt-4 text-[1.15rem] font-medium text-[#e8b93e] transition-colors hover:text-[#f3d27a]"
                    >
                      Fechar
                    </button>
                  </>
                )}
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }

  if (walletDetail) {
    return (
      <div className="carteira-theme carteira-gold-screen carteira-view-rise relative z-10 mx-auto w-full max-w-2xl space-y-6">
        <WalletDetailView
          availableCents={statement?.availableCents ?? 0}
          pendingCents={statement?.pendingChargesCents ?? 0}
          entries={
            (statement?.entries ?? []) as {
              id: string;
              type: string;
              amountCents: number;
              description: string;
              date: string;
            }[]
          }
          onBack={() => setWalletDetail(false)}
          onWithdraw={() => {
            if (agpayWithdrawalBlocked) {
              toast.error("Os saques da sua carteira estão bloqueados pelo suporte.");
              return;
            }
            setSaqueStep("valor");
            setSaquePin("");
            setSaquePinConfirm("");
            setSaqueVerifying(false);
            openSaque();
          }}
          withdrawalBlocked={agpayWithdrawalBlocked}
        />
        {sheetMounted &&
          saqueOpen &&
          createPortal(
            <div
              className="aa-popup-full fixed inset-0 z-[70] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Solicitar saque"
            >
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => closeSaque()}
                className={`fixed inset-0 h-full w-full cursor-default bg-black/70 ${saqueClosing ? "animate-backdrop-out" : "animate-backdrop"}`}
              />
              <div className="flex min-h-full items-center justify-center p-4">
                <div
                  className={`carteira-saque-card relative w-full max-w-sm ${saqueClosing ? "animate-modal-out" : "animate-modal-in"}`}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-[-1px] z-10 h-[2px] bg-[linear-gradient(90deg,transparent,rgba(232,185,62,0.7)_15%,rgba(246,217,122,1)_50%,rgba(232,185,62,0.7)_85%,transparent)] shadow-[0_0_22px_3px_rgba(217,168,63,0.45)]"
                  />
                  <div className="relative z-10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-extrabold tracking-tight text-white">
                        Solicitar Saque
                      </h2>
                      <p className="mt-0.5 text-xs text-[#b8bec7]">
                        Saldo:{" "}
                        {((statement?.availableCents ?? 0) / 100).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => closeSaque()}
                      aria-label="Fechar"
                      className="rounded-lg p-1 text-[#c9b57a] transition-colors hover:text-[#f6d97a]"
                    >
                      <X className="size-5" aria-hidden="true" />
                    </button>
                  </div>

                  {saqueStep === "valor" ? (
                    <>
                      {/* Pix é o único meio de saque — identidade dourada fixa da Carteira. */}
                      <div className="mt-4 grid grid-cols-1 rounded-xl border border-[#f6d97a]/25 bg-[#161310] p-1">
                        <span className="flex items-center justify-center gap-2 rounded-lg bg-[linear-gradient(90deg,#9a7118,#f6d97a,#9a7118)] py-2 text-sm font-extrabold tracking-widest text-[#231a03]">
                          PIX
                        </span>
                      </div>

                      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#c9b57a]">
                        Valor do saque
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#f6d97a]/35 bg-[#121014] px-3.5 py-3">
                        <span className="text-sm font-bold text-[#e8ca77]">R$</span>
                        <input
                          id="saque-valor"
                          className="w-full min-w-0 bg-transparent text-base text-white outline-none placeholder:text-[#6b6f78]"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={withdrawalAmount}
                          onChange={(event) => setWithdrawalAmount(event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setWithdrawalAmount(((statement?.availableCents ?? 0) / 100).toFixed(2))
                          }
                          className="shrink-0 rounded-md bg-[#2a2410] px-2.5 py-1 text-[11px] font-extrabold tracking-widest text-[#f6d97a] transition-colors hover:bg-[#3a2f14]"
                        >
                          MÁX
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#8b8e96]">
                        Min R$ 10,00 • Taxa R$ 3,00
                      </p>

                      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#c9b57a]">
                        Chave Pix
                      </p>
                      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-[#f6d97a]/25 bg-[#14120e] px-3.5 py-3">
                        <span className="text-sm font-semibold text-white">
                          {pixKeyTypeLabel[
                            (withdrawalPixKey?.withdrawal_pix_key_type as WithdrawalPixKeyType) ??
                              "cpf"
                          ] ?? "Chave Pix"}
                        </span>
                        <ChevronDown className="size-4 shrink-0 text-[#c9b57a]" aria-hidden="true" />
                      </div>
                      <div className="mt-2 rounded-xl border border-[#f6d97a]/25 bg-[#14120e] px-3.5 py-3">
                        <p className="break-all text-sm font-semibold text-[#e8ca77]">
                          {displayPixKey(
                            withdrawalPixKey?.withdrawal_pix_key_type as WithdrawalPixKeyType,
                            withdrawalPixKey?.withdrawal_pix_key ?? null,
                          )}
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-[#8b8e96]">
                          Chave fixa verificada — o saque vai direto para ela.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSaquePin("");
                          setSaquePinConfirm("");
                          setSaqueStep("senha");
                        }}
                        disabled={
                          agpayWithdrawalBlocked ||
                          !withdrawalPixKey?.withdrawal_pix_key ||
                          Math.round(Number(withdrawalAmount.replace(",", ".")) * 100) <
                            MIN_WITHDRAWAL_CENTS ||
                          withdraw.isPending
                        }
                        className="carteira-saque-gold-btn mt-5"
                      >
                        Confirmar Saque
                        <ArrowUpRight className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                      </button>
                      {agpayWithdrawalBlocked && (
                        <p className="mt-2 text-center text-[11px] font-semibold text-[#e8b93e]">
                          Saques bloqueados temporariamente pelo suporte.
                        </p>
                      )}
                      <p className="mt-2 text-center text-[11px] text-[#8b8e96]">
                        Processado em até 24h úteis
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-center text-lg font-extrabold text-white">
                        Senha de transferência
                      </p>
                      <p className="mx-auto mt-1.5 max-w-[17rem] text-center text-xs leading-snug text-[#b8bec7]">
                        É a senha cadastrada no seu Ag Pay. Ela é solicitada a cada
                        transação.
                      </p>
                      <label
                        htmlFor="saque-pin"
                        className="mt-5 block text-center text-sm text-[#b8bec7]"
                      >
                        Digite sua senha de 4 dígitos
                      </label>
                      <input
                        id="saque-pin"
                        value={saquePin}
                        onChange={(event) => setSaquePin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                        placeholder="••••"
                        aria-label="Senha de transferência"
                        inputMode="numeric"
                        type="password"
                        maxLength={4}
                        autoComplete="off"
                        className="carteira-pix-sheet-input mt-2 !text-center"
                      />
                      <label
                        htmlFor="saque-pin-confirm"
                        className="mt-4 block text-center text-sm text-[#b8bec7]"
                      >
                        Confirme sua senha
                      </label>
                      <input
                        id="saque-pin-confirm"
                        value={saquePinConfirm}
                        onChange={(event) =>
                          setSaquePinConfirm(event.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        placeholder="••••"
                        aria-label="Confirme a senha de transferência"
                        inputMode="numeric"
                        type="password"
                        maxLength={4}
                        autoComplete="off"
                        className="carteira-pix-sheet-input mt-2 !text-center"
                      />
                      {saquePinConfirm.length === 4 && saquePin !== saquePinConfirm && (
                        <p role="alert" className="mt-2 text-center text-xs text-red-400">
                          As senhas não conferem.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => confirmSaque.mutate()}
                        disabled={
                          saqueVerifying ||
                          withdraw.isPending ||
                          saquePin.length !== 4 ||
                          saquePin !== saquePinConfirm
                        }
                        className="carteira-saque-gold-btn mt-5"
                      >
                        {saqueVerifying || withdraw.isPending ? "Processando…" : "Confirmar Saque"}
                        <ArrowUpRight className="size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSaqueStep("valor")}
                        className="mt-3 w-full text-center text-sm font-medium text-[#e8b93e] transition-colors hover:text-[#f3d27a]"
                      >
                        Voltar
                      </button>
                    </>
                  )}
                </div>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  }

  const available = statement?.availableCents ?? 0;
  const pending = statement?.pendingChargesCents ?? 0;
  const locked = statement?.lockedCents ?? 0;

  return (
    <div className="carteira-theme carteira-gold-screen carteira-static carteira-dim relative z-30">
      <AgpayBackground accent="#D9A83F" light="#F3D27A" goldEdges goldWash noCanvas words={[]} />
      <PageHeader
        title="Sua carteira"
        subtitle={`Sinais pagos pelos clientes de ${business?.name ?? "seu negócio"}.`}
      />

      <button
        type="button"
        onClick={() => setWalletDetail(true)}
        aria-label="Abrir detalhes da carteira"
        className="relative mx-auto block w-full max-w-2xl cursor-pointer overflow-hidden rounded-2xl border border-[rgba(201,162,39,0.25)] bg-[#0b0a07] p-6 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_18px_44px_-32px_rgba(0,0,0,0.95),0_8px_28px_-26px_rgba(217,168,63,0.5)] transition-transform hover:-translate-y-0.5"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[8%] top-[-1px] z-10 h-[1px] w-[84%] bg-[linear-gradient(90deg,transparent,rgba(232,185,62,0.5)_22%,rgba(246,217,122,0.9)_50%,rgba(232,185,62,0.5)_78%,transparent)] shadow-[0_0_15px_2px_rgba(217,168,63,0.25)]"
        />
        <div className="relative z-10 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.18)]">
              <CircleDollarSign className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Saldo disponível
              </p>
              <p className="font-display text-3xl font-bold text-white">
                {statementLoading ? "Carregando…" : formatPrice(available)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#c9a227]/40 bg-[#c9a227]/10 text-[#e8b93e]">
              <History className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Total recebido
              </p>
              <p className="font-display text-2xl font-bold">
                {statementLoading ? "Carregando…" : formatPrice(statement?.totalReceivedCents ?? 0)}
              </p>
            </div>
          </div>

          {locked > 0 && (
            <p className="text-sm text-muted-foreground">
              Em saque (aguardando confirmação do Pix): {formatPrice(locked)}
            </p>
          )}
          {statement?.withdrawalsBlocked && (
            <p role="alert" className="text-sm text-amber-300">
              Seu saldo está negativo por um estorno. Novos saques ficam bloqueados até a revisão do
              administrador.
            </p>
          )}

          <div className="h-px w-full bg-white/10" />

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.18)]">
              <Clock3 className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Saldo pendente
              </p>
              <p className="font-display text-3xl font-bold">{formatPrice(pending)}</p>
            </div>
          </div>
        </div>
      </button>

      <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-muted-foreground">
        Todas as transações de sinal são intermediadas pelo Agenda Agora.
      </p>

      <div className="mx-auto mt-6 max-w-2xl text-center">
        <button
          type="button"
          onClick={() => setRulesOpen(true)}
          className="carteira-btn-gold mt-2"
          style={{ width: "76.5%" }}
        >
          Configuração de regras
        </button>
        <p className="mt-4 text-sm font-medium text-[#25d366]">
          Todas as transações são intermediadas pela empresa Agenda Agora
        </p>
      </div>
    </div>
  );
}
