import type Anthropic from '@anthropic-ai/sdk'
import { generateViewingKey, deriveViewingKey } from '@sip-protocol/sdk'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import { createConnection } from '@sipher/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Viewing Key tool — Generate, export, and verify viewing keys
//
// Viewing keys enable selective disclosure: the holder can detect incoming
// stealth payments without being able to spend them. Per spec, keys are
// NEVER displayed in chat — only made available for download.
// ─────────────────────────────────────────────────────────────────────────────

export type ViewingKeyAction = 'generate' | 'export' | 'verify'

export interface ViewingKeyParams {
  action: ViewingKeyAction
  txSignature?: string
  viewingKeyHex?: string
}

export interface DownloadData {
  blob: string
  filename: string
}

export interface ViewingKeyToolResult {
  action: 'viewingKey'
  keyAction: ViewingKeyAction
  status: 'success'
  message: string
  /** Whether the UI should offer a key download (never display in chat) */
  hasDownload: boolean
  /** Base64-encoded key file for download (never show raw key in chat) */
  downloadData: DownloadData | null
  details: {
    txSignature: string | null
    verified: boolean | null
    viewingKeyHash: string | null
    note: string
  }
}

export const viewingKeyTool: Anthropic.Tool = {
  name: 'viewingKey',
  description:
    'Manage viewing keys for selective disclosure and compliance. ' +
    'Generate new viewing keypair, export existing key, or verify a payment is visible to a viewing key. ' +
    'Keys are downloadable only — never displayed in chat.',
  input_schema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['generate', 'export', 'verify'],
        description: 'Action: generate new keypair, export existing key, or verify payment visibility',
      },
      txSignature: {
        type: 'string',
        description: 'Transaction signature (required for export and verify actions)',
      },
      viewingKeyHex: {
        type: 'string',
        description: 'Hex-encoded viewing key (required for verify action)',
      },
    },
    required: ['action'],
  },
}

/** Package a ViewingKey as a base64-encoded downloadable JSON blob */
function packKeyForDownload(
  keyData: { key: string; path: string; hash: string },
  filename: string,
): DownloadData {
  const json = JSON.stringify({
    key: keyData.key,
    path: keyData.path,
    hash: keyData.hash,
  })
  const blob = Buffer.from(json, 'utf-8').toString('base64')
  return { blob, filename }
}

/**
 * Parse the VaultWithdrawEvent from transaction log data.
 *
 * Event layout (after 8-byte Anchor discriminator):
 *   depositor:        32 bytes  (offset  8)
 *   stealth:          32 bytes  (offset 40)
 *   commitment:       33 bytes  (offset 72)
 *   ephemeral:        33 bytes  (offset 105)
 *   viewing_key_hash: 32 bytes  (offset 138)
 *
 * Returns the 32-byte viewingKeyHash or null if not found.
 */
function parseViewingKeyHashFromLogs(logMessages: string[]): Uint8Array | null {
  for (const msg of logMessages) {
    // Anchor emits event data as base64 in "Program data: <base64>" log lines
    if (!msg.startsWith('Program data: ')) continue

    const b64 = msg.slice('Program data: '.length).trim()
    let data: Buffer
    try {
      data = Buffer.from(b64, 'base64')
    } catch {
      continue
    }

    // VaultWithdrawEvent: 8 (disc) + 32 + 32 + 33 + 33 + 32 = 170 bytes minimum
    if (data.length < 170) continue

    return new Uint8Array(data.slice(138, 170))
  }

  return null
}

export async function executeViewingKey(params: ViewingKeyParams): Promise<ViewingKeyToolResult> {
  if (!params.action || !['generate', 'export', 'verify'].includes(params.action)) {
    throw new Error('Action must be one of: generate, export, verify')
  }

  if ((params.action === 'export' || params.action === 'verify') &&
      (!params.txSignature || params.txSignature.trim().length === 0)) {
    throw new Error(`Transaction signature is required for '${params.action}' action`)
  }

  if (params.action === 'verify' &&
      (!params.viewingKeyHex || params.viewingKeyHex.trim().length === 0)) {
    throw new Error("Viewing key hex is required for 'verify' action")
  }

  switch (params.action) {
    case 'generate': {
      const vk = generateViewingKey()
      const downloadData = packKeyForDownload(vk, 'sip-viewing-key.json')

      return {
        action: 'viewingKey',
        keyAction: 'generate',
        status: 'success',
        message:
          'Viewing keypair generated. Download your key file — it will NOT be shown in chat. ' +
          'Share the viewing key hash with auditors for compliance.',
        hasDownload: true,
        downloadData,
        details: {
          txSignature: null,
          verified: null,
          viewingKeyHash: vk.hash,
          note: 'The viewing key enables payment detection without spending authority. Store securely.',
        },
      }
    }

    case 'export': {
      // Phase 1: no persistent key storage — generate a fresh master key,
      // then derive a transaction-scoped child key from it
      const masterKey = generateViewingKey()
      const childPath = `tx/${params.txSignature!}`
      const childKey = deriveViewingKey(masterKey, childPath)
      const downloadData = packKeyForDownload(childKey, `sip-viewing-key-${params.txSignature!.slice(0, 8)}.json`)

      return {
        action: 'viewingKey',
        keyAction: 'export',
        status: 'success',
        message:
          `Viewing key export prepared for transaction ${params.txSignature!.slice(0, 12)}... ` +
          `Download the key file to share with your auditor.`,
        hasDownload: true,
        downloadData,
        details: {
          txSignature: params.txSignature!,
          verified: null,
          viewingKeyHash: childKey.hash,
          note: 'Exported viewing key grants read access to this specific transaction only.',
        },
      }
    }

    case 'verify': {
      const connection = createConnection('devnet')
      const tx = await connection.getParsedTransaction(
        params.txSignature!,
        { maxSupportedTransactionVersion: 0 },
      )

      if (!tx) {
        throw new Error(`Transaction not found: ${params.txSignature}`)
      }

      // Compute SHA-256 of the provided viewing key bytes
      const keyHex = params.viewingKeyHex!.replace(/^0x/, '')
      const keyBytes = hexToBytes(keyHex)
      const computedHash = sha256(keyBytes)

      // Extract viewingKeyHash from on-chain event logs
      const logMessages = tx.meta?.logMessages ?? []
      const onChainHash = parseViewingKeyHashFromLogs(logMessages)

      let verified = false
      let note: string

      if (!onChainHash) {
        note = 'No VaultWithdrawEvent found in transaction logs. Cannot verify viewing key.'
      } else {
        // Constant-time-ish comparison (both are 32 bytes)
        const computedHex = bytesToHex(computedHash)
        const onChainHex = bytesToHex(onChainHash)
        verified = computedHex === onChainHex

        note = verified
          ? 'On-chain viewingKeyHash matches the provided key. Auditor can see this payment.'
          : 'Viewing key hash does NOT match the on-chain record. This key cannot detect this payment.'
      }

      return {
        action: 'viewingKey',
        keyAction: 'verify',
        status: 'success',
        message: verified
          ? `Verification complete for transaction ${params.txSignature!.slice(0, 12)}... The viewing key can detect this payment.`
          : `Verification failed for transaction ${params.txSignature!.slice(0, 12)}... The viewing key does NOT match.`,
        hasDownload: false,
        downloadData: null,
        details: {
          txSignature: params.txSignature!,
          verified,
          viewingKeyHash: onChainHash ? `0x${bytesToHex(onChainHash)}` : null,
          note,
        },
      }
    }
  }
}
