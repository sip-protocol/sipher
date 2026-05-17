import { Buffer } from 'node:buffer'
import { ed25519 } from '@noble/curves/ed25519'
import {
  PublicKey,
  type Connection,
  type ParsedInstruction,
  type PartiallyDecodedInstruction,
} from '@solana/web3.js'

export class StealthContextError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'deposit_not_found'
      | 'no_withdraw_event'
      | 'no_token_transfer'
      | 'stealth_ata_mismatch',
  ) {
    super(message)
    this.name = 'StealthContextError'
  }
}

export interface StealthContext {
  /** Base58-encoded stealth pubkey (must equal the stealth ATA's owner). */
  stealthAddress: string
  /** Base58-encoded ephemeral pubkey (32 bytes, 0x00 prefix already stripped). */
  ephemeralPublicKey: string
  /** Base58-encoded SPL token mint of the stealth ATA. */
  mint: string
}

const PROGRAM_DATA_PREFIX = 'Program data: '
/**
 * Minimum VaultWithdrawEvent bytes:
 * 8 (disc) + 32 (depositor) + 32 (stealth) + 33 (commitment) + 33 (ephemeral)
 *  + 32 (vk_hash) + 8 (amount) + 8 (fee) + 8 (ts) = 194
 */
const WITHDRAW_EVENT_MIN_BYTES = 194
const SPL_TOKEN_PROGRAMS = new Set(['spl-token', 'spl-token-2022'])

function isParsedInstruction(
  ix: ParsedInstruction | PartiallyDecodedInstruction,
): ix is ParsedInstruction {
  return 'program' in ix && 'parsed' in ix
}

/**
 * Resolves a deposit transaction signature into the cryptographic context
 * needed by `claimStealthPayment`. Two RPC calls: one `getParsedTransaction`
 * (to read the VaultWithdrawEvent log + SPL transfer instruction) and one
 * `getParsedAccountInfo` (to sanity-check the stealth ATA's owner).
 */
export async function resolveStealthContext(
  connection: Connection,
  depositTxSignature: string,
): Promise<StealthContext> {
  const tx = await connection.getParsedTransaction(depositTxSignature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  })

  if (!tx) {
    throw new StealthContextError(
      `Deposit transaction ${depositTxSignature.slice(0, 12)}... not found on chain`,
      'deposit_not_found',
    )
  }

  const event = parseWithdrawEventFromLogs(tx.meta?.logMessages ?? [])
  if (!event) {
    throw new StealthContextError(
      `No VaultWithdrawEvent in deposit ${depositTxSignature.slice(0, 12)}... — is this a sipher private send?`,
      'no_withdraw_event',
    )
  }

  const topLevel = tx.transaction.message.instructions
  const inner = (tx.meta?.innerInstructions ?? []).flatMap((g) => g.instructions)
  const allInstructions: ReadonlyArray<ParsedInstruction | PartiallyDecodedInstruction> = [
    ...topLevel,
    ...inner,
  ]

  const tokenIx = allInstructions.filter(isParsedInstruction).find((ix) => {
    if (!SPL_TOKEN_PROGRAMS.has(ix.program)) return false
    const parsed = ix.parsed as { type?: string; info?: unknown } | string | null
    if (typeof parsed !== 'object' || parsed === null) return false
    if (parsed.type !== 'transferChecked') return false
    if (typeof parsed.info !== 'object' || parsed.info === null) return false
    return true
  })
  if (!tokenIx) {
    throw new StealthContextError(
      `No SPL transferChecked instruction in deposit ${depositTxSignature.slice(0, 12)}...`,
      'no_token_transfer',
    )
  }

  const tokenInfo = (tokenIx.parsed as { info: { destination?: unknown; mint?: unknown } }).info
  const stealthATA = typeof tokenInfo.destination === 'string' ? tokenInfo.destination : null
  const mint = typeof tokenInfo.mint === 'string' ? tokenInfo.mint : null
  if (!stealthATA || !mint) {
    throw new StealthContextError(
      `SPL transferChecked missing destination or mint in deposit ${depositTxSignature.slice(0, 12)}...`,
      'no_token_transfer',
    )
  }

  const ataInfo = await connection.getParsedAccountInfo(new PublicKey(stealthATA))
  const ataData = ataInfo?.value?.data
  const ataOwner =
    ataData && typeof ataData === 'object' && 'parsed' in ataData
      ? ((ataData.parsed as { info?: { owner?: unknown } } | undefined)?.info?.owner ?? null)
      : null
  if (typeof ataOwner !== 'string') {
    throw new StealthContextError(
      `Stealth ATA ${stealthATA.slice(0, 12)}... is unreadable or not a parsed token account`,
      'stealth_ata_mismatch',
    )
  }
  if (ataOwner !== event.stealthAddress) {
    throw new StealthContextError(
      `Stealth ATA owner ${ataOwner.slice(0, 12)}... does not match VaultWithdrawEvent stealth_recipient ${event.stealthAddress.slice(0, 12)}...`,
      'stealth_ata_mismatch',
    )
  }

  return {
    stealthAddress: event.stealthAddress,
    ephemeralPublicKey: event.ephemeralPublicKey,
    mint,
  }
}

interface WithdrawEvent {
  stealthAddress: string
  ephemeralPublicKey: string
}

/**
 * Parses the first decode-able VaultWithdrawEvent out of `Program data: <b64>`
 * log lines. Mirrors `parseWithdrawEvent` in packages/sdk/src/privacy.ts:413-454
 * (no discriminator check — matches sipher's scan behavior; relies on the
 * 194-byte length floor and the downstream ATA-owner equality check to
 * filter spurious decodes).
 */
function parseWithdrawEventFromLogs(logs: string[]): WithdrawEvent | null {
  for (const log of logs) {
    if (!log.startsWith(PROGRAM_DATA_PREFIX)) continue
    const b64 = log.slice(PROGRAM_DATA_PREFIX.length).trim()
    if (!b64) continue
    let data: Buffer
    try {
      data = Buffer.from(b64, 'base64')
    } catch {
      continue
    }
    if (data.length < WITHDRAW_EVENT_MIN_BYTES) continue
    try {
      // Layout (after 8-byte discriminator): depositor[32] | stealth[32]
      //   | commitment[33] | ephemeral[33] | vk_hash[32] | amount[8] | fee[8] | ts[8]
      const stealthBytes = data.subarray(40, 72)
      const stealthAddress = new PublicKey(stealthBytes).toBase58()
      // Ephemeral is 33 bytes (0x00 prefix + 32-byte ed25519); strip prefix.
      const ephRaw = data[105] === 0x00 ? data.subarray(106, 138) : data.subarray(105, 137)
      if (ephRaw.length !== 32) continue
      // Skip pre-integration placeholder events with zero-filled ephemeral.
      if (ephRaw.every((b) => b === 0)) continue
      const ephemeralPublicKey = new PublicKey(ephRaw).toBase58()
      return { stealthAddress, ephemeralPublicKey }
    } catch {
      continue // not a VaultWithdrawEvent layout; try next log
    }
  }
  return null
}

/**
 * Derive the base58 ed25519 pubkey corresponding to a hex-encoded spending
 * private key. The spending key in sipher's stealth model corresponds 1:1
 * with the user's main Solana wallet — this pubkey is the natural default
 * destination for claimed funds.
 *
 * @param spendingPrivateKey - 32-byte hex string, with or without 0x prefix
 * @returns base58-encoded ed25519 pubkey (Solana address)
 * @throws if input is not exactly 64 hex characters (32 bytes)
 */
export function deriveDestinationFromSpending(spendingPrivateKey: string): string {
  const stripped = spendingPrivateKey.startsWith('0x')
    ? spendingPrivateKey.slice(2)
    : spendingPrivateKey
  if (!/^[0-9a-fA-F]+$/.test(stripped) || stripped.length !== 64) {
    throw new Error(
      'Spending key must be 32-byte hex (64 chars, with or without 0x prefix)',
    )
  }
  const privKeyBytes = Buffer.from(stripped, 'hex')
  const pubKeyBytes = ed25519.getPublicKey(privKeyBytes)
  return new PublicKey(pubKeyBytes).toBase58()
}
