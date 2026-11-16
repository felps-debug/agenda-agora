import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubscriptionPaymentMethodSelector } from "./SubscriptionPaymentMethodSelector";

describe("SubscriptionPaymentMethodSelector", () => {
  it("oferece PIX e Cartão de crédito, com PIX selecionado por padrão", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionPaymentMethodSelector));

    expect(html).toContain("PIX");
    expect(html).toContain("Cartão de crédito");
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>\s*<span[^>]*>PIX/);
  });

  it("marca o cartão quando selecionado", () => {
    const html = renderToStaticMarkup(
      createElement(SubscriptionPaymentMethodSelector, { value: "card" }),
    );
    expect(html).toMatch(/aria-checked="true"[^>]*>\s*<span[^>]*>Cartão de crédito/);
  });

  it("nunca renderiza campos de dados de cartão (checkout é hospedado)", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionPaymentMethodSelector));
    expect(html).not.toMatch(/CVV|n[uú]mero do cart[aã]o|CPF do titular/i);
    expect(html).not.toContain("<input");
  });
});
