import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(function () { return ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    }) }),
  }
})

const { default: app } = await import('../src/server.js')

describe('POST /v1/viewing-key/derive', () => {
  it('derives a child viewing key from a master key', async () => {
    // Generate master key
    const masterRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })
    const master = masterRes.body.data

    // Derive child
    const res = await request(app)
      .post('/v1/viewing-key/derive')
      .send({
        masterKey: master,
        childPath: 'audit',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.key).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.path).toBe('m/0/audit')
    expect(res.body.data.hash).toMatch(/^0x[0-9a-f]{64}$/)
    expect(res.body.data.derivedFrom.parentHash).toBe(master.hash)
    expect(res.body.data.derivedFrom.childPath).toBe('audit')
  })

  it('derives different keys for different paths', async () => {
    const masterRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })
    const master = masterRes.body.data

    const audit = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: master, childPath: 'audit' })
    const accounting = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: master, childPath: 'accounting' })

    expect(audit.body.data.key).not.toBe(accounting.body.data.key)
    expect(audit.body.data.hash).not.toBe(accounting.body.data.hash)
  })

  it('deterministically derives the same key for the same path', async () => {
    const masterRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })
    const master = masterRes.body.data

    const first = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: master, childPath: 'audit' })
    const second = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: master, childPath: 'audit' })

    expect(first.body.data.key).toBe(second.body.data.key)
    expect(first.body.data.hash).toBe(second.body.data.hash)
  })

  it('child key can encrypt/decrypt data independently', async () => {
    const masterRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })
    const master = masterRes.body.data

    const childRes = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: master, childPath: 'audit' })
    const child = childRes.body.data

    // Encrypt with child key
    const encrypted = await request(app)
      .post('/v1/viewing-key/disclose')
      .send({
        viewingKey: { key: child.key, path: child.path, hash: child.hash },
        transactionData: {
          sender: 'Alice',
          recipient: 'Bob',
          amount: '1000',
          timestamp: 1700000000,
        },
      })
    expect(encrypted.status).toBe(200)

    // Decrypt with child key
    const decrypted = await request(app)
      .post('/v1/viewing-key/decrypt')
      .send({
        viewingKey: { key: child.key, path: child.path, hash: child.hash },
        encrypted: {
          ciphertext: encrypted.body.data.ciphertext,
          nonce: encrypted.body.data.nonce,
          viewingKeyHash: encrypted.body.data.viewingKeyHash,
        },
      })
    expect(decrypted.status).toBe(200)
    expect(decrypted.body.data.sender).toBe('Alice')
    expect(decrypted.body.data.amount).toBe('1000')
  })

  it('rejects missing childPath', async () => {
    const masterRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })

    const res = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: masterRes.body.data })
    expect(res.status).toBe(400)
  })

  it('rejects empty childPath', async () => {
    const masterRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })

    const res = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: masterRes.body.data, childPath: '' })
    expect(res.status).toBe(400)
  })

  it('supports multi-level derivation', async () => {
    const masterRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })
    const master = masterRes.body.data

    // Derive first level
    const level1 = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: master, childPath: 'org' })

    // Derive second level from first
    const level2 = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: level1.body.data, childPath: '2026' })

    expect(level2.body.data.path).toBe('m/0/org/2026')
    expect(level2.body.data.key).toMatch(/^0x[0-9a-f]{64}$/)
  })
})

describe('POST /v1/viewing-key/verify-hierarchy', () => {
  it('verifies valid parent-child relationship', async () => {
    const masterRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })
    const master = masterRes.body.data

    const childRes = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: master, childPath: 'audit' })
    const child = childRes.body.data

    const res = await request(app)
      .post('/v1/viewing-key/verify-hierarchy')
      .send({
        parentKey: master,
        childKey: child,
        childPath: 'audit',
      })
    expect(res.status).toBe(200)
    expect(res.body.data.valid).toBe(true)
  })

  it('rejects invalid parent-child relationship', async () => {
    const master1Res = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })
    const master2Res = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/1' })

    // Derive child from master1
    const childRes = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: master1Res.body.data, childPath: 'audit' })

    // Verify against master2 — should fail
    const res = await request(app)
      .post('/v1/viewing-key/verify-hierarchy')
      .send({
        parentKey: master2Res.body.data,
        childKey: childRes.body.data,
        childPath: 'audit',
      })
    expect(res.status).toBe(200)
    expect(res.body.data.valid).toBe(false)
  })

  it('rejects wrong childPath', async () => {
    const masterRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })
    const master = masterRes.body.data

    const childRes = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: master, childPath: 'audit' })

    // Verify with wrong path
    const res = await request(app)
      .post('/v1/viewing-key/verify-hierarchy')
      .send({
        parentKey: master,
        childKey: childRes.body.data,
        childPath: 'accounting',
      })
    expect(res.status).toBe(200)
    expect(res.body.data.valid).toBe(false)
  })

  it('returns path information in response', async () => {
    const masterRes = await request(app)
      .post('/v1/viewing-key/generate')
      .send({ path: 'm/0' })
    const master = masterRes.body.data

    const childRes = await request(app)
      .post('/v1/viewing-key/derive')
      .send({ masterKey: master, childPath: 'audit' })

    const res = await request(app)
      .post('/v1/viewing-key/verify-hierarchy')
      .send({
        parentKey: master,
        childKey: childRes.body.data,
        childPath: 'audit',
      })
    expect(res.body.data.expectedPath).toBe('m/0/audit')
    expect(res.body.data.parentHash).toBe(master.hash)
  })
})
