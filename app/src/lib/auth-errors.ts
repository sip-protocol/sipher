// Pattern for error messages that originate from a 401-class auth failure
// the global apiFetch interceptor already surfaces via toast. Components
// that catch their own errors use this to suppress double-display so the
// user sees one Session-expired toast, not a toast plus an inline string.
//
// Tightened on purpose: the bare word "expired" is NOT a match, because
// non-auth endpoints reuse it (e.g. "flag not found or expired" from a
// promise-gate 404). Match the specific phrasings the agent + auth
// middleware actually emit.
export const AUTH_ERROR_PATTERN =
  /\b401\b|invalid (or expired )?token|expired token|token (has )?expired|session expired|unauthori[sz]ed|authentication required/i

export function isAuthError(message: string | null | undefined): boolean {
  if (!message) return false
  return AUTH_ERROR_PATTERN.test(message)
}
