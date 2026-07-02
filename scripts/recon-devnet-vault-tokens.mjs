// Diagnostic: surveys the live sipher_vault devnet deployment and checks
// whether vault_token / fee_token are initialized for native SOL (wSOL).
// Used by Phase 3 refund E2E for verification + Phase 4 mainnet prep.

import { Connection, PublicKey } from '@solana/web3.js'

const VAULT_PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
const VAULT_CONFIG_PDA = new PublicKey('CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u')
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const conn = new Connection('https://api.devnet.solana.com', 'confirmed')

console.log('=== VAULT_CONFIG ===')
const cfgInfo = await conn.getAccountInfo(VAULT_CONFIG_PDA)
if (cfgInfo) {
  const d = cfgInfo.data
  let off = 8
  const authority = new PublicKey(d.slice(off, off + 32)); off += 32
  const feeTenthsBps = d.readUInt16LE(off); off += 2
  const refundTimeout = Number(d.readBigInt64LE(off)); off += 8
  const paused = d.readUInt8(off) === 1; off += 1
  const totalDeposits = d.readBigUInt64LE(off); off += 8
  const totalDepositors = d.readBigUInt64LE(off); off += 8
  const bump = d.readUInt8(off)
  console.log({ authority: authority.toBase58(), feeTenthsBps, feeBps: feeTenthsBps / 10, refundTimeout, paused, totalDeposits, totalDepositors, bump })
}

// Derive expected vault_token + fee_token PDAs for wSOL
// Common patterns — try standard seeds
const seedPatterns = [
  ['vault_token', WSOL_MINT.toBuffer()],
  ['vault-token', WSOL_MINT.toBuffer()],
  ['vault', WSOL_MINT.toBuffer()],
  ['fee_token', WSOL_MINT.toBuffer()],
  ['fee-token', WSOL_MINT.toBuffer()],
  ['fee', WSOL_MINT.toBuffer()],
]

console.log('\n=== Derived PDAs for wSOL (probing seed patterns) ===')
for (const [seed, ...rest] of seedPatterns) {
  try {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from(seed), ...rest],
      VAULT_PROGRAM_ID,
    )
    const info = await conn.getAccountInfo(pda)
    console.log(`  seed='${seed}' → ${pda.toBase58()}  ${info ? `EXISTS (size=${info.data.length}, owner=${info.owner.toBase58().slice(0, 12)}...)` : 'NOT FOUND'}`)
  } catch (e) {
    console.log(`  seed='${seed}' → error: ${e.message}`)
  }
}

console.log('\n=== ALL accounts owned by vault program ===')
const all = await conn.getProgramAccounts(VAULT_PROGRAM_ID)
for (const { pubkey, account } of all) {
  console.log(`  ${pubkey.toBase58()}  size=${account.data.length}  disc=${account.data.slice(0, 8).toString('hex')}  owner=${account.owner.toBase58().slice(0, 12)}...`)
}
