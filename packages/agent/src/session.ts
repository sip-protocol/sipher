import {
  getOrCreateSession as dbGetOrCreateSession,
  loadConversation,
  appendConversationRows,
  clearConversationRows,
  purgeStaleConversations,
  activeConversationCount,
  type Session,
  type ConversationRow,
} from './db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionContext {
  id: string
  wallet: string
  preferences: Record<string, unknown>
}

export interface ConversationMessage {
  role: string
  content: unknown
}

/** Maximum number of messages retained per conversation. */
const MAX_CONVERSATION_MESSAGES = 100

/** Maximum idle time before a conversation is eligible for purge (30 minutes). */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve (or create) a session for the given wallet address.
 * Delegates to the SQLite-backed session store for persistence,
 * then returns a lightweight context object.
 */
export function resolveSession(wallet: string): SessionContext {
  const session: Session = dbGetOrCreateSession(wallet)
  return {
    id: session.id,
    wallet: session.wallet,
    preferences: session.preferences,
  }
}

/**
 * Get the persisted conversation history for a session.
 * Returns an empty array if no conversation exists or the session has been
 * idle for longer than the timeout threshold.
 */
export function getConversation(sessionId: string): ConversationMessage[] {
  const rows = loadConversation(sessionId)
  if (rows.length === 0) return []

  // Check idle timeout on the most recent message
  const lastActive = rows[rows.length - 1].created_at
  if (Date.now() - lastActive > IDLE_TIMEOUT_MS) {
    clearConversationRows(sessionId)
    return []
  }

  return rows.map(rowToMessage)
}

/**
 * Append messages to the persisted conversation for this session.
 */
export function appendConversation(
  sessionId: string,
  messages: ConversationMessage[],
): void {
  appendConversationRows(sessionId, messages, MAX_CONVERSATION_MESSAGES)
}

/**
 * Remove the persisted conversation for a session.
 */
export function clearConversation(sessionId: string): void {
  clearConversationRows(sessionId)
}

/**
 * Purge all conversations that have been idle longer than the timeout.
 * Returns the number of purged sessions.
 */
export function purgeStale(): number {
  return purgeStaleConversations(IDLE_TIMEOUT_MS)
}

/**
 * Return the count of active conversations.
 */
export function activeSessionCount(): number {
  return activeConversationCount()
}

/**
 * Expose the idle timeout for testing purposes.
 */
export const IDLE_TIMEOUT = IDLE_TIMEOUT_MS

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function rowToMessage(row: ConversationRow): ConversationMessage {
  let content: unknown = row.content
  try {
    content = JSON.parse(row.content)
  } catch {
    // plain string content — keep as-is
  }
  return { role: row.role, content }
}
