import { describe, expect, it } from 'vitest'
import express, { type Request, type Response, type NextFunction } from 'express'
import supertest from 'supertest'
import { stealthIndexRouter } from '../../src/routes/stealth-index.js'

const TEST_WALLET = 'C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N'

function mockAuth(wallet: string | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (wallet) {
      ;(req as unknown as { wallet: string }).wallet = wallet
    }
    next()
  }
}

function createApp(wallet: string | null = TEST_WALLET) {
  const app = express()
  app.use('/api/stealth', mockAuth(wallet), stealthIndexRouter)
  return app
}

describe('GET /api/stealth/index', () => {
  it('returns a stub tree containing the caller wallet as the root node', async () => {
    const res = await supertest(createApp()).get('/api/stealth/index')
    expect(res.status).toBe(200)
    expect(res.body.rootWallet).toBe(TEST_WALLET)
    expect(Array.isArray(res.body.tree)).toBe(true)
    expect(res.body.tree).toHaveLength(1)

    const root = res.body.tree[0]
    expect(root.index).toBe(0)
    expect(root.parentIndex).toBeNull()
    expect(root.stealthAddress).toBe(TEST_WALLET)
    expect(root.derivationPath).toBe("m/0'")
    expect(typeof root.createdAt).toBe('string')
    expect(() => new Date(root.createdAt)).not.toThrow()
  })

  it('returns a 500 INTERNAL error if upstream auth did not attach req.wallet', async () => {
    const res = await supertest(createApp(null)).get('/api/stealth/index')
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL')
    expect(res.body.error.message).toMatch(/wallet/)
  })

  it('does not leak any wallet other than the authenticated caller', async () => {
    const otherWallet = 'OtherWallet111111111111111111111111111111111'
    const res = await supertest(createApp(otherWallet)).get('/api/stealth/index')
    expect(res.body.rootWallet).toBe(otherWallet)
    expect(res.body.tree[0].stealthAddress).toBe(otherWallet)
    const bodyStr = JSON.stringify(res.body)
    expect(bodyStr).not.toContain(TEST_WALLET)
  })
})
