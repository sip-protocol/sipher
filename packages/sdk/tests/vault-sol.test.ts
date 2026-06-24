import { describe, it, expect } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import {
  NATIVE_SOL_MINT,
  VAULT_SOL_SEED,
  FEE_SOL_SEED,
  deriveSolVaultPDA,
  deriveSolFeePDA,
} from '../src/index.js'

describe('native-SOL constants', () => {
  it('NATIVE_SOL_MINT is the all-zeros sentinel (not wSOL)', () => {
    expect(NATIVE_SOL_MINT.toBase58()).toBe('11111111111111111111111111111111')
    expect(NATIVE_SOL_MINT.toBytes().every((b) => b === 0)).toBe(true)
  })

  it('SOL vault seeds match the on-chain constants', () => {
    expect(VAULT_SOL_SEED.toString()).toBe('vault_sol')
    expect(FEE_SOL_SEED.toString()).toBe('fee_sol')
  })
})

describe('native-SOL PDA derivation', () => {
  it('deriveSolVaultPDA matches the live devnet SolVault', () => {
    const [pda] = deriveSolVaultPDA()
    expect(pda.toBase58()).toBe('8ZG46epBDrRbZ2oDneuemmSuQNNG3R58LhFo8Do2p6sq')
  })

  it('deriveSolFeePDA matches the live devnet SolFee', () => {
    const [pda] = deriveSolFeePDA()
    expect(pda.toBase58()).toBe('519L2NQN16H1fnN9iPu2r2ipmjPj156yWMPQumw8PkZ4')
  })

  it('derivations honor a programId override', () => {
    const custom = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
    const [vault] = deriveSolVaultPDA(custom)
    const [expected] = PublicKey.findProgramAddressSync([VAULT_SOL_SEED], custom)
    expect(vault.equals(expected)).toBe(true)
  })
})
