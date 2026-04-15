import type { AnthropicTool } from '../pi/tool-adapter.js'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import {
  generateEd25519StealthAddress,
  ed25519PublicKeyToSolanaAddress,
  commit,
} from '@sip-protocol/sdk'
import { sha256 } from '@noble/hashes/sha256'
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'
import { randomBytes as cryptoRandomBytes } from 'node:crypto'
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

export const sendTool: AnthropicTool = {
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
  const network = (process.env.SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
  const connection = createConnection(network)

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
  let amountCommitment: Uint8Array
  let ephemeralPubkey: Uint8Array
  let viewingKeyHash: Uint8Array
  let blinding = ''

  const isStealthMetaAddress = params.recipient.startsWith('sip:solana:')

  if (isStealthMetaAddress) {
    // Full stealth meta-address: sip:solana:0x<spendingKey>:0x<viewingKey>
    const parts = params.recipient.split(':')
    if (parts.length !== 4 || !parts[2] || !parts[3]) {
      throw new Error(
        `Invalid stealth meta-address: expected sip:solana:<spendingKey>:<viewingKey>, ` +
        `got ${params.recipient}`
      )
    }

    if (!parts[2].startsWith('0x') || !parts[3].startsWith('0x')) {
      throw new Error('Stealth meta-address keys must be 0x-prefixed hex strings')
    }

    const metaAddress = {
      spendingKey: parts[2] as `0x${string}`,
      viewingKey: parts[3] as `0x${string}`,
      chain: 'solana' as const,
    }

    // Generate a one-time stealth address for this recipient
    const stealth = generateEd25519StealthAddress(metaAddress)
    const solanaAddress = ed25519PublicKeyToSolanaAddress(stealth.stealthAddress.address)
    stealthPubkey = new PublicKey(solanaAddress)

    // Real Pedersen commitment: C = amount*G + blinding*H
    const commitResult = commit(BigInt(amountBase))
    blinding = commitResult.blinding
    amountCommitment = hexToBytes(commitResult.commitment)

    // Ephemeral pubkey: 32-byte ed25519 -> pad to 33 bytes with 0x00 prefix
    // On-chain program stores but doesn't validate the curve — opaque bytes for the scanner
    const ephRaw = hexToBytes(stealth.stealthAddress.ephemeralPublicKey)
    ephemeralPubkey = new Uint8Array(33)
    ephemeralPubkey[0] = 0x00
    ephemeralPubkey.set(ephRaw, 1)

    // SHA-256 hash of the viewing key bytes
    const vkBytes = hexToBytes(metaAddress.viewingKey)
    viewingKeyHash = sha256(vkBytes)
  } else {
    // Raw base58 pubkey — no stealth derivation possible without viewing key.
    // Use zero-filled crypto params; the on-chain program accepts them.
    try {
      stealthPubkey = new PublicKey(params.recipient)
    } catch {
      throw new Error(`Invalid recipient address: ${params.recipient}`)
    }

    amountCommitment = new Uint8Array(33).fill(0)
    ephemeralPubkey = new Uint8Array(33).fill(0)
    viewingKeyHash = new Uint8Array(32).fill(0)
  }

  // Encrypt amount + blinding factor with XChaCha20-Poly1305 (AEAD).
  // Key = viewing key hash (32 bytes), nonce = random 24 bytes.
  // Layout: [24 bytes nonce] || [ciphertext + 16 bytes tag]
  // Plaintext: [8 bytes amount LE] || [32 bytes blinding]
  let encryptedAmount: Uint8Array
  if (isStealthMetaAddress) {
    const amountLeBytes = bigintToLeBytes(BigInt(amountBase))
    const blindingBytes = hexToBytes(blinding)
    const plaintext = new Uint8Array(amountLeBytes.length + blindingBytes.length)
    plaintext.set(amountLeBytes, 0)
    plaintext.set(blindingBytes, amountLeBytes.length)

    const nonce = new Uint8Array(cryptoRandomBytes(24))
    const cipher = xchacha20poly1305(viewingKeyHash, nonce)
    const ciphertext = cipher.encrypt(plaintext)

    // Prepend nonce so recipient can decrypt
    encryptedAmount = new Uint8Array(nonce.length + ciphertext.length)
    encryptedAmount.set(nonce, 0)
    encryptedAmount.set(ciphertext, nonce.length)
  } else {
    encryptedAmount = new Uint8Array(0)
  }
  const proof = new Uint8Array(0)

  // Derive the stealth recipient's associated token account
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
      commitmentGenerated: isStealthMetaAddress,
      viewingKeyHashIncluded: isStealthMetaAddress,
      feeBps,
      estimatedFee: fromBaseUnits(result.feeAmount, decimals) + ` ${token}`,
      netAmount: fromBaseUnits(result.netAmount, decimals),
    },
  }
}

/** Convert a 0x-prefixed hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const h = hex.replace(/^0x/, '')
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** Convert a bigint to little-endian byte array */
function bigintToLeBytes(value: bigint, size = 8): Uint8Array {
  const buf = new Uint8Array(size)
  let v = value
  for (let i = 0; i < size; i++) {
    buf[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return buf
}
