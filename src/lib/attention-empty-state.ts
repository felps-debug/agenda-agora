export type AttentionEmptyState = "global-empty" | "filtered-empty" | null;

export function attentionEmptyState(input: {
  allCount: number;
  filteredCount: number;
  hasActiveFilters: boolean;
  isReady: boolean;
}): AttentionEmptyState {
  if (!input.isReady) return null;
  if (input.allCount === 0) return "global-empty";
  if (input.filteredCount === 0 && input.hasActiveFilters) return "filtered-empty";
  return null;
}
