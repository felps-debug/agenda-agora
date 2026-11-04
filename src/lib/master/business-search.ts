/** Busca de estabelecimentos do Painel 3 Master (nome, responsável ou telefone). */

export type SearchableBusiness = {
  name: string;
  ownerName?: string | null;
  phone?: string | null;
};

/** Compara texto sem diferenciar acentos nem maiúsculas/minúsculas. */
export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Retorna `true` quando o estabelecimento casa com o termo digitado.
 *
 * Cuidado: o telefone só entra na comparação quando a busca tem dígitos.
 * Comparar com uma string vazia (`phone.includes("")`) casaria com todos os
 * registros e anularia a busca por texto.
 */
export function matchesBusinessSearch(business: SearchableBusiness, search: string) {
  const term = normalizeSearchText(search.trim());
  if (!term) return true;

  const digits = search.replace(/\D/g, "");
  const phoneDigits = (business.phone ?? "").replace(/\D/g, "");

  return (
    normalizeSearchText(business.name).includes(term) ||
    normalizeSearchText(business.ownerName ?? "").includes(term) ||
    (digits.length > 0 && phoneDigits.includes(digits))
  );
}
