export function canEditBusinessCoupon(input: {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
}) {
  return !input.isLoading && !input.isError && input.hasData;
}
