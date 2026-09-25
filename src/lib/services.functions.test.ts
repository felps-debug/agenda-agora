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
      buildServiceRow(input({ depositMode: "percent", depositPercentBps: 0 })).deposit_cents,
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

  it("recusa sinal fixo abaixo de R$ 5,00 (mínimo Pix do Asaas)", () => {
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

  it("aceita sinal zero (sem sinal) mesmo com requiresDeposit=true", () => {
    expect(() => buildServiceRow(input({ depositMode: "fixed", depositCents: 0 }))).not.toThrow();
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

function fakeSupabase(options: { owner: boolean; serviceFound?: boolean }) {
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
  return { client: { from } as never, writes };
}

describe("saveServiceForOwner", () => {
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
