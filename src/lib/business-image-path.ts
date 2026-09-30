const businessIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageFilenamePattern = /^[^/]+\.(?:png|jpe?g|webp)$/i;

export type BusinessImageMimeType = "image/png" | "image/jpeg" | "image/webp";

const mimeByExtension: Record<string, BusinessImageMimeType> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function detectBusinessImageMimeType(bytes: Uint8Array): BusinessImageMimeType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function isBusinessImagePath(
  path: string,
  businessId: string,
  kind: "logo" | "service" | "background",
): boolean {
  if (!businessIdPattern.test(businessId)) return false;
  const prefix = `${businessId}/`;
  if (!path.toLowerCase().startsWith(prefix.toLowerCase())) return false;
  const relativePath = path.slice(prefix.length);
  if (kind === "logo") {
    return relativePath.startsWith("logo-") && imageFilenamePattern.test(relativePath);
  }
  if (kind === "background") {
    return relativePath.startsWith("background-") && imageFilenamePattern.test(relativePath);
  }
  return (
    relativePath.startsWith("services/") &&
    imageFilenamePattern.test(relativePath.slice("services/".length))
  );
}

export function businessImageSignatureMatchesPath(
  bytes: Uint8Array,
  path: string,
  businessId: string,
  kind: "logo" | "service" | "background",
): boolean {
  if (!isBusinessImagePath(path, businessId, kind)) return false;
  const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
  return detectBusinessImageMimeType(bytes) === mimeByExtension[extension];
}
