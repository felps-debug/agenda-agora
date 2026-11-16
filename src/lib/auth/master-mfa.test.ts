import { describe, expect, it, vi } from "vitest";
import {
  findMasterTotpFactors,
  issueMasterTotpEnrollment,
  verifyMasterTotpCode,
} from "./master-mfa";

function mfaApi(overrides: Record<string, unknown> = {}) {
  return {
    listFactors: vi.fn().mockResolvedValue({
      data: {
        totp: [
          { id: "pending-id", status: "unverified" },
          { id: "verified-id", status: "verified" },
        ],
      },
      error: null,
    }),
    enroll: vi.fn().mockResolvedValue({
      data: { id: "new-id", totp: { qr_code: "data:image/svg+xml,test", secret: "SECRET" } },
      error: null,
    }),
    challenge: vi.fn().mockResolvedValue({ data: { id: "challenge-id" }, error: null }),
    verify: vi.fn().mockResolvedValue({ data: {}, error: null }),
    getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
      data: { currentLevel: "aal2" },
      error: null,
    }),
    ...overrides,
  };
}

describe("Master TOTP flow", () => {
  it("prefers a verified factor and separately reports an unfinished setup", async () => {
    const api = mfaApi();

    await expect(findMasterTotpFactors(api as never)).resolves.toEqual({
      verifiedFactorId: "verified-id",
      pendingFactorId: "pending-id",
    });
  });

  it("creates a TOTP enrollment without exposing errors from the provider", async () => {
    const api = mfaApi();

    await expect(issueMasterTotpEnrollment(api as never)).resolves.toEqual({
      factorId: "new-id",
      qrCode: "data:image/svg+xml,test",
      secret: "SECRET",
    });
    expect(api.enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Agenda Agora Master",
    });
  });

  it("challenges and verifies the code, requiring AAL2 before success", async () => {
    const api = mfaApi();

    await expect(verifyMasterTotpCode(api as never, "verified-id", "123456")).resolves.toBe("aal2");
    expect(api.challenge).toHaveBeenCalledWith({ factorId: "verified-id" });
    expect(api.verify).toHaveBeenCalledWith({
      factorId: "verified-id",
      challengeId: "challenge-id",
      code: "123456",
    });
  });

  it("does not treat a verified code as success if the session stays at AAL1", async () => {
    const api = mfaApi({
      getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
        data: { currentLevel: "aal1" },
        error: null,
      }),
    });

    await expect(verifyMasterTotpCode(api as never, "verified-id", "123456")).rejects.toThrow(
      "AAL2",
    );
  });
});
