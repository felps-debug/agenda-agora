type Factor = { id: string; status: string };

type MasterMfaApi = {
  listFactors: () => Promise<{
    data: { totp: Factor[] } | null;
    error: unknown;
  }>;
  enroll: (args: { factorType: "totp"; friendlyName: string }) => Promise<{
    data: { id: string; totp: { qr_code: string; secret: string } } | null;
    error: unknown;
  }>;
  challenge: (args: { factorId: string }) => Promise<{
    data: { id: string } | null;
    error: unknown;
  }>;
  verify: (args: { factorId: string; challengeId: string; code: string }) => Promise<{
    error: unknown;
  }>;
  getAuthenticatorAssuranceLevel: () => Promise<{
    data: { currentLevel: string | null } | null;
    error: unknown;
  }>;
};

export async function findMasterTotpFactors(mfa: MasterMfaApi) {
  const { data, error } = await mfa.listFactors();
  if (error || !data) throw new Error("Não foi possível consultar os autenticadores cadastrados.");
  return {
    verifiedFactorId: data.totp.find((factor) => factor.status === "verified")?.id ?? null,
    pendingFactorId: data.totp.find((factor) => factor.status === "unverified")?.id ?? null,
  };
}

export async function issueMasterTotpEnrollment(mfa: MasterMfaApi) {
  const { data, error } = await mfa.enroll({
    factorType: "totp",
    friendlyName: "Agenda Agora Master",
  });
  if (error || !data?.totp.qr_code || !data.totp.secret) {
    throw new Error("Não foi possível iniciar a configuração do autenticador.");
  }
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyMasterTotpCode(
  mfa: MasterMfaApi,
  factorId: string,
  code: string,
): Promise<"aal2"> {
  if (!/^\d{6}$/.test(code)) throw new Error("Informe um código TOTP de 6 dígitos.");
  const { data: challenge, error: challengeError } = await mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    throw new Error("Não foi possível criar o desafio TOTP.");
  }
  const { error: verifyError } = await mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) throw new Error("O código TOTP foi recusado.");
  const { data: assurance, error: assuranceError } = await mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2") {
    throw new Error("A sessão não atingiu o nível AAL2.");
  }
  return "aal2";
}
