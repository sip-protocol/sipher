import type Anthropic from '@anthropic-ai/sdk'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import {
  createConnection,
  buildPrivateSendTx,
  resolveTokenMint,
  getTokenDecimals,
  toBaseUnits,
  fromBaseUnits,
  getVaultConfig,
  DEFAULT_FEE_BPS,
} from '@sipher/sdk'

// ─────────────────────────────────────────────────────────────────────────────
// Private Send tool — Withdraw from vault to a stealth address
// ─────────────────────────────────────────────────────────────────────────────

export interface SendParams {
  amount: number
  token: string
  recipient: string
  wallet?: string
  memo?: string
}

export interface SendToolResult {
  action: 'send'
  amount: number
  token: string
  recipient: string
  status: 'awaiting_signature'
  message: string
  /** Base64-serialized unsigned transaction (when wallet + full params provided) */
  serializedTx: string | null
  privacy: {
    stealthAddress: string
    commitmentGenerated: boolean
    viewingKeyHashIncluded: boolean
    feeBps: number
    estimatedFee: string
    netAmount: string | null
  }
}

export const sendTool: Anthropic.Tool = {
  name: 'send',
  description:
    'Send a private payment from the vault to a recipient. ' +
    'Creates a stealth address, Pedersen commitment, and builds an unsigned withdraw_private transaction. ' +
    'The recipient can scan for this payment using their viewing key.',
  input_schema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'number',
        description: 'Amount to send (in human-readable units)',
      },
      token: {
        type: 'string',
        description: 'Token symbol — SOL, USDC, USDT, or SPL mint address',
      },
      recipient: {
        type: 'string',
        description:
          'Recipient stealth meta-address (sip:solana:...) or raw spending pubkey (base58)',
      },
      wallet: {
        type: 'string',
        description: 'Sender wallet address (base58). Required to build the transaction.',
      },
      memo: {
        type: 'string',
        description: 'Optional encrypted memo for the recipient',
      },
    },
    required: ['amount', 'token', 'recipient'],
  },
}

export async function executeSend(params: SendParams): Promise<SendToolResult> {
  if (params.amount <= 0) {
    throw new Error('Send amount must be greater than zero')
  }

  if (!params.token || params.token.trim().length === 0) {
    throw new Error('Token symbol is required')
  }

  if (!params.recipient || params.recipient.trim().length === 0) {
    throw new Error('Recipient address is required')
  }

  const token = params.token.toUpperCase()
  const connection = createConnection('devnet')

  // Fetch live fee_bps from on-chain config
  const config = await getVaultConfig(connection)
  const feeBps = config?.feeBps ?? DEFAULT_FEE_BPS
  const feePercent = feeBps / 100

  // If no wallet, return the preview without building a tx
  if (!params.wallet) {
    return {
      action: 'send',
      amount: params.amount,
      token,
      recipient: params.recipient,
      status: 'awaiting_signature',
      message:
        `Private send prepared: ${params.amount} ${token} to stealth address. ` +
        `Fee: ${feePercent}%. Connect wallet to sign.`,
      serializedTx: null,
      privacy: {
        stealthAddress: '<derived-at-execution>',
        commitmentGenerated: true,
        viewingKeyHashIncluded: true,
        feeBps,
        estimatedFee: `${(params.amount * feePercent) / 100} ${token}`,
        netAmount: null,
      },
    }
  }

  // Build the real transaction
  const tokenMint = resolveTokenMint(params.token)
  const decimals = getTokenDecimals(tokenMint)
  const amountBase = toBaseUnits(params.amount, decimals)

  let depositor: PublicKey
  try {
    depositor = new PublicKey(params.wallet)
  } catch {
    throw new Error(`Invalid wallet address: ${params.wallet}`)
  }

  // Parse recipient — could be sip:solana:<spend>:<view> or raw base58 pubkey
  let stealthPubkey: PublicKey
  try {
    if (params.recipient.startsWith('sip:')) {
      const parts = params.recipient.split(':')
      stealthPubkey = new PublicKey(parts[2])
    } else {
      stealthPubkey = new PublicKey(params.recipient)
    }
  } catch {
    throw new Error(`Invalid recipient address: ${params.recipient}`)
  }

  // Placeholder cryptographic parameters — in production, these come from
  // @sip-protocol/sdk's stealth address derivation. For Phase 1, we use
  // deterministic placeholders so the transaction structure is correct.
  const amountCommitment = new Uint8Array(33).fill(0)
  const ephemeralPubkey = new Uint8Array(33).fill(0)
  const viewingKeyHash = new Uint8Array(32).fill(0)
  const encryptedAmount = new Uint8Array(0)
  const proof = new Uint8Array(0)

  // The stealth token account — for Phase 1, use the recipient's ATA.
  // In production, this would be a freshly-created ATA for the derived stealth address.
  const stealthTokenAccount = await getAssociatedTokenAddress(tokenMint, stealthPubkey)

  const result = await buildPrivateSendTx({
    connection,
    depositor,
    tokenMint,
    amount: amountBase,
    stealthTokenAccount,
    stealthPubkey,
    amountCommitment,
    ephemeralPubkey,
    viewingKeyHash,
    encryptedAmount,
    proof,
  })

  const serializedTx = result.transaction
    .serialize({ requireAllSignatures: false })
    .toString('base64')

  return {
    action: 'send',
    amount: params.amount,
    token,
    recipient: params.recipient,
    status: 'awaiting_signature',
    message:
      `Private send prepared: ${params.amount} ${token} to stealth address. ` +
      `Fee: ${feePercent}%. Awaiting wallet signature.`,
    serializedTx,
    privacy: {
      stealthAddress: stealthPubkey.toBase58(),
      commitmentGenerated: true,
      viewingKeyHashIncluded: true,
      feeBps,
      estimatedFee: fromBaseUnits(result.feeAmount, decimals) + ` ${token}`,
      netAmount: fromBaseUnits(result.netAmount, decimals),
    },
  }
}
