// packages/agent/tests/fixtures/sentinel-tool-mocks.ts
//
// Shared data-shape factories for SENTINEL tool tests (Phase 5 PR-2).
// Each factory returns the shape that real db.ts helpers / @solana/web3.js
// methods / sentinel config / etc. return, with sensible defaults and
// override-friendly partial inputs.
//
// NOTE: This file does NOT export vi.fn() instances. Vitest hoists vi.mock
// above imports, so vi.fn() instances must be declared per-test-file via
// vi.hoisted to avoid TDZ. This file holds DATA shapes only — call sites
// pass them into mockResolvedValueOnce / mockReturnValueOnce inside tests.

// ─────────────────────────────────────────────────────────────────────────────
// Test constants
// ─────────────────────────────────────────────────────────────────────────────

/** Real-format devnet wallet (RECTOR's shared dev wallet) */
export const VALID_WALLET = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr'

/** A second valid base58 pubkey for recipient/PDA tests */
export const VALID_PDA = 'So11111111111111111111111111111111111111112'

/** A third valid base58 pubkey for blacklist-target tests */
export const VALID_TARGET_ADDRESS = 'BadAcT11111111111111111111111111111111111111'

/** Synthetic ULID (Crockford base32, 26 chars) — matches the shape ulid() produces */
export const VALID_ENTRY_ID = '01HZZZZZZZZZZZZZZZZZZZZZZZ'
export const VALID_ACTION_ID = '01HZZZZAAAAAAAAAAAAAAAAAAA'
export const VALID_DECISION_ID = '01HZZZBBBBBBBBBBBBBBBBBBBB'
export const VALID_ACTIVITY_ID = '01HZZZCCCCCCCCCCCCCCCCCCCC'

/** SOL token program id (used by getVaultBalance) */
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

/** Sample SPL token mint (USDC devnet) */
export const SAMPLE_TOKEN_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

// ─────────────────────────────────────────────────────────────────────────────
// db.ts helper return shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface BlacklistEntryShape {
  id: string
  address: string
  reason: string
  severity: 'warn' | 'block' | 'critical'
  addedBy: string
  addedAt: string
  expiresAt: string | null
  removedAt: string | null
  removedBy: string | null
  removedReason: string | null
  sourceEventId: string | null
}

export function makeBlacklistEntry(
  overrides: Partial<BlacklistEntryShape> = {},
): BlacklistEntryShape {
  return {
    id: VALID_ENTRY_ID,
    address: VALID_TARGET_ADDRESS,
    reason: 'scam',
    severity: 'block',
    addedBy: 'sentinel',
    addedAt: '2026-05-04T00:00:00.000Z',
    expiresAt: null,
    removedAt: null,
    removedBy: null,
    removedReason: null,
    sourceEventId: null,
    ...overrides,
  }
}

export interface RiskHistoryRowShape {
  id: string
  address: string
  contextAction: string | null
  wallet: string | null
  risk: 'low' | 'medium' | 'high'
  score: number
  reasons: string[]
  recommendation: 'allow' | 'warn' | 'block'
  decisionId: string | null
  createdAt: string
}

export function makeRiskHistoryRow(
  overrides: Partial<RiskHistoryRowShape> = {},
): RiskHistoryRowShape {
  return {
    id: VALID_ENTRY_ID,
    address: VALID_TARGET_ADDRESS,
    contextAction: null,
    wallet: null,
    risk: 'high',
    score: 90,
    reasons: ['known-mixer'],
    recommendation: 'block',
    decisionId: null,
    createdAt: '2026-05-04T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * Shape of activity_stream rows as projected by `getRecentActivity` in
 * `src/sentinel/tools/get-recent-activity.ts`. The real activity_stream
 * table has more columns (actionable, action_type, action_data) that
 * are not selected by this query path.
 */
export interface ActivityStreamRowShape {
  id: string
  agent: string
  level: string
  type: string
  title: string
  detail: string | null
  wallet: string | null
  created_at: string
}

export function makeActivityStreamRow(
  overrides: Partial<ActivityStreamRowShape> = {},
): ActivityStreamRowShape {
  return {
    id: VALID_ACTIVITY_ID,
    agent: 'sipher',
    level: 'important',
    type: 'action',
    title: 'send 1 SOL',
    detail: '{}',
    wallet: VALID_WALLET,
    created_at: '2026-05-04T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * Two-field projection (`detail`, `created_at`) returned by the SQL query
 * inside `executeGetPendingClaims`. NOT the full activity_stream row —
 * that query selects only these two columns.
 */
export function makePendingClaimRow(
  overrides: Partial<{ detail: string; created_at: string }> = {},
): { detail: string; created_at: string } {
  return {
    detail: JSON.stringify({ ephemeralPubkey: 'eph1', amount: 0.5 }),
    created_at: '2026-05-04T00:00:00.000Z',
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// @solana/web3.js return shapes
// ─────────────────────────────────────────────────────────────────────────────

export interface OnChainSignatureRPCShape {
  signature: string
  slot: number
  blockTime?: number | null
  err: unknown
  memo: string | null
}

export function makeOnChainSignature(
  overrides: Partial<OnChainSignatureRPCShape> = {},
): OnChainSignatureRPCShape {
  return {
    signature: '5xyz' + 'a'.repeat(83),
    slot: 100,
    blockTime: 1_700_000_000,
    err: null,
    memo: null,
    ...overrides,
  }
}

/** Shape returned by `getParsedTokenAccountsByOwner` value entries */
export interface ParsedTokenAccountShape {
  account: {
    data: {
      parsed: {
        info: {
          mint: string
          tokenAmount: { uiAmount: number }
        }
      }
    }
  }
}

export function makeParsedTokenAccount(
  mint = SAMPLE_TOKEN_MINT,
  uiAmount = 100,
): ParsedTokenAccountShape {
  return {
    account: {
      data: {
        parsed: {
          info: {
            mint,
            tokenAmount: { uiAmount },
          },
        },
      },
    },
  }
}

/** Shape returned by `getAccountInfo` */
export interface AccountInfoShape {
  lamports: number
  owner: { toBase58: () => string }
  data: Buffer
  executable: boolean
  rentEpoch: number
}

export function makeAccountInfo(
  overrides: Partial<AccountInfoShape> = {},
): AccountInfoShape {
  return {
    lamports: 1_000_000_000,
    owner: { toBase58: () => VALID_PDA },
    data: Buffer.from([]),
    executable: false,
    rentEpoch: 100,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SentinelConfig shape
//
// This is a SUBSET of the real `SentinelConfig` interface (in
// `src/sentinel/config.ts`) covering only the fields read by the 14 SENTINEL
// tools as of 2026-05-04: mode, preflightScope, blacklistAutonomy,
// rateLimitBlacklistPerHour, autoRefundThreshold, cancelWindowMs.
//
// If a future SENTINEL tool reads other fields, extend this shape to match.
// We deliberately don't import the real type to keep the fixture self-contained
// per the Phase 5 spec (no global Phase 5 fixture).
// ─────────────────────────────────────────────────────────────────────────────

export interface SentinelConfigShape {
  mode: 'yolo' | 'advisory' | 'off'
  preflightScope: 'fund-actions' | 'critical-only' | 'never'
  blacklistAutonomy: boolean
  rateLimitBlacklistPerHour: number
  autoRefundThreshold: number
  cancelWindowMs: number
}

/**
 * Build a SentinelConfig fixture. Default mode is `'yolo'` (permissive — lets
 * action tools run). Production VPS runs in `'advisory'` mode; tests for
 * advisory-mode behavior should override `mode: 'advisory'` explicitly.
 */
export function makeSentinelConfig(
  overrides: Partial<SentinelConfigShape> = {},
): SentinelConfigShape {
  return {
    mode: 'yolo',
    preflightScope: 'fund-actions',
    blacklistAutonomy: true,
    rateLimitBlacklistPerHour: 10,
    autoRefundThreshold: 5,
    cancelWindowMs: 30_000,
    ...overrides,
  }
}
