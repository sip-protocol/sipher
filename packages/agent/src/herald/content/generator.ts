import { chat } from '../../agent.js'
import { HERALD_CONTENT_SYSTEM_PROMPT, buildDraftPrompt } from './prompt.js'
import type { ContentTheme } from './calendar.js'

const MODEL = process.env.HERALD_MODEL ?? 'openrouter:anthropic/claude-sonnet-4.6'
const MAX_TWEET = 280

export interface GenerateDeps {
  chat: typeof chat
}

const defaultDeps: GenerateDeps = { chat }

export async function generateDraft(
  theme: ContentTheme,
  digestText: string,
  deps: GenerateDeps = defaultDeps,
): Promise<string> {
  const prompt = buildDraftPrompt(theme, digestText)
  const { text } = await deps.chat(prompt, {
    systemPrompt: HERALD_CONTENT_SYSTEM_PROMPT,
    model: MODEL,
    tools: [],
  })
  const draft = text.trim()
  // Truncate on code-point boundaries so a multi-byte emoji is never split into a lone surrogate.
  const chars = [...draft]
  return chars.length > MAX_TWEET ? chars.slice(0, MAX_TWEET).join('') : draft
}
