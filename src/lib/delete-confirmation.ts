export function nextDeleteConfirmation(
  currentId: string | null,
  targetId: string,
  succeeded: boolean,
): string | null {
  return succeeded && currentId === targetId ? null : currentId;
}
