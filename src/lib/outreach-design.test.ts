import { describe, expect, it } from "vitest";
import {
  OUTREACH_DESIGN_MAX_BYTES,
  OUTREACH_ICON_KEYS,
  parseOutreachDesign,
  validateOutreachPlaceholders,
} from "./outreach-design";

const design = {
  version: 1,
  width: 1080,
  height: 1080,
  background: "#ffffff",
  layers: [
    {
      id: "headline",
      type: "text",
      x: 40,
      y: 40,
      width: 900,
      height: 120,
      text: "Agenda aberta para {nome_empresa}",
      color: "#111111",
      font: "inter",
      fontSize: 56,
    },
  ],
};

describe("outreach design schema", () => {
  it("aceita documento válido e preenche atributos padrão", () => {
    expect(parseOutreachDesign(design).layers[0]).toMatchObject({ rotation: 0, opacity: 1 });
  });

  it("rejeita fontes, ícones e tipos de camada fora da lista fechada", () => {
    expect(() =>
      parseOutreachDesign({
        ...design,
        layers: [{ ...design.layers[0], font: "comic-sans" }],
      }),
    ).toThrow();
    expect(() =>
      parseOutreachDesign({
        ...design,
        layers: [{ ...design.layers[0], type: "video" }],
      }),
    ).toThrow();
  });

  it("limita o tamanho do JSON persistido", () => {
    const oversized = {
      ...design,
      layers: [{ ...design.layers[0], text: "x".repeat(OUTREACH_DESIGN_MAX_BYTES) }],
    };
    expect(() => parseOutreachDesign(oversized)).toThrow("excede o limite");
  });
});

describe("imagem de fundo (backgroundImage)", () => {
  it("aceita uma data URI PNG/JPEG/WebP válida", () => {
    expect(() =>
      parseOutreachDesign({ ...design, backgroundImage: "data:image/png;base64,aGVsbG8=" }),
    ).not.toThrow();
  });

  it("aceita ausência de imagem de fundo (null ou omitido)", () => {
    expect(() => parseOutreachDesign({ ...design, backgroundImage: null })).not.toThrow();
    expect(parseOutreachDesign(design).backgroundImage).toBeUndefined();
  });

  it("rejeita valores que não são data URI de imagem", () => {
    expect(() =>
      parseOutreachDesign({ ...design, backgroundImage: "https://example.com/foto.png" }),
    ).toThrow();
    expect(() =>
      parseOutreachDesign({ ...design, backgroundImage: "data:text/plain;base64,aGVsbG8=" }),
    ).toThrow();
  });
});

describe("OUTREACH_ICON_KEYS (spec 007, US3)", () => {
  const legacyKeys = [
    "scissors",
    "calendar",
    "clock",
    "star",
    "sparkles",
    "map-pin",
    "phone",
    "whatsapp",
  ] as const;

  it("preserva as 8 chaves antigas (artes já salvas continuam válidas)", () => {
    for (const key of legacyKeys) expect(OUTREACH_ICON_KEYS).toContain(key);
  });

  it("expande para 16-20 ícones no total, de forma só aditiva", () => {
    expect(OUTREACH_ICON_KEYS.length).toBeGreaterThanOrEqual(16);
    expect(OUTREACH_ICON_KEYS.length).toBeLessThanOrEqual(20);
  });

  it("aceita uma arte antiga com ícone de uma das 8 chaves legadas", () => {
    const withIcon = {
      ...design,
      layers: [
        {
          id: "icon-1",
          type: "icon",
          x: 10,
          y: 10,
          width: 64,
          height: 64,
          iconKey: "whatsapp",
          color: "#25D366",
        },
      ],
    };
    expect(() => parseOutreachDesign(withIcon)).not.toThrow();
  });

  it("aceita uma das novas chaves de ícone", () => {
    const withNewIcon = {
      ...design,
      layers: [
        {
          id: "icon-2",
          type: "icon",
          x: 10,
          y: 10,
          width: 64,
          height: 64,
          iconKey: "flame",
          color: "#ff5500",
        },
      ],
    };
    expect(() => parseOutreachDesign(withNewIcon)).not.toThrow();
  });
});

describe("limites persistidos do design (spec 007, Foundational)", () => {
  it("aceita width/height do design entre 320 e 4000 e rejeita fora do intervalo", () => {
    expect(() => parseOutreachDesign({ ...design, width: 320, height: 4000 })).not.toThrow();
    expect(() => parseOutreachDesign({ ...design, width: 319 })).toThrow();
    expect(() => parseOutreachDesign({ ...design, height: 4001 })).toThrow();
  });

  it("aceita até 100 camadas e rejeita 101", () => {
    const layer = { ...design.layers[0]!, id: "l" };
    const upToLimit = {
      ...design,
      layers: Array.from({ length: 100 }, (_, i) => ({ ...layer, id: `l${i}` })),
    };
    const overLimit = {
      ...design,
      layers: Array.from({ length: 101 }, (_, i) => ({ ...layer, id: `l${i}` })),
    };
    expect(() => parseOutreachDesign(upToLimit)).not.toThrow();
    expect(() => parseOutreachDesign(overLimit)).toThrow();
  });

  it("mantém x/y da camada em 0..4000 e width/height positivos até 4000", () => {
    const base = design.layers[0]!;
    expect(() =>
      parseOutreachDesign({ ...design, layers: [{ ...base, x: 0, y: 4000 }] }),
    ).not.toThrow();
    expect(() => parseOutreachDesign({ ...design, layers: [{ ...base, x: -1 }] })).toThrow();
    expect(() => parseOutreachDesign({ ...design, layers: [{ ...base, y: 4001 }] })).toThrow();
    expect(() => parseOutreachDesign({ ...design, layers: [{ ...base, width: 0 }] })).toThrow();
    expect(() => parseOutreachDesign({ ...design, layers: [{ ...base, width: 4001 }] })).toThrow();
  });

  it("mantém fontSize entre 8 e 300", () => {
    const base = design.layers[0]!;
    expect(() =>
      parseOutreachDesign({ ...design, layers: [{ ...base, fontSize: 8 }] }),
    ).not.toThrow();
    expect(() =>
      parseOutreachDesign({ ...design, layers: [{ ...base, fontSize: 300 }] }),
    ).not.toThrow();
    expect(() => parseOutreachDesign({ ...design, layers: [{ ...base, fontSize: 7 }] })).toThrow();
    expect(() =>
      parseOutreachDesign({ ...design, layers: [{ ...base, fontSize: 301 }] }),
    ).toThrow();
  });

  it("exige cores no formato #rrggbb", () => {
    const base = design.layers[0]!;
    expect(() =>
      parseOutreachDesign({ ...design, layers: [{ ...base, color: "#111111" }] }),
    ).not.toThrow();
    expect(() => parseOutreachDesign({ ...design, layers: [{ ...base, color: "red" }] })).toThrow();
    expect(() => parseOutreachDesign({ ...design, background: "#zzzzzz" })).toThrow();
  });

  it("preserva a ordem das camadas ao validar", () => {
    const withOrder = {
      ...design,
      layers: [
        { ...design.layers[0]!, id: "first" },
        { ...design.layers[0]!, id: "second" },
      ],
    };
    const parsed = parseOutreachDesign(withOrder);
    expect(parsed.layers.map((l) => l.id)).toEqual(["first", "second"]);
  });
});

describe("placeholders permitidos", () => {
  it("aceita os placeholders definidos e texto sem placeholder", () => {
    expect(validateOutreachPlaceholders("Oi {nome_empresa}, veja {link_publico}")).toBe(true);
    expect(validateOutreachPlaceholders("Agenda aberta hoje")).toBe(true);
  });

  it("rejeita tokens desconhecidos", () => {
    expect(validateOutreachPlaceholders("Oi {segredo}")).toBe(false);
  });
});
