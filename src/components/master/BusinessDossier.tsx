import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity,
  Banknote,
  Building2,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  CreditCard,
  ExternalLink,
  HeartPulse,
  Hourglass,
  LifeBuoy,
  Loader2,
  Lock,
  LockOpen,
  MessageSquarePlus,
  Settings2,
  Users,
  Wallet,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AccessCyclePanel } from "@/components/master/AccessCyclePanel";
import { impersonateBusinessOwner } from "@/lib/lifecycle.functions";
import { resetOwnerPassword } from "@/lib/reset-password.functions";
import {
  setAgpayAccessBlock,
  setAgpayWithdrawalBlock,
} from "@/lib/agpay-support.functions";
import {
  addBusinessNote,
  getBusinessDossier,
  getBusinessSupportSnapshot,
  updateBusinessCommercial,
} from "@/lib/master/dossier.functions";
import {
  clearBusinessCoupon,
  getBusinessCoupon,
  setBusinessCoupon,
} from "@/lib/subscription.functions";
import { formatPrice } from "@/lib/format";
import { categoryLabel } from "@/lib/format";

type DossierTab =
  | "visao"
  | "acesso"
  | "uso"
  | "agendamentos"
  | "clientes"
  | "assinatura"
  | "agpay"
  | "atividade"
  | "comercial"
  | "suporte";

const TABS: Array<{ id: DossierTab; label: string; icon: typeof Building2 }> = [
  { id: "visao", label: "Visão geral", icon: Building2 },
  { id: "acesso", label: "Ciclo de acesso", icon: Hourglass },
  { id: "uso", label: "Uso do sistema", icon: Settings2 },
  { id: "agendamentos", label: "Agendamentos", icon: CalendarDays },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "assinatura", label: "Assinatura e cobranças", icon: CreditCard },
  { id: "agpay", label: "Saldo Ag Pay", icon: Wallet },
  { id: "atividade", label: "Atividade", icon: Activity },
  { id: "comercial", label: "Comercial", icon: Banknote },
  { id: "suporte", label: "Suporte", icon: LifeBuoy },
];

/** Cor de cada aba do dossier — identidade viva, igual à Equipe SDR. */
const TAB_TONE: Record<DossierTab, string> = {
  visao: "text-[var(--c-69a2ff)]",
  acesso: "text-amber-300",
  uso: "text-cyan-300",
  agendamentos: "text-violet-300",
  clientes: "text-emerald-300",
  assinatura: "text-pink-300",
  agpay: "text-[#f0b429]",
  atividade: "text-sky-300",
  comercial: "text-teal-300",
  suporte: "text-orange-300",
};

/** Caixas de ícone com iluminação colorida. */
const ICON_TONES: Record<string, string> = {
  blue: "border-[var(--c-1677ff)]/30 bg-[var(--c-1677ff)]/[0.09] text-[var(--c-5da8ff)] shadow-[0_0_18px_rgba(22,119,255,0.18)]",
  violet:
    "border-violet-400/30 bg-violet-400/[0.09] text-violet-300 shadow-[0_0_18px_rgba(167,139,250,0.18)]",
  emerald:
    "border-emerald-400/30 bg-emerald-400/[0.09] text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.16)]",
  amber:
    "border-amber-400/30 bg-amber-400/[0.09] text-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.16)]",
  pink: "border-pink-400/30 bg-pink-400/[0.09] text-pink-300 shadow-[0_0_18px_rgba(244,114,182,0.16)]",
  cyan: "border-cyan-400/30 bg-cyan-400/[0.09] text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.16)]",
};

const PERIODS = [
  { id: 7, label: "7 dias" },
  { id: 30, label: "30 dias" },
  { id: 90, label: "90 dias" },
] as const;

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

const relativeDays = (days: number | null) =>
  days == null ? "— dias" : days === 0 ? "hoje" : `há ${days} dia${days === 1 ? "" : "s"}`;

const HEALTH_LABEL: Record<string, string> = {
  saudavel: "Saudável",
  atencao: "Precisa de atenção",
  risco: "Em risco",
  sem_dados: "Sem dados suficientes",
};

const HEALTH_TONE: Record<string, string> = {
  saudavel: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  atencao: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  risco: "border-destructive/40 bg-destructive/10 text-destructive",
  sem_dados: "border-[var(--c-2b3038)] bg-white/5 text-[#9aa1ab]",
};

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  bloqueado: "Bloqueado",
  aguardando_sinal: "Aguardando sinal",
  pago: "Pago",
  pendente: "Pendente",
  aprovado: "Aprovado",
};

/**
 * Ficha de inteligência do estabelecimento no Painel 3 Master.
 *
 * Substitui a visão geral simples que era aberta pelo ícone de lápis na
 * listagem de estabelecimentos. Todos os números vêm da função de servidor
 * `getBusinessDossier`, que só responde para administradores Master.
 */
export function BusinessDossier({
  businessId,
  onClose,
}: {
  businessId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const dossierFn = useServerFn(getBusinessDossier);
  const noteFn = useServerFn(addBusinessNote);
  const commercialFn = useServerFn(updateBusinessCommercial);
  const impersonateFn = useServerFn(impersonateBusinessOwner);
  const resetPasswordFn = useServerFn(resetOwnerPassword);
  const impersonate = useMutation({
    mutationFn: (targetBusinessId: string) =>
      impersonateFn({
        data: { businessId: targetBusinessId, origin: window.location.origin },
      }),
    onSuccess: async (result, variables) => {
      try {
        // Token da sessão de impersonação: habilita o banner "Voltar ao Painel
        // Master" (com PIN) apenas nesta aba e apenas nesta conta.
        window.sessionStorage.setItem(
          "agenda-agora:impersonation",
          JSON.stringify({ token: result.impersonationToken, businessId: variables }),
        );
      } catch {
        // Ignora armazenamento indisponível.
      }
      // Entra como dono NA MESMA ORIGEM (sem redirect pelo Supabase — que
      // caía no domínio de produção quando o painel rodava em LAN/preview).
      const { error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });
      if (error) {
        toast.error("Não foi possível entrar no Painel 2. Tente novamente.");
        return;
      }
      toast.info(`Entrando no Painel 2 como dono (${result.ownerEmail})…`);
      window.location.href = "/painel";
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const [tab, setTab] = useState<DossierTab>("visao");
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);
  const [noteBody, setNoteBody] = useState("");
  const [noteNextStep, setNoteNextStep] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [leadSource, setLeadSource] = useState<string | null>(null);
  const [salesOwner, setSalesOwner] = useState<string | null>(null);
  const [commercialNotes, setCommercialNotes] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const resetPassword = useMutation({
    mutationFn: () => resetPasswordFn({ data: { businessId: businessId! } }),
    onSuccess: (result) => setTemporaryPassword(result.temporaryPassword),
    onError: (error: Error) => toast.error(error.message),
  });

  const dossier = useQuery({
    queryKey: ["master-business-dossier", businessId, periodDays],
    enabled: !!businessId,
    queryFn: () => dossierFn({ data: { businessId: businessId!, periodDays } }),
  });

  const supportFn = useServerFn(getBusinessSupportSnapshot);
  const support = useQuery({
    queryKey: ["master-business-support", businessId],
    enabled: !!businessId && supportOpen,
    queryFn: () => supportFn({ data: { businessId: businessId! } }),
  });

  const data = dossier.data;

  const note = useMutation({
    mutationFn: () =>
      noteFn({
        data: {
          businessId: businessId!,
          body: noteBody,
          nextStep: noteNextStep || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Observação registrada.");
      setNoteBody("");
      setNoteNextStep("");
      await queryClient.invalidateQueries({ queryKey: ["master-business-dossier"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const commercial = useMutation({
    mutationFn: () =>
      commercialFn({
        data: {
          businessId: businessId!,
          leadSource: leadSource ?? undefined,
          salesOwner: salesOwner ?? undefined,
          commercialNotes: commercialNotes ?? undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Dados comerciais atualizados.");
      await queryClient.invalidateQueries({ queryKey: ["master-business-dossier"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const accessBlockFn = useServerFn(setAgpayAccessBlock);
  const accessBlock = useMutation({
    mutationFn: (blocked: boolean) =>
      accessBlockFn({ data: { businessId: businessId!, blocked } }),
    onSuccess: async (_result, blocked) => {
      toast.success(blocked ? "Ag Pay bloqueado: o dono volta à tela base." : "Ag Pay liberado.");
      await queryClient.invalidateQueries({ queryKey: ["carteira-flags"] });
      await queryClient.invalidateQueries({ queryKey: ["master-business-dossier"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const withdrawalBlockFn = useServerFn(setAgpayWithdrawalBlock);
  const withdrawalBlock = useMutation({
    mutationFn: (blocked: boolean) =>
      withdrawalBlockFn({ data: { businessId: businessId!, blocked } }),
    onSuccess: async (_result, blocked) => {
      toast.success(blocked ? "Saque bloqueado." : "Saque liberado.");
      await queryClient.invalidateQueries({ queryKey: ["carteira-flags"] });
      await queryClient.invalidateQueries({ queryKey: ["master-business-dossier"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const card = useMemo(
    () =>
      "rounded-2xl border border-[#2b2b2e] bg-[var(--c-131519)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_28px_rgba(22,119,255,0.05)]",
    [],
  );

  const sectionTitle = "flex items-center gap-2 text-[15px] font-semibold text-white";

  return (
    <Dialog open={!!businessId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1180px] overflow-hidden p-0 sm:max-w-[1180px]">
        <DialogHeader className="border-b border-[#2b2b2e] bg-[var(--c-0f1114)] px-6 py-4 text-left">
          <DialogTitle className="sr-only">Ficha do estabelecimento</DialogTitle>
          {dossier.isPending ? (
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-[var(--c-5da8ff)]" />
              <p className="text-sm text-[#9aa1ab]">Carregando ficha do estabelecimento…</p>
            </div>
          ) : dossier.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar a ficha: {dossier.error?.message}
            </p>
          ) : data ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--c-1677ff)]/25 bg-[var(--c-1677ff)]/[0.08] text-[var(--c-5da8ff)]">
                  <Building2 className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-lg font-semibold text-white">
                      {data.business.name}
                    </p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        data.business.status === "suspenso"
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {data.business.status === "suspenso" ? "Suspenso" : "Ativo"}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-[#9aa1ab]">
                    Estabelecimento · cadastrado em {formatDate(data.business.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[var(--c-1677ff)]/40 text-[var(--c-5da8ff)] hover:bg-[var(--c-1677ff)]/10"
                  disabled={impersonate.isPending}
                  onClick={() => impersonate.mutate(data.business.id)}
                >
                  {impersonate.isPending ? (
                    "Entrando…"
                  ) : (
                    <>
                      <ExternalLink className="size-4" /> Abrir Painel 2
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[var(--c-1677ff)]/40 text-[var(--c-5da8ff)] hover:bg-[var(--c-1677ff)]/10"
                  onClick={() =>
                    window.open(`/agendar/${data.business.slug}`, "_blank", "noopener,noreferrer")
                  }
                >
                  <ExternalLink className="size-4" /> Página pública
                </Button>
              </div>
            </div>
          ) : null}
        </DialogHeader>

        {data ? (
          <>
            <nav className="flex gap-1 overflow-x-auto border-b border-[#2b2b2e] bg-[var(--c-0f1114)] px-4">
              {TABS.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                      active
                        ? "border-[var(--c-5da8ff)] text-white"
                        : "border-transparent text-[#9aa1ab] hover:text-white"
                    }`}
                  >
                    <Icon className={`size-4 ${TAB_TONE[item.id]}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="max-h-[70vh] overflow-y-auto bg-[var(--c-0f1114)] p-5">
              {tab === "acesso" && businessId ? (
                <AccessCyclePanel businessId={businessId} />
              ) : null}
              {tab === "visao" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      icon={<CalendarDays className="size-5" />}
                      tone="blue"
                      label="Agendamentos (30 dias)"
                      value={String(data.usage.usageCount)}
                      hint={
                        data.usage.variationPercent == null
                          ? "Sem histórico comparável"
                          : `${data.usage.variationPercent >= 0 ? "↑" : "↓"} ${Math.abs(
                              data.usage.variationPercent,
                            )}% vs. 30 dias anteriores`
                      }
                      hintTone={
                        data.usage.variationPercent == null
                          ? "neutral"
                          : data.usage.variationPercent >= 0
                            ? "good"
                            : "bad"
                      }
                    />
                    <KpiCard
                      icon={<Users className="size-5" />}
                      tone="violet"
                      label="Clientes cadastrados"
                      value={String(data.counts.customers)}
                      hint={`${data.clients.newInPeriod} novo(s) no período`}
                    />
                    <KpiCard
                      icon={<Clock3 className="size-5" />}
                      tone="amber"
                      label="Último acesso"
                      value={relativeDays(data.owner?.daysSinceLastAccess ?? null)}
                      hint={
                        data.owner?.lastAccessAt
                          ? `em ${formatDateTime(data.owner.lastAccessAt)}`
                          : "sem login registrado"
                      }
                    />
                    <KpiCard
                      icon={<CreditCard className="size-5" />}
                      tone="emerald"
                      label="Assinatura"
                      value={`${brl(data.subscription.monthlyFeeCents)}/mês`}
                      hint={data.subscription.planLabel}
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className={card}>
                      <div className="mb-3 flex items-center justify-between">
                        <p className={sectionTitle}>
                          <Building2 className="size-4 text-[var(--c-69a2ff)] drop-shadow-[0_0_6px_rgba(22,119,255,0.6)]" />
                          Dados do estabelecimento
                        </p>
                      </div>
                      <dl className="space-y-2.5 text-[13px]">
                        <InfoRow label="Nome" value={data.business.name} />
                        <InfoRow label="Segmento" value={categoryLabel(data.business.category)} />
                        <InfoRow
                          label="Página pública"
                          value={`/agendar/${data.business.slug}`}
                          link={`/agendar/${data.business.slug}`}
                        />
                        <InfoRow label="Telefone" value={data.business.phone || "—"} />
                        <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-2.5 text-[13px]">
                          <span className="text-[#9aa1ab]">Acesso do dono</span>
                          <Button size="sm" variant="outline" disabled={resetPassword.isPending} onClick={() => { setTemporaryPassword(null); resetPassword.mutate(); }}>
                            {resetPassword.isPending ? "Gerando…" : "Redefinir senha"}
                          </Button>
                        </div>
                        {temporaryPassword ? (
                          <p className="rounded-md border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-100">
                            Senha temporária, exibida uma vez: <code className="select-all">{temporaryPassword}</code>
                          </p>
                        ) : null}
                        <InfoRow label="Responsável" value={data.owner?.fullName || "—"} />
                        <InfoRow label="E-mail" value={data.owner?.email || "—"} />
                      </dl>
                    </section>

                    <div className="space-y-4">
                      <section className={card}>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className={sectionTitle}>
                            <HeartPulse className="size-4 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.55)]" />
                            Saúde da conta
                          </p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              HEALTH_TONE[data.health.status] ?? HEALTH_TONE["sem_dados"]
                            }`}
                          >
                            {HEALTH_LABEL[data.health.status] ?? "—"}
                          </span>
                        </div>
                        {data.health.score != null && (
                          <p className="mb-2 text-[12.5px] text-[#9aa1ab]">
                            Pontuação operacional:{" "}
                            <span className="font-semibold text-white">
                              {data.health.score}/100
                            </span>
                          </p>
                        )}
                        {data.health.reasons.length === 0 ? (
                          <p className="text-[13px] text-[#9aa1ab]">
                            Nenhum alerta: uso, pagamento e configuração dentro do esperado.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {data.health.reasons.map((reason) => (
                              <li
                                key={reason.code}
                                className="flex gap-2 rounded-lg border border-[var(--c-24272c)] bg-[var(--c-0f1114)] p-2.5"
                              >
                                <CircleAlert
                                  className={`mt-0.5 size-4 shrink-0 ${
                                    reason.severity === "critico"
                                      ? "text-destructive"
                                      : reason.severity === "aviso"
                                        ? "text-amber-300"
                                        : "text-[var(--c-5da8ff)]"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <p className="text-[13px] font-medium text-white">
                                    {reason.title}
                                  </p>
                                  <p className="text-[12px] text-[#9aa1ab]">{reason.detail}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-[var(--c-1677ff)]/40 text-[var(--c-5da8ff)] hover:bg-[var(--c-1677ff)]/10"
                        onClick={() => {
                          const phone = data.business.phone?.replace(/\D/g, "") ?? "";
                          if (phone) {
                            window.open(
                              `https://wa.me/55${phone}`,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          } else {
                            toast.info("Telefone não cadastrado para este estabelecimento.");
                          }
                        }}
                      >
                        Entrar em contato
                      </Button>

                      <section className={card}>
                        <p className={`${sectionTitle} mb-3`}>
                          <CreditCard className="size-4 text-violet-300 drop-shadow-[0_0_6px_rgba(167,139,250,0.6)]" />
                          Plano e assinatura
                        </p>
                        <div className="space-y-2.5 text-[13px]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#9aa1ab]">Situação</span>
                            <span className="font-medium text-white">
                              {data.subscription.currentStatus === "pago"
                                ? "Assinante Premium"
                                : data.subscription.currentStatus === "pendente"
                                  ? "Cobrança em aberto"
                                  : "Sem cobrança registrada"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#9aa1ab]">Valor da assinatura</span>
                            <span className="font-medium text-white">
                              {brl(data.subscription.monthlyFeeCents)}/mês
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[#9aa1ab]">Próxima cobrança</span>
                            <span className="font-medium text-white">
                              {formatDate(data.subscription.nextChargeAt)}
                            </span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full border-[var(--c-1677ff)]/40 text-[var(--c-5da8ff)] hover:bg-[var(--c-1677ff)]/10"
                          onClick={() => setTab("assinatura")}
                        >
                          Ver cobranças
                        </Button>
                      </section>

                      <section className={card}>
                        <p className={`${sectionTitle} mb-3`}>
                          <Settings2 className="size-4 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]" />
                          Configuração do estabelecimento
                        </p>
                        <div className="mb-3 flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--c-24272c)]">
                            <div
                              className="h-full rounded-full bg-[var(--c-1677ff)]"
                              style={{ width: `${data.setup.percent}%` }}
                            />
                          </div>
                          <span className="text-[12.5px] font-medium text-white">
                            {data.setup.percent}% concluído
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {data.setup.steps.map((step) => (
                            <li
                              key={step.id}
                              className="flex items-center justify-between gap-3 text-[13px]"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                                    step.completed
                                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                                      : "border-[var(--c-3a3f47)] text-transparent"
                                  }`}
                                >
                                  <Check className="size-3" />
                                </span>
                                <span className="truncate text-white">{step.label}</span>
                              </span>
                              <span
                                className={`shrink-0 text-[12px] ${
                                  step.completed ? "text-emerald-400" : "text-[#9aa1ab]"
                                }`}
                              >
                                {step.completed ? "Completo" : "Pendente"}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full border-[var(--c-1677ff)]/40 text-[var(--c-5da8ff)] hover:bg-[var(--c-1677ff)]/10"
                          onClick={() => setTab("uso")}
                        >
                          Ver configuração completa
                        </Button>
                      </section>
                    </div>
                  </div>

                  <section className={card}>
                    <p className={`${sectionTitle} mb-3`}>
                      <Activity className="size-4 text-[var(--c-5da8ff)]" />
                      Atividade recente
                    </p>
                    {data.timeline.length === 0 ? (
                      <p className="text-[13px] text-[#9aa1ab]">Sem eventos registrados.</p>
                    ) : (
                      <ol className="space-y-2.5">
                        {data.timeline.slice(0, 5).map((event) => (
                          <li key={event.id} className="flex gap-3">
                            <span className="mt-1 size-2 shrink-0 rounded-full bg-[var(--c-1677ff)]" />
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-white">{event.title}</p>
                              {event.description && (
                                <p className="truncate text-[12px] text-[#9aa1ab]">
                                  {event.description}
                                </p>
                              )}
                              <p className="text-[11.5px] text-[var(--c-626872)]">
                                {formatDateTime(event.at)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                    {data.timeline.length > 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full border-[var(--c-1677ff)]/40 text-[var(--c-5da8ff)] hover:bg-[var(--c-1677ff)]/10"
                        onClick={() => setTab("atividade")}
                      >
                        Ver todas as atividades
                      </Button>
                    )}
                  </section>
                </div>
              )}

              {tab === "uso" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] text-[#9aa1ab]">Período:</span>
                    {PERIODS.map((period) => (
                      <button
                        key={period.id}
                        type="button"
                        onClick={() => setPeriodDays(period.id)}
                        className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-medium ${
                          periodDays === period.id
                            ? "border-[var(--c-1677ff)]/50 bg-[var(--c-1677ff)]/10 text-[var(--c-5da8ff)]"
                            : "border-[#2b2b2e] text-[#9aa1ab] hover:text-white"
                        }`}
                      >
                        {period.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      icon={<CalendarDays className="size-5" />}
                      label="Agendamentos no período"
                      value={String(data.usage.usageCount)}
                      hint={`${data.usage.completed} concluídos · ${data.usage.pending} em aberto`}
                    />
                    <KpiCard
                      icon={<CalendarDays className="size-5" />}
                      label="Agendamentos futuros"
                      value={String(data.usage.future)}
                      hint={`${data.usage.canceled} cancelados no período`}
                    />
                    <KpiCard
                      icon={<Settings2 className="size-5" />}
                      label="Configuração inicial"
                      value={`${data.setup.percent}%`}
                      hint={`${data.counts.services} serviço(s) · ${data.counts.professionals} profissional(is)`}
                    />
                    <KpiCard
                      icon={<Clock3 className="size-5" />}
                      label="Última atividade"
                      value={relativeDays(data.owner?.daysSinceLastAccess ?? null)}
                      hint={
                        data.lastReminderAt
                          ? `Último lembrete: ${formatDateTime(data.lastReminderAt)}`
                          : "Sem lembretes enviados"
                      }
                    />
                  </div>

                  <section className={card}>
                    <p className={`${sectionTitle} mb-3`}>
                      <Settings2 className="size-4 text-[var(--c-5da8ff)]" />
                      Recursos utilizados
                    </p>
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      <FeatureRow label="WhatsApp conectado" active={data.whatsappConnected} />
                      <FeatureRow
                        label="Lembretes ativados"
                        active={!!data.business.trial || data.lastReminderAt != null}
                      />
                      <FeatureRow label="Sinais Pix (Ag Pay)" active={data.deposits.total > 0} />
                      <FeatureRow label="Página pública" active={!!data.business.slug} />
                      <FeatureRow
                        label="Agendamentos recebidos"
                        active={data.counts.appointments > 0}
                      />
                      <FeatureRow
                        label="Aparência personalizada"
                        active={data.appearanceUpdatedAt != null}
                      />
                    </ul>
                  </section>

                  <section className={card}>
                    <p className={`${sectionTitle} mb-3`}>
                      <Activity className="size-4 text-[var(--c-5da8ff)]" />
                      Evolução do volume
                    </p>
                    <VolumeChart series={data.usage.series} />
                  </section>
                </div>
              )}

              {tab === "agendamentos" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      icon={<CalendarDays className="size-5" />}
                      label="Total no período"
                      value={String(data.usage.total)}
                      hint={`${data.usage.usageCount} sem cancelamento · ${data.usage.previousTotal} no período anterior`}
                    />
                    <KpiCard
                      icon={<Check className="size-5" />}
                      label="Concluídos"
                      value={String(data.usage.completed)}
                      hint={`${data.usage.completedAllTime} concluídos no histórico`}
                    />
                    <KpiCard
                      icon={<CircleAlert className="size-5" />}
                      label="Cancelados"
                      value={String(data.usage.canceled)}
                      hint={
                        data.usage.total > 0
                          ? `${Math.round((data.usage.canceled / data.usage.total) * 100)}% de cancelamento`
                          : "Sem base para calcular a taxa"
                      }
                    />
                    <KpiCard
                      icon={<Clock3 className="size-5" />}
                      label="Em aberto"
                      value={String(data.usage.pending)}
                      hint="Agendados, confirmados ou aguardando sinal"
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <RankingCard
                      title="Serviços mais agendados"
                      icon={<CalendarDays className="size-4 text-[var(--c-5da8ff)]" />}
                      rows={data.usage.byService.map((row) => ({
                        id: row.id,
                        label: row.name,
                        value: row.count,
                      }))}
                      emptyText="Nenhum agendamento no período."
                    />
                    <RankingCard
                      title="Profissionais com mais atendimentos"
                      icon={<Users className="size-4 text-[var(--c-5da8ff)]" />}
                      rows={data.usage.byProfessional.map((row) => ({
                        id: row.id,
                        label: row.name,
                        value: row.count,
                      }))}
                      emptyText="Nenhum profissional com agendamentos no período."
                    />
                    <RankingCard
                      title="Dias de maior procura"
                      icon={<CalendarDays className="size-4 text-[var(--c-5da8ff)]" />}
                      rows={data.usage.byWeekday
                        .filter((row) => row.count > 0)
                        .map((row) => ({
                          id: String(row.weekday),
                          label: row.label,
                          value: row.count,
                        }))}
                      emptyText="Sem agendamentos distribuídos por dia."
                    />
                    <RankingCard
                      title="Horários de maior procura"
                      icon={<Clock3 className="size-4 text-[var(--c-5da8ff)]" />}
                      rows={data.usage.byHour
                        .filter((row) => row.count > 0)
                        .map((row) => ({
                          id: String(row.hour),
                          label: row.label,
                          value: row.count,
                        }))}
                      emptyText="Sem agendamentos distribuídos por horário."
                    />
                  </div>

                  <section className={card}>
                    <p className={`${sectionTitle} mb-3`}>
                      <CalendarDays className="size-4 text-[var(--c-5da8ff)]" />
                      Situação por status
                    </p>
                    {data.usage.byStatus.length === 0 ? (
                      <p className="text-[13px] text-[#9aa1ab]">
                        Sem agendamentos no período selecionado.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {data.usage.byStatus.map((row) => (
                          <li
                            key={row.status}
                            className="flex items-center justify-between text-[13px]"
                          >
                            <span className="text-white">
                              {STATUS_LABEL[row.status] ?? row.status}
                            </span>
                            <span className="font-medium text-white">{row.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}

              {tab === "clientes" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      icon={<Users className="size-5" />}
                      label="Clientes cadastrados"
                      value={String(data.clients.total)}
                      hint={`${data.clients.newInPeriod} novo(s) no período`}
                    />
                    <KpiCard
                      icon={<CalendarDays className="size-5" />}
                      label="Com agendamento futuro"
                      value={String(data.clients.withFutureAppointment)}
                      hint={`${data.clients.withAppointments} com agendamento`}
                    />
                    <KpiCard
                      icon={<Activity className="size-5" />}
                      label="Clientes recorrentes"
                      value={String(data.clients.recurring)}
                      hint={
                        data.clients.recurrenceRate == null
                          ? "Sem base para calcular a taxa"
                          : `${data.clients.recurrenceRate}% de retorno`
                      }
                    />
                    <KpiCard
                      icon={<CircleAlert className="size-5" />}
                      label="Sem agendar há 90 dias"
                      value={String(
                        data.clients.inactive.find((row) => row.days === 90)?.count ?? 0,
                      )}
                      hint={`${data.clients.inactive.find((row) => row.days === 30)?.count ?? 0} sem agendar há 30 dias`}
                    />
                  </div>

                  <section className={card}>
                    <p className={`${sectionTitle} mb-3`}>
                      <Users className="size-4 text-[var(--c-5da8ff)]" />
                      Base de clientes
                    </p>
                    <ul className="space-y-1.5 text-[13px]">
                      <li className="flex justify-between">
                        <span className="text-[#9aa1ab]">Clientes cadastrados</span>
                        <span className="font-medium text-white">{data.clients.total}</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-[#9aa1ab]">Com ao menos um agendamento</span>
                        <span className="font-medium text-white">
                          {data.clients.withAppointments}
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-[#9aa1ab]">Novos no período</span>
                        <span className="font-medium text-white">{data.clients.newInPeriod}</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="text-[#9aa1ab]">Retornaram para novo atendimento</span>
                        <span className="font-medium text-white">{data.clients.recurring}</span>
                      </li>
                      {data.clients.inactive.map((row) => (
                        <li key={row.days} className="flex justify-between">
                          <span className="text-[#9aa1ab]">
                            Sem novo agendamento há {row.days} dias
                          </span>
                          <span className="font-medium text-white">{row.count}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[11.5px] text-[var(--c-626872)]">
                      Recorrente = cliente com mais de um agendamento. A taxa usa como denominador
                      os clientes que efetivamente agendaram.
                    </p>
                  </section>
                </div>
              )}

              {tab === "assinatura" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      icon={<CreditCard className="size-5" />}
                      label="Plano"
                      value={data.subscription.planLabel}
                      hint={`${brl(data.subscription.monthlyFeeCents)}/mês`}
                    />
                    <KpiCard
                      icon={<Check className="size-5" />}
                      label="Pagamentos confirmados"
                      value={String(data.subscription.paidCount)}
                      hint={`${brl(data.subscription.paidTotalCents)} recebidos`}
                    />
                    <KpiCard
                      icon={<CircleAlert className="size-5" />}
                      label="Cobranças em aberto"
                      value={String(data.subscription.pendingCount)}
                      hint={
                        data.subscription.delinquentMonths > 0
                          ? `${data.subscription.delinquentMonths} mês(es) com pendência`
                          : "Sem inadimplência"
                      }
                    />
                    <KpiCard
                      icon={<Clock3 className="size-5" />}
                      label="Próxima cobrança"
                      value={formatDate(data.subscription.nextChargeAt)}
                      hint={
                        data.subscription.lastPaidAt
                          ? `Último pagamento: ${formatDate(data.subscription.lastPaidAt)}`
                          : "Nenhum pagamento confirmado"
                      }
                    />
                  </div>

                  {/* Cupom de desconto — sempre desativado por padrão. Só aparece a
                      configuração quando o master ativa; expira sozinho (1–7 dias). */}
                  <CouponCard
                    businessId={businessId}
                    baseCents={data.subscription.monthlyFeeCents}
                  />

                  <section className={card}>
                    <p className={`${sectionTitle} mb-3`}>
                      <CreditCard className="size-4 text-[var(--c-5da8ff)]" />
                      Histórico de cobranças
                    </p>
                    {data.subscription.history.length === 0 ? (
                      <p className="text-[13px] text-[#9aa1ab]">
                        Nenhuma cobrança registrada para este estabelecimento.
                      </p>
                    ) : (
                      <table className="w-full text-left text-[13px]">
                        <thead className="text-[11.5px] uppercase tracking-wider text-[#626872]">
                          <tr>
                            <th className="pb-2">Referência</th>
                            <th className="pb-2">Valor</th>
                            <th className="pb-2">Situação</th>
                            <th className="pb-2">Pago em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.subscription.history.map((payment) => (
                            <tr
                              key={payment.reference_month}
                              className="border-t border-[var(--c-24272c)]"
                            >
                              <td className="py-2 text-white">
                                {payment.reference_month.slice(0, 7)}
                              </td>
                              <td className="py-2 text-white">{brl(payment.amount_cents)}</td>
                              <td className="py-2">
                                <span
                                  className={
                                    payment.status === "pago"
                                      ? "text-emerald-400"
                                      : "text-amber-300"
                                  }
                                >
                                  {STATUS_LABEL[payment.status] ?? payment.status}
                                </span>
                              </td>
                              <td className="py-2 text-[#9aa1ab]">{formatDate(payment.paid_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <p className="mt-2 text-[11.5px] text-[var(--c-626872)]">
                      A receita do Agenda Agora vem das assinaturas elegíveis. O volume
                      transacionado do estabelecimento não é receita do SaaS.
                    </p>
                  </section>
                </div>
              )}

              {tab === "agpay" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard
                      icon={<Wallet className="size-5" />}
                      label="Saldo disponível"
                      value={brl(data.wallet.availableCents)}
                      hint={`${brl(data.wallet.pendingCents)} a receber`}
                    />
                    <KpiCard
                      icon={<Banknote className="size-5" />}
                      label="Sinais processados"
                      value={String(data.deposits.total)}
                      hint={`${data.deposits.paid} pago(s) · ${data.deposits.pending} pendente(s)`}
                    />
                    <KpiCard
                      icon={<Banknote className="size-5" />}
                      label="Volume confirmado"
                      value={brl(data.deposits.paidVolumeCents)}
                      hint={`${brl(data.deposits.feesCents)} de taxas`}
                    />
                    <KpiCard
                      icon={<CreditCard className="size-5" />}
                      label="Comissão do SaaS"
                      value={brl(data.deposits.platformCommissionCents)}
                      hint="Somente pagamentos confirmados"
                    />
                  </div>

                  {/* Controles do master: bloqueio de acesso e de saque. */}
                  <div className="grid gap-4">
                    <section className={`${card} flex min-w-0 items-center justify-between gap-3`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Lock
                            className={`size-4 ${
                              data.agpayAccessBlocked
                                ? "text-[#ff6b6b]"
                                : "text-[#9ee493]"
                            }`}
                          />
                          <p className="text-[14px] font-bold text-white">Bloqueio de Acesso</p>
                        </div>
                        <p className="mt-1 text-[12px] text-[#9aa1ab]">
                          Impede o uso da carteira: volta pra tela base e reseta o fluxo da chave
                          Pix.
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            data.agpayAccessBlocked
                              ? "bg-[rgba(255,107,107,0.12)] text-[#ff6b6b]"
                              : "bg-[rgba(158,228,147,0.12)] text-[#9ee493]"
                          }`}
                        >
                          {data.agpayAccessBlocked ? "Bloqueado" : "Ativo"}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={accessBlock.isPending}
                          onClick={() => accessBlock.mutate(!data.agpayAccessBlocked)}
                          className={`h-8 rounded-lg px-3 text-[12px] font-bold ${
                            data.agpayAccessBlocked
                              ? "bg-[#2f7d4f] text-white hover:bg-[#3a9760]"
                              : "bg-transparent text-[#ff6b6b] ring-1 ring-inset ring-[#ff6b6b]/60 hover:bg-[#ff6b6b]/10"
                          }`}
                        >
                          {accessBlock.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : data.agpayAccessBlocked ? (
                            <>
                              <LockOpen className="size-3.5" /> Desbloquear
                            </>
                          ) : (
                            <>
                              <Lock className="size-3.5" /> Bloquear
                            </>
                          )}
                        </Button>
                      </div>
                    </section>

                    <section className={`${card} flex min-w-0 items-center justify-between gap-3`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Lock
                            className={`size-4 ${
                              data.agpayWithdrawalBlocked
                                ? "text-[#ff6b6b]"
                                : "text-[#9ee493]"
                            }`}
                          />
                          <p className="text-[14px] font-bold text-white">Bloqueio de Saque</p>
                        </div>
                        <p className="mt-1 text-[12px] text-[#9aa1ab]">
                          Impede solicitações de saque na carteira. Liberado por padrão.
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            data.agpayWithdrawalBlocked
                              ? "bg-[rgba(255,107,107,0.12)] text-[#ff6b6b]"
                              : "bg-[rgba(158,228,147,0.12)] text-[#9ee493]"
                          }`}
                        >
                          {data.agpayWithdrawalBlocked ? "Bloqueado" : "Liberado"}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          disabled={withdrawalBlock.isPending}
                          onClick={() => withdrawalBlock.mutate(!data.agpayWithdrawalBlocked)}
                          className={`h-8 rounded-lg px-3 text-[12px] font-bold ${
                            data.agpayWithdrawalBlocked
                              ? "bg-[#2f7d4f] text-white hover:bg-[#3a9760]"
                              : "bg-transparent text-[#ff6b6b] ring-1 ring-inset ring-[#ff6b6b]/60 hover:bg-[#ff6b6b]/10"
                          }`}
                        >
                          {withdrawalBlock.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : data.agpayWithdrawalBlocked ? (
                            <>
                              <LockOpen className="size-3.5" /> Liberar Saque
                            </>
                          ) : (
                            <>
                              <Lock className="size-3.5" /> Bloquear Saque
                            </>
                          )}
                        </Button>
                      </div>
                    </section>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className={card}>
                      <p className={`${sectionTitle} mb-3`}>
                        <Wallet className="size-4 text-[var(--c-5da8ff)]" />
                        Situação da conta Ag Pay
                      </p>
                      <ul className="space-y-2 text-[13px]">
                        <li className="flex justify-between">
                          <span className="text-[#9aa1ab]">Chave Pix</span>
                          <span className="max-w-[12rem] truncate text-white">
                            {data.pixApproval
                              ? `${data.pixApproval.key_type}: ${data.pixApproval.key}`
                              : "—"}
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-[#9aa1ab]">Aprovação da chave</span>
                          <span className="text-white">
                            {data.pixApproval
                              ? (STATUS_LABEL[data.pixApproval.status] ?? data.pixApproval.status)
                              : "—"}
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-[#9aa1ab]">Valor líquido recebido</span>
                          <span className="text-white">{brl(data.deposits.netCents)}</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-[#9aa1ab]">Transações canceladas</span>
                          <span className="text-white">{data.deposits.canceled}</span>
                        </li>
                      </ul>
                    </section>

                    <section className={card}>
                      <p className={`${sectionTitle} mb-3`}>
                        <Activity className="size-4 text-[var(--c-5da8ff)]" />
                        Movimentações
                      </p>
                      {data.ledger.length === 0 ? (
                        <p className="text-[13px] text-[#9aa1ab]">
                          Nenhuma movimentação registrada.
                        </p>
                      ) : (
                        <ul className="space-y-1.5">
                          {data.ledger.slice(0, 12).map((entry) => (
                            <li
                              key={entry.id}
                              className="flex items-center justify-between gap-3 text-[13px]"
                            >
                              <span className="min-w-0 truncate text-white">
                                {entry.description || entry.type}
                              </span>
                              <span className="shrink-0 text-[#9aa1ab]">
                                {formatDate(entry.date)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                </div>
              )}

              {tab === "atividade" && (
                <div className="space-y-4">
                  <section className={card}>
                    <p className={`${sectionTitle} mb-3`}>
                      <Activity className="size-4 text-[var(--c-5da8ff)]" />
                      Linha do tempo
                    </p>
                    {data.timeline.length === 0 ? (
                      <p className="text-[13px] text-[#9aa1ab]">Nenhum evento registrado.</p>
                    ) : (
                      <ol className="space-y-3">
                        {data.timeline.map((event) => (
                          <li key={event.id} className="flex gap-3">
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--c-1677ff)]" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-[13px] font-medium text-white">{event.title}</p>
                                <p className="text-[11.5px] text-[var(--c-626872)]">
                                  {formatDateTime(event.at)}
                                </p>
                              </div>
                              {event.description && (
                                <p className="text-[12px] text-[#9aa1ab]">{event.description}</p>
                              )}
                              <p className="text-[11px] uppercase tracking-wider text-[var(--c-3a3f47)]">
                                {event.source}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              )}

              {tab === "comercial" && (
                <CommercialTab
                  data={data}
                  leadSource={leadSource}
                  salesOwner={salesOwner}
                  commercialNotes={commercialNotes}
                  onLeadSourceChange={(value) => setLeadSource(value)}
                  onSalesOwnerChange={(value) => setSalesOwner(value)}
                  onCommercialNotesChange={(value) => setCommercialNotes(value)}
                  onSave={() => commercial.mutate()}
                  saving={commercial.isPending}
                />
              )}

              {tab === "suporte" && (
                <div className="space-y-4">
                  <section className={card}>
                    <p className={`${sectionTitle} mb-3`}>
                      <MessageSquarePlus className="size-4 text-[var(--c-5da8ff)]" />
                      Nova observação interna
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="dossier-note">Observação</Label>
                        <textarea
                          id="dossier-note"
                          value={noteBody}
                          onChange={(event) => setNoteBody(event.target.value)}
                          rows={3}
                          placeholder="Ex.: cliente pediu ajuda com o link público; retorno agendado."
                          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dossier-next-step">Próximo passo</Label>
                        <Input
                          id="dossier-next-step"
                          value={noteNextStep}
                          onChange={(event) => setNoteNextStep(event.target.value)}
                          placeholder="Ex.: retornar na próxima semana"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={note.isPending || noteBody.trim().length === 0}
                        onClick={() => note.mutate()}
                      >
                        {note.isPending ? "Salvando…" : "Registrar observação"}
                      </Button>
                      <p className="text-[11.5px] text-[var(--c-626872)]">
                        Observações são visíveis apenas no Painel 3 Master.
                      </p>
                    </div>
                  </section>

                  <section className={card}>
                    <p className={`${sectionTitle} mb-3`}>
                      <LifeBuoy className="size-4 text-[var(--c-5da8ff)]" />
                      Observações registradas
                    </p>
                    {data.notes.length === 0 ? (
                      <p className="text-[13px] text-[#9aa1ab]">Nenhuma observação registrada.</p>
                    ) : (
                      <ul className="space-y-2">
                        {data.notes.map((item) => (
                          <li
                            key={item.id}
                            className="rounded-lg border border-[var(--c-24272c)] bg-[var(--c-0f1114)] p-3"
                          >
                            <p className="text-[13px] text-white">{item.body}</p>
                            {item.nextStep && (
                              <p className="mt-1 text-[12px] text-[var(--c-5da8ff)]">
                                Próximo passo: {item.nextStep}
                              </p>
                            )}
                            <p className="mt-1 text-[11.5px] text-[var(--c-626872)]">
                              {formatDateTime(item.createdAt)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle>Painel 2 — modo suporte</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Visão somente leitura do painel do estabelecimento. A consulta fica registrada na trilha
            de auditoria da ficha.
          </p>
          {support.isPending ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando…
            </p>
          ) : support.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Não foi possível carregar a visão de suporte.
            </p>
          ) : support.data ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-muted-foreground">Estabelecimento</span>
                <span className="font-medium text-white">{support.data.business.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-muted-foreground">Clientes cadastrados</span>
                <span className="font-medium text-white">{support.data.customerCount}</span>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-white">Próximos agendamentos</p>
                {support.data.upcomingAppointments.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    Nenhum agendamento futuro registrado.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {support.data.upcomingAppointments.map((appointment) => (
                      <li
                        key={appointment.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-[13px]"
                      >
                        <span className="min-w-0 truncate text-white">
                          {appointment.customerName}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {formatDateTime(appointment.startsAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  hintTone = "neutral",
  tone = "blue",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  hintTone?: "neutral" | "good" | "bad";
  tone?: keyof typeof ICON_TONES;
}) {
  return (
    <div className="rounded-2xl border border-[#2b2b2e] bg-[var(--c-131519)] p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${
            ICON_TONES[tone] ?? ICON_TONES["blue"]
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[12.5px] text-[#9aa1ab]">{label}</p>
          <p className="truncate text-xl font-semibold text-white">{value}</p>
        </div>
      </div>
      {hint && (
        <p
          className={`mt-2 text-[12px] ${
            hintTone === "good"
              ? "text-emerald-400"
              : hintTone === "bad"
                ? "text-destructive"
                : "text-[#9aa1ab]"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  link,
  reveal,
  onReveal,
}: {
  label: string;
  value: string;
  link?: string;
  reveal?: boolean;
  onReveal?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--c-24272c)] pb-2 last:border-0 last:pb-0">
      <dt className="text-[12.5px] text-[#9aa1ab]">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[13px] text-white">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--c-5da8ff)] hover:underline"
          >
            {value}
            <ExternalLink className="size-3" />
          </a>
        ) : reveal && onReveal ? (
          <button
            type="button"
            onClick={onReveal}
            title="Clique para copiar/exibir a senha"
            className="rounded-md px-2 py-1 text-[var(--c-5da8ff)] transition-colors hover:bg-[var(--c-1677ff)]/10 hover:text-white"
          >
            {value}
          </button>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function FeatureRow({ label, active }: { label: string; active: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-[var(--c-24272c)] bg-[var(--c-0f1114)] px-3 py-2 text-[13px]">
      <span className="text-white">{label}</span>
      <span className={active ? "text-emerald-400" : "text-[#626872]"}>
        {active ? "Em uso" : "Não usado"}
      </span>
    </li>
  );
}

function RankingCard({
  title,
  icon,
  rows,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Array<{ id: string; label: string; value: number }>;
  emptyText: string;
}) {
  const max = rows.reduce((acc, row) => Math.max(acc, row.value), 0);
  return (
    <section className="rounded-2xl border border-[#2b2b2e] bg-[var(--c-131519)] p-4">
      <p className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-white">
        {icon}
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-[#9aa1ab]">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, 8).map((row) => (
            <li key={row.id}>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="truncate text-white">{row.label}</span>
                <span className="font-medium text-white">{row.value}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--c-24272c)]">
                <div
                  className="h-full rounded-full bg-[var(--c-1677ff)]"
                  style={{ width: `${max > 0 ? Math.max(4, (row.value / max) * 100) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VolumeChart({ series }: { series: Array<{ date: string; count: number }> }) {
  const max = series.reduce((acc, row) => Math.max(acc, row.count), 0);
  if (series.length === 0) {
    return <p className="text-[13px] text-[#9aa1ab]">Sem dados para o gráfico.</p>;
  }
  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {series.map((row) => (
          <div
            key={row.date}
            title={`${row.date}: ${row.count}`}
            className="flex-1 rounded-t bg-[var(--c-1677ff)]/70"
            style={{ height: `${max > 0 ? Math.max(2, (row.count / max) * 100) : 2}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] text-[var(--c-626872)]">
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function CommercialTab({
  data,
  leadSource,
  salesOwner,
  commercialNotes,
  onLeadSourceChange,
  onSalesOwnerChange,
  onCommercialNotesChange,
  onSave,
  saving,
}: {
  data: {
    business: {
      leadSource: string | null;
      salesOwner: string | null;
      commercialNotes: string | null;
      createdAt: string;
      trial: { days: number; remaining: number; startedAt: string | null } | null;
    };
    subscription: {
      currentStatus: string;
      paidCount: number;
      history: Array<{ reference_month: string; status: string; paid_at: string | null }>;
    };
  };
  leadSource: string | null;
  salesOwner: string | null;
  commercialNotes: string | null;
  onLeadSourceChange: (value: string) => void;
  onSalesOwnerChange: (value: string) => void;
  onCommercialNotesChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const firstPaid = data.subscription.history.find((payment) => payment.status === "pago");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Banknote className="size-5" />}
          label="Origem do lead"
          value={data.business.leadSource || "—"}
          hint={data.business.leadSource ? "Cadastrado" : "Sem origem registrada"}
        />
        <KpiCard
          icon={<Users className="size-5" />}
          label="Responsável comercial"
          value={data.business.salesOwner || "—"}
          hint={data.business.salesOwner ? "Cadastrado" : "Sem responsável definido"}
        />
        <KpiCard
          icon={<CalendarDays className="size-5" />}
          label="Início do teste"
          value={data.business.trial ? formatDate(data.business.trial.startedAt) : "—"}
          hint={
            data.business.trial
              ? `${data.business.trial.remaining} de ${data.business.trial.days} dias restantes`
              : "Conta já convertida"
          }
        />
        <KpiCard
          icon={<Check className="size-5" />}
          label="Conversão"
          value={firstPaid ? formatDate(firstPaid.paid_at) : "—"}
          hint={
            firstPaid
              ? `Primeiro pagamento em ${firstPaid.reference_month.slice(0, 7)}`
              : "Nenhuma conversão registrada"
          }
        />
      </div>

      <section className="rounded-2xl border border-[#2b2b2e] bg-[var(--c-131519)] p-4">
        <p className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-white">
          <Banknote className="size-4 text-[var(--c-5da8ff)]" />
          Dados comerciais
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dossier-lead-source">Origem do lead</Label>
            <Input
              id="dossier-lead-source"
              value={leadSource ?? data.business.leadSource ?? ""}
              onChange={(event) => onLeadSourceChange(event.target.value)}
              placeholder="Ex.: indicação, Instagram, tráfego"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dossier-sales-owner">Responsável</Label>
            <Input
              id="dossier-sales-owner"
              value={salesOwner ?? data.business.salesOwner ?? ""}
              onChange={(event) => onSalesOwnerChange(event.target.value)}
              placeholder="Ex.: nome do vendedor ou SDR"
            />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="dossier-commercial-notes">Observações comerciais</Label>
          <textarea
            id="dossier-commercial-notes"
            rows={3}
            value={commercialNotes ?? data.business.commercialNotes ?? ""}
            onChange={(event) => onCommercialNotesChange(event.target.value)}
            placeholder="Contexto da negociação, promessa feita, pontos de atenção."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <Button type="button" size="sm" className="mt-3" disabled={saving} onClick={onSave}>
          {saving ? "Salvando…" : "Salvar dados comerciais"}
        </Button>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cupom de desconto — master ativa, define % e dias; expira sozinho    */
/* ------------------------------------------------------------------ */

function CouponCard({
  businessId,
  baseCents,
}: {
  businessId: string | null;
  baseCents: number;
}) {
  const queryClient = useQueryClient();
  const couponFn = useServerFn(getBusinessCoupon);
  const setFn = useServerFn(setBusinessCoupon);
  const clearFn = useServerFn(clearBusinessCoupon);

  const coupon = useQuery({
    queryKey: ["business-coupon", businessId],
    enabled: !!businessId,
    refetchInterval: 60_000,
    queryFn: () => couponFn({ data: { businessId: businessId! } }),
  });

  const [on, setOn] = useState(false);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState<number | "">("");
  const [days, setDays] = useState<number | "">(7);

  const active = coupon.data?.coupon ?? null;
  const effectiveOn = on || !!active;

  const set = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          businessId: businessId!,
          code: code.trim(),
          percent: Math.trunc(Number(percent)),
          days: Math.trunc(Number(days)),
        },
      }),
    onSuccess: (_res, _vars) => {
      toast.success("Cupom ativado — expira automáticamente no prazo.");
      void queryClient.invalidateQueries({ queryKey: ["business-coupon"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clear = useMutation({
    mutationFn: () => clearFn({ data: { businessId: businessId! } }),
    onSuccess: () => {
      setOn(false);
      setCode("");
      setPercent("");
      setDays(7);
      toast.success("Cupom desativado.");
      void queryClient.invalidateQueries({ queryKey: ["business-coupon"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pct = Math.trunc(Number(percent)) || 0;
  const discountBrl = ((baseCents || 0) * pct) / 100;
  const saveDisabled = !code.trim() || pct < 1 || !days || Math.trunc(Number(days)) < 1;
  const card =
    "rounded-2xl border border-[#2b2b2e] bg-[var(--c-131519)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_28px_rgba(22,119,255,0.05)]";
  const sectionTitle = "flex items-center gap-2 text-[15px] font-semibold text-white";
  const iconBox =
    "flex size-9 shrink-0 items-center justify-center rounded-xl border border-pink-400/30 bg-pink-400/[0.09] text-pink-300 shadow-[0_0_18px_rgba(244,114,182,0.16)]";

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={iconBox}>
          <Ticket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`${sectionTitle} mb-0`}>
            <Ticket className="size-4 text-pink-300" />
            Cupom de desconto
          </p>
          <p className="mt-0.5 text-[13px] text-[#9aa1ab]">
            {active
              ? `Cupom ${active.code} em vigor — ${active.percent}% de desconto, expira em ${formatDateTime(active.expiresAt)}`
              : "Sempre desativado por padrão. Ative para liberar no checkout do estabelecimento (1–7 dias)."}
          </p>
        </div>
        <Switch
          checked={effectiveOn}
          onCheckedChange={(checked) => {
            if (checked) {
              setOn(true);
            } else if (active) {
              clear.mutate();
            } else {
              setOn(false);
            }
          }}
          aria-label="Ativar cupom de desconto"
        />
      </div>

      {effectiveOn ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#9aa1ab]">Nome do cupom</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 40))}
                placeholder="Ex.: AGORA10"
                className="border-white/10 bg-black/40 text-sm text-[var(--c-e6e9ee)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#9aa1ab]">Desconto (%)</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={percent}
                onChange={(e) =>
                  setPercent(e.target.value === "" ? "" : Math.min(Number(e.target.value), 90))
                }
                placeholder="Ex.: 10"
                className="border-white/10 bg-black/40 text-sm text-[var(--c-e6e9ee)]"
              />
              {pct >= 1 ? (
                <p className="text-[0.68rem] text-emerald-300">
                  Equivale a {brl(discountBrl)} de desconto na mensalidade de {brl(baseCents)}
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-[#9aa1ab]">
              Ativo por (dias) — máximo 7, depois expira sozinho
            </Label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDays(option)}
                  className={`h-9 w-11 rounded-lg border text-sm font-semibold transition-colors ${
                    Number(days) === option
                      ? "border-[var(--c-1677ff)]/60 bg-[var(--c-1677ff)]/15 text-white"
                      : "border-white/10 bg-black/40 text-[#9aa1ab] hover:border-white/25 hover:text-white"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={saveDisabled || set.isPending}
            onClick={() => set.mutate()}
            className="rounded-xl bg-[var(--c-1677ff)] font-bold text-white hover:bg-[var(--c-3b82f6)]"
          >
            {set.isPending ? "Salvando…" : "Ativar cupom"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
