import { describe, expect, it } from "vitest";
import { filterTransactionRows } from "./transactions-filter";
import type { TransactionRow } from "./transactions.functions";

function row(overrides: Partial<TransactionRow>): TransactionRow {
  return {
    id: "#1",
    uuid: "uuid-1",
    kind: "deposit",
    clientName: "CLIENTE",
    email: "cliente@example.com",
    type: "PIX",
    grossCents: 1000,
    feeCents: 100,
    netCents: 900,
    status: "PENDENTE",
    date: "2026-11-14T12:00:00Z",
    businessId: "business-1",
    businessName: "Barbearia",
    ...overrides,
  };
}

const deposits = [
  row({ uuid: "deposit-pending", status: "PENDENTE", clientName: "ANA" }),
  row({ uuid: "deposit-paid", status: "PAGO", clientName: "BIA" }),
  row({ uuid: "deposit-failed", status: "FALHOU", clientName: "CAIO" }),
];
const withdrawals = [
  row({ kind: "withdrawal", type: "SAQUE", uuid: "withdrawal-requested", status: "REQUESTED" }),
  row({ kind: "withdrawal", type: "SAQUE", uuid: "withdrawal-paid", status: "PAID" }),
];

describe("filterTransactionRows", () => {
  it("applies type and deposit status and returns the unfiltered withdrawal tab when type is all", () => {
    const result = filterTransactionRows(
      { deposits, withdrawals },
      {
        search: "",
        type: "PIX",
        depositStatus: "Falhou",
        withdrawalStatus: "Todos",
      },
    );

    expect(result.deposits.map((item) => item.uuid)).toEqual(["deposit-failed"]);
    expect(result.withdrawals).toEqual([]);
  });

  it("filters pending withdrawals and search, and restores every row for all filters", () => {
    const filtered = filterTransactionRows(
      { deposits, withdrawals },
      {
        search: "request",
        type: "SAQUE",
        depositStatus: "Todos",
        withdrawalStatus: "Pendente",
      },
    );
    expect(filtered.deposits).toEqual([]);
    expect(filtered.withdrawals.map((item) => item.uuid)).toEqual(["withdrawal-requested"]);

    const cleared = filterTransactionRows(
      { deposits, withdrawals },
      {
        search: "",
        type: "Todos",
        depositStatus: "Todos",
        withdrawalStatus: "Todos",
      },
    );
    expect(cleared.deposits).toHaveLength(3);
    expect(cleared.withdrawals).toHaveLength(2);
  });
});
