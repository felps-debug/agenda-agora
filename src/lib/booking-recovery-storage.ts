type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Persiste uma capability do cliente sem deixar que falha do navegador quebre o fluxo do servidor. */
export function appendRecoveryId(
  getStorage: () => StorageLike,
  key: string,
  id: string,
  currentIds: string[],
): { ids: string[]; persisted: boolean } {
  let existingIds = currentIds;
  let storage: StorageLike;
  try {
    storage = getStorage();
  } catch {
    return {
      ids: [id, ...currentIds.filter((currentId) => currentId !== id)].slice(0, 30),
      persisted: false,
    };
  }

  try {
    const raw = storage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed))
        existingIds = parsed.filter((value): value is string => typeof value === "string");
    }
  } catch {
    // Usa a cópia em memória caso leitura ou JSON salvo falhe.
  }

  const ids = [id, ...existingIds.filter((currentId) => currentId !== id)].slice(0, 30);
  try {
    storage.setItem(key, JSON.stringify(ids));
    return { ids, persisted: true };
  } catch {
    return { ids, persisted: false };
  }
}
