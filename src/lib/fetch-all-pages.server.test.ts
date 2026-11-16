import { describe, expect, it, vi } from "vitest";
import { DATABASE_PAGE_SIZE, fetchAllPages } from "./fetch-all-pages.server";

describe("fetchAllPages", () => {
  it("lê páginas até receber uma página menor que o limite", async () => {
    const fetchPage = vi.fn(async (from: number, to: number) => ({
      data:
        from === 0
          ? Array.from({ length: DATABASE_PAGE_SIZE }, (_, index) => index)
          : [DATABASE_PAGE_SIZE],
      error: null,
    }));

    const rows = await fetchAllPages(fetchPage, "falha ao paginar");

    expect(rows).toHaveLength(DATABASE_PAGE_SIZE + 1);
    expect(fetchPage.mock.calls).toEqual([
      [0, DATABASE_PAGE_SIZE - 1],
      [DATABASE_PAGE_SIZE, DATABASE_PAGE_SIZE * 2 - 1],
    ]);
  });

  it("falha fechado se qualquer página retornar erro", async () => {
    await expect(
      fetchAllPages(
        async () => ({ data: null, error: { message: "database unavailable" } }),
        "não foi possível carregar o conjunto completo",
      ),
    ).rejects.toThrow("não foi possível carregar o conjunto completo");
  });
});
