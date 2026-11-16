import { describe, expect, it } from "vitest";
import { mergeAppointmentCustomers } from "./customer-list";

describe("mergeAppointmentCustomers", () => {
  it("deriva clientes de reservas e mescla por telefone sem duplicar", () => {
    const rows = mergeAppointmentCustomers(
      [{ id: "manual", name: "Ana Silva", phone: "+55 (11) 99999-0000" }],
      [
        {
          customer_id: null,
          customer_name: "Ana",
          customer_phone: "5511999990000",
          starts_at: "2026-09-20T10:00:00Z",
          status: "concluido",
        },
        {
          customer_id: null,
          customer_name: "Bia Costa",
          customer_phone: "(85) 98888-1111",
          starts_at: "2026-09-22T10:00:00Z",
          status: "concluido",
        },
        {
          customer_id: null,
          customer_name: "Bia Costa",
          customer_phone: "(85) 98888-1111",
          starts_at: "2026-09-25T10:00:00Z",
          status: "concluido",
        },
      ],
    );
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === "manual")?.lastAppointmentAt).toBe("2026-09-20T10:00:00Z");
    expect(rows.find((row) => row.name === "Bia Costa")?.lastAppointmentAt).toBe(
      "2026-09-25T10:00:00Z",
    );
  });

  it("usa somente reservas concluídas como data do último atendimento", () => {
    const appointments = [
      {
        customer_id: "manual",
        customer_name: "Ana Silva",
        customer_phone: "+55 11 99999-0000",
        starts_at: "2026-09-20T10:00:00Z",
        status: "concluido",
      },
      {
        customer_id: "manual",
        customer_name: "Ana Silva",
        customer_phone: "+55 11 99999-0000",
        starts_at: "2026-09-29T10:00:00Z",
        status: "agendado",
      },
      {
        customer_id: null,
        customer_name: "Bia Costa",
        customer_phone: "(85) 98888-1111",
        starts_at: "2026-09-25T10:00:00Z",
        status: "cancelado",
      },
    ] as unknown as Parameters<typeof mergeAppointmentCustomers>[1];
    const rows = mergeAppointmentCustomers(
      [{ id: "manual", name: "Ana Silva", phone: "+55 (11) 99999-0000" }],
      appointments,
    );

    expect(rows.find((row) => row.id === "manual")?.lastAppointmentAt).toBe("2026-09-20T10:00:00Z");
    expect(rows.find((row) => row.name === "Bia Costa")?.lastAppointmentAt).toBeNull();
  });
});
