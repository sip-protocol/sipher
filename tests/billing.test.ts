import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction, Router } from 'express'
import { resetUsageProvider, trackUsage, getUsage, checkQuota, getDailyUsage } from '../src/services/usage-provider.js'
import { resetStripeProvider, computeWebhookSignature } from '../src/services/stripe-provider.js'
import { classifyPath } from '../src/middleware/metering.js'

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

// ─── Usage Tracking ─────────────────────────────────────────────────────────

describe('Usage tracking', () => {
  beforeEach(() => {
    resetUsageProvider()
  })

  it('tracks operations and returns count', async () => {
    await trackUsage('test-key-1', 'stealth')
    await trackUsage('test-key-1', 'stealth')
    await trackUsage('test-key-1', 'stealth')

    const usage = await getUsage('test-key-1', 'stealth')
    expect(usage.count).toBe(3)
    expect(usage.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('tracks different categories independently', async () => {
    await trackUsage('test-key-2', 'stealth')
    await trackUsage('test-key-2', 'commitment')
    await trackUsage('test-key-2', 'commitment')

    const stealth = await getUsage('test-key-2', 'stealth')
    const commitment = await getUsage('test-key-2', 'commitment')
    expect(stealth.count).toBe(1)
    expect(commitment.count).toBe(2)
  })

  it('returns zero for unused categories', async () => {
    const usage = await getUsage('unused-key', 'transfer')
    expect(usage.count).toBe(0)
  })

  it('getDailyUsage returns full breakdown', async () => {
    await trackUsage('test-key-3', 'stealth')
    await trackUsage('test-key-3', 'commitment')

    const daily = await getDailyUsage('test-key-3', 'pro')
    expect(daily.total).toBe(2)
    expect(daily.tier).toBe('pro')
    expect(daily.quotaTotal).toBe(10_000)
    expect(daily.categories.stealth.count).toBe(1)
    expect(daily.categories.commitment.count).toBe(1)
    expect(daily.categories.transfer.count).toBe(0)
  })

  it('isolates usage between API keys', async () => {
    await trackUsage('key-a', 'stealth')
    await trackUsage('key-b', 'stealth')
    await trackUsage('key-b', 'stealth')

    const a = await getUsage('key-a', 'stealth')
    const b = await getUsage('key-b', 'stealth')
    expect(a.count).toBe(1)
    expect(b.count).toBe(2)
  })
})

// ─── Daily Quotas ───────────────────────────────────────────────────────────

describe('Daily quotas', () => {
  beforeEach(() => {
    resetUsageProvider()
  })

  it('allows requests within quota', async () => {
    const result = await checkQuota('quota-key', 'stealth', 'pro')
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(10_000)
    expect(result.current).toBe(0)
  })

  it('blocks when total daily quota exceeded', async () => {
    // Exhaust free tier total (100)
    for (let i = 0; i < 100; i++) {
      await trackUsage('quota-free', 'stealth')
    }

    const result = await checkQuota('quota-free', 'stealth', 'free')
    expect(result.allowed).toBe(false)
    expect(result.current).toBe(100)
    expect(result.limit).toBe(100)
    expect(result.resetAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('blocks when per-category quota exceeded', async () => {
    // Exhaust free tier per-category (50)
    for (let i = 0; i < 50; i++) {
      await trackUsage('quota-cat', 'commitment')
    }

    const result = await checkQuota('quota-cat', 'commitment', 'free')
    expect(result.allowed).toBe(false)
  })

  it('enterprise tier has higher limits', async () => {
    for (let i = 0; i < 100; i++) {
      await trackUsage('quota-ent', 'stealth')
    }

    const result = await checkQuota('quota-ent', 'stealth', 'enterprise')
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(100_000)
  })
})

// ─── Metering Middleware (path classification) ──────────────────────────────

describe('Metering middleware', () => {
  it('classifies stealth paths', () => {
    expect(classifyPath('/v1/stealth/generate')).toBe('stealth')
    expect(classifyPath('/v1/stealth/derive')).toBe('stealth')
  })

  it('classifies commitment paths', () => {
    expect(classifyPath('/v1/commitment/create')).toBe('commitment')
  })

  it('skips public/non-metered paths', () => {
    expect(classifyPath('/v1/health')).toBeNull()
    expect(classifyPath('/v1/ready')).toBeNull()
    expect(classifyPath('/v1/errors')).toBeNull()
    expect(classifyPath('/')).toBeNull()
    expect(classifyPath('/v1/billing/usage')).toBeNull()
    expect(classifyPath('/v1/admin/keys')).toBeNull()
  })

  it('classifies all operation categories', () => {
    expect(classifyPath('/v1/transfer/shield')).toBe('transfer')
    expect(classifyPath('/v1/scan/payments')).toBe('scan')
    expect(classifyPath('/v1/viewing-key/generate')).toBe('viewing_key')
    expect(classifyPath('/v1/privacy/score')).toBe('privacy')
    expect(classifyPath('/v1/swap/private')).toBe('swap')
    expect(classifyPath('/v1/governance/ballot/encrypt')).toBe('governance')
    expect(classifyPath('/v1/compliance/disclose')).toBe('compliance')
    expect(classifyPath('/v1/jito/relay')).toBe('jito')
  })
})

// ─── GET /v1/billing/usage ──────────────────────────────────────────────────

describe('GET /v1/billing/usage', () => {
  beforeEach(() => {
    resetUsageProvider()
  })

  it('returns usage breakdown → 200', async () => {
    const res = await request(app).get('/v1/billing/usage')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(res.body.data.categories).toBeDefined()
    expect(typeof res.body.data.total).toBe('number')
    expect(typeof res.body.data.quotaTotal).toBe('number')
  })

  it('returns zero usage for fresh key', async () => {
    const res = await request(app).get('/v1/billing/usage')
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(0)
  })

  it('includes all operation categories', async () => {
    const res = await request(app).get('/v1/billing/usage')
    const cats = Object.keys(res.body.data.categories)
    expect(cats).toContain('stealth')
    expect(cats).toContain('commitment')
    expect(cats).toContain('transfer')
    expect(cats).toContain('scan')
    expect(cats).toContain('jito')
  })
})

// ─── Subscription Management ────────────────────────────────────────────────

describe('Subscription management', () => {
  beforeEach(() => {
    resetStripeProvider()
  })

  it('GET /v1/billing/subscription returns default when no subscription → 200', async () => {
    const res = await request(app).get('/v1/billing/subscription')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('active')
  })

  it('POST /v1/billing/subscribe creates subscription → 200', async () => {
    const res = await request(app)
      .post('/v1/billing/subscribe')
      .send({ plan: 'pro' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toMatch(/^sub_/)
    expect(res.body.data.plan).toBe('pro')
    expect(res.body.data.status).toBe('active')
  })

  it('POST /v1/billing/subscribe changes existing plan → 200', async () => {
    // Create initial
    await request(app)
      .post('/v1/billing/subscribe')
      .send({ plan: 'pro' })

    // Change plan
    const res = await request(app)
      .post('/v1/billing/subscribe')
      .send({ plan: 'enterprise' })
    expect(res.status).toBe(200)
    expect(res.body.data.plan).toBe('enterprise')
  })

  it('POST /v1/billing/subscribe rejects invalid plan → 400', async () => {
    const res = await request(app)
      .post('/v1/billing/subscribe')
      .send({ plan: 'platinum' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── Invoices & Portal ──────────────────────────────────────────────────────

describe('Invoices & portal', () => {
  beforeEach(() => {
    resetStripeProvider()
  })

  it('GET /v1/billing/invoices returns empty for new customer → 200', async () => {
    const res = await request(app).get('/v1/billing/invoices')
    expect(res.status).toBe(200)
    expect(res.body.data.invoices).toEqual([])
    expect(res.body.data.total).toBe(0)
  })

  it('GET /v1/billing/invoices returns invoices after subscribing → 200', async () => {
    await request(app)
      .post('/v1/billing/subscribe')
      .send({ plan: 'pro' })

    const res = await request(app).get('/v1/billing/invoices')
    expect(res.status).toBe(200)
    expect(res.body.data.invoices.length).toBeGreaterThan(0)
    expect(res.body.data.invoices[0].id).toMatch(/^inv_/)
  })

  it('GET /v1/billing/invoices supports pagination', async () => {
    const res = await request(app)
      .get('/v1/billing/invoices?limit=5&offset=0')
    expect(res.status).toBe(200)
    expect(res.body.data.limit).toBe(5)
    expect(res.body.data.offset).toBe(0)
  })

  it('POST /v1/billing/portal returns portal URL → 200', async () => {
    const res = await request(app)
      .post('/v1/billing/portal')
    expect(res.status).toBe(200)
    expect(res.body.data.id).toMatch(/^ps_/)
    expect(res.body.data.url).toContain('billing.stripe.com')
    expect(res.body.data.expiresAt).toBeDefined()
  })
})

// ─── Portal Tier Gating ─────────────────────────────────────────────────────

describe('Portal tier gating', () => {
  let tierApp: express.Application

  beforeEach(async () => {
    resetStripeProvider()
    const { validateRequest } = await import('../src/middleware/validation.js')
    const { requireTier } = await import('../src/middleware/require-tier.js')
    const { createPortalSession } = await import('../src/services/stripe-provider.js')

    tierApp = express()
    tierApp.use(express.json())

    tierApp.use((req: Request, _res: Response, next: NextFunction) => {
      req.apiKeyTier = (req.headers['x-test-tier'] as any) || 'free'
      next()
    })

    const billingRouter = Router()
    billingRouter.post(
      '/billing/portal',
      requireTier('pro', 'enterprise'),
      (req: Request, res: Response) => {
        const session = createPortalSession('test-customer')
        res.json({ success: true, data: session })
      },
    )
    tierApp.use('/v1', billingRouter)
  })

  it('allows pro tier → 200', async () => {
    const res = await request(tierApp)
      .post('/v1/billing/portal')
      .set('X-Test-Tier', 'pro')
    expect(res.status).toBe(200)
  })

  it('rejects free tier → 403', async () => {
    const res = await request(tierApp)
      .post('/v1/billing/portal')
      .set('X-Test-Tier', 'free')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('TIER_ACCESS_DENIED')
  })
})

// ─── Webhook Processing ─────────────────────────────────────────────────────

describe('Webhook processing', () => {
  it('processes valid webhook with correct signature → 200', async () => {
    const body = { type: 'invoice.paid', data: { amount: 4900 } }
    const signature = computeWebhookSignature(JSON.stringify(body))

    const res = await request(app)
      .post('/v1/billing/webhook')
      .set('stripe-signature', signature)
      .send(body)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.eventId).toMatch(/^evt_/)
    expect(res.body.data.type).toBe('invoice.paid')
    expect(res.body.data.processed).toBe(true)
  })

  it('rejects webhook with missing signature → 401', async () => {
    const res = await request(app)
      .post('/v1/billing/webhook')
      .send({ type: 'invoice.paid', data: {} })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('BILLING_WEBHOOK_INVALID')
  })

  it('rejects webhook with invalid signature → 401', async () => {
    const res = await request(app)
      .post('/v1/billing/webhook')
      .set('stripe-signature', 'bad_signature')
      .send({ type: 'invoice.paid', data: {} })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('BILLING_WEBHOOK_INVALID')
  })

  it('rejects unknown event type → 400', async () => {
    const body = { type: 'unknown.event', data: {} }
    const signature = computeWebhookSignature(JSON.stringify(body))

    const res = await request(app)
      .post('/v1/billing/webhook')
      .set('stripe-signature', signature)
      .send(body)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
