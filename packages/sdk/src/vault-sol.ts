import { PublicKey } from '@solana/web3.js'
import {
  SIPHER_VAULT_PROGRAM_ID,
  VAULT_SOL_SEED,
  FEE_SOL_SEED,
} from './config.js'

// ─────────────────────────────────────────────────────────────────────────────
// Native-SOL PDA derivation
//
// The native-SOL DepositRecord uses the EXISTING deriveDepositRecordPDA helper
// with NATIVE_SOL_MINT as the mint seed — no dedicated helper is needed here.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derive the singleton SolVault PDA (holds native lamports).
 * Seeds: [b"vault_sol"]
 */
export function deriveSolVaultPDA(
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_SOL_SEED], programId)
}

/**
 * Derive the singleton SolFee PDA (native-SOL fee sink).
 * Seeds: [b"fee_sol"]
 */
export function deriveSolFeePDA(
  programId: PublicKey = SIPHER_VAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([FEE_SOL_SEED], programId)
}
