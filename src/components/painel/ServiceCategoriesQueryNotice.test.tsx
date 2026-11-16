import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ServiceCategoriesQueryNotice } from "./ServiceCategoriesQueryNotice";

describe("ServiceCategoriesQueryNotice", () => {
  it("separa carregamento do estado vazio", () => {
    const html = renderToStaticMarkup(
      <ServiceCategoriesQueryNotice isLoading isError={false} isFetching onRetry={vi.fn()} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Carregando categorias");
  });

  it("mostra erro recuperável com ação de retry", () => {
    const html = renderToStaticMarkup(
      <ServiceCategoriesQueryNotice
        isLoading={false}
        isError
        isFetching={false}
        onRetry={vi.fn()}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Tentar novamente");
  });

  it("não mostra aviso quando os dados foram carregados", () => {
    expect(
      renderToStaticMarkup(
        <ServiceCategoriesQueryNotice
          isLoading={false}
          isError={false}
          isFetching={false}
          onRetry={vi.fn()}
        />,
      ),
    ).toBe("");
  });
});
