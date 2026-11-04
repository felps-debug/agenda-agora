import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Building2,
  CalendarCheck,
  ClipboardList,
  LogOut,
  House,
  Lightbulb,
  NotebookText,
  Percent,
  Plus,
  ScrollText,
  ShoppingCart,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES } from "@/lib/format";
import {
  getSdrCadastros,
  getSdrDashboard,
  getSdrScriptKit,
  sdrAddIdea,
  sdrCreateBusiness,
  resetSdrOwnerPassword,
  sdrDeleteIdea,
  sdrSaveScriptNotes,
} from "@/lib/sdr.functions";
import { clearSdrSession, readSdrSession } from "./sdr";

export const Route = createFileRoute("/painel-sdr")({
  head: () => ({
    meta: [
      { title: "Meu painel — Agenda Agora" },
      { name: "description", content: "Painel exclusivo do SDR: metas, cadastros e vendas." },
    ],
  }),
  component: SdrPanelPage,
});

const emptyForm = {
  businessName: "",
  category: "barbearia",
  ownerName: "",
  phone: "",
  password: "",
  trialDays: "7",
  semTeste: false,
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

function SdrPanelPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dashboardFn = useServerFn(getSdrDashboard);
  const createBusinessFn = useServerFn(sdrCreateBusiness);

  const [session] = useState(() => (typeof window === "undefined" ? null : readSdrSession()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [tab, setTab] = useState<"inicio" | "scripts" | "cadastros">("inicio");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!session) void navigate({ to: "/sdr", replace: true });
  }, [session, navigate]);

  const dashboard = useQuery({
    queryKey: ["sdr-dashboard", session?.token ?? ""],
    enabled: !!session,
    retry: false,
    queryFn: () => dashboardFn({ data: { token: session!.token } }),
  });

  useEffect(() => {
    if (!dashboard.data) return;
    try {
      if (window.sessionStorage.getItem("agenda-agora:sdr-welcome") === "1") {
        window.sessionStorage.removeItem("agenda-agora:sdr-welcome");
        setWelcomeOpen(true);
      }
    } catch {
      // Ignora armazenamento indisponível.
    }
  }, [dashboard.data]);

  useEffect(() => {
    if (!dashboard.error) return;
    const message = dashboard.error instanceof Error ? dashboard.error.message : "";
    if (message.includes("Sessão expirada") || message.includes("inativa")) {
      clearSdrSession();
      void navigate({ to: "/sdr", replace: true });
    }
  }, [dashboard.error, navigate]);

  const create = useMutation({
    mutationFn: (input: {
      businessName: string;
      category: string;
      ownerName: string;
      phone: string;
      password: string;
      trialDays: number | undefined;
    }) => createBusinessFn({ data: { token: session!.token, ...input } }),
    onSuccess: (result) => {
      toast.success(`Cadastro concluído. Senha inicial (mostrada uma vez): ${result.initialPassword}`);
      setDialogOpen(false);
      setForm(emptyForm);
      setTab("cadastros");
      void queryClient.invalidateQueries({ queryKey: ["sdr-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["sdr-cadastros"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!session) return null;

  const data = dashboard.data;
  const firstName = session.name.split(" ")[0] ?? session.name;
  const signupPercent = data && data.goals.signupGoal > 0
    ? Math.min(Math.round((data.month.cadastros / data.goals.signupGoal) * 100), 100)
    : 0;
  const salesPercent = data && data.goals.salesGoal > 0
    ? Math.min(Math.round((data.month.vendas / data.goals.salesGoal) * 100), 100)
    : 0;

  const submitCadastro = () => {
    if (!/^\d{10,11}$/.test(form.phone.replace(/\D/g, ""))) {
      toast.error("Informe o telefone com DDD (10 ou 11 dígitos).");
      return;
    }
    if (form.password.trim().length < 4) {
      toast.error("A senha do dono precisa de pelo menos 4 caracteres.");
      return;
    }
    create.mutate({
      businessName: form.businessName.trim(),
      category: form.category,
      ownerName: form.ownerName.trim(),
      phone: form.phone.trim(),
      password: form.password.trim(),
      trialDays: form.semTeste ? 0 : Math.max(Math.trunc(Number(form.trialDays)) || 0, 0),
    });
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(ellipse 90% 40% at 50% -12%, rgba(22,119,255,0.14) 0%, transparent 70%), #050607",
      }}
    >
      <header className="sticky top-0 z-30 border-b border-[#1f232b] bg-[#050607]/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex items-center gap-3 px-4 py-3">
          <img
            src="/favicon-256.png"
            alt="Agenda Agora"
            decoding="async"
            className="size-9 object-contain"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">Agenda Agora · Painel do SDR</p>
            <p className="truncate text-xs text-[#626872]">{session.name}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-[#8a919c] hover:bg-white/10 hover:text-white"
            onClick={() => {
              clearSdrSession();
              void navigate({ to: "/sdr" });
            }}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Barra lateral esquerda — mesma mecânica do painel 3 master */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[#1f232b] bg-[#08090c] md:flex">
          <div className="flex items-center gap-2.5 px-4 pb-2 pt-5">
            <img
              src="/favicon-256.png"
              alt="Agenda Agora"
              decoding="async"
              className="size-8 object-contain"
            />
            <div className="min-w-0">
              <p className="text-[0.95rem] font-extrabold leading-tight text-white">Agenda Agora</p>
              <p className="truncate text-xs text-[#626872]">Painel do SDR</p>
            </div>
          </div>
          <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-[#22262e] bg-[#0d1015] px-3 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--c-1677ff)]/15 text-xs font-bold text-[var(--c-60a5fa)]">
              {session.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--c-eef1f6)]">{session.name}</p>
              <p className="truncate text-[0.68rem] text-[#626872]">SDR · Agenda Agora</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            <span className="block px-2 pb-1 pt-2 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#5f6670]">
              Painel do SDR
            </span>
            <SdrSideTab
              icon={<House className="size-4" />}
              label="Início"
              active={tab === "inicio"}
              onClick={() => setTab("inicio")}
            />
            <SdrSideTab
              icon={<ScrollText className="size-4" />}
              label="Scripts"
              active={tab === "scripts"}
              onClick={() => setTab("scripts")}
            />
            <SdrSideTab
              icon={<Building2 className="size-4" />}
              label="Cadastros criados"
              active={tab === "cadastros"}
              onClick={() => setTab("cadastros")}
            />
          </nav>
          <div className="border-t border-[#1f232b] p-3">
            <button
              type="button"
              onClick={() => {
                clearSdrSession();
                void navigate({ to: "/sdr" });
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#e5484d] transition-colors hover:bg-white/10 hover:text-[#ff6a6f]"
            >
              <LogOut className="size-4" /> Sair
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 md:pl-60">
          <main className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-12 pt-4 sm:px-6">
            {/* Navegação (mobile) */}
            <nav className="grid grid-cols-3 gap-2 md:hidden">
            <SdrSideTab
              icon={<House className="size-4" />}
              label="Início"
              compact
              active={tab === "inicio"}
              onClick={() => setTab("inicio")}
            />
            <SdrSideTab
              icon={<ScrollText className="size-4" />}
              label="Scripts"
              compact
              active={tab === "scripts"}
              onClick={() => setTab("scripts")}
            />
            <SdrSideTab
              icon={<Building2 className="size-4" />}
              label="Cadastros"
              compact
              active={tab === "cadastros"}
              onClick={() => setTab("cadastros")}
            />
          </nav>

          {tab === "inicio" ? (
            <>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Olá, {firstName}!
            </h1>
            <p className="text-sm text-[#777d87]">
              Suas metas, cadastros e vendas de {new Date().toLocaleDateString("pt-BR", { month: "long" })}.
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="h-10 rounded-xl bg-[var(--c-1677ff)] px-4 text-sm font-bold text-white shadow-[0_8px_24px_rgba(22,119,255,0.35)] hover:bg-[var(--c-3b82f6)]"
          >
            <Plus className="size-4" /> Novo cadastro
          </Button>
        </div>

        {dashboard.isError ? (
          <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
            Não foi possível carregar seus dados. Atualize a página.
          </p>
        ) : null}

        <section className="rounded-2xl border border-[#22262e] bg-[#0d1015] p-5">
          <p className="flex items-center gap-2 text-[1.05rem] font-semibold text-[var(--c-eef1f6)]">
            <Target className="size-4 text-[var(--c-69a2ff)]" /> Metas do mês
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <GoalBar
              label="Cadastros"
              current={data?.month.cadastros ?? 0}
              goal={data?.goals.signupGoal ?? 0}
              percent={signupPercent}
            />
            <GoalBar
              label="Vendas"
              current={data?.month.vendas ?? 0}
              goal={data?.goals.salesGoal ?? 0}
              percent={salesPercent}
            />
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat icon={<ClipboardList className="size-4" />} label="Cadastros no mês" value={String(data?.month.cadastros ?? 0)} />
          <MiniStat icon={<ShoppingCart className="size-4" />} label="Vendas no mês" value={String(data?.month.vendas ?? 0)} />
          <MiniStat icon={<Percent className="size-4" />} label="Conversão" value={`${data?.month.conversao ?? 0}%`} />
          <MiniStat
            icon={<ShoppingCart className="size-4" />}
            label="Comissão estimada"
            value={(data?.month.comissaoCents ?? 0) > 0
              ? ((data?.month.comissaoCents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "R$ 0,00"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#22262e] bg-[#0d1015] p-5">
            <p className="flex items-center gap-2 text-[1.05rem] font-semibold text-[var(--c-eef1f6)]">
              <CalendarCheck className="size-4 text-[var(--c-69a2ff)]" /> Meus cadastros
            </p>
            <ul className="mt-3 space-y-2">
              {(data?.cadastros ?? []).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/25 px-3.5 py-2.5 text-sm"
                >
                  <span className="truncate text-[var(--c-dfe3ea)]">{item.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-[#626872]">
                    {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
              {!data?.cadastros.length ? (
                <li className="rounded-xl border border-white/[0.05] bg-black/20 px-3.5 py-6 text-center text-sm text-[#777d87]">
                  Nenhum cadastro ainda. Clique em <strong className="text-white">Novo cadastro</strong>.
                </li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-[#22262e] bg-[#0d1015] p-5">
            <p className="flex items-center gap-2 text-[1.05rem] font-semibold text-[var(--c-eef1f6)]">
              <ShoppingCart className="size-4 text-[var(--c-69a2ff)]" /> Minhas vendas
            </p>
            <ul className="mt-3 space-y-2">
              {(data?.vendas ?? []).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/25 px-3.5 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate text-[var(--c-dfe3ea)]">
                    {item.businessName}{" "}
                    <span className="text-xs text-[#626872]">· {item.referenceMonth}</span>
                  </span>
                  <span className="ml-2 shrink-0 font-medium text-emerald-400">
                    {(item.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </li>
              ))}
              {!data?.vendas.length ? (
                <li className="rounded-xl border border-white/[0.05] bg-black/20 px-3.5 py-6 text-center text-sm text-[#777d87]">
                  Nenhuma venda paga ainda.
                </li>
              ) : null}
            </ul>
          </section>
        </div>
            </>
          ) : tab === "scripts" ? (
            <ScriptsView session={session} />
          ) : (
            <CadastrosView session={session} />
          )}
          </main>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-2xl border-[#2a2f37] bg-[#0d1015] p-0">
          <div className="px-6 pb-6 pt-6">
            <DialogHeader>
              <DialogTitle className="text-[var(--c-eef1f6)]">Novo cadastro</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#9aa1ab]">Nome do estabelecimento</Label>
                <Input
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  placeholder="Ex.: Barbaria Felip"
                  className="border-white/10 bg-black/40 text-[var(--c-e6e9ee)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9aa1ab]">Categoria</Label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="h-9 w-full rounded-md border border-white/10 bg-black/40 px-3 text-sm text-[var(--c-e6e9ee)]"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9aa1ab]">Telefone (WhatsApp)</Label>
                  <Input
                    value={formatPhone(form.phone)}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(11) 98765-4321"
                    className="border-white/10 bg-black/40 text-[var(--c-e6e9ee)]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[#9aa1ab]">Nome do dono</Label>
                <Input
                  value={form.ownerName}
                  onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                  placeholder="Ex.: Felipe Souza"
                  className="border-white/10 bg-black/40 text-[var(--c-e6e9ee)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9aa1ab]">Senha de acesso do dono</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 4 caracteres"
                    className="border-white/10 bg-black/40 text-[var(--c-e6e9ee)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#9aa1ab]">Dias de teste grátis</Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={form.semTeste}
                    value={form.semTeste ? "0" : form.trialDays}
                    onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                    className="border-white/10 bg-black/40 text-[var(--c-e6e9ee)] disabled:opacity-50"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-[#9aa1ab]">
                <input
                  type="checkbox"
                  checked={form.semTeste}
                  onChange={(e) => setForm({ ...form, semTeste: e.target.checked })}
                  className="size-4 accent-[var(--c-1677ff)]"
                />
                Sem período de teste (já nasce vencido)
              </label>
              <Button
                type="button"
                disabled={create.isPending}
                onClick={submitCadastro}
                className="w-full rounded-xl bg-[var(--c-1677ff)] font-bold text-white shadow-[0_8px_24px_rgba(22,119,255,0.35)] hover:bg-[var(--c-3b82f6)]"
              >
                {create.isPending ? "Cadastrando…" : "Cadastrar estabelecimento"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {welcomeOpen && data ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Boas-vindas"
          className="fixed inset-0 z-[95] grid place-items-center bg-black/60 p-4"
        >
          <div className="smodal-card sm-blue">
            <button
              type="button"
              className="smodal-x"
              onClick={() => setWelcomeOpen(false)}
              aria-label="Fechar"
            >
              ×
            </button>
            <img
              className="smodal-logo"
              src="/favicon-256.png"
              alt="Agenda Agora"
              decoding="async"
            />
            <h2>Bem-vindo ao time, {firstName}! 🎉</h2>
            <p>
              Seu painel está pronto. Cada cadastro de hoje é uma venda a mais no fim do mês — foco
              total nas metas!
            </p>
            <div className="smodal-feats">
              <div className="smodal-feat-h">Suas metas deste mês</div>
              <div className="smf">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>
                  Bater <b>{data.goals.signupGoal} cadastros</b> e <b>{data.goals.salesGoal} vendas</b>
                </span>
              </div>
              {data.goals.signupGoal > 0 ? (
                <div className="smf">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    Ritmo semanal: cerca de <b>{Math.ceil(data.goals.signupGoal / 4)} cadastros por semana</b>
                  </span>
                </div>
              ) : null}
              {data.commissionCents > 0 ? (
                <div className="smf">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    <b>
                      {(data.commissionCents / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </b>{" "}
                    de comissão por venda paga
                  </span>
                </div>
              ) : null}
              <div className="smf">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>
                  <b>Bônus especial</b> a cada 10 novas assinaturas
                </span>
              </div>
            </div>
            <button
              type="button"
              className="smodal-cta sm-cta-blue"
              onClick={() => setWelcomeOpen(false)}
            >
              Bora bater metas
            </button>
            <div className="smodal-sub">Cadastros e vendas atualizados em tempo real</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GoalBar({
  label,
  current,
  goal,
  percent,
}: {
  label: string;
  current: number;
  goal: number;
  percent: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#9aa1ab]">{label}</span>
        <span className="font-semibold text-white">
          {current}
          <span className="text-[#626872]"> / {goal}</span>
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#1677ff] to-[#5da8ff] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-[#626872]">{percent}% da meta</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cadastros criados — todos os dados dos estabelecimentos do SDR      */
/* ------------------------------------------------------------------ */

function CadastrosView({ session }: { session: { token: string } }) {
  const listFn = useServerFn(getSdrCadastros);
  const resetOwnerPasswordFn = useServerFn(resetSdrOwnerPassword);
  const query = useQuery({
    queryKey: ["sdr-cadastros", session.token],
    queryFn: () => listFn({ data: { token: session.token } }),
  });
  const resetPassword = useMutation({
    mutationFn: (businessId: string) => resetOwnerPasswordFn({ data: { token: session.token, businessId } }),
    onSuccess: (result) => toast.info(`Nova senha temporária (copie agora): ${result.temporaryPassword}`, { duration: 30_000 }),
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--c-1677ff)]/25 bg-[var(--c-1677ff)]/10 text-[var(--c-69a2ff)]">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[1.05rem] font-bold text-white">Cadastros criados</p>
          <p className="text-sm text-[#777d87]">
            Estabelecimentos que você criou. Senhas não ficam armazenadas e não podem ser consultadas depois.
          </p>
        </div>
      </div>

      {query.isError ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive">
          Não foi possível carregar os cadastros. Atualize a página.
        </p>
      ) : null}

      {query.isPending ? (
        <p className="rounded-2xl border border-[#22262e] bg-[#0d1015] p-6 text-center text-sm text-[#777d87]">
          Carregando cadastros…
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-[#22262e] bg-[#0d1015] p-6 text-center text-sm text-[#777d87]">
          Nenhum cadastro ainda. Clique em <strong className="text-white">Novo cadastro</strong> no
          menu Início — ele aparece aqui automaticamente.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-[#22262e] bg-[#0d1015] p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--c-1677ff)]/15 text-sm font-bold text-[var(--c-60a5fa)]">
                  {row.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--c-eef1f6)]">{row.name}</p>
                  <p className="text-xs text-[#626872]">
                    {new Date(row.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <InfoBox label="Usuário (número)" value={row.phone || "—"} mono />
                <InfoBox label="Login" value={row.login} mono />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#777d87]">Senhas não ficam armazenadas e não podem ser consultadas.</p>
                <Button size="sm" variant="outline" disabled={resetPassword.isPending} onClick={() => resetPassword.mutate(row.id)}>{resetPassword.isPending ? "Gerando…" : "Redefinir senha"}</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoBox({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#5f6670]">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm ${
          mono ? "tracking-wide" : ""
        } ${highlight ? "font-bold text-[var(--c-69a2ff)]" : "text-[var(--c-dfe3ea)]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#22262e] bg-[#0d1015] p-4">
      <span className="flex size-9 items-center justify-center rounded-xl border border-[var(--c-1677ff)]/25 bg-[var(--c-1677ff)]/10 text-[var(--c-69a2ff)]">
        {icon}
      </span>
      <p className="mt-2.5 text-[0.68rem] font-medium uppercase tracking-[0.14em] text-[#8a919c]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold text-white">{value}</p>
    </div>
  );
}

function SdrSideTab({
  icon,
  label,
  active,
  compact = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? "border-[var(--c-1677ff)]/40 bg-[var(--c-1677ff)]/15 text-white"
          : "border-transparent text-[#9aa1ab] hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {icon} {label}
      {compact ? null : <span className="sr-only">{active ? " (atual)" : ""}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Scripts — Kit do SDR (scripts pré-definidos + anotações + ideias)   */
/* ------------------------------------------------------------------ */

type SdrIdea = {
  id: string;
  title: string;
  details: string;
  createdBy: string;
  createdAt: string;
};

function ScriptsView({ session }: { session: { token: string } }) {
  const queryClient = useQueryClient();
  const kitFn = useServerFn(getSdrScriptKit);
  const saveNotesFn = useServerFn(sdrSaveScriptNotes);
  const addIdeaFn = useServerFn(sdrAddIdea);
  const deleteIdeaFn = useServerFn(sdrDeleteIdea);

  const kit = useQuery({
    queryKey: ["sdr-script-kit", session.token],
    queryFn: () => kitFn({ data: { token: session.token } }),
  });

  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState<string | null>(null);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDetails, setIdeaDetails] = useState("");

  useEffect(() => {
    if (kit.data && savedNotes === null) {
      setNotes(kit.data.notes);
      setSavedNotes(kit.data.notes);
    }
  }, [kit.data, savedNotes]);

  const dirty = savedNotes !== null && notes !== savedNotes;

  const saveNotes = useMutation({
    mutationFn: () => saveNotesFn({ data: { token: session.token, notes } }),
    onSuccess: () => {
      setSavedNotes(notes);
      toast.success("Anotações salvas!");
      void queryClient.invalidateQueries({ queryKey: ["sdr-script-kit"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addIdea = useMutation({
    mutationFn: () =>
      addIdeaFn({
        data: { token: session.token, title: ideaTitle.trim(), details: ideaDetails.trim() },
      }),
    onSuccess: () => {
      setIdeaTitle("");
      setIdeaDetails("");
      setIdeaOpen(false);
      toast.success("Ideia adicionada ao quadro!");
      void queryClient.invalidateQueries({ queryKey: ["sdr-script-kit"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteIdea = useMutation({
    mutationFn: (ideaId: string) => deleteIdeaFn({ data: { token: session.token, ideaId } }),
    onSuccess: () => {
      toast.success("Ideia removida.");
      void queryClient.invalidateQueries({ queryKey: ["sdr-script-kit"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ideas: SdrIdea[] = kit.data?.ideas ?? [];

  return (
    <div className="space-y-4">
      {/* Scripts pré-definidos enviados pelo master (somente leitura) */}
      <section className="rounded-2xl border border-[#2b2118] bg-gradient-to-b from-[#181210] to-[#120d0a] p-5 shadow-[0_10px_34px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#ff9a4d]/25 to-[#f97316]/15 text-[#fb923c]">
            <ScrollText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[1.05rem] font-bold text-white">Scripts pré-definidos</p>
            <p className="text-sm text-[#a08a7d]">
              Roteiros definidos pelo master — leia e assimile antes do contato.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-[#2b2118] bg-black/30 p-4 text-sm leading-relaxed text-[#e8d9cf]">
          {kit.data?.presetScripts ? (
            <p className="whitespace-pre-wrap">{kit.data.presetScripts}</p>
          ) : (
            <p className="text-[#8a776b]">
              Nenhum script pré-definido ainda. Aguarde o master enviar os roteiros.
            </p>
          )}
        </div>
      </section>

      {/* Anotações da operação (o próprio SDR preenche) */}
      <section className="rounded-2xl border border-[#33231a] bg-gradient-to-b from-[#191311] to-[#120d0a] p-5 shadow-[0_10px_34px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#ff9a4d]/25 to-[#f97316]/15 text-[#fb923c]">
            <NotebookText className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[1.05rem] font-bold text-white">Anotações da operação</p>
            <p className="text-sm text-[#a08a7d]">
              Bloco livre para ideias, lembretes, estratégias e o que mais precisar.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dirty ? (
              <span className="text-xs font-medium text-[#fb923c]">Edições pendentes</span>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={!dirty || saveNotes.isPending}
              onClick={() => saveNotes.mutate()}
              className="h-8 rounded-full bg-gradient-to-b from-[#fb923c] to-[#f97316] px-4 text-xs font-bold text-white shadow-[0_6px_18px_rgba(249,115,22,0.4)] hover:from-[#ffa45c] hover:to-[#fb8d31] disabled:opacity-50"
            >
              {saveNotes.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: abordagem para barbearias novas, objeções comuns, o que falar no follow-up…"
          rows={9}
          className="mt-4 w-full resize-y rounded-xl border border-[#2b2118] bg-black/35 px-4 py-3 text-sm leading-relaxed text-[#e8d9cf] placeholder:text-[#6f5c51] focus:border-[#f97316]/50 focus:outline-none"
        />
      </section>

      {/* Quadro de ideias */}
      <section className="rounded-2xl border border-[#33231a] bg-gradient-to-b from-[#191311] to-[#120d0a] p-5 shadow-[0_10px_34px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#ff9a4d]/25 to-[#f97316]/15 text-[#fb923c]">
            <Lightbulb className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[1.05rem] font-bold text-white">Quadro de ideias</p>
            <p className="text-sm text-[#a08a7d]">Ideias de conteúdo e campanhas</p>
          </div>
          {!ideaOpen ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full px-3 text-sm text-white hover:bg-white/10 hover:text-white"
              onClick={() => setIdeaOpen(true)}
            >
              <Plus className="size-4" /> Adicionar ideia
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-full px-3 text-sm text-[#b8aca3] hover:bg-white/10 hover:text-white"
              onClick={() => setIdeaOpen(false)}
            >
              <X className="size-4" /> Fechar
            </Button>
          )}
        </div>

        {ideaOpen ? (
          <div className="mt-4 space-y-2.5">
            <Input
              value={ideaTitle}
              onChange={(e) => setIdeaTitle(e.target.value)}
              placeholder="Ex.: Corte novo da carona com o Ted"
              className="h-10 rounded-xl border-[#2b2118] bg-black/35 text-[#e8d9cf] placeholder:text-[#6f5c51]"
            />
            <div className="flex flex-wrap items-stretch gap-2.5">
              <textarea
                value={ideaDetails}
                onChange={(e) => setIdeaDetails(e.target.value)}
                placeholder="Detalhes da ideia (opcional)"
                rows={3}
                className="min-w-0 flex-1 resize-y rounded-xl border border-[#2b2118] bg-black/35 px-4 py-3 text-sm text-[#e8d9cf] placeholder:text-[#6f5c51] focus:border-[#f97316]/50 focus:outline-none"
              />
              <Button
                type="button"
                disabled={!ideaTitle.trim() || addIdea.isPending}
                onClick={() => addIdea.mutate()}
                className="h-10 self-start rounded-xl bg-gradient-to-b from-[#fb923c] to-[#f97316] px-5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(249,115,22,0.4)] hover:from-[#ffa45c] hover:to-[#fb8d31] disabled:opacity-50"
              >
                {addIdea.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-dashed border-[#4a3526] bg-black/15 p-4">
          {ideas.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-[#a08a7d]">Nenhuma ideia no quadro</p>
              <button
                type="button"
                onClick={() => setIdeaOpen(true)}
                className="mt-1 text-sm font-bold text-[#fb923c] underline-offset-2 hover:underline"
              >
                Adicionar ideia
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {ideas.map((idea) => (
                <li
                  key={idea.id}
                  className="flex items-start gap-3 rounded-xl border border-[#2b2118] bg-black/25 px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-[#f2e8e0]">{idea.title}</p>
                    {idea.details ? (
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-[#a08a7d]">
                        {idea.details}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[0.65rem] uppercase tracking-wider text-[#6f5c51]">
                      {idea.createdBy === "master" ? "Enviada pelo master" : "Minha ideia"} ·{" "}
                      {new Date(idea.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {idea.createdBy === "sdr" ? (
                    <button
                      type="button"
                      aria-label={`Remover ideia ${idea.title}`}
                      disabled={deleteIdea.isPending}
                      onClick={() => deleteIdea.mutate(idea.id)}
                      className="shrink-0 rounded-lg p-1.5 text-[#8a776b] transition-colors hover:bg-white/10 hover:text-[#fb923c]"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
