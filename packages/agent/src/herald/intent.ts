// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IntentType = 'command' | 'question' | 'engagement' | 'spam'

export interface IntentResult {
  intent: IntentType
  tool?: string
  needsExecLink?: boolean
  confidence: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex patterns for classification
// ─────────────────────────────────────────────────────────────────────────────

const COMMAND_PATTERNS: Array<{
  regex: RegExp
  tool: string
  needsExecLink?: boolean
}> = [
  {
    regex: /privacy\s+score/i,
    tool: 'privacyScore',
  },
  {
    regex: /threat\s+check|is\s+.+\s+safe\?/i,
    tool: 'threatCheck',
  },
  {
    regex: /\b(deposit|withdraw|send|transfer)\b/i,
    tool: 'send',
    needsExecLink: true,
  },
  {
    regex: /\b(swap|exchange|trade)\b/i,
    tool: 'swap',
    needsExecLink: true,
  },
  {
    regex: /\b(claim|redeem)\b/i,
    tool: 'claim',
    needsExecLink: true,
  },
  {
    regex: /\b(refund)\b/i,
    tool: 'refund',
    needsExecLink: true,
  },
  {
    regex: /\b(balance|vault)\b/i,
    tool: 'balance',
  },
  {
    regex: /\b(scan|stealth\s+payment)\b/i,
    tool: 'scan',
  },
  {
    regex: /viewing\s+key/i,
    tool: 'viewingKey',
  },
  {
    regex: /\b(history|transactions)\b/i,
    tool: 'history',
  },
]

const SPAM_PATTERNS = [
  /\b(buy\s+now|click\s+here|click\s+now)\b/i,
  /\b(free\s+(crypto|airdrop|nft|tokens))\b/i,
  /\bdm\s+me\s+for\b/i,
  /http[s]?:\/\/(?!sip-protocol|sipher)[^\s]*/i, // external links not from sip-protocol/sipher
]

const QUESTION_PATTERNS = [
  /\b(how\s+(do|does|can|to)|what\s+(is|are)|why|explain|tell\s+me\s+about)\b/i,
  /\?$/,
]

// ─────────────────────────────────────────────────────────────────────────────
// Classifier function
// ─────────────────────────────────────────────────────────────────────────────

export function classifyIntent(text: string): IntentResult {
  // Sanitize: remove @mentions, trim whitespace
  const clean = text
    .replace(/@\S+/g, '')
    .trim()

  // Rule 1: If <3 chars → spam
  if (clean.length < 3) {
    return {
      intent: 'spam',
      confidence: 0.95,
    }
  }

  // Rule 2: Check SPAM patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        intent: 'spam',
        confidence: 0.85,
      }
    }
  }

  // Rule 3: Check COMMAND patterns
  for (const { regex, tool, needsExecLink } of COMMAND_PATTERNS) {
    if (regex.test(clean)) {
      return {
        intent: 'command',
        tool,
        needsExecLink,
        confidence: 0.88,
      }
    }
  }

  // Rule 4: Check QUESTION patterns
  for (const pattern of QUESTION_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        intent: 'question',
        confidence: 0.75,
      }
    }
  }

  // Rule 5: Default → engagement
  return {
    intent: 'engagement',
    confidence: 0.5,
  }
}
