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

  // 500 — Arcium MPC
  ARCIUM_COMPUTATION_FAILED = 'ARCIUM_COMPUTATION_FAILED',

  // 404 — Arcium MPC
  ARCIUM_COMPUTATION_NOT_FOUND = 'ARCIUM_COMPUTATION_NOT_FOUND',

  // 400 — Arcium MPC
  ARCIUM_DECRYPT_FAILED = 'ARCIUM_DECRYPT_FAILED',

  // 500 — Inco FHE
  INCO_ENCRYPTION_FAILED = 'INCO_ENCRYPTION_FAILED',

  // 404 — Inco FHE
  INCO_COMPUTATION_NOT_FOUND = 'INCO_COMPUTATION_NOT_FOUND',

  // 400 — Inco FHE
  INCO_DECRYPT_FAILED = 'INCO_DECRYPT_FAILED',

  // 500 — Private Swap
  SWAP_QUOTE_FAILED = 'SWAP_QUOTE_FAILED',
  PRIVATE_SWAP_FAILED = 'PRIVATE_SWAP_FAILED',

  // 400 — Private Swap
  SWAP_UNSUPPORTED_TOKEN = 'SWAP_UNSUPPORTED_TOKEN',

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

  // 500 — Arcium MPC
  {
    code: ErrorCode.ARCIUM_COMPUTATION_FAILED,
    httpStatus: 500,
    description: 'Arcium MPC computation failed. The cluster may be temporarily unavailable.',
    retryable: true,
  },

  // 404 — Arcium MPC
  {
    code: ErrorCode.ARCIUM_COMPUTATION_NOT_FOUND,
    httpStatus: 404,
    description: 'Arcium computation not found. The computation ID may be expired or invalid.',
    retryable: false,
  },

  // 400 — Arcium MPC
  {
    code: ErrorCode.ARCIUM_DECRYPT_FAILED,
    httpStatus: 400,
    description: 'Arcium decryption failed. The computation may not be completed or the viewing key is invalid.',
    retryable: false,
  },

  // 500 — Inco FHE
  {
    code: ErrorCode.INCO_ENCRYPTION_FAILED,
    httpStatus: 500,
    description: 'Inco FHE encryption failed. The FHE provider may be temporarily unavailable.',
    retryable: true,
  },

  // 404 — Inco FHE
  {
    code: ErrorCode.INCO_COMPUTATION_NOT_FOUND,
    httpStatus: 404,
    description: 'Inco computation not found. The computation ID may be expired or invalid.',
    retryable: false,
  },

  // 400 — Inco FHE
  {
    code: ErrorCode.INCO_DECRYPT_FAILED,
    httpStatus: 400,
    description: 'Inco decryption failed. The computation ID may be invalid.',
    retryable: false,
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
