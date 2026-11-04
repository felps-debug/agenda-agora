import * as React from "react";

/**
 * Duração da animação de saída. Deve casar com as classes
 * `.animate-modal-out` e `.animate-backdrop-out` definidas em styles.css.
 */
const EXIT_MS = 220;

/**
 * Controla a abertura e o fechamento de um modal/popup com animação de saída.
 *
 * Como os modais customizados (createPortal) são desmontados imediatamente ao
 * fechar, este hook mantém o elemento montado até a animação de saída terminar.
 *
 * - `isOpen`: mantenha o modal renderizado enquanto for `true`.
 * - `closing`: quando `true`, troque as classes de entrada pelas de saída
 *   (`animate-modal-out` / `animate-backdrop-out`) para a caixa desaparecer
 *   suavemente de cima para baixo.
 */
export function useAnimatedModal(exitMs: number = EXIT_MS) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const timer = React.useRef<number | null>(null);
  const closingRef = React.useRef(false);

  React.useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const open = React.useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    closingRef.current = false;
    setClosing(false);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timer.current = window.setTimeout(() => {
      closingRef.current = false;
      setIsOpen(false);
      setClosing(false);
    }, exitMs);
  }, [exitMs]);

  return { isOpen, closing, open, close };
}
