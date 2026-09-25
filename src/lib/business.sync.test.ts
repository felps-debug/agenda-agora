import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { businessesQueryKey, mergeUpdatedBusiness, syncUpdatedBusiness } from "./business-cache";
import type { Business } from "./business";

// T030 (spec 002): o cartão do link público lê `business.slug` do cache
// ["businesses", userId]; depois de updateBusinessProfile ele precisa mudar sem reload.

const USER = "user-dono";

const business = (id: string, slug: string): Business => ({
  id,
  name: `Negócio ${id}`,
  slug,
  category: "barbearia",
  phone: null,
  address: null,
  status: "ativo",
  monthly_fee_cents: 0,
});

describe("sincronização do slug após updateBusinessProfile", () => {
  it("atualiza na hora o cache lido pelo contexto, sem esperar refetch", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(businessesQueryKey(USER), [
      business("a", "slug-antigo"),
      business("b", "outro-negocio"),
    ]);

    void syncUpdatedBusiness(queryClient, USER, {
      ...business("a", "slug-novo"),
      owner_id: USER,
    } as Business & { owner_id: string });

    const cached = queryClient.getQueryData<Business[]>(businessesQueryKey(USER));
    expect(cached?.find((b) => b.id === "a")?.slug).toBe("slug-novo");
    expect(cached?.find((b) => b.id === "b")?.slug).toBe("outro-negocio");
    expect(cached?.find((b) => b.id === "a")).not.toHaveProperty("owner_id");
  });

  it("marca a lista para revalidar no servidor depois da atualização local", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(businessesQueryKey(USER), [business("a", "slug-antigo")]);

    await syncUpdatedBusiness(queryClient, USER, { id: "a", slug: "slug-novo" });

    expect(queryClient.getQueryState(businessesQueryKey(USER))?.isInvalidated).toBe(true);
  });

  it("não cria cache nem altera campos omitidos", () => {
    expect(mergeUpdatedBusiness(undefined, { id: "a", slug: "x" })).toBeUndefined();
    const [merged] = mergeUpdatedBusiness([business("a", "slug-antigo")], {
      id: "a",
      slug: "novo",
    })!;
    expect(merged).toEqual({ ...business("a", "slug-antigo"), slug: "novo" });
  });
});
