import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => ({ assets: {} }),
  }),
}));
vi.mock("@/lib/business", () => ({ useBusiness: () => ({ businessId: "business-1" }) }));
vi.mock("@/lib/niche-assets", () => ({ listNicheAssets: vi.fn() }));
vi.mock("@/components/painel/PageHeader", () => ({ NoBusiness: () => null }));
vi.mock("@/components/painel/AgpayBackground", () => ({ AgpayBackground: () => null }));
vi.mock("@/components/template-editor/BusinessTemplatesTab", () => ({
  BusinessTemplatesTab: () => null,
}));

const { Route } = await import("./painel.templates");
const Page = Route.options.component as React.ComponentType;

describe("vitrine de templates", () => {
  it("links Como Funciona to its explanation", () => {
    const html = renderToStaticMarkup(React.createElement(Page));

    expect(html).toMatch(
      /<a\b[^>]*href="#templates-como-funciona"[^>]*>[\s\S]*?Como Funciona[\s\S]*?<\/a>/,
    );
    expect(html).toContain('id="templates-como-funciona"');
  });
});
