import { describe, expect, it } from "vitest";
import {
  retainTemporarySecretForBusiness,
  visibleTemporaryPassword,
} from "./temporary-secret-state";

describe("senha temporária revelada na ficha Master", () => {
  it("só mostra a senha para o estabelecimento que a gerou", () => {
    const secret = { businessId: "business-a", value: "1234" };

    expect(visibleTemporaryPassword(secret, "business-a")).toBe("1234");
    expect(visibleTemporaryPassword(secret, "business-b")).toBeNull();
    expect(visibleTemporaryPassword(secret, null)).toBeNull();
    expect(retainTemporarySecretForBusiness(secret, "business-a")).toEqual(secret);
    expect(retainTemporarySecretForBusiness(secret, "business-b")).toBeNull();
    expect(retainTemporarySecretForBusiness(secret, null)).toBeNull();
  });
});
