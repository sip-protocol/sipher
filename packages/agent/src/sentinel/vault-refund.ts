import { Connection, PublicKey, Keypair } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import { readFileSync } from 'node:fs'
import {
  buildAuthorityRefundTx,
  fetchDepositRecord,
  createConnection,
} from '@sipher/sdk'

/**
 * Load a Solana keypair from a JSON file (standard CLI format: [u8; 64]).
 */
function loadKeypairFromFile(filepath: string): Keypair {
  const raw = JSON.parse(readFileSync(filepath, 'utf-8')) as number[]
  return Keypair.fromSecretKey(Uint8Array.from(raw))
}

/**
 * Authority-signed refund via sipher_vault.authority_refund instruction.
 *
 * Loads the authority keypair from SENTINEL_AUTHORITY_KEYPAIR env,
 * fetches the deposit record on-chain to derive depositor + mint,
 * builds the TX via @sipher/sdk, signs with authority, and sends.
 *
 * Timeout is enforced on-chain — this will fail if the deposit's
 * refund_timeout (24h default) hasn't elapsed since last_deposit_at.
 */
export async function performVaultRefund(
  pda: string,
  amount: number,
): Promise<{ success: boolean; txId?: string; error?: string }> {
  const keypairPath = process.env.SENTINEL_AUTHORITY_KEYPAIR
  if (!keypairPath) {
    throw new Error('SENTINEL_AUTHORITY_KEYPAIR env not set — cannot sign authority refund')
  }
  const authority = loadKeypairFromFile(keypairPath)
  const network = (process.env.SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)

  // Fetch deposit record to get depositor + tokenMint
  const depositRecord = await fetchDepositRecord(connection, new PublicKey(pda))
  const depositorTokenAccount = await getAssociatedTokenAddress(
    depositRecord.tokenMint, depositRecord.depositor,
  )

  const { transaction, refundAmount } = await buildAuthorityRefundTx(
    connection,
    authority.publicKey,
    depositRecord.depositor,
    depositRecord.tokenMint,
    depositorTokenAccount,
  )

  // Safety check: verify on-chain balance matches what SENTINEL intended.
  // Convert SOL amount to lamports (1e9) for comparison with refundAmount (bigint, lamports).
  // Allow 1% tolerance for SOL precision drift.
  const expectedLamports = BigInt(Math.floor(amount * 1_000_000_000))
  const actualLamports = refundAmount
  const tolerance = expectedLamports / 100n // 1%
  const diff = actualLamports > expectedLamports
    ? actualLamports - expectedLamports
    : expectedLamports - actualLamports
  if (diff > tolerance) {
    throw new Error(
      `Refund amount mismatch: SENTINEL expected ${amount} SOL (${expectedLamports} lamports), ` +
      `on-chain available is ${actualLamports} lamports. Aborting to prevent stale-decision execution.`
    )
  }

  transaction.sign(authority)

  const txId = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  })
  await connection.confirmTransaction(txId, 'confirmed')

  return { success: true, txId }
}

/**
 * Startup check: warn if authority keypair is missing in production.
 */
export function assertVaultRefundWired(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SENTINEL_MODE !== 'off' &&
    !process.env.SENTINEL_AUTHORITY_KEYPAIR
  ) {
    console.warn(
      '[SENTINEL] SENTINEL_AUTHORITY_KEYPAIR env not set. Authority refunds will throw at runtime. ' +
      'Set it to the path of the vault authority keypair JSON, or run with SENTINEL_MODE=off.',
    )
  }
}
