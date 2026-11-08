import { useEffect, useState } from "react";
import { avisoMarker, dismissAviso, shouldShowAviso, type AvisoTipo } from "@/lib/avisos-store";
import { dayKey } from "@/lib/day-key";

/** Reads browser state after hydration and refreshes on midnight, focus and other tabs. */
export function useAvisoDismissal(tipo: AvisoTipo, estagio: string) {
  const [visible, setVisible] = useState(false);
  const [closedMarker, setClosedMarker] = useState<string | null>(null);
  const [day, setDay] = useState("");
  useEffect(() => {
    const refresh = () => {
      setDay(dayKey());
      setVisible(shouldShowAviso(tipo, estagio));
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [tipo, estagio]);
  return {
    visible: visible && day !== "" && closedMarker !== `${tipo}:${estagio}:${day}`,
    dismiss: () => {
      dismissAviso(tipo, estagio);
      setClosedMarker(avisoMarker(tipo, estagio));
      setVisible(false);
    },
  };
}
