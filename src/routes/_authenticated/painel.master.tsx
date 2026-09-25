import { useState } from "react";
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
  Pencil,
} from "lucide-react";
import {
  createBusinessWithOwner,
  deleteBusiness,
  getMasterStatus,
  getPlatformMetrics,
  listAllBusinesses,
  provisionAsaasSubaccount,
  registerSubscriptionCharge,
  setAsaasSubaccountStatus,
  setBusinessStatus,
  setMonthlyFee,
} from "@/lib/admin.functions";
import {
  listOutreachTemplatesAdmin,
  saveOutreachTemplate,
  setOutreachTemplateActive,
} from "@/lib/outreach-templates.functions";
import { requireMasterAccess } from "@/lib/master.functions";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/master")({
  // A sessÃ£o Supabase fica no localStorage, indisponÃ­vel durante SSR. Cada server
  // function da pÃ¡gina verifica a role e o AAL2 antes de ler ou gravar dados.
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

type AsaasForm = {
  businessId: string;
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  birthDate: string;
  incomeValue: string;
  address: string;
  addressNumber: string;
  province: string;
  postalCode: string;
  companyType: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
  commissionPercent: string;
};

type OutreachUsageType = "story" | "whatsapp" | "outro";

type OutreachTemplateForm = {
  id?: string;
  title: string;
  usageType: OutreachUsageType;
  body: string;
  active: boolean;
};

const emptyOutreachForm: OutreachTemplateForm = {
  title: "",
  usageType: "whatsapp",
  body: "",
  active: true,
};

const usageTypeLabel: Record<OutreachUsageType, string> = {
  story: "Story",
  whatsapp: "WhatsApp",
  outro: "Outro",
};

const emptyAsaasForm: AsaasForm = {
  businessId: "",
  name: "",
  email: "",
  cpfCnpj: "",
  mobilePhone: "",
  birthDate: "",
  incomeValue: "",
  address: "",
  addressNumber: "",
  province: "",
  postalCode: "",
  companyType: "MEI",
  commissionPercent: "0",
};

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
  const provisionAsaasFn = useServerFn(provisionAsaasSubaccount);
  const setAsaasStatusFn = useServerFn(setAsaasSubaccountStatus);
  const listTemplatesFn = useServerFn(listOutreachTemplatesAdmin);
  const saveTemplateFn = useServerFn(saveOutreachTemplate);
  const setTemplateActiveFn = useServerFn(setOutreachTemplateActive);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [asaasOpen, setAsaasOpen] = useState(false);
  const [asaasForm, setAsaasForm] = useState(emptyAsaasForm);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState<OutreachTemplateForm>(emptyOutreachForm);

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
    onError: (e: Error) => toast.error(e.message),
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
    onError: (e: Error) => toast.error(e.message),
  });

  const fee = useMutation({
    mutationFn: (vars: { id: string; amountCents: number }) => feeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Mensalidade atualizada.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const charge = useMutation({
    mutationFn: (vars: { businessId: string; month: string; status: "pago" | "pendente" }) =>
      chargeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Cobrança registrada como paga.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const provisionAsaas = useMutation({
    mutationFn: () =>
      provisionAsaasFn({
        data: {
          ...asaasForm,
          incomeValue: Number(asaasForm.incomeValue.replace(",", ".")),
          commissionPercent: Number(asaasForm.commissionPercent.replace(",", ".")),
        },
      }),
    onSuccess: () => {
      toast.success("Subconta Asaas criada. Conclua o onboarding antes de aprová-la.");
      setAsaasOpen(false);
      setAsaasForm(emptyAsaasForm);
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setAsaasStatus = useMutation({
    mutationFn: (vars: { businessId: string; status: "em_analise" | "aprovada" | "bloqueada" }) =>
      setAsaasStatusFn({ data: vars }),
    onSuccess: () => {
      toast.success("Situação da subconta atualizada.");
      refreshAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const templates = useQuery({
    queryKey: ["master-outreach-templates"],
    enabled: !!status.data?.isMaster,
    queryFn: () => listTemplatesFn(),
  });

  const saveTemplate = useMutation({
    mutationFn: () =>
      saveTemplateFn({
        data: {
          ...(templateForm.id ? { id: templateForm.id } : {}),
          title: templateForm.title,
          usageType: templateForm.usageType,
          body: templateForm.body,
          active: templateForm.active,
        },
      }),
    onSuccess: () => {
      toast.success(templateForm.id ? "Template atualizado." : "Template criado.");
      setTemplateOpen(false);
      setTemplateForm(emptyOutreachForm);
      void queryClient.invalidateQueries({ queryKey: ["master-outreach-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleTemplateActive = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => setTemplateActiveFn({ data: vars }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["master-outreach-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-8">
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
        <TabsList>
          <TabsTrigger value="negocios">Estabelecimentos</TabsTrigger>
          <TabsTrigger value="templates">
            <Megaphone className="size-4" /> Templates de Divulgação
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

          <div className="mt-6 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Estabelecimento</th>
                  <th className="px-4 py-3">Dono</th>
                  <th className="px-4 py-3">Asaas</th>
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
                        {b.asaas_subaccount_status === "pendente" ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setAsaasForm({
                                ...emptyAsaasForm,
                                businessId: b.id,
                                name: b.name,
                                mobilePhone: b.phone ?? "",
                              });
                              setAsaasOpen(true);
                            }}
                          >
                            <Landmark className="size-4" /> Configurar
                          </Button>
                        ) : (
                          <div className="space-y-1">
                            <span className="block text-xs font-semibold">
                              {b.asaas_subaccount_status === "aprovada"
                                ? "Aprovada"
                                : b.asaas_subaccount_status === "bloqueada"
                                  ? "Bloqueada"
                                  : "Em análise"}
                            </span>
                            {b.asaas_subaccount_status === "em_analise" && (
                              <button
                                type="button"
                                className="text-xs text-primary hover:underline"
                                onClick={() =>
                                  setAsaasStatus.mutate({ businessId: b.id, status: "aprovada" })
                                }
                              >
                                marcar onboarding concluído
                              </button>
                            )}
                            <span className="block text-xs text-muted-foreground">
                              Comissão: {Number(b.asaas_commission_percent ?? 0).toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => {
                            const input = window.prompt(
                              "Valor da mensalidade em reais",
                              ((b.monthly_fee_cents ?? 0) / 100).toFixed(2),
                            );
                            if (input === null) return;
                            const amount = Math.round(Number(input.replace(",", ".")) * 100);
                            if (!Number.isFinite(amount) || amount < 0) {
                              toast.error("Valor inválido");
                              return;
                            }
                            fee.mutate({ id: b.id, amountCents: amount });
                          }}
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
                            setStatus.mutate({
                              id: b.id,
                              status: suspended ? "ativo" : "suspenso",
                            })
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
                          onClick={() => remove.mutate(b.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
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
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setTemplateForm(emptyOutreachForm);
                setTemplateOpen(true);
              }}
            >
              <Plus className="size-4" /> Novo template
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            {(templates.data ?? []).map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{t.title}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {usageTypeLabel[t.usage_type as OutreachUsageType]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        t.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${t.title}`}
                    onClick={() => {
                      setTemplateForm({
                        id: t.id,
                        title: t.title,
                        usageType: t.usage_type as OutreachUsageType,
                        body: t.body,
                        active: t.active,
                      });
                      setTemplateOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant={t.active ? "ghost" : "secondary"}
                    size="sm"
                    onClick={() => toggleTemplateActive.mutate({ id: t.id, active: !t.active })}
                  >
                    {t.active ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </div>
            ))}
            {!templates.data?.length && (
              <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nenhum template cadastrado ainda.
              </p>
            )}
          </div>
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

      <Dialog open={asaasOpen} onOpenChange={setAsaasOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar subconta Asaas</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Razão social / nome"
              id="asaas-name"
              value={asaasForm.name}
              onChange={(value) => setAsaasForm({ ...asaasForm, name: value })}
            />
            <Field
              label="E-mail"
              id="asaas-email"
              type="email"
              value={asaasForm.email}
              onChange={(value) => setAsaasForm({ ...asaasForm, email: value })}
            />
            <Field
              label="CPF/CNPJ"
              id="asaas-document"
              value={asaasForm.cpfCnpj}
              onChange={(value) => setAsaasForm({ ...asaasForm, cpfCnpj: value })}
            />
            <Field
              label="Celular"
              id="asaas-phone"
              value={asaasForm.mobilePhone}
              onChange={(value) => setAsaasForm({ ...asaasForm, mobilePhone: value })}
            />
            <Field
              label="Data de nascimento"
              id="asaas-birthdate"
              type="date"
              value={asaasForm.birthDate}
              onChange={(value) => setAsaasForm({ ...asaasForm, birthDate: value })}
            />
            <Field
              label="Renda/faturamento mensal (R$)"
              id="asaas-income"
              value={asaasForm.incomeValue}
              onChange={(value) => setAsaasForm({ ...asaasForm, incomeValue: value })}
            />
            <Field
              label="Comissão Agenda Agora (%)"
              id="asaas-commission"
              value={asaasForm.commissionPercent}
              onChange={(value) => setAsaasForm({ ...asaasForm, commissionPercent: value })}
            />
            <div className="space-y-2">
              <Label htmlFor="asaas-company-type">Tipo de empresa</Label>
              <select
                id="asaas-company-type"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={asaasForm.companyType}
                onChange={(event) =>
                  setAsaasForm({
                    ...asaasForm,
                    companyType: event.target.value as AsaasForm["companyType"],
                  })
                }
              >
                <option value="MEI">MEI</option>
                <option value="LIMITED">Limitada</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="ASSOCIATION">Associação</option>
              </select>
            </div>
            <Field
              label="Endereço"
              id="asaas-address"
              value={asaasForm.address}
              onChange={(value) => setAsaasForm({ ...asaasForm, address: value })}
            />
            <Field
              label="Número"
              id="asaas-number"
              value={asaasForm.addressNumber}
              onChange={(value) => setAsaasForm({ ...asaasForm, addressNumber: value })}
            />
            <Field
              label="Bairro"
              id="asaas-province"
              value={asaasForm.province}
              onChange={(value) => setAsaasForm({ ...asaasForm, province: value })}
            />
            <Field
              label="CEP"
              id="asaas-postal"
              value={asaasForm.postalCode}
              onChange={(value) => setAsaasForm({ ...asaasForm, postalCode: value })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            O Webhook será cadastrado junto com a subconta. A API key retornada será criptografada e
            nunca exibida no navegador.
          </p>
          <DialogFooter>
            <Button
              onClick={() => provisionAsaas.mutate()}
              disabled={
                provisionAsaas.isPending ||
                !asaasForm.email.includes("@") ||
                asaasForm.cpfCnpj.replace(/\D/g, "").length < 11 ||
                !asaasForm.birthDate ||
                !Number(asaasForm.incomeValue.replace(",", ".")) ||
                asaasForm.postalCode.replace(/\D/g, "").length !== 8
              }
            >
              Criar subconta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{templateForm.id ? "Editar template" : "Novo template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-title">Nome interno</Label>
              <Input
                id="tpl-title"
                value={templateForm.title}
                onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                placeholder="Ex.: Divulgação de agendamento online"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-usage">Tipo de uso</Label>
              <select
                id="tpl-usage"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={templateForm.usageType}
                onChange={(e) =>
                  setTemplateForm({
                    ...templateForm,
                    usageType: e.target.value as OutreachUsageType,
                  })
                }
              >
                <option value="story">Story</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-body">Texto</Label>
              <Textarea
                id="tpl-body"
                rows={6}
                value={templateForm.body}
                onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                placeholder="Use {nome_empresa}, {categoria}, {telefone}, {endereco} ou {link_publico}"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                Placeholders disponíveis: {"{nome_empresa}"}, {"{categoria}"}, {"{telefone}"},{" "}
                {"{endereco}"}, {"{link_publico}"}.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveTemplate.mutate()}
              disabled={
                saveTemplate.isPending ||
                templateForm.title.trim().length < 2 ||
                templateForm.body.trim().length < 1
              }
            >
              {templateForm.id ? "Salvar alterações" : "Criar template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
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
