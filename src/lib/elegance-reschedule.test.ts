import { describe, expect, it } from "vitest";
import { getRescheduleAvailabilityInput, getRescheduleSlotsMessage } from "./elegance-reschedule";

describe("remarcação do histórico Elegance", () => {
  it("consulta horários para o mesmo profissional do agendamento", () => {
    expect(
      getRescheduleAvailabilityInput(
        "studio",
        { serviceId: "service-1", professionalId: "professional-1" },
        "2026-11-18",
      ),
    ).toEqual({
      slug: "studio",
      serviceId: "service-1",
      date: "2026-11-18",
      professionalId: "professional-1",
    });
  });

  it("mantém nulo para serviços sem profissional associado", () => {
    expect(
      getRescheduleAvailabilityInput(
        "studio",
        { serviceId: "service-1", professionalId: null },
        "2026-11-18",
      ),
    ).toMatchObject({ professionalId: null });
  });

  it("distingue falha de consulta de uma agenda vazia", () => {
    expect(
      getRescheduleSlotsMessage({ date: "2026-11-18", isFetching: false, isError: true }),
    ).toBe("Erro ao carregar horários");
    expect(
      getRescheduleSlotsMessage({
        date: "2026-11-18",
        isFetching: false,
        isError: false,
        slots: [],
      }),
    ).toBe("Sem horários");
  });
});
