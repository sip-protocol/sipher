import { Router } from 'express'
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import {
  getSessionStats,
  getAuditStats,
  getPaymentLinkStats,
} from '../db.js'
import { renderLoginPage, renderDashboardPage } from '../views/admin-page.js'
import type { DashboardStats } from '../views/admin-page.js'
import { createStore } from '../state/ephemeral.js'
import { loadTorqueConfig, loadNetworkConfig } from '../config/network.js'
import { TorqueMCPClient } from '../integrations/torque/mcp-client.js'

export const adminRouter = Router()

// token → expiresAt epoch-ms. Backed by the centralized ephemeral store —
// the value type is a plain number so it round-trips through any future
// Redis backend without surgery.
const adminTokens = createStore<number>('adminTokens', { maxSize: 1_000 })
const COOKIE_NAME = 'sipher_admin'
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
const TWENTY_FOUR_HOURS_SECONDS = 24 * 60 * 60

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────

async function isValidAdminToken(token: string): Promise<boolean> {
  const expiresAt = await adminTokens.get(token)
  if (!expiresAt || expiresAt < Date.now()) {
    await adminTokens.delete(token)
    return false
  }
  return true
}

function checkPassword(input: string): boolean {
  const expected = process.env.SIPHER_ADMIN_PASSWORD
  if (!expected) return false
  const inputHash = createHash('sha256').update(input).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(inputHash, expectedHash)
}

function getCookie(req: { headers: { cookie?: string } }, name: string): string | null {
  const cookies = req.headers.cookie
  if (!cookies) return null
  const match = cookies.split(';').find((c) => c.trim().startsWith(`${name}=`))
  return match ? match.split('=')[1].trim() : null
}

async function requireAuth(
  req: { headers: { cookie?: string } },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  next: () => void,
): Promise<void> {
  const token = getCookie(req, COOKIE_NAME)
  if (!token || !(await isValidAdminToken(token))) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats builder
// ─────────────────────────────────────────────────────────────────────────────

function buildStats(): DashboardStats {
  return {
    sessions: getSessionStats(),
    audit: getAuditStats(TWENTY_FOUR_HOURS),
    paymentLinks: getPaymentLinkStats(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public routes (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/', async (req, res) => {
  const token = getCookie(req, COOKIE_NAME)
  if (token && (await isValidAdminToken(token))) {
    res.redirect('/admin/dashboard')
    return
  }
  res.type('html').send(renderLoginPage())
})

adminRouter.post('/login', async (req, res) => {
  const { password } = req.body
  if (!password || !checkPassword(password)) {
    res.status(401).type('html').send(renderLoginPage('Invalid password'))
    return
  }
  const token = randomBytes(32).toString('hex')
  await adminTokens.set(token, Date.now() + TWENTY_FOUR_HOURS, TWENTY_FOUR_HOURS_SECONDS)
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${TWENTY_FOUR_HOURS / 1000}`,
  )
  res.redirect('/admin/dashboard')
})

adminRouter.post('/logout', async (req, res) => {
  const token = getCookie(req, COOKIE_NAME)
  if (token) await adminTokens.delete(token)
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/admin; HttpOnly; Max-Age=0`)
  res.redirect('/admin/')
})

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated routes
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/dashboard', requireAuth as any, (_req, res) => {
  const stats = buildStats()
  ;(res as any).type('html').send(renderDashboardPage(stats))
})

adminRouter.get('/api/stats', requireAuth as any, (_req, res) => {
  const stats = buildStats()
  ;(res as any).json(stats)
})

// ─────────────────────────────────────────────────────────────────────────────
// Torque integration status (no auth required — no sensitive data returned)
// ─────────────────────────────────────────────────────────────────────────────

adminRouter.get('/api/torque/status', async (_req, res) => {
  const config = loadTorqueConfig()
  if (!config) {
    ;(res as any).status(200).json({
      ok: true,
      enabled: false,
      reason: 'TORQUE_GROWTH_ENABLED is false or required env vars missing',
    })
    return
  }

  const network = loadNetworkConfig().clusterName
  const campaignId = network === 'mainnet-beta' ? config.campaignIdMainnet : config.campaignIdDevnet

  const client = new TorqueMCPClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    campaignId,
  })

  const campaign = await client.getCampaign()
  ;(res as any).status(200).json({
    ok: true,
    enabled: true,
    network,
    campaignId,
    campaign,
  })
})

// Background cleanup is centralized in the ephemeral store (sweep loop +
// lazy expiration on get); no per-map setInterval needed.
