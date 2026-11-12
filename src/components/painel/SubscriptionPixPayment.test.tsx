import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

/**
 * Pedido do cliente (áudio de 09/11): o card "Confirmar assinatura" NÃO pede CPF. Só o botão
 * "Continuar para PIX"; o CPF e o QR Code ficam num segundo pop-up aberto depois do clique.
 */

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: () => vi.fn(),
    };
    return builder;
  },
  useServerFn: (fn: unknown) => fn,
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({ hasSuperAdminRole: vi.fn() }));

const { SubscriptionPixPayment } = await import("./SubscriptionPixPayment");

function render() {
  const client = new QueryClient();
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(SubscriptionPixPayment, { businessId: "11111111-1111-4111-8111-111111111111" }),
    ),
  );
}

describe("SubscriptionPixPayment (card do pop-up de assinatura)", () => {
  it("mostra só o botão Continuar para PIX, sem campo de CPF", () => {
    const html = render();
    expect(html).toContain("Continuar para PIX");
    expect(html).not.toMatch(/CPF/i);
    expect(html).not.toContain("<input");
    expect(html).not.toContain('role="dialog"');
  });
});
