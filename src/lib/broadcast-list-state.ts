export type BroadcastListState = "loading" | "error" | "empty" | "items";

export function getBroadcastListState<T>(input: {
  isLoading: boolean;
  isError: boolean;
  data: readonly T[] | undefined;
}): BroadcastListState {
  if (input.isLoading) return "loading";
  if (input.isError) return "error";
  return input.data?.length ? "items" : "empty";
}
