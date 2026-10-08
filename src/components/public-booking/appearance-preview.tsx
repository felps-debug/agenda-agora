import type { CSSProperties } from "react";
import { Check, Clock, MapPin } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { accessibleTextColor } from "@/lib/contrast";
import type { Panel1Appearance } from "@/lib/panel1-config";

export type BookingPreviewVariant = "classic" | "liquid_glass";
export type AppearanceSelectionTarget =
  | "page-background"
  | "header-background"
  | "service-background"
  | "logo-cover"
  | "service-images"
  | "business-title"
  | "service-name"
  | "service-price"
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
  variant = "classic",
  onAppearanceTargetSelect,
}: {
  name: string;
  logoUrl: string | null;
  address: string | null;
  appearance: Panel1Appearance;
  onLogoClick?: () => void;
  variant?: BookingPreviewVariant;
  onAppearanceTargetSelect?: (target: AppearanceSelectionTarget) => void;
}) {
  const logoFitClass = LOGO_FIT_CLASSES[appearance.logo_fit] ?? LOGO_FIT_CLASSES.quadrado;
  const selectLogo = () =>
    onAppearanceTargetSelect ? onAppearanceTargetSelect("logo-cover") : onLogoClick?.();
  return (
    <div
      className={
        variant === "liquid_glass"
          ? "liquid-glass-brand -mx-4 px-4 pb-5 pt-7 text-center"
          : "-mx-4 px-4 py-8 text-center"
      }
      onClick={(event) => {
        event.stopPropagation();
        onAppearanceTargetSelect?.("header-background");
      }}
      style={{
        ...(variant === "classic" ? { backgroundColor: "transparent" } : {}),
        color: appearance.header_title,
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
              className={`mx-auto object-contain ${logoFitClass}`}
            />
          </button>
        ) : (
          <img
            src={logoUrl}
            alt={`Logotipo de ${name}`}
            decoding="async"
            fetchPriority="high"
            className={`mx-auto object-contain ${logoFitClass}`}
          />
        )
      ) : onLogoClick || onAppearanceTargetSelect ? (
        <button
          type="button"
          aria-label="Selecionar logo e capa"
          onClick={(event) => {
            event.stopPropagation();
            selectLogo();
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
      {onAppearanceTargetSelect ? (
        <button
          type="button"
          className="mt-4 text-xl font-semibold"
          onClick={(event) => {
            event.stopPropagation();
            onAppearanceTargetSelect("business-title");
          }}
        >
          {name}
        </button>
      ) : (
        <h1 className="mt-4 text-xl font-semibold">{name}</h1>
      )}
      {address ? (
        <p
          className="mx-auto mt-2 flex max-w-md cursor-pointer items-center justify-center gap-1.5 text-xs"
          onClick={(event) => {
            event.stopPropagation();
            onAppearanceTargetSelect?.("page-text");
          }}
        >
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
  variant = "classic",
  onAppearanceTargetSelect,
  selectedId = null,
}: {
  services: S[];
  onSelect: (service: S) => void;
  appearance: Panel1Appearance;
  pageText: string;
  variant?: BookingPreviewVariant;
  onAppearanceTargetSelect?: (target: AppearanceSelectionTarget) => void;
  /** Liquid Glass: serviço marcado na caixa de seleção; `onSelect` alterna a marcação. */
  selectedId?: string | null;
}) {
  const hoverTextColor = accessibleTextColor(appearance.service_hover_background);
  if (variant === "liquid_glass" && services.length > 0) {
    return (
      <section>
        <h2 className="sr-only">Serviços</h2>
        <div className="space-y-3.5">
          {services.map((s) => {
            const selected = selectedId === s.id;
            const initials = s.name.slice(0, 2).toUpperCase();
            return (
              <button
                key={s.id}
                type="button"
                role="checkbox"
                aria-checked={selected}
                data-selected={selected}
                onClick={(event) => {
                  event.stopPropagation();
                  if (onAppearanceTargetSelect) onAppearanceTargetSelect("service-background");
                  else onSelect(s);
                }}
                className="liquid-glass-surface liquid-glass-regular liquid-glass-refract liquid-glass-service flex w-full items-center gap-4 text-left"
                style={{ color: appearance.service_text }}
              >
                {s.image_url ? (
                  <img
                    src={s.image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="liquid-glass-service-image"
                    onClick={(event) => {
                      if (!onAppearanceTargetSelect) return;
                      event.stopPropagation();
                      onAppearanceTargetSelect("service-images");
                    }}
                  />
                ) : (
                  <span className="liquid-glass-service-image flex items-center justify-center text-xl font-bold">
                    {initials}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-xl font-bold leading-tight"
                    style={{ color: appearance.service_name_text }}
                    onClick={(event) => {
                      if (!onAppearanceTargetSelect) return;
                      event.stopPropagation();
                      onAppearanceTargetSelect("service-name");
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    className="mt-2 block text-[0.95rem] leading-snug"
                    style={{ color: appearance.service_price_text }}
                    onClick={(event) => {
                      if (!onAppearanceTargetSelect) return;
                      event.stopPropagation();
                      onAppearanceTargetSelect("service-price");
                    }}
                  >
                    {s.show_price ? (
                      <span className="block">{formatPrice(s.price_cents)}</span>
                    ) : null}
                    {s.show_duration ? (
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-4" aria-hidden="true" />
                        {s.duration_minutes}min
                      </span>
                    ) : null}
                    {s.effectiveDepositCents > 0 ? (
                      <span className="mt-1 block text-xs font-semibold">
                        Sinal de {formatPrice(s.effectiveDepositCents)}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="liquid-glass-check" data-checked={selected} aria-hidden="true">
                  {selected ? <Check className="size-4" strokeWidth={3} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }
  return (
    <section>
      {onAppearanceTargetSelect ? (
        <button
          type="button"
          className="mb-3 block w-full text-center text-sm font-bold uppercase tracking-[0.16em]"
          style={{ color: pageText }}
          onClick={() => onAppearanceTargetSelect("page-text")}
        >
          Serviços
        </button>
      ) : (
        <h2
          className="mb-3 text-center text-sm font-bold uppercase tracking-[0.16em]"
          style={{ color: pageText }}
        >
          Serviços
        </h2>
      )}
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
              onClick={(event) => {
                event.stopPropagation();
                if (onAppearanceTargetSelect) onAppearanceTargetSelect("service-background");
                else onSelect(s);
              }}
              className={`w-full rounded-lg border px-4 py-5 text-center transition-colors hover:bg-[var(--service-hover-background)] hover:text-[var(--service-hover-text)] hover:border-[var(--service-hover-border)] ${variant === "liquid_glass" ? "liquid-glass-surface liquid-glass-regular liquid-glass-refract" : ""}`}
              style={
                {
                  ...(variant === "classic"
                    ? { backgroundColor: appearance.service_background }
                    : {}),
                  color: appearance.service_text,
                  borderColor: appearance.service_border,
                  "--service-hover-background": appearance.service_hover_background,
                  "--service-hover-text": hoverTextColor,
                  "--service-hover-border": appearance.service_hover_border,
                } as CSSProperties
              }
            >
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
                    className="text-base font-medium"
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
                      className="mt-2 text-sm"
                      style={{ color: appearance.service_price_text }}
                      onClick={(event) => {
                        if (!onAppearanceTargetSelect) return;
                        event.stopPropagation();
                        onAppearanceTargetSelect("service-price");
                      }}
                    >
                      {s.show_price ? formatPrice(s.price_cents) : null}
                      {s.show_price && s.show_duration ? " - " : null}
                      {s.show_duration ? `${s.duration_minutes}min` : null}
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
                  ) : (
                    <p className="mt-2 text-xs" style={{ color: appearance.service_text }}>
                      Sem sinal
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
