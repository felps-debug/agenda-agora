import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import {
  CalendarDays,
  Clock,
  Heart,
  House,
  LogOut,
} from "lucide-react";
import { accessibleTextColor } from "@/lib/contrast";
import { formatPrice } from "@/lib/format";
import type { Panel1Appearance } from "@/lib/panel1-config";
import type { AppearanceSelectionTarget } from "@/components/public-booking/appearance-preview";

export type EleganceService = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  description?: string | null;
  show_price: boolean;
  show_duration: boolean;
  image_url?: string | null;
};

export type EleganceTab = "agendar" | "historico";

/** Onda contínua do rodapé (Bézier única, sem recortes sobrepostos). */
const WAVE_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 520 120' preserveAspectRatio='none'%3E%3Cpath d='M0 42 C100 18 160 26 260 40 C360 54 440 52 520 30 L520 120 L0 120 Z'/%3E%3C/svg%3E\")";

const serifDisplay: CSSProperties = { fontFamily: "'Playfair Display', Georgia, serif" };

function CircleIconButton({
  label,
  onClick,
  cardBackground,
  cardText,
  children,
}: {
  label: string;
  onClick: () => void;
  cardBackground: string;
  cardText: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-[38px] items-center justify-center rounded-full sm:size-[42px]"
      style={{ backgroundColor: cardBackground, color: cardText }}
    >
      {children}
    </button>
  );
}

/**
 * Painel público no modelo "Elegance": capa, logo circular, tipografia serifada,
 * cards de serviço arredondados, onda decorativa e navegação flutuante.
 * Cores vêm dos tokens de aparência e continuam editáveis no editor.
 */
export function ElegancePanel({
  appearance,
  brandName,
  title,
  logoUrl,
  coverUrl,
  pageBackground,
  activeTab,
  onTabSelect,
  onAppearanceTargetSelect,
  onLogout,
  children,
  fullHeight = true,
  fixedFooter = false,
  minimalist = false,
}: {
  appearance: Panel1Appearance;
  brandName: string;
  /** Substitui o nome do negócio no título (ex.: "Meus agendamentos"). */
  title?: string | null | undefined;
  logoUrl: string | null;
  coverUrl: string | null;
  pageBackground: string;
  activeTab: EleganceTab;
  onTabSelect?: ((tab: EleganceTab) => void) | undefined;
  onAppearanceTargetSelect?: ((target: AppearanceSelectionTarget) => void) | undefined;
  /** Sai: limpa cookies + dados de agendamento do navegador. */
  onLogout?: () => void | undefined;
  children: ReactNode;
  /** Prévia do editor usa altura menor em vez da tela inteira. */
  fullHeight?: boolean | undefined;
  /**
   * Página pública fixa onda e menu no rodapé da TELA (position: fixed),
   * como elementos independentes; a prévia do editor os mantém ancorados
   * ao painel para não vazar sobre a interface do editor.
   */
  fixedFooter?: boolean | undefined;
  /** Variante sem capa: cabeçalho e conteúdo usam o mesmo fundo contínuo. */
  minimalist?: boolean | undefined;
}) {
  const pickTarget =
    onAppearanceTargetSelect ?
      (target: AppearanceSelectionTarget, event: MouseEvent) => {
        event.stopPropagation();
        onAppearanceTargetSelect(target);
      }
    : undefined;

  const initials = brandName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  const navItems = [
    { key: "agendar" as const, label: "Início", icon: House },
    { key: "historico" as const, label: "Meus agendamentos", icon: CalendarDays },
  ];

  return (
    <div className={`relative mx-auto flex w-full max-w-[520px] flex-col overflow-hidden ${fullHeight ? "min-h-screen" : "min-h-[640px]"}`}>
      <header
        className={minimalist ? "relative bg-[var(--minimalist-background)] px-2.5 pt-4 sm:px-4" : "relative h-[240px] sm:h-[300px]"}
        style={
          (minimalist
            ? { "--minimalist-background": pageBackground }
            : coverUrl
              ? { background: `url(${coverUrl}) 54% 45% / cover no-repeat` }
              : undefined) as CSSProperties | undefined
        }
      >
        <div className="absolute inset-x-[14px] top-[26px] flex justify-end sm:inset-x-6 sm:top-6">
          <div className="relative">
            <CircleIconButton
              label="Sair"
              cardBackground={appearance.service_background}
              cardText={minimalist ? appearance.page_text : appearance.service_text}
              onClick={() => onLogout?.()}
            >
              <LogOut className="size-[22px]" />
            </CircleIconButton>
          </div>
        </div>
      </header>

      <div className={minimalist ? "relative flex-1 bg-[var(--minimalist-background)] px-2.5 pb-[112px] sm:px-4 sm:pb-[144px]" : "relative -mt-[46px] flex-1 px-2.5 pb-[112px] sm:-mt-[67px] sm:px-4 sm:pb-[144px]"} style={minimalist ? ({ "--minimalist-background": pageBackground } as CSSProperties) : undefined}>
        {!minimalist && coverUrl ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-[-20%] top-0 h-[210px]"
            style={{ background: pageBackground, borderRadius: "50% 50% 0 0" }}
          />
        ) : null}

        <div
          className={minimalist ? "relative flex flex-col items-center pb-5 pt-5 sm:pb-6 sm:pt-6" : "relative flex flex-col items-center pb-4 pt-[63px] sm:mb-[21px] sm:pt-[65px]"}
          style={minimalist ? { paddingTop: "15%" } : undefined}
        >
          <button
            type="button"
            {...(pickTarget ? { "aria-label": "Logo do negócio" } : {})}
            onClick={(event) => {
              if (pickTarget) pickTarget("logo-cover", event);
              else event.stopPropagation();
            }}
            className={minimalist ? "flex h-[138px] w-[201px] cursor-pointer items-center justify-center overflow-hidden rounded-[18px] border-2" : "absolute -top-[76px] flex size-[146px] cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 sm:-top-[75px] sm:size-[160px]"}
            style={{
              borderColor: appearance.service_background,
              ...(minimalist
                ? {
                    width: "201px",
                    height: "138px",
                    minWidth: "201px",
                    minHeight: "138px",
                    flexShrink: 0,
                    position: "relative",
                    inset: "auto",
                    marginInline: "auto",
                    alignSelf: "center",
                  }
                : {}),
              background: !logoUrl
                ? `linear-gradient(145deg, ${appearance.page_gradient_start}, ${appearance.page_gradient_end})`
                : appearance.service_background,
            }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className={minimalist ? "absolute inset-[2px] size-[calc(100%-4px)] max-w-[calc(100%-4px)] rounded-[14px] object-cover" : "absolute inset-[2px] size-[calc(100%-4px)] rounded-full object-cover"}
                style={minimalist ? { width: "197px", height: "134px" } : undefined}
              />
            ) : (
              <>
                <Heart
                  className="mt-1 size-3"
                  fill="currentColor"
                  style={{ color: appearance.wave_color }}
                />
                <span
                  className="px-3 text-center text-3xl leading-tight"
                  style={{ ...serifDisplay, color: appearance.service_name_text }}
                >
                  {initials || brandName.charAt(0)}
                </span>
              </>
            )}
          </button>

          <h1
            className={`${minimalist ? "mt-[14px]" : "mt-3"} m-0 cursor-pointer text-center text-[35px] leading-[1.2] font-normal sm:text-[39px]`}
            style={{ ...serifDisplay, color: minimalist ? appearance.page_text : appearance.header_title }}
            onClick={(event) => {
              if (pickTarget) pickTarget("business-title", event);
              else event.stopPropagation();
            }}
          >
            {title || brandName}
          </h1>
          <p
            className="m-0 cursor-pointer text-center text-[19px] leading-snug sm:text-[21px]"
            style={{ ...serifDisplay, color: minimalist ? appearance.service_price_text : appearance.wave_color }}
            onClick={(event) => {
              if (pickTarget) pickTarget("brand-tagline", event);
              else event.stopPropagation();
            }}
          >
            {appearance.brand_tagline}
          </p>
          <Heart className="mt-[5px] size-3.5" fill="currentColor" style={{ color: appearance.wave_color }} />
        </div>

        {children}

        {minimalist ? (
          <div
            aria-hidden="true"
            className={`pointer-events-none left-0 h-[80px] w-full sm:h-[117px] ${
              fixedFooter ? "fixed bottom-0 z-[11]" : "absolute bottom-0 z-[11]"
            }`}
          >
            <svg
              viewBox="0 0 520 120"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M0 85 C80 56 168 84 260 76 C352 68 430 94 520 70 L520 120 L0 120 Z"
                fill={appearance.wave_color_2}
                opacity="0.82"
              />
              <path
                d="M0 73 C80 44 168 72 260 64 C352 56 430 82 520 58"
                stroke={appearance.wave_color}
                strokeWidth="1.7"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                opacity="0.95"
              />
            </svg>
          </div>
        ) : null}

        <div
          aria-hidden="true"
          className={`pointer-events-none left-0 h-[80px] w-full sm:h-[117px] slide-up-enter ${
            fixedFooter ? "fixed bottom-0 z-10" : "absolute bottom-0 z-10"
          }`}
          style={{
            background: appearance.wave_color,
            maskImage: WAVE_MASK,
            WebkitMaskImage: WAVE_MASK,
            maskSize: "100% 100%",
            WebkitMaskSize: "100% 100%",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
          }}
        />
      </div>

      {/* Menu flutuante: elemento irmão e independente da onda. */}
      <nav
        aria-label="Navegação principal"
        className={
          (fixedFooter
            ? "fixed bottom-[20px] left-1/2 z-50 grid h-[74px] w-[calc(100%-20px)] max-w-[492px] -translate-x-1/2 grid-cols-2 rounded-[45px] border px-[7px] py-2 shadow-lg backdrop-blur-md sm:h-[82px]"
            : "absolute bottom-[10px] left-2.5 right-2.5 z-20 grid h-[74px] grid-cols-2 rounded-[45px] border px-[7px] py-2 backdrop-blur-md sm:bottom-3 sm:left-[14px] sm:right-[14px] sm:h-[82px]") +
          " slide-up-enter"
        }
        style={{
            backgroundColor: `${appearance.service_background}A3`,
            borderColor: appearance.service_background,
          }}
      >
        {navItems.map((item) => {
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabSelect?.(item.key)}
              className="flex flex-col items-center justify-center gap-[5px] py-[5px] hover:opacity-80"
              style={{ color: active ? appearance.modal_active_background : appearance.page_text, opacity: active ? 1 : 0.55 }}
            >
              <item.icon
                className="size-[25px]"
                strokeWidth={1.6}
                {...(active ? { style: { fill: `${appearance.modal_active_background}4D` } } : {})}
              />
              <span className="text-[10px] leading-tight sm:text-[11px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/** Lista de serviços do modelo Elegance: imágenes, descrição, preço e botão Agendar. */
export function EleganceServiceList<S extends EleganceService>({
  services,
  onSelect,
  appearance,
  onAppearanceTargetSelect,
  onAgendarPreview,
}: {
  services: S[];
  onSelect: (service: S) => void;
  appearance: Panel1Appearance;
  onAppearanceTargetSelect?: ((target: AppearanceSelectionTarget) => void) | undefined;
  onAgendarPreview?: (() => void) | undefined;
}) {
  const pickTarget =
    onAppearanceTargetSelect ?
      (target: AppearanceSelectionTarget, event: MouseEvent) => {
        event.stopPropagation();
        onAppearanceTargetSelect(target);
      }
    : undefined;

  if (services.length === 0) {
    return (
      <div
        className="rounded-2xl border p-6 text-center"
        style={{
          backgroundColor: appearance.service_background,
          borderColor: appearance.service_border,
          color: appearance.service_text,
        }}
      >
        <Heart className="mx-auto mb-2 size-5" fill="currentColor" style={{ color: appearance.wave_color }} />
        <p className="font-semibold" style={{ ...serifDisplay, color: appearance.service_name_text }}>
          Nenhum serviço disponível no momento.
        </p>
        <p className="mt-2 text-sm">Volte mais tarde para conferir novos horários e serviços.</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative grid gap-2 sm:gap-3">
        {services.map((service) => (
        <article
          key={service.id}
          className="flex min-w-0 cursor-pointer items-center gap-3 rounded-[18px] border p-[7px] sm:gap-[18px] sm:p-[9px] bf-enter"
          style={{
            backgroundColor: appearance.service_background,
            borderColor: appearance.service_border,
            boxShadow: "0 3px 16px rgba(163, 52, 85, 0.05)",
          }}
          onClick={() => onSelect(service)}
        >
          {service.image_url ? (
            <img
              src={service.image_url}
              alt=""
              loading="lazy"
              className="h-[100px] w-[92px] shrink-0 cursor-pointer rounded-xl object-cover sm:h-[116px] sm:w-[130px]"
              onClick={(event) => {
                if (pickTarget) pickTarget("service-images", event);
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              className="h-[100px] w-[92px] shrink-0 rounded-xl sm:h-[116px] sm:w-[130px]"
              style={{
                background: `linear-gradient(145deg, ${appearance.page_gradient_start}, ${appearance.page_gradient_end})`,
              }}
              onClick={(event) => {
                if (pickTarget) pickTarget("service-images", event);
              }}
            />
          )}
          <div className="min-w-0 flex-1 pr-0.5">
            <div
              className="mb-3 text-[15px] leading-[1.35] font-bold sm:mb-[17px] sm:text-[19px]"
              style={{ color: appearance.service_name_text }}
              onClick={(event) => {
                if (pickTarget) pickTarget("service-name", event);
              }}
            >
              {service.name}
            </div>
            {service.description ? (
              <p
                className="m-0 mb-2 text-[13.6px] leading-[1.25]"
                style={{ color: appearance.service_text }}
              >
                {service.description}
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-1.5 sm:gap-2.5">
              <div className="flex flex-col gap-1">
                {service.show_price ? (
                  <span
                    className="cursor-pointer text-base font-bold whitespace-nowrap sm:text-[21px]"
                    style={{ color: appearance.service_price_text }}
                    onClick={(event) => {
                      if (pickTarget) pickTarget("service-price", event);
                    }}
                  >
                    {formatPrice(service.price_cents)}
                  </span>
                ) : null}
                {service.show_duration ? (
                  <span
                    className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] font-medium sm:text-[15px]"
                    style={{ color: appearance.service_price_text }}
                    onClick={(event) => {
                      if (pickTarget) pickTarget("service-price", event);
                    }}
                  >
                    <Clock className="size-[17px] shrink-0" strokeWidth={1.8} />
                    {service.duration_minutes} min
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="flex h-10 shrink-0 items-center gap-2 rounded-[15px] px-3 text-sm font-medium sm:h-11 sm:px-4 sm:text-base"
                style={{
                  backgroundColor: appearance.modal_active_background,
                  color: appearance.modal_active_text,
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (onAgendarPreview) onAgendarPreview();
                  else onSelect(service);
                }}
              >
                <CalendarDays className="size-[19px]" />
                Agendar
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
    </>
  );
}