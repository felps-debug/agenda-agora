import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { friendlyError } from "@/lib/error-page";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarX2, Clock3, Eye, LoaderCircle, LockKeyhole, Trash2, X } from "lucide-react";
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
  weekdayLabel,
} from "@/lib/format";
import { NoBusiness } from "@/components/painel/PageHeader";
import { AtenasOverviewHero } from "@/components/painel/AtenasOverviewHero";
import { AgendaDateSelector } from "@/components/painel/AgendaDateSelector";
import { ProfessionalAvatar, ProfessionalBubbles } from "@/components/painel/ProfessionalBubbles";
import { formatPhoneBR } from "@/lib/format-phone";
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

/** Símbolo oficial do Pix (Font Awesome Free 6.5.2 — brands/pix). */
function PixGlyph() {
  return (
    <svg viewBox="0 0 512 512" className="size-4" fill="currentColor" aria-label="Pix">
      <path d="M242.4 292.5C247.8 287.1 257.1 287.1 262.5 292.5L339.5 369.5C353.7 383.7 372.6 391.5 392.6 391.5H407.7L310.6 488.6C280.3 518.1 231.1 518.1 200.8 488.6L103.3 391.2H112.6C132.6 391.2 151.5 383.4 165.7 369.2L242.4 292.5zM262.5 218.9C256.1 224.4 247.9 224.5 242.4 218.9L165.7 142.2C151.5 127.1 132.6 120.2 112.6 120.2H103.3L200.7 22.76C231.1-7.586 280.3-7.586 310.6 22.76L407.8 119.9H392.6C372.6 119.9 353.7 127.7 339.5 141.9L262.5 218.9zM112.6 142.7C126.4 142.7 139.1 148.3 149.7 158.1L226.4 234.8C233.6 241.1 243 245.6 252.5 245.6C261.9 245.6 271.3 241.1 278.5 234.8L355.5 157.8C365.3 148.1 378.8 142.5 392.6 142.5H430.3L488.6 200.8C518.9 231.1 518.9 280.3 488.6 310.6L430.3 368.9H392.6C378.8 368.9 365.3 363.3 355.5 353.5L278.5 276.5C264.6 262.6 240.3 262.6 226.4 276.6L149.7 353.2C139.1 363 126.4 368.6 112.6 368.6H80.78L22.76 310.6C-7.586 280.3-7.586 231.1 22.76 200.8L80.78 142.7H112.6z" />
    </svg>
  );
}

function AgendaPage() {
  const navigate = useNavigate();
  const { businessId, business, canViewCustomerPhone, isPlatformAdmin } = useBusiness();

  // Painel Master (Painel 3): ao abrir o painel, carrega a Visão Geral por padrão.
  useEffect(() => {
    if (isPlatformAdmin) {
      void navigate({ to: "/painel/master" });
    }
  }, [isPlatformAdmin, navigate]);
  const queryClient = useQueryClient();
  const setAppointmentStatusFn = useServerFn(setAppointmentStatus);
  const [day, setDay] = useState(() => toDateInput(new Date()));
  const [pickedProfessionalId, setPickedProfessionalId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [encaixeMode, setEncaixeMode] = useState(false);
  const [encaixeOpen, setEncaixeOpen] = useState(false);

  // Transição da grade da agenda: fade-out → spinner → slide-up.
  // `agendaView` guarda o dia/profissional que está DE FATO renderizado na grade.
  // Ele só é atualizado DEPOIS do fade-out, para que a grade antiga permaneça
  // visível (e desapareça suavemente) enquanto a nova ainda não chegou.
  const [agendaView, setAgendaView] = useState<{
    day: string;
    professionalId: string | null;
  } | null>(null);
  const [agendaPhase, setAgendaPhase] = useState<"idle" | "out" | "loading" | "in">("idle");

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

  // Horário de funcionamento (menu Funcionamento) — define os dias com/sem atendimento.
  // Fresh for a minute; editing hours invalidates this shared query.
  const { data: businessHours } = useQuery({
    queryKey: ["business_hours", businessId],
    enabled: !!businessId,
    staleTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("business_id", businessId!);
      if (error) throw error;
      return data;
    },
  });

  // Bloqueios do menu Horários bloqueados (recorrentes + data específica).
  // Sempre fresco: excluir um bloqueio e voltar pra agenda NÃO pode manter
  // a linha vermelha por cache (menu → delete → invalidates ["time_blocks", ...]).
  const { data: timeBlocks } = useQuery({
    queryKey: ["time_blocks", businessId],
    enabled: !!businessId,
    staleTime: 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_blocks")
        .select("*")
        .eq("business_id", businessId!);
      if (error) throw error;
      return data;
    },
  });

  // Sem escolha explícita, vale o primeiro profissional; se o escolhido sumiu, volta ao primeiro.
  const selectedProfessionalId =
    professionals?.find((p) => p.id === pickedProfessionalId)?.id ?? professionals?.[0]?.id ?? null;
  const { data: appointments } = useQuery({
    queryKey: [
      "appointments",
      businessId,
      agendaView?.day ?? null,
      agendaView?.professionalId ?? null,
    ],
    enabled: !!businessId && agendaView !== null,
    queryFn: async () => {
      const { day: viewDay, professionalId: viewProfessionalId } = agendaView!;
      const start = new Date(`${viewDay}T00:00:00`).toISOString();
      const end = new Date(`${viewDay}T23:59:59`).toISOString();
      let query = supabase
        .from("appointments")
        .select(
          "*, services(name, price_cents, requires_deposit, deposit_mode, deposit_percent_bps, deposit_cents), professionals(name)",
        )
        .eq("business_id", businessId!)
        .gte("starts_at", start)
        .lte("starts_at", end)
        .not("status", "in", "(aguardando_sinal,cancelado)");
      // Itens sem profissional (ex.: horário bloqueado) valem para todos.
      if (viewProfessionalId) {
        query = query.or(`professional_id.eq.${viewProfessionalId},professional_id.is.null`);
      }
      const { data, error } = await query.order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  // 1) Primeira montagem da grade: assim que os profissionais resolvem, fixa o
  //    dia/profissional exibidos e começa a carregar (sem animação de saída).
  useEffect(() => {
    if (agendaView === null && professionals !== undefined) {
      setAgendaView({ day, professionalId: selectedProfessionalId });
      setAgendaPhase("loading");
    }
  }, [agendaView, professionals, day, selectedProfessionalId]);

  // 2) Troca de filtro: some com a grade atual (fade-out) e, só então, aplica o
  //    novo dia/profissional — o fetch começa depois, evitando qualquer
  //    sobreposição/piscada entre a grade antiga e a nova.
  useEffect(() => {
    if (agendaView === null) return;
    if (agendaView.day === day && agendaView.professionalId === selectedProfessionalId) return;
    setAgendaPhase("out");
    const t = setTimeout(() => {
      setAgendaView({ day, professionalId: selectedProfessionalId });
      setAgendaPhase("loading");
    }, 220);
    return () => clearTimeout(t);
  }, [day, selectedProfessionalId, agendaView]);

  // 3) Os dados chegaram: esconde o spinner e faz a grade nova entrar deslizando.
  useEffect(() => {
    if (agendaPhase !== "loading") return;
    if (agendaView !== null && appointments !== undefined) setAgendaPhase("in");
  }, [agendaPhase, agendaView, appointments]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["appointments", businessId, day] });

  // Pop-up "Horário Bloqueado": aberto ao clicar em QUALQUER linha bloqueada —
  // de agenda, recorrente ou de data específica — com opção de desbloquear.
  type BlockedPopupData = {
    type: "time_block" | "appointment";
    id: string;
    day: string;
    start: string;
    end: string;
    reason: string;
    professionalId: string | null;
  };
  const [blockedPopup, setBlockedPopup] = useState<BlockedPopupData | null>(null);
  const [blockedClosing, setBlockedClosing] = useState(false);
  const [blockDesc, setBlockDesc] = useState("");

  useEffect(() => {
    if (blockedPopup) setBlockDesc(blockedPopup.reason);
  }, [blockedPopup]);

  const closeBlockedPopup = () => {
    setBlockedClosing(true);
    window.setTimeout(() => {
      setBlockedPopup(null);
      setBlockedClosing(false);
    }, 220);
  };

  const descDirty = blockedPopup !== null && blockDesc !== blockedPopup.reason;

  const openBlockedPopup = (source: {
    type: "time_block" | "appointment";
    block?:
      | {
          id: string;
          starts_at: string;
          ends_at: string;
          reason: string | null;
          professional_id: string | null;
          recurring: boolean;
          weekday: number | null;
          block_date: string | null;
        }
      | undefined;
    appointment?: typeof appointments extends (infer T)[] | undefined ? T : never;
  }) => {
    if (source.type === "time_block" && source.block) {
      const block = source.block;
      setBlockedPopup({
        type: "time_block",
        id: block.id,
        day: agendaView?.day ?? day,
        start: block.starts_at.slice(0, 5),
        end: block.ends_at.slice(0, 5),
        reason: block.reason ?? "",
        professionalId: block.professional_id,
      });
      return;
    }
    if (source.appointment) {
      const appointment = source.appointment;
      setBlockedPopup({
        type: "appointment",
        id: appointment.id,
        day: agendaView?.day ?? day,
        start: slotOf(appointment.starts_at),
        end: slotOf(appointment.ends_at),
        reason: appointment.notes ?? "",
        professionalId: appointment.professional_id ?? null,
      });
    }
  };

  const unblock = useMutation({
    mutationFn: async (payload: { type: "time_block" | "appointment"; id: string }) => {
      if (payload.type === "time_block") {
        const { error } = await supabase.from("time_blocks").delete().eq("id", payload.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("appointments").delete().eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário desbloqueado!");
      setBlockedPopup(null);
      void queryClient.invalidateQueries({ queryKey: ["time_blocks", businessId] });
      void invalidate();
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const saveBlockDesc = useMutation({
    mutationFn: async (payload: {
      type: "time_block" | "appointment";
      id: string;
      reason: string;
    }) => {
      if (payload.type === "time_block") {
        const { error } = await supabase
          .from("time_blocks")
          .update({ reason: payload.reason.trim() || null })
          .eq("id", payload.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("appointments")
        .update({ notes: payload.reason.trim() || null })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Descrição salva!");
      setBlockedPopup((current) => (current ? { ...current, reason: blockDesc.trim() } : current));
      void queryClient.invalidateQueries({ queryKey: ["time_blocks", businessId] });
      void invalidate();
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const create = useMutation({
    mutationFn: async () => {
      const service = services?.find((s) => s.id === form.service_id);
      const startsAt = localToIso(day, form.time);
      const rawNotes = form.notes?.trim() ?? "";
      const notes = encaixeMode ? `[ENCAIXE]${rawNotes ? ` ${rawNotes}` : ""}` : rawNotes || null;
      const { error } = await supabase.from("appointments").insert({
        business_id: businessId!,
        service_id: form.service_id || null,
        professional_id: form.professional_id || null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        starts_at: startsAt,
        ends_at: addMinutesIso(startsAt, service?.duration_minutes ?? 30),
        notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento criado!");
      setOpen(false);
      setEncaixeOpen(false);
      setForm(emptyForm);

      setEncaixeMode(false);
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

  const selected = (appointments ?? []).find((a) => a.id === detail) ?? null;
  const [detailForm, setDetailForm] = useState({ name: "", phone: "" });
  const [formaPagamento, setFormaPagamento] = useState("");
  useEffect(() => {
    setFormaPagamento("");
    if (selected)
      setDetailForm({
        name: selected.customer_name,
        phone: selected.customer_phone ?? "",
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const updateSelectedCustomer = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const { error } = await supabase
        .from("appointments")
        .update({ customer_name: detailForm.name, customer_phone: detailForm.phone || null })
        .eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados do cliente atualizados.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  if (!businessId) return <NoBusiness />;

  const bySlot = new Map<
    string,
    (typeof appointments extends (infer T)[] | undefined ? T : never)[]
  >();
  for (const a of appointments ?? []) {
    const key = slotOf(a.starts_at);
    bySlot.set(key, [...(bySlot.get(key) ?? []), a]);
  }

  const weekday = new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });
  // Capitalização garantida via JS (primeira letra e após hífen: "Quarta-Feira"),
  // sem depender do text-transform do CSS.
  const capitalizeWeekday = (value: string) =>
    value.replace(/(^|[\s-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());

  // Dia exibido na grade e o weekday com a MESMA convenção do menu Funcionamento
  // (0 = domingo, 1..6 conforme WEEKDAYS de format.ts).
  const gridDay = agendaView?.day ?? day;
  const gridWeekday = new Date(`${gridDay}T12:00:00`).getDay();

  // Dia sem funcionamento: a grade fica "indisponível" (dia de folga) — sem linhas
  // livres; agendamentos pré-existentes ainda aparecem computados.
  const dayHours = (businessHours ?? []).filter((h) => h.weekday === gridWeekday);
  const gridClosed = dayHours.length === 0;

  // Bloqueios válidos para o dia exibido — os específicos do profissional e os
  // de "Todos os profissionais" (também bloqueiam a agenda dele).
  const gridBlocks = (timeBlocks ?? [])
    .filter((b) => (b.recurring ? b.weekday === gridWeekday : b.block_date === gridDay))
    .filter(
      (b) =>
        !agendaView?.professionalId ||
        !b.professional_id ||
        b.professional_id === agendaView.professionalId,
    );
  const slotMinutes = (slot: string) => {
    const [sh, sm] = slot.split(":").map(Number);
    return (sh || 0) * 60 + (sm || 0);
  };
  const blocksBySlot = new Map<
    string,
    { label: string; block: typeof timeBlocks extends (infer T)[] | undefined ? T : never }
  >();
  for (const block of gridBlocks) {
    const start = slotMinutes(block.starts_at.slice(0, 5));
    const end = slotMinutes(block.ends_at.slice(0, 5));
    for (const slot of SLOTS) {
      const min = slotMinutes(slot);
      if (min < start || min >= end) continue;
      if (blocksBySlot.has(slot)) continue;
      const label = block.reason?.trim()
        ? block.reason.trim()
        : block.recurring
          ? `Bloqueio recorrente - toda ${weekdayLabel(block.weekday ?? gridWeekday).split(" ")[0]}`
          : `Bloqueio específico - ${new Date(`${block.block_date}T12:00:00`).toLocaleDateString("pt-BR")}`;
      blocksBySlot.set(slot, { label, block });
    }
  }

  // Profissional e dia de fato renderizados na grade. Podem ficar 1 passo atrás
  // da seleção durante o fade-out, garantindo que nada "pisque" na troca.
  const viewProfessional = professionals?.find((p) => p.id === agendaView?.professionalId) ?? null;
  const viewWeekdayLabel = capitalizeWeekday(
    new Date(`${agendaView?.day ?? day}T12:00:00`).toLocaleDateString("pt-BR", {
      weekday: "long",
    }),
  );
  // A grade só aparece quando a view está fixada e os dados chegaram; caso
  // contrário, exibimos o spinner (fase de carregamento).
  const agendaReady = agendaView !== null && appointments !== undefined;
  const openNewAt = (time: string, encaixe = false) => {
    const next = { ...emptyForm, time, professional_id: selectedProfessionalId ?? "" };
    setForm(next);

    setEncaixeMode(encaixe);
    setOpen(true);
  };

  /** Rola suavemente até a lista de agendamentos, logo abaixo do header fixo. */
  const scrollToAgenda = () => {
    const el = document.getElementById("minha-agenda");
    if (!el) return;
    const stickyHeader = document.querySelector<HTMLElement>(".owner-panel header.sticky");
    const offset = (stickyHeader?.getBoundingClientRect().height ?? 0) + 8;
    const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset);
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div>
      <h1 className="sr-only">Agenda · {weekday}</h1>
      <AtenasOverviewHero name={business?.name} onSeeAgenda={scrollToAgenda} />
      <AgendaDateSelector
        value={day}
        onChange={(next) => {
          setDay(next);
        }}
      />

      <ProfessionalBubbles
        professionals={professionals ?? []}
        selectedId={selectedProfessionalId}
        onSelect={(id) => {
          setPickedProfessionalId(id);
        }}
      />

      {viewProfessional ? (
        <div
          aria-hidden="true"
          className="relative z-20 -mb-[55px] ml-px size-16 overflow-hidden rounded-full"
        >
          <ProfessionalAvatar professional={viewProfessional} className="rounded-xl" />
        </div>
      ) : null}
      {/* Grade da agenda com transição profissional: ao trocar de dia/profissional
          a grade atual some (fade-out), um spinner fica centralizado durante o
          fetch e, quando os dados chegam, a grade nova entra deslizando de baixo
          para cima. */}
      {agendaReady ? (
        <div
          id="minha-agenda"
          key={`${agendaView!.professionalId ?? "none"}-${agendaView!.day}`}
          className={`${
            agendaPhase === "out" ? "animate-agenda-out" : "animate-agenda-in"
          } mx-auto mt-3 w-[99%] overflow-hidden rounded-md border border-border`}
        >
          <div className="relative flex h-12 items-center gap-3 bg-secondary px-3 text-sm">
            {viewProfessional ? (
              <span className="min-w-0 max-w-[44%] truncate pl-[54px] text-[110%] font-medium capitalize">
                {(viewProfessional.agenda_name || viewProfessional.name.split(" ")[0] || "").slice(
                  0,
                  11,
                )}
              </span>
            ) : null}
            <span className="absolute left-[60%] top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[110%] capitalize text-white">
              {viewWeekdayLabel}
            </span>
          </div>
          {gridClosed ? (
            <div className="flex flex-col items-center justify-center gap-4 bg-[var(--c-0d1015)] px-6 py-14">
              <span className="flex size-20 items-center justify-center rounded-2xl border border-[#ff5a5a]/30 bg-[#ff5a5a]/10 shadow-[0_0_24px_rgba(255,90,90,0.14)]">
                <CalendarX2 className="size-10 text-[#ff8080]" strokeWidth={1.8} />
              </span>
              <p className="text-lg font-semibold text-[var(--c-e6e9ee)]">
                Sem horários para esta data!
              </p>
              <p className="text-sm text-[#8b8e96]">
                {viewWeekdayLabel} está sem funcionamento no menu Funcionamento — dia de folga,
                ninguém pode marcar.
              </p>
            </div>
          ) : null}
          <ul className="font-['Inter',sans-serif]">
            {SLOTS.map((slot) => {
              const items = bySlot.get(slot) ?? [];
              if (!items.length) {
                if (gridClosed) return null;
                const blocked = blocksBySlot.get(slot);
                if (blocked) {
                  return (
                    <li key={slot} className="agenda-row agenda-row--blocked">
                      <button
                        type="button"
                        onClick={() =>
                          openBlockedPopup({ type: "time_block", block: blocked.block })
                        }
                        className="agenda-row-btn"
                      >
                        <span className="agenda-cell agenda-cell--time">{slot}</span>
                        <span className="agenda-cell agenda-cell--cliente">
                          <span className="agenda-blocked-label">{blocked.label}</span>
                        </span>
                        <span className="agenda-cell agenda-cell--servico" />
                        <span className="agenda-cell agenda-cell--pago" />
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={slot} className="agenda-row agenda-row--free group relative">
                    <button
                      type="button"
                      onClick={() => openNewAt(slot)}
                      className="agenda-row-btn"
                    >
                      <span className="agenda-cell agenda-cell--time">{slot}</span>
                      <span className="agenda-cell agenda-cell--cliente" />
                      <span className="agenda-cell agenda-cell--servico" />
                      <span className="agenda-cell agenda-cell--pago" />
                    </button>
                  </li>
                );
              }
              return items.map((a) => {
                const cancelled = a.status === "cancelado";
                const blocked = a.status === "bloqueado";
                // Bloqueios antigos salvos como agendamento somem quando o slot já
                // está coberto por um bloqueio do menu Horários bloqueados
                // (evita linha duplicada "morta" depois de excluir o bloqueio).
                if (blocked && blocksBySlot.has(slot)) return null;
                const isEncaixe = a.notes?.trim().toLowerCase().startsWith("[encaixe]");
                const isPublicBooking = !!a.customer_id && !isEncaixe;
                const depositPaid = !!a.deposit_paid_at;
                const tone = blocked
                  ? "blocked"
                  : cancelled
                    ? "cancelled"
                    : isEncaixe
                      ? "encaixe"
                      : isPublicBooking
                        ? "public"
                        : depositPaid
                          ? "admin-pix"
                          : "admin";
                const price = (a.services as { price_cents: number } | null)?.price_cents ?? 0;
                const serviceName = (a.services as { name: string } | null)?.name ?? "Serviço";
                // Espaço do Pix só existe se o serviço tem sinal configurado
                // (mesma regra do catálogo: requires_deposit + valor efetivo > 0)
                // ou se o sinal já foi pago. Sem sinal, a linha usa 3 blocos cheios.
                const svc = a.services as {
                  requires_deposit?: boolean | null;
                  deposit_mode?: string | null;
                  deposit_percent_bps?: number | null;
                  deposit_cents?: number | null;
                } | null;
                const depositConfigured =
                  !!svc?.requires_deposit &&
                  (svc.deposit_mode === "percent"
                    ? price > 0 && (svc.deposit_percent_bps ?? 0) > 0
                    : (svc.deposit_cents ?? 0) > 0);
                const showPixCol = depositPaid || depositConfigured;
                return (
                  <li
                    key={a.id}
                    className={`agenda-row agenda-row--${tone}${showPixCol ? "" : " agenda-row--sem-sinal"}`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        blocked
                          ? openBlockedPopup({ type: "appointment", appointment: a })
                          : setDetail(a.id)
                      }
                      className="agenda-row-btn"
                    >
                      <span className="agenda-cell agenda-cell--time">{slot}</span>
                      <span className="agenda-cell agenda-cell--cliente">
                        {blocked ? (
                          <span className="agenda-blocked-label">Horário bloqueado</span>
                        ) : (
                          <>
                            {a.customer_name ? (
                              <span className="agenda-cliente-name">{a.customer_name}</span>
                            ) : null}
                            {a.customer_phone && canViewCustomerPhone ? (
                              <span className="agenda-cliente-phone">
                                {formatPhoneBR(a.customer_phone)}
                              </span>
                            ) : null}
                          </>
                        )}
                      </span>
                      <span className="agenda-cell agenda-cell--servico">
                        {blocked ? null : (
                          <>
                            <span className="agenda-servico-label">{serviceName}</span>
                            <span className="agenda-servico-price">{formatPrice(price)}</span>
                          </>
                        )}
                      </span>
                      <span className="agenda-cell agenda-cell--pago">
                        {!blocked && depositPaid ? (
                          <span className="agenda-pago">
                            <PixGlyph />
                            <span>
                              {(a.deposit_cents / 100).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              });
            })}
          </ul>
        </div>
      ) : (
        <div className="agenda-loading" aria-busy="true" aria-live="polite">
          <LoaderCircle className="size-8 animate-spin-custom text-primary" aria-hidden="true" />
          <span className="sr-only">Carregando agenda…</span>
        </div>
      )}

      {/* Pop-up "Horário Bloqueado" — clique em qualquer linha bloqueada.
          Clonado da referência: Desbloquear + Data/Funcionário/começo/fim + Descrição + Fechar. */}
      {blockedPopup
        ? createPortal(
            <div
              className="aa-popup-full fixed inset-0 z-[70] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Horário Bloqueado"
            >
              <button
                type="button"
                aria-label="Fechar"
                onClick={closeBlockedPopup}
                className={`fixed inset-0 h-full w-full cursor-default bg-black/60 ${blockedClosing ? "animate-backdrop-out" : "animate-backdrop"}`}
              />
              <div className="flex min-h-full items-center justify-center p-4">
                <div
                  className={`relative w-full max-w-md rounded-2xl border border-[var(--c-272a30)] bg-[var(--c-0b0b0e)] p-6 ${blockedClosing ? "animate-modal-out" : "animate-modal-in"}`}
                >
                  <button
                    type="button"
                    onClick={closeBlockedPopup}
                    aria-label="Fechar"
                    className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border border-[#30333a] text-[var(--c-9aa4b2)] transition-colors hover:text-white"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--c-1677ff)]/30 bg-[var(--c-1677ff)]/10 text-[var(--c-5da8ff)] shadow-[0_0_18px_var(--c-rgba-22-119-255-a0d08)]">
                      <LockKeyhole className="size-5" strokeWidth={1.8} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-[1.18rem] font-bold text-white">Horário Bloqueado</h3>
                      <p className="mt-0.5 text-xs text-[#8b8e96]">
                        {blockedPopup.type === "time_block"
                          ? "Bloqueio do menu Horários bloqueados"
                          : "Bloqueio direto na agenda"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-[#2a2e35] bg-[var(--c-101218)] p-4">
                    <button
                      type="button"
                      disabled={unblock.isPending}
                      onClick={() =>
                        unblock.mutate({ type: blockedPopup.type, id: blockedPopup.id })
                      }
                      className="grid h-11 w-full place-items-center rounded-xl border border-[#ff5a5a]/40 bg-[#ff5a5a]/10 text-sm font-bold text-[#ff8080] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_0_18px_rgba(255,90,90,0.12)] transition-colors hover:border-[#ff5a5a]/60 hover:bg-[#ff5a5a]/15 hover:text-[#ffa0a0] disabled:opacity-50"
                    >
                      {unblock.isPending ? "Desbloqueando…" : "🔓 Desbloquear horário"}
                    </button>

                    <div className="blocked-info-duo mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div>
                        <p className="text-[0.95rem] font-bold text-white">Data bloqueada:</p>
                        <p className="mt-1 text-[var(--c-c3c8d0)]">
                          {new Date(`${blockedPopup.day}T12:00:00`).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.95rem] font-bold text-white">Funcionário:</p>
                        <p className="mt-1 text-[var(--c-c3c8d0)]">
                          {blockedPopup.professionalId
                            ? (professionals?.find((p) => p.id === blockedPopup.professionalId)
                                ?.name ?? "—")
                            : "Agenda"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[0.95rem] font-bold text-white">Horário começo:</p>
                        <p className="mt-1 text-[var(--c-c3c8d0)]">{blockedPopup.start}</p>
                      </div>
                      <div>
                        <p className="text-[0.95rem] font-bold text-white">Horário fim:</p>
                        <p className="mt-1 text-[var(--c-c3c8d0)]">{blockedPopup.end}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label className="agenda-booking-label">Descrição</Label>
                      <Textarea
                        value={blockDesc}
                        onChange={(e) => setBlockDesc(e.target.value)}
                        rows={3}
                        placeholder="Ex.: manutenção, almoço, compromisso…"
                        className="agenda-booking-input"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!descDirty || saveBlockDesc.isPending}
                    onClick={() =>
                      saveBlockDesc.mutate({
                        type: blockedPopup.type,
                        id: blockedPopup.id,
                        reason: blockDesc,
                      })
                    }
                    className="mt-3 h-11 w-full rounded-xl border border-[var(--c-1677ff)]/30 bg-[var(--c-1677ff)]/10 text-sm font-bold text-[var(--c-5da8ff)] transition-colors hover:bg-[var(--c-1677ff)]/15 disabled:opacity-50"
                  >
                    {saveBlockDesc.isPending ? "Salvando…" : "Salvar descrição"}
                  </button>

                  <button
                    type="button"
                    onClick={closeBlockedPopup}
                    className="mt-2.5 h-11 w-full rounded-xl bg-[var(--c-131519)] text-sm font-semibold text-[var(--c-c3c8d0)] transition-colors hover:text-white"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (v) {
            setOpen(true);
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
                <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
                  Novo agendamento
                </DialogTitle>
                <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                  Agendar Serviço às {form.time || "--:--"} —{" "}
                  {new Date(`${day}T12:00:00`)
                    .toLocaleDateString("pt-BR", { weekday: "long" })
                    .replace(/(^|\s)\w/g, (c) => c.toUpperCase())}
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="agenda-booking-dialog-body">
            <div className="agenda-booking-form-section space-y-5">
              <button
                type="button"
                disabled={!form.time || blockSlot.isPending}
                onClick={() =>
                  form.time && blockSlot.mutate(form.time, { onSuccess: () => setOpen(false) })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-400/[0.06] px-4 py-3 text-sm font-semibold text-red-300 transition-colors hover:bg-red-400/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LockKeyhole className="size-4" aria-hidden="true" />
                {blockSlot.isPending ? "Bloqueando..." : "Bloquear horário"}
              </button>
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
              <div className="agenda-booking-duo grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="aname">
                    NOME DO CLIENTE
                  </Label>
                  <Input
                    id="aname"
                    className="agenda-booking-input"
                    placeholder="Nome Cliente"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="aphone">
                    NÚMERO DO CLIENTE
                  </Label>
                  <Input
                    id="aphone"
                    className="agenda-booking-input"
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    value={formatPhoneBR(form.customer_phone)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        customer_phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                      })
                    }
                  />
                </div>
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
            <div className="flex items-start gap-3 text-left">
              <div className="agenda-booking-dialog-icon">
                <Clock3 className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
                  {selected
                    ? `${slotOf(selected.starts_at)} - ${slotOf(selected.ends_at)} ${new Date(selected.starts_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}`
                    : ""}
                </DialogTitle>
                <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                  Origem:{" "}
                  {(selected?.notes ?? "").startsWith("[ENCAIXE]") ? "Encaixe" : "prof. Agenda"}
                </p>
              </div>
            </div>
          </DialogHeader>

          {selected && (
            <div className="agenda-booking-dialog-body">
              <div className="agenda-booking-form-section space-y-5">
                <div className="agenda-booking-duo grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="agenda-booking-label" htmlFor="dname">
                      NOME DO CLIENTE
                    </Label>
                    <Input
                      id="dname"
                      className="agenda-booking-input"
                      value={detailForm.name}
                      onChange={(e) => setDetailForm((f) => ({ ...f, name: e.target.value }))}
                      onBlur={() => updateSelectedCustomer.mutate()}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="agenda-booking-label" htmlFor="dphone">
                      NÚMERO DO CLIENTE
                    </Label>
                    <Input
                      id="dphone"
                      className="agenda-booking-input"
                      inputMode="numeric"
                      value={formatPhoneBR(detailForm.phone)}
                      onChange={(e) =>
                        setDetailForm((f) => ({
                          ...f,
                          phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                        }))
                      }
                      onBlur={() => updateSelectedCustomer.mutate()}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="agenda-booking-label">SERVIÇOS</Label>
                  <div className="agenda-booking-input flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="font-semibold">
                      {(selected.services as { name: string } | null)?.name ?? "Serviço"}
                    </span>
                    <span>
                      {formatPrice(
                        (selected.services as { price_cents: number } | null)?.price_cents ?? 0,
                      )}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="agenda-booking-label">RESUMO DE PAGAMENTO</Label>
                  <div className="agenda-booking-input-agenda space-y-2 rounded-md border border-[#30333a] bg-[#0d0e11] px-3 py-2">
                    {selected.deposit_paid_at ? (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-[#3f9142]/40 bg-[#12351d]/70 px-2.5 py-1.5">
                        <span className="text-xs font-semibold text-[#7ee08a]">
                          Pagamento via Pix Ag Pay
                        </span>
                        <span className="text-xs font-bold text-[#7ee08a]">
                          {formatPrice(selected.deposit_cents ?? 0)}
                        </span>
                      </div>
                    ) : null}
                    <div>
                      <span className="font-semibold text-primary">
                        Total pendente{" "}
                        {formatPrice(
                          Math.max(
                            ((selected.services as { price_cents: number } | null)?.price_cents ??
                              0) - (selected.deposit_paid_at ? (selected.deposit_cents ?? 0) : 0),
                            0,
                          ),
                        )}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="agenda-booking-label">Forma de pagamento</Label>
                      <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v)}>
                        <SelectTrigger className="agenda-booking-input w-full">
                          <SelectValue placeholder="Selecione a forma de pagamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="debito">Cartão Débito</SelectItem>
                          <SelectItem value="credito">Cartão Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="font-semibold">Total</span>
                      <span className="font-semibold text-primary">
                        {formatPrice(
                          Math.max(
                            ((selected.services as { price_cents: number } | null)?.price_cents ??
                              0) - (selected.deposit_paid_at ? (selected.deposit_cents ?? 0) : 0),
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="agenda-booking-dialog-footer flex gap-3">
            <Button variant="destructive" className="flex-1" onClick={() => setConfirmCancel(true)}>
              Cancelar serviço
            </Button>
            <Button
              className="flex-1"
              onClick={() => setStatus.mutate({ id: selected!.id, status: "concluido" })}
            >
              Finalizar serviço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={encaixeOpen}
        onOpenChange={(v) => {
          if (!v) {
            setEncaixeOpen(false);
            setEncaixeMode(false);
          }
        }}
      >
        <DialogContent className="agenda-booking-dialog overflow-y-auto p-0">
          <DialogHeader className="agenda-booking-dialog-header">
            <div className="flex items-start gap-3 text-left">
              <div className="agenda-booking-dialog-icon">
                <Clock3 className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[var(--c-f1f2f4)]">
                  Novo agendamento
                </DialogTitle>
                <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                  Agendar Serviço às {form.time || "--:--"} —{" "}
                  {new Date(`${day}T12:00:00`)
                    .toLocaleDateString("pt-BR", { weekday: "long" })
                    .replace(/(^|\s)\w/g, (c) => c.toUpperCase())}
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="agenda-booking-dialog-body">
            <div className="agenda-booking-form-section space-y-5">
              <div className="space-y-2">
                <Label className="agenda-booking-label" htmlFor="etime">
                  Horário
                </Label>
                <Input
                  id="etime"
                  className="agenda-booking-input"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
              <div className="agenda-booking-duo grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="ename">
                    NOME DO CLIENTE
                  </Label>
                  <Input
                    id="ename"
                    className="agenda-booking-input"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    placeholder="Nome Cliente"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="ephone">
                    NÚMERO DO CLIENTE
                  </Label>
                  <Input
                    id="ephone"
                    className="agenda-booking-input"
                    inputMode="numeric"
                    value={formatPhoneBR(form.customer_phone)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        customer_phone: e.target.value.replace(/\D/g, "").slice(0, 11),
                      })
                    }
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="agenda-booking-label">SERVIÇO</Label>
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
              <div className="space-y-2">
                <Label className="agenda-booking-label">PROFISSIONAL</Label>
                <Select
                  value={form.professional_id}
                  onValueChange={(v) => setForm({ ...form, professional_id: v })}
                >
                  <SelectTrigger className="agenda-booking-input w-full">
                    <SelectValue placeholder="Agenda" />
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
            </div>
          </div>
          <DialogFooter className="agenda-booking-dialog-footer">
            <Button
              className="agenda-booking-primary-button"
              onClick={() => create.mutate()}
              disabled={!form.customer_name.trim() || !form.time || create.isPending}
            >
              Agendar
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
      {/* Botão de Encaixe — mesmo HTML/CSS de antes, apenas reposicionado:
          gruda (sticky) na parte de baixo da agenda, sempre visível.
          O FAB de suporte (z-40) fica sobre ele, uma camada acima (z-30). */}
      <div className="sticky bottom-3 z-30">
        <button
          type="button"
          onClick={() => {
            setForm({ ...emptyForm, time: "", professional_id: selectedProfessionalId ?? "" });
            setEncaixeMode(true);
            setEncaixeOpen(true);
          }}
          className="group relative isolate mt-2 flex h-[50.4px] w-full items-center justify-center rounded-[15px] border-[0.75px] border-[#6d5519]/70 bg-[radial-gradient(circle_at_22%_28%,rgba(224,175,45,0.18)_0%,rgba(128,92,20,0.08)_34%,transparent_66%),linear-gradient(100deg,#0c0b08_0%,#0b0b0a_60%,#0d0c09_100%)] px-4 text-[0.82rem] font-medium tracking-[-0.01em] text-[#f5f5f5] shadow-[inset_0_1px_0_rgba(255,222,129,0.035),0_0_18px_rgba(210,157,32,0.025)] transition-all duration-200 ease-in-out hover:border-[#8b6a1d]/75 hover:bg-[radial-gradient(circle_at_22%_28%,rgba(224,175,45,0.22)_0%,rgba(128,92,20,0.10)_34%,transparent_66%),linear-gradient(100deg,#0d0c09_0%,#0b0b0a_60%,#0d0c09_100%)] hover:shadow-[inset_0_1px_0_rgba(255,222,129,0.05),0_0_20px_rgba(210,157,32,0.035)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            aria-hidden="true"
            className="encaixe-border-beam pointer-events-none absolute inset-[-1px] z-20 rounded-[15px]"
          />
          <span className="relative z-10">Encaixe</span>
        </button>
      </div>
    </div>
  );
}
