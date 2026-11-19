import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubscriptionPaymentMethodSelector } from "./SubscriptionPaymentMethodSelector";

describe("SubscriptionPaymentMethodSelector", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("por padrão oferece só PIX, selecionado, e esconde o cartão", () => {
    vi.stubEnv("VITE_CARD_PAYMENT_ENABLED", "");
    const html = renderToStaticMarkup(createElement(SubscriptionPaymentMethodSelector));

    expect(html).toContain("PIX");
    expect(html).not.toContain("Cartão de crédito");
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>\s*<span[^>]*>PIX/);
  });

  it("com a flag ligada oferece PIX e Cartão de crédito", () => {
    vi.stubEnv("VITE_CARD_PAYMENT_ENABLED", "true");
    const html = renderToStaticMarkup(createElement(SubscriptionPaymentMethodSelector));

    expect(html).toContain("PIX");
    expect(html).toContain("Cartão de crédito");
  });

  it("com a flag ligada marca o cartão quando selecionado", () => {
    vi.stubEnv("VITE_CARD_PAYMENT_ENABLED", "true");
    const html = renderToStaticMarkup(
      createElement(SubscriptionPaymentMethodSelector, { value: "card" }),
    );
    expect(html).toMatch(/aria-checked="true"[^>]*>\s*<span[^>]*>Cartão de crédito/);
  });

  it("nunca renderiza campos de dados de cartão (checkout é hospedado)", () => {
    vi.stubEnv("VITE_CARD_PAYMENT_ENABLED", "true");
    const html = renderToStaticMarkup(createElement(SubscriptionPaymentMethodSelector));
    expect(html).not.toMatch(/CVV|n[uú]mero do cart[aã]o|CPF do titular/i);
    expect(html).not.toContain("<input");
  });
});
