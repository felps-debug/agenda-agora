const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export function isProfessionalAvatarPathForBusiness(path: string, businessId: string): boolean {
  if (!new RegExp(`^${UUID}$`, "i").test(businessId)) return false;
  const prefix = `${businessId}/professional/`;
  if (!path.startsWith(prefix)) return false;

  const fileName = path.slice(prefix.length);
  return /^[a-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(fileName);
}
