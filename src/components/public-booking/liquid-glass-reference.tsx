import type { CSSProperties, ReactNode } from "react";
import { accessibleTextColor } from "@/lib/contrast";
import { formatPrice } from "@/lib/format";
import type { Panel1Appearance } from "@/lib/panel1-config";
import type { AppearanceSelectionTarget } from "@/components/public-booking/appearance-preview";
import {
  liquidGlassAccent,
  liquidGlassBackgroundImage,
  liquidGlassDark,
  liquidGlassHueShift,
  liquidGlassTokens,
  mixHex,
} from "@/components/public-booking/liquid-glass";
import "@/styles/liquid-glass-reference.css";
import "@/styles/booking-classic.css";

/**
 * Página pública do Painel 1 (agendamento). O formato vem do repo fazerpainel1-liquidglass
 * (index.html + app.js): topo em pílula, logo solta, cards com foto e caixa de marcar, menu só
 * com ícones. `liquid_glass` usa o CSS do repo (.lg-ref); `classic` usa o mesmo formato com cores
 * sólidas (.lg-classic). A prévia do editor usa exatamente estes componentes.
 */

type Target = (target: AppearanceSelectionTarget) => void;

const ICONS = {
  services:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h1m4 0h1m4 0h1m-11 3h1m4 0h1"/>',
  history: '<path d="M3 4v5h5M3 9a9 9 0 1 1 0 8m9-11v6l3 2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 5v7l4 3"/>',
  phone:
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
} as const;

function Icon({ name, style }: { name: keyof typeof ICONS; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={style}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

export type RefLayout = "liquid_glass" | "classic";

/** Classe e variáveis CSS da raiz da página, alimentadas pelo tema editável. */
export function refPageTheme({
  layout,
  appearance,
  pageBackground,
  pageBackgroundImage,
  fontFamily,
  text,
  extraClass = "",
}: {
  layout: RefLayout;
  appearance: Panel1Appearance;
  pageBackground: string;
  pageBackgroundImage: string | null;
  fontFamily: string;
  text: string;
  extraClass?: string;
}): { className: string; style: CSSProperties } {
  if (layout === "liquid_glass") {
    const dark = liquidGlassDark(pageBackground, appearance);
    const accent = liquidGlassAccent(appearance);
    return {
      className: `public-booking lg-ref ${extraClass}`.trim(),
      style: {
        ...liquidGlassTokens(appearance, pageBackground),
        // Variáveis que o CSS da referência lê, alimentadas pelo tema.
        "--background": dark,
        "--menu": mixHex(dark, accent, 0.12),
        "--text": text,
        "--shadow": `color-mix(in srgb, ${accent} 30%, transparent)`,
        "--lg-hue": `${liquidGlassHueShift(accent)}deg`,
        "--lg-header-tint": appearance.header_background,
        "--lg-card-tint": appearance.service_background,
        // Tokens que os componentes do SaaS (histórico, diálogos) leem.
        "--foreground": text,
        "--card-foreground": text,
        "--muted-foreground": `color-mix(in srgb, ${text} 72%, transparent)`,
        "--border": `color-mix(in srgb, ${text} 22%, transparent)`,
        color: text,
        fontFamily: `'${fontFamily}', sans-serif`,
        backgroundColor: dark,
        backgroundImage: pageBackgroundImage
          ? `url(${pageBackgroundImage})`
          : liquidGlassBackgroundImage(accent, dark),
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
      } as CSSProperties,
    };
  }
  const accent = appearance.modal_active_background;
  return {
    className: `public-booking lg-classic ${extraClass}`.trim(),
    style: {
      "--cl-bg": pageBackground,
      "--cl-text": text,
      "--cl-header-bg": appearance.header_background,
      "--cl-header-text": appearance.header_text,
      "--cl-card": appearance.service_background,
      "--cl-card-border": appearance.service_border,
      "--cl-nav-text": accessibleTextColor(appearance.service_background),
      "--cl-name": appearance.service_name_text,
      "--cl-price": appearance.service_price_text,
      "--cl-accent": accent,
      "--cl-accent-text": accessibleTextColor(accent),
      // Tokens de tema lidos pelos componentes do SaaS (histórico, diálogos).
      "--background": pageBackground,
      "--foreground": text,
      "--card": appearance.service_background,
      "--card-foreground": appearance.service_text,
      "--primary": accent,
      "--primary-foreground": accessibleTextColor(accent),
      backgroundColor: pageBackground,
      color: text,
      fontFamily: `'${fontFamily}', sans-serif`,
      ...(pageBackgroundImage
        ? {
            backgroundImage: `url(${pageBackgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }
        : {}),
    } as CSSProperties,
  };
}

export function RefHeader({
  phone,
  color,
  onTarget,
}: {
  phone: string | null;
  color?: string;
  onTarget?: Target;
}) {
  return (
    <header
      onClick={
        onTarget
          ? (event) => {
              event.stopPropagation();
              onTarget("header-background");
            }
          : undefined
      }
    >
      {/* O wordmark vira máscara para aceitar a cor de texto do cabeçalho editada no painel. */}
      <span
        role="img"
        aria-label="Agenda Agora"
        style={{
          display: "block",
          width: 150,
          height: 11.7,
          flexShrink: 0,
          backgroundColor: color ?? "#fffdf5",
          WebkitMask: "url(/agenda-agora-wordmark.svg) left center / contain no-repeat",
          mask: "url(/agenda-agora-wordmark.svg) left center / contain no-repeat",
        }}
      />
      {phone || onTarget ? (
        <button
          type="button"
          aria-label="Contato"
          style={color ? { color } : undefined}
          onClick={(event) => {
            if (onTarget) return;
            event.stopPropagation();
            if (phone) window.location.href = `tel:${phone}`;
          }}
        >
          <Icon name="phone" style={{ width: 24, height: 24, display: "block" }} />
        </button>
      ) : null}
    </header>
  );
}

export type RefService = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  effectiveDepositCents: number;
  show_price: boolean;
  show_duration: boolean;
  image_url?: string | null;
};

export function RefLogo({
  name,
  logoUrl,
  onTarget,
}: {
  name: string;
  logoUrl: string | null;
  onTarget?: Target;
}) {
  const select = (target: AppearanceSelectionTarget) =>
    onTarget
      ? (event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          onTarget(target);
        }
      : undefined;
  return logoUrl ? (
    <img
      className="logo"
      src={logoUrl}
      alt={`Logotipo de ${name}`}
      decoding="async"
      onClick={select("logo-cover")}
    />
  ) : (
    <h1
      style={{ textAlign: "center", margin: "28px 16px 16px", fontSize: 26 }}
      onClick={select("business-title")}
    >
      {name}
    </h1>
  );
}

export function RefServices<S extends RefService>({
  services,
  selectedId,
  onToggle,
  onTarget,
}: {
  services: S[];
  selectedId: string | null;
  onToggle: (service: S) => void;
  onTarget?: Target;
}) {
  const select = (target: AppearanceSelectionTarget) =>
    onTarget
      ? (event: { stopPropagation: () => void; preventDefault: () => void }) => {
          event.preventDefault();
          event.stopPropagation();
          onTarget(target);
        }
      : undefined;
  return (
    <div className="services">
      {services.map((s) => (
        <label className="service" key={s.id} onClick={select("service-background")}>
          {s.image_url ? (
            <img
              src={s.image_url}
              alt={s.name}
              loading="lazy"
              decoding="async"
              onClick={select("service-images")}
            />
          ) : (
            <span className="noimg" aria-hidden="true">
              {s.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="details">
            <div>
              <h3 onClick={select("service-name")}>{s.name}</h3>
              {s.show_price ? (
                <div className="price" onClick={select("service-price")}>
                  {formatPrice(s.price_cents)}
                </div>
              ) : null}
              {s.show_duration ? (
                <div className="duration" onClick={select("service-price")}>
                  <Icon name="clock" />
                  {s.duration_minutes}min
                </div>
              ) : null}
              {s.effectiveDepositCents > 0 ? (
                <div
                  className="price"
                  style={{ fontSize: 13, opacity: 0.85 }}
                  onClick={select("service-price")}
                >
                  Sinal de {formatPrice(s.effectiveDepositCents)}
                </div>
              ) : null}
            </div>
            <input
              className="choice"
              type="checkbox"
              aria-label={`Selecionar ${s.name}`}
              checked={selectedId === s.id}
              onChange={() => onToggle(s)}
            />
          </div>
        </label>
      ))}
    </div>
  );
}

export function RefNav({
  tab,
  compact = false,
  onChange,
  onTarget,
}: {
  tab: "agendar" | "historico";
  compact?: boolean;
  onChange: (tab: "agendar" | "historico") => void;
  onTarget?: Target;
}) {
  const items: { key: "agendar" | "historico"; label: string; icon: "services" | "history" }[] = [
    { key: "agendar", label: "Agendar", icon: "services" },
    { key: "historico", label: "Histórico", icon: "history" },
  ];
  return (
    <nav
      aria-label="Menu principal"
      className={compact ? "compact" : undefined}
      onClick={
        onTarget
          ? (event) => {
              event.stopPropagation();
              onTarget("buttons");
            }
          : undefined
      }
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={tab === item.key ? "active" : undefined}
          aria-label={item.label}
          aria-current={tab === item.key ? "page" : undefined}
          onClick={() => onChange(item.key)}
        >
          <Icon name={item.icon} />
        </button>
      ))}
    </nav>
  );
}

export function RefMain({ logo, children }: { logo: ReactNode; children: ReactNode }) {
  return (
    <main>
      {logo}
      <section id="content" aria-live="polite">
        {children}
      </section>
    </main>
  );
}
