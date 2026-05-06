import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import { configRouter } from '../../src/routes/config.js'

describe('GET /api/config', () => {
  let app: express.Express
  let originalEnv: NodeJS.ProcessEnv

  beforeAll(() => {
    originalEnv = { ...process.env }
    process.env.SIPHER_NETWORK = 'devnet'
    process.env.SIPHER_HELIUS_API_KEY = 'test-key-DO-NOT-LEAK-THIS'
    app = express()
    app.use('/api/config', configRouter)
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns network metadata without RPC URL or API key', async () => {
    const res = await supertest(app).get('/api/config')
    expect(res.status).toBe(200)
    expect(res.body.network).toBe('devnet')
    expect(res.body.clusterName).toBe('devnet')
    expect(res.body.beta).toBe(true)
    expect(res.body.solscanSuffix).toBe('?cluster=devnet')
    expect(res.body.publicRpcUrl).toBe('https://api.devnet.solana.com')
    expect(res.body.programIds).toEqual({
      sipherVault: 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB',
      sipPrivacy: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
    })
    expect(res.body.vaultConfig).toBe('CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u')
  })

  it('CRITICAL: response NEVER contains the keyed RPC URL or API key', async () => {
    const res = await supertest(app).get('/api/config')
    const bodyStr = JSON.stringify(res.body)
    expect(bodyStr).not.toContain('test-key-DO-NOT-LEAK-THIS')
    expect(bodyStr).not.toContain('helius-rpc.com')
    expect(bodyStr).not.toMatch(/api-key/i)
    expect(res.body).not.toHaveProperty('rpcUrl')
  })
})
