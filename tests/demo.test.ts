import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    })),
  }
})

const { default: app } = await import('../src/server.js')

describe('Demo endpoint', () => {
  it('GET /v1/demo returns 200 with demo data', async () => {
    const res = await request(app).get('/v1/demo')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toBeDefined()
    expect(res.body.data.title).toBe('Sipher Live Privacy Demo')
  }, 15000)

  it('GET /v1/demo returns all 25 steps', async () => {
    const res = await request(app).get('/v1/demo')
    expect(res.body.data.steps).toHaveLength(25)
    expect(res.body.data.summary.stepsCompleted).toBe(25)
  }, 15000)

  it('GET /v1/demo all steps pass', async () => {
    const res = await request(app).get('/v1/demo')
    expect(res.body.data.summary.allPassed).toBe(true)
    for (const step of res.body.data.steps) {
      expect(step.passed).toBe(true)
    }
  }, 15000)

  it('GET /v1/demo includes program metadata', async () => {
    const res = await request(app).get('/v1/demo')
    expect(res.body.data.program.id).toBe('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at')
    expect(res.body.data.program.network).toBe('mainnet-beta')
    expect(res.body.data.program.configPDA).toBeDefined()
  }, 15000)

  it('GET /v1/demo includes crypto summary', async () => {
    const res = await request(app).get('/v1/demo')
    const { summary } = res.body.data
    expect(summary.endpointsExercised).toBeGreaterThan(20)
    expect(summary.cryptoOperations).toBeGreaterThan(20)
    expect(summary.chainsDemo).toContain('solana')
    expect(summary.chainsDemo).toContain('ethereum')
    expect(summary.chainsDemo).toContain('near')
    expect(summary.chainsDemo).toContain('cosmos')
    expect(summary.realCrypto.length).toBeGreaterThan(5)
  }, 15000)

  it('GET /v1/demo exercises real stealth crypto', async () => {
    const res = await request(app).get('/v1/demo')
    const stealthSteps = res.body.data.steps.filter((s: any) => s.category === 'stealth')
    expect(stealthSteps.length).toBeGreaterThanOrEqual(5)
    // Step 1 should be Solana stealth
    const step1 = res.body.data.steps[0]
    expect(step1.name).toContain('Solana')
    expect(step1.result.curve).toBe('ed25519')
    // Step 2 should be Ethereum stealth
    const step2 = res.body.data.steps[1]
    expect(step2.name).toContain('Ethereum')
    expect(step2.result.curve).toBe('secp256k1')
  }, 15000)

  it('GET /v1/demo exercises homomorphic commitments', async () => {
    const res = await request(app).get('/v1/demo')
    const commitSteps = res.body.data.steps.filter((s: any) => s.category === 'commitment')
    expect(commitSteps.length).toBeGreaterThanOrEqual(4)
    // Verify subtraction step proves round-trip
    const subStep = commitSteps.find((s: any) => s.name.includes('Subtraction'))
    expect(subStep).toBeDefined()
    expect(subStep.result.verifiedEqualsOneSol).toBe(true)
  }, 15000)

  it('GET /v1/demo exercises viewing keys with encrypt/decrypt', async () => {
    const res = await request(app).get('/v1/demo')
    const vkSteps = res.body.data.steps.filter((s: any) => s.category === 'viewing-key')
    expect(vkSteps.length).toBeGreaterThanOrEqual(4)
    // Decrypt step should show round-trip
    const decryptStep = vkSteps.find((s: any) => s.name.includes('Decrypt'))
    expect(decryptStep).toBeDefined()
    expect(decryptStep.passed).toBe(true)
  }, 15000)

  it('GET /v1/demo exercises governance voting', async () => {
    const res = await request(app).get('/v1/demo')
    const govSteps = res.body.data.steps.filter((s: any) => s.category === 'governance')
    expect(govSteps.length).toBeGreaterThanOrEqual(2)
    const tallyStep = govSteps.find((s: any) => s.name.includes('Tally'))
    expect(tallyStep).toBeDefined()
    expect(tallyStep.result.tallyVerified).toBe(true)
  }, 15000)

  it('GET /v1/demo requires no authentication', async () => {
    const res = await request(app).get('/v1/demo')
    // Should not get 401 even without API key
    expect(res.status).not.toBe(401)
    expect(res.status).toBe(200)
  }, 15000)

  it('GET /v1/demo completes within 10 seconds', async () => {
    const res = await request(app).get('/v1/demo')
    expect(res.body.data.durationMs).toBeLessThan(10000)
  }, 15000)
})

describe('Markdown demo endpoint', () => {
  it('GET /demo returns markdown', async () => {
    const res = await request(app).get('/demo')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/markdown/)
    expect(res.text).toContain('Sipher Live Privacy Demo')
  }, 15000)
})
