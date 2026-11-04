import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Calculator,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ClipboardList,
  Copy,
  Info,
  Percent,
  Pencil,
  Plus,
  ScrollText,
  ShoppingCart,
  Trash2,
  UsersRound,
  Lightbulb,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { requireMasterAccess } from "@/lib/master.functions";
import {
  addSdrIdea,
  createSdr,
  getSdrIdeas,
  getSdrTeam,
  removeSdrIdea,
  updateSdr,
  type SdrTeamRow,
} from "@/lib/sdr.functions";
import { formatPrice } from "@/lib/format";
import SDRCalculator from "@/components/SDRCalculator";

export const Route = createFileRoute("/_authenticated/painel/equipe-geral")({
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Equipe Geral — Painel master" },
      { name: "description", content: "Performance da equipe de SDRs e vendedores." },
    ],
  }),
  component: EquipeGeralPage,
});

const SDR_LOGIN_PATH = "/sdr";

type SortKey = "name" | "cadastros" | "vendas" | "conversao" | "comissao";

const emptyForm = {
  name: "",
  email: "",
  pin: "",
  signupGoal: "10",
  salesGoal: "5",
  commission: "50",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "S";
}

function parseMoney(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return Math.round((Number(normalized) || 0) * 100);
}

function EquipeGeralPage() {
  const queryClient = useQueryClient();
  const teamFn = useServerFn(getSdrTeam);
  const createFn = useServerFn(createSdr);
  const updateFn = useServerFn(updateSdr);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SdrTeamRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [active, setActive] = useState(true);
  const [credentials, setCredentials] = useState<{ link: string; email: string; pin: string } | null>(
    null,
  );
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "cadastros", dir: -1 });
  const [calcOpen, setCalcOpen] = useState(false);
  const [preset, setPreset] = useState("");
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDetails, setIdeaDetails] = useState("");

  const team = useQuery({ queryKey: ["sdr-team"], queryFn: () => teamFn() });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["sdr-team"] });

  const create = useMutation({
    mutationFn: (input: {
      name: string;
      email: string;
      pin: string;
      signupGoal: number;
      salesGoal: number;
      commissionCents: number;
    }) => createFn({ data: input }),
    onSuccess: (_result, input) => {
      toast.success("SDR cadastrado! Guarde os dados de acesso.");
      setCredentials({ link: `${window.location.origin}${SDR_LOGIN_PATH}`, email: input.email, pin: input.pin });
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: (input: {
      id: string;
      name: string;
      email: string;
      pin: string;
      signupGoal: number;
      salesGoal: number;
      commissionCents: number;
      active: boolean;
      presetScripts?: string;
    }) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success("SDR atualizado.");
      setDialogOpen(false);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sdrs = team.data?.sdrs ?? [];

  // Ideias do Quadro (somente quando o lápis está aberto para um SDR específico)
  const ideas = useQuery({
    queryKey: ["sdr-ideas", editing?.id ?? "none"],
    enabled: !!editing && dialogOpen,
    queryFn: () => getSdrIdeas({ data: { sdrId: editing!.id } }),
  });

  const addM = useMutation({
    mutationFn: (input: { sdrId: string; title: string; details?: string }) =>
      addSdrIdea({ data: input }),
    onSuccess: () => {
      setIdeaTitle("");
      setIdeaDetails("");
      toast.success("Ideia adicionada ao quadro do SDR.");
      void queryClient.invalidateQueries({ queryKey: ["sdr-ideas"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeM = useMutation({
    mutationFn: (ideaId: string) => removeSdrIdea({ data: { ideaId } }),
    onSuccess: () => {
      toast.success("Ideia removida.");
      void queryClient.invalidateQueries({ queryKey: ["sdr-ideas"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sorted = useMemo(() => {
    const list = [...sdrs];
    const numeric = (row: SdrTeamRow, key: SortKey) =>
      key === "comissao" ? row.comissaoCents : (row[key] as number);
    list.sort((a, b) => {
      const { key, dir } = sort;
      if (key === "name") return a.name.localeCompare(b.name) * dir;
      return (numeric(a, key) - numeric(b, key)) * dir;
    });
    return list;
  }, [sdrs, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: -1 },
    );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setPreset("");
    setIdeaTitle("");
    setIdeaDetails("");
    setActive(true);
    setCredentials(null);
    setDialogOpen(true);
  };

  const openEdit = (row: SdrTeamRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      email: row.email,
      pin: "",
      signupGoal: String(row.signupGoal),
      salesGoal: String(row.salesGoal),
      commission: String(row.commissionCents / 100),
    });
    setPreset(row.presetScripts ?? "");
    setActive(row.active);
    setCredentials(null);
    setDialogOpen(true);
  };

  const submit = () => {
    const pin = form.pin.trim();
    if (!editing && !/^\d{4}$/.test(pin)) {
      toast.error("A senha do SDR deve ter exatamente 4 dígitos.");
      return;
    }
    if (editing && pin && !/^\d{4}$/.test(pin)) {
      toast.error("A nova senha deve ter exatamente 4 dígitos.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      pin,
      signupGoal: Math.max(Math.trunc(Number(form.signupGoal)) || 0, 0),
      salesGoal: Math.max(Math.trunc(Number(form.salesGoal)) || 0, 0),
      commissionCents: Math.max(parseMoney(form.commission), 0),
    };
    if (editing) update.mutate({ id: editing.id, ...payload, active, presetScripts: preset });
    else create.mutate(payload);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const kpis = team.data?.kpis;
  const pending = team.isPending;

  return (
    <div className="mx-auto w-full p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--c-1677ff)]/20 bg-[var(--c-1677ff)]/10 text-[var(--c-5da8ff)]">
          <UsersRound className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold uppercase tracking-tight">Equipe SDR</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe cadastros, conversões e desempenho da equipe.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="h-10 rounded-xl bg-[var(--c-1677ff)] px-4 text-sm font-bold text-white shadow-[0_8px_24px_rgba(22,119,255,0.35)] hover:bg-[var(--c-3b82f6)]"
        >
          <Plus className="size-4" /> Novo SDR
        </Button>
      </div>

      {team.isError ? (
        <p role="alert" className="mt-6 rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
          Não foi possível carregar a equipe. Atualize a página e tente novamente.
        </p>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<UsersRound className="size-5" />}
          label="SDRs ativos"
          value={pending ? "—" : String(kpis?.activeSdrs ?? 0)}
          delta={null}
        />
        <KpiCard
          icon={<ClipboardList className="size-5" />}
          label="Cadastros criados"
          value={pending ? "—" : String(kpis?.cadastros.value ?? 0)}
          delta={kpis?.cadastros.delta ?? null}
          hint="este mês"
        />
        <KpiCard
          icon={<ShoppingCart className="size-5" />}
          label="Vendas fechadas"
          value={pending ? "—" : String(kpis?.vendas.value ?? 0)}
          delta={kpis?.vendas.delta ?? null}
          hint="este mês"
        />
        <KpiCard
          icon={<Percent className="size-5" />}
          label="Conversão"
          value={pending ? "—" : `${kpis?.conversao.value ?? 0}%`}
          delta={kpis?.conversao.delta ?? null}
          hint="este mês"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="report-luminous-card report-effect-medium p-4">
          <p className="relative z-10 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
            Vendas por SDR — <span className="text-[var(--c-69a2ff)]">últimos 30 dias</span>
          </p>
          <div className="relative z-10 mt-3 h-72">
            {!team.data || team.data.barData.length === 0 ? (
              <ChartEmpty text="Sem SDRs cadastrados ainda." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={team.data.barData} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#8a919c", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#626872", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={34}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "#0d1015",
                      border: "1px solid #2a2f37",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "#e6e9ee",
                    }}
                    labelStyle={{ color: "#8fb3ff", fontWeight: 600 }}
                  />
                  <Bar dataKey="vendas" fill="#1677ff" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    <LabelList dataKey="vendas" position="top" fill="#cfd6e4" fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="report-luminous-card report-effect-medium p-4">
          <p className="relative z-10 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
            Cadastros por semana
          </p>
          <div className="relative z-10 mt-3 h-72">
            {!team.data ? (
              <ChartEmpty text="Carregando…" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={team.data.weekData} margin={{ top: 24, right: 12, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sdr-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1677ff" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#1677ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#8a919c", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#626872", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                    width={34}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0d1015",
                      border: "1px solid #2a2f37",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "#e6e9ee",
                    }}
                    labelStyle={{ color: "#8fb3ff", fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cadastros"
                    stroke="#1677ff"
                    strokeWidth={2.5}
                    fill="url(#sdr-area)"
                    dot={{ r: 5, fill: "#ffffff", stroke: "#1677ff", strokeWidth: 2.5 }}
                    activeDot={{ r: 6 }}
                  >
                    <LabelList dataKey="cadastros" position="top" fill="#e6ecf5" fontSize={12} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <section className="report-luminous-card report-effect-medium mt-4 p-4">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
            <UsersRound className="size-4 text-[var(--c-69a2ff)]" /> Equipe de SDRs
          </p>
          <p className="flex items-center gap-1.5 text-xs text-[#777d87]">
            <Info className="size-3.5" /> Novos cadastros feitos pelo SDR aparecem no Painel 2 do
            estabelecimento.
          </p>
        </div>

        <div className="relative z-10 mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-xs uppercase text-[#777d87]">
              <tr>
                <th className="pb-2 pr-4">
                  <SortButton label="SDR" active={sort.key === "name"} dir={sort.dir} onClick={() => toggleSort("name")} />
                </th>
                <th className="pb-2 pr-4">
                  <SortButton label="Cadastros" active={sort.key === "cadastros"} dir={sort.dir} onClick={() => toggleSort("cadastros")} />
                </th>
                <th className="pb-2 pr-4">
                  <SortButton label="Vendas" active={sort.key === "vendas"} dir={sort.dir} onClick={() => toggleSort("vendas")} />
                </th>
                <th className="pb-2 pr-4">
                  <SortButton label="Conversão" active={sort.key === "conversao"} dir={sort.dir} onClick={() => toggleSort("conversao")} />
                </th>
                <th className="pb-2 pr-4">
                  <SortButton label="Comissão estimada" active={sort.key === "comissao"} dir={sort.dir} onClick={() => toggleSort("comissao")} />
                </th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.id} className="border-t border-white/[0.06]">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--c-1677ff)]/15 text-xs font-bold text-[var(--c-60a5fa)]">
                        {initials(row.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-[var(--c-e6e9ee)]">{row.name}</span>
                        <span className="block truncate text-xs text-[#777d87]">{row.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-medium text-[var(--c-dfe3ea)]">{row.cadastros}</td>
                  <td className="py-3 pr-4 font-medium text-[var(--c-dfe3ea)]">{row.vendas}</td>
                  <td className="py-3 pr-4 text-[var(--c-dfe3ea)]">{row.conversao}%</td>
                  <td className="py-3 pr-4 text-[var(--c-dfe3ea)]">{formatPrice(row.comissaoCents)}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.active ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-[#9aa1ab]"
                      }`}
                    >
                      <span className="size-1.5 rounded-full bg-current" />
                      {row.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${row.name}`}
                      className="text-[#8a919c] hover:bg-white/10 hover:text-white"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!sorted.length && !pending ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#777d87]">
                    Nenhum SDR cadastrado. Clique em <strong className="text-white">Novo SDR</strong> para
                    criar o primeiro painel.
                  </td>
                </tr>
              ) : null}
              {pending ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#777d87]">
                    Carregando equipe…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="report-luminous-card report-effect-medium mt-4 overflow-hidden">
        <button
          type="button"
          onClick={() => setCalcOpen((open) => !open)}
          aria-expanded={calcOpen}
          className="relative z-10 flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/[0.03]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--c-1677ff)]/25 bg-[var(--c-1677ff)]/10 text-[var(--c-69a2ff)]">
            <Calculator className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--c-eef1f6)]">
              Calculadora de metas SDR
            </span>
            <span className="block text-xs text-[#777d87]">
              Simulador de ganhos — comissões, bônus semanais e projeção mensal.
            </span>
          </span>
          <span className="hidden rounded-full border border-[var(--c-1677ff)]/30 bg-[var(--c-1677ff)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--c-8fb3ff)] sm:block">
            Simulação
          </span>
          {calcOpen ? (
            <ChevronUp className="size-5 shrink-0 text-[#8a919c]" />
          ) : (
            <ChevronDown className="size-5 shrink-0 text-[#8a919c]" />
          )}
        </button>
        {calcOpen ? (
          <div className="relative z-10 border-t border-white/[0.07]">
            <SDRCalculator />
          </div>
        ) : null}
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setCredentials(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto rounded-2xl border-[#2a2f37] bg-[#0d1015] p-0">
          <div className="relative px-6 pb-6 pt-6">
            <DialogHeader>
              <DialogTitle className="text-[var(--c-eef1f6)]">
                {credentials ? "Acesso do SDR" : editing ? "Editar SDR" : "Novo SDR"}
              </DialogTitle>
            </DialogHeader>

            {credentials ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-[#9aa1ab]">
                  Cadastro criado! Envie estes dados para o SDR entrar no painel exclusivo dele.
                </p>
                <CredentialRow label="Link de login" value={credentials.link} onCopy={() => void copy(credentials.link, "Link")} />
                <CredentialRow label="E-mail" value={credentials.email} onCopy={() => void copy(credentials.email, "E-mail")} />
                <CredentialRow label="Senha (4 dígitos)" value={credentials.pin} onCopy={() => void copy(credentials.pin, "Senha")} />
                <Button
                  type="button"
                  className="mt-2 w-full rounded-xl bg-[var(--c-1677ff)] font-bold text-white hover:bg-[var(--c-3b82f6)]"
                  onClick={() => setDialogOpen(false)}
                >
                  Concluir
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9aa1ab]">Nome completo</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex.: João Silva"
                    className="border-white/10 bg-black/40 text-[var(--c-e6e9ee)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9aa1ab]">E-mail de login</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="sdr@agendaagora.com"
                    className="border-white/10 bg-black/40 text-[var(--c-e6e9ee)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9aa1ab]">
                    {editing ? "Nova senha de 4 dígitos (opcional)" : "Senha de 4 dígitos"}
                  </Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    placeholder="••••"
                    className="border-white/10 bg-black/40 tracking-[0.4em] text-[var(--c-e6e9ee)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#9aa1ab]">Meta de cadastros/mês</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.signupGoal}
                      onChange={(e) => setForm({ ...form, signupGoal: e.target.value })}
                      className="border-white/10 bg-black/40 text-[var(--c-e6e9ee)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#9aa1ab]">Meta de vendas/mês</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.salesGoal}
                      onChange={(e) => setForm({ ...form, salesGoal: e.target.value })}
                      className="border-white/10 bg-black/40 text-[var(--c-e6e9ee)]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9aa1ab]">Comissão por venda (R$)</Label>
                  <Input
                    value={form.commission}
                    onChange={(e) => setForm({ ...form, commission: e.target.value })}
                    inputMode="decimal"
                    className="border-white/10 bg-black/40 text-[var(--c-e6e9ee)]"
                  />
                </div>
                {editing ? (
                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                    <span className="text-sm text-[var(--c-e6e9ee)]">SDR ativo</span>
                    <Switch checked={active} onCheckedChange={setActive} />
                  </label>
                ) : null}
                {editing ? (
                  <>
                    {/* Scripts pré-definidos — aparecem no menu Scripts do SDR */}
                    <div className="space-y-1.5 rounded-xl border border-white/10 bg-black/25 p-3">
                      <Label className="flex items-center gap-2 text-xs text-[#9aa1ab]">
                        <ScrollText className="size-3.5 text-[var(--c-69a2ff)]" />
                        Scripts pré-definidos
                      </Label>
                      <p className="text-[0.68rem] text-[#6f757f]">
                        Roteiros enviados ao painel deste SDR (menu Scripts — bloco somente leitura).
                      </p>
                      <Textarea
                        value={preset}
                        onChange={(e) => setPreset(e.target.value)}
                        rows={5}
                        placeholder="Ex.: Abertura: … · Objeções: … · Fechamento: …"
                        className="border-white/10 bg-black/40 text-sm text-[var(--c-e6e9ee)]"
                      />
                    </div>

                    {/* Quadro de ideias — preenchido aqui, aparece lá */}
                    <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
                      <Label className="flex items-center gap-2 text-xs text-[#9aa1ab]">
                        <Lightbulb className="size-3.5 text-[var(--c-69a2ff)]" />
                        Quadro de ideias
                      </Label>
                      <p className="text-[0.68rem] text-[#6f757f]">
                        Ideias de conteúdo e campanhas — aparecem no quadro do painel deste SDR.
                      </p>
                      <div className="space-y-2">
                        <Input
                          value={ideaTitle}
                          onChange={(e) => setIdeaTitle(e.target.value)}
                          placeholder="Título da ideia (Ex.: Corte novo da carona com o Ted)"
                          className="h-9 border-white/10 bg-black/40 text-sm text-[var(--c-e6e9ee)]"
                        />
                        <div className="flex items-stretch gap-2">
                          <Textarea
                            value={ideaDetails}
                            onChange={(e) => setIdeaDetails(e.target.value)}
                            rows={2}
                            placeholder="Detalhes da ideia (opcional)"
                            className="min-w-0 flex-1 border-white/10 bg-black/40 text-sm text-[var(--c-e6e9ee)]"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={!ideaTitle.trim() || addM.isPending}
                            onClick={() => {
                              const details = ideaDetails.trim();
                              addM.mutate({
                                sdrId: editing.id,
                                title: ideaTitle.trim(),
                                ...(details ? { details } : {}),
                              });
                            }}
                            className="h-9 shrink-0 self-start rounded-lg bg-[var(--c-1677ff)] px-3 text-xs font-bold text-white hover:bg-[var(--c-3b82f6)]"
                          >
                            {addM.isPending ? "…" : "Adicionar"}
                          </Button>
                        </div>
                      </div>
                      {ideas.data?.length ? (
                        <ul className="space-y-1.5">
                          {ideas.data.map((idea) => (
                            <li
                              key={idea.id}
                              className="flex items-start justify-between gap-2 rounded-lg border border-white/[0.07] bg-black/30 px-2.5 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-[var(--c-e6e9ee)]">
                                  {idea.title}
                                </p>
                                {idea.details ? (
                                  <p className="truncate text-[0.68rem] text-[#777d87]">
                                    {idea.details}
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                aria-label={`Remover ideia ${idea.title}`}
                                disabled={removeM.isPending}
                                onClick={() => removeM.mutate(idea.id)}
                                className="shrink-0 rounded-md p-1 text-[#777d87] transition-colors hover:bg-white/10 hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[0.68rem] text-[#6f757f]">
                          Nenhuma ideia no quadro deste SDR ainda.
                        </p>
                      )}
                    </div>
                  </>
                ) : null}
                <Button
                  type="button"
                  disabled={create.isPending || update.isPending}
                  onClick={submit}
                  className="w-full rounded-xl bg-[var(--c-1677ff)] font-bold text-white shadow-[0_8px_24px_rgba(22,119,255,0.35)] hover:bg-[var(--c-3b82f6)]"
                >
                  {editing ? "Salvar alterações" : "Criar painel do SDR"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  delta,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: number | null;
  hint?: string;
}) {
  return (
    <div className="report-luminous-card report-effect-strong report-metric-card p-4">
      <span className="relative z-10 flex size-10 items-center justify-center rounded-xl border border-[var(--c-1677ff)]/25 bg-[var(--c-1677ff)]/10 text-[var(--c-69a2ff)]">
        {icon}
      </span>
      <p className="relative z-10 mt-3 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[#8a919c]">
        {label}
      </p>
      <p className="relative z-10 mt-1 text-3xl font-extrabold tracking-tight text-white">{value}</p>
      <p className="relative z-10 mt-1 flex items-center gap-1.5 text-xs">
        {delta != null ? (
          <span className={`font-semibold ${delta >= 0 ? "text-emerald-400" : "text-destructive"}`}>
            {delta >= 0 ? "↑" : "↓"} {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
        ) : (
          <span className="font-semibold text-emerald-400">↑ +0</span>
        )}
        <span className="text-[#626872]">vs. mês anterior{hint === "este mês" ? "" : ""}</span>
      </p>
    </div>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 1 | -1;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 uppercase transition-colors hover:text-[var(--c-e6e9ee)]"
    >
      {label}
      {active ? (
        dir === 1 ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : (
        <ChevronsUpDown className="size-3 opacity-60" />
      )}
    </button>
  );
}

function CredentialRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70757f]">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-mono text-sm text-[var(--c-e6e9ee)]">{value}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Copiar ${label}`}
          className="size-7 shrink-0 text-[#8a919c] hover:bg-white/10 hover:text-white"
          onClick={onCopy}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-white/[0.05] bg-black/20 text-sm text-[#777d87]">
      {text}
    </div>
  );
}
