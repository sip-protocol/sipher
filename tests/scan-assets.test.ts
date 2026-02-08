import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const mockGetParsedTokenAccountsByOwner = vi.fn().mockResolvedValue({ value: [] })

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(() => ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
      getSignaturesForAddress: vi.fn().mockResolvedValue([]),
      getParsedTokenAccountsByOwner: mockGetParsedTokenAccountsByOwner,
    })),
  }
})

vi.mock('../src/services/helius-provider.js', async () => {
  const actual = await vi.importActual('../src/services/helius-provider.js')
  return {
    ...actual as object,
    isHeliusConfigured: vi.fn().mockReturnValue(false),
    getAssetsByOwner: vi.fn().mockResolvedValue({ total: 0, limit: 100, page: 1, items: [] }),
  }
})

const { default: app } = await import('../src/server.js')

const VALID_ADDRESS = 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'

describe('POST /v1/scan/assets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetParsedTokenAccountsByOwner.mockResolvedValue({ value: [] })
  })

  it('returns empty assets when no tokens found (fallback provider)', async () => {
    const res = await request(app)
      .post('/v1/scan/assets')
      .send({ address: VALID_ADDRESS })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.assets).toEqual([])
    expect(res.body.data.provider).toBe('solana-rpc')
    expect(res.body.data.total).toBe(0)
  })

  it('returns token accounts from fallback provider', async () => {
    const mockPubkey = { toBase58: () => 'TokenAccount111111111111111111111111111111' }
    mockGetParsedTokenAccountsByOwner.mockResolvedValue({
      value: [
        {
          pubkey: mockPubkey,
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: { amount: '1000000', decimals: 6 },
                  owner: VALID_ADDRESS,
                  state: 'initialized',
                  delegate: null,
                },
              },
            },
          },
        },
      ],
    })

    const res = await request(app)
      .post('/v1/scan/assets')
      .send({ address: VALID_ADDRESS })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.assets).toHaveLength(1)
    expect(res.body.data.assets[0].token_info.balance).toBe(1000000)
    expect(res.body.data.assets[0].token_info.decimals).toBe(6)
    expect(res.body.data.assets[0].ownership.owner).toBe(VALID_ADDRESS)
    expect(res.body.data.assets[0].ownership.frozen).toBe(false)
    expect(res.body.data.provider).toBe('solana-rpc')
  })

  it('rejects invalid address', async () => {
    const res = await request(app)
      .post('/v1/scan/assets')
      .send({ address: 'not-a-valid-address' })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('rejects empty body', async () => {
    const res = await request(app)
      .post('/v1/scan/assets')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects missing address', async () => {
    const res = await request(app)
      .post('/v1/scan/assets')
      .send({ displayOptions: { showFungible: true } })

    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('accepts custom page and limit', async () => {
    const res = await request(app)
      .post('/v1/scan/assets')
      .send({ address: VALID_ADDRESS, page: 2, limit: 50 })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('accepts displayOptions', async () => {
    const res = await request(app)
      .post('/v1/scan/assets')
      .send({
        address: VALID_ADDRESS,
        displayOptions: { showFungible: true, showNativeBalance: true },
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('rejects limit exceeding 1000', async () => {
    const res = await request(app)
      .post('/v1/scan/assets')
      .send({ address: VALID_ADDRESS, limit: 1001 })

    expect(res.status).toBe(400)
  })

  it('rejects page of zero', async () => {
    const res = await request(app)
      .post('/v1/scan/assets')
      .send({ address: VALID_ADDRESS, page: 0 })

    expect(res.status).toBe(400)
  })

  it('detects frozen token accounts', async () => {
    const mockPubkey = { toBase58: () => 'FrozenToken111111111111111111111111111111' }
    mockGetParsedTokenAccountsByOwner.mockResolvedValue({
      value: [
        {
          pubkey: mockPubkey,
          account: {
            data: {
              parsed: {
                info: {
                  tokenAmount: { amount: '500', decimals: 0 },
                  owner: VALID_ADDRESS,
                  state: 'frozen',
                  delegate: 'SomeDelegate111111111111111111111111111',
                },
              },
            },
          },
        },
      ],
    })

    const res = await request(app)
      .post('/v1/scan/assets')
      .send({ address: VALID_ADDRESS })

    expect(res.status).toBe(200)
    expect(res.body.data.assets[0].ownership.frozen).toBe(true)
    expect(res.body.data.assets[0].ownership.delegated).toBe(true)
  })

  it('returns correct total count', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      pubkey: { toBase58: () => `Token${i}${'1'.repeat(35)}` },
      account: {
        data: {
          parsed: {
            info: {
              tokenAmount: { amount: `${(i + 1) * 100}`, decimals: 6 },
              owner: VALID_ADDRESS,
              state: 'initialized',
              delegate: null,
            },
          },
        },
      },
    }))
    mockGetParsedTokenAccountsByOwner.mockResolvedValue({ value: items })

    const res = await request(app)
      .post('/v1/scan/assets')
      .send({ address: VALID_ADDRESS })

    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(3)
    expect(res.body.data.assets).toHaveLength(3)
  })
})

describe('POST /v1/scan/assets (Helius DAS)', () => {
  it('uses Helius DAS when configured', async () => {
    const { isHeliusConfigured } = await import('../src/services/helius-provider.js')
    const mockIsConfigured = vi.mocked(isHeliusConfigured)
    mockIsConfigured.mockReturnValue(true)

    const { getAssetsByOwner } = await import('../src/services/helius-provider.js')
    const mockGetAssets = vi.mocked(getAssetsByOwner)
    mockGetAssets.mockResolvedValue({
      total: 1,
      limit: 100,
      page: 1,
      items: [
        {
          id: 'DAS-Asset-1',
          interface: 'FungibleToken',
          token_info: {
            balance: 5000000,
            decimals: 6,
            symbol: 'USDC',
          },
          ownership: {
            owner: VALID_ADDRESS,
            frozen: false,
            delegated: false,
          },
        },
      ],
    })

    const res = await request(app)
      .post('/v1/scan/assets')
      .send({ address: VALID_ADDRESS })

    expect(res.status).toBe(200)
    expect(res.body.data.provider).toBe('helius-das')
    expect(res.body.data.assets).toHaveLength(1)
    expect(res.body.data.assets[0].id).toBe('DAS-Asset-1')

    mockIsConfigured.mockReturnValue(false)
  })
})
