import {
  generateStealthAddress,
  isEd25519Chain,
  ed25519PublicKeyToSolanaAddress,
  publicKeyToEthAddress,
  ed25519PublicKeyToNearAddress,
  commit,
} from '@sip-protocol/sdk'
import type { StealthMetaAddress, HexString, ChainId } from '@sip-protocol/types'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { buildShieldedSolTransfer, buildShieldedSplTransfer, buildAnchorShieldedSolTransfer } from './transaction-builder.js'

// ─── Supported Transfer Chains ──────────────────────────────────────────────

const TRANSFER_SUPPORTED_CHAINS = [
  'solana', 'ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'near',
] as const

const EVM_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
}

const EVM_CHAINS = new Set(Object.keys(EVM_CHAIN_IDS))

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SolanaTransferData {
  type: 'solana'
  transaction: string // base64 unsigned
  mint?: string
  noteId?: string
  instructionType?: 'anchor' | 'system'
  encryptedAmount?: string
}

export interface EvmTransferData {
  type: 'evm'
  to: string
  value: string
  data: string
  chainId: number
  tokenContract?: string
}

export interface NearTransferData {
  type: 'near'
  receiverId: string
  actions: NearAction[]
  tokenContract?: string
}

export type NearAction =
  | { type: 'Transfer'; amount: string }
  | { type: 'FunctionCall'; methodName: string; args: string; gas: string; deposit: string }

export type ChainTransferData = SolanaTransferData | EvmTransferData | NearTransferData

export interface PrivateTransferRequest {
  sender: string
  recipientMetaAddress: {
    spendingKey: string
    viewingKey: string
    chain: string
    label?: string
  }
  amount: string
  token?: string
}

export interface PrivateTransferResult {
  chain: string
  curve: 'ed25519' | 'secp256k1'
  stealthAddress: string
  ephemeralPublicKey: string
  viewTag: number
  commitment: string
  blindingFactor: string
  viewingKeyHash: string
  sharedSecret: string
  chainData: ChainTransferData
  noteId?: string
  instructionType?: 'anchor' | 'system'
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function isTransferSupported(chain: string): boolean {
  return (TRANSFER_SUPPORTED_CHAINS as readonly string[]).includes(chain)
}

export function getSupportedTransferChains(): string[] {
  return [...TRANSFER_SUPPORTED_CHAINS]
}

export async function buildPrivateTransfer(req: PrivateTransferRequest): Promise<PrivateTransferResult> {
  const { sender, recipientMetaAddress, amount, token } = req
  const chain = recipientMetaAddress.chain as ChainId
  const amountBigInt = BigInt(amount)

  // Generate stealth address (unified — auto-detects curve)
  const meta: StealthMetaAddress = {
    spendingKey: recipientMetaAddress.spendingKey as HexString,
    viewingKey: recipientMetaAddress.viewingKey as HexString,
    chain,
    label: recipientMetaAddress.label,
  }
  const stealthResult = generateStealthAddress(meta)

  // Pedersen commitment (chain-agnostic)
  const { commitment, blinding } = commit(amountBigInt)

  // Viewing key hash
  const viewingKeyBytes = hexToBytes(recipientMetaAddress.viewingKey.slice(2))
  const viewingKeyHash = `0x${bytesToHex(sha256(viewingKeyBytes))}`

  // Curve detection
  const curve = isEd25519Chain(chain) ? 'ed25519' : 'secp256k1'

  // Chain-specific transfer data
  let chainData: ChainTransferData
  let nativeAddress: string

  let noteId: string | undefined
  let instructionType: 'anchor' | 'system' | undefined

  if (chain === 'solana') {
    nativeAddress = ed25519PublicKeyToSolanaAddress(stealthResult.stealthAddress.address)
    chainData = await buildSolanaTransfer(sender, nativeAddress, amountBigInt, token, {
      commitment,
      blindingFactor: blinding,
      ephemeralPublicKey: stealthResult.stealthAddress.ephemeralPublicKey,
      viewingKeyHash,
    })
    if (chainData.noteId) noteId = chainData.noteId
    instructionType = chainData.instructionType
  } else if (EVM_CHAINS.has(chain)) {
    nativeAddress = publicKeyToEthAddress(stealthResult.stealthAddress.address)
    chainData = buildEvmTransfer(nativeAddress, amount, chain, token)
  } else if (chain === 'near') {
    nativeAddress = ed25519PublicKeyToNearAddress(stealthResult.stealthAddress.address)
    chainData = buildNearTransfer(nativeAddress, amount, token)
  } else {
    throw new Error(`Unsupported transfer chain: ${chain}`)
  }

  return {
    chain,
    curve,
    stealthAddress: nativeAddress,
    ephemeralPublicKey: stealthResult.stealthAddress.ephemeralPublicKey,
    viewTag: stealthResult.stealthAddress.viewTag,
    commitment,
    blindingFactor: blinding,
    viewingKeyHash,
    sharedSecret: stealthResult.sharedSecret,
    chainData,
    ...(noteId ? { noteId } : {}),
    ...(instructionType ? { instructionType } : {}),
  }
}

// ─── Chain-Specific Builders ────────────────────────────────────────────────

interface AnchorPipeParams {
  commitment: string
  blindingFactor: string
  ephemeralPublicKey: string
  viewingKeyHash: string
}

async function buildSolanaTransfer(
  sender: string,
  stealthAddress: string,
  amount: bigint,
  mint?: string,
  anchorParams?: AnchorPipeParams,
): Promise<SolanaTransferData> {
  let transaction: string
  let noteId: string | undefined
  let instructionType: 'anchor' | 'system' = 'system'
  let encryptedAmount: string | undefined

  if (mint) {
    transaction = await buildShieldedSplTransfer({ sender, stealthAddress, mint, amount })
  } else {
    // Try Anchor program path for native SOL
    if (anchorParams) {
      try {
        const anchorResult = await buildAnchorShieldedSolTransfer({
          sender,
          stealthAddress,
          amount,
          commitment: anchorParams.commitment,
          blindingFactor: anchorParams.blindingFactor,
          ephemeralPublicKey: anchorParams.ephemeralPublicKey,
          viewingKeyHash: anchorParams.viewingKeyHash,
        })
        transaction = anchorResult.transaction
        noteId = anchorResult.noteId
        instructionType = 'anchor'
        encryptedAmount = anchorResult.encryptedAmount
      } catch {
        transaction = await buildShieldedSolTransfer({ sender, stealthAddress, amount })
      }
    } else {
      transaction = await buildShieldedSolTransfer({ sender, stealthAddress, amount })
    }
  }

  return {
    type: 'solana',
    transaction,
    ...(mint ? { mint } : {}),
    ...(noteId ? { noteId } : {}),
    instructionType,
    ...(encryptedAmount ? { encryptedAmount } : {}),
  }
}

function buildEvmTransfer(
  stealthAddress: string,
  amount: string,
  chain: string,
  tokenContract?: string,
): EvmTransferData {
  const chainId = EVM_CHAIN_IDS[chain]

  if (tokenContract) {
    // ERC20 transfer(address,uint256) = 0xa9059cbb
    const paddedAddr = stealthAddress.slice(2).toLowerCase().padStart(64, '0')
    const paddedAmount = BigInt(amount).toString(16).padStart(64, '0')
    const data = `0xa9059cbb${paddedAddr}${paddedAmount}`

    return {
      type: 'evm',
      to: tokenContract,
      value: '0',
      data,
      chainId,
      tokenContract,
    }
  }

  return {
    type: 'evm',
    to: stealthAddress,
    value: amount,
    data: '0x',
    chainId,
  }
}

function buildNearTransfer(
  stealthAddress: string,
  amount: string,
  tokenContract?: string,
): NearTransferData {
  if (tokenContract) {
    // NEP-141 ft_transfer
    const args = Buffer.from(JSON.stringify({
      receiver_id: stealthAddress,
      amount,
      memo: 'SIP private transfer',
    })).toString('base64')

    return {
      type: 'near',
      receiverId: tokenContract,
      actions: [{
        type: 'FunctionCall',
        methodName: 'ft_transfer',
        args,
        gas: '30000000000000', // 30 TGas
        deposit: '1', // 1 yoctoNEAR (required for ft_transfer)
      }],
      tokenContract,
    }
  }

  return {
    type: 'near',
    receiverId: stealthAddress,
    actions: [{ type: 'Transfer', amount }],
  }
}
