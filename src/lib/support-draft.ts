export async function submitSupportDraft(
  draft: string,
  send: (message: string) => Promise<unknown>,
  clearDraft: (submittedDraft: string) => void,
): Promise<void> {
  const message = draft.trim();
  if (!message) return;
  await send(message);
  clearDraft(draft);
}
