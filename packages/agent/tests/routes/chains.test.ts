import { describe, expect, it } from 'vitest'
import express from 'express'
import supertest from 'supertest'
import { chainsRouter } from '../../src/routes/chains.js'

function createApp() {
  const app = express()
  app.use('/api/chains', chainsRouter)
  return app
}

describe('GET /api/chains', () => {
  it('returns the full chain registry', async () => {
    const res = await supertest(createApp()).get('/api/chains')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.chains)).toBe(true)
    expect(res.body.chains.length).toBeGreaterThan(0)
  })

  it('each chain row carries chainId / network / programId / status', async () => {
    const res = await supertest(createApp()).get('/api/chains')
    const first = res.body.chains[0]
    expect(first).toHaveProperty('chainId')
    expect(first).toHaveProperty('network')
    expect(first).toHaveProperty('programId')
    expect(first).toHaveProperty('status')
    expect(['live', 'pending']).toContain(first.status)
  })

  it('includes Solana mainnet vault deployment as a live row', async () => {
    const res = await supertest(createApp()).get('/api/chains')
    const mainnet = res.body.chains.find((c: { chainId: string }) => c.chainId === 'solana-mainnet')
    expect(mainnet).toBeDefined()
    expect(mainnet.status).toBe('live')
    expect(mainnet.programId).toBe('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at')
  })

  it('does not require authentication (public endpoint)', async () => {
    const res = await supertest(createApp()).get('/api/chains')
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})

describe('GET /api/chains/aggregate', () => {
  it('returns sum TVL across chains plus chainCount + liveChainCount + asOf', async () => {
    const res = await supertest(createApp()).get('/api/chains/aggregate')
    expect(res.status).toBe(200)
    expect(typeof res.body.totalTvlSol).toBe('number')
    expect(typeof res.body.chainCount).toBe('number')
    expect(res.body.chainCount).toBeGreaterThan(0)
    expect(typeof res.body.liveChainCount).toBe('number')
    expect(res.body.liveChainCount).toBeGreaterThanOrEqual(0)
    expect(res.body.liveChainCount).toBeLessThanOrEqual(res.body.chainCount)
    expect(typeof res.body.asOf).toBe('string')
    expect(() => new Date(res.body.asOf)).not.toThrow()
  })

  it('does not require authentication (public endpoint)', async () => {
    const res = await supertest(createApp()).get('/api/chains/aggregate')
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
  })
})
