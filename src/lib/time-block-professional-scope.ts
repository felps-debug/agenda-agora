export function canCreateTimeBlock(input: {
  isLoading: boolean;
  isError: boolean;
  professionalsCount: number;
  professionalId?: string | null | undefined;
}): boolean {
  if (input.isLoading || input.isError) return false;
  if (input.professionalsCount > 1 && input.professionalId === undefined) return false;
  return true;
}
