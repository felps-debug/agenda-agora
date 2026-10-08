import type { ReactNode } from "react";
import { formatPrice } from "@/lib/format";
import "@/styles/liquid-glass-reference.css";

/**
 * Marcação do Painel 1 Liquid Glass copiada do repo fazerpainel1-liquidglass (index.html + app.js).
 * As classes são as mesmas do HTML original; o CSS está em styles/liquid-glass-reference.css
 * e vale só dentro de `.lg-ref`.
 */

const ICONS = {
  services:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h1m4 0h1m4 0h1m-11 3h1m4 0h1"/>',
  history: '<path d="M3 4v5h5M3 9a9 9 0 1 1 0 8m9-11v6l3 2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 5v7l4 3"/>',
  phone:
    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
  );
}

export function RefHeader({ phone, color }: { phone: string | null; color?: string }) {
  return (
    <header>
      {/* O wordmark vira máscara para aceitar a cor de texto do cabeçalho editada no painel. */}
      <span
        role="img"
        aria-label="Agenda Agora"
        style={{
          display: "block",
          width: 124,
          height: 9.7,
          backgroundColor: color ?? "#fffdf5",
          WebkitMask: "url(/agenda-agora-wordmark.svg) center / contain no-repeat",
          mask: "url(/agenda-agora-wordmark.svg) center / contain no-repeat",
        }}
      />
      {phone ? (
        <button
          type="button"
          aria-label="Contato"
          style={color ? { color } : undefined}
          onClick={() => {
            window.location.href = `tel:${phone}`;
          }}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={{ width: 22, height: 22, display: "block" }}
            dangerouslySetInnerHTML={{ __html: ICONS.phone }}
          />
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

export function RefLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return logoUrl ? (
    <img className="logo" src={logoUrl} alt={`Logotipo de ${name}`} decoding="async" />
  ) : (
    <h1 style={{ textAlign: "center", margin: "28px 16px 16px", fontSize: 26 }}>{name}</h1>
  );
}

export function RefServices<S extends RefService>({
  services,
  selectedId,
  onToggle,
  nameColor,
  priceColor,
}: {
  services: S[];
  selectedId: string | null;
  onToggle: (service: S) => void;
  nameColor?: string;
  priceColor?: string;
}) {
  return (
    <div className="services">
      {services.map((s) => (
        <label className="service" key={s.id}>
          {s.image_url ? (
            <img src={s.image_url} alt={s.name} loading="lazy" decoding="async" />
          ) : (
            <span className="noimg" aria-hidden="true">
              {s.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="details">
            <div>
              <h3 style={nameColor ? { color: nameColor } : undefined}>{s.name}</h3>
              {s.show_price ? (
                <div className="price" style={priceColor ? { color: priceColor } : undefined}>
                  {formatPrice(s.price_cents)}
                </div>
              ) : null}
              {s.show_duration ? (
                <div className="duration" style={priceColor ? { color: priceColor } : undefined}>
                  <Icon name="clock" />
                  {s.duration_minutes}min
                </div>
              ) : null}
              {s.effectiveDepositCents > 0 ? (
                <div className="price" style={{ fontSize: 13, opacity: 0.85 }}>
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
  compact,
  onChange,
}: {
  tab: "agendar" | "historico";
  compact: boolean;
  onChange: (tab: "agendar" | "historico") => void;
}) {
  const items: { key: "agendar" | "historico"; label: string; icon: "services" | "history" }[] = [
    { key: "agendar", label: "Agendar", icon: "services" },
    { key: "historico", label: "Histórico", icon: "history" },
  ];
  return (
    <nav aria-label="Menu principal" className={compact ? "compact" : undefined}>
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
