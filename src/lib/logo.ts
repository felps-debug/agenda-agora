import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  businessImageSignatureMatchesPath,
  detectBusinessImageMimeType,
  isBusinessImagePath,
} from "@/lib/business-image-path";

export const LOGO_BUCKET = "business-logos";
export const LOGO_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

const logoExtensions = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

const invalidLogoMessage =
  "O arquivo não contém uma imagem PNG, JPEG ou WebP válida. Escolha outra imagem.";

type BusinessImageContext = "logo" | "service" | "background";

const invalidServiceImageMessage =
  "O arquivo não contém uma imagem PNG, JPEG ou WebP válida para a imagem do serviço. Escolha outra imagem.";
const invalidBackgroundImageMessage =
  "O arquivo não contém uma imagem PNG, JPEG ou WebP válida para o fundo da página. Escolha outra imagem.";

function invalidMessageFor(context: BusinessImageContext) {
  if (context === "service") return invalidServiceImageMessage;
  if (context === "background") return invalidBackgroundImageMessage;
  return invalidLogoMessage;
}

export async function validateLogoFile(
  file: Pick<File, "type" | "size" | "arrayBuffer">,
  context: BusinessImageContext = "logo",
): Promise<{ valid: true; extension: string } | { valid: false; message: string }> {
  const extension = logoExtensions.get(file.type);
  if (!extension && context === "service") {
    return {
      valid: false,
      message: "Escolha uma imagem PNG, JPEG ou WebP para a imagem do serviço.",
    };
  }
  if (!extension && context === "background") {
    return {
      valid: false,
      message: "Escolha uma imagem PNG, JPEG ou WebP para o fundo da página.",
    };
  }
  if (!extension) {
    return { valid: false, message: "Escolha uma imagem PNG, JPEG ou WebP para o logotipo." };
  }
  if (file.size > LOGO_MAX_SIZE_BYTES && context === "service") {
    return { valid: false, message: "A imagem do serviço deve ter no máximo 5 MB." };
  }
  if (file.size > LOGO_MAX_SIZE_BYTES && context === "background") {
    return { valid: false, message: "A imagem de fundo deve ter no máximo 5 MB." };
  }
  if (file.size > LOGO_MAX_SIZE_BYTES) {
    return { valid: false, message: "O logotipo deve ter no máximo 5 MB." };
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { valid: false, message: invalidMessageFor(context) };
  }
  if (detectBusinessImageMimeType(bytes) !== file.type) {
    return { valid: false, message: invalidMessageFor(context) };
  }
  return { valid: true, extension };
}

export function logoStorageErrorMessage(error: {
  status: number | undefined;
  statusCode: string | undefined;
}): string {
  if (error.statusCode === "NoSuchBucket") {
    return "O armazenamento de imagens está indisponível. Tente novamente mais tarde.";
  }
  if (error.status === 401 || error.status === 403 || error.statusCode === "AccessDenied") {
    return "Você não tem permissão para enviar o logotipo deste negócio.";
  }
  return "Não foi possível enviar o logotipo. Tente novamente.";
}

export async function getBusinessImageUrl(
  path: string | null | undefined,
  businessId: string,
  kind: "logo" | "service" | "background",
) {
  if (!path || !isBusinessImagePath(path, businessId, kind)) return null;
  const { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function getLogoUrl(path: string | null | undefined, businessId: string) {
  return getBusinessImageUrl(path, businessId, "logo");
}

export function getBackgroundImageUrl(path: string | null | undefined, businessId: string) {
  return getBusinessImageUrl(path, businessId, "background");
}

export async function decodeBusinessImageFile(file: Blob): Promise<boolean> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const decoded = bitmap.width > 0 && bitmap.height > 0;
      bitmap.close();
      return decoded;
    } catch {
      return false;
    }
  }

  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") return false;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<boolean>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
      image.onerror = () => resolve(false);
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function assertStoredBusinessImage(
  storageClient: SupabaseClient<Database>,
  path: string,
  businessId: string,
  kind: "logo" | "service" | "background",
): Promise<void> {
  const { data, error } = await storageClient.storage.from(LOGO_BUCKET).download(path);
  if (
    error ||
    !data ||
    data.size > LOGO_MAX_SIZE_BYTES ||
    !businessImageSignatureMatchesPath(
      new Uint8Array(await data.arrayBuffer()),
      path,
      businessId,
      kind,
    )
  ) {
    throw new Error(invalidMessageFor(kind === "background" ? "background" : "logo"));
  }
}

export const saveBusinessLogoInput = z.object({
  businessId: z.string().uuid(),
  path: z.string().max(512),
});

export async function saveBusinessLogoForOwner(
  storageClient: SupabaseClient<Database>,
  userId: string,
  input: z.infer<typeof saveBusinessLogoInput>,
): Promise<void> {
  const { data: business, error: ownerError } = await storageClient
    .from("businesses")
    .select("id")
    .eq("id", input.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (ownerError || !business) {
    throw new Error("Somente o dono pode atualizar o logotipo deste negócio.");
  }

  try {
    await assertStoredBusinessImage(storageClient, input.path, input.businessId, "logo");
  } catch {
    await storageClient.storage.from(LOGO_BUCKET).remove([input.path]);
    throw new Error(invalidLogoMessage);
  }

  const { data, error } = await storageClient
    .from("businesses")
    .update({ logo_url: input.path })
    .eq("id", input.businessId)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    await storageClient.storage.from(LOGO_BUCKET).remove([input.path]);
    throw new Error("A imagem foi enviada, mas não foi possível salvar o logotipo.");
  }
}

export const saveBusinessLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveBusinessLogoInput.parse(data))
  .handler(async ({ context, data }) =>
    saveBusinessLogoForOwner(context.supabase, context.userId, data),
  );

export const saveBusinessBackgroundImageInput = z.object({
  businessId: z.string().uuid(),
  path: z.string().max(512),
});

export async function saveBusinessBackgroundImageForOwner(
  storageClient: SupabaseClient<Database>,
  userId: string,
  input: z.infer<typeof saveBusinessBackgroundImageInput>,
): Promise<void> {
  const { data: business, error: ownerError } = await storageClient
    .from("businesses")
    .select("id, brand_background_image")
    .eq("id", input.businessId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (ownerError || !business) {
    throw new Error("Somente o dono pode atualizar o fundo deste negócio.");
  }

  try {
    await assertStoredBusinessImage(storageClient, input.path, input.businessId, "background");
  } catch {
    await storageClient.storage.from(LOGO_BUCKET).remove([input.path]);
    throw new Error(invalidBackgroundImageMessage);
  }

  const previousPath = business.brand_background_image;
  const { data, error } = await storageClient
    .from("businesses")
    .update({ brand_background_image: input.path })
    .eq("id", input.businessId)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    await storageClient.storage.from(LOGO_BUCKET).remove([input.path]);
    throw new Error("A imagem foi enviada, mas não foi possível salvar o fundo.");
  }
  if (previousPath && previousPath !== input.path) {
    await storageClient.storage.from(LOGO_BUCKET).remove([previousPath]);
  }
}

export const saveBusinessBackgroundImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveBusinessBackgroundImageInput.parse(data))
  .handler(async ({ context, data }) =>
    saveBusinessBackgroundImageForOwner(context.supabase, context.userId, data),
  );

const clearBusinessBackgroundImageInput = z.object({ businessId: z.string().uuid() });

/** Volta a usar cor sólida (brand_background) no lugar da imagem de fundo. */
export const clearBusinessBackgroundImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => clearBusinessBackgroundImageInput.parse(data))
  .handler(async ({ context, data }) => {
    const { data: business, error: ownerError } = await context.supabase
      .from("businesses")
      .select("id, brand_background_image")
      .eq("id", data.businessId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (ownerError || !business) {
      throw new Error("Somente o dono pode atualizar o fundo deste negócio.");
    }
    const { error } = await context.supabase
      .from("businesses")
      .update({ brand_background_image: null })
      .eq("id", data.businessId)
      .eq("owner_id", context.userId);
    if (error) throw new Error("Não foi possível remover a imagem de fundo.");
    if (business.brand_background_image) {
      await context.supabase.storage.from(LOGO_BUCKET).remove([business.brand_background_image]);
    }
  });
