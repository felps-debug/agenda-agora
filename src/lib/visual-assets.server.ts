import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { LOGO_BUCKET, LOGO_MAX_SIZE_BYTES } from "@/lib/logo";

const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export function visualStagingPath(input: {
  businessId: string;
  userId: string;
  nonce: string;
  filename: string;
}) {
  const filename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  return `${input.businessId}/staging/${input.userId}/${input.nonce}/${filename}`;
}

export async function stageVisualAsset(
  supabase: SupabaseClient<Database>,
  input: { businessId: string; userId: string; nonce: string; file: File },
) {
  if (!allowedMimeTypes.has(input.file.type) || input.file.size > LOGO_MAX_SIZE_BYTES) {
    throw new Error("ASSET_ERROR: envie PNG, JPEG ou WebP de no máximo 5 MB.");
  }
  const path = visualStagingPath({ ...input, filename: input.file.name });
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, input.file, {
    contentType: input.file.type,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) throw new Error("ASSET_ERROR: não foi possível enviar a imagem.");
  return path;
}

export async function promoteVisualAsset(
  supabase: SupabaseClient<Database>,
  input: {
    businessId: string;
    userId: string;
    stagingPath: string;
    destination: "logo" | "background" | "service";
  },
) {
  const expectedPrefix = `${input.businessId}/staging/${input.userId}/`;
  if (!input.stagingPath.startsWith(expectedPrefix))
    throw new Error("ASSET_ERROR: mídia sem autorização.");
  const extension = input.stagingPath.split(".").pop() ?? "webp";
  const destination = `${input.businessId}/${input.destination}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).move(input.stagingPath, destination);
  if (error) throw new Error("ASSET_ERROR: não foi possível publicar a imagem.");
  return destination;
}
