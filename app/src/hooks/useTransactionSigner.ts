import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Transaction, VersionedTransaction } from '@solana/web3.js'
import { useCallback, useState } from 'react'

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

export function useTransactionSigner() {
  const { connection } = useConnection()
  const { signTransaction, publicKey } = useWallet()
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
        // VersionedTransaction: update blockhash in the message
        tx.message.recentBlockhash = blockhash
      }

      const signed = await signTransaction(tx)

      setStatus('broadcasting')

      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      })

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      )

      setStatus('confirmed')
      return { signature }
    } catch (err) {
      setStatus('error')
      const message = err instanceof Error ? err.message : String(err)
      return { error: message }
    }
  }, [connection, signTransaction, publicKey])

  const reset = useCallback(() => setStatus('idle'), [])

  return { signAndBroadcast, status, setStatus, reset }
}
