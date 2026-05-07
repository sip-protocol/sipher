import 'express-serve-static-core'

declare module 'express-serve-static-core' {
  interface Request {
    /** Wallet pubkey extracted from JWT by verifyJwt middleware. */
    wallet?: string
    /** True if the wallet is in AUTHORIZED_WALLETS. Set by requireOwner middleware. */
    isAdmin?: boolean
  }
}
