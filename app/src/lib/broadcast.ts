import { apiFetch } from '../api/client'

export interface BroadcastInput {
  /** base64-encoded signed transaction bytes */
  serializedTx: string
  /** recent blockhash used when signing */
  blockhash: string
  /** expiry height for confirmation */
  lastValidBlockHeight: number
}

export interface BroadcastResult {
  /** on-chain transaction signature, confirmed at 'confirmed' commitment */
  signature: string
}

/**
 * Broadcast a signed Solana transaction via the sipher backend (server-side
 * Helius connection). Replaces FE-side `connection.sendRawTransaction` which
 * dropped silently on the rate-limited public devnet RPC. See sipher#297.
 *
 * Backend owns broadcast + resubmit + confirm; this helper returns only
 * after the cluster confirms the tx at 'confirmed' commitment.
 *
 * Errors are surfaced via apiFetch's standard envelope unwrapping — the
 * thrown Error.message carries the user-friendly backend message.
 */
export async function broadcastViaBackend(
  input: BroadcastInput,
  token?: string,
): Promise<BroadcastResult> {
  return apiFetch<BroadcastResult>('/api/tx/broadcast', {
    method: 'POST',
    body: JSON.stringify(input),
    token,
  })
}
