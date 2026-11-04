import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PANEL1_APPEARANCE } from "@/lib/panel1-config";
import { EleganceBookingDialog, type EleganceBookingProfessional } from "./elegance-booking";

const noop = () => {};

function render(professionals: EleganceBookingProfessional[], professional: EleganceBookingProfessional | null) {
  return renderToStaticMarkup(
    createElement(EleganceBookingDialog, {
      asPreview: true,
      service: { name: "Corte", price_cents: 3000, duration_minutes: 30, show_price: true, show_duration: true },
      appearance: DEFAULT_PANEL1_APPEARANCE,
      pageBackground: "#ffffff",
      modalText: "#222222",
      modalActiveText: "#ffffff",
      onClose: noop,
      professionals,
      professional,
      onProfessionalChange: noop,
      days: [{ date: "2026-11-09", weekday: 1 }],
      date: "2026-11-09",
      onDateSelect: noop,
      time: null,
      onTimeSelect: noop,
      slots: ["09:00", "09:30"],
      slotsLoading: false,
      slotsError: false,
      formName: "",
      onNameChange: noop,
      formPhone: "",
      onPhoneChange: noop,
      formEmail: "",
      onEmailChange: noop,
      formCpfCnpj: "",
      onCpfCnpjChange: noop,
      needsDocument: false,
      formError: null,
      pending: false,
      onSubmit: noop,
      noteText: "",
    }),
  );
}

describe("EleganceBookingDialog: horários", () => {
  it("mostra os horários quando o negócio não tem profissional cadastrado", () => {
    const html = render([], null);
    expect(html).toContain("09:00");
    expect(html).toContain("09:30");
    expect(html).not.toContain("Profissional e horário");
  });

  it("com profissional escolhido, mostra o seletor e os horários", () => {
    const pro = { id: "p1", name: "Ana", role: null };
    const html = render([pro], pro);
    expect(html).toContain("Profissional e horário");
    expect(html).toContain("09:00");
  });
});
