import { describe, it, expect, afterEach } from 'vitest'

const { getSipherModel, getHeraldModel } = await import('../../src/pi/provider.js')

describe('Pi AI provider', () => {
  afterEach(() => {
    delete process.env.SIPHER_MODEL
    delete process.env.HERALD_MODEL
  })

  it('creates SIPHER model with OpenRouter', () => {
    const model = getSipherModel()
    expect(model).toBeDefined()
    expect(model.id).toBe('anthropic/claude-sonnet-4.6')
    expect(model.provider).toBe('openrouter')
    expect(model.api).toBe('openai-completions')
  })

  it('creates HERALD model with OpenRouter', () => {
    const model = getHeraldModel()
    expect(model).toBeDefined()
    expect(model.id).toBe('anthropic/claude-sonnet-4.6')
    expect(model.provider).toBe('openrouter')
    expect(model.api).toBe('openai-completions')
  })

  it('respects SIPHER_MODEL env var override', () => {
    process.env.SIPHER_MODEL = 'anthropic/claude-haiku-4.5'
    const model = getSipherModel()
    expect(model).toBeDefined()
    expect(model.id).toBe('anthropic/claude-haiku-4.5')
    expect(model.provider).toBe('openrouter')
  })

  it('respects HERALD_MODEL env var override', () => {
    process.env.HERALD_MODEL = 'anthropic/claude-haiku-4.5'
    const model = getHeraldModel()
    expect(model).toBeDefined()
    expect(model.id).toBe('anthropic/claude-haiku-4.5')
    expect(model.provider).toBe('openrouter')
  })

  it('returns models with expected properties', () => {
    const sipherModel = getSipherModel()
    expect(sipherModel).toHaveProperty('id')
    expect(sipherModel).toHaveProperty('name')
    expect(sipherModel).toHaveProperty('api')
    expect(sipherModel).toHaveProperty('provider')
    expect(sipherModel).toHaveProperty('baseUrl')
    expect(sipherModel).toHaveProperty('reasoning')
    expect(sipherModel).toHaveProperty('input')
    expect(sipherModel).toHaveProperty('cost')
    expect(sipherModel).toHaveProperty('contextWindow')
    expect(sipherModel).toHaveProperty('maxTokens')
  })
})
