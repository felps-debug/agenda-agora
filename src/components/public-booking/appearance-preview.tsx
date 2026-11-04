import { useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { accessibleTextColor } from "@/lib/contrast";
import type { Panel1Appearance } from "@/lib/panel1-config";

export type AppearanceSelectionTarget =
  | "page-background"
  | "header-background"
  | "service-background"
  | "logo-cover"
  | "service-images"
  | "business-title"
  | "service-name"
  | "service-price"
  | "brand-tagline"
  | "wave-color"
  | "page-text"
  | "buttons";

export type PreviewService = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  effectiveDepositCents: number;
  show_price: boolean;
  show_duration: boolean;
  image_url?: string | null;
};

const LOGO_FIT_CLASSES: Record<Panel1Appearance["logo_fit"], string> = {
  quadrado: "max-h-44 max-w-[78%]",
  horizontal: "max-h-24 max-w-[85%]",
  vertical: "max-h-56 max-w-[55%]",
};

export function BusinessHeader({
  name,
  logoUrl,
  appearance,
  onLogoClick,
  onAppearanceTargetSelect,
}: {
  name: string;
  logoUrl: string | null;
  address?: string | null;
  appearance: Panel1Appearance;
  onLogoClick?: () => void;
  onAppearanceTargetSelect?: ((target: AppearanceSelectionTarget) => void) | undefined;
}) {
  const logoFitClass = LOGO_FIT_CLASSES[appearance.logo_fit] ?? LOGO_FIT_CLASSES.quadrado;
  const selectLogo = () =>
    onAppearanceTargetSelect ? onAppearanceTargetSelect("logo-cover") : onLogoClick?.();
  return (
    <div
      className="-mx-4 px-4 pt-1 text-center"
      onClick={(event) => {
        event.stopPropagation();
        if (onAppearanceTargetSelect) onAppearanceTargetSelect("page-background");
      }}
    >
      {logoUrl ? (
        onLogoClick || onAppearanceTargetSelect ? (
          <button
            type="button"
            aria-label="Selecionar logo e capa"
            onClick={(event) => {
              event.stopPropagation();
              selectLogo();
            }}
            className="mx-auto block bg-transparent p-0"
          >
            <img
              src={logoUrl}
              alt={`Logotipo de ${name}`}
              decoding="async"
              fetchPriority="high"
              className={`mx-auto mt-5 object-contain ${logoFitClass}`}
            />
          </button>
        ) : (
          <img
            src={logoUrl}
            alt={`Logotipo de ${name}`}
            decoding="async"
            fetchPriority="high"
            className={`mx-auto mt-5 object-contain ${logoFitClass}`}
          />
        )
      ) : onAppearanceTargetSelect ? (
        <button
          type="button"
          className="mt-8 text-2xl font-semibold"
          style={{ color: appearance.header_title }}
          onClick={(event) => {
            event.stopPropagation();
            onAppearanceTargetSelect("business-title");
          }}
        >
          {name}
        </button>
      ) : (
        <h1
          className="mt-8 text-2xl font-semibold"
          style={{ color: appearance.header_title }}
        >
          {name}
        </h1>
      )}
    </div>
  );
}

/** Duração legível como no modelo: "30 min", "1 h", "1 h 15 min". */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0 && rest === 0) return `${hours} h`;
  if (hours > 0) return `${hours} h ${rest} min`;
  return `${minutes} min`;
}

function ServiceButton<S extends PreviewService>({
  s,
  onSelect,
  appearance,
  onAppearanceTargetSelect,
}: {
  s: S;
  onSelect: (service: S) => void;
  appearance: Panel1Appearance;
  onAppearanceTargetSelect?: ((target: AppearanceSelectionTarget) => void) | undefined;
}) {
  const hoverTextColor = accessibleTextColor(appearance.service_hover_background);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        if (onAppearanceTargetSelect) onAppearanceTargetSelect("service-background");
        else onSelect(s);
      }}
      className={`relative w-full rounded-xl border px-5 py-6 text-center transition-colors hover:bg-[var(--service-hover-background)] hover:text-[var(--service-hover-text)] hover:border-[var(--service-hover-border)] ${""}`}
      style={
        {
          backgroundColor: appearance.service_background,
          color: appearance.service_text,
          borderColor: appearance.service_border,
          "--service-hover-background": appearance.service_hover_background,
          "--service-hover-text": hoverTextColor,
          "--service-hover-border": appearance.service_hover_border,
        } as CSSProperties
      }
    >
      {!s.image_url ? (
        <span
          aria-hidden="true"
          className="absolute left-5 top-1/2 size-8 -translate-y-1/2 rounded-full border-[1.5px]"
          style={{ borderColor: appearance.service_border }}
        />
      ) : null}
      <div className={s.image_url ? "flex items-center gap-3 text-left" : ""}>
        {s.image_url ? (
          <img
            src={s.image_url}
            alt=""
            loading="lazy"
            className="size-20 shrink-0 rounded-xl object-cover"
            onClick={(event) => {
              if (!onAppearanceTargetSelect) return;
              event.stopPropagation();
              onAppearanceTargetSelect("service-images");
            }}
          />
        ) : null}
        <div className={s.image_url ? "min-w-0 flex-1" : ""}>
          <p
            className="text-[1.375rem] font-medium"
            style={{ color: appearance.service_name_text }}
            onClick={(event) => {
              if (!onAppearanceTargetSelect) return;
              event.stopPropagation();
              onAppearanceTargetSelect("service-name");
            }}
          >
            {s.name}
          </p>
          {s.show_price || s.show_duration ? (
            <p
              className="mt-2 text-base"
              style={{ color: appearance.service_price_text }}
              onClick={(event) => {
                if (!onAppearanceTargetSelect) return;
                event.stopPropagation();
                onAppearanceTargetSelect("service-price");
              }}
            >
              {s.show_price ? formatPrice(s.price_cents) : null}
              {s.show_price && s.show_duration ? " - " : null}
              {s.show_duration ? formatDuration(s.duration_minutes) : null}
            </p>
          ) : null}
          {s.effectiveDepositCents > 0 ? (
            <p
              className="mt-2 text-xs font-semibold"
              style={{ color: appearance.service_price_text }}
              onClick={(event) => {
                if (!onAppearanceTargetSelect) return;
                event.stopPropagation();
                onAppearanceTargetSelect("service-price");
              }}
            >
              Sinal de {formatPrice(s.effectiveDepositCents)}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

/** Categoria colapsável de serviços no painel 1 (fechada por padrão). */
export function CategoryServiceGroup<S extends PreviewService>({
  name,
  services,
  onSelect,
  appearance,
  onAppearanceTargetSelect,
}: {
  name: string;
  services: S[];
  onSelect: (service: S) => void;
  appearance: Panel1Appearance;
  onAppearanceTargetSelect?: ((target: AppearanceSelectionTarget) => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`overflow-hidden rounded-xl border ${""}`}
      style={{
        backgroundColor: appearance.service_background,
        borderColor: appearance.service_border,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-base font-medium"
            style={{ color: appearance.service_name_text }}
          >
            {name}
          </span>
          <span className="mt-1 block text-xs" style={{ color: appearance.service_price_text }}>
            {services.length} serviço(s)
          </span>
        </span>
        <ChevronDown
          className={`size-5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          style={{ color: appearance.service_text }}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="space-y-3 px-4 pb-4">
          {services.map((s) => (
            <ServiceButton
              key={s.id}
              s={s}
              onSelect={onSelect}
              appearance={appearance}
              onAppearanceTargetSelect={onAppearanceTargetSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ServiceSection<S extends PreviewService>({
  services,
  onSelect,
  appearance,
  pageText,
  onAppearanceTargetSelect,
  title = "",
}: {
  services: S[];
  onSelect: (service: S) => void;
  appearance: Panel1Appearance;
  pageText: string;
  onAppearanceTargetSelect?: ((target: AppearanceSelectionTarget) => void) | undefined;
  title?: string;
}) {
  return (
    <section>
      {title ? (
        onAppearanceTargetSelect ? (
          <button
            type="button"
            className="mb-3 block w-full text-center text-sm font-bold uppercase tracking-[0.16em]"
            style={{ color: pageText }}
            onClick={() => onAppearanceTargetSelect("page-text")}
          >
            {title}
          </button>
        ) : (
          <h2
            className="mb-3 text-center text-sm font-bold uppercase tracking-[0.16em]"
            style={{ color: pageText }}
          >
            {title}
          </h2>
        )
      ) : null}
      {services.length === 0 ? (
        <p
          className="rounded-xl border border-dashed px-4 py-6 text-center text-sm"
          style={{ color: pageText, borderColor: appearance.service_border }}
        >
          Nenhum serviço cadastrado ainda.
        </p>
      ) : (
        <div className="space-y-4">
          {services.map((s) => (
            <ServiceButton
              key={s.id}
              s={s}
              onSelect={onSelect}
              appearance={appearance}
              onAppearanceTargetSelect={onAppearanceTargetSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
