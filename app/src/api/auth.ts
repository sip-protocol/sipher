import { apiFetch } from './client'

export interface NonceResponse {
  nonce: string
  message: string
}

export interface VerifyResponse {
  token: string
  expiresIn: string
  isAdmin: boolean
}

export async function requestNonce(wallet: string): Promise<NonceResponse> {
  return apiFetch('/api/auth/nonce', { method: 'POST', body: JSON.stringify({ wallet }) })
}

export async function verifySignature(
  wallet: string,
  nonce: string,
  signature: string
): Promise<VerifyResponse> {
  return apiFetch('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ wallet, nonce, signature }),
  })
}
