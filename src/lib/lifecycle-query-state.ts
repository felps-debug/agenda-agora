export function lifecycleQueryState(input: {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
}): "loading" | "error" | "ready" {
  if (input.isError) return "error";
  if (input.isLoading || !input.hasData) return "loading";
  return "ready";
}
