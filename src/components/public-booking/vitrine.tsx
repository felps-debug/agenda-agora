import type { CSSProperties, ReactNode } from "react";
import { accessibleTextColor, contrastRatio } from "@/lib/contrast";
import { formatPrice } from "@/lib/format";
import type { Panel1Appearance } from "@/lib/panel1-config";
import type { AppearanceSelectionTarget } from "@/components/public-booking/appearance-preview";
import "@/styles/vitrine.css";

/**
 * Modelo "Vitrine" da página pública: capa grande, logo sobreposto, nome e subtítulo, cards de
 * serviço com imagem própria e navegação inferior. A página pública e a prévia do editor usam
 * exatamente estes componentes; `onTarget` só existe na prévia (clique seleciona a configuração).
 */

type Target = (target: AppearanceSelectionTarget) => void;
export type VitrineTab = "agendar" | "historico";

const ICONS = {
  home: '<path d="M3 11 12 3l9 8"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4m8-4v4M3.5 10.5h17"/>',
  phone:
    '<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.5-4.3a8.5 8.5 0 1 1 15.5-4.6z"/><path d="M9.2 8.6c.3 2.4 2.7 4.8 5.2 5.2l1-1.2-1.9-1-.8.7a3.5 3.5 0 0 1-1.7-1.7l.7-.8-1-1.9z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 5v7l4 3"/>',
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
  );
}

/** Classe e variáveis CSS da raiz da página, alimentadas pelo tema editável. */
export function vitrineTheme({
  appearance,
  pageBackground,
  fontFamily,
  text,
  extraClass = "",
}: {
  appearance: Panel1Appearance;
  pageBackground: string;
  fontFamily: string;
  text: string;
  extraClass?: string;
}): { className: string; style: CSSProperties } {
  const accent = appearance.modal_active_background;
  // Texto do botão: o editado, se ler sobre o fundo; senão preto/branco automático.
  const readable = (fg: string, bg: string) => {
    try {
      if (contrastRatio(fg, bg) >= 4.5) return fg;
    } catch {
      /* cor inválida: usa o automático */
    }
    return accessibleTextColor(bg);
  };
  const accentText = readable(appearance.modal_active_text, accent);
  const hover = appearance.modal_hover_background;
  // O nome do negócio segue a cor de título editada, desde que leia sobre o fundo da página.
  const title = (() => {
    try {
      if (contrastRatio(appearance.header_title, pageBackground) >= 3)
        return appearance.header_title;
    } catch {
      /* cor inválida: usa o texto geral */
    }
    return text;
  })();
  return {
    className: `public-booking vt-page ${extraClass}`.trim(),
    style: {
      "--vt-bg": pageBackground,
      "--vt-text": text,
      "--vt-header-bg": appearance.header_background,
      "--vt-title": title,
      "--vt-header-text": appearance.header_text,
      "--vt-card": appearance.service_background,
      "--vt-card-border": appearance.service_border,
      "--vt-card-text": appearance.service_text,
      "--vt-name": appearance.service_name_text,
      "--vt-price": appearance.service_price_text,
      "--vt-accent": accent,
      "--vt-accent-text": accentText,
      "--vt-btn-border": appearance.modal_border,
      "--vt-btn-hover": hover,
      "--vt-btn-hover-text": readable(appearance.modal_hover_text, hover),
      // Tokens de tema lidos pelos componentes do SaaS (histórico, diálogos).
      "--background": pageBackground,
      "--foreground": text,
      "--card": appearance.service_background,
      "--card-foreground": appearance.service_text,
      "--primary": accent,
      "--primary-foreground": accentText,
      backgroundColor: pageBackground,
      color: text,
      fontFamily: `'${fontFamily}', sans-serif`,
    } as CSSProperties,
  };
}

/** Subtítulo do topo: endereço do negócio; sem endereço, a categoria com a primeira letra maiúscula. */
export function vitrineSubtitle(address?: string | null, category?: string | null): string | null {
  const a = address?.trim();
  if (a) return a;
  const c = category?.trim();
  // "outro" é o valor genérico do cadastro, não serve de subtítulo.
  return c && c.toLowerCase() !== "outro" ? c.charAt(0).toUpperCase() + c.slice(1) : null;
}

export type VitrineService = {
  id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price_cents: number;
  effectiveDepositCents: number;
  show_price: boolean;
  show_duration: boolean;
  image_url?: string | null;
};

function stop(onTarget: Target | undefined, target: AppearanceSelectionTarget) {
  return onTarget
    ? (event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        onTarget(target);
      }
    : undefined;
}

/** Capa, logo sobreposto, nome do negócio e subtítulo. */
export function VitrineHero({
  name,
  subtitle,
  coverUrl,
  logoUrl,
  onTarget,
}: {
  name: string;
  subtitle: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  onTarget?: Target;
}) {
  return (
    <header className="vt-hero">
      <div
        className="vt-cover"
        data-empty={coverUrl ? undefined : "true"}
        onClick={stop(onTarget, "cover")}
      >
        {coverUrl ? <img src={coverUrl} alt="" decoding="async" /> : null}
      </div>
      <div className="vt-identity" onClick={stop(onTarget, "page-background")}>
        <div className="vt-logo" onClick={stop(onTarget, "logo")}>
          {logoUrl ? (
            <img src={logoUrl} alt={`Logotipo de ${name}`} decoding="async" />
          ) : (
            <span aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <h1 onClick={stop(onTarget, "business-title")}>{name}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
}

export function VitrineServices<S extends VitrineService>({
  services,
  onSchedule,
  onTarget,
}: {
  services: S[];
  onSchedule: (service: S) => void;
  onTarget?: Target;
}) {
  return (
    <div className="vt-services" onClick={stop(onTarget, "service-background")}>
      {services.map((s) => (
        <article className="vt-card" key={s.id}>
          {s.image_url ? (
            <img
              className="vt-card-image"
              src={s.image_url}
              alt={s.name}
              loading="lazy"
              decoding="async"
              onClick={stop(onTarget, "service-images")}
            />
          ) : (
            <span
              className="vt-card-image vt-card-noimg"
              aria-hidden="true"
              onClick={stop(onTarget, "service-images")}
            >
              {s.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="vt-card-body">
            <h3 onClick={stop(onTarget, "service-name")}>{s.name}</h3>
            {s.description ? <p className="vt-card-desc">{s.description}</p> : null}
            <div className="vt-card-foot">
              <div className="vt-card-meta" onClick={stop(onTarget, "service-price")}>
                {s.show_price ? <strong>{formatPrice(s.price_cents)}</strong> : null}
                {s.show_duration ? (
                  <span>
                    <Icon name="clock" />
                    {s.duration_minutes}min
                  </span>
                ) : null}
                {s.effectiveDepositCents > 0 ? (
                  <span>Sinal de {formatPrice(s.effectiveDepositCents)}</span>
                ) : null}
              </div>
              <button
                type="button"
                className="vt-book"
                aria-label={`Agendar ${s.name}`}
                onClick={(event) => {
                  if (onTarget) {
                    event.stopPropagation();
                    onTarget("buttons");
                    return;
                  }
                  onSchedule(s);
                }}
              >
                <Icon name="calendar" />
                Agendar
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function VitrineNav({
  tab,
  onChange,
  onContact,
  contactDisabled = false,
  onTarget,
}: {
  tab: VitrineTab;
  onChange: (tab: VitrineTab) => void;
  onContact: () => void;
  contactDisabled?: boolean;
  onTarget?: Target;
}) {
  return (
    <nav
      aria-label="Menu principal"
      className="vt-nav"
      onClick={stop(onTarget, "service-background")}
    >
      <button
        type="button"
        className={tab === "agendar" ? "active" : undefined}
        aria-current={tab === "agendar" ? "page" : undefined}
        onClick={() => onChange("agendar")}
      >
        <Icon name="home" />
        Início
      </button>
      <button
        type="button"
        className={tab === "historico" ? "active" : undefined}
        aria-current={tab === "historico" ? "page" : undefined}
        onClick={() => onChange("historico")}
      >
        <Icon name="calendar" />
        Meus agendamentos
      </button>
      <button type="button" disabled={contactDisabled} onClick={onContact}>
        <Icon name="phone" />
        Fale conosco
      </button>
    </nav>
  );
}

export function VitrineMain({ children }: { children: ReactNode }) {
  return (
    <main className="vt-main">
      <section id="content" aria-live="polite">
        {children}
      </section>
    </main>
  );
}
