import type { Connection } from '@solana/web3.js'
import { bytesToHex } from '@noble/hashes/utils'
import { resolveSIPStealth, MetaAddress } from '@sip-protocol/sns-stealth'
import { generateEd25519StealthAddress, ed25519PublicKeyToSolanaAddress } from '@sip-protocol/sdk'

export type RebateDestination =
  | { kind: 'stealth'; address: string }
  | { kind: 'unavailable'; address: null; reason: 'no_domain' | 'no_sns_record' | 'sns_error' }

interface CacheEntry {
  expiresAt: number
  destination: RebateDestination
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, CacheEntry>()

function cacheKey(wallet: string, domain?: string): string {
  return `${wallet}|${domain ?? ''}`
}

export interface DeriveRebateDestinationParams {
  wallet: string
  domain?: string
  connection: Connection
}

export async function deriveRebateDestination(
  params: DeriveRebateDestinationParams,
): Promise<RebateDestination> {
  const key = cacheKey(params.wallet, params.domain)
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.destination
  }

  let result: RebateDestination

  if (!params.domain) {
    result = { kind: 'unavailable', address: null, reason: 'no_domain' }
  } else {
    try {
      const meta = await resolveSIPStealth(params.connection, params.domain)
      if (meta instanceof MetaAddress) {
        // MetaAddress carries Uint8Array keys; SDK expects 0x-prefixed hex HexStrings.
        const stealthMeta = {
          spendingKey: `0x${bytesToHex(meta.spending)}` as const,
          viewingKey: `0x${bytesToHex(meta.viewing)}` as const,
          chain: 'solana' as const,
        }
        const { stealthAddress } = generateEd25519StealthAddress(stealthMeta)
        const address = ed25519PublicKeyToSolanaAddress(stealthAddress.address)
        result = { kind: 'stealth', address }
      } else {
        // NotFound (subject: 'domain' | 'record') or Malformed — no usable record
        console.warn(
          `[torque] rebate skipped for wallet ${params.wallet} (${params.domain}): no SNS SIP-STEALTH record (or malformed record schema). Publish or republish via sip-app/wallet/sip-stealth to claim rebates.`,
        )
        result = { kind: 'unavailable', address: null, reason: 'no_sns_record' }
      }
    } catch (err) {
      console.warn(
        `[torque] rebate skipped for wallet ${params.wallet} (${params.domain}): SNS error: ${err instanceof Error ? err.message : String(err)}`,
      )
      result = { kind: 'unavailable', address: null, reason: 'sns_error' }
    }
  }

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, destination: result })
  return result
}

/** Test-only: clear the in-memory cache between test cases. */
export function _resetRebateDestinationCacheForTests(): void {
  cache.clear()
}
