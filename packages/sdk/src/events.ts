import { Connection, PublicKey } from '@solana/web3.js'
import { SIPHER_VAULT_PROGRAM_ID } from './config.js'
import { WSOL_MINT, USDC_MINT, USDT_MINT, fromBaseUnits, getTokenDecimals } from './tokens.js'

// ─────────────────────────────────────────────────────────────────────────────
// Vault event types
// ─────────────────────────────────────────────────────────────────────────────

export type VaultEventType = 'deposit' | 'send' | 'refund'

export interface VaultEvent {
  type: VaultEventType
  /** The wallet that initiated the action */
  wallet: string
  /** Human-readable amount (e.g., "1.5") */
  amount: string
  /** Token symbol or mint prefix for unknown tokens */
  token: string
  /** Full base58 mint address */
  tokenMint: string
  /** Unix timestamp (seconds) */
  timestamp: number
  /** On-chain transaction signature */
  txSignature: string
}

export interface VaultHistoryResult {
  events: VaultEvent[]
  hasMore: boolean
}

export interface VaultHistoryOptions {
  /** Filter by token mint (base58 address) */
  tokenMint?: string
  /** Maximum events to return (default: 20) */
  limit?: number
  /** Transaction signature to start scanning before (pagination) */
  before?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Known mint symbol resolution
// ─────────────────────────────────────────────────────────────────────────────

const MINT_SYMBOLS: Record<string, string> = {
  [WSOL_MINT.toBase58()]: 'SOL',
  [USDC_MINT.toBase58()]: 'USDC',
  [USDT_MINT.toBase58()]: 'USDT',
}

function mintToSymbol(mint: string): string {
  return MINT_SYMBOLS[mint] ?? mint.slice(0, 8)
}

// ─────────────────────────────────────────────────────────────────────────────
// Event layout sizes
//
// VaultWithdrawEvent (194+ bytes):
//   disc(8) + depositor(32) + stealth(32) + commitment(33) + ephemeral(33)
//   + vk_hash(32) + amount(8) + fee(8) + timestamp(8) = 194
//
// VaultDepositEvent / VaultRefundEvent (88+ bytes):
//   disc(8) + depositor(32) + token_mint(32) + amount(8) + timestamp(8) = 88
// ─────────────────────────────────────────────────────────────────────────────

const WITHDRAW_EVENT_MIN_SIZE = 194
const DEPOSIT_EVENT_MIN_SIZE = 88

// ─────────────────────────────────────────────────────────────────────────────
// parseVaultEvents — Parse Anchor "Program data:" log lines
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse vault events from a transaction's log messages.
 *
 * Anchor emits events as base64 after "Program data: " prefix.
 * We distinguish event types by their decoded size:
 * - >= 194 bytes: VaultWithdrawEvent → type 'send'
 * - >= 88 bytes:  VaultDepositEvent or VaultRefundEvent → type 'deposit' (default)
 *
 * Note: Deposit vs refund cannot be reliably distinguished from event data alone
 * since they share the same layout. The caller or a higher-level heuristic
 * (instruction discriminator in the tx) can refine this.
 */
export function parseVaultEvents(
  logMessages: string[],
  txSignature: string,
  blockTime: number | null | undefined
): VaultEvent[] {
  const events: VaultEvent[] = []
  const ts = blockTime ?? 0

  for (const log of logMessages) {
    if (!log.startsWith('Program data: ')) continue

    const raw = log.slice('Program data: '.length)
    let data: Buffer
    try {
      data = Buffer.from(raw, 'base64')
    } catch {
      continue // malformed base64
    }

    if (data.length >= WITHDRAW_EVENT_MIN_SIZE) {
      const event = parseWithdrawEvent(data, txSignature, ts)
      if (event) events.push(event)
    } else if (data.length >= DEPOSIT_EVENT_MIN_SIZE) {
      const event = parseDepositOrRefundEvent(data, txSignature, ts)
      if (event) events.push(event)
    }
    // Smaller payloads are not vault events — skip silently
  }

  return events
}

/**
 * Parse a VaultWithdrawEvent → VaultEvent with type 'send'.
 *
 * Layout (after 8-byte discriminator):
 *   depositor(32) + stealth(32) + commitment(33) + ephemeral(33)
 *   + vk_hash(32) + transfer_amount(8) + fee_amount(8) + timestamp(8)
 */
function parseWithdrawEvent(
  data: Buffer,
  txSignature: string,
  fallbackTimestamp: number
): VaultEvent | null {
  try {
    let offset = 8 // skip discriminator

    const wallet = new PublicKey(data.subarray(offset, offset + 32)).toBase58()
    offset += 32

    // Skip stealth(32) + commitment(33) + ephemeral(33) + vk_hash(32)
    offset += 32 + 33 + 33 + 32

    const amountRaw = data.readBigUInt64LE(offset)
    offset += 8

    // Skip fee(8)
    offset += 8

    const eventTimestamp = Number(data.readBigInt64LE(offset))
    const timestamp = eventTimestamp > 0 ? eventTimestamp : fallbackTimestamp

    // Withdraw events don't include the token_mint in the event data.
    // Default to SOL since that's the primary vault token.
    const mintKey = WSOL_MINT
    const decimals = getTokenDecimals(mintKey)
    const amount = fromBaseUnits(amountRaw, decimals)

    return {
      type: 'send',
      wallet,
      amount,
      token: mintToSymbol(mintKey.toBase58()),
      tokenMint: mintKey.toBase58(),
      timestamp,
      txSignature,
    }
  } catch {
    return null
  }
}

/**
 * Parse a VaultDepositEvent or VaultRefundEvent → VaultEvent.
 *
 * Layout (after 8-byte discriminator):
 *   depositor(32) + token_mint(32) + amount(8) + timestamp(8)
 *
 * These two events share the same layout. We default to 'deposit' type.
 */
function parseDepositOrRefundEvent(
  data: Buffer,
  txSignature: string,
  fallbackTimestamp: number
): VaultEvent | null {
  try {
    let offset = 8 // skip discriminator

    const wallet = new PublicKey(data.subarray(offset, offset + 32)).toBase58()
    offset += 32

    const tokenMint = new PublicKey(data.subarray(offset, offset + 32)).toBase58()
    offset += 32

    const amountRaw = data.readBigUInt64LE(offset)
    offset += 8

    const eventTimestamp = Number(data.readBigInt64LE(offset))
    const timestamp = eventTimestamp > 0 ? eventTimestamp : fallbackTimestamp

    const mintKey = new PublicKey(tokenMint)
    const decimals = getTokenDecimals(mintKey)
    const amount = fromBaseUnits(amountRaw, decimals)

    return {
      type: 'deposit',
      wallet,
      amount,
      token: mintToSymbol(tokenMint),
      tokenMint,
      timestamp,
      txSignature,
    }
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getVaultHistory — Fetch and parse on-chain vault events for a wallet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch vault transaction history for a specific wallet.
 *
 * Queries the sipher_vault program's transaction signatures, parses event logs,
 * and filters by wallet address and optional token mint.
 */
export async function getVaultHistory(
  connection: Connection,
  wallet: string,
  options: VaultHistoryOptions = {}
): Promise<VaultHistoryResult> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)

  // Overfetch signatures since not all transactions will match the wallet filter
  const fetchLimit = limit * 3
  const sigOpts: { limit: number; before?: string } = { limit: fetchLimit }
  if (options.before) {
    sigOpts.before = options.before
  }

  const signatures = await connection.getSignaturesForAddress(
    SIPHER_VAULT_PROGRAM_ID,
    sigOpts,
    'confirmed'
  )

  if (signatures.length === 0) {
    return { events: [], hasMore: false }
  }

  // Fetch parsed transactions in batch
  const txSigs = signatures.map((s) => s.signature)
  const transactions = await connection.getParsedTransactions(
    txSigs,
    { maxSupportedTransactionVersion: 0 }
  )

  // Parse events from all transactions
  const allEvents: VaultEvent[] = []

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i]
    if (!tx?.meta?.logMessages) continue

    const blockTime = tx.blockTime ?? null
    const parsed = parseVaultEvents(tx.meta.logMessages, txSigs[i], blockTime)
    allEvents.push(...parsed)
  }

  // Filter by wallet
  let filtered = allEvents.filter((e) => e.wallet === wallet)

  // Filter by token mint if specified
  if (options.tokenMint) {
    filtered = filtered.filter((e) => e.tokenMint === options.tokenMint)
  }

  // Sort by timestamp descending (most recent first)
  filtered.sort((a, b) => b.timestamp - a.timestamp)

  // Apply limit
  const hasMore = filtered.length > limit
  const events = filtered.slice(0, limit)

  return { events, hasMore }
}
