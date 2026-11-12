import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { broadcastAccentVars } from "@/lib/broadcast";

export type AvisoPopTone = {
  color: string;
  background: string;
  border: string;
  glow: string;
};

/**
 * Pop-up padrão de avisos/notificações do painel — proporções, cores, fonte e
 * efeitos FIXOS (toast escuro com faixa neon lateral e linha no rodapé). Só a
 * mensagem, o tópico e o ícone variam conforme o aviso. O painel master pode
 * escolher a cor de destaque por notificação (`accent`) — a estrutura/proporção
 * permanece sempre a mesma. Fechar anima a saída para cima.
 */
export function AvisoPop({
  icon,
  tone,
  title,
  children,
  onClose,
  extraClass,
  accent,
  style,
}: {
  icon: ReactNode;
  tone?: AvisoPopTone | undefined;
  title?: string | undefined;
  children: ReactNode;
  onClose: () => void;
  extraClass?: string | undefined;
  /** Hex da cor de destaque escolhida no painel 3 (padrão: rosa). */
  accent?: string | undefined;
  /** Ajustes de posição (ex.: empilhar logo abaixo do popup de cima). */
  style?: CSSProperties | undefined;
}) {
  const [hiding, setHiding] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closed = useRef(false);

  // Fecha de verdade após a animação de saída (ou se o pai desmontar antes).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    return () => {
      // Desmontou no meio da animação de saída: cancela o timer, mas a dispensa já foi
      // pedida pelo usuário, então `onClose` roda agora (senão o aviso reaparece depois).
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
        onCloseRef.current();
      }
    };
  }, []);

  const dismiss = () => {
    if (closed.current || hiding) return;
    closed.current = true;
    setHiding(true);
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      onCloseRef.current();
    }, 230);
  };

  // Cor de destaque → variáveis CSS (só cor e efeitos mudam). `tone` segue na
  // API mas hoje a identidade visual é fixa por escolha do painel master.
  const palette = useMemo(
    () =>
      ({
        ...(tone
          ? {
              "--aviso-accent": tone.color,
              "--aviso-border": tone.border,
              "--aviso-glow": tone.glow,
            }
          : {}),
        ...(accent ? broadcastAccentVars(accent) : {}),
      }) as CSSProperties,
    [accent, tone],
  );

  return (
    <div
      className={`aa-aviso-pop ${hiding ? "is-hiding" : ""} ${extraClass ?? ""}`}
      role="status"
      style={{ ...palette, ...(style ?? {}) }}
    >
      <span className="aa-aviso-pop-icon">{icon}</span>
      <div className="aa-aviso-pop-body">
        {title ? <p className="aa-aviso-pop-title">{title}</p> : null}
        <div className="aa-aviso-pop-msg">{children}</div>
      </div>
      <button type="button" className="aa-aviso-pop-x" onClick={dismiss} aria-label="Fechar aviso">
        <X strokeWidth={2} aria-hidden="true" />
      </button>
      <span className="aa-aviso-pop-progress" aria-hidden="true" />
    </div>
  );
}
