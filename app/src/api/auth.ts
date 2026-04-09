import { apiFetch } from './client'

export async function requestNonce(wallet: string): Promise<{ nonce: string, message: string }> {
  return apiFetch('/api/auth/nonce', { method: 'POST', body: JSON.stringify({ wallet }) })
}

export async function verifySignature(
  wallet: string,
  nonce: string,
  signature: string
): Promise<{ token: string, expiresIn: string }> {
  return apiFetch('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ wallet, nonce, signature }),
  })
}
