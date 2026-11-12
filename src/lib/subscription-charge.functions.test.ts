import { beforeEach, describe, expect, it, vi } from "vitest";
import { serverFnMock } from "@/test-support/fake-admin";

/**
 * US7 — Cobrança da assinatura por Pix.
 * Cobre o cálculo do valor (plano + cupom) e o fluxo de createSubscriptionCharge:
 * exige CPF do dono (decisão de produto) e cria a cobrança pendente via AgPay.
 */

const runtime = vi.hoisted(() => ({
  business: null as Record<string, unknown> | null,
  professionalsCount: 0,
  email: "dono@example.com" as string | null,
  pix: { providerPaymentId: "tx-1", qrCode: "PIXCODE", expiresAt: null } as Record<string, unknown>,
  inserted: null as Record<string, unknown> | null,
  cpfUpdate: null as { values: Record<string, unknown>; id: string } | null,
  isSuper: false,
  createPixCharge: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({ hasSuperAdminRole: vi.fn(async () => runtime.isSuper) }));
vi.mock("@/lib/agpay.server", () => ({
  createPixCharge: (...args: unknown[]) => runtime.createPixCharge(...args),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: { admin: { getUserById: async () => ({ data: { user: { email: runtime.email, user_metadata: {} } } }) } },
    from: (table: string) => {
      if (table === "professionals") {
        return { select: () => ({ eq: async () => ({ count: runtime.professionalsCount }) }) };
      }
      if (table === "businesses") {
        return {
          update: (values: Record<string, unknown>) => ({
            eq: async (_col: string, id: string) => {
              runtime.cpfUpdate = { values, id };
              return { error: null };
            },
          }),
        };
      }
      if (table === "subscription_charges") {
        return {
          insert: (row: Record<string, unknown>) => {
            runtime.inserted = row;
            return { select: () => ({ single: async () => ({ data: { id: "charge-1" }, error: null }) }) };
          },
        };
      }
      throw new Error(`unexpected admin table ${table}`);
    },
  },
}));

const { createSubscriptionCharge, saveOwnerCpf, subscriptionChargeAmountCents } =
  await import("./subscription-charge.functions");

type Caller = (arg: { data: unknown; context: unknown }) => Promise<Record<string, unknown>>;
const create = createSubscriptionCharge as unknown as Caller;
const saveCpf = saveOwnerCpf as unknown as Caller;

const businessId = "11111111-1111-4111-8111-111111111111";
const context = {
  userId: "dono-1",
  claims: {},
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: runtime.business, error: null }) }) }),
    }),
  },
};

beforeEach(() => {
  runtime.createPixCharge.mockReset();
  runtime.createPixCharge.mockResolvedValue(runtime.pix);
  runtime.professionalsCount = 1;
  runtime.email = "dono@example.com";
  runtime.inserted = null;
  runtime.cpfUpdate = null;
  runtime.isSuper = false;
  runtime.business = {
    id: businessId,
    owner_id: "dono-1",
    owner_cpf: "390.533.447-05",
    monthly_fee_cents: 8990,
    access_until: null,
    coupon_percent: null,
    coupon_expires_at: null,
  };
});

describe("subscriptionChargeAmountCents (US7)", () => {
  it("usa o plano base quando não há cupom (1 profissional incluído)", () => {
    expect(subscriptionChargeAmountCents({ baseCents: 8990, professionalsCount: 1 })).toBe(8990);
  });

  it("soma R$10 por profissional adicional", () => {
    expect(subscriptionChargeAmountCents({ baseCents: 8990, professionalsCount: 3 })).toBe(10990);
  });

  it("aplica o desconto de um cupom ativo", () => {
    const amount = subscriptionChargeAmountCents({
      baseCents: 10000,
      professionalsCount: 1,
      couponPercent: 20,
      couponExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(amount).toBe(8000);
  });

  it("ignora cupom expirado", () => {
    const amount = subscriptionChargeAmountCents({
      baseCents: 10000,
      professionalsCount: 1,
      couponPercent: 20,
      couponExpiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    });
    expect(amount).toBe(10000);
  });
});

describe("createSubscriptionCharge (US7)", () => {
  it("exige CPF do dono antes de gerar o Pix", async () => {
    runtime.business = { ...runtime.business!, owner_cpf: null };
    await expect(create({ data: { businessId, method: "pix" }, context })).rejects.toThrow(/CPF/i);
    expect(runtime.createPixCharge).not.toHaveBeenCalled();
  });

  it("cria a cobrança pendente via AgPay e devolve o QR/código", async () => {
    const result = await create({ data: { businessId, method: "pix" }, context });
    expect(runtime.createPixCharge).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      chargeId: "charge-1",
      providerPaymentId: "tx-1",
      amountCents: 8990,
      status: "pending",
      qrCode: "PIXCODE",
    });
    expect(runtime.inserted).toMatchObject({
      business_id: businessId,
      method: "pix",
      provider_payment_id: "tx-1",
      amount_cents: 8990,
      status: "pending",
      payer_email: "dono@example.com",
    });
  });

  it("não envia o e-mail sintético do login por telefone ao AgPay", async () => {
    runtime.email = "5511999990000@agenda.local";
    await create({ data: { businessId, method: "pix" }, context });
    expect(runtime.createPixCharge).toHaveBeenCalledWith(
      expect.objectContaining({ payerEmail: "5511999990000@agendagora.company" }),
    );
    expect(runtime.inserted).toMatchObject({ payer_email: "5511999990000@agendagora.company" });
  });

  it("transforma falha do AgPay em mensagem clara e não grava cobrança", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    runtime.createPixCharge.mockRejectedValue(
      Object.assign(new Error("Falha na comunicação com o AgPay (502)."), {
        status: 502,
        providerMessage: "Bad gateway",
      }),
    );
    await expect(create({ data: { businessId, method: "pix" }, context })).rejects.toThrow(
      "Não foi possível gerar o Pix agora.",
    );
    expect(runtime.inserted).toBeNull();
    expect(spy).toHaveBeenCalledWith(
      "Falha ao criar cobrança Pix da assinatura",
      expect.objectContaining({ status: 502, providerMessage: "Bad gateway" }),
    );
    spy.mockRestore();
  });
});

describe("saveOwnerCpf (US7) — CPF salvo pelo servidor", () => {
  const validCpf = "390.533.447-05";

  it("grava só os dígitos em businesses.owner_cpf, via servidor (service role)", async () => {
    await expect(saveCpf({ data: { businessId, cpf: validCpf }, context })).resolves.toEqual({
      ok: true,
    });
    expect(runtime.cpfUpdate).toEqual({ values: { owner_cpf: "39053344705" }, id: businessId });
  });

  it("recusa CPF com dígito verificador errado e não grava", async () => {
    await expect(
      saveCpf({ data: { businessId, cpf: "390.533.447-06" }, context }),
    ).rejects.toThrow();
    expect(runtime.cpfUpdate).toBeNull();
  });

  it("recusa quem não é o dono do negócio e não grava", async () => {
    runtime.business = { ...runtime.business!, owner_id: "outra-pessoa" };
    await expect(saveCpf({ data: { businessId, cpf: validCpf }, context })).rejects.toThrow(
      /dono/i,
    );
    expect(runtime.cpfUpdate).toBeNull();
  });

  it("permite o master gravar o CPF de um negócio", async () => {
    runtime.business = { ...runtime.business!, owner_id: "outra-pessoa" };
    runtime.isSuper = true;
    await saveCpf({ data: { businessId, cpf: validCpf }, context });
    expect(runtime.cpfUpdate?.id).toBe(businessId);
  });
});
