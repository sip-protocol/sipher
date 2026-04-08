import { getOrCreateSession as dbGetOrCreateSession, type Session } from './db.js'

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

interface ConversationEntry {
  messages: ConversationMessage[]
  lastActive: number
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory conversation store — NOT persisted to SQLite
// ─────────────────────────────────────────────────────────────────────────────

const conversations = new Map<string, ConversationEntry>()

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
 * Get the in-memory conversation history for a session.
 * Returns an empty array if no conversation exists or the session has been
 * idle for longer than the timeout threshold.
 */
export function getConversation(sessionId: string): ConversationMessage[] {
  const entry = conversations.get(sessionId)
  if (!entry) return []

  const now = Date.now()
  if (now - entry.lastActive > IDLE_TIMEOUT_MS) {
    conversations.delete(sessionId)
    return []
  }

  return entry.messages
}

/**
 * Append messages to the in-memory conversation for this session.
 * Creates the conversation entry if it does not exist.
 * Updates the lastActive timestamp on every call.
 */
export function appendConversation(
  sessionId: string,
  messages: ConversationMessage[],
): void {
  const entry = conversations.get(sessionId)
  const now = Date.now()

  if (entry) {
    entry.messages.push(...messages)
    entry.lastActive = now
  } else {
    conversations.set(sessionId, {
      messages: [...messages],
      lastActive: now,
    })
  }
}

/**
 * Remove the in-memory conversation for a session.
 */
export function clearConversation(sessionId: string): void {
  conversations.delete(sessionId)
}

/**
 * Purge all conversations that have been idle longer than the timeout.
 * Returns the number of purged sessions.
 */
export function purgeStale(): number {
  const now = Date.now()
  let purged = 0

  for (const [id, entry] of conversations) {
    if (now - entry.lastActive > IDLE_TIMEOUT_MS) {
      conversations.delete(id)
      purged++
    }
  }

  return purged
}

/**
 * Return the count of active in-memory conversations.
 */
export function activeSessionCount(): number {
  return conversations.size
}

/**
 * Expose the idle timeout for testing purposes.
 */
export const IDLE_TIMEOUT = IDLE_TIMEOUT_MS
