import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { timingSafeEqual } from 'crypto'
import { LRUCache } from 'lru-cache'
import { env } from '../config.js'
import type { ApiKeyTier } from '../types/api-key.js'
import { CACHE_MAX_DEFAULT, ONE_DAY_MS } from '../constants.js'

// ─── Constants ──────────────────────────────────────────────────────────────

const DOMAIN_TAG = new TextEncoder().encode('SIPHER-STRIPE')

const PLAN_PRICES: Record<ApiKeyTier, { monthly: number; name: string }> = {
  free: { monthly: 0, name: 'Sipher Free' },
  pro: { monthly: 49_00, name: 'Sipher Pro' }, // cents
  enterprise: { monthly: 499_00, name: 'Sipher Enterprise' },
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled'

export interface Subscription {
  id: string
  customerId: string
  plan: ApiKeyTier
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  createdAt: string
}

export interface Invoice {
  id: string
  customerId: string
  subscriptionId: string
  amountCents: number
  currency: string
  status: 'paid' | 'open' | 'void'
  periodStart: string
  periodEnd: string
  createdAt: string
  lineItems: InvoiceLineItem[]
}

export interface InvoiceLineItem {
  description: string
  quantity: number
  unitAmountCents: number
  amountCents: number
}

export interface PortalSession {
  id: string
  url: string
  expiresAt: string
}

export type WebhookEventType =
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'

export interface WebhookEvent {
  id: string
  type: WebhookEventType
  data: Record<string, unknown>
  createdAt: string
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const subscriptionCache = new LRUCache<string, Subscription>({
  max: CACHE_MAX_DEFAULT,
  ttl: ONE_DAY_MS,
})

const invoiceCache = new LRUCache<string, Invoice[]>({
  max: CACHE_MAX_DEFAULT,
  ttl: ONE_DAY_MS,
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function domainHash(label: string, data: string): string {
  const payload = new TextEncoder().encode(label + data)
  const input = new Uint8Array(DOMAIN_TAG.length + payload.length)
  input.set(DOMAIN_TAG)
  input.set(payload, DOMAIN_TAG.length)
  return bytesToHex(keccak_256(input))
}

function periodDates(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const end = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

// ─── Create Subscription ────────────────────────────────────────────────────

export function createSubscription(
  customerId: string,
  plan: ApiKeyTier,
): Subscription {
  const id = 'sub_' + domainHash('SUB', customerId + plan)
  const { start, end } = periodDates()

  const sub: Subscription = {
    id,
    customerId,
    plan,
    status: 'active',
    currentPeriodStart: start,
    currentPeriodEnd: end,
    cancelAtPeriodEnd: false,
    createdAt: new Date().toISOString(),
  }

  subscriptionCache.set(customerId, sub)

  // Auto-generate initial invoice
  generateInvoice(sub)

  return sub
}

// ─── Get Subscription ───────────────────────────────────────────────────────

export function getSubscription(customerId: string): Subscription | null {
  return subscriptionCache.get(customerId) ?? null
}

// ─── Cancel Subscription ────────────────────────────────────────────────────

export function cancelSubscription(customerId: string): Subscription | null {
  const sub = subscriptionCache.get(customerId)
  if (!sub) return null

  sub.cancelAtPeriodEnd = true
  sub.status = 'canceled'
  subscriptionCache.set(customerId, sub)
  return sub
}

// ─── Change Plan ────────────────────────────────────────────────────────────

export function changePlan(
  customerId: string,
  newPlan: ApiKeyTier,
): Subscription | null {
  const sub = subscriptionCache.get(customerId)
  if (!sub) return null

  sub.plan = newPlan
  sub.id = 'sub_' + domainHash('SUB', customerId + newPlan)
  subscriptionCache.set(customerId, sub)

  generateInvoice(sub)
  return sub
}

// ─── Invoice Generation ─────────────────────────────────────────────────────

function generateInvoice(sub: Subscription): Invoice {
  const invId = 'inv_' + domainHash('INV', sub.id + sub.currentPeriodStart)
  const price = PLAN_PRICES[sub.plan]

  const invoice: Invoice = {
    id: invId,
    customerId: sub.customerId,
    subscriptionId: sub.id,
    amountCents: price.monthly,
    currency: 'usd',
    status: 'paid',
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    createdAt: new Date().toISOString(),
    lineItems: [
      {
        description: `${price.name} — monthly`,
        quantity: 1,
        unitAmountCents: price.monthly,
        amountCents: price.monthly,
      },
    ],
  }

  const existing = invoiceCache.get(sub.customerId) ?? []
  existing.push(invoice)
  invoiceCache.set(sub.customerId, existing)

  return invoice
}

// ─── List Invoices ──────────────────────────────────────────────────────────

export function listInvoices(
  customerId: string,
  limit = 10,
  offset = 0,
): { invoices: Invoice[]; total: number } {
  const all = invoiceCache.get(customerId) ?? []
  return {
    invoices: all.slice(offset, offset + limit),
    total: all.length,
  }
}

// ─── Portal Session ─────────────────────────────────────────────────────────

export function createPortalSession(customerId: string): PortalSession {
  const id = 'ps_' + domainHash('PORTAL', customerId + Date.now().toString())
  const expires = new Date(Date.now() + 30 * 60 * 1000) // 30 min

  return {
    id,
    url: `https://billing.stripe.com/p/session/${id}`,
    expiresAt: expires.toISOString(),
  }
}

// ─── Webhook Processing ─────────────────────────────────────────────────────

function getWebhookSecret(): string {
  return env.STRIPE_WEBHOOK_SECRET
}

export function validateWebhookSignature(
  payload: string,
  signature: string,
): boolean {
  const expected = domainHash('WEBHOOK', payload + getWebhookSecret())
  if (signature.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export function computeWebhookSignature(payload: string): string {
  return domainHash('WEBHOOK', payload + getWebhookSecret())
}

export function processWebhookEvent(
  eventType: WebhookEventType,
  data: Record<string, unknown>,
): WebhookEvent {
  const id = 'evt_' + domainHash('EVT', eventType + JSON.stringify(data) + Date.now().toString())

  return {
    id,
    type: eventType,
    data,
    createdAt: new Date().toISOString(),
  }
}

// ─── Reset (for tests) ─────────────────────────────────────────────────────

export function resetStripeProvider(): void {
  subscriptionCache.clear()
  invoiceCache.clear()
}
