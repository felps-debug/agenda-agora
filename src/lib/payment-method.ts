/**
 * "Finalizar serviço": a forma de pagamento escolhida pelo dono no momento de
 * concluir o atendimento fica gravada como marcador estruturado no campo
 * `notes` do agendamento (ex.: "[FORMA:pix]"), junto às anotações. O pop-up
 * "Serviço realizado" lê esse marcador e NUNCA deixa editar as informações.
 */

export const PAYMENT_METHODS = ["dinheiro", "pix", "debito", "credito"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Cartão Débito",
  credito: "Cartão Crédito",
};

const MARKER_RE = /\[FORMA:(dinheiro|pix|debito|credito)\]/;

/** Lê a forma de pagamento gravada no agendamento (null quando não há). */
export function paymentMethodFromNotes(notes: string | null | undefined): PaymentMethod | null {
  const match = MARKER_RE.exec(notes ?? "");
  return match ? (match[1] as PaymentMethod) : null;
}

/** Anotações sem os marcadores internos (FORMA/ENCAIXE): descrição legível. */
export function descriptionFromNotes(notes: string | null | undefined): string {
  const clean = (notes ?? "")
    .replace(/\[FORMA:(dinheiro|pix|debito|credito)\]\s?/g, "")
    .replace(/\[ENCAIXE\]\s?/g, "")
    .trim();
  return clean;
}

/** Monta as anotações com o marcador da forma de pagamento preservando o resto. */
export function notesWithPaymentMethod(notes: string | null | undefined, method: PaymentMethod): string {
  const base = descriptionFromNotes(notes);
  return base ? `[FORMA:${method}] ${base}` : `[FORMA:${method}]`;
}
