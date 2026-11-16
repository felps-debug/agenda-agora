import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerListQueryNotice } from "./CustomerListQueryNotice";

describe("CustomerListQueryNotice", () => {
  it("distingue carregamento inicial do estado vazio", () => {
    const html = renderToStaticMarkup(
      <CustomerListQueryNotice isLoading isError={false} isFetching onRetry={vi.fn()} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Carregando clientes");
  });

  it("oferece retry quando alguma consulta falha", () => {
    const html = renderToStaticMarkup(
      <CustomerListQueryNotice isLoading={false} isError isFetching={false} onRetry={vi.fn()} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Tentar novamente");
  });

  it("não substitui uma resposta válida por aviso", () => {
    expect(
      renderToStaticMarkup(
        <CustomerListQueryNotice
          isLoading={false}
          isError={false}
          isFetching={false}
          onRetry={vi.fn()}
        />,
      ),
    ).toBe("");
  });
});
