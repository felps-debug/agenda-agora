import { lazy, Suspense, useState, type ReactNode } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShieldCheck,
  Trash2,
  Plus,
  ExternalLink,
  Ban,
  PlayCircle,
  Landmark,
  Building2,
  Pencil,
  Plug,
  Users,
  DollarSign,
  CreditCard,
  CalendarDays,
  CalendarX2,
  TriangleAlert,
  Search,
  ArrowRight,
} from "lucide-react";
import {
  createBusinessWithOwner,
  deleteBusiness,
  getMasterStatus,
  getDepositPaymentDiagnostics,
  getPlatformMetrics,
  listAllBusinesses,
  registerSubscriptionCharge,
  setAgpaySplitStatus,
  setBusinessAgpaySplit,
  setBusinessStatus,
  setMonthlyFee,
} from "@/lib/admin.functions";
import { BusinessDossier } from "@/components/master/BusinessDossier";
import { PlatformOverview } from "@/components/master/PlatformOverview";
import { PlatformSections, type PlatformSection } from "@/components/master/PlatformSections";
import { getPlatformOverview } from "@/lib/master/platform-overview.functions";
import { requireMasterAccess } from "@/lib/master.functions";
import { formatPrice } from "@/lib/format";
import { trialInfo, isExpiredTrial } from "@/lib/trial-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const WithdrawalsAdmin = lazy(() =>
  import("@/components/master/WithdrawalsAdmin").then((module) => ({
    default: module.WithdrawalsAdmin,
  })),
);
const LedgerReconciliation = lazy(() =>
  import("@/components/master/LedgerReconciliation").then((module) => ({
    default: module.LedgerReconciliation,
  })),
);

export const Route = createFileRoute("/_authenticated/painel/master")({
  // A sessão Supabase fica no localStorage, indisponível durante SSR. Cada server
  // function da página verifica a role e o AAL2 antes de ler ou gravar dados.
  loader: () => (typeof window === "undefined" ? undefined : requireMasterAccess()),
  head: () => ({
    meta: [
      { title: "Painel master — Agenda Agora" },
      {
        name: "description",
        content: "Área da plataforma para cadastrar estabelecimentos e criar o acesso dos donos.",
      },
      { property: "og:title", content: "Painel master — Agenda Agora" },
      { property: "og:description", content: "Gerencie todos os estabelecimentos da plataforma." },
    ],
  }),
  component: MasterPage,
});

const emptyForm = {
  businessName: "",
  category: "outro",
  ownerName: "",
  phone: "",
  password: "",
  trialDays: "",
};

type AgpaySplitForm = {
  businessId: string;
  splitEmail: string;
  commissionPercent: string;
  autoFirst: boolean;
};

const emptyAgpaySplitForm: AgpaySplitForm = {
  businessId: "",
  splitEmail: "",
  commissionPercent: "0",
  autoFirst: false,
};

const formatBrazilianNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateBR = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const formatPhone = (value: string) => {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

function MasterPage() {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getMasterStatus);
  const listFn = useServerFn(listAllBusinesses);
  const createFn = useServerFn(createBusinessWithOwner);
  const deleteFn = useServerFn(deleteBusiness);
  const metricsFn = useServerFn(getPlatformMetrics);
  const statusUpdateFn = useServerFn(setBusinessStatus);
  const feeFn = useServerFn(setMonthlyFee);
  const chargeFn = useServerFn(registerSubscriptionCharge);
  const diagnosticsFn = useServerFn(getDepositPaymentDiagnostics);
  const setBusinessAgpaySplitFn = useServerFn(setBusinessAgpaySplit);
  const setAgpaySplitStatusFn = useServerFn(setAgpaySplitStatus);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [semTeste, setSemTeste] = useState(false);
  const [agpaySplitOpen, setAgpaySplitOpen] = useState(false);
  const [agpaySplitForm, setAgpaySplitForm] = useState(emptyAgpaySplitForm);
  const [diagnosticChargeId, setDiagnosticChargeId] = useState("");
  const [monthlyFeeTarget, setMonthlyFeeTarget] = useState<{ id: string; value: string } | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    action: "remove" | "suspend";
    name: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativo" | "suspenso">("todos");
  const [section, setSection] = useState<"negocios" | "saques">("negocios");
  const [platformSection, setPlatformSection] = useState<PlatformSection>("agendamentos");
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const status = useQuery({ queryKey: ["master-status"], queryFn: () => statusFn() });

  const businesses = useQuery({
    queryKey: ["master-businesses"],
    enabled: !!status.data?.isMaster,
    queryFn: () => listFn(),
  });

  const overviewFn = useServerFn(getPlatformOverview);
  const overview = useQuery({
    queryKey: ["master-platform-overview"],
    enabled: !!status.data?.isMaster,
    queryFn: () => overviewFn(),
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...form,
          trialDays: semTeste
            ? 0
            : form.trialDays.trim()
              ? Math.max(Number(form.trialDays) || 0, 0)
              : undefined,
        },
      }),
    onSuccess: (result) => {
      toast.success(
        semTeste
          ? `Estabelecimento criado. Senha inicial (mostrada uma vez): ${result.initialPassword}`
          : `Estabelecimento e acesso criados. Senha inicial (mostrada uma vez): ${result.initialPassword}`,
      );
      setOpen(false);
      setForm(emptyForm);
      setSemTeste(false);
      void queryClient.invalidateQueries({ queryKey: ["master-businesses"] });
      void queryClient.invalidateQueries({ queryKey: ["master-platform-overview"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Estabelecimento removido.");
      void queryClient.invalidateQueries({ queryKey: ["master-businesses"] });
      void queryClient.invalidateQueries({ queryKey: ["master-platform-overview"] });
    },
    onError: () =>
      toast.error("Não foi possível remover: existem agendamentos vinculados a este negócio."),
  });

  const metrics = useQuery({
    queryKey: ["master-metrics"],
    enabled: !!status.data?.isMaster,
    queryFn: () => metricsFn(),
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["master-businesses"] });
    void queryClient.invalidateQueries({ queryKey: ["master-metrics"] });
    void queryClient.invalidateQueries({ queryKey: ["master-platform-overview"] });
  };

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; status: "ativo" | "suspenso" }) =>
      statusUpdateFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(
        vars.status === "suspenso"
          ? "Estabelecimento suspenso: a página de agendamento ficou indisponível."
          : "Estabelecimento reativado.",
      );
      refreshAll();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const fee = useMutation({
    mutationFn: (vars: { id: string; amountCents: number }) => feeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Mensalidade atualizada.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const charge = useMutation({
    mutationFn: (vars: { businessId: string; month: string; status: "pago" | "pendente" }) =>
      chargeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Cobrança registrada como paga.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const diagnostics = useMutation({
    mutationFn: (chargeId: string) => diagnosticsFn({ data: { chargeId } }),
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const saveAgpaySplit = useMutation({
    mutationFn: () =>
      setBusinessAgpaySplitFn({
        data: {
          businessId: agpaySplitForm.businessId,
          splitEmail: agpaySplitForm.splitEmail.trim() || undefined,
          commissionPercent: Number(agpaySplitForm.commissionPercent.replace(",", ".")),
          autoFirstKey: false,
        },
      }),
    onSuccess: () => {
      toast.success("Dados de split AgPay atualizados.");
      setAgpaySplitOpen(false);
      setAgpaySplitForm(emptyAgpaySplitForm);
      refreshAll();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const updateAgpaySplitStatus = useMutation({
    mutationFn: (vars: { businessId: string; status: "pendente" | "aprovada" | "bloqueada" }) =>
      setAgpaySplitStatusFn({ data: vars }),
    onSuccess: () => {
      toast.success("Situação da subconta atualizada.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  if (status.isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">Carregando...</p>;
  }

  if (!status.data?.isMaster) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <ShieldCheck className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-xl font-bold">Painel master</h1>
        <p role="alert" className="mt-2 text-sm text-muted-foreground">
          Esta área exige uma conta Master autorizada.
        </p>
      </div>
    );
  }

  const rows = businesses.data ?? [];
  const filteredRows = rows.filter((b) => {
    const matchesSearch =
      !search.trim() ||
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.owner_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "todos" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const pendingCount = metrics.data?.delinquentCount ?? 0;

  return (
    <div className="mx-auto w-full p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-f2f4f8)]">Visão geral</h1>
          <p className="text-sm text-[#777d87]">
            Acompanhe os estabelecimentos e as assinaturas da plataforma.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            onClick={() => setOpen(true)}
            className="border border-[var(--c-1677ff)]/40 bg-[var(--c-1677ff)]/12 text-[var(--c-8fb3ff)] shadow-[0_0_18px_rgba(22,119,255,0.18)] hover:bg-[var(--c-1677ff)]/20"
          >
            <Plus className="size-4" /> Novo estabelecimento
          </Button>
        </div>
      </div>

      {section === "negocios" && (
        <div className="mt-6 space-y-4">
          <PlatformOverview
            overview={overview.data}
            legacyRows={rows}
            isPending={overview.isPending}
            isError={overview.isError}
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onOpenDetails={(businessId) => setDetailsId(businessId)}
            onSuspend={(business) =>
              setConfirmAction({ id: business.id, action: "suspend", name: business.name })
            }
            onReactivate={(businessId) => setStatus.mutate({ id: businessId, status: "ativo" })}
            onRemove={(business) =>
              setConfirmAction({ id: business.id, action: "remove", name: business.name })
            }
            onOpenBilling={() => setStatusFilter("todos")}
          />
          <PlatformSections
            section={platformSection}
            onSectionChange={setPlatformSection}
            overview={overview.data}
          />
        </div>
      )}

      {section === "saques" && (
        <div className="mt-6">
          <Button variant="secondary" className="mb-4" onClick={() => setSection("negocios")}>
            ← Voltar para negócios
          </Button>
          <Suspense
            fallback={
              <p role="status" className="p-4 text-sm text-muted-foreground">
                Carregando saques...
              </p>
            }
          >
            <div className="space-y-8">
              <LedgerReconciliation />
              <WithdrawalsAdmin />
            </div>
          </Suspense>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo estabelecimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bname">Nome do estabelecimento</Label>
              <Input
                id="bname"
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                placeholder="Ex.: Barbearia do João"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bcat">Segmento</Label>
              <Input
                id="bcat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex.: barbearia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oname">Nome do dono</Label>
              <Input
                id="oname"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                placeholder="Ex.: João da Silva"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ophone">Telefone de acesso</Label>
                <Input
                  id="ophone"
                  inputMode="numeric"
                  value={formatPhone(form.phone)}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 93935-4416"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opass">Senha de acesso</Label>
                <Input
                  id="opass"
                  inputMode="numeric"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value.replace(/\D/g, "").slice(0, 4) })
                  }
                  placeholder="Ex.: 1237"
                  maxLength={4}
                />
              </div>
            </div>
            {!semTeste && (
              <div className="space-y-2">
                <Label htmlFor="btrial">Dias de teste</Label>
                <Input
                  id="btrial"
                  inputMode="numeric"
                  value={form.trialDays}
                  onChange={(e) =>
                    setForm({ ...form, trialDays: e.target.value.replace(/\D/g, "").slice(0, 3) })
                  }
                  placeholder="Ex.: 7"
                />
                <p className="text-xs text-muted-foreground">
                  Deixa o painel livre por esses dias e depois ele expira pedindo renovação. Deixe
                  vazio para criar como Assinante Premium.
                </p>
              </div>
            )}
            <label
              htmlFor="sem-teste"
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                semTeste
                  ? "border-amber-400/50 bg-amber-400/10"
                  : "border-[var(--c-262a30)] bg-[var(--c-111317)] hover:border-amber-400/40"
              }`}
            >
              <input
                id="sem-teste"
                type="checkbox"
                checked={semTeste}
                onChange={(e) => setSemTeste(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-amber-400"
              />
              <CalendarX2
                className="mt-0.5 size-4 shrink-0 text-amber-300"
                strokeWidth={2}
                aria-hidden="true"
              />
              <span>
                <span className="block text-sm font-medium text-white">Sem Período de teste</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  O dono consegue fazer login, mas fica fixo somente na tela de assinaturas
                  (R$ 89,90/mês) — todos os menus ficam bloqueados até pagar. Após o pagamento,
                  tudo é liberado por 1 mês.
                </span>
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              Todos que trabalham no estabelecimento entram com este telefone e esta senha.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                form.businessName.trim().length < 2 ||
                form.ownerName.trim().length < 2 ||
                form.phone.replace(/\D/g, "").length < 10 ||
                form.password.length !== 4
              }
            >
              Criar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={agpaySplitOpen} onOpenChange={setAgpaySplitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar split AgPay</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field
              label="Comissão Agenda Agora (%)"
              id="agpay-commission"
              inputMode="decimal"
              value={agpaySplitForm.commissionPercent}
              onChange={(commissionPercent) =>
                setAgpaySplitForm({ ...agpaySplitForm, commissionPercent })
              }
            />
            {(!Number.isFinite(Number(agpaySplitForm.commissionPercent.replace(",", "."))) ||
              Number(agpaySplitForm.commissionPercent.replace(",", ".")) < 0 ||
              Number(agpaySplitForm.commissionPercent.replace(",", ".")) > 100) && (
              <p className="-mt-3 text-sm text-destructive" role="alert">
                A comissão deve ficar entre 0 e 100.
              </p>
            )}
            <label className="flex items-start gap-3 rounded-lg border border-[var(--c-2b3038)] bg-[var(--c-15181d)] p-3">
              <input type="checkbox" checked disabled className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="block text-sm font-medium">
                  Aprovação automática desativada
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Toda chave Pix enviada fica pendente e precisa de autorização manual no menu Pix
                  em Aprovação — sem exceções.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveAgpaySplit.mutate()}
              disabled={
                saveAgpaySplit.isPending ||
                !Number.isFinite(Number(agpaySplitForm.commissionPercent.replace(",", "."))) ||
                Number(agpaySplitForm.commissionPercent.replace(",", ".")) < 0 ||
                Number(agpaySplitForm.commissionPercent.replace(",", ".")) > 100
              }
            >
              Salvar configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BusinessDossier businessId={detailsId} onClose={() => setDetailsId(null)} />
      <Dialog
        open={!!monthlyFeeTarget}
        onOpenChange={(isOpen) => !isOpen && setMonthlyFeeTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar mensalidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="master-monthly-fee">Valor mensal (R$)</Label>
            <Input
              id="master-monthly-fee"
              type="text"
              inputMode="decimal"
              value={monthlyFeeTarget?.value ?? ""}
              onChange={(event) =>
                setMonthlyFeeTarget((target) =>
                  target ? { ...target, value: event.target.value } : target,
                )
              }
            />
            {monthlyFeeTarget &&
              (!Number.isFinite(Number(monthlyFeeTarget.value.replace(",", "."))) ||
                Number(monthlyFeeTarget.value.replace(",", ".")) <= 0) && (
                <p className="text-sm text-destructive" role="alert">
                  Informe um valor numérico maior que zero.
                </p>
              )}
            <p className="text-xs text-muted-foreground">
              Use vírgula ou ponto para separar os centavos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMonthlyFeeTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                fee.isPending ||
                !monthlyFeeTarget ||
                !Number.isFinite(Number(monthlyFeeTarget.value.replace(",", "."))) ||
                Number(monthlyFeeTarget.value.replace(",", ".")) <= 0
              }
              onClick={() => {
                if (!monthlyFeeTarget) return;
                fee.mutate({
                  id: monthlyFeeTarget.id,
                  amountCents: Math.round(Number(monthlyFeeTarget.value.replace(",", ".")) * 100),
                });
                setMonthlyFeeTarget(null);
              }}
            >
              Salvar mensalidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(isOpen) => !isOpen && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === "remove"
                ? "Remover estabelecimento?"
                : "Suspender estabelecimento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === "remove"
                ? `O estabelecimento ${confirmAction.name} será removido. Esta ação não pode ser desfeita.`
                : `A página de agendamento de ${confirmAction?.name} ficará indisponível até a reativação.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.action === "remove") remove.mutate(confirmAction.id);
                else setStatus.mutate({ id: confirmAction.id, status: "suspenso" });
                setConfirmAction(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  inputMode,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "decimal" | "email" | "numeric" | "text";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  iconClass,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  iconClass?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      {icon && (
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${iconClass ?? ""}`}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-bold">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
