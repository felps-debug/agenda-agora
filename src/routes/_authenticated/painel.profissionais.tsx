import { useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { deleteProfessional, saveProfessional } from "@/lib/professionals.functions";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
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
  DialogTrigger,
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
  ["view_financial", "Ver valores e financeiro"],
  ["manage_appearance", "Editar aparência do painel"],
  ["manage_outreach", "Editar artes de divulgação"],
  ["generate_qrcode", "Gerenciar conexão do WhatsApp"],
  ["view_reports", "Ver relatórios"],
] as const;

type Form = {
  id?: string;
  name: string;
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
  name: "",
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

function ProfissionaisPage() {
  const { businessId } = useBusiness();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveProfessional);
  const deleteFn = useServerFn(deleteProfessional);
  const [open, setOpen] = useState(false);
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

  const people = peopleQuery.data;
  const services = servicesQuery.data;
  const links = linksQuery.data;

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["professionals", businessId] }),
      qc.invalidateQueries({ queryKey: ["service-links", businessId] }),
    ]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { ...form, businessId: businessId! } }),
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
      name: p.name,
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
      <PageHeader
        title="Profissionais"
        subtitle="Equipe, acesso individual e permissões reais do painel."
        action={
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
            <DialogTrigger asChild>
              <Button className="professional-primary-button">
                <Plus className="size-4" /> Novo profissional
              </Button>
            </DialogTrigger>
            <DialogContent className="professional-dialog max-h-[92vh] max-w-2xl overflow-y-auto p-0">
              <DialogHeader className="professional-dialog-header">
                <div className="flex items-start gap-3 text-left">
                  <div className="professional-dialog-icon">
                    <UserRound className="size-[1.05rem]" strokeWidth={1.8} />
                  </div>
                  <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[#f1f2f4]">
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
                      name={form.name}
                      avatarPath={form.avatarPath}
                      onChange={(avatarPath) => setForm({ ...form, avatarPath })}
                    />
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Nome completo"
                      value={form.name}
                      onChange={(name) => setForm({ ...form, name })}
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

                <TabsContent value="vinculos" className="professional-form-section space-y-3 pt-5">
                  <p className="professional-info-box">
                    Selecione os serviços realizados por este profissional.
                  </p>
                  {servicesQuery.isError ? (
                    <p role="alert" className="py-4 text-sm text-destructive">
                      Não foi possível carregar os serviços. Atualize a página e tente novamente.
                    </p>
                  ) : (
                    services?.map((s) => (
                      <label key={s.id} className="professional-choice-row">
                        <Checkbox
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
                        <span>{s.name}</span>
                      </label>
                    ))
                  )}
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
                    !form.name.trim() ||
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
        }
      />

      {peopleQuery.isError ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-6 text-center text-sm">
          Não foi possível carregar os profissionais. Atualize a página e tente novamente.
        </p>
      ) : !people?.length ? (
        <EmptyList text="Nenhum profissional cadastrado." />
      ) : (
        <ul className="professional-list-panel divide-y divide-white/[0.05]">
          {people.map((p) => (
            <li key={p.id} className="professional-person-row relative z-10">
              <div className="professional-avatar overflow-hidden !p-0">
                <ProfessionalAvatar professional={p} />
              </div>
              <div className="min-w-40 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-[#eef0f4]">
                  {p.name}
                  {p.user_id && <span className="professional-badge">Acesso ativo</span>}
                </p>
                <p className="text-sm text-[#777d87]">{p.role || "Profissional"}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  maxLength?: number;
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
    </div>
  );
}
