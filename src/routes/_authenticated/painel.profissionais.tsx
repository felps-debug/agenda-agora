import { useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CircleAlert,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { deleteProfessional, saveProfessional } from "@/lib/professionals.functions";
import { NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { ProfessionalAvatar } from "@/components/painel/ProfessionalBubbles";
import { ProfessionalPhotoField } from "@/components/painel/ProfessionalPhotoField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/painel/profissionais")({
  head: () => ({
    meta: [
      { title: "Profissionais — Agenda Agora" },
      { name: "description", content: "Gerencie equipe, vínculos e permissões." },
      { property: "og:title", content: "Profissionais — Agenda Agora" },
      { property: "og:description", content: "Gerencie equipe, vínculos e permissões." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfissionaisPage,
});

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PERMISSIONS = [
  ["view_agenda", "Ver agenda"],
  ["create_appointment", "Criar agendamentos"],
  ["cancel_appointment", "Cancelar agendamentos"],
  ["complete_appointment", "Concluir agendamentos"],
  ["view_customer_phone", "Ver telefone dos clientes"],
  ["block_schedule", "Criar horários bloqueados"],
  ["block_agenda", "Bloquear agenda"],
  ["view_financial", "Ver valores e financeiro"],
  ["manage_appearance", "Editar aparência do painel"],
  ["generate_qrcode", "Gerenciar conexão do WhatsApp"],
  ["view_reports", "Ver relatórios"],
] as const;

type Form = {
  id?: string;
  agendaName: string;
  publicName: string;
  role: string;
  phone: string;
  email: string;
  password: string;
  avatarPath: string | null;
  hasAccess: boolean;
  createAccess: boolean;
  workingDays: number[];
  serviceIds: string[];
  permissions: Record<string, boolean>;
};

const empty: Form = {
  agendaName: "",
  publicName: "",
  role: "",
  phone: "",
  email: "",
  password: "",
  avatarPath: null,
  hasAccess: false,
  createAccess: false,
  workingDays: [1, 2, 3, 4, 5, 6],
  serviceIds: [],
  permissions: { view_agenda: true, create_appointment: true },
};

/** Dias da semana com mestre "Todos" (Segunda a Sábado). */
function WeekdayLinks({
  workingDays,
  onToggleDay,
  onToggleAll,
}: {
  workingDays: number[];
  onToggleDay: (day: number) => void;
  onToggleAll: (on: boolean) => void;
}) {
  const allOn = [1, 2, 3, 4, 5, 6].every((d) => workingDays.includes(d));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Switch checked={allOn} onCheckedChange={onToggleAll} aria-label="Todos os dias" />
        <span className="text-sm font-semibold">Todos</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        {[1, 2, 3, 4, 5, 6].map((d) => (
          <label
            key={d}
            className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 border-b border-border/50 px-3 py-2.5 text-sm last:border-0 hover:bg-white/[0.02]"
          >
            <span>{DAYS[d] ?? `Dia ${d}`}</span>
            <Switch checked={workingDays.includes(d)} onCheckedChange={() => onToggleDay(d)} />
          </label>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone?: "green" | "yellow" }) {
  return (
    <div className="professional-stat-card">
      <div
        className={`professional-icon-box !size-9${tone === "green" ? " is-green" : ""}${tone === "yellow" ? " is-yellow" : ""}`}
      >
        <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function ProfissionaisPage() {
  const { businessId } = useBusiness();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveProfessional);
  const deleteFn = useServerFn(deleteProfessional);
  const [open, setOpen] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);

  const startNewProfessional = () => {
    setWarnOpen(false);
    setForm(empty);
    setFormSnapshot(empty);
    setOpen(true);
  };
  const [form, setForm] = useState<Form>(empty);
  const [formSnapshot, setFormSnapshot] = useState<Form>(empty);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [professionalToRemove, setProfessionalToRemove] = useState<string | null>(null);
  const isFormDirty = JSON.stringify(form) !== JSON.stringify(formSnapshot);

  const peopleQuery = useQuery({
    queryKey: ["professionals", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const people = peopleQuery.data ?? [];
  // O 1º profissional (agenda principal do dono) é grátis; a partir do 2º, +R$ 10/mês.
  const firstProfessionalFree = people.length === 0;
  const atLimit = people.length >= 10;
  const peopleList = people;

  const servicesQuery = useQuery({
    queryKey: ["services", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,active")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const linksQuery = useQuery({
    queryKey: ["service-links", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_professionals")
        .select("service_id,professional_id")
        .eq("business_id", businessId!);
      if (error) throw error;
      return data;
    },
  });

  const services = servicesQuery.data;
  const links = linksQuery.data;

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["professionals", businessId] }),
      qc.invalidateQueries({ queryKey: ["service-links", businessId] }),
    ]);

  const save = useMutation({
    // O nome interno do profissional passa a ser o "nome cliente verá"
    // (com fallback para o nome agenda) — a caixa "nome completo" saiu.
    mutationFn: () =>
      saveFn({
        data: {
          ...form,
          name:
            form.publicName.trim() ||
            form.agendaName.trim() ||
            "Profissional",
          businessId: businessId!,
        },
      }),
    onSuccess: () => {
      toast.success(
        form.id
          ? form.createAccess
            ? "Profissional atualizado e acesso criado!"
            : "Profissional atualizado!"
          : form.createAccess
            ? "Profissional e acesso criados!"
            : "Profissional cadastrado!",
      );
      setOpen(false);
      setForm(empty);
      setFormSnapshot(empty);
      void refresh();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data, error } = await supabase
        .from("professionals")
        .update({ active })
        .eq("id", id)
        .eq("business_id", businessId!)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("O profissional não foi encontrado para atualizar.");
    },
    onSuccess: () => void refresh(),
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id, businessId: businessId! } }),
    onSuccess: () => {
      toast.success("Profissional e acesso removidos.");
      void refresh();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const edit = (p: NonNullable<typeof people>[number]) => {
    if (!links) {
      toast.error("Não foi possível carregar os vínculos da equipe. Tente novamente.");
      return;
    }
    const permissions =
      typeof p.permissions === "object" && p.permissions && !Array.isArray(p.permissions)
        ? (p.permissions as Record<string, boolean>)
        : {};
    const next: Form = {
      id: p.id,
      agendaName: p.agenda_name ?? "",
      publicName: p.public_name ?? "",
      role: p.role ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      password: "",
      avatarPath: p.avatar_path ?? null,
      hasAccess: !!p.user_id,
      createAccess: false,
      workingDays: p.working_days,
      permissions,
      serviceIds: (links ?? []).filter((l) => l.professional_id === p.id).map((l) => l.service_id),
    };
    setForm(next);
    setFormSnapshot(next);
    setOpen(true);
  };

  if (!businessId) return <NoBusiness />;

  return (
    <div>
      <section className="professional-main-card">
        <div className="relative z-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="professional-icon-box">
                <UsersRound className="size-[1.05rem]" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[1.35rem] font-semibold tracking-[-0.035em] text-[var(--c-f3f4f6)]">
                    Profissionais
                  </h1>
                  <span className="professional-badge">Equipe e permissões</span>
                </div>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#6d7079]">
                  Cadastre sua equipe, controle os serviços vinculados e defina exatamente o
                  que cada profissional pode acessar.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={UsersRound} label="Profissionais" value={people?.length ?? 0} />
            <StatCard
              icon={BadgeCheck}
              label="Ativos"
              value={people?.filter((p) => p.active).length ?? 0}
              tone="green"
            />
            <StatCard
              icon={KeyRound}
              label="Acessos ativos"
              value={people?.filter((p) => p.user_id).length ?? 0}
            />
            <StatCard
              icon={Link2}
              label="Vínculos de serviço"
              value={links?.length ?? 0}
              tone="yellow"
            />
          </div>
        </div>
      </section>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (v) {
            setForm(empty);
            setFormSnapshot(empty);
            setOpen(true);
            return;
          }
          if (isFormDirty) {
            setConfirmDiscard(true);
            return;
          }
          setOpen(false);
          setForm(empty);
        }}
      >
            <DialogContent className="professional-dialog max-h-[92vh] max-w-2xl overflow-y-auto p-0">
              <DialogHeader className="professional-dialog-header">
                <div className="flex items-start gap-3 text-left">
                  <div className="professional-dialog-icon">
                    <UserRound className="size-[1.05rem]" strokeWidth={1.8} />
                  </div>
                  <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
                    {form.id ? "Editar profissional" : "Cadastrar profissional"}
                  </DialogTitle>
                </div>
              </DialogHeader>
              <Tabs defaultValue="dados" className="px-4 pb-4 sm:px-5 sm:pb-5">
                <TabsList className="professional-tabs grid w-full grid-cols-3">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
                  <TabsTrigger value="permissoes">Permissões</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="professional-form-section space-y-5 pt-5">
                  {businessId ? (
                    <ProfessionalPhotoField
                      businessId={businessId}
                      name={form.publicName || form.agendaName || "Profissional"}
                      avatarPath={form.avatarPath}
                      onChange={(avatarPath) => setForm({ ...form, avatarPath })}
                    />
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Nome agenda"
                      value={form.agendaName}
                      maxLength={11}
                      hint="Nome curto exibido ao lado dos dias na agenda (máx. 11)."
                      onChange={(agendaName) =>
                        setForm({ ...form, agendaName: agendaName.slice(0, 11) })
                      }
                    />
                    <Field
                      label="Nome cliente verá"
                      value={form.publicName}
                      hint="Nome exibido para o cliente ao selecionar o profissional no agendamento."
                      onChange={(publicName) => setForm({ ...form, publicName })}
                    />
                    <Field
                      label="Cargo / especialidade"
                      value={form.role}
                      onChange={(role) => setForm({ ...form, role })}
                    />
                    <Field
                      label="Telefone de acesso"
                      value={form.phone}
                      onChange={(phone) => setForm({ ...form, phone })}
                    />
                    <Field
                      label="E-mail (opcional)"
                      value={form.email}
                      type="email"
                      onChange={(email) => setForm({ ...form, email })}
                    />
                    {!form.hasAccess && (
                      <label className="professional-choice-row sm:col-span-2">
                        <Switch
                          checked={form.createAccess}
                          onCheckedChange={(createAccess) =>
                            setForm({ ...form, createAccess, password: "" })
                          }
                        />
                        <span className="text-sm">
                          Criar acesso de login para este profissional
                        </span>
                      </label>
                    )}
                    {(form.hasAccess || form.createAccess) && (
                      <Field
                        label={
                          form.hasAccess
                            ? "Nova senha de 4 dígitos (opcional)"
                            : "Senha de 4 dígitos para criar acesso"
                        }
                        value={form.password}
                        type="password"
                        maxLength={4}
                        onChange={(password) =>
                          setForm({ ...form, password: password.replace(/\D/g, "").slice(0, 4) })
                        }
                      />
                    )}
                  </div>
                  <div>
                    <Label className="professional-section-label mb-2">Dias de trabalho</Label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {DAYS.map((day, i) => (
                        <label
                          key={day}
                          className={`professional-day-option cursor-pointer focus-within:ring-2 focus-within:ring-ring ${
                            form.workingDays.includes(i) ? "is-selected" : ""
                          }`}
                        >
                          <Checkbox
                            className="sr-only"
                            checked={form.workingDays.includes(i)}
                            onCheckedChange={(v) =>
                              setForm({
                                ...form,
                                workingDays: v
                                  ? [...form.workingDays, i]
                                  : form.workingDays.filter((d) => d !== i),
                              })
                            }
                          />
                          {day}
                        </label>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="vinculos" className="professional-form-section space-y-5 pt-5">
                  <WeekdayLinks
                    workingDays={form.workingDays}
                    onToggleDay={(d) =>
                      setForm({
                        ...form,
                        workingDays: form.workingDays.includes(d)
                          ? form.workingDays.filter((x) => x !== d)
                          : [...form.workingDays, d].sort((a, b) => a - b),
                      })
                    }
                    onToggleAll={(on) =>
                      setForm({ ...form, workingDays: on ? [1, 2, 3, 4, 5, 6] : [] })
                    }
                  />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={
                          (services ?? []).length > 0 &&
                          (services ?? []).every((s) => form.serviceIds.includes(s.id))
                        }
                        onCheckedChange={(v) =>
                          setForm({
                            ...form,
                            serviceIds: v ? (services ?? []).map((s) => s.id) : [],
                          })
                        }
                        aria-label="Todos os serviços"
                      />
                      <span className="text-sm font-semibold">Todos</span>
                    </div>
                    {servicesQuery.isError ? (
                      <p role="alert" className="py-4 text-sm text-destructive">
                        Não foi possível carregar os serviços. Atualize a página e tente novamente.
                      </p>
                    ) : (
                      services?.map((s) => (
                        <label key={s.id} className="professional-choice-row justify-between">
                          <span>{s.name}</span>
                          <Switch
                            checked={form.serviceIds.includes(s.id)}
                            onCheckedChange={(v) =>
                              setForm({
                                ...form,
                                serviceIds: v
                                  ? [...form.serviceIds, s.id]
                                  : form.serviceIds.filter((id) => id !== s.id),
                              })
                            }
                          />
                        </label>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="permissoes"
                  className="professional-form-section space-y-3 pt-5"
                >
                  <div className="professional-info-box flex items-center gap-2">
                    <ShieldCheck className="size-5 text-primary" /> Estas permissões controlam o que
                    aparece e o que pode ser alterado no acesso do profissional.
                  </div>
                  {PERMISSIONS.map(([key, label]) => (
                    <label key={key} className="professional-choice-row justify-between">
                      <span>{label}</span>
                      <Switch
                        checked={!!form.permissions[key]}
                        onCheckedChange={(v) =>
                          setForm({ ...form, permissions: { ...form.permissions, [key]: v } })
                        }
                      />
                    </label>
                  ))}
                </TabsContent>
              </Tabs>
              <DialogFooter className="professional-dialog-footer">
                <Button
                  className="professional-primary-button"
                  onClick={() => save.mutate()}
                  disabled={
                    !(form.publicName.trim() || form.agendaName.trim()) ||
                    (form.createAccess && form.password.length !== 4) ||
                    (form.hasAccess && !!form.password && form.password.length !== 4) ||
                    (!form.email && form.phone.replace(/\D/g, "").length < 8) ||
                    save.isPending
                  }
                >
                  Salvar profissional
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

      <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
        <DialogContent className="max-w-md overflow-hidden rounded-2xl p-0" aria-label="Atenção">
          <div className="relative overflow-hidden px-6 pb-6 pt-7 text-center sm:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--c-rgba-37-119-255-a0d20),transparent_55%)]" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--c-4b9cff)] to-transparent shadow-[0_0_18px_var(--c-rgba-75-156-255-a0d95)]" />
            <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl border-none bg-[var(--c-1a202b)] text-[var(--c-6da5ff)]">
              <CircleAlert className="size-7" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="relative mt-5 flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 className="text-center text-xl font-semibold tracking-[-0.025em] text-[var(--c-f3f7ff)]">
                Atenção
              </h2>
            </div>
            <p className="relative mx-auto mt-3 max-w-[340px] text-sm leading-6 text-[var(--c-9fb3cf)]">
              O 1º profissional — a agenda principal — é{" "}
              <strong className="font-semibold text-emerald-400">grátis</strong>. Ao cadastrar um
              profissional adicional (a partir do 2º), será acrescentado{" "}
              <strong className="font-semibold text-[var(--c-67a6ff)]">R$ 10,00</strong> à sua
              mensalidade, porque cada adicional tem agenda própria e separada.
            </p>
            <div className="relative mt-6 flex justify-center gap-3">
              <Button
                variant="outline"
                className="professional-secondary-button"
                onClick={() => setWarnOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="professional-primary-button min-w-28 shadow-[0_0_22px_var(--c-rgba-43-124-255-a0d28)]"
                onClick={startNewProfessional}
              >
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="professional-list-panel">
        <div className="professional-segmented-header">
          <button type="button" className="is-active">
            Profissionais
          </button>
          <button type="button" disabled>
            Equipe
          </button>
        </div>
        <div className="relative z-10 border-b border-[#25272d] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="professional-icon-box !size-9">
                <BriefcaseBusiness className="size-4" strokeWidth={2} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-[0.98rem] font-semibold text-[var(--c-eef0f4)]">
                  Profissionais cadastrados
                </h2>
                <p className="mt-0.5 text-xs text-[#62656e]">
                  Gerencie equipe, acesso individual, vínculos e permissões.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button
                className="professional-primary-button"
                disabled={atLimit}
                onClick={() => (firstProfessionalFree ? startNewProfessional() : setWarnOpen(true))}
              >
                <Plus className="size-4" /> Cadastrar profissional
              </Button>
              {atLimit ? (
                <span className="text-[11px] font-medium text-amber-400">
                  Limite de 10 profissionais atingido.
                </span>
              ) : (
                <span className="text-[11px] text-[#62656e]">
                  {firstProfessionalFree
                    ? "O 1º profissional (agenda principal) é grátis."
                    : "Próximo profissional adicional: +R$ 10,00/mês."}
                </span>
              )}
            </div>
          </div>
        </div>
        {peopleQuery.isError ? (
          <p
            role="alert"
            className="p-6 text-center text-sm text-destructive"
          >
            Não foi possível carregar os profissionais. Atualize a página e tente novamente.
          </p>
        ) : !people?.length ? (
          <div className="p-4">
            <EmptyList text="Nenhum profissional cadastrado." />
          </div>
        ) : (
          <div className="relative z-10 divide-y divide-[var(--c-22252b)]">
            {people.map((p) => (
              <div key={p.id} className="professional-person-row">
                <div
                  className="professional-avatar profissionais-avatar-box overflow-hidden"
                  aria-hidden="true"
                >
                  <ProfessionalAvatar professional={p} className="rounded-[0.72rem]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--c-eef0f3)]">{p.name}</p>
                    {p.user_id && <span className="professional-badge">Acesso ativo</span>}
                  </div>
                  <p className="mt-1 text-xs text-[#686b74]">
                    {p.role ? `${p.role} · ` : ""}
                    {(links ?? []).filter((l) => l.professional_id === p.id).length} vínculo(s)
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-[#70737b]">
                  Ativo{" "}
                  <Switch
                    checked={p.active}
                    onCheckedChange={(active) => toggle.mutate({ id: p.id, active })}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action"
                  onClick={() => edit(p)}
                  aria-label={`Editar ${p.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="professional-icon-action hover:!text-red-400"
                  onClick={() => setProfessionalToRemove(p.id)}
                  aria-label={`Remover ${p.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <AlertDialog
        open={professionalToRemove !== null}
        onOpenChange={(open) => !open && setProfessionalToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              O profissional e o acesso associado serão removidos. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (professionalToRemove)
                  remove.mutate(professionalToRemove, {
                    onSettled: () => setProfessionalToRemove(null),
                  });
              }}
              disabled={remove.isPending}
            >
              Remover profissional
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmDiscard} onOpenChange={(v) => !v && setConfirmDiscard(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas neste formulário. Se sair agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                setOpen(false);
                setForm(empty);
                setFormSnapshot(empty);
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="professional-section-label">{label}</Label>
      <Input
        className="professional-input"
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="text-[11px] leading-relaxed text-[#777d87]">{hint}</p> : null}
    </div>
  );
}
