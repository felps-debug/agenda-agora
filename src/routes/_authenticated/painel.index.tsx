import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, CalendarX2, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
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
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

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

  const { data: appointments } = useQuery({
    queryKey: ["appointments", businessId, day],
    enabled: !!businessId,
    queryFn: async () => {
      const start = new Date(`${day}T00:00:00`).toISOString();
      const end = new Date(`${day}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .select("*, services(name, price_cents), professionals(name)")
        .eq("business_id", businessId!)
        .gte("starts_at", start)
        .lte("starts_at", end)
        .neq("status", "aguardando_sinal")
        .order("starts_at");
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
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
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
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await setAppointmentStatusFn({
        data: { id, status: status as (typeof STATUSES)[number]["value"] },
      });
    },
    onSuccess: () => void invalidate(),
    onError: (e: Error) => toast.error(e.message),
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

  const bySlot = new Map<string, (typeof appointments extends (infer T)[] | undefined ? T : never)[]>();
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
    setForm({ ...emptyForm, time });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} aria-label="Dia anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="date"
          className="w-44"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          aria-label="Data da agenda"
        />
        <Button variant="outline" size="icon" onClick={() => shiftDay(1)} aria-label="Próximo dia">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <p className="mt-2 pl-12 text-[0.82rem] font-medium capitalize">{weekday}</p>

      <button
        type="button"
        onClick={() => openNewAt("09:00")}
        className="mt-2 ml-12 w-44 rounded-md bg-warning/70 px-4 py-2.5 text-[0.82rem] font-medium text-warning-foreground transition-opacity hover:opacity-90"
      >
        Encaixe
      </button>

      <div className="mt-8 flex items-center gap-3">
        <span className="flex size-16 items-center justify-center rounded-full bg-secondary text-xs font-bold uppercase text-muted-foreground">
          {(business?.name ?? "??").slice(0, 2)}
        </span>
        <h1 className="text-[1.2rem] font-medium">Agenda</h1>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="icon" aria-label="Visualizar">
            <Eye className="size-4" />
          </Button>
          <Button variant="secondary" size="icon" aria-label="Bloquear dia">
            <CalendarX2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-border">
        <div className="h-8 bg-secondary" />
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aname">Cliente</Label>
                <Input
                  id="aname"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aphone">Telefone</Label>
                <Input
                  id="aphone"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select
                value={form.service_id}
                onValueChange={(v) => setForm({ ...form, service_id: v })}
              >
                <SelectTrigger>
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
                <Label>Profissional</Label>
                <Select
                  value={form.professional_id}
                  onValueChange={(v) => setForm({ ...form, professional_id: v })}
                >
                  <SelectTrigger>
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
                <Label htmlFor="atime">Horário</Label>
                <Input
                  id="atime"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anotes">Observações</Label>
              <Textarea
                id="anotes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={!form.customer_name.trim() || create.isPending}
            >
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.customer_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                {(selected.services as { name: string } | null)?.name ?? "Sem serviço"} ·{" "}
                {slotOf(selected.starts_at)}
                {selected.customer_phone && canViewCustomerPhone ? ` · ${selected.customer_phone}` : ""}
              </p>
              {selected.notes && <p className="text-muted-foreground">{selected.notes}</p>}
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select
                  value={selected.status}
                  onValueChange={(status) => setStatus.mutate({ id: selected.id, status })}
                >
                  <SelectTrigger>
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
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => selected && remove.mutate(selected.id)}
              disabled={remove.isPending}
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
