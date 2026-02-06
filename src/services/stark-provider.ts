import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { commit } from '@sip-protocol/sdk'
import { LRUCache } from 'lru-cache'

// ─── M31 Field Constants ────────────────────────────────────────────────────

export const M31_PRIME = 2147483647n // 2^31 - 1 (Mersenne prime)
export const NUM_LIMBS = 9 // ceil(256 / 31)

// ─── M31 Limb Decomposition ────────────────────────────────────────────────

export function decomposeToM31Limbs(value: bigint): bigint[] {
  if (value < 0n) throw new Error('Value must be non-negative')
  const limbs: bigint[] = []
  let remaining = value
  for (let i = 0; i < NUM_LIMBS; i++) {
    limbs.push(remaining % M31_PRIME)
    remaining = remaining / M31_PRIME
  }
  return limbs
}

export function reconstructFromM31Limbs(limbs: bigint[]): bigint {
  let result = 0n
  let multiplier = 1n
  for (const limb of limbs) {
    result += limb * multiplier
    multiplier *= M31_PRIME
  }
  return result
}

// ─── Commitment Hash Binding ────────────────────────────────────────────────

const DOMAIN_TAG = new TextEncoder().encode('SIPHER-MURKL-BIND')

export function commitmentToStarkInput(commitmentHex: string): string {
  const commitmentBytes = hexToBytes(commitmentHex.replace(/^0x/, ''))
  const input = new Uint8Array(DOMAIN_TAG.length + commitmentBytes.length)
  input.set(DOMAIN_TAG)
  input.set(commitmentBytes, DOMAIN_TAG.length)
  return '0x' + bytesToHex(keccak_256(input))
}

// ─── Verification Cache ─────────────────────────────────────────────────────

const verificationCache = new LRUCache<string, string>({
  max: 1000,
  ttl: 60 * 60 * 1000, // 1 hour
})

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RangeProofParams {
  value: bigint
  threshold: bigint
  blindingFactor: string // 0x-prefixed hex
  commitment?: string // 0x-prefixed hex, optional
}

export interface RangeProofResult {
  proof: {
    type: 'range'
    proof: string
    publicInputs: string[]
  }
  commitment: string
  metadata: {
    prover: string
    decomposition: string
    limbCount: number
    security: string
  }
}

// ─── Generate Range Proof ───────────────────────────────────────────────────

export async function generateRangeProof(params: RangeProofParams): Promise<RangeProofResult> {
  const { value, threshold, blindingFactor, commitment: existingCommitment } = params

  // Validate range: value >= threshold
  if (value < threshold) {
    const err = new Error(`Range proof failed: value (${value}) < threshold (${threshold})`)
    err.name = 'ProofGenerationError'
    ;(err as any).proofType = 'range'
    throw err
  }

  // Create or use existing commitment
  let commitmentHex: string
  if (existingCommitment) {
    commitmentHex = existingCommitment
  } else {
    const blindBytes = hexToBytes(blindingFactor.replace(/^0x/, ''))
    const result = commit(value, blindBytes)
    commitmentHex = result.commitment as string
  }

  // M31 limb decomposition
  const limbs = decomposeToM31Limbs(value)

  // Commitment hash binding
  const commitmentHash = commitmentToStarkInput(commitmentHex)

  // Build deterministic mock proof
  const limbBytes = new Uint8Array(NUM_LIMBS * 4)
  for (let i = 0; i < NUM_LIMBS; i++) {
    const val = Number(limbs[i])
    limbBytes[i * 4] = (val >>> 24) & 0xff
    limbBytes[i * 4 + 1] = (val >>> 16) & 0xff
    limbBytes[i * 4 + 2] = (val >>> 8) & 0xff
    limbBytes[i * 4 + 3] = val & 0xff
  }
  const limbsHash = keccak_256(limbBytes)

  const thresholdHex = threshold.toString(16).padStart(64, '0')
  const thresholdBytes = hexToBytes(thresholdHex)

  const proofTag = new TextEncoder().encode('MOCK-STARK-RANGE')
  const commitmentHashBytes = hexToBytes(commitmentHash.replace(/^0x/, ''))
  const proofInput = new Uint8Array(proofTag.length + commitmentHashBytes.length + thresholdBytes.length + limbsHash.length)
  proofInput.set(proofTag)
  proofInput.set(commitmentHashBytes, proofTag.length)
  proofInput.set(thresholdBytes, proofTag.length + commitmentHashBytes.length)
  proofInput.set(limbsHash, proofTag.length + commitmentHashBytes.length + thresholdBytes.length)
  const proofHex = '0x' + bytesToHex(keccak_256(proofInput))

  const publicInputs = [commitmentHash, '0x' + thresholdHex]

  // Cache for verification
  const publicInputsKey = keccak_256(
    hexToBytes(commitmentHash.replace(/^0x/, '') + thresholdHex)
  )
  verificationCache.set(proofHex, bytesToHex(publicInputsKey))

  return {
    proof: {
      type: 'range',
      proof: proofHex,
      publicInputs,
    },
    commitment: commitmentHex,
    metadata: {
      prover: 'mock-stark',
      decomposition: 'm31-limbs',
      limbCount: NUM_LIMBS,
      security: 'post-quantum (hash-based)',
    },
  }
}

// ─── Verify Range Proof ─────────────────────────────────────────────────────

export async function verifyRangeProof(params: {
  proof: string
  publicInputs: string[]
}): Promise<boolean> {
  const { proof, publicInputs } = params

  const cached = verificationCache.get(proof)
  if (!cached) return false

  // Rebuild expected publicInputs hash
  const combined = publicInputs.map(h => h.replace(/^0x/, '')).join('')
  const expected = bytesToHex(keccak_256(hexToBytes(combined)))

  return cached === expected
}

// ─── Reset (for tests) ─────────────────────────────────────────────────────

export function resetStarkProvider(): void {
  verificationCache.clear()
}
