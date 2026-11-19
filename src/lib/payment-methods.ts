/**
 * Cartão de crédito na assinatura fica DESLIGADO até a adquirente (VeoPag via AgPay) liberar
 * o cartão na conta da plataforma. Hoje o AgPay responde "Cartão não habilitado nesta conta"
 * (403). Para religar depois de liberado: defina VITE_CARD_PAYMENT_ENABLED=true no ambiente
 * e faça um novo build/deploy. O código do cartão (checkout hospedado) continua no projeto.
 */
export function cardPaymentEnabled(): boolean {
  return import.meta.env["VITE_CARD_PAYMENT_ENABLED"] === "true";
}
