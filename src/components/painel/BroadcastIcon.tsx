import {
  BellRing,
  CalendarCheck,
  Gift,
  Info,
  Megaphone,
  PartyPopper,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

/** Opções de ícone do pop-up de notificação (painel master → painel 2). */
export const BROADCAST_ICON_OPTIONS = [
  { key: "sino", label: "Sino", Icon: BellRing, strokeWidth: 1.8 },
  { key: "alerta", label: "Alerta", Icon: TriangleAlert, strokeWidth: 1.9 },
  { key: "info", label: "Informação", Icon: Info, strokeWidth: 1.8 },
  { key: "megafone", label: "Megafone", Icon: Megaphone, strokeWidth: 1.8 },
  { key: "presente", label: "Presente", Icon: Gift, strokeWidth: 1.8 },
  { key: "novidade", label: "Novidade", Icon: Sparkles, strokeWidth: 1.8 },
  { key: "festa", label: "Festivo", Icon: PartyPopper, strokeWidth: 1.8 },
  { key: "agenda", label: "Agenda", Icon: CalendarCheck, strokeWidth: 1.8 },
] as const;

export type BroadcastIconOption = {
  key: string;
  label: string;
  Icon: LucideIcon;
  strokeWidth: number;
};

export const BROADCAST_DEFAULT_ICON_KEY = "sino";

/** Resolve a opção de ícone pela chave da notificação (padrão: sino). */
export function broadcastIconOption(key?: string | null): BroadcastIconOption {
  return (
    BROADCAST_ICON_OPTIONS.find((option) => option.key === key) ??
    BROADCAST_ICON_OPTIONS.find((option) => option.key === BROADCAST_DEFAULT_ICON_KEY)!
  );
}
