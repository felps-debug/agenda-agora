import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  template: {
    id: "template-1",
    title: "Promoção de verão",
    design: {
      version: 1 as const,
      width: 320,
      height: 320,
      background: "#ffffff",
      layers: [],
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useParams: () => ({ id: "template-1" }),
  }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) =>
    queryKey[0] === "master-status"
      ? { data: { isMaster: true }, isLoading: false, isError: false, isSuccess: true }
      : { data: [runtime.template], isLoading: false, isError: false, isSuccess: true },
  useMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/business", () => ({ useBusiness: () => ({ businessId: null }) }));
vi.mock("@/lib/admin.functions", () => ({ getMasterStatus: vi.fn() }));
vi.mock("@/lib/outreach-templates.functions", () => ({
  listVisualOutreachTemplates: vi.fn(),
  saveBusinessOutreachOverride: vi.fn(),
  saveOutreachTemplateDesign: vi.fn(),
}));

const { Route } = await import("@/routes/_authenticated/editor-template.$id");

describe("download no editor de templates", () => {
  it("exibe a ação de baixar PNG junto das ações do editor", () => {
    const Page = Route.options.component as React.ComponentType;
    const markup = renderToStaticMarkup(React.createElement(Page));

    expect(markup).toContain("Baixar PNG");
    expect(markup).toContain("Salvar");
  });
});
