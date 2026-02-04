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

describe('OpenAPI specification', () => {
  it('GET /v1/openapi.json returns valid JSON spec', async () => {
    const res = await request(app).get('/v1/openapi.json')
    expect(res.status).toBe(200)
    expect(res.body.openapi).toBe('3.1.0')
    expect(res.body.info.title).toContain('Sipher')
    expect(res.body.info.version).toBe('0.1.0')
  })

  it('spec contains all API paths', async () => {
    const res = await request(app).get('/v1/openapi.json')
    const paths = Object.keys(res.body.paths)

    const expectedPaths = [
      '/v1/health',
      '/v1/ready',
      '/v1/errors',
      '/v1/stealth/generate',
      '/v1/stealth/derive',
      '/v1/stealth/check',
      '/v1/stealth/generate/batch',
      '/v1/transfer/shield',
      '/v1/transfer/claim',
      '/v1/scan/payments',
      '/v1/scan/payments/batch',
      '/v1/commitment/create',
      '/v1/commitment/verify',
      '/v1/commitment/add',
      '/v1/commitment/subtract',
      '/v1/commitment/create/batch',
      '/v1/viewing-key/generate',
      '/v1/viewing-key/derive',
      '/v1/viewing-key/verify-hierarchy',
      '/v1/viewing-key/disclose',
      '/v1/viewing-key/decrypt',
      '/v1/privacy/score',
      '/v1/rpc/providers',
    ]

    for (const path of expectedPaths) {
      expect(paths).toContain(path)
    }
  })

  it('spec has security scheme defined', async () => {
    const res = await request(app).get('/v1/openapi.json')
    expect(res.body.components.securitySchemes.ApiKeyAuth).toBeDefined()
    expect(res.body.components.securitySchemes.ApiKeyAuth.type).toBe('apiKey')
  })

  it('health endpoints do not require auth', async () => {
    const res = await request(app).get('/v1/openapi.json')
    const healthGet = res.body.paths['/v1/health'].get
    expect(healthGet.security).toEqual([])
  })

  it('spec has tags for all endpoint groups', async () => {
    const res = await request(app).get('/v1/openapi.json')
    const tagNames = res.body.tags.map((t: any) => t.name)
    expect(tagNames).toContain('Health')
    expect(tagNames).toContain('Stealth')
    expect(tagNames).toContain('Transfer')
    expect(tagNames).toContain('Scan')
    expect(tagNames).toContain('Commitment')
    expect(tagNames).toContain('Viewing Key')
  })
})

describe('Swagger UI', () => {
  it('GET /docs returns HTML', async () => {
    const res = await request(app).get('/docs/')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
  })
})
