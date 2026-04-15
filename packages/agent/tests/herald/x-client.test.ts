import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// x-client.ts memoizes the TwitterApi instances at module scope, so once
// a "has env" test constructs one, subsequent "missing env" tests would
// otherwise receive the cached client and never hit the throw branch.
// Reset the module graph before every test so each assertion re-runs the
// env check from a fresh module load.

describe('X API Client Wrapper', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getReadClient', () => {
    it('creates read-only client with Bearer token', async () => {
      process.env.X_BEARER_TOKEN = 'test-bearer-token'
      const { getReadClient } = await import('../../src/herald/x-client.js')
      const client = getReadClient()
      expect(client).toBeDefined()
      expect(typeof client.v2).toBe('object')
    })

    it('throws when Bearer token missing', async () => {
      delete process.env.X_BEARER_TOKEN
      const { getReadClient } = await import('../../src/herald/x-client.js')
      expect(() => getReadClient()).toThrow('X_BEARER_TOKEN is required for HERALD read operations')
    })
  })

  describe('getWriteClient', () => {
    it('creates read-write client with OAuth 1.0a', async () => {
      process.env.X_CONSUMER_KEY = 'test-consumer-key'
      process.env.X_CONSUMER_SECRET = 'test-consumer-secret'
      process.env.X_ACCESS_TOKEN = 'test-access-token'
      process.env.X_ACCESS_SECRET = 'test-access-secret'
      const { getWriteClient } = await import('../../src/herald/x-client.js')
      const client = getWriteClient()
      expect(client).toBeDefined()
      expect(typeof client.v2).toBe('object')
    })

    it('throws when OAuth credentials missing', async () => {
      delete process.env.X_CONSUMER_KEY
      process.env.X_CONSUMER_SECRET = 'test-consumer-secret'
      process.env.X_ACCESS_TOKEN = 'test-access-token'
      process.env.X_ACCESS_SECRET = 'test-access-secret'
      const { getWriteClient } = await import('../../src/herald/x-client.js')
      expect(() => getWriteClient()).toThrow(
        'X OAuth 1.0a credentials required: X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET'
      )
    })
  })

  describe('getHeraldUserId', () => {
    it('returns HERALD_X_USER_ID from env', async () => {
      process.env.HERALD_X_USER_ID = '1234567890'
      const { getHeraldUserId } = await import('../../src/herald/x-client.js')
      const userId = getHeraldUserId()
      expect(userId).toBe('1234567890')
    })

    it('throws when HERALD_X_USER_ID missing', async () => {
      delete process.env.HERALD_X_USER_ID
      const { getHeraldUserId } = await import('../../src/herald/x-client.js')
      expect(() => getHeraldUserId()).toThrow('HERALD_X_USER_ID is required')
    })
  })
})
