export type CancellationAction = "solicitar" | "efetivar" | "reverter";

export function cancellationSuccessMessage(action: CancellationAction) {
  if (action === "solicitar") return "Cancelamento solicitado registrado.";
  if (action === "efetivar") return "Cancelamento efetivado.";
  return "Cancelamento revertido. A vigencia do plano continua determinando o acesso.";
}
