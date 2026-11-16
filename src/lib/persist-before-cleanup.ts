export async function persistBeforeCleanup(
  persist: () => Promise<void>,
  cleanup: () => Promise<void>,
): Promise<void> {
  await persist();
  await cleanup();
}
