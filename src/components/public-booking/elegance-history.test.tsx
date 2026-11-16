import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PANEL1_APPEARANCE } from "@/lib/panel1-config";
import { EleganceHistoryList } from "./elegance-history";

describe("EleganceHistoryList: falha ao carregar", () => {
  it("mostra erro recuperável em vez de afirmar que não há agendamentos", () => {
    const html = renderToStaticMarkup(
      createElement(EleganceHistoryList, {
        slug: "studio",
        bookings: [],
        appearance: DEFAULT_PANEL1_APPEARANCE,
        modalText: "#222222",
        timezone: "America/Sao_Paulo",
        serviceImageUrl: () => null,
        cancellationEnabled: false,
        rescheduleEnabled: false,
        cancelPending: false,
        reschedulePending: false,
        onCancel: () => {},
        onReschedule: async () => {},
        onOpenCharge: () => {},
        loadError: true,
        onRetry: () => {},
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Não foi possível carregar seus agendamentos.");
    expect(html).toContain("Tentar novamente");
    expect(html).not.toContain("Nenhum agendamento");
    expect(html).not.toContain("Nenhum agendamento por aqui ainda.");
  });
});
