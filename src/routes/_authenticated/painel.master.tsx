import { lazy, Suspense, useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute, Link } from "@tanstack/react-router";
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
  Megaphone,
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
import { requireMasterAccess } from "@/lib/master.functions";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
const MasterTemplatesTab = lazy(() =>
  import("@/components/template-editor/MasterTemplatesTab").then((module) => ({
    default: module.MasterTemplatesTab,
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
};

type AgpaySplitForm = {
  businessId: string;
  splitEmail: string;
  commissionPercent: string;
};

const emptyAgpaySplitForm: AgpaySplitForm = {
  businessId: "",
  splitEmail: "",
  commissionPercent: "0",
};

const formatBrazilianNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );

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

  const status = useQuery({ queryKey: ["master-status"], queryFn: () => statusFn() });

  const businesses = useQuery({
    queryKey: ["master-businesses"],
    enabled: !!status.data?.isMaster,
    queryFn: () => listFn(),
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => {
      toast.success("Estabelecimento e acesso do dono criados!");
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["master-businesses"] });
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Estabelecimento removido.");
      void queryClient.invalidateQueries({ queryKey: ["master-businesses"] });
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
          splitEmail: agpaySplitForm.splitEmail,
          commissionPercent: Number(agpaySplitForm.commissionPercent.replace(",", ".")),
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

  return (
    <div className="mx-auto w-full p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <ShieldCheck className="size-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Painel master</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre estabelecimentos e gere o acesso de cada dono.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link to="/painel">
            <Button variant="secondary">Meu painel</Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="negocios" className="mt-6">
        <TabsList className="w-full flex-wrap justify-start gap-1 h-auto">
          <TabsTrigger className="min-h-11 whitespace-normal py-2 leading-tight" value="negocios">
            Estabelecimentos
          </TabsTrigger>
          <TabsTrigger className="min-h-11 whitespace-normal py-2 leading-tight" value="templates">
            <Megaphone className="size-4" /> Templates de Divulgação
          </TabsTrigger>
          <TabsTrigger className="min-h-11 whitespace-normal py-2 leading-tight" value="saques">
            Saques
          </TabsTrigger>
        </TabsList>

        <TabsContent value="negocios">
          <div className="flex justify-end">
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Novo estabelecimento
            </Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Negócios ativos"
              value={String(metrics.data?.activeBusinesses ?? 0)}
              hint={`${metrics.data?.suspendedBusinesses ?? 0} suspenso(s)`}
            />
            <MetricCard
              label="Mensalidade prevista"
              value={formatPrice(metrics.data?.mrrCents ?? 0)}
              hint="Soma das mensalidades ativas"
            />
            <MetricCard
              label="Recebido este mês"
              value={formatPrice(metrics.data?.paidThisMonthCents ?? 0)}
              hint={`${metrics.data?.delinquentCount ?? 0} em aberto`}
            />
            <MetricCard
              label="Faturamento total"
              value={formatPrice(metrics.data?.revenueTotalCents ?? 0)}
              hint={`${metrics.data?.appointments ?? 0} agendamentos na plataforma`}
            />
          </div>

          <section className="mt-6 rounded-md border border-border bg-card p-4">
            <h2 className="font-semibold">Diagnóstico de cobrança Pix</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulte a cobrança e os webhooks recebidos usando o ID da cobrança.
            </p>
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                diagnostics.mutate(diagnosticChargeId.trim());
              }}
            >
              <Input
                aria-label="ID da cobrança"
                placeholder="UUID da cobrança"
                value={diagnosticChargeId}
                onChange={(event) => setDiagnosticChargeId(event.target.value)}
                className="min-w-64 flex-1"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={diagnostics.isPending || !diagnosticChargeId.trim()}
              >
                {diagnostics.isPending ? "Consultando…" : "Consultar"}
              </Button>
            </form>
            {diagnostics.data && (
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-md bg-secondary/50 p-3">
                  <p>
                    <span className="font-medium">Cobrança:</span> {diagnostics.data.charge.id}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span> {diagnostics.data.charge.status}
                    {diagnostics.data.charge.provider_status
                      ? ` (${diagnostics.data.charge.provider_status})`
                      : ""}
                  </p>
                  <p>
                    <span className="font-medium">ID AgPay:</span>{" "}
                    {diagnostics.data.charge.provider_payment_id ?? "—"}
                  </p>
                  <p>
                    <span className="font-medium">Valor:</span>{" "}
                    {formatPrice(diagnostics.data.charge.amount_cents)}
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Eventos de webhook</h3>
                  {diagnostics.data.events.length ? (
                    <ul className="mt-2 space-y-2">
                      {diagnostics.data.events.map((webhookEvent) => (
                        <li key={webhookEvent.id} className="rounded-md border border-border p-3">
                          <p>
                            {webhookEvent.event_type} · {webhookEvent.status} ·{" "}
                            {new Date(webhookEvent.received_at).toLocaleString()}
                          </p>
                          {webhookEvent.last_error && (
                            <p className="mt-1 break-words text-destructive">
                              Erro: {webhookEvent.last_error}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-muted-foreground">Nenhum evento recebido.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {businesses.isError && (
            <p
              role="alert"
              className="mt-6 rounded-md border border-destructive/40 p-4 text-sm text-destructive"
            >
              Não foi possível carregar os estabelecimentos. Atualize a página e tente novamente.
            </p>
          )}
          <div className="master-business-table mt-6 rounded-md border border-border">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Estabelecimento</th>
                  <th className="px-4 py-3">Dono</th>
                  <th className="px-4 py-3">AgPay</th>
                  <th className="px-4 py-3">Mensalidade</th>
                  <th className="px-4 py-3">Mês atual</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Link do cliente</th>
                  <th className="px-4 py-3">Acesso do dono</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const suspended = b.status === "suspenso";
                  const paid = b.current_month_status === "pago";
                  return (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">
                        {b.name}
                        <span className="block text-xs text-muted-foreground">
                          {b.category} · {b.appointments} agendamento(s)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {b.owner_name ?? "—"}
                        <span className="block text-xs text-muted-foreground">
                          {b.phone ? formatPhone(b.phone) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!b.agpay_schema_ready ? (
                          <span className="text-xs text-muted-foreground">
                            Migração AgPay pendente
                          </span>
                        ) : b.agpay_split_status === "pendente" && !b.agpay_split_email ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setAgpaySplitForm({
                                ...emptyAgpaySplitForm,
                                businessId: b.id,
                              });
                              setAgpaySplitOpen(true);
                            }}
                          >
                            <Landmark className="size-4" /> Configurar
                          </Button>
                        ) : (
                          <div className="space-y-1">
                            <span className="block text-xs font-semibold">
                              {b.agpay_split_status === "aprovada"
                                ? "Aprovada"
                                : b.agpay_split_status === "bloqueada"
                                  ? "Bloqueada"
                                  : "Em análise"}
                            </span>
                            {b.agpay_split_status === "pendente" && (
                              <>
                                <button
                                  type="button"
                                  className="block text-xs text-primary hover:underline"
                                  onClick={() => {
                                    setAgpaySplitForm({
                                      businessId: b.id,
                                      splitEmail: b.agpay_split_email ?? "",
                                      commissionPercent: String(b.agpay_commission_percent ?? 0),
                                    });
                                    setAgpaySplitOpen(true);
                                  }}
                                >
                                  Editar configuração
                                </button>
                                <button
                                  type="button"
                                  className="block text-xs text-primary hover:underline"
                                  onClick={() =>
                                    updateAgpaySplitStatus.mutate({
                                      businessId: b.id,
                                      status: "aprovada",
                                    })
                                  }
                                >
                                  marcar aprovado
                                </button>
                              </>
                            )}
                            <span className="block text-xs text-muted-foreground">
                              Comissão:{" "}
                              {formatBrazilianNumber(Number(b.agpay_commission_percent ?? 0))}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() =>
                            setMonthlyFeeTarget({
                              id: b.id,
                              value: formatBrazilianNumber((b.monthly_fee_cents ?? 0) / 100),
                            })
                          }
                        >
                          {formatPrice(b.monthly_fee_cents ?? 0)}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            paid
                              ? "bg-success/15 text-success"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {paid ? "Pago" : "Em aberto"}
                        </span>
                        {!paid && (
                          <button
                            type="button"
                            className="ml-2 text-xs text-primary hover:underline"
                            onClick={() =>
                              charge.mutate({
                                businessId: b.id,
                                month: currentMonth,
                                status: "pago",
                              })
                            }
                          >
                            marcar pago
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant={suspended ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() =>
                            suspended
                              ? setStatus.mutate({ id: b.id, status: "ativo" })
                              : setConfirmAction({ id: b.id, action: "suspend", name: b.name })
                          }
                        >
                          {suspended ? (
                            <>
                              <PlayCircle className="size-4" /> Reativar
                            </>
                          ) : (
                            <>
                              <Ban className="size-4" /> Suspender
                            </>
                          )}
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/agendar/${b.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          /agendar/{b.slug} <ExternalLink className="size-3" />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href="/auth"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          /auth <ExternalLink className="size-3" />
                        </a>
                        {b.phone && (
                          <span className="block text-xs text-muted-foreground">
                            Tel: {formatPhone(b.phone)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${b.name}`}
                          className="master-business-remove"
                          onClick={() =>
                            setConfirmAction({ id: b.id, action: "remove", name: b.name })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!businesses.isPending && !businesses.isError && !rows.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum estabelecimento cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <Suspense
            fallback={
              <p role="status" className="p-4 text-sm text-muted-foreground">
                Carregando templates...
              </p>
            }
          >
            <MasterTemplatesTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="saques" className="master-withdrawals">
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
        </TabsContent>
      </Tabs>

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
              label="E-mail da conta AgPay"
              id="agpay-split-email"
              type="email"
              value={agpaySplitForm.splitEmail}
              onChange={(splitEmail) => setAgpaySplitForm({ ...agpaySplitForm, splitEmail })}
            />
            {!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agpaySplitForm.splitEmail) && (
              <p className="-mt-3 text-sm text-destructive" role="alert">
                Informe um e-mail válido.
              </p>
            )}
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
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveAgpaySplit.mutate()}
              disabled={
                saveAgpaySplit.isPending ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agpaySplitForm.splitEmail) ||
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

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
