export type SupportQueryViewState = "loading" | "error" | "ready";

export function supportQueryState(input: {
  isPending: boolean;
  isError: boolean;
  hasData: boolean;
}): SupportQueryViewState {
  if (input.isError) return "error";
  if (input.isPending || !input.hasData) return "loading";
  return "ready";
}
