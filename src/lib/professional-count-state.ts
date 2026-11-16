export function getProfessionalCountState(input: {
  isLoading: boolean;
  isError: boolean;
  count: number;
}): {
  status: "loading" | "error" | "ready";
  canCreate: boolean;
  firstProfessionalFree: boolean;
  atLimit: boolean;
} {
  if (input.isLoading) {
    return { status: "loading", canCreate: false, firstProfessionalFree: false, atLimit: false };
  }
  if (input.isError) {
    return { status: "error", canCreate: false, firstProfessionalFree: false, atLimit: false };
  }
  const atLimit = input.count >= 10;
  return {
    status: "ready",
    canCreate: !atLimit,
    firstProfessionalFree: input.count === 0,
    atLimit,
  };
}
