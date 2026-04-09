import Database from 'better-sqlite3'
import { createHash, randomUUID } from 'node:crypto'
import { ulid } from 'ulid'

// ─────────────────────────────────────────────────────────────────────────────
// Schema — embedded to avoid build-path issues with .sql file resolution
// ─────────────────────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL UNIQUE,
  preferences TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  last_active INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  params TEXT NOT NULL,
  tx_signature TEXT,
  status TEXT NOT NULL DEFAULT 'prepared',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS scheduled_ops (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  params TEXT NOT NULL,
  wallet_signature TEXT NOT NULL,
  next_exec INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  max_exec INTEGER NOT NULL,
  exec_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS payment_links (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  stealth_address TEXT NOT NULL,
  ephemeral_pubkey TEXT NOT NULL,
  amount REAL,
  token TEXT NOT NULL DEFAULT 'SOL',
  memo TEXT,
  type TEXT NOT NULL DEFAULT 'link',
  invoice_meta TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at INTEGER NOT NULL,
  paid_tx TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_ops(next_exec, status);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_links(status, expires_at);

CREATE TABLE IF NOT EXISTS activity_stream (
  id          TEXT PRIMARY KEY,
  agent       TEXT NOT NULL,
  level       TEXT NOT NULL,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  detail      TEXT,
  wallet      TEXT,
  actionable  INTEGER DEFAULT 0,
  action_type TEXT,
  action_data TEXT,
  dismissed   INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS herald_queue (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  content      TEXT NOT NULL,
  reply_to     TEXT,
  scheduled_at TEXT,
  status       TEXT DEFAULT 'pending',
  approved_by  TEXT,
  approved_at  TEXT,
  posted_at    TEXT,
  tweet_id     TEXT,
  metrics      TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS herald_dms (
  id          TEXT PRIMARY KEY,
  x_user_id   TEXT NOT NULL,
  x_username  TEXT NOT NULL,
  intent      TEXT NOT NULL,
  message     TEXT NOT NULL,
  response    TEXT,
  tool_used   TEXT,
  exec_link   TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_links (
  id          TEXT PRIMARY KEY,
  wallet      TEXT,
  action      TEXT NOT NULL,
  params      TEXT NOT NULL,
  source      TEXT NOT NULL,
  status      TEXT DEFAULT 'pending',
  expires_at  TEXT NOT NULL,
  signed_tx   TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_log (
  id          TEXT PRIMARY KEY,
  agent       TEXT NOT NULL,
  provider    TEXT NOT NULL,
  operation   TEXT NOT NULL,
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  resources   INTEGER,
  cost_usd    REAL NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_events (
  id          TEXT PRIMARY KEY,
  from_agent  TEXT NOT NULL,
  to_agent    TEXT,
  event_type  TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_wallet_created ON activity_stream(wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_level ON activity_stream(level);
CREATE INDEX IF NOT EXISTS idx_herald_queue_status ON herald_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_herald_dms_user ON herald_dms(x_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exec_links_status ON execution_links(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_cost_log_agent_date ON cost_log(agent, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_events_created ON agent_events(created_at DESC);
`

// ─────────────────────────────────────────────────────────────────────────────
// Singleton connection
// ─────────────────────────────────────────────────────────────────────────────

let db: Database.Database | null = null

/**
 * Get or initialize the SQLite database singleton.
 * DB path resolution: DB_PATH env > /app/data/sipher.db > :memory: (tests)
 */
export function getDb(): Database.Database {
  if (db) return db

  const dbPath = process.env.DB_PATH
    ?? (process.env.NODE_ENV === 'test' ? ':memory:' : '/app/data/sipher.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  return db
}

/** Close the database connection. Safe to call multiple times. */
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

export interface Session {
  id: string
  wallet: string
  preferences: Record<string, unknown>
  created_at: number
  last_active: number
}

/** SHA-256 hash of the wallet public key — deterministic session ID. */
function walletToSessionId(wallet: string): string {
  return createHash('sha256').update(wallet).digest('hex')
}

/**
 * Get an existing session or create a new one for the given wallet.
 * Updates `last_active` on every call for existing sessions.
 */
export function getOrCreateSession(wallet: string): Session {
  const conn = getDb()
  const id = walletToSessionId(wallet)
  const now = Date.now()

  const existing = conn
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(id) as { id: string; wallet: string; preferences: string; created_at: number; last_active: number } | undefined

  if (existing) {
    conn.prepare('UPDATE sessions SET last_active = ? WHERE id = ?').run(now, id)
    return {
      ...existing,
      last_active: now,
      preferences: JSON.parse(existing.preferences),
    }
  }

  conn.prepare(
    'INSERT INTO sessions (id, wallet, preferences, created_at, last_active) VALUES (?, ?, ?, ?, ?)',
  ).run(id, wallet, '{}', now, now)

  return { id, wallet, preferences: {}, created_at: now, last_active: now }
}

/** Merge new preferences into the existing preferences JSON. */
export function updatePreferences(
  sessionId: string,
  prefs: Record<string, unknown>,
): void {
  const conn = getDb()
  const row = conn
    .prepare('SELECT preferences FROM sessions WHERE id = ?')
    .get(sessionId) as { preferences: string } | undefined

  if (!row) throw new Error(`Session not found: ${sessionId}`)

  const merged = { ...JSON.parse(row.preferences), ...prefs }
  conn
    .prepare('UPDATE sessions SET preferences = ? WHERE id = ?')
    .run(JSON.stringify(merged), sessionId)
}

/** Lookup a session by wallet address. Returns null if not found. */
export function getSessionByWallet(wallet: string): Session | null {
  const conn = getDb()
  const id = walletToSessionId(wallet)
  const row = conn
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(id) as { id: string; wallet: string; preferences: string; created_at: number; last_active: number } | undefined

  if (!row) return null
  return { ...row, preferences: JSON.parse(row.preferences) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit log
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: number
  session_id: string
  action: string
  params: Record<string, unknown>
  tx_signature: string | null
  status: string
  created_at: number
}

/** Keys that must never be persisted in the audit log. */
const SENSITIVE_KEYS = ['viewingKey', 'spendingKey', 'privateKey']

/** Strip sensitive keys from params before persisting. */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...params }
  for (const key of SENSITIVE_KEYS) {
    delete clean[key]
  }
  return clean
}

/** Insert a new audit log entry. Returns the auto-incremented ID. */
export function logAudit(
  sessionId: string,
  action: string,
  params: Record<string, unknown>,
  status = 'prepared',
  txSignature?: string,
): number {
  const conn = getDb()
  const sanitized = sanitizeParams(params)
  const result = conn.prepare(
    'INSERT INTO audit_log (session_id, action, params, tx_signature, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(sessionId, action, JSON.stringify(sanitized), txSignature ?? null, status, Date.now())

  return Number(result.lastInsertRowid)
}

/** Update the status (and optionally tx_signature) of an audit entry. */
export function updateAuditStatus(
  id: number,
  status: string,
  txSignature?: string,
): void {
  const conn = getDb()
  if (txSignature !== undefined) {
    conn.prepare('UPDATE audit_log SET status = ?, tx_signature = ? WHERE id = ?')
      .run(status, txSignature, id)
  } else {
    conn.prepare('UPDATE audit_log SET status = ? WHERE id = ?')
      .run(status, id)
  }
}

export interface AuditLogOptions {
  action?: string
  limit?: number
}

/** Query audit log entries for a session, newest first. */
export function getAuditLog(
  sessionId: string,
  options: AuditLogOptions = {},
): AuditEntry[] {
  const conn = getDb()
  const limit = options.limit ?? 100

  let sql = 'SELECT * FROM audit_log WHERE session_id = ?'
  const bindings: (string | number)[] = [sessionId]

  if (options.action) {
    sql += ' AND action = ?'
    bindings.push(options.action)
  }

  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?'
  bindings.push(limit)

  const rows = conn.prepare(sql).all(...bindings) as Array<{
    id: number
    session_id: string
    action: string
    params: string
    tx_signature: string | null
    status: string
    created_at: number
  }>

  return rows.map((r) => ({
    ...r,
    params: JSON.parse(r.params),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment links
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentLink {
  id: string
  session_id: string | null
  stealth_address: string
  ephemeral_pubkey: string
  amount: number | null
  token: string
  memo: string | null
  type: string
  invoice_meta: Record<string, unknown> | null
  status: string
  expires_at: number
  paid_tx: string | null
  created_at: number
}

export interface CreatePaymentLinkData {
  id?: string
  session_id?: string | null
  stealth_address: string
  ephemeral_pubkey: string
  amount?: number | null
  token?: string
  memo?: string | null
  type?: string
  invoice_meta?: Record<string, unknown> | null
  expires_at: number
}

/** Create a new payment link. Generates a UUID if id is not provided. */
export function createPaymentLink(data: CreatePaymentLinkData): PaymentLink {
  const conn = getDb()
  const id = data.id ?? randomUUID()
  const now = Date.now()

  conn.prepare(`
    INSERT INTO payment_links
      (id, session_id, stealth_address, ephemeral_pubkey, amount, token, memo, type, invoice_meta, status, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id,
    data.session_id ?? null,
    data.stealth_address,
    data.ephemeral_pubkey,
    data.amount ?? null,
    data.token ?? 'SOL',
    data.memo ?? null,
    data.type ?? 'link',
    data.invoice_meta ? JSON.stringify(data.invoice_meta) : null,
    data.expires_at,
    now,
  )

  return {
    id,
    session_id: data.session_id ?? null,
    stealth_address: data.stealth_address,
    ephemeral_pubkey: data.ephemeral_pubkey,
    amount: data.amount ?? null,
    token: data.token ?? 'SOL',
    memo: data.memo ?? null,
    type: data.type ?? 'link',
    invoice_meta: data.invoice_meta ?? null,
    status: 'pending',
    expires_at: data.expires_at,
    paid_tx: null,
    created_at: now,
  }
}

/** Retrieve a payment link by ID. Returns null if not found. */
export function getPaymentLink(id: string): PaymentLink | null {
  const conn = getDb()
  const row = conn.prepare('SELECT * FROM payment_links WHERE id = ?').get(id) as {
    id: string
    session_id: string | null
    stealth_address: string
    ephemeral_pubkey: string
    amount: number | null
    token: string
    memo: string | null
    type: string
    invoice_meta: string | null
    status: string
    expires_at: number
    paid_tx: string | null
    created_at: number
  } | undefined

  if (!row) return null
  return {
    ...row,
    invoice_meta: row.invoice_meta ? JSON.parse(row.invoice_meta) : null,
  }
}

/** Mark a payment link as paid with the confirming transaction signature. */
export function markPaymentLinkPaid(id: string, txSignature: string): void {
  const conn = getDb()
  conn.prepare('UPDATE payment_links SET status = ?, paid_tx = ? WHERE id = ?')
    .run('paid', txSignature, id)
}

/** List payment links for a session, newest first. Default limit: 50. */
export function getPaymentLinksBySession(sessionId: string, limit = 50): PaymentLink[] {
  const conn = getDb()
  const rows = conn.prepare(
    'SELECT * FROM payment_links WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?',
  ).all(sessionId, limit) as Array<{
    id: string; session_id: string | null; stealth_address: string
    ephemeral_pubkey: string; amount: number | null; token: string
    memo: string | null; type: string; invoice_meta: string | null
    status: string; expires_at: number; paid_tx: string | null; created_at: number
  }>
  return rows.map((r) => ({
    ...r,
    invoice_meta: r.invoice_meta ? JSON.parse(r.invoice_meta) : null,
  }))
}

/** Expire all pending links whose expires_at is in the past. Returns count changed. */
export function expireStaleLinks(): number {
  const conn = getDb()
  const result = conn.prepare(
    "UPDATE payment_links SET status = 'expired' WHERE status = 'pending' AND expires_at < ?",
  ).run(Date.now())
  return result.changes
}

export interface PaymentLinkStatsResult {
  total: number
  pending: number
  paid: number
  expired: number
  cancelled: number
}

/** Count payment links grouped by status. */
export function getPaymentLinkStats(): PaymentLinkStatsResult {
  const conn = getDb()
  const rows = conn.prepare(
    'SELECT status, COUNT(*) as count FROM payment_links GROUP BY status',
  ).all() as Array<{ status: string; count: number }>
  const stats: PaymentLinkStatsResult = { total: 0, pending: 0, paid: 0, expired: 0, cancelled: 0 }
  for (const row of rows) {
    stats.total += row.count
    if (row.status in stats) {
      (stats as Record<string, number>)[row.status] = row.count
    }
  }
  return stats
}

export interface AuditStatsResult {
  total: number
  byAction: Record<string, number>
}

/** Count audit log entries by action within a time window (milliseconds from now). */
export function getAuditStats(windowMs: number): AuditStatsResult {
  const conn = getDb()
  const since = Date.now() - windowMs
  const rows = conn.prepare(
    'SELECT action, COUNT(*) as count FROM audit_log WHERE created_at >= ? GROUP BY action',
  ).all(since) as Array<{ action: string; count: number }>
  const byAction: Record<string, number> = {}
  let total = 0
  for (const row of rows) {
    byAction[row.action] = row.count
    total += row.count
  }
  return { total, byAction }
}

export interface SessionStatsResult {
  total: number
}

/** Return total session count. */
export function getSessionStats(): SessionStatsResult {
  const conn = getDb()
  const row = conn.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number }
  return { total: row.count }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled operations
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduledOp {
  id: string
  session_id: string
  action: string
  params: Record<string, unknown>
  wallet_signature: string
  next_exec: number
  expires_at: number
  max_exec: number
  exec_count: number
  status: string
  created_at: number
}

export interface CreateScheduledOpData {
  id?: string
  session_id: string
  action: string
  params: Record<string, unknown>
  wallet_signature: string
  next_exec: number
  expires_at: number
  max_exec: number
}

type ScheduledOpRow = {
  id: string; session_id: string; action: string; params: string
  wallet_signature: string; next_exec: number; expires_at: number
  max_exec: number; exec_count: number; status: string; created_at: number
}

function parseOpRow(row: ScheduledOpRow): ScheduledOp {
  return { ...row, params: JSON.parse(row.params) }
}

export function createScheduledOp(data: CreateScheduledOpData): ScheduledOp {
  const conn = getDb()
  const id = data.id ?? randomUUID()
  const now = Date.now()
  conn.prepare(`
    INSERT INTO scheduled_ops
      (id, session_id, action, params, wallet_signature, next_exec, expires_at, max_exec, exec_count, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?)
  `).run(id, data.session_id, data.action, JSON.stringify(data.params), data.wallet_signature, data.next_exec, data.expires_at, data.max_exec, now)
  return {
    id, session_id: data.session_id, action: data.action, params: data.params,
    wallet_signature: data.wallet_signature, next_exec: data.next_exec,
    expires_at: data.expires_at, max_exec: data.max_exec, exec_count: 0,
    status: 'pending', created_at: now,
  }
}

export function getScheduledOp(id: string): ScheduledOp | null {
  const conn = getDb()
  const row = conn.prepare('SELECT * FROM scheduled_ops WHERE id = ?').get(id) as ScheduledOpRow | undefined
  return row ? parseOpRow(row) : null
}

export function getScheduledOpsBySession(sessionId: string, limit = 50): ScheduledOp[] {
  const conn = getDb()
  const rows = conn.prepare(
    'SELECT * FROM scheduled_ops WHERE session_id = ? ORDER BY next_exec ASC LIMIT ?',
  ).all(sessionId, limit) as ScheduledOpRow[]
  return rows.map(parseOpRow)
}

export function getPendingOps(now?: number): ScheduledOp[] {
  const conn = getDb()
  const ts = now ?? Date.now()
  const rows = conn.prepare(
    "SELECT * FROM scheduled_ops WHERE status = 'pending' AND next_exec <= ? ORDER BY next_exec ASC",
  ).all(ts) as ScheduledOpRow[]
  return rows.map(parseOpRow)
}

export function updateScheduledOp(
  id: string,
  updates: { status?: string; exec_count?: number; next_exec?: number },
): void {
  const conn = getDb()
  const sets: string[] = []
  const values: (string | number)[] = []
  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status) }
  if (updates.exec_count !== undefined) { sets.push('exec_count = ?'); values.push(updates.exec_count) }
  if (updates.next_exec !== undefined) { sets.push('next_exec = ?'); values.push(updates.next_exec) }
  if (sets.length === 0) return
  values.push(id)
  conn.prepare(`UPDATE scheduled_ops SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

export function cancelScheduledOp(id: string): void {
  const conn = getDb()
  const result = conn.prepare("UPDATE scheduled_ops SET status = 'cancelled' WHERE id = ?").run(id)
  if (result.changes === 0) throw new Error(`Scheduled op not found: ${id}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity stream
// ─────────────────────────────────────────────────────────────────────────────

export interface InsertActivityParams {
  agent: string
  level: string
  type: string
  title: string
  detail?: string
  wallet?: string
  actionable?: number
  action_type?: string
  action_data?: string
}

export interface ActivityOptions {
  limit?: number
  before?: string
  levels?: string[]
}

/** Insert an activity into the stream. Returns the ULID id. */
export function insertActivity(params: InsertActivityParams): string {
  const conn = getDb()
  const id = ulid()
  const now = new Date().toISOString()

  conn.prepare(`
    INSERT INTO activity_stream
      (id, agent, level, type, title, detail, wallet, actionable, action_type, action_data, dismissed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    params.agent,
    params.level,
    params.type,
    params.title,
    params.detail ?? null,
    params.wallet ?? null,
    params.actionable ?? 0,
    params.action_type ?? null,
    params.action_data ?? null,
    now,
  )

  return id
}

/**
 * Query activity stream.
 * Pass wallet=null to retrieve across all wallets (global view).
 * Results are ordered newest first.
 */
export function getActivity(
  wallet: string | null,
  options: ActivityOptions = {},
): Array<Record<string, unknown>> {
  const conn = getDb()
  const limit = options.limit ?? 100
  const bindings: (string | number)[] = []
  const clauses: string[] = []

  if (wallet !== null) {
    clauses.push('wallet = ?')
    bindings.push(wallet)
  }

  if (options.levels && options.levels.length > 0) {
    const placeholders = options.levels.map(() => '?').join(', ')
    clauses.push(`level IN (${placeholders})`)
    bindings.push(...options.levels)
  }

  if (options.before) {
    clauses.push('created_at < ?')
    bindings.push(options.before)
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  bindings.push(limit)

  return conn.prepare(`
    SELECT * FROM activity_stream ${where} ORDER BY created_at DESC, rowid DESC LIMIT ?
  `).all(...bindings) as Array<Record<string, unknown>>
}

/** Mark an activity entry as dismissed. */
export function dismissActivity(id: string): void {
  const conn = getDb()
  conn.prepare('UPDATE activity_stream SET dismissed = 1 WHERE id = ?').run(id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost log
// ─────────────────────────────────────────────────────────────────────────────

export interface LogCostParams {
  agent: string
  provider: string
  operation: string
  cost_usd: number
  tokens_in?: number
  tokens_out?: number
  resources?: number
}

/** Log an LLM/API cost entry. Returns the ULID id. */
export function logCost(params: LogCostParams): string {
  const conn = getDb()
  const id = ulid()
  const now = new Date().toISOString()

  conn.prepare(`
    INSERT INTO cost_log
      (id, agent, provider, operation, tokens_in, tokens_out, resources, cost_usd, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.agent,
    params.provider,
    params.operation,
    params.tokens_in ?? null,
    params.tokens_out ?? null,
    params.resources ?? null,
    params.cost_usd,
    now,
  )

  return id
}

/**
 * Sum cost_usd grouped by agent for the given period.
 * Returns { agentName: totalCostUsd, ... }
 */
export function getCostTotals(period: 'today' | 'month'): Record<string, number> {
  const conn = getDb()
  const now = new Date()

  let since: string
  if (period === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  } else {
    since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }

  const rows = conn.prepare(
    'SELECT agent, SUM(cost_usd) as total FROM cost_log WHERE created_at >= ? GROUP BY agent',
  ).all(since) as Array<{ agent: string; total: number }>

  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.agent] = row.total
  }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent events
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentEventOptions {
  limit?: number
  since?: string
}

/** Log an inter-agent event. Returns the ULID id. */
export function logAgentEvent(
  from: string,
  to: string | null,
  type: string,
  payload: unknown,
): string {
  const conn = getDb()
  const id = ulid()
  const now = new Date().toISOString()

  conn.prepare(`
    INSERT INTO agent_events (id, from_agent, to_agent, event_type, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, from, to, type, JSON.stringify(payload), now)

  return id
}

/** Query agent events, newest first. */
export function getAgentEvents(
  options: AgentEventOptions = {},
): Array<Record<string, unknown>> {
  const conn = getDb()
  const limit = options.limit ?? 100
  const bindings: (string | number)[] = []
  const clauses: string[] = []

  if (options.since) {
    clauses.push('created_at >= ?')
    bindings.push(options.since)
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  bindings.push(limit)

  return conn.prepare(`
    SELECT * FROM agent_events ${where} ORDER BY created_at DESC, rowid DESC LIMIT ?
  `).all(...bindings) as Array<Record<string, unknown>>
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution links
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_EXEC_LINK_TTL_MS = 15 * 60 * 1000 // 15 minutes

export interface CreateExecutionLinkData {
  wallet?: string
  action: string
  params: Record<string, unknown>
  source: string
  expiresInMs?: number
}

/**
 * Create a short-lived execution link for wallet-signed actions.
 * Returns the ULID id that becomes the link token.
 */
export function createExecutionLink(data: CreateExecutionLinkData): string {
  const conn = getDb()
  const id = ulid()
  const now = new Date().toISOString()
  const ttl = data.expiresInMs ?? DEFAULT_EXEC_LINK_TTL_MS
  const expiresAt = new Date(Date.now() + ttl).toISOString()

  conn.prepare(`
    INSERT INTO execution_links
      (id, wallet, action, params, source, status, expires_at, signed_tx, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, null, ?)
  `).run(
    id,
    data.wallet ?? null,
    data.action,
    JSON.stringify(data.params),
    data.source,
    expiresAt,
    now,
  )

  return id
}

/** Retrieve an execution link by id. Returns undefined if not found. */
export function getExecutionLink(id: string): Record<string, unknown> | undefined {
  const conn = getDb()
  return conn.prepare('SELECT * FROM execution_links WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

/** Update arbitrary fields on an execution link. Throws if the link doesn't exist. */
export function updateExecutionLink(id: string, updates: Record<string, unknown>): void {
  const conn = getDb()
  const keys = Object.keys(updates)
  if (keys.length === 0) return

  const sets = keys.map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(updates) as (string | number | null)[], id]

  const result = conn.prepare(`UPDATE execution_links SET ${sets} WHERE id = ?`).run(...values)
  if (result.changes === 0) throw new Error(`Execution link not found: ${id}`)
}
