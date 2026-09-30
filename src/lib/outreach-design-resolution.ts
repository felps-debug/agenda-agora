import { parseOutreachDesign, type OutreachDesign } from "./outreach-design";

export function resolveEffectiveOutreachDesign(defaultDesign: unknown, overrideDesign?: unknown) {
  return parseOutreachDesign(overrideDesign ?? defaultDesign);
}

export function businessOwnerCanEdit(businessOwnerId: string, sessionUserId: string) {
  return businessOwnerId === sessionUserId;
}

export function designsDiffer(left: OutreachDesign, right: OutreachDesign) {
  return JSON.stringify(left) !== JSON.stringify(right);
}
