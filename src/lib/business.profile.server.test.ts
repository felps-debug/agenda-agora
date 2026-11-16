import { describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  business: null as Record<string, unknown> | null,
  selectedColumns: null as string | null,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (data: unknown) => data;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: (data: unknown) => unknown) => {
        validate = fn;
        return builder;
      },
      handler:
        (fn: (arg: { context: unknown; data: unknown }) => unknown) =>
        (arg: { context: unknown; data: unknown }) =>
          fn({ ...arg, data: validate(arg.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    const query = {
      update: (patch: Record<string, unknown>) => {
        const row = runtime.business ?? {};
        Object.assign(row, patch);
        runtime.business = row;
        return query;
      },
      eq: () => query,
      select: (columns?: string) => {
        runtime.selectedColumns = columns ?? null;
        return query;
      },
      single: async () => {
        const row = runtime.business ?? {};
        const data = runtime.selectedColumns
          ? Object.fromEntries(
              runtime.selectedColumns
                .split(",")
                .map((column) => [column.trim(), row[column.trim()]]),
            )
          : row;
        return { data, error: null };
      },
    };
    return { from: () => query };
  },
}));

const { updateBusinessProfile } = await import("./business.functions");

describe("updateBusinessProfile response", () => {
  it("returns the public profile fields needed by the UI without private business secrets", async () => {
    runtime.business = {
      id: "11111111-1111-4111-8111-111111111111",
      owner_id: "owner-1",
      name: "Estúdio de teste",
      slug: "estudio-teste",
      category: "barbearia",
      phone: "85999999999",
      address: "Rua A",
      greeting: "Olá!",
      timezone: "America/Fortaleza",
      brand_background: "#ffffff",
      whatsapp_instance_token: "private-token",
      withdrawal_pin_hash: "private-pin-hash",
      withdrawal_pix_key: "pix-private@example.com",
    };
    runtime.selectedColumns = null;

    const context = {
      userId: "owner-1",
      supabase: {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: runtime.business?.["id"], owner_id: "owner-1" },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      },
    };
    const result = await (
      updateBusinessProfile as unknown as (arg: {
        context: typeof context;
        data: Record<string, unknown>;
      }) => Promise<Record<string, unknown>>
    )({
      context,
      data: {
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Estúdio novo",
        slug: "estudio-novo",
        category: "barbearia",
      },
    });

    expect(runtime.selectedColumns).toBe(
      "id, name, slug, category, phone, address, greeting, timezone, brand_background",
    );
    expect(result).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Estúdio novo",
      slug: "estudio-novo",
      category: "barbearia",
      phone: "85999999999",
      address: "Rua A",
      greeting: "Olá!",
      timezone: "America/Fortaleza",
      brand_background: "#ffffff",
    });
    expect(result).not.toHaveProperty("whatsapp_instance_token");
    expect(result).not.toHaveProperty("withdrawal_pin_hash");
    expect(result).not.toHaveProperty("withdrawal_pix_key");
  });
});
