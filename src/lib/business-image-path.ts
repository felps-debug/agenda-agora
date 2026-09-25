const businessIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageFilenamePattern = /^[^/]+\.(?:png|jpe?g|webp)$/i;

export function isBusinessImagePath(
  path: string,
  businessId: string,
  kind: "logo" | "service",
): boolean {
  if (!businessIdPattern.test(businessId)) return false;
  const prefix = `${businessId}/`;
  if (!path.toLowerCase().startsWith(prefix.toLowerCase())) return false;
  const relativePath = path.slice(prefix.length);
  if (kind === "logo") {
    return relativePath.startsWith("logo-") && imageFilenamePattern.test(relativePath);
  }
  return (
    relativePath.startsWith("services/") &&
    imageFilenamePattern.test(relativePath.slice("services/".length))
  );
}
