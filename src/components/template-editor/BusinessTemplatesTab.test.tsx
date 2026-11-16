import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BusinessTemplateCard } from "./BusinessTemplatesTab";
import type { OutreachDesign } from "@/lib/outreach-design";

const design: OutreachDesign = {
  version: 1,
  width: 1080,
  height: 1080,
  background: "#101828",
  layers: [],
};

describe("BusinessTemplateCard", () => {
  it("opens the selected business art in the visual editor", () => {
    const html = renderToStaticMarkup(
      <BusinessTemplateCard template={{ id: "art-id", title: "Promocao", design }} />,
    );

    expect(html).toContain('href="/editor-template/art-id"');
    expect(html).toContain("Editar arte");
    expect(html).toContain("Promocao");
  });
});
