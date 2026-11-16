type QuerySnapshot = { isPending: boolean; isError: boolean; hasData: boolean };

export function getAppearanceEditorLoadState(input: {
  config: QuerySnapshot;
  profile: QuerySnapshot;
}): "loading" | "error" | "ready" {
  const snapshots = [input.config, input.profile];
  if (snapshots.some((query) => query.isError && !query.hasData)) return "error";
  if (snapshots.some((query) => query.isPending && !query.hasData)) return "loading";
  return "ready";
}
