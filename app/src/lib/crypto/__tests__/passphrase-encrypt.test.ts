import { describe, it, expect } from 'vitest'
import { encryptWithPassphrase, decryptWithPassphrase } from '../passphrase-encrypt'

describe('passphrase-encrypt', () => {
  const plaintext = new TextEncoder().encode(JSON.stringify({ hello: 'world', n: 1 }))

  it('produces output matching the schema (v1, salt b64, nonce b64, ct b64)', async () => {
    const blob = await encryptWithPassphrase(plaintext, 'correct horse battery staple')
    expect(blob.v).toBe(1)
    expect(blob.alg).toBe('xchacha20poly1305-pbkdf2sha256-310k')
    expect(typeof blob.salt).toBe('string')
    expect(typeof blob.nonce).toBe('string')
    expect(typeof blob.ct).toBe('string')
    expect(blob.salt.length).toBeGreaterThan(0)
    expect(blob.nonce.length).toBeGreaterThan(0)
    expect(blob.ct.length).toBeGreaterThan(0)
  })

  it('produces a different salt + nonce per call', async () => {
    const a = await encryptWithPassphrase(plaintext, 'pw')
    const b = await encryptWithPassphrase(plaintext, 'pw')
    expect(a.salt).not.toBe(b.salt)
    expect(a.nonce).not.toBe(b.nonce)
    expect(a.ct).not.toBe(b.ct)
  })

  it('round-trips with the correct passphrase', async () => {
    const blob = await encryptWithPassphrase(plaintext, 'open-sesame')
    const recovered = await decryptWithPassphrase(blob, 'open-sesame')
    expect(new TextDecoder().decode(recovered)).toBe(new TextDecoder().decode(plaintext))
  })

  it('throws on wrong passphrase', async () => {
    const blob = await encryptWithPassphrase(plaintext, 'right')
    await expect(decryptWithPassphrase(blob, 'wrong')).rejects.toThrow()
  })
})
