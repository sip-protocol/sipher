// Diagnostic: list all DepositRecord PDAs on the live sipher_vault program.
// Used by Phase 3 refund E2E for verification + Phase 4 mainnet prep.

import { Connection, PublicKey } from '@solana/web3.js'

const VAULT_PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
const conn = new Connection('https://api.devnet.solana.com', 'confirmed')

// DepositRecord layout (sipher_vault Anchor program, #[derive(InitSpace)]):
//   8 (discriminator) + 32 (depositor) + 32 (token_mint)
// + 8 (balance, u64) + 8 (locked_amount, u64) + 8 (cumulative_volume, u64)
// + 8 (last_deposit_at, i64) + 1 (bump) = 105 bytes
const DEPOSIT_RECORD_SIZE = 105

const accounts = await conn.getProgramAccounts(VAULT_PROGRAM_ID, {
  filters: [{ dataSize: DEPOSIT_RECORD_SIZE }],
})

console.log(`Found ${accounts.length} DepositRecord accounts\n`)

const now = Math.floor(Date.now() / 1000)
const TIMEOUT_24H = 86400

for (const { pubkey, account } of accounts) {
  const data = account.data
  let offset = 8
  const depositor = new PublicKey(data.slice(offset, offset + 32)); offset += 32
  const tokenMint = new PublicKey(data.slice(offset, offset + 32)); offset += 32
  const balance = data.readBigUInt64LE(offset); offset += 8
  const lockedAmount = data.readBigUInt64LE(offset); offset += 8
  const cumulativeVolume = data.readBigUInt64LE(offset); offset += 8
  const lastDepositAt = Number(data.readBigInt64LE(offset)); offset += 8
  const bump = data.readUInt8(offset)

  const ageSeconds = now - lastDepositAt
  const refundable = ageSeconds >= TIMEOUT_24H
  const SOL = (Number(balance) / 1e9).toFixed(4)
  const ageStr = ageSeconds < 0 ? 'future?' : `${(ageSeconds/3600).toFixed(1)}h`
  const lastDate = new Date(lastDepositAt * 1000).toISOString().slice(0, 19)

  console.log(`PDA: ${pubkey.toBase58()}`)
  console.log(`  depositor:        ${depositor.toBase58()}`)
  console.log(`  tokenMint:        ${tokenMint.toBase58()}`)
  console.log(`  balance:          ${SOL} SOL (${balance} lamports)`)
  console.log(`  lockedAmount:     ${lockedAmount} lamports`)
  console.log(`  cumulativeVolume: ${cumulativeVolume} lamports`)
  console.log(`  last_deposit_at:  ${lastDate} UTC (age: ${ageStr})`)
  console.log(`  bump:             ${bump}`)
  console.log(`  refundable:       ${refundable ? 'YES' : 'NO (need ' + ((TIMEOUT_24H - ageSeconds)/3600).toFixed(1) + 'h more)'}`)
  console.log('')
}
