import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'

export interface EncryptedBlob {
  v: 1
  alg: 'xchacha20poly1305-pbkdf2sha256-310k'
  salt: string
  nonce: string
  ct: string
}

const ITERATIONS = 310_000
const SALT_BYTES = 16
const NONCE_BYTES = 24

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder().encode(passphrase)
  const baseKey = await crypto.subtle.importKey(
    'raw', enc, { name: 'PBKDF2' }, false, ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256,
  )
  return new Uint8Array(bits)
}

export async function encryptWithPassphrase(
  plaintext: Uint8Array,
  passphrase: string,
): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const key = await deriveKey(passphrase, salt)
  const cipher = xchacha20poly1305(key, nonce)
  const ct = cipher.encrypt(plaintext)
  return {
    v: 1,
    alg: 'xchacha20poly1305-pbkdf2sha256-310k',
    salt: toB64(salt),
    nonce: toB64(nonce),
    ct: toB64(ct),
  }
}

export async function decryptWithPassphrase(
  blob: EncryptedBlob,
  passphrase: string,
): Promise<Uint8Array> {
  if (blob.v !== 1 || blob.alg !== 'xchacha20poly1305-pbkdf2sha256-310k') {
    throw new Error('Unsupported blob format')
  }
  const salt = fromB64(blob.salt)
  const nonce = fromB64(blob.nonce)
  const ct = fromB64(blob.ct)
  const key = await deriveKey(passphrase, salt)
  const cipher = xchacha20poly1305(key, nonce)
  return cipher.decrypt(ct)
}
