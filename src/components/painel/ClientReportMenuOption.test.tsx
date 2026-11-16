import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TrendingUp } from "lucide-react";
import { ClientReportMenuOption } from "./ClientReportMenuOption";

describe("ClientReportMenuOption", () => {
  it("shows unavailable reports as disabled with a clear label", () => {
    const html = renderToStaticMarkup(
      <ClientReportMenuOption
        label="Comparativo Evolutivo"
        Icon={TrendingUp}
        color="text-green-500"
        unavailable
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain("Comparativo Evolutivo (em breve)");
    expect(html).toContain('aria-disabled="true"');
  });

  it("keeps available reports enabled", () => {
    const html = renderToStaticMarkup(
      <ClientReportMenuOption
        label="Aniversariantes"
        Icon={TrendingUp}
        color="text-purple-500"
        onSelect={vi.fn()}
      />,
    );

    expect(html).not.toContain('disabled=""');
    expect(html).toContain("Aniversariantes");
  });
});
