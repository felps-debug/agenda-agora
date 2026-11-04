import { CalendarDays } from "lucide-react";

/** Seções de SaaS do Painel 3 Master (barra inferior da referência de design). */
export type PlatformSection = "agendamentos" | "desempenho" | "atividade";

export const PLATFORM_SECTIONS: Array<{
  id: PlatformSection;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { id: "agendamentos", label: "Agendamentos", icon: CalendarDays },
  { id: "desempenho", label: "Desempenho", icon: CalendarDays },
  { id: "atividade", label: "Atividade", icon: CalendarDays },
];
