import { describe, expect, it, vi } from "vitest";

// T037 (spec 002): gravação de serviço com sinal fixo/percentual validada no servidor.

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

const { buildServiceRow, saveServiceForOwner, saveServiceInput } =
  await import("./services.functions");
type SaveServiceInput = import("./services.functions").SaveServiceInput;

const BUSINESS = "0b000000-0000-4000-8000-00000000000a";
const OTHER_BUSINESS = "0b000000-0000-4000-8000-00000000000b";
const SERVICE = "0d000000-0000-4000-8000-0000000000a1";

const input = (overrides: Partial<SaveServiceInput> = {}): SaveServiceInput => ({
  businessId: BUSINESS,
  name: "Corte",
  durationMinutes: 30,
  priceCents: 10_000,
  requiresDeposit: true,
  depositMode: "fixed",
  depositCents: 2_500,
  depositPercentBps: 0,
  description: null,
  isCombo: false,
  showPrice: true,
  showDuration: true,
  showService: true,
  imagePath: null,
  ...overrides,
});

describe("buildServiceRow", () => {
  it("modo percentual grava deposit_cents como sombra do valor calculado", () => {
    const row = buildServiceRow(
      input({ depositMode: "percent", depositPercentBps: 1_000, depositCents: 999 }),
    );
    expect(row).toMatchObject({
      deposit_mode: "percent",
      deposit_percent_bps: 1_000,
      deposit_cents: 1_000,
    });
  });

  it("aceita payload sem opções de exibição e assume todas como verdadeiras", () => {
    const {
      showPrice: _price,
      showDuration: _duration,
      showService: _service,
      ...payload
    } = input();
    expect(saveServiceInput.parse(payload)).toMatchObject({
      showPrice: true,
      showDuration: true,
      showService: true,
    });
  });

  it("arredonda a sombra para centavos inteiros", () => {
    const row = buildServiceRow(
      input({ priceCents: 40_006, depositMode: "percent", depositPercentBps: 1_250 }),
    );
    expect(row.deposit_cents).toBe(5_001);
  });

  it("modo fixo mantém o valor informado", () => {
    expect(buildServiceRow(input()).deposit_cents).toBe(2_500);
  });

  it("0% gera sombra zero", () => {
    expect(
      buildServiceRow(
        input({ requiresDeposit: false, depositMode: "percent", depositPercentBps: 0 }),
      ).deposit_cents,
    ).toBe(0);
  });

  it("recusa imagem de outro negócio", () => {
    expect(() =>
      buildServiceRow(input({ imagePath: `${OTHER_BUSINESS}/services/foto.png` })),
    ).toThrow(/não pertence/);
    expect(buildServiceRow(input({ imagePath: `${BUSINESS}/services/foto.png` })).image_path).toBe(
      `${BUSINESS}/services/foto.png`,
    );
  });

  it("recusa sinal fixo abaixo do mínimo Pix de R$ 5,00", () => {
    expect(() => buildServiceRow(input({ depositMode: "fixed", depositCents: 499 }))).toThrow(
      /R\$ 5,00/,
    );
    expect(() => buildServiceRow(input({ depositMode: "fixed", depositCents: 1 }))).toThrow(
      /R\$ 5,00/,
    );
  });

  it("recusa sinal percentual efetivo abaixo de R$ 5,00", () => {
    expect(() =>
      buildServiceRow(
        input({ priceCents: 1_000, depositMode: "percent", depositPercentBps: 1_000 }),
      ),
    ).toThrow(/R\$ 5,00/);
  });

  it("aceita sinal zero quando o serviço não exige sinal", () => {
    expect(() =>
      buildServiceRow(input({ requiresDeposit: false, depositMode: "fixed", depositCents: 0 })),
    ).not.toThrow();
  });

  it("recusa sinal zero quando o serviço exige sinal com mensagem clara", () => {
    expect(() => buildServiceRow(input({ depositMode: "fixed", depositCents: 0 }))).toThrow(
      "Informe um valor de sinal maior que R$ 0,00 ou desative a exigência de sinal.",
    );
  });

  it("não bloqueia sinal baixo quando requiresDeposit=false", () => {
    expect(() =>
      buildServiceRow(input({ requiresDeposit: false, depositMode: "fixed", depositCents: 1 })),
    ).not.toThrow();
  });

  it("aceita sinal fixo de exatamente R$ 5,00", () => {
    expect(() => buildServiceRow(input({ depositMode: "fixed", depositCents: 500 }))).not.toThrow();
  });
});

describe("saveServiceInput (validação no servidor)", () => {
  it.each([
    ["percentual negativo", { depositPercentBps: -1 }],
    ["percentual acima de 100%", { depositPercentBps: 10_001 }],
    ["pontos-base fracionários", { depositPercentBps: 12.5 }],
    ["preço negativo", { priceCents: -1 }],
    ["sinal fixo negativo", { depositCents: -1 }],
    ["modo desconhecido", { depositMode: "livre" }],
  ])("recusa %s", (_label, overrides) => {
    expect(() => saveServiceInput.parse({ ...input(), ...overrides })).toThrow();
  });

  it("aceita 0% e 100%", () => {
    expect(() =>
      saveServiceInput.parse(input({ depositMode: "percent", depositPercentBps: 0 })),
    ).not.toThrow();
    expect(() =>
      saveServiceInput.parse(input({ depositMode: "percent", depositPercentBps: 10_000 })),
    ).not.toThrow();
  });
});

function fakeSupabase(options: {
  owner: boolean;
  serviceFound?: boolean;
  imageBytes?: Uint8Array;
}) {
  const writes: Array<{ op: string; row: Record<string, unknown>; filters: unknown[][] }> = [];
  const from = vi.fn((table: string) => {
    const filters: unknown[][] = [];
    let op = "select";
    let row: Record<string, unknown> = {};
    const query = {
      select: () => query,
      insert: (r: Record<string, unknown>) => ((op = "insert"), (row = r), query),
      update: (r: Record<string, unknown>) => ((op = "update"), (row = r), query),
      eq: (column: string, value: unknown) => (filters.push([column, value]), query),
      maybeSingle: async () => settle(),
      single: async () => settle(),
    };
    const settle = () => {
      if (table === "businesses") {
        return { data: options.owner ? { id: BUSINESS } : null, error: null };
      }
      writes.push({ op, row, filters });
      if (op === "update" && options.serviceFound === false) return { data: null, error: null };
      return { data: { id: SERVICE }, error: null };
    };
    return query;
  });
  const download = vi.fn(async () => ({
    data: options.imageBytes ? new Blob([new Uint8Array(options.imageBytes).buffer]) : null,
    error: options.imageBytes ? null : new Error("Imagem não encontrada"),
  }));
  return {
    client: { from, storage: { from: () => ({ download }) } } as never,
    writes,
    download,
  };
}

describe("saveServiceForOwner", () => {
  it("confere no servidor a assinatura da imagem do serviço antes de gravar", async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const db = fakeSupabase({ owner: true, imageBytes: png });
    await saveServiceForOwner(
      db.client,
      "user-dono",
      input({ imagePath: BUSINESS + "/services/photo.png" }),
    );
    expect(db.download).toHaveBeenCalledWith(BUSINESS + "/services/photo.png");
    expect(db.writes).toHaveLength(1);
  });

  it("recusa no servidor imagem de serviço com bytes inválidos", async () => {
    const db = fakeSupabase({ owner: true, imageBytes: new Uint8Array(500) });
    await expect(
      saveServiceForOwner(
        db.client,
        "user-dono",
        input({ imagePath: BUSINESS + "/services/photo.png" }),
      ),
    ).rejects.toThrow(/imagem PNG, JPEG ou WebP válida/);
    expect(db.writes).toEqual([]);
  });

  it("recusa quem não é dono antes de gravar", async () => {
    const db = fakeSupabase({ owner: false });
    await expect(saveServiceForOwner(db.client, "user-x", input())).rejects.toThrow(
      /Somente o dono/,
    );
    expect(db.writes).toEqual([]);
  });

  it("edição filtra por id e business_id e grava modo percentual com sombra", async () => {
    const db = fakeSupabase({ owner: true });
    await saveServiceForOwner(
      db.client,
      "user-dono",
      input({ id: SERVICE, depositMode: "percent", depositPercentBps: 1_000 }),
    );
    expect(db.writes[0]?.op).toBe("update");
    expect(db.writes[0]?.filters).toEqual([
      ["id", SERVICE],
      ["business_id", BUSINESS],
    ]);
    expect(db.writes[0]?.row).toMatchObject({
      deposit_mode: "percent",
      deposit_percent_bps: 1_000,
      deposit_cents: 1_000,
    });
  });

  it("serviço de outro negócio não é atualizado", async () => {
    const db = fakeSupabase({ owner: true, serviceFound: false });
    await expect(
      saveServiceForOwner(db.client, "user-dono", input({ id: SERVICE })),
    ).rejects.toThrow(/não encontrado/);
  });
});
