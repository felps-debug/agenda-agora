import type { CSSProperties, ReactNode } from "react";
import { X } from "lucide-react";

export type AvisoPopTone = {
  color: string;
  background: string;
  border: string;
  glow: string;
};

/**
 * Pop-up padrão de avisos/notificações do painel — proporções, cores, fonte e
 * efeitos FIXOS (card escuro + neon no contorno superior). Só a mensagem, o
 * tópico e o ícone variam conforme o aviso.
 */
export function AvisoPop({
  icon,
  tone,
  title,
  children,
  onClose,
  extraClass,
}: {
  icon: ReactNode;
  tone?: AvisoPopTone | undefined;
  title?: string | undefined;
  children: ReactNode;
  onClose: () => void;
  extraClass?: string | undefined;
}) {
  return (
    <div
      className={`aa-aviso-pop ${extraClass ?? ""}`}
      role="status"
      style={
        {
          "--aviso-accent": tone?.color ?? "#69a2ff",
          "--aviso-border": tone?.border ?? "rgba(51, 125, 255, 0.35)",
          "--aviso-glow": tone?.glow ?? "rgba(22, 119, 255, 0.22)",
          "--aviso-icon-color": tone?.color ?? "#69a2ff",
          "--aviso-icon-bg": tone?.background ?? "rgba(22, 119, 255, 0.09)",
          "--aviso-icon-border": tone?.border ?? "rgba(51, 125, 255, 0.29)",
          "--aviso-icon-glow": tone?.glow ?? "rgba(22, 119, 255, 0.22)",
        } as CSSProperties
      }
    >
      <span className="aa-aviso-pop-icon">{icon}</span>
      <div className="aa-aviso-pop-body">
        {title ? <p className="aa-aviso-pop-title">{title}</p> : null}
        <div className="aa-aviso-pop-msg">{children}</div>
      </div>
      <button
        type="button"
        className="aa-aviso-pop-x"
        onClick={onClose}
        aria-label="Fechar aviso"
      >
        <X className="size-4" strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
}
