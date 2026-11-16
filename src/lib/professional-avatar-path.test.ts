import { describe, expect, it } from "vitest";
import { isProfessionalAvatarPathForBusiness } from "./professional-avatar-path";

const businessId = "11111111-1111-4111-8111-111111111111";

describe("isProfessionalAvatarPathForBusiness", () => {
  it.each(["png", "jpg", "jpeg", "webp"])(
    "accepts a published %s photo for its business",
    (ext) => {
      expect(
        isProfessionalAvatarPathForBusiness(`${businessId}/professional/photo.${ext}`, businessId),
      ).toBe(true);
    },
  );

  it.each([
    "66666666-6666-4666-8666-666666666666/professional/photo.png",
    `${businessId}/staging/photo.png`,
    `${businessId}/professional/../staging/photo.png`,
    `${businessId}/professional/nested/photo.png`,
    `${businessId}/professional/photo.svg`,
  ])("rejects a non-published or foreign path: %s", (path) => {
    expect(isProfessionalAvatarPathForBusiness(path, businessId)).toBe(false);
  });
});
