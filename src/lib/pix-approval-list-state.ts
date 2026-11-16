export function pixApprovalListState(input: {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  hasPending: boolean;
}): "loading" | "error" | "empty" | "ready" {
  if (input.isError) return "error";
  if (input.isLoading || !input.hasData) return "loading";
  return input.hasPending ? "ready" : "empty";
}
