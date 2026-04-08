import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** A valid hex viewing key (32 bytes = 64 hex chars) */
const VALID_VIEWING_KEY = 'ab'.repeat(32)

// ─────────────────────────────────────────────────────────────────────────────
// vi.hoisted — declare mock fns that vi.mock factories can reference
// ─────────────────────────────────────────────────────────────────────────────

const { mockGetParsedTransaction } = vi.hoisted(() => ({
  mockGetParsedTransaction: vi.fn(),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Mock @sip-protocol/sdk — generate/derive return deterministic keys
// vi.mock factory is hoisted, so all values must be computed inline
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@sip-protocol/sdk', async () => {
  const { sha256: sha } = await import('@noble/hashes/sha256')
  const { bytesToHex: toHex, hexToBytes: fromHex } = await import('@noble/hashes/utils')

  const masterKey = `0x${'aa'.repeat(32)}`
  const masterHash = `0x${toHex(sha(fromHex('aa'.repeat(32))))}`
  const childKey = `0x${'bb'.repeat(32)}`
  const childHash = `0x${toHex(sha(fromHex('bb'.repeat(32))))}`

  return {
    generateViewingKey: vi.fn().mockReturnValue({
      key: masterKey,
      path: 'm/0',
      hash: masterHash,
    }),
    deriveViewingKey: vi.fn().mockImplementation((_master: unknown, childPath: string) => ({
      key: childKey,
      path: `m/0/${childPath}`,
      hash: childHash,
    })),
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Mock @sipher/sdk — createConnection returns a mock Connection
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@sipher/sdk', () => ({
  createConnection: vi.fn().mockReturnValue({
    getParsedTransaction: mockGetParsedTransaction,
  }),
}))

// ─────────────────────────────────────────────────────────────────────────────
// Import module under test AFTER mocks are declared
// ─────────────────────────────────────────────────────────────────────────────

import { executeViewingKey, viewingKeyTool } from '../src/tools/viewing-key.js'

// Compute deterministic mock values for assertions
const MOCK_KEY = `0x${'aa'.repeat(32)}`
const MOCK_HASH = `0x${bytesToHex(sha256(hexToBytes('aa'.repeat(32))))}`
const MOCK_CHILD_KEY = `0x${'bb'.repeat(32)}`
const MOCK_CHILD_HASH = `0x${bytesToHex(sha256(hexToBytes('bb'.repeat(32))))}`

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a fake VaultWithdrawEvent log line
// ─────────────────────────────────────────────────────────────────────────────

function buildVaultWithdrawEventLog(viewingKeyHash: Uint8Array): string {
  // 8 (discriminator) + 32 (depositor) + 32 (stealth) + 33 (commitment) + 33 (ephemeral) + 32 (viewingKeyHash) = 170
  const buf = Buffer.alloc(170)
  // discriminator — arbitrary 8 bytes
  buf.writeUInt32LE(0x12345678, 0)
  buf.writeUInt32LE(0x9abcdef0, 4)
  // depositor — 32 bytes of 0x01
  buf.fill(0x01, 8, 40)
  // stealth — 32 bytes of 0x02
  buf.fill(0x02, 40, 72)
  // commitment — 33 bytes of 0x03
  buf.fill(0x03, 72, 105)
  // ephemeral — 33 bytes of 0x04
  buf.fill(0x04, 105, 138)
  // viewingKeyHash at offset 138
  viewingKeyHash.forEach((b, i) => buf[138 + i] = b)

  return `Program data: ${buf.toString('base64')}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('viewingKeyTool definition', () => {
  it('has the expected Anthropic tool shape', () => {
    expect(viewingKeyTool.name).toBe('viewingKey')
    expect(viewingKeyTool.description).toBeTruthy()
    expect(viewingKeyTool.input_schema.type).toBe('object')
    expect(viewingKeyTool.input_schema.properties).toHaveProperty('action')
    expect(viewingKeyTool.input_schema.properties).toHaveProperty('txSignature')
    expect(viewingKeyTool.input_schema.properties).toHaveProperty('viewingKeyHex')
  })

  it('requires only action', () => {
    const schema = viewingKeyTool.input_schema as { required?: string[] }
    expect(schema.required).toEqual(['action'])
  })
})

describe('executeViewingKey — validation', () => {
  it('rejects invalid action', async () => {
    await expect(
      executeViewingKey({ action: 'invalid' as 'generate' })
    ).rejects.toThrow('Action must be one of: generate, export, verify')
  })

  it('rejects export without txSignature', async () => {
    await expect(
      executeViewingKey({ action: 'export' })
    ).rejects.toThrow("Transaction signature is required for 'export' action")
  })

  it('rejects verify without txSignature', async () => {
    await expect(
      executeViewingKey({ action: 'verify', viewingKeyHex: VALID_VIEWING_KEY })
    ).rejects.toThrow("Transaction signature is required for 'verify' action")
  })

  it('rejects verify without viewingKeyHex', async () => {
    await expect(
      executeViewingKey({ action: 'verify', txSignature: 'sig_abc' })
    ).rejects.toThrow("Viewing key hex is required for 'verify' action")
  })

  it('rejects export with empty txSignature', async () => {
    await expect(
      executeViewingKey({ action: 'export', txSignature: '   ' })
    ).rejects.toThrow("Transaction signature is required for 'export' action")
  })

  it('rejects verify with empty viewingKeyHex', async () => {
    await expect(
      executeViewingKey({ action: 'verify', txSignature: 'sig_abc', viewingKeyHex: '   ' })
    ).rejects.toThrow("Viewing key hex is required for 'verify' action")
  })
})

describe('executeViewingKey — generate', () => {
  it('returns downloadable blob with real key data', async () => {
    const result = await executeViewingKey({ action: 'generate' })

    expect(result.action).toBe('viewingKey')
    expect(result.keyAction).toBe('generate')
    expect(result.status).toBe('success')
    expect(result.hasDownload).toBe(true)
    expect(result.downloadData).not.toBeNull()
    expect(result.downloadData!.filename).toBe('sip-viewing-key.json')
    expect(result.details.txSignature).toBeNull()
    expect(result.details.verified).toBeNull()
    expect(result.details.viewingKeyHash).toBe(MOCK_HASH)
    expect(result.message).toContain('NOT be shown in chat')
  })

  it('blob is valid JSON with key, path, hash fields', async () => {
    const result = await executeViewingKey({ action: 'generate' })
    const json = JSON.parse(
      Buffer.from(result.downloadData!.blob, 'base64').toString('utf-8')
    )

    expect(json).toHaveProperty('key')
    expect(json).toHaveProperty('path')
    expect(json).toHaveProperty('hash')
    expect(json.key).toBe(MOCK_KEY)
    expect(json.path).toBe('m/0')
    expect(json.hash).toBe(MOCK_HASH)
  })

  it('calls generateViewingKey from SDK', async () => {
    const { generateViewingKey } = await import('@sip-protocol/sdk')
    await executeViewingKey({ action: 'generate' })
    expect(generateViewingKey).toHaveBeenCalled()
  })
})

describe('executeViewingKey — export', () => {
  it('returns transaction-scoped key', async () => {
    const result = await executeViewingKey({
      action: 'export',
      txSignature: 'sig_export_9876',
    })

    expect(result.keyAction).toBe('export')
    expect(result.hasDownload).toBe(true)
    expect(result.downloadData).not.toBeNull()
    expect(result.downloadData!.filename).toContain('sig_expo')
    expect(result.details.txSignature).toBe('sig_export_9876')
    expect(result.details.viewingKeyHash).toBe(MOCK_CHILD_HASH)
  })

  it('blob contains derived key with tx path', async () => {
    const result = await executeViewingKey({
      action: 'export',
      txSignature: 'sig_export_9876',
    })

    const json = JSON.parse(
      Buffer.from(result.downloadData!.blob, 'base64').toString('utf-8')
    )
    expect(json.key).toBe(MOCK_CHILD_KEY)
    expect(json.path).toContain('tx/sig_export_9876')
  })

  it('calls generateViewingKey and deriveViewingKey from SDK', async () => {
    const { generateViewingKey, deriveViewingKey } = await import('@sip-protocol/sdk')
    await executeViewingKey({ action: 'export', txSignature: 'sig_abc' })

    expect(generateViewingKey).toHaveBeenCalled()
    expect(deriveViewingKey).toHaveBeenCalledWith(
      expect.objectContaining({ key: MOCK_KEY }),
      'tx/sig_abc',
    )
  })
})

describe('executeViewingKey — verify', () => {
  it('rejects when TX not found', async () => {
    mockGetParsedTransaction.mockResolvedValue(null)

    await expect(
      executeViewingKey({
        action: 'verify',
        txSignature: 'sig_notfound',
        viewingKeyHex: VALID_VIEWING_KEY,
      })
    ).rejects.toThrow('Transaction not found: sig_notfound')
  })

  it('returns verified=true when hashes match', async () => {
    // Compute expected hash for the provided viewing key
    const keyBytes = hexToBytes(VALID_VIEWING_KEY)
    const expectedHash = sha256(keyBytes)

    mockGetParsedTransaction.mockResolvedValue({
      meta: {
        logMessages: [
          'Program log: Instruction: WithdrawPrivate',
          buildVaultWithdrawEventLog(expectedHash),
        ],
      },
    })

    const result = await executeViewingKey({
      action: 'verify',
      txSignature: 'sig_match_123',
      viewingKeyHex: VALID_VIEWING_KEY,
    })

    expect(result.keyAction).toBe('verify')
    expect(result.hasDownload).toBe(false)
    expect(result.downloadData).toBeNull()
    expect(result.details.verified).toBe(true)
    expect(result.details.txSignature).toBe('sig_match_123')
    expect(result.details.viewingKeyHash).toBeTruthy()
    expect(result.details.note).toContain('matches')
  })

  it('returns verified=false when hashes do not match', async () => {
    // Put a different hash on-chain
    const wrongHash = new Uint8Array(32).fill(0xff)

    mockGetParsedTransaction.mockResolvedValue({
      meta: {
        logMessages: [
          buildVaultWithdrawEventLog(wrongHash),
        ],
      },
    })

    const result = await executeViewingKey({
      action: 'verify',
      txSignature: 'sig_mismatch_456',
      viewingKeyHex: VALID_VIEWING_KEY,
    })

    expect(result.details.verified).toBe(false)
    expect(result.details.note).toContain('does NOT match')
    expect(result.message).toContain('does NOT match')
  })

  it('returns verified=false when no event in logs', async () => {
    mockGetParsedTransaction.mockResolvedValue({
      meta: {
        logMessages: [
          'Program log: Instruction: WithdrawPrivate',
          'Program log: some other message',
        ],
      },
    })

    const result = await executeViewingKey({
      action: 'verify',
      txSignature: 'sig_noevent',
      viewingKeyHex: VALID_VIEWING_KEY,
    })

    expect(result.details.verified).toBe(false)
    expect(result.details.viewingKeyHash).toBeNull()
    expect(result.details.note).toContain('No VaultWithdrawEvent found')
  })

  it('handles 0x-prefixed viewingKeyHex', async () => {
    const keyBytes = hexToBytes(VALID_VIEWING_KEY)
    const expectedHash = sha256(keyBytes)

    mockGetParsedTransaction.mockResolvedValue({
      meta: {
        logMessages: [buildVaultWithdrawEventLog(expectedHash)],
      },
    })

    const result = await executeViewingKey({
      action: 'verify',
      txSignature: 'sig_0x_prefix',
      viewingKeyHex: `0x${VALID_VIEWING_KEY}`,
    })

    expect(result.details.verified).toBe(true)
  })

  it('handles tx with empty logMessages', async () => {
    mockGetParsedTransaction.mockResolvedValue({
      meta: { logMessages: [] },
    })

    const result = await executeViewingKey({
      action: 'verify',
      txSignature: 'sig_empty_logs',
      viewingKeyHex: VALID_VIEWING_KEY,
    })

    expect(result.details.verified).toBe(false)
    expect(result.details.note).toContain('No VaultWithdrawEvent found')
  })

  it('handles tx with null meta.logMessages', async () => {
    mockGetParsedTransaction.mockResolvedValue({
      meta: {},
    })

    const result = await executeViewingKey({
      action: 'verify',
      txSignature: 'sig_null_logs',
      viewingKeyHex: VALID_VIEWING_KEY,
    })

    expect(result.details.verified).toBe(false)
  })
})
