// Augment the Express Request type with auth fields populated by middleware.
//
// `wallet` is set by `verifyJwt` (from JWT decode or SSE ticket lookup).
// `isAdmin` is reserved for future use; currently `requireOwner` rejects
// non-admin requests at the middleware boundary rather than tagging the
// request, but the field is part of the typed surface so route handlers
// can read it once that pattern lands.

declare global {
  namespace Express {
    interface Request {
      wallet?: string
      isAdmin?: boolean
    }
  }
}

export {}
