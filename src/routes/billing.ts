import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { validateRequest } from '../middleware/validation.js'
import { requireTier } from '../middleware/require-tier.js'
import { ErrorCode } from '../errors/codes.js'
import { getDailyUsage } from '../services/usage-provider.js'
import {
  createSubscription,
  getSubscription,
  changePlan,
  listInvoices,
  createPortalSession,
  validateWebhookSignature,
  processWebhookEvent,
} from '../services/stripe-provider.js'
import type { ApiKeyTier } from '../types/api-key.js'
import type { WebhookEventType } from '../services/stripe-provider.js'

const router = Router()

// ─── Schemas ────────────────────────────────────────────────────────────────

const subscribeSchema = z.object({
  plan: z.enum(['free', 'pro', 'enterprise']),
})

const webhookSchema = z.object({
  type: z.enum([
    'invoice.paid',
    'invoice.payment_failed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ]),
  data: z.record(z.string(), z.unknown()),
})

// ─── GET /billing/usage ─────────────────────────────────────────────────────

router.get(
  '/billing/usage',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tier = req.apiKeyTier ?? 'free'
      const apiKeyId = req.apiKey?.id ?? req.headers['x-api-key'] as string ?? 'unknown'

      const usage = await getDailyUsage(apiKeyId, tier)

      res.json({
        success: true,
        data: usage,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ─── GET /billing/subscription ──────────────────────────────────────────────

router.get(
  '/billing/subscription',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.apiKey?.id ?? req.headers['x-api-key'] as string ?? 'unknown'
      const sub = getSubscription(customerId)

      if (!sub) {
        // Return default free tier subscription info
        res.json({
          success: true,
          data: {
            plan: req.apiKeyTier ?? 'free',
            status: 'active',
            message: 'No active subscription. Using default tier.',
          },
        })
        return
      }

      res.json({
        success: true,
        data: sub,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ─── POST /billing/subscribe ────────────────────────────────────────────────

router.post(
  '/billing/subscribe',
  validateRequest({ body: subscribeSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { plan } = req.body as { plan: ApiKeyTier }
      const customerId = req.apiKey?.id ?? req.headers['x-api-key'] as string ?? 'unknown'

      const existing = getSubscription(customerId)

      let sub
      if (existing && existing.status === 'active') {
        // Change plan
        sub = changePlan(customerId, plan)
        if (!sub) {
          res.status(500).json({
            success: false,
            error: {
              code: ErrorCode.BILLING_SUBSCRIPTION_FAILED,
              message: 'Failed to change subscription plan.',
            },
          })
          return
        }
      } else {
        // New subscription
        sub = createSubscription(customerId, plan)
      }

      res.json({
        success: true,
        data: sub,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ─── GET /billing/invoices ──────────────────────────────────────────────────

router.get(
  '/billing/invoices',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.apiKey?.id ?? req.headers['x-api-key'] as string ?? 'unknown'
      const rawLimit = parseInt(req.query.limit as string)
      const rawOffset = parseInt(req.query.offset as string)
      const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100)
      const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0)

      const result = listInvoices(customerId, limit, offset)

      res.json({
        success: true,
        data: {
          invoices: result.invoices,
          total: result.total,
          limit,
          offset,
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

// ─── POST /billing/portal ───────────────────────────────────────────────────

router.post(
  '/billing/portal',
  requireTier('pro', 'enterprise'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerId = req.apiKey?.id ?? req.headers['x-api-key'] as string ?? 'unknown'
      const session = createPortalSession(customerId)

      res.json({
        success: true,
        data: session,
      })
    } catch (err) {
      next(err)
    }
  },
)

// ─── POST /billing/webhook ──────────────────────────────────────────────────

router.post(
  '/billing/webhook',
  validateRequest({ body: webhookSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['stripe-signature'] as string

      if (!signature) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCode.BILLING_WEBHOOK_INVALID,
            message: 'Missing stripe-signature header.',
          },
        })
        return
      }

      const payload = JSON.stringify(req.body)
      if (!validateWebhookSignature(payload, signature)) {
        res.status(401).json({
          success: false,
          error: {
            code: ErrorCode.BILLING_WEBHOOK_INVALID,
            message: 'Invalid webhook signature.',
          },
        })
        return
      }

      const { type, data } = req.body as { type: WebhookEventType; data: Record<string, unknown> }
      const event = processWebhookEvent(type, data)

      res.json({
        success: true,
        data: { eventId: event.id, type: event.type, processed: true },
      })
    } catch (err) {
      next(err)
    }
  },
)

export default router
