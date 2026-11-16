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
  professionalsError: null as { message: string } | null,
  email: "dono@example.com" as string | null,
  pix: { providerPaymentId: "tx-1", qrCode: "PIXCODE", expiresAt: null } as Record<string, unknown>,
  inserted: null as Record<string, unknown> | null,
  insertError: null as { message: string } | null,
  reviewEvent: null as { row: Record<string, unknown>; options: Record<string, unknown> } | null,
  reviewEventError: null as { message: string } | null,
  cpfUpdate: null as { values: Record<string, unknown>; id: string } | null,
  isSuper: false,
  superAdminError: null as Error | null,
  sessionBusinessSelects: [] as string[],
  adminBusinessSelects: [] as string[],
  createPixCharge: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => serverFnMock());
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  MASTER_ACCESS_DENIED: "Acesso restrito ao painel master.",
  hasSuperAdminRole: vi.fn(async () => runtime.isSuper),
  assertSuperAdmin: async () => {
    if (!runtime.isSuper) throw new Error("Acesso restrito ao painel master.");
    if (runtime.superAdminError) throw runtime.superAdminError;
    return {};
  },
}));
vi.mock("@/lib/agpay.server", () => ({
  createPixCharge: (...args: unknown[]) => runtime.createPixCharge(...args),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById: async () => ({ data: { user: { email: runtime.email, user_metadata: {} } } }),
      },
    },
    from: (table: string) => {
      if (table === "professionals") {
        return {
          select: () => ({
            eq: async () => ({
              count: runtime.professionalsCount,
              error: runtime.professionalsError,
            }),
          }),
        };
      }
      if (table === "businesses") {
        return {
          select: (columns: string) => {
            runtime.adminBusinessSelects.push(columns);
            return {
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    owner_cpf: runtime.business?.["owner_cpf"] ?? null,
                    coupon_percent: runtime.business?.["coupon_percent"] ?? null,
                    coupon_expires_at: runtime.business?.["coupon_expires_at"] ?? null,
                  },
                  error: null,
                }),
              }),
            };
          },
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
            return {
              select: () => ({
                single: async () => ({
                  data: runtime.insertError ? null : { id: "charge-1" },
                  error: runtime.insertError,
                }),
              }),
            };
          },
        };
      }
      if (table === "agpay_webhook_events") {
        return {
          upsert: async (row: Record<string, unknown>, options: Record<string, unknown>) => {
            runtime.reviewEvent = { row, options };
            return { error: runtime.reviewEventError };
          },
        };
      }
      throw new Error(`unexpected admin table ${table}`);
    },
  },
}));

const { createSubscriptionCharge, saveOwnerCpf, getOwnerCpfStatus, subscriptionChargeAmountCents } =
  await import("./subscription-charge.functions");
const { isMasterCouponActive } = await import("./subscription-coupon");

type Caller = (arg: { data: unknown; context: unknown }) => Promise<Record<string, unknown>>;
const create = createSubscriptionCharge as unknown as Caller;
const saveCpf = saveOwnerCpf as unknown as Caller;
const getCpfStatus = getOwnerCpfStatus as unknown as Caller;

const businessId = "11111111-1111-4111-8111-111111111111";
const context = {
  userId: "dono-1",
  claims: {},
  supabase: {
    from: () => ({
      select: (columns: string) => {
        runtime.sessionBusinessSelects.push(columns);
        return {
          eq: () => ({ maybeSingle: async () => ({ data: runtime.business, error: null }) }),
        };
      },
    }),
  },
};

beforeEach(() => {
  runtime.createPixCharge.mockReset();
  runtime.createPixCharge.mockResolvedValue(runtime.pix);
  runtime.professionalsCount = 1;
  runtime.professionalsError = null;
  runtime.email = "dono@example.com";
  runtime.inserted = null;
  runtime.insertError = null;
  runtime.reviewEvent = null;
  runtime.reviewEventError = null;
  runtime.cpfUpdate = null;
  runtime.isSuper = false;
  runtime.superAdminError = null;
  runtime.sessionBusinessSelects = [];
  runtime.adminBusinessSelects = [];
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

describe("visibilidade de cupom na assinatura", () => {
  it("exibe o cupom apenas quando o master ativou um desconto ainda válido", () => {
    const now = new Date("2026-11-16T12:00:00.000Z");
    expect(isMasterCouponActive(null, now)).toBe(false);
    expect(isMasterCouponActive({ percent: 0, expiresAt: "2026-11-17T12:00:00.000Z" }, now)).toBe(
      false,
    );
    expect(isMasterCouponActive({ percent: 10, expiresAt: "2026-11-15T12:00:00.000Z" }, now)).toBe(
      false,
    );
    expect(isMasterCouponActive({ percent: 10, expiresAt: "2026-11-17T12:00:00.000Z" }, now)).toBe(
      true,
    );
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
    expect(runtime.sessionBusinessSelects[0]).not.toMatch(/coupon_/);
    expect(runtime.adminBusinessSelects).toContain("owner_cpf, coupon_percent, coupon_expires_at");
  });

  it("aplica o cupom lido no servidor ao criar a cobrança", async () => {
    runtime.business = {
      ...runtime.business!,
      coupon_percent: 20,
      coupon_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    };

    const result = await create({ data: { businessId, method: "pix" }, context });

    expect(result["amountCents"]).toBe(7192);
    expect(runtime.inserted).toMatchObject({ amount_cents: 7192 });
    expect(runtime.sessionBusinessSelects[0]).not.toMatch(/coupon_/);
  });

  it("registra para revisão manual quando o AgPay cria o Pix mas o insert local falha", async () => {
    runtime.insertError = { message: "database unavailable" };

    await expect(create({ data: { businessId, method: "pix" }, context })).rejects.toThrow(
      /Pix pode ter sido criado.*n[aã]o tente pagar novamente/i,
    );

    expect(runtime.createPixCharge).toHaveBeenCalledOnce();
    expect(runtime.reviewEvent).toMatchObject({
      row: {
        event_type: "subscription.charge_persist_failed",
        transaction_uuid: "tx-1",
        status: "error",
        attempts: 1,
        last_error: expect.stringContaining("database unavailable"),
        payload: expect.objectContaining({
          business_id: businessId,
          amount_cents: 8990,
        }),
      },
      options: { onConflict: "dedupe_hash" },
    });
    expect(runtime.reviewEvent?.row).not.toHaveProperty("qr_code");
  });

  it("preserva a mensagem de não duplicar Pix mesmo se a fila de revisão falhar", async () => {
    runtime.insertError = { message: "database unavailable" };
    runtime.reviewEventError = { message: "review queue unavailable" };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(create({ data: { businessId, method: "pix" }, context })).rejects.toThrow(
      /Pix pode ter sido criado.*n[aã]o tente pagar novamente/i,
    );
    expect(spy).toHaveBeenCalledWith(
      "Falha ao registrar Pix de assinatura para revisão manual",
      expect.objectContaining({ businessId, providerPaymentId: "tx-1" }),
    );
    spy.mockRestore();
  });

  it("interrompe a emissão se a contagem de profissionais falhar", async () => {
    runtime.professionalsCount = null as unknown as number;
    runtime.professionalsError = { message: "falha na contagem" };

    await expect(create({ data: { businessId, method: "pix" }, context })).rejects.toThrow(
      "Não foi possível calcular o valor da assinatura.",
    );
    expect(runtime.createPixCharge).not.toHaveBeenCalled();
    expect(runtime.inserted).toBeNull();
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

  it("permite ao Master gravar CPF sem exigir MFA", async () => {
    runtime.business = { ...runtime.business!, owner_id: "outra-pessoa" };
    runtime.isSuper = true;
    await saveCpf({
      data: { businessId, cpf: validCpf },
      context: { ...context, claims: { aal: "aal1" } },
    });
    expect(runtime.cpfUpdate?.id).toBe(businessId);
  });

  it("preserva falhas internas ao consultar a role Master", async () => {
    runtime.business = { ...runtime.business!, owner_id: "outra-pessoa" };
    runtime.isSuper = true;
    runtime.superAdminError = new Error("role lookup failed");
    const masterContext = { ...context, userId: "master-1", claims: { aal: "aal2" } };

    await expect(
      saveCpf({ data: { businessId, cpf: validCpf }, context: masterContext }),
    ).rejects.toThrow("role lookup failed");
    expect(runtime.cpfUpdate).toBeNull();
  });
});
