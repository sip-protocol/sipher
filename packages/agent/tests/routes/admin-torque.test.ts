import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import supertest from 'supertest'

// Fixture variable read by the mock — tests override before each request
let mockPingReturn: { ok: true } | { ok: false; reason: 'auth' | 'network' | 'unknown'; message: string } = {
  ok: true,
}

vi.mock('../../src/integrations/torque/mcp-client.js', () => ({
  TorqueMCPClient: vi.fn().mockImplementation(function () { return ({
    pingIngester: vi.fn().mockImplementation(() => Promise.resolve(mockPingReturn)),
  }) }),
}))

vi.mock('../../src/config/network.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config/network.js')>()
  return {
    ...actual,
    loadNetworkConfig: vi.fn().mockReturnValue({
      network: 'devnet',
      clusterName: 'devnet',
      rpcUrl: 'https://devnet.helius-rpc.com/?api-key=test',
      publicRpcUrl: 'https://api.devnet.solana.com',
      programIds: {
        sipherVault: 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB',
        sipPrivacy: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
      },
      vaultConfig: 'CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u',
      beta: true,
      solscanSuffix: '?cluster=devnet',
    }),
  }
})

const { adminRouter } = await import('../../src/routes/admin.js')

function createApp() {
  const app = express()
  app.use('/admin', adminRouter)
  return app
}

describe('GET /admin/api/torque/status', () => {
  beforeEach(() => {
    delete process.env.TORQUE_GROWTH_ENABLED
    delete process.env.TORQUE_API_TOKEN
    delete process.env.TORQUE_INGESTER_URL
    // Reset fixture to reachable for each test
    mockPingReturn = { ok: true }
  })

  afterEach(() => {
    delete process.env.TORQUE_GROWTH_ENABLED
    delete process.env.TORQUE_API_TOKEN
    delete process.env.TORQUE_INGESTER_URL
  })

  it('returns enabled=false when TORQUE_GROWTH_ENABLED is unset', async () => {
    const res = await supertest(createApp()).get('/admin/api/torque/status')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, enabled: false })
    expect(res.body.reason).toMatch(/TORQUE_GROWTH_ENABLED/)
  })

  it('returns ingesterReachable=true when ingester is reachable', async () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_TOKEN = 'tk_test_token'
    process.env.TORQUE_INGESTER_URL = 'https://torque.test'

    mockPingReturn = { ok: true }

    const res = await supertest(createApp()).get('/admin/api/torque/status')
    expect(res.status).toBe(200)
    expect(res.body).toStrictEqual({
      ok: true,
      enabled: true,
      network: 'devnet',
      ingesterUrl: 'https://torque.test',
      ingesterReachable: true,
    })
    // ingesterReason must not appear in the JSON when reachable
    expect(Object.prototype.hasOwnProperty.call(res.body, 'ingesterReason')).toBe(false)
  })

  it('returns ingesterReachable=false with reason=network when ingester is unreachable', async () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_TOKEN = 'tk_test_token'
    process.env.TORQUE_INGESTER_URL = 'https://torque.test'

    mockPingReturn = { ok: false, reason: 'network', message: 'connection refused' }

    const res = await supertest(createApp()).get('/admin/api/torque/status')
    expect(res.status).toBe(200)
    expect(res.body).toStrictEqual({
      ok: true,
      enabled: true,
      network: 'devnet',
      ingesterUrl: 'https://torque.test',
      ingesterReachable: false,
      ingesterReason: 'network',
    })
  })

  it('returns ingesterReachable=false with reason=auth when api token is rejected', async () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_TOKEN = 'tk_test_token'
    process.env.TORQUE_INGESTER_URL = 'https://torque.test'

    mockPingReturn = { ok: false, reason: 'auth', message: 'Torque rejected api token (401)' }

    const res = await supertest(createApp()).get('/admin/api/torque/status')
    expect(res.status).toBe(200)
    expect(res.body).toStrictEqual({
      ok: true,
      enabled: true,
      network: 'devnet',
      ingesterUrl: 'https://torque.test',
      ingesterReachable: false,
      ingesterReason: 'auth',
    })
  })
})
