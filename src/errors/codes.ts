// ─── Error Code Registry ────────────────────────────────────────────────────
// Single source of truth for all API error codes.
// Used by error-handler middleware and served at GET /v1/errors.

export enum ErrorCode {
  // 400 — Bad Request
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_HEX_STRING = 'INVALID_HEX_STRING',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_ADDRESS = 'INVALID_ADDRESS',

  // 401 — Unauthorized
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_API_KEY = 'INVALID_API_KEY',

  // 404 — Not Found
  NOT_FOUND = 'NOT_FOUND',

  // 429 — Too Many Requests
  RATE_LIMITED = 'RATE_LIMITED',

  // 500 — Internal Server Error
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  STEALTH_GENERATION_FAILED = 'STEALTH_GENERATION_FAILED',
  COMMITMENT_FAILED = 'COMMITMENT_FAILED',
  TRANSFER_BUILD_FAILED = 'TRANSFER_BUILD_FAILED',
  TRANSFER_CLAIM_FAILED = 'TRANSFER_CLAIM_FAILED',
  SCAN_FAILED = 'SCAN_FAILED',
  VIEWING_KEY_FAILED = 'VIEWING_KEY_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',

  // 422 — Unprocessable Entity
  BATCH_LIMIT_EXCEEDED = 'BATCH_LIMIT_EXCEEDED',
  BATCH_EMPTY = 'BATCH_EMPTY',
  CHAIN_TRANSFER_UNSUPPORTED = 'CHAIN_TRANSFER_UNSUPPORTED',

  // 400 — Proof errors
  PROOF_GENERATION_FAILED = 'PROOF_GENERATION_FAILED',
  PROOF_VERIFICATION_FAILED = 'PROOF_VERIFICATION_FAILED',

  // 400 — C-SPL errors
  CSPL_OPERATION_FAILED = 'CSPL_OPERATION_FAILED',

  // 500 — Privacy scoring
  PRIVACY_SCORE_FAILED = 'PRIVACY_SCORE_FAILED',

  // 500 — Private Swap
  SWAP_QUOTE_FAILED = 'SWAP_QUOTE_FAILED',
  PRIVATE_SWAP_FAILED = 'PRIVATE_SWAP_FAILED',

  // 400 — Private Swap
  SWAP_UNSUPPORTED_TOKEN = 'SWAP_UNSUPPORTED_TOKEN',

  // 403 — Tier Access
  TIER_ACCESS_DENIED = 'TIER_ACCESS_DENIED',

  // 500 — Compliance
  COMPLIANCE_DISCLOSURE_FAILED = 'COMPLIANCE_DISCLOSURE_FAILED',
  COMPLIANCE_REPORT_FAILED = 'COMPLIANCE_REPORT_FAILED',

  // 404 — Compliance
  COMPLIANCE_REPORT_NOT_FOUND = 'COMPLIANCE_REPORT_NOT_FOUND',

  // 500 — Governance
  GOVERNANCE_ENCRYPT_FAILED = 'GOVERNANCE_ENCRYPT_FAILED',
  GOVERNANCE_SUBMIT_FAILED = 'GOVERNANCE_SUBMIT_FAILED',
  GOVERNANCE_TALLY_FAILED = 'GOVERNANCE_TALLY_FAILED',

  // 404 — Governance
  GOVERNANCE_TALLY_NOT_FOUND = 'GOVERNANCE_TALLY_NOT_FOUND',
  GOVERNANCE_PROPOSAL_NOT_FOUND = 'GOVERNANCE_PROPOSAL_NOT_FOUND',

  // 409 — Governance
  GOVERNANCE_DOUBLE_VOTE = 'GOVERNANCE_DOUBLE_VOTE',

  // 422 — Governance
  GOVERNANCE_BALLOT_LIMIT = 'GOVERNANCE_BALLOT_LIMIT',

  // 404 — Session
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',

  // 410 — Session
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // 500 — Session
  SESSION_CREATE_FAILED = 'SESSION_CREATE_FAILED',

  // 500 — Jito Gas Abstraction
  JITO_RELAY_FAILED = 'JITO_RELAY_FAILED',

  // 404 — Jito Gas Abstraction
  JITO_BUNDLE_NOT_FOUND = 'JITO_BUNDLE_NOT_FOUND',

  // 400 — Jito Gas Abstraction
  JITO_INVALID_TRANSACTION = 'JITO_INVALID_TRANSACTION',

  // 429 — Billing / Quotas
  DAILY_QUOTA_EXCEEDED = 'DAILY_QUOTA_EXCEEDED',

  // 401 — Billing
  BILLING_WEBHOOK_INVALID = 'BILLING_WEBHOOK_INVALID',

  // 500 — Billing
  BILLING_SUBSCRIPTION_FAILED = 'BILLING_SUBSCRIPTION_FAILED',
  BILLING_INVOICE_FAILED = 'BILLING_INVOICE_FAILED',
  BILLING_PORTAL_FAILED = 'BILLING_PORTAL_FAILED',

  // 503 — Service Unavailable
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  SOLANA_RPC_UNAVAILABLE = 'SOLANA_RPC_UNAVAILABLE',
}

export interface ErrorCatalogEntry {
  code: ErrorCode
  httpStatus: number
  description: string
  retryable: boolean
}

export const ERROR_CATALOG: ErrorCatalogEntry[] = [
  // 400
  {
    code: ErrorCode.VALIDATION_ERROR,
    httpStatus: 400,
    description: 'Request body failed schema validation. Check the details field for specifics.',
    retryable: false,
  },
  {
    code: ErrorCode.INVALID_JSON,
    httpStatus: 400,
    description: 'Request body is not valid JSON.',
    retryable: false,
  },
  {
    code: ErrorCode.INVALID_HEX_STRING,
    httpStatus: 400,
    description: 'A hex string parameter is malformed. Expected 0x-prefixed 32-byte hex.',
    retryable: false,
  },
  {
    code: ErrorCode.INVALID_AMOUNT,
    httpStatus: 400,
    description: 'Amount must be a positive integer string with no leading zeros.',
    retryable: false,
  },
  {
    code: ErrorCode.INVALID_ADDRESS,
    httpStatus: 400,
    description: 'Solana address is invalid. Expected a base58-encoded public key (32-44 chars).',
    retryable: false,
  },

  // 401
  {
    code: ErrorCode.UNAUTHORIZED,
    httpStatus: 401,
    description: 'API key required. Provide via X-API-Key header or Authorization: Bearer <key>.',
    retryable: false,
  },
  {
    code: ErrorCode.INVALID_API_KEY,
    httpStatus: 401,
    description: 'The provided API key is not valid.',
    retryable: false,
  },

  // 404
  {
    code: ErrorCode.NOT_FOUND,
    httpStatus: 404,
    description: 'The requested route does not exist.',
    retryable: false,
  },

  // 429
  {
    code: ErrorCode.RATE_LIMITED,
    httpStatus: 429,
    description: 'Too many requests. Back off and retry after the window resets.',
    retryable: true,
  },

  // 500
  {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    httpStatus: 500,
    description: 'An unexpected internal error occurred.',
    retryable: true,
  },
  {
    code: ErrorCode.STEALTH_GENERATION_FAILED,
    httpStatus: 500,
    description: 'Stealth address generation failed due to an internal cryptographic error.',
    retryable: true,
  },
  {
    code: ErrorCode.COMMITMENT_FAILED,
    httpStatus: 500,
    description: 'Pedersen commitment operation failed.',
    retryable: true,
  },
  {
    code: ErrorCode.TRANSFER_BUILD_FAILED,
    httpStatus: 500,
    description: 'Failed to build the shielded transfer transaction.',
    retryable: true,
  },
  {
    code: ErrorCode.TRANSFER_CLAIM_FAILED,
    httpStatus: 500,
    description: 'Failed to claim the stealth payment. Verify keys and stealth address.',
    retryable: true,
  },
  {
    code: ErrorCode.SCAN_FAILED,
    httpStatus: 500,
    description: 'Payment scanning failed. The Solana RPC may be temporarily unavailable.',
    retryable: true,
  },
  {
    code: ErrorCode.VIEWING_KEY_FAILED,
    httpStatus: 500,
    description: 'Viewing key operation failed.',
    retryable: true,
  },
  {
    code: ErrorCode.ENCRYPTION_FAILED,
    httpStatus: 500,
    description: 'Encryption for selective disclosure failed.',
    retryable: true,
  },
  {
    code: ErrorCode.DECRYPTION_FAILED,
    httpStatus: 500,
    description: 'Decryption with viewing key failed. Verify the key matches the ciphertext.',
    retryable: false,
  },

  // 422
  {
    code: ErrorCode.BATCH_LIMIT_EXCEEDED,
    httpStatus: 422,
    description: 'Batch size exceeds the maximum of 100 items per request.',
    retryable: false,
  },
  {
    code: ErrorCode.BATCH_EMPTY,
    httpStatus: 422,
    description: 'Batch request must contain at least one item.',
    retryable: false,
  },
  {
    code: ErrorCode.CHAIN_TRANSFER_UNSUPPORTED,
    httpStatus: 422,
    description: 'Private transfers are not yet supported for this chain. Check supportedChains in the response.',
    retryable: false,
  },

  // 400 — Proof errors
  {
    code: ErrorCode.PROOF_GENERATION_FAILED,
    httpStatus: 400,
    description: 'ZK proof generation failed. Check input parameters (e.g., balance < minimum, expired intent).',
    retryable: false,
  },
  {
    code: ErrorCode.PROOF_VERIFICATION_FAILED,
    httpStatus: 400,
    description: 'ZK proof verification failed. The proof may be invalid or tampered.',
    retryable: false,
  },

  // 400 — C-SPL errors
  {
    code: ErrorCode.CSPL_OPERATION_FAILED,
    httpStatus: 400,
    description: 'Confidential SPL token operation failed. Check input parameters (e.g., unregistered mint, zero amount).',
    retryable: false,
  },

  // 500 — Privacy scoring
  {
    code: ErrorCode.PRIVACY_SCORE_FAILED,
    httpStatus: 500,
    description: 'Privacy score analysis failed. The Solana RPC may be temporarily unavailable.',
    retryable: true,
  },

  // 500 — Private Swap
  {
    code: ErrorCode.SWAP_QUOTE_FAILED,
    httpStatus: 500,
    description: 'Jupiter DEX quote generation failed. The swap provider may be temporarily unavailable.',
    retryable: true,
  },
  {
    code: ErrorCode.PRIVATE_SWAP_FAILED,
    httpStatus: 500,
    description: 'Private swap orchestration failed. One or more steps in the swap pipeline encountered an error.',
    retryable: true,
  },

  // 400 — Private Swap
  {
    code: ErrorCode.SWAP_UNSUPPORTED_TOKEN,
    httpStatus: 400,
    description: 'Token not supported by Jupiter DEX mock. Check supportedTokens in the response.',
    retryable: false,
  },

  // 403 — Tier Access
  {
    code: ErrorCode.TIER_ACCESS_DENIED,
    httpStatus: 403,
    description: 'Endpoint requires a higher API key tier. Upgrade to enterprise for compliance features.',
    retryable: false,
  },

  // 500 — Compliance
  {
    code: ErrorCode.COMPLIANCE_DISCLOSURE_FAILED,
    httpStatus: 500,
    description: 'Compliance selective disclosure failed. Auditor verification or scoped key derivation encountered an error.',
    retryable: true,
  },
  {
    code: ErrorCode.COMPLIANCE_REPORT_FAILED,
    httpStatus: 500,
    description: 'Compliance audit report generation failed.',
    retryable: true,
  },

  // 404 — Compliance
  {
    code: ErrorCode.COMPLIANCE_REPORT_NOT_FOUND,
    httpStatus: 404,
    description: 'Compliance report not found. The report ID may be expired or invalid.',
    retryable: false,
  },

  // 500 — Governance
  {
    code: ErrorCode.GOVERNANCE_ENCRYPT_FAILED,
    httpStatus: 500,
    description: 'Governance ballot encryption failed.',
    retryable: true,
  },
  {
    code: ErrorCode.GOVERNANCE_SUBMIT_FAILED,
    httpStatus: 500,
    description: 'Governance ballot submission failed.',
    retryable: true,
  },
  {
    code: ErrorCode.GOVERNANCE_TALLY_FAILED,
    httpStatus: 500,
    description: 'Governance vote tally failed. The homomorphic sum may have encountered an error.',
    retryable: true,
  },

  // 404 — Governance
  {
    code: ErrorCode.GOVERNANCE_TALLY_NOT_FOUND,
    httpStatus: 404,
    description: 'Tally not found. The tally ID may be expired or invalid.',
    retryable: false,
  },
  {
    code: ErrorCode.GOVERNANCE_PROPOSAL_NOT_FOUND,
    httpStatus: 404,
    description: 'Proposal not found. No ballots have been submitted for this proposal ID.',
    retryable: false,
  },

  // 409 — Governance
  {
    code: ErrorCode.GOVERNANCE_DOUBLE_VOTE,
    httpStatus: 409,
    description: 'Duplicate vote detected. The nullifier has already been used for this proposal.',
    retryable: false,
  },

  // 422 — Governance
  {
    code: ErrorCode.GOVERNANCE_BALLOT_LIMIT,
    httpStatus: 422,
    description: 'Proposal has reached the maximum ballot capacity (10,000). No additional votes can be submitted.',
    retryable: false,
  },

  // 404 — Session
  {
    code: ErrorCode.SESSION_NOT_FOUND,
    httpStatus: 404,
    description: 'Session not found. The session ID may be expired or invalid.',
    retryable: false,
  },

  // 410 — Session
  {
    code: ErrorCode.SESSION_EXPIRED,
    httpStatus: 410,
    description: 'Session has expired. Create a new session.',
    retryable: false,
  },

  // 500 — Session
  {
    code: ErrorCode.SESSION_CREATE_FAILED,
    httpStatus: 500,
    description: 'Failed to create agent session.',
    retryable: true,
  },

  // 500 — Jito Gas Abstraction
  {
    code: ErrorCode.JITO_RELAY_FAILED,
    httpStatus: 500,
    description: 'Jito bundle relay failed. The block engine may be temporarily unavailable.',
    retryable: true,
  },

  // 404 — Jito Gas Abstraction
  {
    code: ErrorCode.JITO_BUNDLE_NOT_FOUND,
    httpStatus: 404,
    description: 'Jito bundle not found. The bundle ID may be expired or invalid.',
    retryable: false,
  },

  // 400 — Jito Gas Abstraction
  {
    code: ErrorCode.JITO_INVALID_TRANSACTION,
    httpStatus: 400,
    description: 'Invalid transaction data. Transactions must be valid base64-encoded serialized Solana transactions.',
    retryable: false,
  },

  // 429 — Billing / Quotas
  {
    code: ErrorCode.DAILY_QUOTA_EXCEEDED,
    httpStatus: 429,
    description: 'Daily operation quota exceeded for your tier. Upgrade your plan or wait until midnight UTC.',
    retryable: true,
  },

  // 401 — Billing
  {
    code: ErrorCode.BILLING_WEBHOOK_INVALID,
    httpStatus: 401,
    description: 'Invalid Stripe webhook signature. The request could not be verified.',
    retryable: false,
  },

  // 500 — Billing
  {
    code: ErrorCode.BILLING_SUBSCRIPTION_FAILED,
    httpStatus: 500,
    description: 'Billing subscription operation failed.',
    retryable: true,
  },
  {
    code: ErrorCode.BILLING_INVOICE_FAILED,
    httpStatus: 500,
    description: 'Billing invoice retrieval failed.',
    retryable: true,
  },
  {
    code: ErrorCode.BILLING_PORTAL_FAILED,
    httpStatus: 500,
    description: 'Failed to create Stripe customer portal session.',
    retryable: true,
  },

  // 503
  {
    code: ErrorCode.SERVICE_UNAVAILABLE,
    httpStatus: 503,
    description: 'Server is shutting down or temporarily unavailable.',
    retryable: true,
  },
  {
    code: ErrorCode.SOLANA_RPC_UNAVAILABLE,
    httpStatus: 503,
    description: 'Solana RPC endpoint is unreachable. Try again shortly.',
    retryable: true,
  },
]

export function getErrorEntry(code: ErrorCode): ErrorCatalogEntry | undefined {
  return ERROR_CATALOG.find(e => e.code === code)
}
