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

export interface VerifyOptions {
  /**
   * Base64-encoded bytes of the message the wallet actually signed.
   * Required for the SIWS path (the wallet signs a CAIP-122-style structured
   * message that the server cannot reconstruct from `nonce` alone). When
   * omitted, the server reconstructs its own message from `nonce` (legacy
   * signMessage path).
   */
  signedMessage?: string
}

export async function verifySignature(
  wallet: string,
  nonce: string,
  signature: string,
  options: VerifyOptions = {}
): Promise<VerifyResponse> {
  const body: Record<string, string> = { wallet, nonce, signature }
  if (options.signedMessage) body.signedMessage = options.signedMessage
  return apiFetch('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
