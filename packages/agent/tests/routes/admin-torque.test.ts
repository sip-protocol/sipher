import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import express from 'express'
import supertest from 'supertest'

// Fixture variable read by the mock — tests override before each request
let mockCampaignReturn: object | null = {
  id: 'camp_devnet_1',
  name: 'Sipher Private Action Rebate',
  status: 'ACTIVE',
  remainingPool: 4.95,
  rewardAmountPerEvent: 0.005,
  rewardToken: 'SOL',
}

vi.mock('../../src/integrations/torque/mcp-client.js', () => ({
  TorqueMCPClient: vi.fn().mockImplementation(() => ({
    getCampaign: vi.fn().mockImplementation(() => Promise.resolve(mockCampaignReturn)),
  })),
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
    delete process.env.TORQUE_API_KEY
    delete process.env.TORQUE_MCP_URL
    delete process.env.TORQUE_CAMPAIGN_ID_DEVNET
    delete process.env.TORQUE_CAMPAIGN_ID_MAINNET
    // Reset fixture to default ACTIVE campaign for each test
    mockCampaignReturn = {
      id: 'camp_devnet_1',
      name: 'Sipher Private Action Rebate',
      status: 'ACTIVE',
      remainingPool: 4.95,
      rewardAmountPerEvent: 0.005,
      rewardToken: 'SOL',
    }
  })

  afterEach(() => {
    delete process.env.TORQUE_GROWTH_ENABLED
    delete process.env.TORQUE_API_KEY
    delete process.env.TORQUE_MCP_URL
    delete process.env.TORQUE_CAMPAIGN_ID_DEVNET
    delete process.env.TORQUE_CAMPAIGN_ID_MAINNET
  })

  it('returns enabled=false when TORQUE_GROWTH_ENABLED is unset', async () => {
    const res = await supertest(createApp()).get('/admin/api/torque/status')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, enabled: false })
    expect(res.body.reason).toMatch(/TORQUE_GROWTH_ENABLED/)
  })

  it('returns campaign metadata when env enables Torque', async () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_KEY = 'tk_test_key'
    process.env.TORQUE_MCP_URL = 'https://torque.test'
    process.env.TORQUE_CAMPAIGN_ID_DEVNET = 'camp_devnet_1'
    process.env.TORQUE_CAMPAIGN_ID_MAINNET = 'camp_main_1'

    const res = await supertest(createApp()).get('/admin/api/torque/status')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      enabled: true,
      network: 'devnet',
      campaignId: 'camp_devnet_1',
      campaignFetchOk: true,
      campaign: {
        id: 'camp_devnet_1',
        name: 'Sipher Private Action Rebate',
        status: 'ACTIVE',
      },
    })
  })

  it('returns campaignFetchOk=false when getCampaign returns null', async () => {
    process.env.TORQUE_GROWTH_ENABLED = 'true'
    process.env.TORQUE_API_KEY = 'tk_test_key'
    process.env.TORQUE_MCP_URL = 'https://torque.test'
    process.env.TORQUE_CAMPAIGN_ID_DEVNET = 'camp_devnet_1'
    process.env.TORQUE_CAMPAIGN_ID_MAINNET = 'camp_main_1'

    // Simulate Torque unreachable or wrong campaign ID
    mockCampaignReturn = null

    const res = await supertest(createApp()).get('/admin/api/torque/status')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      enabled: true,
      network: 'devnet',
      campaignId: 'camp_devnet_1',
      campaignFetchOk: false,
      campaign: null,
    })
  })
})
