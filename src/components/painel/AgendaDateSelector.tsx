import { useMemo, useRef } from "react";
import { toDateInput } from "@/lib/format";

const SHORT_DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"] as const;

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const weekdayLongFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });

function formatDayLabel(d: Date) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${weekdayLongFormat.format(d)}, ${day}/${month}/${d.getFullYear()}`;
}

function dateKey(d: Date) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function parseDay(value: string): Date {
  if (!value) return new Date();
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return new Date();
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function AgendaDateSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = useMemo(() => parseDay(value), [value]);
  const inputRef = useRef<HTMLInputElement>(null);

  const weekStart = useMemo(() => startOfWeek(selected), [selected]);

  const weekDays = useMemo(() => {
    const full: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      full.push(d);
    }
    // Tira com 6 dias para folgar no Android: se o selecionado for o
    // último (domingo), descarta o primeiro; senão, descarta o último.
    const last = new Date(weekStart);
    last.setDate(last.getDate() + 6);
    return sameDay(last, selected) ? full.slice(1) : full.slice(0, 6);
  }, [weekStart, selected]);

  const selectDate = (d: Date) => {
    onChange(toDateInput(d));
  };

  const shiftWeek = (delta: number) => {
    const next = new Date(selected);
    next.setDate(next.getDate() + delta);
    selectDate(next);
  };
  const openNativePicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") el.showPicker();
      else {
        el.focus();
        el.click();
      }
    } catch {
      el.focus();
    }
  };
  return (
    <div className="agenda-date-selector" aria-label="Seletor de data da Agenda Agora">
      <section className="ads-week-nav" aria-label="Escolher dia da semana">
        <button
          type="button"
          className="ads-arrow ads-prev"
          onClick={() => shiftWeek(-7)}
          aria-label="Semana anterior"
        >
          <svg viewBox="0 0 24 24">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {weekDays.map((d) => {
          const isSelected = sameDay(d, selected);
          const isToday = sameDay(d, new Date());
          return (
            <button
              key={dateKey(d)}
              type="button"
              className={`ads-day${isSelected ? " ads-selected" : ""}${isToday ? " ads-today" : ""}`}
              aria-pressed={isSelected}
              aria-label={formatDayLabel(d)}
              onClick={() => selectDate(d)}
            >
              <span className="ads-num">{d.getDate()}</span>
              <span className="ads-dow">{SHORT_DAYS[d.getDay()] ?? ""}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="ads-arrow ads-next"
          onClick={() => shiftWeek(7)}
          aria-label="Próxima semana"
        >
          <svg viewBox="0 0 24 24">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </section>

      <div className="ads-tools">
        <div className="ads-calendar-wrap">
          <label className="ads-open-calendar ads-native-wrap">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
              <path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
            </svg>
            <input
              ref={inputRef}
              type="date"
              className="ads-native-date"
              value={value}
              onChange={(event) => {
                if (event.target.value) onChange(event.target.value);
              }}
              aria-label="Escolher data"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
