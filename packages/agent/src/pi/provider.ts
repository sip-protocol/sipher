import { getModel, type Model } from '@mariozechner/pi-ai'

const DEFAULT_SIPHER_MODEL = 'anthropic/claude-sonnet-4.6'
const DEFAULT_HERALD_MODEL = 'anthropic/claude-sonnet-4.6'

export function getSipherModel(): Model<'openai-completions'> {
  const modelId = (process.env.SIPHER_MODEL ?? DEFAULT_SIPHER_MODEL) as any
  return getModel('openrouter', modelId)
}

export function getHeraldModel(): Model<'openai-completions'> {
  const modelId = (process.env.HERALD_MODEL ?? DEFAULT_HERALD_MODEL) as any
  return getModel('openrouter', modelId)
}
