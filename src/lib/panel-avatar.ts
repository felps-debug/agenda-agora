import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_BUCKET, validateLogoFile } from "@/lib/logo";

/**
 * Foto de perfil do painel — apenas visual (a gosto do usuário), independente do
 * logotipo do estabelecimento usado no Painel 1.
 *
 * O arquivo vai para o bucket privado já existente (`business-logos`), no caminho
 * `<business_id>/logo-panel-<uuid>.<ext>`, aceito pelas políticas atuais (dono grava,
 * qualquer sessão autenticada lê). A referência é salva nos metadados do próprio
 * usuário, sem precisar de coluna/migração nova.
 *
 * Antes do upload, a imagem tem as bordas brancas/transparentes recortadas no
 * navegador, deixando somente a logo em alta qualidade (sem recomprimir quando não
 * há borda — o arquivo original é enviado intacto).
 */
export const PANEL_AVATAR_META_KEY = "panelAvatarPath";
/**
 * Espaço do master: o Painel 3 gerencia toda a plataforma (não é um
 * estabelecimento), então a foto dele sobe sob este "pseudo-id" de plataforma
 * no mesmo bucket — o caminho cumpre o regex das políticas e não pertence a
 * nenhum negócio real.
 */
export const PLATFORM_AVATAR_SPACE = "00000000-0000-0000-0000-000000000000";
/**
 * Marca que o arquivo salvo já passou pelo recorte de bordas. Impede que o reparo
 * automático rode de novo em exibições futuras (zero processamento no dia a dia).
 */
export const PANEL_AVATAR_TRIMMED_KEY = "panelAvatarTrimmed";
const PANEL_AVATAR_SIGNED_URL_TTL = 60 * 60 * 24; // 24h
const NEAR_WHITE = 242; // acima disso o pixel é tratado como fundo branco
const TRIM_PADDING = 1; // 1px de respiro para não cortar traços finos da logo

const sourceTypes: Record<string, { contentType: string; extension: string }> = {
  "image/png": { contentType: "image/png", extension: "png" },
  "image/jpeg": { contentType: "image/jpeg", extension: "jpg" },
  "image/webp": { contentType: "image/webp", extension: "webp" },
};

export function panelAvatarPathFromMetadata(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
): string | null {
  const value = user?.user_metadata?.[PANEL_AVATAR_META_KEY];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function panelAvatarTrimmedFromMetadata(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  return user?.user_metadata?.[PANEL_AVATAR_TRIMMED_KEY] === true;
}

export function isPanelAvatarPath(path: string): boolean {
  return /^[0-9a-f-]{36}\/logo-panel-[^/]+\.(png|jpe?g|webp)$/i.test(path);
}

function panelAvatarUploadPath(spaceId: string, extension: string) {
  return `${spaceId}/logo-panel-${crypto.randomUUID()}.${extension}`;
}

export async function getPanelAvatarSignedUrl(path: string): Promise<string | null> {
  if (!isPanelAvatarPath(path)) return null;
  const { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(path, PANEL_AVATAR_SIGNED_URL_TTL);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** URL assinada (com cache) da foto de perfil, ou null quando não há foto. */
export function usePanelAvatarUrl(path: string | null) {
  return useQuery({
    queryKey: ["panel-avatar-url", path],
    enabled: !!path,
    staleTime: (PANEL_AVATAR_SIGNED_URL_TTL - 120) * 1000,
    queryFn: () => getPanelAvatarSignedUrl(path!),
  });
}

function isBackgroundPixel(data: Uint8ClampedArray, width: number, x: number, y: number): boolean {
  const i = (y * width + x) * 4;
  const r = data[i]!;
  const g = data[i + 1]!;
  const b = data[i + 2]!;
  const a = data[i + 3]!;
  if (a < 8) return true; // transparente
  return r > NEAR_WHITE && g > NEAR_WHITE && b > NEAR_WHITE;
}

function findTrimBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  let top = 0;
  outer: for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isBackgroundPixel(data, width, x, y)) {
        top = y;
        break outer;
      }
    }
  }
  let bottom = height - 1;
  outer: for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      if (!isBackgroundPixel(data, width, x, y)) {
        bottom = y;
        break outer;
      }
    }
  }
  let left = 0;
  outer: for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      if (!isBackgroundPixel(data, width, x, y)) {
        left = x;
        break outer;
      }
    }
  }
  let right = width - 1;
  outer: for (let x = width - 1; x >= 0; x--) {
    for (let y = 0; y < height; y++) {
      if (!isBackgroundPixel(data, width, x, y)) {
        right = x;
        break outer;
      }
    }
  }
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/**
 * Recorta as bordas brancas/transparentes da imagem antes do upload. Sem borda para
 * cortar, devolve o arquivo original intacto (sem perda de qualidade).
 */
async function trimWhiteEdges(file: File): Promise<{
  blob: Blob;
  extension: string;
  contentType: string;
}> {
  const source = sourceTypes[file.type] ?? { contentType: "image/jpeg", extension: "jpg" };

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return { blob: file, ...source };
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const imageData = ctx.getImageData(0, 0, width, height);
    const trim = findTrimBounds(imageData.data, width, height);
    if (trim.x === 0 && trim.y === 0 && trim.w === width && trim.h === height) {
      return { blob: file, ...source }; // sem borda: original intacto
    }

    const sx = Math.max(0, trim.x - TRIM_PADDING);
    const sy = Math.max(0, trim.y - TRIM_PADDING);
    const sw = Math.min(width - sx, trim.w + TRIM_PADDING * 2);
    const sh = Math.min(height - sy, trim.h + TRIM_PADDING * 2);

    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const outCtx = out.getContext("2d");
    if (!outCtx) return { blob: file, ...source };
    outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    // PNG mantém transparência; JPEG/WebP são exportados como JPEG (alta qualidade).
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const extension = file.type === "image/png" ? "png" : "jpg";
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, outputType, 0.92));
    if (!blob) return { blob: file, ...source };
    return { blob, extension, contentType: outputType };
  } catch {
    return { blob: file, ...source };
  }
}

export async function uploadPanelAvatar({
  businessId,
  file,
  previousPath,
}: {
  businessId: string;
  file: File;
  previousPath: string | null;
}): Promise<string> {
  const validation = await validateLogoFile(file, "logo");
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const prepared = await trimWhiteEdges(file);
  const path = panelAvatarUploadPath(businessId, prepared.extension);
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, prepared.blob, { upsert: false, contentType: prepared.contentType });
  if (uploadError) {
    const message = uploadError.message?.toLowerCase() ?? "";
    const denied =
      message.includes("permission") || message.includes("policy") || message.includes("row-level");
    throw new Error(
      denied
        ? "Você não tem permissão para alterar a foto deste perfil."
        : "Não foi possível enviar a foto. Tente novamente.",
    );
  }

  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      [PANEL_AVATAR_META_KEY]: path,
      [PANEL_AVATAR_TRIMMED_KEY]: true,
    },
  });
  if (metaError) {
    await supabase.storage.from(LOGO_BUCKET).remove([path]);
    throw new Error("A foto foi enviada, mas não foi possível salvar no perfil.");
  }

  if (previousPath && previousPath !== path && isPanelAvatarPath(previousPath)) {
    await supabase.storage.from(LOGO_BUCKET).remove([previousPath]);
  }

  return path;
}

export async function removePanelAvatar(previousPath: string | null): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: { [PANEL_AVATAR_META_KEY]: null },
  });
  if (error) throw new Error("Não foi possível remover a foto do perfil.");
  if (previousPath && isPanelAvatarPath(previousPath)) {
    await supabase.storage.from(LOGO_BUCKET).remove([previousPath]);
  }
}

let panelAvatarRepairInFlight: Promise<void> | null = null;

/**
 * Corrige UMA VEZ (em background) a foto de perfil já salva que ainda tenha
 * bordas brancas/transparentes no arquivo — caso das fotos enviadas antes do
 * recorte automático existir. Baixa a foto atual, remove as bordas e reenvia o
 * resultado no mesmo perfil; dali em diante o arquivo fica "na medida exata" e
 * a exibição não faz nenhum processamento. Falhas são silenciosas (mantém a
 * versão atual e tenta de novo na próxima abertura; nunca em loop por aba).
 */
export function repairPanelAvatarOnce({
  businessId,
  path,
  alreadyTrimmed,
}: {
  businessId: string;
  path: string;
  alreadyTrimmed: boolean;
}): Promise<void> | null {
  if (!path || alreadyTrimmed) return null;
  if (panelAvatarRepairInFlight) return panelAvatarRepairInFlight;

  panelAvatarRepairInFlight = (async () => {
    try {
      const url = await getPanelAvatarSignedUrl(path);
      if (!url) return;
      const response = await fetch(url);
      if (!response.ok) return;
      const blob = await response.blob();
      const file = new File([blob], "avatar-repair", {
        type: blob.type || "image/png",
      });
      await uploadPanelAvatar({ businessId, file, previousPath: path });
    } catch {
      // Silencioso: mantém a versão atual e tenta novamente na próxima abertura.
    } finally {
      panelAvatarRepairInFlight = null;
    }
  })();

  return panelAvatarRepairInFlight;
}
