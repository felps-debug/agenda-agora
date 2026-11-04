import { useEffect, useMemo, useState } from "react";

export type AtenasOverviewHeroProps = {
  /** Nome exibido na saudação. */
  name?: string | undefined;
  /** Chamado ao clicar em "Ver minha agenda" (rola até a lista de agendamentos). */
  onSeeAgenda?: () => void;
};

/** Saudação conforme o horário local. */
function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Data por extenso no padrão da referência (ex.: sábado, 10 de outubro). */
function formatHeroDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Quadro de visão do topo da Agenda: saudação, resumo da operação,
 * indicador de atualização automática e ação "Ver minha agenda".
 * O visual (HTML/CSS/JS) segue a referência enviada.
 */
export function AtenasOverviewHero({ name = "Guilherme", onSeeAgenda }: AtenasOverviewHeroProps) {
  const [now, setNow] = useState(() => new Date());

  // Mantém saudação e data atualizadas sem recarregar a página.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const greeting = useMemo(() => greetingFor(now), [now]);
  const dateLabel = useMemo(() => formatHeroDate(now), [now]);

  return (
    <section className="atenas-overview-hero">
      <div className="atenas-overview-hero__copy">
        <span className="atenas-overview-hero__eyebrow">
          <span className="atenas-overview-hero__rule" aria-hidden="true" /> Visão geral
        </span>
        <h2>
          {greeting}, {name}.
        </h2>
        <p>
          Acompanhe seus próximos atendimentos, confirmações e horários disponíveis em um só lugar.
        </p>
        <small>{dateLabel}</small>
      </div>
      <div className="atenas-overview-hero__actions">
        <span className="finance-freshness" aria-live="polite">
          <span className="finance-freshness__dot" aria-hidden="true" />
          Atualização automática
        </span>
        <button type="button" className="atenas-overview-primary-action" onClick={onSeeAgenda}>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-chevron-down"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          Ver minha agenda
        </button>
      </div>
    </section>
  );
}
