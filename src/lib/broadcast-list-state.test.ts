import { describe, expect, it } from "vitest";
import { getBroadcastListState } from "./broadcast-list-state";

describe("estado da lista de notificações Master", () => {
  it("mantém carregamento distinto de lista vazia", () => {
    expect(getBroadcastListState({ isLoading: true, isError: false, data: undefined })).toBe(
      "loading",
    );
  });

  it("mantém falha distinta de lista vazia", () => {
    expect(getBroadcastListState({ isLoading: false, isError: true, data: undefined })).toBe(
      "error",
    );
  });

  it("só classifica ausência real de itens como vazio", () => {
    expect(getBroadcastListState({ isLoading: false, isError: false, data: [] })).toBe("empty");
    expect(
      getBroadcastListState({ isLoading: false, isError: false, data: [{ id: "notice-1" }] }),
    ).toBe("items");
  });
});
