import { useEffect, useState } from "react";
import type { Panel1Appearance } from "@/lib/panel1-config";

const CONSENT_KEY = "aa-cookie-consent-v1";

/**
 * Aviso de cookies do Painel 1: aparece UMA VEZ na primeira visita.
 * As cores acompanham a identidade da página EXATAMENTE como o pop-up de Pix:
 * fundo = "Fundo dos serviços", borda = "Borda do serviço", textos = cor do
 * nome do serviço, botão = "Fundo/Texto do botão" — nada fixo.
 */
export function CookieBanner({
  appearance,
}: {
  appearance: Panel1Appearance;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(CONSENT_KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  const accept = () => {
    try {
      window.localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      // Sem armazenamento: só fecha o aviso nesta visita.
    }
    setShow(false);
  };

  if (!show) return null;

  const popupBackground = appearance.service_background;
  const popupBorder = appearance.service_border;
  const titleColor = appearance.service_name_text;
  const textColor = appearance.service_name_text;
  const accent = appearance.modal_active_background;
  const accentText = appearance.modal_active_text;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div
        className="w-full max-w-xs rounded-2xl border p-5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
        style={{ backgroundColor: popupBackground, borderColor: popupBorder }}
      >
        <p className="text-center text-[13.5px] font-bold" style={{ color: titleColor }}>
          Utilizamos cookies no site!
        </p>
        <p
          className="mt-2 text-center text-[11px] leading-relaxed"
          style={{ color: textColor, opacity: 0.92 }}
        >
          Utilizamos cookies e coletamos algumas informações para personalizar sua experiência e
          melhorar nossos serviços e conteúdo. Ao continuar a navegação você concorda com essa
          coleta. Para mais detalhes, consulte nossa{" "}
          <a
            href="/politica-de-privacidade"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
            style={{ color: textColor }}
          >
            Política de privacidade
          </a>
          .
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={accept}
            className="rounded-lg border px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85"
            style={{ color: accentText, backgroundColor: accent, borderColor: accent }}
          >
            Concordo
          </button>
        </div>
      </div>
    </div>
  );
}
