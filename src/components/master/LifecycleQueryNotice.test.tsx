import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LifecycleQueryNotice } from "./LifecycleQueryNotice";

describe("LifecycleQueryNotice", () => {
  it("renders loading separately from the empty state", () => {
    const html = renderToStaticMarkup(
      <LifecycleQueryNotice
        isLoading
        isError={false}
        isFetching
        hasData={false}
        onRetry={vi.fn()}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Carregando dados das contas");
  });

  it("shows a retry action on error", () => {
    const html = renderToStaticMarkup(
      <LifecycleQueryNotice
        isLoading={false}
        isError
        isFetching={false}
        hasData={false}
        onRetry={vi.fn()}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Tentar novamente");
  });

  it("does not show a notice after a valid response", () => {
    expect(
      renderToStaticMarkup(
        <LifecycleQueryNotice
          isLoading={false}
          isError={false}
          isFetching={false}
          hasData
          onRetry={vi.fn()}
        />,
      ),
    ).toBe("");
  });
});
