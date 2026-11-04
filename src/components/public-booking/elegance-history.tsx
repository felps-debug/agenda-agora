import { useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  CalendarCheck,
  Check,
  ChevronDown,
  DollarSign,
  History,
  Info,
  Undo2,
  User,
  X,
} from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { Panel1Appearance } from "@/lib/panel1-config";
import { getAvailability } from "@/lib/booking.functions";

const sans: CSSProperties = {
  fontFamily:
    "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

export type EleganceHistoryBooking = {
  publicCode: string | null;
  chargeId: string | null;
  chargeStatus: string;
  amountCents: number;
  appointmentStatus: string;
  startsAt: string | null;
  createdAt: string;
  serviceName: string;
  professionalName: string;
  serviceId: string | null;
};

type StatusVisual = {
  label: "Confirmado" | "Aguardando pagamento" | "Cancelado";
  icon: typeof Check;
};

function statusVisual(b: EleganceHistoryBooking): StatusVisual {
  if (b.appointmentStatus === "cancelado") return { label: "Cancelado", icon: X };
  if (b.chargeStatus === "sem_sinal" || b.chargeStatus === "pago")
    return { label: "Confirmado", icon: CalendarCheck };
  if (b.chargeStatus === "pendente")
    return { label: "Aguardando pagamento", icon: CalendarCheck };
  return { label: "Cancelado", icon: X };
}

/**
 * Aba "Meus agendamentos" do modelo Elegance: tabs em cápsula, cards resumidos
 * expansíveis com foto do serviço, selo de status, carta detalhada com linha
 * do tempo e ações reais (pagar, cancelar, remarcar). Cores editáveis via tokens.
 */
export function EleganceHistoryList({
  slug,
  bookings,
  appearance,
  modalText,
  timezone,
  serviceImageUrl,
  cancellationEnabled,
  rescheduleEnabled,
  cancelPending,
  reschedulePending,
  onCancel,
  onReschedule,
  onOpenCharge,
}: {
  slug: string;
  bookings: EleganceHistoryBooking[];
  appearance: Panel1Appearance;
  modalText: string;
  timezone: string;
  /** Foto do serviço pelo id; null quando o serviço não tem imagem. */
  serviceImageUrl: (serviceId: string | null) => string | null;
  cancellationEnabled: boolean;
  rescheduleEnabled: boolean;
  cancelPending: boolean;
  reschedulePending: boolean;
  onCancel: (publicCode: string) => void;
  onReschedule: (input: { publicCode: string; date: string; time: string }) => Promise<void>;
  onOpenCharge: (chargeId: string) => void;
}) {
  const [filter, setFilter] = useState<"todos" | "proximos">("todos");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const accent = appearance.modal_active_background;
  const cardBackground = appearance.modal_background;
  const cardBorder = appearance.service_border;

  const visible = useMemo(() => {
    const rows = [...bookings];
    rows.sort((a, b) => (a.startsAt ?? a.createdAt).localeCompare(b.startsAt ?? b.createdAt));
    if (filter === "proximos") {
      const now = Date.now();
      return rows.filter(
        (b) =>
          b.appointmentStatus !== "cancelado" &&
          !!b.startsAt &&
          new Date(b.startsAt).getTime() >= now,
      );
    }
    return rows;
  }, [bookings, filter]);

  // Rótulos "OUTUBRO 2026" agrupados na ordem em que aparecem.
  const groups = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: timezone,
    });
    const result: Array<{ key: string; label: string; items: EleganceHistoryBooking[] }> = [];
    const index = new Map<string, number>();
    for (const booking of visible) {
      const date = booking.startsAt ?? booking.createdAt;
      const label = formatter.format(new Date(date)).toUpperCase().replace(" DE ", " ");
      let at = index.get(label);
      if (at === undefined) {
        at = result.length;
        index.set(label, at);
        result.push({ key: label, label, items: [] });
      }
      result[at]!.items.push(booking);
    }
    return result;
  }, [visible, timezone]);

  const shortDate = (booking: EleganceHistoryBooking) =>
    booking.startsAt
      ? new Date(booking.startsAt).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: timezone,
        })
      : "—";

  // Formato da referência no detalhe: "Terça-feira 20/10 às 10:30".
  const detailDate = (booking: EleganceHistoryBooking) => {
    if (!booking.startsAt) return "—";
    const weekday = new Date(booking.startsAt)
      .toLocaleDateString("pt-BR", { weekday: "long", timeZone: timezone });
    const day = new Date(booking.startsAt)
      .toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: timezone });
    const time = new Date(booking.startsAt)
      .toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} às ${time}`;
  };

  const iconTone = { color: accent } as CSSProperties;

  return (
    <div style={sans}>
      {/* Tabs em cápsula: Todos / Próximos */}
      <div
        className="relative z-10 mt-3 w-full rounded-full border p-1 shadow-sm flex items-center justify-between"
        style={{ backgroundColor: cardBackground, borderColor: cardBorder }}
        role="tablist"
        aria-label="Filtro de agendamentos"
      >
        {(
          [
            { key: "todos" as const, label: "Todos" },
            { key: "proximos" as const, label: "Próximos" },
          ]
        ).map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.key)}
              className="w-1/2 rounded-full py-3 px-4 flex items-center justify-center text-base font-semibold"
              style={{
                backgroundColor: active ? accent : "transparent",
                color: active ? appearance.modal_active_text : accent,
                opacity: active ? 1 : 0.85,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <p
        className="mt-3 mb-1 text-center text-[10px]"
        style={{ color: modalText, opacity: 0.5 }}
      >
        {visible.length === 0
          ? "Nenhum agendamento"
          : visible.length === 1
            ? "1 agendamento"
            : `${visible.length} agendamentos`}
      </p>

      {visible.length === 0 ? (
        <div
          className="mt-5 flex flex-col items-center rounded-2xl border p-8 text-center"
          style={{ backgroundColor: cardBackground, borderColor: cardBorder, color: modalText }}
        >
          <History className="size-7" style={iconTone} />
          <p className="mt-3 font-semibold">Nenhum agendamento por aqui ainda.</p>
          <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>
            Seus agendamentos feitos neste aparelho aparecerão aqui.
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h2
              className="mt-6 mb-3 text-[15px] font-bold tracking-wide"
              style={{ color: appearance.wave_color }}
            >
              {group.label}
            </h2>
            <div className="space-y-3">
              {group.items.map((booking) => {
                const key = booking.publicCode ?? booking.chargeId ?? booking.createdAt;
                const collapsed = expandedCode !== key;
                const status = statusVisual(booking);
                const canceled = booking.appointmentStatus === "cancelado";
                const image = serviceImageUrl(booking.serviceId);
                return (
                  <article
                    key={key}
                    className="relative"
                    style={{ color: modalText }}
                  >
                    {/* Card resumido */}
                    <div
                      className="flex items-center gap-3 rounded-2xl border p-3"
                      style={{
                        backgroundColor: cardBackground,
                        borderColor: cardBorder,
                        boxShadow: `0 10px 26px ${accent}14`,
                      }}
                    >
                      {image ? (
                        <img
                          src={image}
                          alt=""
                          className="h-[84px] w-[100px] shrink-0 rounded-xl object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="grid h-[84px] w-[100px] shrink-0 place-items-center rounded-xl"
                          style={{
                            background: `linear-gradient(145deg, ${appearance.page_gradient_start}, ${appearance.page_gradient_end})`,
                          }}
                        >
                          <User
                            className="size-8"
                            style={{ color: appearance.modal_active_text }}
                          />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className="m-0 truncate text-[15px] font-semibold"
                          style={{ color: appearance.service_name_text }}
                        >
                          {booking.serviceName}
                        </p>
                        <p
                          className="m-0 mt-1 flex items-center gap-1.5 truncate text-xs"
                          style={{ color: modalText, opacity: 0.75 }}
                        >
                          <User className="size-3.5 shrink-0" style={iconTone} />
                          {booking.professionalName}
                        </p>
                        <p
                          className="m-0 mt-0.5 flex items-center gap-1.5 truncate text-xs"
                          style={{ color: modalText, opacity: 0.75 }}
                        >
                          <CalendarDays className="size-3.5 shrink-0" style={iconTone} />
                          {shortDate(booking)}
                        </p>
                        <span
                          className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                          style={{
                            borderColor: canceled
                              ? "rgba(0,0,0,0.12)"
                              : `${accent}4D`,
                            backgroundColor: canceled ? "transparent" : `${accent}1A`,
                            color: canceled ? modalText : accent,
                          }}
                        >
                          <status.icon className="size-3.5" />
                          {status.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? "Detalhes do agendamento" : "Recolher detalhes"}
                        onClick={() => setExpandedCode(collapsed ? key : null)}
                        className="cursor-pointer border-0 bg-transparent p-1.5"
                        style={{ color: modalText, opacity: 0.6 }}
                      >
                        <ChevronDown
                          className={`size-5 transition-transform duration-300 ease-in-out ${collapsed ? "" : "rotate-180"}`}
                        />
                      </button>
                    </div>

                    {/* Card detalhado com linha do tempo */}
                    <div
                      className={`grid overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
                    >
                      <div
                        className={`overflow-hidden ${
                          collapsed
                            ? ""
                            : "animate-in fade-in-50 slide-in-from-top-2 duration-300 animation-duration-300 ease-in-out"
                        }`}
                      >
                        <div
                          className="mt-2 rounded-2xl border-2 p-3.5 pb-8"
                        style={{
                          borderColor: `${accent}59`,
                          backgroundColor: cardBackground,
                          boxShadow: `0 10px 26px ${accent}14`,
                        }}
                      >
                        <div
                          className="rounded-xl border p-3"
                          style={{ borderColor: cardBorder }}
                        >
                          <p
                            className="m-0 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide"
                            style={{ color: appearance.service_name_text }}
                          >
                            <Info className="size-4 shrink-0" style={iconTone} />
                            <span className="truncate">{booking.serviceName}</span>
                          </p>
                          <p
                            className="m-0 mt-2 flex items-center gap-2 text-[13px]"
                            style={{ color: modalText }}
                          >
                            <CalendarDays className="size-4 shrink-0" style={iconTone} />
                            <span className="truncate">{detailDate(booking)}</span>
                          </p>
                          <p
                            className="m-0 mt-2 flex items-center gap-2 text-[13px]"
                            style={{ color: modalText }}
                          >
                            <User className="size-4 shrink-0" style={iconTone} />
                            <span className="truncate">
                              Profissional {booking.professionalName}
                            </span>
                          </p>
                        </div>

                        <Timeline
                          booking={booking}
                          accent={accent}
                          activeIconColor={appearance.modal_active_text}
                          labelColor={`${modalText}99`}
                        />

                        <EleganceHistoryActions
                          slug={slug}
                          booking={booking}
                          accent={accent}
                          accentText={appearance.modal_active_text}
                          modalText={modalText}
                          cardBorder={cardBorder}
                          cancellationEnabled={cancellationEnabled}
                          rescheduleEnabled={rescheduleEnabled}
                          pending={cancelPending || reschedulePending}
                          onCancel={onCancel}
                          onReschedule={onReschedule}
                          onOpenCharge={onOpenCharge}
                        />

                        {booking.publicCode ? (
                          <p
                            className="mt-2 text-[10px]"
                            style={{ color: modalText, opacity: 0.45 }}
                          >
                            Código {booking.publicCode}
                          </p>
                        ) : null}

                        {/* Botão circular de fechar no canto inferior direito */}
                        <button
                          type="button"
                          aria-label="Recolher detalhes"
                          onClick={() => setExpandedCode(null)}
                          className="absolute bottom-[-14px] right-3 z-10 grid size-9 cursor-pointer place-items-center rounded-full border shadow-sm"
                          style={{
                            backgroundColor: appearance.service_background,
                            borderColor: cardBorder,
                            color: appearance.service_text,
                          }}
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

/** Linha do tempo: círculos interligados com rótulos, como na referência. */
function Timeline({
  booking,
  accent,
  activeIconColor,
  labelColor,
}: {
  booking: EleganceHistoryBooking;
  accent: string;
  activeIconColor: string;
  labelColor: string;
}) {
  const canceled = booking.appointmentStatus === "cancelado";
  const steps: Array<{ icon: typeof Check; label: string; filled: boolean }> = [
    { icon: Undo2, label: "Agendamento Cadastrado", filled: true },
  ];
  if (canceled) {
    steps.push({ icon: DollarSign, label: "Aguardando Pagamento", filled: false });
    steps.push({ icon: X, label: "Agendamento Cancelado", filled: false });
  } else if (booking.chargeStatus === "pendente") {
    steps.push({ icon: DollarSign, label: "Aguardando Pagamento", filled: true });
  } else {
    steps.push({ icon: Check, label: "Pagamento Confirmado", filled: true });
  }

  return (
    <div className="relative mt-5 px-1">
      <div
        aria-hidden="true"
        className="absolute left-8 right-8 top-[18px] h-px"
        style={{ backgroundColor: `${accent}40` }}
      />
      <div className="relative flex items-start justify-between gap-1">
        {steps.map((step) => (
          <div key={step.label} className="flex w-16 flex-col items-center text-center">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full"
              style={{
                backgroundColor: step.filled ? accent : `${accent}26`,
                color: step.filled ? activeIconColor : accent,
                border: step.filled ? "none" : `1px solid ${accent}59`,
              }}
            >
              <step.icon className="size-4" strokeWidth={2} />
            </span>
            <span
              className="mt-1.5 text-[10px] leading-tight"
              style={{ color: labelColor }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ações reais dentro do card detalhado: pagar, cancelar e remarcar. */
function EleganceHistoryActions({
  slug,
  booking,
  accent,
  accentText,
  modalText,
  cardBorder,
  cancellationEnabled,
  rescheduleEnabled,
  pending,
  onCancel,
  onReschedule,
  onOpenCharge,
}: {
  slug: string;
  booking: EleganceHistoryBooking;
  accent: string;
  accentText: string;
  modalText: string;
  cardBorder: string;
  cancellationEnabled: boolean;
  rescheduleEnabled: boolean;
  pending: boolean;
  onCancel: (publicCode: string) => void;
  onReschedule: (input: { publicCode: string; date: string; time: string }) => Promise<void>;
  onOpenCharge: (chargeId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const availabilityFn = useServerFn(getAvailability);
  const slots = useQuery({
    queryKey: [
      "elegance-reschedule-slots",
      slug,
      booking.serviceId,
      booking.publicCode,
      date,
    ],
    enabled: !!booking.serviceId && !!date,
    queryFn: () =>
      availabilityFn({
        data: {
          slug,
          serviceId: booking.serviceId!,
          date,
          professionalId: null,
        },
      }),
  });

  const active = booking.appointmentStatus === "agendado";
  const canCancel = cancellationEnabled && active && !!booking.publicCode;
  const canReschedule = rescheduleEnabled && active && !!booking.publicCode;
  if (!canCancel && !canReschedule && !(booking.chargeStatus === "pendente" && booking.chargeId))
    return null;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {booking.chargeStatus === "pendente" && booking.chargeId ? (
          <button
            type="button"
            onClick={() => onOpenCharge(booking.chargeId!)}
            className="min-w-0 flex-1 cursor-pointer rounded-full border-0 px-4 py-2.5 text-sm font-semibold hover:opacity-95"
            style={{ backgroundColor: accent, color: accentText }}
          >
            Pagar sinal de {formatPrice(booking.amountCents)}
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              onCancel(booking.publicCode!);
            }}
            className="cursor-pointer rounded-full border bg-transparent px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: cardBorder, color: modalText }}
          >
            Cancelar
          </button>
        ) : null}
        {canReschedule ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setDate("");
              setTime("");
              setEditing(!editing);
            }}
            className="cursor-pointer rounded-full border bg-transparent px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: cardBorder, color: modalText }}
          >
            Remarcar
          </button>
        ) : null}
      </div>

      {editing && canReschedule ? (
        <form
          className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!date || !time) return;
            try {
              await onReschedule({ publicCode: booking.publicCode!, date, time });
              setEditing(false);
            } catch {
              // O erro já é comunicado pelo toast da mutation.
            }
          }}
        >
          <label className="block grid-cols-none text-xs" style={{ color: modalText }}>
            Nova data
            <input
              type="date"
              required
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setTime("");
              }}
              className="mt-1 block w-full rounded-full border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: cardBorder, color: modalText }}
            />
          </label>
          <select
            aria-label="Novo horário"
            required
            value={time}
            disabled={!date || slots.isFetching}
            onChange={(event) => setTime(event.target.value)}
            className="rounded-full border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: cardBorder, color: modalText }}
          >
            <option value="" disabled>
              {!date ? "Escolha a data" : slots.isFetching ? "Carregando..." : slots.data?.slots.length ? "Selecione" : "Sem horários"}
            </option>
            {slots.data?.slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || !date || !time}
            className="cursor-pointer rounded-full border-0 px-4 py-2.5 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
            style={{ backgroundColor: accent, color: accentText }}
          >
            Confirmar
          </button>
        </form>
      ) : null}
    </div>
  );
}
