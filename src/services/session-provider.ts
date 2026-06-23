import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { LRUCache } from 'lru-cache'
import {
  isRedisConnected,
  redisGet,
  redisSet,
  redisDel,
} from './redis.js'
import { CACHE_MAX_LARGE, ONE_HOUR_SECONDS, ONE_DAY_SECONDS } from '../constants.js'

// ─── Constants ──────────────────────────────────────────────────────────────

const DOMAIN_TAG = new TextEncoder().encode('SIPHER-SESSION')
const REDIS_KEY_PREFIX = 'sipher:session:'
const MIN_TTL_SECONDS = 60
const DEFAULT_TTL_SECONDS = ONE_HOUR_SECONDS
const MAX_TTL_SECONDS = ONE_DAY_SECONDS

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SessionDefaults {
  chain?: string
  privacyLevel?: string
  rpcProvider?: string
  backend?: string
  defaultViewingKey?: string
}

export interface Session {
  id: string
  apiKeyId: string
  defaults: SessionDefaults
  createdAt: number
  expiresAt: number
  lastAccessedAt: number
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const sessionCache = new LRUCache<string, Session>({
  max: CACHE_MAX_LARGE,
  ttl: MAX_TTL_SECONDS * 1000,
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateSessionId(apiKeyId: string): string {
  const entropy = `${apiKeyId}:${Date.now()}:${Math.random()}`
  const input = new Uint8Array(
    DOMAIN_TAG.length + new TextEncoder().encode(entropy).length
  )
  input.set(DOMAIN_TAG)
  input.set(new TextEncoder().encode(entropy), DOMAIN_TAG.length)
  return 'sess_' + bytesToHex(keccak_256(input))
}

function clampTtl(ttlSeconds?: number): number {
  if (ttlSeconds === undefined) return DEFAULT_TTL_SECONDS
  return Math.max(MIN_TTL_SECONDS, Math.min(ttlSeconds, MAX_TTL_SECONDS))
}

/**
 * Derive a stable identifier from the API key for ownership checks.
 * Uses a hash so we never store the raw key.
 */
export function getApiKeyIdentifier(req: { headers: Record<string, string | string[] | undefined> }): string {
  const apiKey = (typeof req.headers['x-api-key'] === 'string' && req.headers['x-api-key'])
    || (typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7) : '')
    || 'anonymous'
  return bytesToHex(keccak_256(new TextEncoder().encode(apiKey)))
}

// ─── Redis helpers ──────────────────────────────────────────────────────────

function redisKey(id: string): string {
  return `${REDIS_KEY_PREFIX}${id}`
}

async function persistSession(session: Session): Promise<void> {
  const ttlSeconds = Math.max(1, Math.round((session.expiresAt - Date.now()) / 1000))

  if (isRedisConnected()) {
    await redisSet(redisKey(session.id), JSON.stringify(session), ttlSeconds)
  }

  sessionCache.set(session.id, session, { ttl: ttlSeconds * 1000 })
}

async function loadSession(id: string): Promise<Session | null> {
  // Memory first
  const cached = sessionCache.get(id)
  if (cached) return cached

  // Redis fallback
  if (isRedisConnected()) {
    const data = await redisGet(redisKey(id))
    if (data) {
      try {
        const session = JSON.parse(data) as Session
        // Backfill memory cache
        const ttlMs = Math.max(0, session.expiresAt - Date.now())
        if (ttlMs > 0) {
          sessionCache.set(session.id, session, { ttl: ttlMs })
        }
        return session
      } catch {
        // Invalid JSON, treat as miss
      }
    }
  }

  return null
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function createSession(
  apiKeyId: string,
  defaults: SessionDefaults,
  ttlSeconds?: number,
): Promise<Session> {
  const ttl = clampTtl(ttlSeconds)
  const now = Date.now()

  const session: Session = {
    id: generateSessionId(apiKeyId),
    apiKeyId,
    defaults,
    createdAt: now,
    expiresAt: now + ttl * 1000,
    lastAccessedAt: now,
  }

  await persistSession(session)
  return session
}

export async function getSession(id: string): Promise<Session | null> {
  const session = await loadSession(id)
  if (!session) return null

  // Check expiry
  if (Date.now() > session.expiresAt) {
    sessionCache.delete(id)
    if (isRedisConnected()) {
      redisDel(redisKey(id)).catch(() => {})
    }
    return null
  }

  // Update last accessed
  session.lastAccessedAt = Date.now()
  await persistSession(session)

  return session
}

export async function updateSession(
  id: string,
  defaults: Partial<SessionDefaults>,
): Promise<Session | null> {
  const session = await getSession(id)
  if (!session) return null

  // Shallow merge — only override provided keys
  for (const [key, value] of Object.entries(defaults)) {
    if (value !== undefined) {
      ;(session.defaults as Record<string, unknown>)[key] = value
    }
  }

  await persistSession(session)
  return session
}

export async function deleteSession(id: string): Promise<boolean> {
  const existed = sessionCache.has(id) || (await loadSession(id)) !== null

  sessionCache.delete(id)
  if (isRedisConnected()) {
    await redisDel(redisKey(id))
  }

  return existed
}

// ─── Reset (testing) ────────────────────────────────────────────────────────

export function resetSessionProvider(): void {
  sessionCache.clear()
}
