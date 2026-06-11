import { guardianBus, type GuardianEvent } from '../coordination/event-bus.js'

// guardianBus subscribers write to SQLite synchronously — a throwing subscriber must
// never escape this fire-and-forget path (it would mislabel a succeeded X post as failed).
function safeEmit(event: GuardianEvent): void {
  try { guardianBus.emit(event) } catch { /* observability must never break publishing */ }
}

/**
 * HERALD → Discord cross-post (sip-protocol spec 2026-06-11 Discord professional standard §5.5).
 * Only the Friday "Week in SIP" digest crosses over — daily content stays X-only so
 * #announcements stays high-signal. Keyed on the queue row itself (type='content'
 * created on a UTC Friday), not on publish time, so a Saturday approval still crossposts.
 * Convention: exactly ONE content row per Friday (the generator dedups via hasGeneratedToday) — a manually-enqueued second Friday row would also crosspost.
 */
export function isFridayDigest(post: { type?: unknown; created_at?: unknown }): boolean {
  if (post.type !== 'content' || typeof post.created_at !== 'string') return false
  const d = new Date(post.created_at)
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 5
}

export interface DigestWebhookPayload {
  username: string
  avatar_url: string
  embeds: Array<{ title: string; description: string; url: string; color: number; footer: { text: string } }>
}

export function formatDigestEmbed(content: string, tweetId: string): DigestWebhookPayload {
  return {
    username: 'HERALD',
    avatar_url: 'https://github.com/sip-protocol.png',
    embeds: [
      {
        title: 'This Week in SIP',
        description: content,
        url: `https://x.com/sipprotocol/status/${tweetId}`,
        color: 0x6366f1,
        footer: { text: 'SIP Protocol · weekly digest · also on x.com/sipprotocol' },
      },
    ],
  }
}

/**
 * Fire-and-forget: never throws. The X post already succeeded — a Discord failure
 * must not break the publish loop. Failures emit a guardian event for visibility.
 */
export async function crosspostDigest(post: Record<string, unknown>, tweetId: string): Promise<void> {
  const url = process.env.DISCORD_ANNOUNCE_WEBHOOK_URL
  if (!url || !isFridayDigest(post)) return
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formatDigestEmbed(String(post.content ?? ''), tweetId)),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`webhook → ${res.status}`)
    safeEmit({
      source: 'herald',
      type: 'herald:discord-crosspost',
      level: 'routine',
      data: { id: post.id ?? null, tweetId },
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    safeEmit({
      source: 'herald',
      type: 'herald:discord-crosspost-failed',
      level: 'important',
      data: { id: post.id ?? null, error: err instanceof Error ? err.message : String(err) },
      timestamp: new Date().toISOString(),
    })
  }
}
