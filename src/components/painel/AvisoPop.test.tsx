import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvisoPop } from "./AvisoPop";

describe("identidade fixa do AvisoPop", () => {
  it("renderiza a estrutura acessível estilizada pelo tema do aviso", () => {
    const markup = renderToStaticMarkup(
      createElement(AvisoPop, {
        icon: createElement("span", null, "!"),
        title: "Atenção",
        onClose: () => {},
        children: "Mensagem de aviso",
      }),
    );
    const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");

    expect(markup).toContain('class="aa-aviso-pop');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Mensagem de aviso");
    expect(css).toMatch(/\.aa-aviso-pop\s*\{[^}]*--pop-accent:\s*#ff1764/s);
    expect(css).toContain(".aa-aviso-pop::after");
    expect(css).toContain(".aa-aviso-pop-progress");
  });
});
