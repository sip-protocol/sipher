import fs from 'node:fs'
import { ed25519 } from '@noble/curves/ed25519'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function encodeBase58(bytes: Uint8Array): string {
  let num = 0n
  for (const b of bytes) num = num * 256n + BigInt(b)
  let str = ''
  while (num > 0n) {
    str = BASE58_ALPHABET[Number(num % 58n)] + str
    num = num / 58n
  }
  for (const b of bytes) {
    if (b !== 0) break
    str = '1' + str
  }
  return str || '1'
}

export interface LoginResult {
  token: string
  isAdmin: boolean
  wallet: string
}

export async function mintAdminJwt(
  keypairPath: string,
  apiBase: string
): Promise<LoginResult> {
  const secretKeyArr = JSON.parse(fs.readFileSync(keypairPath, 'utf-8')) as number[]
  const secretKey64 = Uint8Array.from(secretKeyArr)
  const privateKey = secretKey64.slice(0, 32)
  const publicKey = ed25519.getPublicKey(privateKey)
  const wallet = encodeBase58(publicKey)

  const nonceResp = await fetch(`${apiBase}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet }),
  })
  if (!nonceResp.ok) {
    throw new Error(`nonce failed: ${nonceResp.status} ${await nonceResp.text()}`)
  }
  const { nonce, message } = (await nonceResp.json()) as { nonce: string; message: string }

  const sigBytes = ed25519.sign(new TextEncoder().encode(message), privateKey)
  const signature = encodeBase58(sigBytes)

  const verifyResp = await fetch(`${apiBase}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, nonce, signature }),
  })
  if (!verifyResp.ok) {
    throw new Error(`verify failed: ${verifyResp.status} ${await verifyResp.text()}`)
  }
  const { token, isAdmin } = (await verifyResp.json()) as {
    token: string
    isAdmin: boolean
  }
  return { token, isAdmin, wallet }
}
