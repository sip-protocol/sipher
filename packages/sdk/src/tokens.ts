import { PublicKey } from '@solana/web3.js'

// ─────────────────────────────────────────────────────────────────────────────
// Well-known SPL token mints (mainnet addresses, same on devnet for wSOL)
// ─────────────────────────────────────────────────────────────────────────────

/** Wrapped SOL mint — used as the "token mint" for native SOL in the vault */
export const WSOL_MINT = new PublicKey(
  'So11111111111111111111111111111111111111112'
)

/** USDC mint (mainnet) */
export const USDC_MINT = new PublicKey(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
)

/** USDT mint (mainnet) */
export const USDT_MINT = new PublicKey(
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
)

/**
 * Symbol-to-mint mapping for common tokens.
 * The vault operates on SPL tokens, so "SOL" maps to wrapped SOL.
 */
const KNOWN_MINTS: Record<string, PublicKey> = {
  SOL: WSOL_MINT,
  WSOL: WSOL_MINT,
  USDC: USDC_MINT,
  USDT: USDT_MINT,
}

/**
 * Resolve a token symbol or mint address string to a PublicKey.
 *
 * Accepts:
 * - Token symbols: "SOL", "USDC", "USDT" (case-insensitive)
 * - Raw base58 mint addresses: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
 *
 * Throws if the symbol is unknown and the string is not a valid base58 pubkey.
 */
export function resolveTokenMint(tokenOrMint: string): PublicKey {
  const upper = tokenOrMint.trim().toUpperCase()

  // Check known symbols first
  const known = KNOWN_MINTS[upper]
  if (known) return known

  // Try parsing as a raw base58 pubkey
  try {
    return new PublicKey(tokenOrMint.trim())
  } catch {
    throw new Error(
      `Unknown token "${tokenOrMint}". Use SOL, USDC, USDT, or a valid SPL mint address.`
    )
  }
}

/**
 * Get human-readable decimals for a known token.
 * Returns 9 for SOL, 6 for USDC/USDT, and 9 as default for unknown mints.
 */
export function getTokenDecimals(mint: PublicKey): number {
  if (mint.equals(WSOL_MINT)) return 9
  if (mint.equals(USDC_MINT)) return 6
  if (mint.equals(USDT_MINT)) return 6
  return 9 // safe default for unknown SPL tokens
}

/**
 * Convert a human-readable amount (e.g. 1.5 SOL) to base units (lamports).
 */
export function toBaseUnits(amount: number, decimals: number): bigint {
  // Use string math to avoid floating-point precision issues
  const [whole, frac = ''] = amount.toString().split('.')
  const padded = frac.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole + padded)
}

/**
 * Convert base units (lamports) to human-readable string.
 */
export function fromBaseUnits(amount: bigint, decimals: number): string {
  const str = amount.toString().padStart(decimals + 1, '0')
  const whole = str.slice(0, str.length - decimals)
  const frac = str.slice(str.length - decimals)
  // Trim trailing zeros from fractional part
  const trimmed = frac.replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}
