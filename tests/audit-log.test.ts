import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { sanitizeBody } from '../src/middleware/audit-log.js'

vi.mock('@solana/web3.js', async () => {
  const actual = await vi.importActual('@solana/web3.js')
  return {
    ...actual as object,
    Connection: vi.fn().mockImplementation(function () { return ({
      getSlot: vi.fn().mockResolvedValue(300000000),
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    }) }),
  }
})

const { default: app } = await import('../src/server.js')

describe('Audit logging', () => {
  describe('sanitizeBody', () => {
    it('redacts sensitive keys', () => {
      const body = {
        sender: 'SomeAddress123',
        spendingPrivateKey: '0xdeadbeef1234567890',
        viewingPrivateKey: '0xcafe1234567890',
        amount: '1000000000',
      }

      const sanitized = sanitizeBody(body) as Record<string, unknown>
      expect(sanitized.sender).toBe('SomeAddress123')
      expect(sanitized.spendingPrivateKey).toBe('[REDACTED]')
      expect(sanitized.viewingPrivateKey).toBe('[REDACTED]')
      expect(sanitized.amount).toBe('1000000000')
    })

    it('redacts nested sensitive keys', () => {
      const body = {
        viewingKey: {
          key: '0xsecretkey123',
          path: 'm/0',
          hash: '0xhash123',
        },
        transactionData: {
          sender: 'Alice',
          recipient: 'Bob',
        },
      }

      const sanitized = sanitizeBody(body) as Record<string, unknown>
      const vk = (sanitized as any).viewingKey
      expect(vk.key).toBe('[REDACTED]')
      expect(vk.path).toBe('m/0')
      expect(vk.hash).toBe('0xhash123') // hash is public info, not redacted
    })

    it('handles null and primitives', () => {
      expect(sanitizeBody(null)).toBe(null)
      expect(sanitizeBody(undefined)).toBe(undefined)
      expect(sanitizeBody('string')).toBe('string')
      expect(sanitizeBody(42)).toBe(42)
    })

    it('handles arrays', () => {
      const body = [
        { spendingPrivateKey: '0xsecret', amount: '100' },
        { viewingPrivateKey: '0xsecret2', sender: 'Alice' },
      ]

      const sanitized = sanitizeBody(body) as any[]
      expect(sanitized[0].spendingPrivateKey).toBe('[REDACTED]')
      expect(sanitized[0].amount).toBe('100')
      expect(sanitized[1].viewingPrivateKey).toBe('[REDACTED]')
      expect(sanitized[1].sender).toBe('Alice')
    })

    it('does not redact non-sensitive keys', () => {
      const body = {
        sender: 'SomeAddress',
        recipient: 'AnotherAddress',
        amount: '500',
        chain: 'solana',
      }

      const sanitized = sanitizeBody(body) as Record<string, unknown>
      expect(sanitized.sender).toBe('SomeAddress')
      expect(sanitized.recipient).toBe('AnotherAddress')
      expect(sanitized.amount).toBe('500')
      expect(sanitized.chain).toBe('solana')
    })

    it('redacts blindingFactor and variants', () => {
      const body = {
        blindingFactor: '0xblinding123',
        blindingA: '0xblindA',
        blindingB: '0xblindB',
        commitment: '0xcommitment',
      }

      const sanitized = sanitizeBody(body) as Record<string, unknown>
      expect(sanitized.blindingFactor).toBe('[REDACTED]')
      expect(sanitized.blindingA).toBe('[REDACTED]')
      expect(sanitized.blindingB).toBe('[REDACTED]')
      expect(sanitized.commitment).toBe('0xcommitment')
    })
  })

  describe('audit middleware integration', () => {
    it('audit log runs on requests without error', async () => {
      const res = await request(app).get('/v1/health')
      expect(res.status).toBe(200)
    })

    it('audit log runs on POST requests', async () => {
      const res = await request(app)
        .post('/v1/stealth/generate')
        .send({})
      expect(res.status).toBe(200)
    })
  })
})
