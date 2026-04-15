import { getModel, type Model } from '@mariozechner/pi-ai'

const DEFAULT_SIPHER_MODEL = 'anthropic/claude-sonnet-4.6'
const DEFAULT_HERALD_MODEL = 'anthropic/claude-sonnet-4.6'

// Derive model ID types from the defaults so casts stay in sync with values
type SipherModelId = typeof DEFAULT_SIPHER_MODEL
type HeraldModelId = typeof DEFAULT_HERALD_MODEL

export function getSipherModel(): Model<'openai-completions'> {
  const modelId = (process.env.SIPHER_MODEL ?? DEFAULT_SIPHER_MODEL) as SipherModelId
  const model = getModel('openrouter', modelId)
  if (!model) {
    throw new Error(
      `SIPHER model not found in pi-ai registry: 'openrouter:${modelId}'. ` +
        `Note: pi-ai uses dot notation (e.g. anthropic/claude-sonnet-4.6, not -4-6).`,
    )
  }
  return model
}

export function getHeraldModel(): Model<'openai-completions'> {
  const modelId = (process.env.HERALD_MODEL ?? DEFAULT_HERALD_MODEL) as HeraldModelId
  const model = getModel('openrouter', modelId)
  if (!model) {
    throw new Error(
      `HERALD model not found in pi-ai registry: 'openrouter:${modelId}'. ` +
        `Note: pi-ai uses dot notation (e.g. anthropic/claude-sonnet-4.6, not -4-6).`,
    )
  }
  return model
}
