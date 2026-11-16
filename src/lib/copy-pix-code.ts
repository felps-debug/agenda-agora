export async function copyPixCode(write: () => Promise<void>): Promise<boolean> {
  try {
    await write();
    return true;
  } catch {
    return false;
  }
}
