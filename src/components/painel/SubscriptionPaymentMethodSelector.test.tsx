import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubscriptionPaymentMethodSelector } from "./SubscriptionPaymentMethodSelector";

describe("SubscriptionPaymentMethodSelector", () => {
  it("oferece somente PIX enquanto checkout hospedado de cartão não existe", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionPaymentMethodSelector));

    expect(html).toContain("PIX");
    expect(html).not.toContain("Cartão");
    expect(html).not.toMatch(/cart[aã]o|CVV|n[uú]mero do cart[aã]o|CPF do titular/i);
    expect(html).not.toContain("<input");
  });
});
