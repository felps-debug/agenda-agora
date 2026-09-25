import { describe, expect, it, vi } from "vitest";
import { defaultPanel1Config, panel1SettingsPath } from "./panel1-config";
import { loadPanel1Config, savePanel1Config } from "./panel1-config.storage";

const businessId = "11111111-1111-4111-8111-111111111111";

type StorageFailure = {
  name: "StorageApiError";
  message: string;
  status: number;
  statusCode: string;
};

function storageFailure(status: number, statusCode: string, message: string): StorageFailure {
  return { name: "StorageApiError", status, statusCode, message };
}

function fakeStorage(initialDocument: string | null = null, failure: StorageFailure | null = null) {
  let document = initialDocument;
  const download = vi.fn(async (_path: string) => ({
    data: failure || document === null ? null : new Blob([document], { type: "application/json" }),
    error:
      failure ?? (document === null ? storageFailure(404, "NoSuchKey", "Object not found") : null),
  }));
  const upload = vi.fn(async (_path: string, body: Blob) => {
    document = await body.text();
    return { data: { path: _path }, error: null };
  });
  const from = vi.fn((_bucket: string) => ({ download, upload }));
  const client = { storage: { from } } as unknown as Parameters<typeof loadPanel1Config>[0];

  return { client, from, download, upload };
}

describe("panel1-config no Storage", () => {
  it.each([
    ["NoSuchKey", storageFailure(404, "NoSuchKey", "Object not found")],
    ["resposta atual 404", storageFailure(404, "404", "Object not found")],
  ])("retorna defaults quando o objeto de configuração não existe (%s)", async (_case, failure) => {
    const storage = fakeStorage(null, failure);

    await expect(loadPanel1Config(storage.client, businessId)).resolves.toEqual(
      defaultPanel1Config(),
    );
    expect(storage.from).toHaveBeenCalledWith("business-logos");
    expect(storage.download).toHaveBeenCalledWith(panel1SettingsPath(businessId));
  });

  it.each([
    ["bucket ausente", storageFailure(404, "NoSuchBucket", "Bucket not found")],
    ["permissão negada", storageFailure(403, "AccessDenied", "Access denied")],
  ])("propaga erro de %s ao carregar, sem substituir por defaults", async (_case, failure) => {
    const storage = fakeStorage(null, failure);

    await expect(loadPanel1Config(storage.client, businessId)).rejects.toMatchObject(failure);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("não sobrescreve configuração quando a leitura falha por bucket ausente", async () => {
    const failure = storageFailure(404, "NoSuchBucket", "Bucket not found");
    const storage = fakeStorage(null, failure);

    await expect(
      savePanel1Config(storage.client, businessId, { preferences: { greeting: "Nova saudação" } }),
    ).rejects.toMatchObject(failure);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("faz merge parcial e recarrega o JSON persistido sem perder campos omitidos", async () => {
    const existing = defaultPanel1Config();
    existing.appearance.page_text = "#123456";
    existing.preferences.cancellations_enabled = false;
    existing.preferences.reschedule_enabled = true;
    existing.preferences.timezone = "America/Fortaleza";
    const storage = fakeStorage(JSON.stringify(existing));

    const saved = await savePanel1Config(storage.client, businessId, {
      appearance: { service_border: "#abcdef" },
      preferences: { greeting: "Bem-vindo ao agendamento" },
    });
    const reloaded = await loadPanel1Config(storage.client, businessId);

    expect(saved).toMatchObject({
      version: 1,
      appearance: { page_text: "#123456", service_border: "#abcdef" },
      preferences: {
        greeting: "Bem-vindo ao agendamento",
        cancellations_enabled: false,
        reschedule_enabled: true,
        timezone: "America/Fortaleza",
      },
    });
    expect(saved.updated_at).toEqual(expect.any(String));
    expect(reloaded).toEqual(saved);
    expect(storage.upload).toHaveBeenCalledWith(
      panel1SettingsPath(businessId),
      expect.any(Blob),
      expect.objectContaining({ upsert: true, contentType: "application/json" }),
    );
    expect(storage.download).toHaveBeenCalledTimes(2);
  });
});
