import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation((url: string) => ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: url,
    })),
  }
})

const { default: app } = await import('../src/server.js')

describe('RPC Provider', () => {
  describe('GET /v1/rpc/providers', () => {
    it('returns active provider info and supported list', async () => {
      const res = await request(app).get('/v1/rpc/providers')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.active).toBeDefined()
      expect(res.body.data.active.provider).toBe('generic')
      expect(res.body.data.active.connected).toBe(true)
      expect(res.body.data.supported).toBeInstanceOf(Array)
      expect(res.body.data.supported.length).toBe(4)
    })

    it('lists all 4 supported providers', async () => {
      const res = await request(app).get('/v1/rpc/providers')
      const names = res.body.data.supported.map((p: any) => p.name)
      expect(names).toContain('generic')
      expect(names).toContain('helius')
      expect(names).toContain('quicknode')
      expect(names).toContain('triton')
    })

    it('includes configuration guidance', async () => {
      const res = await request(app).get('/v1/rpc/providers')
      expect(res.body.data.configuration).toBeDefined()
      expect(res.body.data.configuration.env).toContain('RPC_PROVIDER')
      expect(res.body.data.configuration.env).toContain('SOLANA_RPC_URL')
      expect(res.body.data.configuration.env).toContain('RPC_PROVIDER_API_KEY')
    })

    it('active provider includes cluster and latency', async () => {
      const res = await request(app).get('/v1/rpc/providers')
      expect(res.body.data.active.cluster).toBeDefined()
      expect(typeof res.body.data.active.latencyMs).toBe('number')
    })
  })
})

describe('RPC Provider Factory', () => {
  let createProviderConnection: any
  let resolveProviderType: any

  beforeEach(async () => {
    const mod = await import('../src/services/rpc-provider.js')
    createProviderConnection = mod.createProviderConnection
    resolveProviderType = mod.resolveProviderType
  })

  it('resolves valid provider types', () => {
    expect(resolveProviderType('helius')).toBe('helius')
    expect(resolveProviderType('quicknode')).toBe('quicknode')
    expect(resolveProviderType('triton')).toBe('triton')
    expect(resolveProviderType('generic')).toBe('generic')
  })

  it('falls back to generic for unknown providers', () => {
    expect(resolveProviderType('unknown')).toBe('generic')
    expect(resolveProviderType('')).toBe('generic')
    expect(resolveProviderType('alchemy')).toBe('generic')
  })

  it('creates generic provider with RPC URL', () => {
    const result = createProviderConnection({
      provider: 'generic' as const,
      rpcUrl: 'https://api.mainnet-beta.solana.com',
    })
    expect(result.connection).toBeDefined()
    expect(result.info.provider).toBe('generic')
  })

  it('creates helius provider with API key', () => {
    const result = createProviderConnection({
      provider: 'helius' as const,
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      apiKey: 'test-helius-key-12345',
    })
    expect(result.info.provider).toBe('helius')
    expect(result.info.endpoint).toContain('helius-rpc.com')
    expect(result.info.endpoint).not.toContain('test-helius-key-12345')
    expect(result.info.endpoint).toContain('test...')
  })

  it('creates helius devnet provider when URL contains devnet', () => {
    const result = createProviderConnection({
      provider: 'helius' as const,
      rpcUrl: 'https://api.devnet.solana.com',
      apiKey: 'test-helius-key-12345',
    })
    expect(result.info.endpoint).toContain('devnet.helius-rpc.com')
  })

  it('creates quicknode provider with API key', () => {
    const result = createProviderConnection({
      provider: 'quicknode' as const,
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      apiKey: 'my-quicknode-endpoint-hash',
    })
    expect(result.info.provider).toBe('quicknode')
    expect(result.info.endpoint).toContain('quiknode.pro')
  })

  it('creates triton provider with API key', () => {
    const result = createProviderConnection({
      provider: 'triton' as const,
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      apiKey: 'my-triton-endpoint-hash',
    })
    expect(result.info.provider).toBe('triton')
    expect(result.info.endpoint).toContain('triton.one')
  })

  it('masks API keys in endpoint URLs', () => {
    const result = createProviderConnection({
      provider: 'helius' as const,
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      apiKey: 'abcdefghijklmnop',
    })
    expect(result.info.endpoint).not.toContain('abcdefghijklmnop')
    expect(result.info.endpoint).toContain('abcd...')
  })

  it('uses raw URL when no API key provided for helius', () => {
    const result = createProviderConnection({
      provider: 'helius' as const,
      rpcUrl: 'https://custom-helius-endpoint.com',
    })
    expect(result.info.endpoint).toContain('custom-helius-endpoint.com')
  })
})

describe('Health check includes provider', () => {
  it('health response includes provider field', async () => {
    const res = await request(app).get('/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.data.solana.provider).toBe('generic')
  })
})
