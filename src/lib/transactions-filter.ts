import type { TransactionRow } from "./transactions.functions";

export type TransactionFilters = {
  search: string;
  type: string;
  depositStatus: string;
  withdrawalStatus: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
}

function matchesStatus(status: string, selected: string, kind: "deposit" | "withdrawal") {
  if (selected === "Todos") return true;
  const value = normalize(status);
  if (kind === "deposit") {
    if (selected === "Aguardando") return value.includes("PEND") || value.includes("AGUARDANDO");
    if (selected === "Pago") return value === "PAGO" || value === "PAID";
    if (selected === "Falhou")
      return ["FALH", "FAIL", "EXPIR", "REJECT"].some((part) => value.includes(part));
    return true;
  }
  if (selected === "Pendente")
    return ["PEND", "REQUESTED", "PROCESSING", "SOLICIT"].some((part) => value.includes(part));
  if (selected === "Concluído")
    return ["CONCL", "COMPLET", "PAID", "DONE"].some((part) => value.includes(part));
  return true;
}

function matchesSearch(row: TransactionRow, search: string) {
  const term = normalize(search.trim());
  if (!term) return true;
  return [row.clientName, row.email, row.id, row.uuid].some((value) =>
    normalize(value).includes(term),
  );
}

export function filterTransactionRows(
  rows: { deposits: TransactionRow[]; withdrawals: TransactionRow[] },
  filters: TransactionFilters,
) {
  return {
    deposits:
      filters.type === "SAQUE"
        ? []
        : rows.deposits.filter(
            (row) =>
              matchesStatus(row.status, filters.depositStatus, "deposit") &&
              matchesSearch(row, filters.search),
          ),
    withdrawals:
      filters.type === "PIX"
        ? []
        : rows.withdrawals.filter(
            (row) =>
              matchesStatus(row.status, filters.withdrawalStatus, "withdrawal") &&
              matchesSearch(row, filters.search),
          ),
  };
}
