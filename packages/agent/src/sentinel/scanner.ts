import { PublicKey } from '@solana/web3.js'
import {
  createConnection,
  getVaultBalance,
  scanForPayments,
  WSOL_MINT,
} from '@sipher/sdk'
import type { ScanParams } from '@sipher/sdk'
import { type Detection, detectUnclaimedPayment, detectBalanceChange } from './detector.js'
import { getSentinelConfig } from './config.js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScanOptions {
  /** Previous vault balance in SOL — triggers balance change detection when it differs */
  previousBalance?: number
  /** Maximum RPC calls this scan cycle is allowed to make */
  maxRpcCalls?: number
  /**
   * Viewing private key (32 bytes) for stealth payment scanning.
   * When omitted, payment scanning is skipped (balance-only mode).
   */
  viewingPrivateKey?: Uint8Array
  /**
   * Spending private key (32 bytes) for stealth payment scanning.
   * When omitted, payment scanning is skipped (balance-only mode).
   */
  spendingPrivateKey?: Uint8Array
}

export interface ScanResult {
  wallet: string
  /** Current vault balance in SOL */
  vaultBalance: number
  detections: Detection[]
  /** Number of RPC calls consumed during this scan */
  rpcCalls: number
  /** ISO-8601 timestamp of when this scan completed */
  timestamp: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const LAMPORTS_PER_SOL = 1_000_000_000

function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─────────────────────────────────────────────────────────────────────────────
// Core scan function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Perform a full scan cycle for a single wallet.
 *
 * 1. Establish Solana connection (no RPC cost — local only)
 * 2. Fetch vault balance via getVaultBalance — convert lamports → SOL
 * 3. If previousBalance is provided and differs → emit detectBalanceChange
 * 4. Scan for unclaimed stealth payments via scanForPayments — each found → emit detectUnclaimedPayment
 * 5. Track RPC budget — stop after maxRpcCalls is reached
 *
 * All RPC calls are individually wrapped in try/catch — errors increment
 * the RPC counter but never crash the scan. Caller always gets a valid ScanResult.
 */
export async function scanWallet(
  wallet: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const config = getSentinelConfig()
  const maxRpc = options.maxRpcCalls ?? config.maxRpcPerWallet
  const detections: Detection[] = []
  let rpcCalls = 0

  // Build connection — local only, no RPC call consumed
  const connection = createConnection('devnet')

  // ── Step 1: Vault balance ──────────────────────────────────────────────────
  let vaultBalance = 0

  if (rpcCalls < maxRpc) {
    try {
      const depositor = new PublicKey(wallet)
      const balanceInfo = await getVaultBalance(connection, depositor, WSOL_MINT)
      vaultBalance = lamportsToSol(balanceInfo.balance)

      if (
        options.previousBalance !== undefined &&
        Math.abs(options.previousBalance - vaultBalance) > Number.EPSILON
      ) {
        detections.push(
          detectBalanceChange({
            previousBalance: options.previousBalance,
            currentBalance: vaultBalance,
            wallet,
          })
        )
      }
    } catch {
      // vaultBalance stays 0; scan continues
    } finally {
      rpcCalls++
    }
  }

  // ── Step 2: Stealth payment scan ───────────────────────────────────────────
  // Requires viewing + spending keys. Skip gracefully when not provided.
  const hasKeys = options.viewingPrivateKey && options.spendingPrivateKey

  if (rpcCalls < maxRpc && hasKeys) {
    try {
      const scanParams: ScanParams = {
        connection,
        viewingPrivateKey: options.viewingPrivateKey as Uint8Array,
        spendingPrivateKey: options.spendingPrivateKey as Uint8Array,
        limit: 50,
      }
      const scanResult = await scanForPayments(scanParams)

      for (const payment of scanResult.payments) {
        detections.push(
          detectUnclaimedPayment({
            ephemeralPubkey: bytesToHex(payment.ephemeralPubkey),
            amount: lamportsToSol(payment.transferAmount),
            wallet,
          })
        )
      }
    } catch {
      // Stealth payments missed this cycle — not fatal
    } finally {
      rpcCalls++
    }
  }

  return {
    wallet,
    vaultBalance,
    detections,
    rpcCalls,
    timestamp: new Date().toISOString(),
  }
}
