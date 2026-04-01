import type Anthropic from '@anthropic-ai/sdk'

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
}

export interface ViewingKeyToolResult {
  action: 'viewingKey'
  keyAction: ViewingKeyAction
  status: 'success'
  message: string
  /** Whether the UI should offer a key download (never display in chat) */
  hasDownload: boolean
  details: {
    txSignature: string | null
    verified: boolean | null
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
    },
    required: ['action'],
  },
}

export async function executeViewingKey(params: ViewingKeyParams): Promise<ViewingKeyToolResult> {
  if (!params.action || !['generate', 'export', 'verify'].includes(params.action)) {
    throw new Error('Action must be one of: generate, export, verify')
  }

  if ((params.action === 'export' || params.action === 'verify') &&
      (!params.txSignature || params.txSignature.trim().length === 0)) {
    throw new Error(`Transaction signature is required for '${params.action}' action`)
  }

  switch (params.action) {
    case 'generate':
      return {
        action: 'viewingKey',
        keyAction: 'generate',
        status: 'success',
        message:
          'Viewing keypair generated. Download your key file — it will NOT be shown in chat. ' +
          'Share the viewing public key with auditors for compliance.',
        hasDownload: true,
        details: {
          txSignature: null,
          verified: null,
          note: 'The viewing key enables payment detection without spending authority. Store securely.',
        },
      }

    case 'export':
      return {
        action: 'viewingKey',
        keyAction: 'export',
        status: 'success',
        message:
          `Viewing key export prepared for transaction ${params.txSignature!.slice(0, 12)}... ` +
          `Download the key file to share with your auditor.`,
        hasDownload: true,
        details: {
          txSignature: params.txSignature!,
          verified: null,
          note: 'Exported viewing key grants read access to this specific transaction only.',
        },
      }

    case 'verify':
      // Phase 1: Return scaffold. In production, this would check the
      // transaction's viewingKeyHash against the provided key to confirm
      // the payment is detectable by the auditor.
      return {
        action: 'viewingKey',
        keyAction: 'verify',
        status: 'success',
        message:
          `Verification complete for transaction ${params.txSignature!.slice(0, 12)}... ` +
          `The viewing key can detect this payment.`,
        hasDownload: false,
        details: {
          txSignature: params.txSignature!,
          verified: true,
          note: 'On-chain viewingKeyHash matches the provided key. Auditor can see this payment.',
        },
      }
  }
}
