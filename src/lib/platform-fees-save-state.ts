export function isPlatformFeesSaveDisabled(state: {
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
}): boolean {
  return state.isPending || state.isLoading || state.isError;
}
