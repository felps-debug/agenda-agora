import { describe, expect, it } from "vitest";
import {
  businessesCacheKey,
  clearCachedBusinesses,
  loadCachedBusinesses,
  mergeUpdatedBusiness,
  saveCachedBusinesses,
} from "./business-cache";
import type { Business } from "./business";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
    _map: map,
  } as unknown as Storage & { _map: Map<string, string> };
}

const sample: Business[] = [
  {
    id: "biz-1",
    name: "Barbearia X",
    slug: "barbearia-x",
    category: "barbearia",
    phone: null,
    address: null,
    status: "active",
    monthly_fee_cents: 9900,
    created_at: "2026-01-01T00:00:00Z",
    trial_days: null,
    trial_created_at: null,
  },
];

describe("business-cache localStorage (US2)", () => {
  it("hidrata a lista salva (save → load round-trip)", () => {
    const storage = fakeStorage();
    saveCachedBusinesses("user-1", sample, storage);
    expect(loadCachedBusinesses("user-1", storage)).toEqual(sample);
  });

  it("devolve undefined quando não há cache", () => {
    const storage = fakeStorage();
    expect(loadCachedBusinesses("user-1", storage)).toBeUndefined();
  });

  it("devolve undefined com JSON corrompido (não quebra o boot)", () => {
    const storage = fakeStorage();
    storage.setItem(businessesCacheKey("user-1"), "{não-json");
    expect(loadCachedBusinesses("user-1", storage)).toBeUndefined();
  });

  it("chave é namespaced por usuário: não vaza entre contas", () => {
    const storage = fakeStorage();
    saveCachedBusinesses("user-1", sample, storage);
    expect(loadCachedBusinesses("user-2", storage)).toBeUndefined();
  });

  it("clearCachedBusinesses remove todas as entradas de negócios", () => {
    const storage = fakeStorage();
    saveCachedBusinesses("user-1", sample, storage);
    saveCachedBusinesses("user-2", sample, storage);
    clearCachedBusinesses(storage);
    expect(loadCachedBusinesses("user-1", storage)).toBeUndefined();
    expect(loadCachedBusinesses("user-2", storage)).toBeUndefined();
  });

  it("mergeUpdatedBusiness aplica só campos de Business na linha certa", () => {
    const next = mergeUpdatedBusiness(sample, { id: "biz-1", name: "Novo Nome" });
    expect(next?.[0]?.name).toBe("Novo Nome");
    expect(next?.[0]?.slug).toBe("barbearia-x");
  });
});
