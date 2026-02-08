import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex } from '@noble/hashes/utils'
import { LRUCache } from 'lru-cache'
import { CACHE_MAX_DEFAULT, ONE_HOUR_MS } from '../constants.js'

// ─── Constants ──────────────────────────────────────────────────────────────

const DOMAIN_TAG = new TextEncoder().encode('SIPHER-ARCIUM-MPC')
let computeCounter = 0

export const SUPPORTED_CIRCUITS: Record<string, { inputs: number; description: string }> = {
  private_transfer: { inputs: 2, description: 'Private token transfer with hidden sender/receiver' },
  check_balance: { inputs: 1, description: 'Verify encrypted balance meets threshold' },
  validate_swap: { inputs: 3, description: 'Validate atomic swap parameters privately' },
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type ComputationStatus = 'submitted' | 'encrypting' | 'processing' | 'finalizing' | 'completed'

export interface ComputationEntry {
  id: string
  circuitId: string
  chain: string
  submittedAt: number
  precomputedOutput: string // hex
  precomputedProof: string  // hex
  inputCount: number
  cluster?: string
  cipher: string
  viewingKeyHash?: string
}

export interface SubmitParams {
  circuitId: string
  encryptedInputs: string[] // hex strings
  chain?: string
  cipher?: string
  cluster?: string
  viewingKeyHash?: string
  timeout?: number
}

export interface ComputationStatusResult {
  computationId: string
  circuitId: string
  chain: string
  status: ComputationStatus
  progress: number
  submittedAt: number
  estimatedCompletion: number
  output?: string
  proof?: string
  cluster?: string
  cipher: string
}

export interface DecryptResult {
  computationId: string
  circuitId: string
  decryptedOutput: string
  verificationHash: string
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const computationCache = new LRUCache<string, ComputationEntry>({
  max: CACHE_MAX_DEFAULT,
  ttl: ONE_HOUR_MS,
})

// ─── State Machine Thresholds (ms) ─────────────────────────────────────────

const STATUS_THRESHOLDS = {
  submitted: 0,
  encrypting: 500,
  processing: 1500,
  finalizing: 3000,
  completed: 4000,
}

function getStatus(elapsed: number): { status: ComputationStatus; progress: number } {
  if (elapsed >= STATUS_THRESHOLDS.completed) return { status: 'completed', progress: 100 }
  if (elapsed >= STATUS_THRESHOLDS.finalizing) return { status: 'finalizing', progress: 75 }
  if (elapsed >= STATUS_THRESHOLDS.processing) return { status: 'processing', progress: 50 }
  if (elapsed >= STATUS_THRESHOLDS.encrypting) return { status: 'encrypting', progress: 25 }
  return { status: 'submitted', progress: 0 }
}

// ─── Submit Computation ─────────────────────────────────────────────────────

export function submitComputation(params: SubmitParams): {
  computationId: string
  status: ComputationStatus
  estimatedCompletion: number
  circuitId: string
  chain: string
  inputCount: number
} {
  const { circuitId, encryptedInputs, chain = 'solana', cipher = 'aes256', cluster, viewingKeyHash } = params

  // Validate circuit
  const circuit = SUPPORTED_CIRCUITS[circuitId]
  if (!circuit) {
    const err = new Error(`Unsupported circuit: ${circuitId}. Supported: ${Object.keys(SUPPORTED_CIRCUITS).join(', ')}`)
    err.name = 'ArciumComputationError'
    throw err
  }

  // Validate input count
  if (encryptedInputs.length !== circuit.inputs) {
    const err = new Error(`Circuit '${circuitId}' requires exactly ${circuit.inputs} inputs, got ${encryptedInputs.length}`)
    err.name = 'ArciumComputationError'
    throw err
  }

  // Generate deterministic computation ID
  const now = Date.now()
  const nonce = `${now}-${++computeCounter}`
  const idInput = new Uint8Array(DOMAIN_TAG.length + new TextEncoder().encode(circuitId + encryptedInputs.join('') + nonce).length)
  idInput.set(DOMAIN_TAG)
  idInput.set(new TextEncoder().encode(circuitId + encryptedInputs.join('') + nonce), DOMAIN_TAG.length)
  const computationId = 'arc_' + bytesToHex(keccak_256(idInput))

  // Pre-compute deterministic output
  const outputInput = new Uint8Array(DOMAIN_TAG.length + new TextEncoder().encode('OUTPUT' + computationId).length)
  outputInput.set(DOMAIN_TAG)
  outputInput.set(new TextEncoder().encode('OUTPUT' + computationId), DOMAIN_TAG.length)
  const precomputedOutput = '0x' + bytesToHex(keccak_256(outputInput))

  // Pre-compute deterministic proof
  const proofInput = new Uint8Array(DOMAIN_TAG.length + new TextEncoder().encode('PROOF' + computationId).length)
  proofInput.set(DOMAIN_TAG)
  proofInput.set(new TextEncoder().encode('PROOF' + computationId), DOMAIN_TAG.length)
  const precomputedProof = '0x' + bytesToHex(keccak_256(proofInput))

  // Store in cache
  const entry: ComputationEntry = {
    id: computationId,
    circuitId,
    chain,
    submittedAt: now,
    precomputedOutput,
    precomputedProof,
    inputCount: encryptedInputs.length,
    cluster,
    cipher,
    viewingKeyHash,
  }
  computationCache.set(computationId, entry)

  return {
    computationId,
    status: 'submitted',
    estimatedCompletion: now + STATUS_THRESHOLDS.completed,
    circuitId,
    chain,
    inputCount: encryptedInputs.length,
  }
}

// ─── Get Computation Status ─────────────────────────────────────────────────

export function getComputationStatus(id: string): ComputationStatusResult | null {
  const entry = computationCache.get(id)
  if (!entry) return null

  const elapsed = Date.now() - entry.submittedAt
  const { status, progress } = getStatus(elapsed)

  const result: ComputationStatusResult = {
    computationId: entry.id,
    circuitId: entry.circuitId,
    chain: entry.chain,
    status,
    progress,
    submittedAt: entry.submittedAt,
    estimatedCompletion: entry.submittedAt + STATUS_THRESHOLDS.completed,
    cluster: entry.cluster,
    cipher: entry.cipher,
  }

  // Only reveal output/proof when completed
  if (status === 'completed') {
    result.output = entry.precomputedOutput
    result.proof = entry.precomputedProof
  }

  return result
}

// ─── Decrypt Result ─────────────────────────────────────────────────────────

export function decryptResult(id: string, viewingKeyHash: string): DecryptResult {
  const entry = computationCache.get(id)
  if (!entry) {
    const err = new Error(`Computation not found: ${id}`)
    err.name = 'ArciumNotFoundError'
    throw err
  }

  const elapsed = Date.now() - entry.submittedAt
  const { status } = getStatus(elapsed)
  if (status !== 'completed') {
    const err = new Error(`Computation not yet completed. Current status: ${status}`)
    err.name = 'ArciumDecryptError'
    throw err
  }

  // Generate deterministic decrypted output
  const decryptInput = new Uint8Array(
    DOMAIN_TAG.length + new TextEncoder().encode('DECRYPT' + id + viewingKeyHash).length
  )
  decryptInput.set(DOMAIN_TAG)
  decryptInput.set(new TextEncoder().encode('DECRYPT' + id + viewingKeyHash), DOMAIN_TAG.length)
  const decryptedOutput = '0x' + bytesToHex(keccak_256(decryptInput))

  // Verification hash
  const verifyInput = new Uint8Array(
    DOMAIN_TAG.length + new TextEncoder().encode('VERIFY' + id + decryptedOutput).length
  )
  verifyInput.set(DOMAIN_TAG)
  verifyInput.set(new TextEncoder().encode('VERIFY' + id + decryptedOutput), DOMAIN_TAG.length)
  const verificationHash = '0x' + bytesToHex(keccak_256(verifyInput))

  return {
    computationId: id,
    circuitId: entry.circuitId,
    decryptedOutput,
    verificationHash,
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

export function getSupportedCircuits(): typeof SUPPORTED_CIRCUITS {
  return SUPPORTED_CIRCUITS
}

export function resetArciumProvider(): void {
  computationCache.clear()
}

/** Test helper: override submittedAt to control state machine */
export function _setComputationTimestamp(id: string, ts: number): void {
  const entry = computationCache.get(id)
  if (entry) {
    entry.submittedAt = ts
    computationCache.set(id, entry)
  }
}
