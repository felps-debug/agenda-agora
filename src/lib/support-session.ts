// A successful impersonation response has already created/validated this token.
// This one-use, in-memory hint avoids immediately validating it a second time.
// Reloads still validate on the server; all privileged operations keep their guards.
let fresh: { token: string; until: number } | undefined;
export function rememberFreshSupportSession(token: string) {
  fresh = { token, until: Date.now() + 30_000 };
}
export function consumeFreshSupportSession(token: string): boolean {
  if (!fresh || fresh.until < Date.now() || fresh.token !== token) return false;
  fresh = undefined;
  return true;
}
export function clearFreshSupportSession() {
  fresh = undefined;
}
