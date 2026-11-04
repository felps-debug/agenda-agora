import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { Panel1Appearance } from "@/lib/panel1-config";
import { DialogContent } from "@/components/ui/dialog";

export type EleganceBookingService = {
  name: string;
  price_cents: number;
  duration_minutes: number;
  show_price: boolean;
  show_duration: boolean;
  description?: string | null;
  image_url?: string | null;
};

export type EleganceBookingProfessional = {
  id: string;
  name: string;
  role: string | null;
  /** URL assinada pelo servidor; null quando o profissional não tem foto. */
  avatar_url?: string | null;
};
export type EleganceBookingDay = { date: string; weekday: number };

const serif: CSSProperties = { fontFamily: "'Playfair Display', Georgia, serif" };

function ddmm(date: string) {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

/** "segunda-feira", como na referência. */
function weekdayLong(date: string) {
  const [y = 2026, m = "1", d = "1"] = date.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("pt-BR", {
    weekday: "long",
  });
}

function fullDate(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/**
 * Fluxo de agendamento do modelo "Elegance": clone da referência pastel,
 * com todas as cores vindo dos tokens editáveis do editor de aparência.
 */
/**
 * Seção do fluxo de agendamento que se revela de cima para baixo
 * (slide-down + fade-in) quando monta: data selecionada → profissional e
 * horário; horário selecionado → dados. Usa as classes do tw-animate-css
 * (`animate-in fade-in-50 slide-in-from-top-2`) com transição de 300ms.
 * O `overflow-hidden` fica ativo apenas durante a animação (removido no
 * animationend) para não cortar o popup de profissionais depois dela.
 */
function RevealSection({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  const [revealing, setRevealing] = useState(true);
  return (
    <section
      {...props}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setRevealing(false);
      }}
      className={`${className ?? ""} animate-in fade-in-50 slide-in-from-top-2 duration-300 animation-duration-300 ease-in-out transition-all ${
        revealing ? "overflow-hidden" : ""
      }`}
    >
      {children}
    </section>
  );
}

export function EleganceBookingDialog({
  asPreview = false,
  minimalist = false,
  service,
  appearance,
  pageBackground,
  modalText,
  modalActiveText,
  onClose,
  professionals,
  professional,
  onProfessionalChange,
  days,
  date,
  onDateSelect,
  time,
  onTimeSelect,
  slots,
  slotsLoading,
  slotsError,
  formName,
  onNameChange,
  formPhone,
  onPhoneChange,
  formEmail,
  onEmailChange,
  formCpfCnpj,
  onCpfCnpjChange,
  needsDocument,
  formError,
  pending,
  onSubmit,
  noteText,
}: {
  asPreview?: boolean;
  minimalist?: boolean;
  service: EleganceBookingService;
  appearance: Panel1Appearance;
  pageBackground: string;
  modalText: string;
  modalActiveText: string;
  onClose: () => void;
  professionals: EleganceBookingProfessional[];
  professional: EleganceBookingProfessional | null;
  onProfessionalChange: (professional: EleganceBookingProfessional | null) => void;
  days: EleganceBookingDay[];
  date: string | null;
  onDateSelect: (date: string) => void;
  time: string | null;
  onTimeSelect: (time: string) => void;
  slots: string[];
  slotsLoading: boolean;
  slotsError: boolean;
  formName: string;
  onNameChange: (value: string) => void;
  formPhone: string;
  onPhoneChange: (value: string) => void;
  formEmail: string;
  onEmailChange: (value: string) => void;
  formCpfCnpj: string;
  onCpfCnpjChange: (value: string) => void;
  needsDocument: boolean;
  formError: string | null;
  pending: boolean;
  onSubmit: () => void;
  noteText: string;
}) {
  const [page, setPage] = useState(0);
  const [professionalOpen, setProfessionalOpen] = useState(false);
  const professionalBoxRef = useRef<HTMLDivElement | null>(null);
  const hoverText = appearance.modal_hover_text;
  const cardBackground = appearance.modal_background;
  const cardBorder = appearance.service_border;
  const accent = appearance.modal_active_background;
  const gradientStart = appearance.page_gradient_start;
  const gradientEnd = appearance.page_gradient_end;

  // Grade 3×2, como na referência: até 6 dias por página.
  const daysPerPage = 6;
  const pageCount = Math.max(1, Math.ceil(days.length / daysPerPage));
  const pageDays = days.slice(page * daysPerPage, (page + 1) * daysPerPage);
  const showProfessional = !!date && professionals.length > 0;
  const showTimes = !!date && (professionals.length === 0 || !!professional);
  const showDetails = showTimes && !!date && !!time;

  const calendarBase = days[0]?.date ?? new Date().toISOString().slice(0, 10);
  const [calendarYear = new Date().getFullYear(), calendarMonth = new Date().getMonth() + 1] = calendarBase.split("-").map(Number);
  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
  const firstWeekday = new Date(calendarYear, calendarMonth - 1, 1).getDay();
  const calendarCells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) =>
    index < firstWeekday
      ? null
      : `${calendarYear}-${String(calendarMonth).padStart(2, "0")}-${String(index - firstWeekday + 1).padStart(2, "0")}`,
  );
  const calendarMonthLabel = new Date(calendarYear, calendarMonth - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const todayIso = new Date().toISOString().slice(0, 10);
  const minimalistCalendarText = "#252525";

  const avatarName = professional
    ? professional.name
    : professionals[0]
      ? professionals[0].name
      : "";

  // Fecha o seletor em clique fora e Esc.
  useEffect(() => {
    if (!professionalOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!professionalBoxRef.current?.contains(event.target as Node)) setProfessionalOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfessionalOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [professionalOpen]);

  const optionStyle = (selected: boolean): CSSProperties =>
    ({
      borderColor: selected ? "transparent" : cardBorder,
      backgroundColor: selected ? accent : cardBackground,
      color: selected ? modalActiveText : modalText,
      boxShadow: selected ? `0 7px 16px ${accent}30` : undefined,
      "--modal-hover-background": appearance.modal_hover_background,
      "--modal-hover-text": hoverText,
    }) as CSSProperties;

  const Container = asPreview ? "div" : DialogContent;
  return (
    <Container
      aria-label={`Agendar ${service.name}`}
      {...(asPreview ? {} : { overlayStyle: { animation: "none" } })}
      className={asPreview
        ? "max-w-[480px] rounded-[22px] border p-0 sm:rounded-[22px]"
        : "max-h-[92vh] max-w-[480px] overflow-y-auto rounded-[22px] border p-0 sm:rounded-[22px] [&>[data-slot='dialog-close']]:hidden"}
      style={
        {
          ...(asPreview
            ? {}
            : {
                animation: "enter 300ms ease-out both",
                "--tw-enter-opacity": "0",
                "--tw-enter-translate-x": "0px",
                "--tw-enter-translate-y": "24px",
              }),
          background: `radial-gradient(ellipse at 0 45%, ${gradientStart}59, transparent 55%), radial-gradient(ellipse at 100% 85%, ${gradientEnd}59, transparent 50%), ${appearance.infoPageBackground || pageBackground}`,
          color: modalText,
          borderColor: cardBorder,
        } as CSSProperties
      }
    >
      <div className="relative px-[30px] pb-11 pt-[62px]">
        <button
          type="button"
          aria-label="Voltar aos serviços"
          onClick={onClose}
          className="absolute left-6 top-5 flex size-[38px] cursor-pointer items-center justify-center rounded-full hover:opacity-85"
          style={{ backgroundColor: appearance.backButtonBackgroundColor, color: appearance.backButtonIconColor }}
        >
          <ChevronLeft className="size-[26px]" strokeWidth={2} />
        </button>

        {service.image_url ? (
          <img
            src={service.image_url}
            alt={service.name}
            className="mx-auto mb-6 block size-[160px] rounded-[27px] border-[5px] object-cover"
            style={{
              borderColor: appearance.selectedServiceBorderColor,
              boxShadow: `0 10px 28px ${accent}25`,
            }}
            loading="lazy"
            decoding="async"
          />
        ) : null}

        <div
          className="flex items-center justify-between gap-3 rounded-[22px] border p-5"
          style={{
            backgroundColor: `${cardBackground}b8`,
            borderColor: cardBorder,
            boxShadow: `0 10px 26px ${accent}1a`,
          }}
        >
          <div className="min-w-0">
            <h1
              className="m-0 truncate text-[24px] leading-snug font-medium"
              style={{ ...serif, color: appearance.service_name_text }}
            >
              {service.name}
            </h1>
            {service.show_price || service.show_duration ? (
              <p
                className="m-0 mt-2 flex items-center gap-1.5 text-[15px]"
                style={{ color: appearance.service_price_text }}
              >
                <Clock className="size-[17px] shrink-0" strokeWidth={1.7} />
                {[
                  service.show_duration ? `${service.duration_minutes} min` : null,
                  service.show_price ? formatPrice(service.price_cents) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Remover serviço e voltar"
            onClick={onClose}
            className="cursor-pointer border-0 bg-transparent p-2 text-[26px] leading-none hover:opacity-70"
            style={{ color: appearance.wave_color }}
          >
            ×
          </button>
        </div>

        <section aria-labelledby="bf-date" className="mt-7">
          <h2
            id="bf-date"
            className="m-0 mb-3.5 text-[15px] font-medium"
            style={{ color: modalText, opacity: 0.75 }}
          >
            Escolha a data
          </h2>
          {days.length === 0 ? (
            <p
              className="rounded-[15px] border p-4 text-sm"
              style={{ borderColor: cardBorder, backgroundColor: `${cardBackground}b8` }}
            >
              Nenhum dia de atendimento está disponível no momento.
            </p>
          ) : minimalist ? (
            <div
              className="rounded-[15px] border p-3"
              style={{ backgroundColor: "#ffffff", borderColor: "#e8e8e8" }}
            >
              <div className="mb-3 flex items-center justify-between px-1 text-[16px] font-medium capitalize" style={{ color: minimalistCalendarText }}>
                <button type="button" aria-label="Mês anterior" className="rounded-full px-2 py-1 opacity-50" disabled>‹</button>
                <span>{calendarMonthLabel}</span>
                <button type="button" aria-label="Próximo mês" className="rounded-full px-2 py-1 opacity-50" disabled>›</button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[13px]" style={{ color: minimalistCalendarText }}>
                {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((weekday) => (
                  <span key={weekday} className="py-1 opacity-60">{weekday}</span>
                ))}
                {calendarCells.map((cell, index) => {
                  const available = !!cell && days.some((day) => day.date === cell);
                  const selected = cell === date;
                  const today = cell === todayIso;
                  return (
                    <button
                      key={cell ?? `empty-${index}`}
                      type="button"
                      disabled={!available}
                      aria-pressed={selected}
                      onClick={() => cell && available && onDateSelect(cell)}
                      className="min-h-10 rounded-md border text-[15px] transition-colors disabled:cursor-default"
                      style={selected
                        ? optionStyle(true)
                        : {
                            color: available ? accent : `${minimalistCalendarText}55`,
                            borderColor: today ? accent : "transparent",
                            backgroundColor: "transparent",
                            borderWidth: "1px",
                          }}
                    >
                      {cell ? Number(cell.slice(-2)) : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="-mx-5 flex items-center gap-2">
              <button
                type="button"
                aria-label="Datas anteriores"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                className="w-4 shrink-0 cursor-pointer border-0 bg-transparent p-0 disabled:opacity-25"
                style={{ color: modalText }}
              >
                <ChevronLeft className="size-6" strokeWidth={2} />
              </button>
              <div className="grid flex-1 grid-cols-3 gap-2.5">
                {pageDays.map((day) => {
                  const selected = date === day.date;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      aria-pressed={selected}
                      data-date={day.date}
                      onClick={() => onDateSelect(day.date)}
                      className="flex min-h-[58px] flex-col items-center justify-center rounded-[15px] border px-1 py-2.5 text-center"
                      style={optionStyle(selected)}
                    >
                      <strong className="block text-[19px] leading-tight font-medium">
                        {ddmm(day.date)}
                      </strong>
                      <span className="mt-1 block text-[11px] leading-tight">
                        {weekdayLong(day.date)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                aria-label="Próximas datas"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((current) => current + 1)}
                className="w-4 shrink-0 cursor-pointer border-0 bg-transparent p-0 disabled:opacity-25"
                style={{ color: modalText }}
              >
                <ChevronRight className="size-6" strokeWidth={2} />
              </button>
            </div>
          )}
        </section>

        {showProfessional || showTimes ? (
          <RevealSection aria-labelledby="bf-person" className="mt-6">
            <h2
              id="bf-person"
              className="m-0 mb-3.5 text-[15px] font-medium"
              style={{ color: modalText, opacity: 0.75 }}
            >
              {showProfessional ? "Profissional e horário" : "Horário"}
            </h2>
            {showProfessional ? (
            <div
              ref={professionalBoxRef}
              className="relative mb-5"
            >
              <div
                className="flex items-center gap-3 rounded-[22px] border p-3.5"
                style={{ backgroundColor: `${cardBackground}cc`, borderColor: cardBorder }}
              >
                {professional?.avatar_url ? (
                  <img
                    src={professional.avatar_url}
                    alt=""
                    className="size-12 shrink-0 rounded-full object-cover"
                    style={{ border: `2px solid ${cardBorder}` }}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid size-12 shrink-0 place-items-center rounded-full text-lg"
                    style={{ backgroundColor: gradientStart, color: accent, ...serif }}
                  >
                    {initials(avatarName)}
                  </span>
                )}
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={professionalOpen}
                  onClick={() => setProfessionalOpen((v) => !v)}
                  className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                >
                  <span className="block text-[11px]" style={{ color: modalText, opacity: 0.75 }}>
                    Selecione o profissional
                  </span>
                  <span className="flex items-center justify-between gap-2 pt-0.5">
                    <span
                      className="truncate text-[20px]"
                      style={{ ...serif, color: appearance.service_name_text }}
                    >
                      {professional?.name ?? "Escolher profissional"}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`shrink-0 ${professionalOpen ? "rotate-180" : ""}`}
                      style={{ color: modalText, opacity: 0.75 }}
                    >
                      <ChevronDown className="size-4" />
                    </span>
                  </span>
                  <small
                    className="mt-0.5 block truncate text-[11px]"
                    style={{ color: modalText, opacity: 0.55 }}
                  >
                    {professional?.role?.trim()
                      ? professional.role
                      : professionals.length > 1
                        ? `${professionals.length} profissionais disponíveis`
                        : "Profissional disponível"}
                  </small>
                </button>
              </div>

              {professionalOpen ? (
                <ul
                  role="listbox"
                  aria-label="Profissionais"
                  className="absolute inset-x-0 top-[calc(100%-6px)] z-20 m-0 list-none overflow-hidden rounded-[22px] border p-1.5"
                  style={{
                    backgroundColor: cardBackground,
                    borderColor: cardBorder,
                    boxShadow: `0 14px 34px ${accent}33`,
                  }}
                >
                  {professionals.map((p) => {
                    const selected = professional?.id === p.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            onProfessionalChange(p);
                            setProfessionalOpen(false);
                          }}
                          className={`flex w-full cursor-pointer items-center gap-3 rounded-[16px] border-0 p-2.5 text-left ${
                            selected
                              ? "bg-[var(--modal-hover-background)]"
                              : "hover:bg-[var(--modal-hover-background)]"
                          }`}
                          style={
                            {
                              color: modalText,
                              "--modal-hover-background": appearance.modal_hover_background,
                              "--modal-hover-text": hoverText,
                            } as CSSProperties
                          }
                        >
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt=""
                              className="size-10 shrink-0 rounded-full object-cover"
                              style={{ border: `2px solid ${cardBorder}` }}
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="grid size-10 shrink-0 place-items-center rounded-full text-base"
                              style={{ backgroundColor: gradientStart, color: accent, ...serif }}
                            >
                              {initials(p.name)}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span
                              className="block truncate text-[17px]"
                              style={{ ...serif, color: appearance.service_name_text }}
                            >
                              {p.name}
                            </span>
                            {p.role?.trim() ? (
                              <small
                                className="block truncate text-[11px]"
                                style={{ color: modalText, opacity: 0.55 }}
                              >
                                {p.role}
                              </small>
                            ) : null}
                          </span>
                          {selected ? (
                            <span aria-hidden="true" className="shrink-0" style={{ color: accent }}>
                              <Check className="size-4" strokeWidth={2.5} />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
            ) : null}

            {slotsLoading ? (
              <p className="flex items-center justify-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> Carregando horários...
              </p>
            ) : slotsError ? (
              <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
                Não foi possível carregar os horários. Atualize a página e tente novamente.
              </p>
            ) : slots.length === 0 ? (
              <p className="rounded-lg border p-4 text-sm" style={{ borderColor: cardBorder }}>
                Sem horários futuros neste dia. Escolha outra data.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2.5 animate-in fade-in-50 slide-in-from-top-2 duration-300 animation-duration-300 ease-in-out">
                {slots.map((slot) => {
                  const selected = time === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      aria-pressed={selected}
                      data-time={slot}
                      onClick={() => onTimeSelect(slot)}
                      className="min-h-[40px] rounded-[15px] border px-1 py-2 text-[15px] font-medium"
                      style={optionStyle(selected)}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </RevealSection>
        ) : null}

        {showDetails ? (
          <RevealSection
            aria-labelledby="bf-details"
            className="mt-6 rounded-[22px] border p-5"
            style={{
              backgroundColor: `${cardBackground}b8`,
              borderColor: cardBorder,
              boxShadow: `0 10px 26px ${accent}1a`,
            }}
          >
            <h2
              id="bf-details"
              className="m-0 mb-4 text-[22px] leading-snug font-medium"
              style={{ ...serif, color: appearance.service_name_text }}
            >
              Seus dados para agendar
            </h2>
            <dl className="m-0 mb-5 text-sm">
              <div className="flex justify-between gap-3 py-1.5">
                <dt className="shrink-0" style={{ color: modalText, opacity: 0.6 }}>
                  Serviço
                </dt>
                <dd className="m-0 text-right">{service.name}</dd>
              </div>
              {professional ? (
                <div className="flex justify-between gap-3 py-1.5">
                  <dt className="shrink-0" style={{ color: modalText, opacity: 0.6 }}>
                    Profissional
                  </dt>
                  <dd className="m-0 text-right">{professional.name}</dd>
                </div>
              ) : null}
              {service.show_price ? (
                <div className="flex justify-between gap-3 py-1.5">
                  <dt className="shrink-0" style={{ color: modalText, opacity: 0.6 }}>
                    Valor
                  </dt>
                  <dd className="m-0 text-right">{formatPrice(service.price_cents)}</dd>
                </div>
              ) : null}
              {date ? (
                <div className="flex justify-between gap-3 py-1.5">
                  <dt className="shrink-0" style={{ color: modalText, opacity: 0.6 }}>
                    Data e horário
                  </dt>
                  <dd className="m-0 text-right">
                    {[fullDate(date), ...(time ? [time] : [])].join(" · ")}
                  </dd>
                </div>
              ) : null}
            </dl>

            {formError ? (
              <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs" style={{ color: modalText }}>
                Nome e sobrenome
                <input
                  id="elegance-nome"
                  autoComplete="name"
                  placeholder="Seu nome completo"
                  maxLength={80}
                  value={formName}
                  onChange={(event) => onNameChange(event.target.value)}
                  className="mt-1.5 block w-full rounded-xl border px-2.5 py-3 text-sm focus:outline-none"
                  style={{ borderColor: cardBorder, backgroundColor: cardBackground, color: modalText }}
                />
              </label>
              <label className="block text-xs" style={{ color: modalText }}>
                Telefone
                <input
                  id="elegance-fone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  maxLength={20}
                  value={formPhone}
                  onChange={(event) => onPhoneChange(event.target.value)}
                  className="mt-1.5 block w-full rounded-xl border px-2.5 py-3 text-sm focus:outline-none"
                  style={{ borderColor: cardBorder, backgroundColor: cardBackground, color: modalText }}
                />
              </label>
              {needsDocument ? (
                <>
                  <label className="block text-xs sm:col-span-2" style={{ color: modalText }}>
                    E-mail
                    <input
                      id="elegance-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="cliente@exemplo.com"
                      value={formEmail}
                      onChange={(event) => onEmailChange(event.target.value)}
                      className="mt-1.5 block w-full rounded-xl border px-2.5 py-3 text-sm focus:outline-none"
                      style={{ borderColor: cardBorder, backgroundColor: cardBackground, color: modalText }}
                    />
                  </label>
                  <label className="block text-xs sm:col-span-2" style={{ color: modalText }}>
                    CPF ou CNPJ
                    <input
                      id="elegance-cpf"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={formCpfCnpj}
                      onChange={(event) => onCpfCnpjChange(event.target.value)}
                      className="mt-1.5 block w-full rounded-xl border px-2.5 py-3 text-sm focus:outline-none"
                      style={{ borderColor: cardBorder, backgroundColor: cardBackground, color: modalText }}
                    />
                  </label>
                </>
              ) : null}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed" style={{ color: modalText, opacity: 0.6 }}>
              {noteText}
            </p>

            <button
              type="button"
              onClick={onSubmit}
              disabled={pending}
              className="mt-4 w-full cursor-pointer rounded-[14px] border-0 py-3.5 font-semibold disabled:opacity-60"
              style={{ backgroundColor: accent, color: appearance.modal_active_text }}
            >
              {pending ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Agendando...
                </span>
              ) : (
                "Agendar"
              )}
            </button>
          </RevealSection>
        ) : null}
      </div>
    </Container>
  );
}
