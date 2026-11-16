export function isBusinessActive(status: string): boolean {
  return status === "ativo";
}

export function businessStatusLabel(status: string): string {
  switch (status) {
    case "ativo":
      return "Ativo";
    case "suspenso":
      return "Suspenso";
    case "cancelado":
      return "Cancelado";
    default:
      return "Desconhecido";
  }
}
