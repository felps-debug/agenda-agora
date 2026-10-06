import { useState } from "react";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarX2, ChevronLeft, ChevronRight, Clock3, Eye, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setAppointmentStatus } from "@/lib/appointments.functions";
import { useBusiness } from "@/lib/business";
import {
  STATUSES,
  statusLabel,
  toDateInput,
  localToIso,
  addMinutesIso,
  formatPrice,
} from "@/lib/format";
import { NoBusiness } from "@/components/painel/PageHeader";
import { ProfessionalAvatar, ProfessionalBubbles } from "@/components/painel/ProfessionalBubbles";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel/")({
  head: () => ({
    meta: [
      { title: "Agenda do dia — Agenda Agora" },
      { name: "description", content: "Veja e gerencie os agendamentos do dia do seu negócio." },
      { property: "og:title", content: "Agenda do dia — Agenda Agora" },
      { property: "og:description", content: "Veja e gerencie os agendamentos do dia." },
    ],
  }),
  component: AgendaPage,
});

const START_HOUR = 8;
const END_HOUR = 19;

function buildSlots() {
  const slots: string[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    if (h !== END_HOUR) slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}

const SLOTS = buildSlots();

function slotOf(iso: string) {
  const d = new Date(iso);
  const m = d.getMinutes() < 30 ? "00" : "30";
  return `${String(d.getHours()).padStart(2, "0")}:${m}`;
}

const emptyForm = {
  customer_name: "",
  customer_phone: "",
  service_id: "",
  professional_id: "",
  time: "09:00",
  notes: "",
};

function AgendaPage() {
  const { businessId, business, canViewCustomerPhone } = useBusiness();
  const queryClient = useQueryClient();
  const setAppointmentStatusFn = useServerFn(setAppointmentStatus);
  const [day, setDay] = useState(() => toDateInput(new Date()));
  const [pickedProfessionalId, setPickedProfessionalId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formSnapshot, setFormSnapshot] = useState(emptyForm);
  const [confirmDiscardNew, setConfirmDiscardNew] = useState(false);
  const isNewFormDirty = JSON.stringify(form) !== JSON.stringify(formSnapshot);

  const { data: services } = useQuery({
    queryKey: ["services", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: professionals } = useQuery({
    queryKey: ["professionals", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Sem escolha explícita, vale o primeiro profissional; se o escolhido sumiu, volta ao primeiro.
  const selectedProfessionalId =
    professionals?.find((p) => p.id === pickedProfessionalId)?.id ?? professionals?.[0]?.id ?? null;
  const selectedProfessional = professionals?.find((p) => p.id === selectedProfessionalId) ?? null;

  const { data: appointments } = useQuery({
    queryKey: ["appointments", businessId, day, selectedProfessionalId],
    enabled: !!businessId && professionals !== undefined,
    queryFn: async () => {
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();
      let query = supabase
        .from("appointments")
        .select("*, services(name, price_cents), professionals(name)")
        .eq("business_id", businessId!)
        .gte("starts_at", start)
        .lte("starts_at", end)
        .not("status", "in", "(aguardando_sinal,cancelado)");
      // Itens sem profissional (ex.: horário bloqueado) valem para todos.
      if (selectedProfessionalId) {
        query = query.or(`professional_id.eq.${selectedProfessionalId},professional_id.is.null`);
      }
      const { data, error } = await query.order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["appointments", businessId, day] });

  const create = useMutation({
    mutationFn: async () => {
      const service = services?.find((s) => s.id === form.service_id);
      const startsAt = localToIso(day, form.time);
      const { error } = await supabase.from("appointments").insert({
        business_id: businessId!,
        service_id: form.service_id || null,
        professional_id: form.professional_id || null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        starts_at: startsAt,
        ends_at: addMinutesIso(startsAt, service?.duration_minutes ?? 30),
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento criado!");
      setOpen(false);
      setForm(emptyForm);
      setFormSnapshot(emptyForm);
      void invalidate();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const blockSlot = useMutation({
    mutationFn: async (time: string) => {
      const startsAt = localToIso(day, time);
      const { error } = await supabase.from("appointments").insert({
        business_id: businessId!,
        customer_name: "Bloqueado",
        starts_at: startsAt,
        ends_at: addMinutesIso(startsAt, 30),
        status: "bloqueado",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário bloqueado.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await setAppointmentStatusFn({
        data: { id, status: status as (typeof STATUSES)[number]["value"] },
      });
    },
    onSuccess: () => void invalidate(),
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento removido.");
      setDetail(null);
      void invalidate();
    },
  });

  if (!businessId) return <NoBusiness />;

  const shiftDay = (delta: number) => {
    const next = new Date(`${day}T12:00:00`);
    next.setDate(next.getDate() + delta);
    setDay(toDateInput(next));
  };

  const bySlot = new Map<
    string,
    (typeof appointments extends (infer T)[] | undefined ? T : never)[]
  >();
  for (const a of appointments ?? []) {
    const key = slotOf(a.starts_at);
    bySlot.set(key, [...(bySlot.get(key) ?? []), a]);
  }

  const weekday = new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
  const total = (appointments ?? []).reduce(
    (sum, a) =>
      a.status !== "cancelado" && a.status !== "bloqueado"
        ? sum + ((a.services as { price_cents: number } | null)?.price_cents ?? 0)
        : sum,
    0,
  );
  const selected = (appointments ?? []).find((a) => a.id === detail) ?? null;

  const openNewAt = (time: string) => {
    const next = { ...emptyForm, time, professional_id: selectedProfessionalId ?? "" };
    setForm(next);
    setFormSnapshot(next);
    setOpen(true);
  };

  return (
    <div>
      <h1 className="sr-only">Agenda · {weekday}</h1>
      <div className="flex h-[50.4px] w-full items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => shiftDay(-1)}
          aria-label="Dia anterior"
          className="h-[50.4px] w-[50.4px] shrink-0"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="relative h-[50.4px] min-w-0 flex-1 rounded-md">
          <span
            aria-hidden="true"
            className="date-border-beam pointer-events-none absolute inset-[-1px] z-20 rounded-[7px]"
          />
          <Input
            type="date"
            className="relative z-10 h-[50.4px] min-h-[50.4px] w-full border-[#262626] bg-[#06090d] px-3 py-0 text-[0.82rem] shadow-none"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            aria-label="Data da agenda"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => shiftDay(1)}
          aria-label="Próximo dia"
          className="h-[50.4px] w-[50.4px] shrink-0"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <ProfessionalBubbles
        professionals={professionals ?? []}
        selectedId={selectedProfessionalId}
        onSelect={setPickedProfessionalId}
      />

      <button
        type="button"
        onClick={() => openNewAt("09:00")}
        className="group relative isolate mt-2 flex h-[50.4px] w-full items-center justify-center rounded-[15px] border-[0.75px] border-[#6d5519]/70 bg-[radial-gradient(circle_at_22%_28%,rgba(224,175,45,0.18)_0%,rgba(128,92,20,0.08)_34%,transparent_66%),linear-gradient(100deg,#0c0b08_0%,#0b0b0a_60%,#0d0c09_100%)] px-4 text-[0.82rem] font-medium tracking-[-0.01em] text-[#f5f5f5] shadow-[inset_0_1px_0_rgba(255,222,129,0.035),0_0_18px_rgba(210,157,32,0.025)] transition-all duration-200 hover:border-[#8b6a1d]/75 hover:bg-[radial-gradient(circle_at_22%_28%,rgba(224,175,45,0.22)_0%,rgba(128,92,20,0.10)_34%,transparent_66%),linear-gradient(100deg,#0d0c09_0%,#0b0b0a_60%,#0d0c09_100%)] hover:shadow-[inset_0_1px_0_rgba(255,222,129,0.05),0_0_20px_rgba(210,157,32,0.035)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className="encaixe-border-beam pointer-events-none absolute inset-[-1px] z-20 rounded-[15px]"
        />
        <span className="relative z-10">Encaixe</span>
      </button>

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" size="icon" aria-label="Visualizar">
          <Eye className="size-4" />
        </Button>
        <Button variant="secondary" size="icon" aria-label="Bloquear dia">
          <CalendarX2 className="size-4" />
        </Button>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-border">
        <div className="flex h-12 items-center gap-3 bg-secondary px-3 text-sm">
          {selectedProfessional ? (
            <>
              <span className="size-8 shrink-0 overflow-hidden rounded-full">
                <ProfessionalAvatar professional={selectedProfessional} />
              </span>
              <span className="min-w-0 truncate font-medium">{selectedProfessional.name}</span>
            </>
          ) : null}
          <span className="ml-auto capitalize text-muted-foreground">{weekday}</span>
        </div>
        <ul>
          {SLOTS.map((slot) => {
            const items = bySlot.get(slot) ?? [];
            if (!items.length) {
              return (
                <li key={slot} className="group relative">
                  <button
                    type="button"
                    onClick={() => openNewAt(slot)}
                    className="flex w-full items-center gap-4 border-b border-background bg-slot-free px-4 py-2.5 text-left text-slot-free-foreground transition-opacity hover:opacity-90"
                  >
                    <span className="w-14 font-medium">{slot}</span>
                    <span className="flex-1" />
                  </button>
                  <button
                    type="button"
                    onClick={() => blockSlot.mutate(slot)}
                    aria-label={`Bloquear ${slot}`}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-slot-blocked px-2 py-1 text-[11px] font-semibold text-slot-blocked-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    Bloquear
                  </button>
                </li>
              );
            }
            return items.map((a) => {
              const paid = a.status === "concluido";
              const cancelled = a.status === "cancelado";
              const blocked = a.status === "bloqueado";
              const tone = blocked
                ? "bg-slot-blocked text-slot-blocked-foreground"
                : cancelled
                  ? "bg-slot-empty text-slot-empty-foreground line-through"
                  : paid
                    ? "bg-slot-paid text-slot-paid-foreground"
                    : "bg-slot-booked text-slot-booked-foreground";
              const price = (a.services as { price_cents: number } | null)?.price_cents ?? 0;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(a.id)}
                    className={`flex w-full items-center gap-4 border-b border-background px-4 py-2.5 text-left transition-opacity hover:opacity-90 ${tone}`}
                  >
                    <span className="w-14 font-bold">{slot}</span>
                    <span className="flex-1 text-center text-sm">
                      <span className="block font-medium">
                        {blocked ? "Horário bloqueado" : a.customer_name}
                      </span>
                      {!blocked && a.customer_phone && canViewCustomerPhone && (
                        <span className="block text-xs opacity-80">{a.customer_phone}</span>
                      )}
                    </span>
                    {!blocked && (
                      <span className="hidden text-xs font-medium uppercase sm:block">
                        {(a.services as { name: string } | null)?.name ?? "Serviço"}
                        {price > 0 ? ` - ${formatPrice(price)}` : ""}
                      </span>
                    )}
                    <span className="w-16 text-right text-xs">
                      {paid ? formatPrice(price) : ""}
                    </span>
                  </button>
                </li>
              );
            });
          })}
        </ul>
      </div>

      <p className="mt-4 text-right text-sm text-muted-foreground">
        {(appointments ?? []).length} agendamento(s) · {formatPrice(total)}
      </p>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (v) {
            setOpen(true);
            return;
          }
          if (isNewFormDirty) {
            setConfirmDiscardNew(true);
            return;
          }
          setOpen(false);
          setForm(emptyForm);
        }}
      >
        <DialogContent className="agenda-booking-dialog overflow-y-auto p-0">
          <DialogHeader className="agenda-booking-dialog-header">
            <div className="flex items-start gap-3 text-left">
              <div className="agenda-booking-dialog-icon">
                <Clock3 className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[#f1f2f4]">
                  Novo agendamento
                </DialogTitle>
                <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                  Confirme o horário e preencha os dados do agendamento.
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="agenda-booking-dialog-body">
            <div className="agenda-booking-form-section space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="aname">
                    Cliente
                  </Label>
                  <Input
                    id="aname"
                    className="agenda-booking-input"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="aphone">
                    Telefone
                  </Label>
                  <Input
                    id="aphone"
                    className="agenda-booking-input"
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="agenda-booking-label">Serviço</Label>
                <Select
                  value={form.service_id}
                  onValueChange={(v) => setForm({ ...form, service_id: v })}
                >
                  <SelectTrigger className="agenda-booking-input w-full">
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {(services ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {s.duration_minutes} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="agenda-booking-label">Profissional</Label>
                  <Select
                    value={form.professional_id}
                    onValueChange={(v) => setForm({ ...form, professional_id: v })}
                  >
                    <SelectTrigger className="agenda-booking-input w-full">
                      <SelectValue placeholder="Qualquer um" />
                    </SelectTrigger>
                    <SelectContent>
                      {(professionals ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="atime">
                    Horário
                  </Label>
                  <Input
                    id="atime"
                    className="agenda-booking-input"
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="agenda-booking-label" htmlFor="anotes">
                  Observações
                </Label>
                <Textarea
                  id="anotes"
                  className="agenda-booking-input h-auto min-h-20 py-2"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="agenda-booking-dialog-footer">
            <Button
              className="agenda-booking-primary-button"
              onClick={() => create.mutate()}
              disabled={!form.customer_name.trim() || create.isPending}
            >
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="agenda-booking-dialog overflow-y-auto p-0">
          <DialogHeader className="agenda-booking-dialog-header">
            <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[#f1f2f4]">
              {selected?.customer_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="agenda-booking-dialog-body space-y-4 text-sm">
              <p className="text-muted-foreground">
                {(selected.services as { name: string } | null)?.name ?? "Sem serviço"} ·{" "}
                {slotOf(selected.starts_at)}
                {selected.customer_phone && canViewCustomerPhone
                  ? ` · ${selected.customer_phone}`
                  : ""}
              </p>
              {selected.notes && <p className="text-muted-foreground">{selected.notes}</p>}
              <div className="space-y-2">
                <Label className="agenda-booking-label">Situação</Label>
                <Select
                  value={selected.status}
                  onValueChange={(status) =>
                    status === "cancelado"
                      ? setConfirmCancel(true)
                      : setStatus.mutate({ id: selected.id, status })
                  }
                >
                  <SelectTrigger className="agenda-booking-input w-full">
                    <SelectValue>{statusLabel(selected.status)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="agenda-booking-dialog-footer">
            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={remove.isPending}
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro será removido permanentemente. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (selected)
                  remove.mutate(selected.id, { onSettled: () => setConfirmDelete(false) });
              }}
              disabled={remove.isPending}
            >
              Excluir agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O horário será liberado para outros clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (selected)
                  setStatus.mutate(
                    { id: selected.id, status: "cancelado" },
                    { onSettled: () => setConfirmCancel(false) },
                  );
              }}
              disabled={setStatus.isPending}
            >
              Cancelar agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmDiscardNew} onOpenChange={(v) => !v && setConfirmDiscardNew(false)}>
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
                setConfirmDiscardNew(false);
                setOpen(false);
                setForm(emptyForm);
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
