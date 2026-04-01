/**
 * Devnet integration check — verifies SDK can connect to devnet and
 * read on-chain state from the sipher_vault program.
 *
 * Usage: npx tsx packages/sdk/scripts/devnet-check.ts
 */

import { PublicKey } from '@solana/web3.js'
import {
  createConnection,
  getVaultConfig,
  getVaultBalance,
  deriveVaultConfigPDA,
  SIPHER_VAULT_PROGRAM_ID,
  WSOL_MINT,
} from '../src/index.js'

async function main() {
  console.log('=== Sipher Vault Devnet Check ===\n')

  const connection = createConnection('devnet')

  // 1. Verify the program exists on devnet
  const programInfo = await connection.getAccountInfo(SIPHER_VAULT_PROGRAM_ID)
  console.log(
    `Program ${SIPHER_VAULT_PROGRAM_ID.toBase58()}: ${programInfo ? 'EXISTS' : 'NOT FOUND'}`
  )
  if (programInfo) {
    console.log(`  Owner: ${programInfo.owner.toBase58()}`)
    console.log(`  Executable: ${programInfo.executable}`)
    console.log(`  Data length: ${programInfo.data.length} bytes`)
  }

  // 2. Read VaultConfig PDA
  const [configPDA] = deriveVaultConfigPDA()
  console.log(`\nVaultConfig PDA: ${configPDA.toBase58()}`)

  const config = await getVaultConfig(connection)
  if (config) {
    console.log('  Status: INITIALIZED')
    console.log(`  Authority: ${config.authority.toBase58()}`)
    console.log(`  Fee BPS: ${config.feeBps}`)
    console.log(`  Refund timeout: ${config.refundTimeout}s`)
    console.log(`  Paused: ${config.paused}`)
    console.log(`  Total deposits: ${config.totalDeposits}`)
    console.log(`  Total depositors: ${config.totalDepositors}`)
    console.log(`  Bump: ${config.bump}`)
  } else {
    console.log('  Status: NOT INITIALIZED (account does not exist)')
  }

  // 3. Check a test wallet's vault balance (devnet wallet)
  const testWallet = new PublicKey('FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr')
  console.log(`\nVault balance for ${testWallet.toBase58()} (wSOL):`)

  const balance = await getVaultBalance(connection, testWallet, WSOL_MINT)
  if (balance.exists) {
    console.log(`  Balance: ${balance.balance} lamports`)
    console.log(`  Available: ${balance.available} lamports`)
    console.log(`  Locked: ${balance.lockedAmount} lamports`)
    console.log(`  Cumulative volume: ${balance.cumulativeVolume} lamports`)
    console.log(`  Last deposit: ${new Date(balance.lastDepositAt * 1000).toISOString()}`)
  } else {
    console.log('  No deposit record found (expected for fresh wallet)')
  }

  console.log('\n=== Check complete ===')
}

main().catch((err) => {
  console.error('Devnet check failed:', err)
  process.exit(1)
})
