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
export const VALID_TARGET_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

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

/** Raw row shape returned by SQLite for activity_stream queries */
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

/** Raw row shape for unclaimed-event activity_stream rows (detail JSON has stealth fields) */
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
  blockTime: number | null
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
// ─────────────────────────────────────────────────────────────────────────────

export interface SentinelConfigShape {
  mode: 'yolo' | 'advisory' | 'off'
  preflightScope: 'fund-actions' | 'critical-only' | 'never'
  blacklistAutonomy: boolean
  rateLimitBlacklistPerHour: number
  autoRefundThreshold: number
  cancelWindowMs: number
}

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
