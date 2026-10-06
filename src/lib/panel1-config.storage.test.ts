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
  const download = vi.fn(async (_path: string, _options?: unknown, _fetchOptions?: unknown) => ({
    data: failure || document === null ? null : new Blob([document], { type: "application/json" }),
    error:
      failure ?? (document === null ? storageFailure(404, "NoSuchKey", "Object not found") : null),
  }));
  const upload = vi.fn(async (_path: string, body: Blob, _options?: { cacheControl?: string }) => {
    document = await body.text();
    return { data: { path: _path }, error: null };
  });
  const from = vi.fn((_bucket: string) => ({ download, upload }));
  const client = { storage: { from } } as unknown as Parameters<typeof loadPanel1Config>[0];

  return { client, from, download, upload };
}

describe("panel1-config storage", () => {
  it.each([
    ["NoSuchKey", storageFailure(404, "NoSuchKey", "Object not found")],
    ["legacy 404", storageFailure(404, "404", "Object not found")],
  ] as const)("returns defaults when the config object is missing (%s)", async (_case, failure) => {
    const storage = fakeStorage(null, failure);

    await expect(loadPanel1Config(storage.client, businessId)).resolves.toEqual(
      defaultPanel1Config(),
    );
    expect(storage.from).toHaveBeenCalledWith("business-logos");
    expect(storage.download).toHaveBeenCalledWith(
      panel1SettingsPath(businessId),
      expect.objectContaining({ cacheNonce: expect.any(String) }),
      { cache: "no-store" },
    );
  });

  it.each([
    ["missing bucket", storageFailure(404, "NoSuchBucket", "Bucket not found")],
    ["permission denied", storageFailure(403, "AccessDenied", "Access denied")],
  ] as const)("propagates %s instead of replacing it with defaults", async (_case, failure) => {
    const storage = fakeStorage(null, failure);

    await expect(loadPanel1Config(storage.client, businessId)).rejects.toMatchObject(failure);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("does not overwrite config when bucket read fails", async () => {
    const failure = storageFailure(404, "NoSuchBucket", "Bucket not found");
    const storage = fakeStorage(null, failure);

    await expect(
      savePanel1Config(storage.client, businessId, { preferences: { greeting: "New greeting" } }),
    ).rejects.toMatchObject(failure);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("merges a partial patch and reloads persisted fields", async () => {
    const existing = defaultPanel1Config();
    existing.appearance.page_text = "#123456";
    existing.preferences.cancellations_enabled = false;
    existing.preferences.reschedule_enabled = true;
    existing.preferences.timezone = "America/Fortaleza";
    const storage = fakeStorage(JSON.stringify(existing));

    const saved = await savePanel1Config(storage.client, businessId, {
      appearance: { service_border: "#abcdef" },
      preferences: { greeting: "Welcome to booking" },
    });
    const reloaded = await loadPanel1Config(storage.client, businessId);

    expect(saved).toMatchObject({
      version: 1,
      appearance: { page_text: "#123456", service_border: "#abcdef" },
      preferences: {
        greeting: "Welcome to booking",
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

  it.each(["preferences-first", "appearance-first"] as const)(
    "preserves preferences and appearance across sequential saves (%s)",
    async (order) => {
      const storage = fakeStorage(JSON.stringify(defaultPanel1Config()));
      const savePreferences = () =>
        savePanel1Config(storage.client, businessId, {
          preferences: { minimum_notice_hours: 12 },
        });
      const saveAppearance = () =>
        savePanel1Config(storage.client, businessId, {
          appearance: { service_border: "#abcdef" },
        });

      if (order === "preferences-first") {
        await savePreferences();
        await saveAppearance();
      } else {
        await saveAppearance();
        await savePreferences();
      }

      const saved = await loadPanel1Config(storage.client, businessId);
      expect(saved.preferences.minimum_notice_hours).toBe(12);
      expect(saved.appearance.service_border).toBe("#abcdef");
    },
  );

  it("serializes concurrent writes and preserves both patches", async () => {
    const storage = fakeStorage(JSON.stringify(defaultPanel1Config()));

    await Promise.all([
      savePanel1Config(storage.client, businessId, {
        preferences: { minimum_notice_hours: 4 },
      }),
      savePanel1Config(storage.client, businessId, {
        appearance: { service_border: "#abcdef" },
      }),
    ]);

    const saved = await loadPanel1Config(storage.client, businessId);
    expect(saved.preferences.minimum_notice_hours).toBe(4);
    expect(saved.appearance.service_border).toBe("#abcdef");
  });

  it("writes the config object without a cache TTL", async () => {
    const storage = fakeStorage(JSON.stringify(defaultPanel1Config()));

    await savePanel1Config(storage.client, businessId, {
      preferences: { minimum_notice_hours: 4 },
    });

    expect(storage.upload).toHaveBeenCalledWith(
      panel1SettingsPath(businessId),
      expect.any(Blob),
      expect.objectContaining({ cacheControl: "0" }),
    );
  });

  it("persists layout and niche with the same explicit save", async () => {
    const storage = fakeStorage(JSON.stringify(defaultPanel1Config()));

    await savePanel1Config(storage.client, businessId, {
      visual: { layout_key: "liquid_glass", niche_id: "barbearia" },
    });

    await expect(loadPanel1Config(storage.client, businessId)).resolves.toMatchObject({
      visual: { layout_key: "liquid_glass", niche_id: "barbearia" },
    });
  });
});
