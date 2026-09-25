import { supabase } from "@/integrations/supabase/client";
import { isBusinessImagePath } from "@/lib/business-image-path";

export const LOGO_BUCKET = "business-logos";
export const LOGO_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

const logoExtensions = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export function validateLogoFile(
  file: Pick<File, "type" | "size">,
): { valid: true; extension: string } | { valid: false; message: string } {
  const extension = logoExtensions.get(file.type);
  if (!extension) {
    return { valid: false, message: "Escolha uma imagem PNG, JPEG ou WebP para o logotipo." };
  }
  if (file.size > LOGO_MAX_SIZE_BYTES) {
    return { valid: false, message: "O logotipo deve ter no máximo 5 MB." };
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

export async function getLogoUrl(path: string | null | undefined, businessId: string) {
  if (!path || !isBusinessImagePath(path, businessId, "logo")) return null;
  const { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (error) return null;
  return data?.signedUrl ?? null;
}
