import { MapPin } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { accessibleTextColor } from "@/lib/contrast";
import type { Panel1Appearance } from "@/lib/panel1-config";

/**
 * Componentes reais da página pública de agendamento, extraídos de agendar.$slug.tsx
 * para serem reusados também no editor de aparência — garante que a prévia do editor
 * seja pixel-igual ao que o cliente vê, não uma recriação aproximada (spec 006).
 */

export type PreviewService = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  effectiveDepositCents: number;
  show_price: boolean;
  show_duration: boolean;
};

const LOGO_FIT_CLASSES: Record<Panel1Appearance["logo_fit"], string> = {
  quadrado: "max-h-32 max-w-[72%]",
  horizontal: "max-h-20 max-w-[85%]",
  vertical: "max-h-44 max-w-[55%]",
};

export function BusinessHeader({
  name,
  logoUrl,
  address,
  appearance,
  onLogoClick,
}: {
  name: string;
  logoUrl: string | null;
  address: string | null;
  appearance: Panel1Appearance;
  /** Quando informado, o logo vira um botão próprio (ex.: trocar a foto no editor). */
  onLogoClick?: () => void;
}) {
  const logoFitClass = LOGO_FIT_CLASSES[appearance.logo_fit] ?? LOGO_FIT_CLASSES.quadrado;
  return (
    <div
      className="-mx-4 px-4 py-8 text-center"
      style={{ backgroundColor: appearance.header_background, color: appearance.header_title }}
    >
      {logoUrl && onLogoClick ? (
        <button
          type="button"
          aria-label="Trocar foto do negócio"
          onClick={(event) => {
            event.stopPropagation();
            onLogoClick();
          }}
          className="mx-auto block bg-transparent p-0"
        >
          <img
            src={logoUrl}
            alt={`Logotipo de ${name}`}
            decoding="async"
            fetchPriority="high"
            className={`mx-auto object-contain ${logoFitClass}`}
          />
        </button>
      ) : logoUrl ? (
        <img
          src={logoUrl}
          alt={`Logotipo de ${name}`}
          decoding="async"
          fetchPriority="high"
          className={`mx-auto object-contain ${logoFitClass}`}
        />
      ) : onLogoClick ? (
        <button
          type="button"
          aria-label="Trocar foto do negócio"
          onClick={(event) => {
            event.stopPropagation();
            onLogoClick();
          }}
          className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-xl font-bold"
        >
          {name.slice(0, 2).toUpperCase()}
        </button>
      ) : (
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-xl font-bold">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <h1 className="mt-4 text-xl font-semibold">{name}</h1>
      {address ? (
        <p className="mx-auto mt-2 flex max-w-md items-center justify-center gap-1.5 text-xs">
          <MapPin className="size-3.5 shrink-0" /> {address}
        </p>
      ) : null}
    </div>
  );
}

export function ServiceSection<S extends PreviewService>({
  services,
  onSelect,
  appearance,
  pageText,
}: {
  services: S[];
  onSelect: (service: S) => void;
  appearance: Panel1Appearance;
  pageText: string;
}) {
  const hoverTextColor = accessibleTextColor(appearance.service_hover_background);
  return (
    <section>
      <h2
        className="mb-3 text-center text-sm font-bold uppercase tracking-[0.16em]"
        style={{ color: pageText }}
      >
        Serviços
      </h2>
      {services.length === 0 ? (
        <p
          className="rounded-lg border border-dashed px-4 py-6 text-center text-sm"
          style={{ color: pageText, borderColor: appearance.service_border }}
        >
          Nenhum serviço cadastrado ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className="w-full rounded-lg border px-4 py-5 text-center transition-colors hover:bg-[var(--service-hover-background)] hover:text-[var(--service-hover-text)] hover:border-[var(--service-hover-border)]"
              style={
                {
                  backgroundColor: appearance.service_background,
                  color: appearance.service_text,
                  borderColor: appearance.service_border,
                  "--service-hover-background": appearance.service_hover_background,
                  "--service-hover-text": hoverTextColor,
                  "--service-hover-border": appearance.service_hover_border,
                } as React.CSSProperties
              }
            >
              <p className="text-base font-medium" style={{ color: appearance.service_name_text }}>
                {s.name}
              </p>
              {(s.show_price || s.show_duration) && (
                <p className="mt-2 text-sm" style={{ color: appearance.service_price_text }}>
                  {s.show_price ? formatPrice(s.price_cents) : null}
                  {s.show_price && s.show_duration ? " - " : null}
                  {s.show_duration ? `${s.duration_minutes}min` : null}
                </p>
              )}
              {s.effectiveDepositCents > 0 ? (
                <p
                  className="mt-2 text-xs font-semibold"
                  style={{ color: appearance.service_price_text }}
                >
                  Sinal de {formatPrice(s.effectiveDepositCents)}
                </p>
              ) : (
                <p className="mt-2 text-xs" style={{ color: appearance.service_text }}>
                  Sem sinal
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
