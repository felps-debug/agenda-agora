import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { deleteProfessional, saveProfessional } from "@/lib/professionals.functions";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  ["view_reports", "Ver relatórios"],
] as const;

type Form = {
  id?: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  password: string;
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

  const { data: people } = useQuery({
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

  const { data: services } = useQuery({
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

  const { data: links } = useQuery({
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

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["professionals", businessId] }),
      qc.invalidateQueries({ queryKey: ["service-links", businessId] }),
    ]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { ...form, businessId: businessId!, avatarPath: null } }),
    onSuccess: () => {
      toast.success(form.id ? "Profissional atualizado!" : "Profissional e acesso criados!");
      setOpen(false);
      setForm(empty);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("professionals").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void refresh(),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id, businessId: businessId! } }),
    onSuccess: () => {
      toast.success("Profissional e acesso removidos.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const edit = (p: NonNullable<typeof people>[number]) => {
    const permissions =
      typeof p.permissions === "object" && p.permissions && !Array.isArray(p.permissions)
        ? (p.permissions as Record<string, boolean>)
        : {};
    setForm({
      id: p.id,
      name: p.name,
      role: p.role ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      password: "",
      workingDays: p.working_days,
      permissions,
      serviceIds: (links ?? []).filter((l) => l.professional_id === p.id).map((l) => l.service_id),
    });
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
              setOpen(v);
              if (!v) setForm(empty);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Novo profissional
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {form.id ? "Editar profissional" : "Cadastrar profissional"}
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="dados">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="vinculos">Vínculos</TabsTrigger>
                  <TabsTrigger value="permissoes">Permissões</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-4 pt-4">
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
                    <Field
                      label={form.id ? "Nova senha de 4 dígitos (opcional)" : "Senha de 4 dígitos"}
                      value={form.password}
                      type="password"
                      maxLength={4}
                      onChange={(password) =>
                        setForm({ ...form, password: password.replace(/\D/g, "").slice(0, 4) })
                      }
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Dias de trabalho</Label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {DAYS.map((day, i) => (
                        <label
                          key={day}
                          className={`cursor-pointer rounded-md border p-2 text-center text-xs ${
                            form.workingDays.includes(i)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border"
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

                <TabsContent value="vinculos" className="space-y-3 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Selecione os serviços realizados por este profissional.
                  </p>
                  {services?.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 rounded-md border border-border p-3"
                    >
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
                  ))}
                </TabsContent>

                <TabsContent value="permissoes" className="space-y-3 pt-4">
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                    <ShieldCheck className="size-5 text-primary" /> Estas permissões controlam o que
                    aparece e o que pode ser alterado no acesso do profissional.
                  </div>
                  {PERMISSIONS.map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-4 rounded-md border border-border p-3 text-sm"
                    >
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
              <DialogFooter>
                <Button
                  onClick={() => save.mutate()}
                  disabled={
                    !form.name.trim() ||
                    (!form.id && form.password.length !== 4) ||
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

      {!people?.length ? (
        <EmptyList text="Nenhum profissional cadastrado." />
      ) : (
        <ul className="space-y-3">
          {people.map((p) => (
            <li key={p.id} className="surface flex flex-wrap items-center gap-4 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-40 flex-1">
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  {p.role || "Profissional"}
                  {p.user_id ? " · acesso ativo" : ""}
                </p>
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
                onClick={() => edit(p)}
                aria-label={`Editar ${p.name}`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove.mutate(p.id)}
                aria-label={`Remover ${p.name}`}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
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
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
