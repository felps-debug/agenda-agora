import { useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { accessibleTextColor } from "@/lib/contrast";
import { formatPrice } from "@/lib/format";
import type { Panel1Appearance } from "@/lib/panel1-config";
import type { PreviewService } from "./appearance-preview";

export type PreviewProfessional = { id: string; name: string; role?: string | null };

const previewDates = ["12/10", "13/10", "14/10", "15/10"];
const previewTimes = ["08:30", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30"];

/** Visual and interactive sample of the public booking dialog used by the appearance editor. */
export function BookingInformationPreview({
  appearance,
  service,
  professionals,
}: {
  appearance: Panel1Appearance;
  service: PreviewService;
  professionals: PreviewProfessional[];
}) {
  const [professionalId, setProfessionalId] = useState(professionals[0]?.id ?? "");
  const [date, setDate] = useState(previewDates[0]);
  const [time, setTime] = useState("");
  const text = accessibleTextColor(appearance.modal_background);
  const selectedText = accessibleTextColor(appearance.modal_active_background);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-3 sm:p-6">
      <section
        aria-label="Painel de informações"
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl border p-5 text-center shadow-2xl sm:p-6"
        style={{
          backgroundColor: appearance.modal_background,
          borderColor: appearance.modal_border,
          color: text,
        }}
      >
        <button
          type="button"
          aria-label="Fechar demonstração"
          className="float-right rounded-md p-1"
          style={{ color: text }}
        >
          <X className="size-5" />
        </button>
        {service.image_url ? (
          <img
            src={service.image_url}
            alt=""
            className="mx-auto mb-4 max-h-44 w-full rounded-lg object-cover"
          />
        ) : null}
        <h2 className="font-display text-xl font-bold">{service.name}</h2>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm">
          {service.show_price ? <span>{formatPrice(service.price_cents)}</span> : null}
          {service.show_price && service.show_duration ? <span>·</span> : null}
          {service.show_duration ? (
            <span>
              <Clock className="mr-1 inline size-3.5" />
              {service.duration_minutes}min
            </span>
          ) : null}
        </p>

        {professionals.length ? (
          <div className="mt-6">
            <p className="mb-3 text-sm font-semibold">Escolha o profissional</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {professionals.map((professional) => {
                const selected = professional.id === professionalId;
                return (
                  <button
                    key={professional.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setProfessionalId(professional.id);
                      setTime("");
                    }}
                    className="rounded-lg border p-3 text-left transition-colors"
                    style={{
                      backgroundColor: selected
                        ? appearance.modal_active_background
                        : appearance.modal_background,
                      borderColor: appearance.modal_border,
                      color: selected ? selectedText : text,
                    }}
                  >
                    <span className="block font-semibold">{professional.name}</span>
                    {professional.role ? (
                      <span className="mt-0.5 block text-xs">{professional.role}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold">Escolha a data</p>
          <div className="flex flex-wrap justify-center gap-2">
            {previewDates.map((value) => {
              const selected = value === date;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setDate(value);
                    setTime("");
                  }}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: selected
                      ? appearance.modal_active_background
                      : appearance.modal_background,
                    borderColor: appearance.modal_border,
                    color: selected ? selectedText : text,
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-3 text-sm font-semibold">Escolha um horário disponível</p>
          <div className="flex flex-wrap justify-center gap-2">
            {previewTimes.map((value) => {
              const selected = value === time;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTime(value)}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold"
                  style={{
                    backgroundColor: selected
                      ? appearance.modal_active_background
                      : appearance.modal_background,
                    borderColor: appearance.modal_border,
                    color: selected ? selectedText : text,
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          disabled={!time}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          style={{
            backgroundColor: appearance.modal_active_background,
            borderColor: appearance.modal_border,
            color: selectedText,
          }}
        >
          <Check className="size-4" /> Continuar
        </button>
      </section>
    </div>
  );
}
