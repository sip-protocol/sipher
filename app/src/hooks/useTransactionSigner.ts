import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { useCallback, useState } from 'react'
import { broadcastViaBackend } from '../lib/broadcast'
import { useAuthState } from './useAuthState'

export type SignStatus = 'idle' | 'signing' | 'broadcasting' | 'confirmed' | 'error'

export interface SignResult {
  signature?: string
  error?: string
}

function deserializeTransaction(bytes: Uint8Array): Transaction | VersionedTransaction {
  try {
    return Transaction.from(bytes)
  } catch {
    return VersionedTransaction.deserialize(bytes)
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function useTransactionSigner() {
  const { connection } = useConnection()
  const { signTransaction, publicKey } = useWallet()
  const { token } = useAuthState()
  const [status, setStatus] = useState<SignStatus>('idle')

  const signAndBroadcast = useCallback(async (serializedTx: string): Promise<SignResult> => {
    if (!signTransaction || !publicKey) {
      setStatus('error')
      return { error: 'Wallet not connected' }
    }

    try {
      setStatus('signing')

      const bytes = base64ToBytes(serializedTx)
      const tx = deserializeTransaction(bytes)

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')

      if (tx instanceof Transaction) {
        tx.recentBlockhash = blockhash
        tx.feePayer = publicKey
      } else {
        tx.message.recentBlockhash = blockhash
      }

      const signed = await signTransaction(tx)

      setStatus('broadcasting')

      // Broadcast via backend (Helius). Public devnet RPC drops broadcasts
      // silently; the backend proxy + server-side resubmit loop defends
      // against that. See sipher#297.
      const { signature } = await broadcastViaBackend(
        {
          serializedTx: bytesToBase64(signed.serialize()),
          blockhash,
          lastValidBlockHeight,
        },
        token ?? undefined,
      )

      setStatus('confirmed')
      return { signature }
    } catch (err) {
      setStatus('error')
      const message = err instanceof Error ? err.message : String(err)
      return { error: message }
    }
  }, [connection, signTransaction, publicKey, token])

  const reset = useCallback(() => setStatus('idle'), [])

  return { signAndBroadcast, status, setStatus, reset }
}
