import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getReadClient, getWriteClient, getHeraldUserId } from '../../src/herald/x-client.js'

describe('X API Client Wrapper', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getReadClient', () => {
    it('creates read-only client with Bearer token', () => {
      process.env.X_BEARER_TOKEN = 'test-bearer-token'
      const client = getReadClient()
      expect(client).toBeDefined()
      expect(typeof client.v2).toBe('object')
    })

    it('throws when Bearer token missing', () => {
      delete process.env.X_BEARER_TOKEN
      expect(() => getReadClient()).toThrow('X_BEARER_TOKEN is required for HERALD read operations')
    })
  })

  describe('getWriteClient', () => {
    it('creates read-write client with OAuth 1.0a', () => {
      process.env.X_CONSUMER_KEY = 'test-consumer-key'
      process.env.X_CONSUMER_SECRET = 'test-consumer-secret'
      process.env.X_ACCESS_TOKEN = 'test-access-token'
      process.env.X_ACCESS_SECRET = 'test-access-secret'
      const client = getWriteClient()
      expect(client).toBeDefined()
      expect(typeof client.v2).toBe('object')
    })

    it('throws when OAuth credentials missing', () => {
      delete process.env.X_CONSUMER_KEY
      process.env.X_CONSUMER_SECRET = 'test-consumer-secret'
      process.env.X_ACCESS_TOKEN = 'test-access-token'
      process.env.X_ACCESS_SECRET = 'test-access-secret'
      expect(() => getWriteClient()).toThrow(
        'X OAuth 1.0a credentials required: X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET'
      )
    })
  })

  describe('getHeraldUserId', () => {
    it('returns HERALD_X_USER_ID from env', () => {
      process.env.HERALD_X_USER_ID = '1234567890'
      const userId = getHeraldUserId()
      expect(userId).toBe('1234567890')
    })

    it('throws when HERALD_X_USER_ID missing', () => {
      delete process.env.HERALD_X_USER_ID
      expect(() => getHeraldUserId()).toThrow('HERALD_X_USER_ID is required')
    })
  })
})
