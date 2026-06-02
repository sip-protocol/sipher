import { describe, it, expect, vi } from 'vitest'
import { generateDraft } from '../../../src/herald/content/generator.js'
import type { ContentTheme } from '../../../src/herald/content/calendar.js'

const theme: ContentTheme = { day: 'Mon', theme: 'SDK tip', focus: 'a concrete SDK snippet' }

describe('generateDraft', () => {
  it('calls chat with the content system prompt and returns a trimmed draft', async () => {
    const fakeChat = vi.fn().mockResolvedValue({ text: '  Privacy is a default, not a feature. 🔒  ', toolsUsed: [] })
    const draft = await generateDraft(theme, 'digest text', { chat: fakeChat })

    expect(draft).toBe('Privacy is a default, not a feature. 🔒')
    expect(fakeChat).toHaveBeenCalledTimes(1)
    const [message, opts] = fakeChat.mock.calls[0]
    expect(message).toContain('a concrete SDK snippet')
    expect(opts.systemPrompt).toMatch(/HERALD/)
    expect(opts.model).toMatch(/^openrouter:/)
    expect(opts.tools).toEqual([])
  })

  it('truncates drafts longer than 280 characters', async () => {
    const long = 'x'.repeat(400)
    const fakeChat = vi.fn().mockResolvedValue({ text: long, toolsUsed: [] })
    const draft = await generateDraft(theme, 'digest', { chat: fakeChat })
    expect(draft.length).toBe(280)
  })

  it('truncates on code-point boundaries (no split surrogate pairs)', async () => {
    const input = 'a' + '😀'.repeat(300)
    const fakeChat = vi.fn().mockResolvedValue({ text: input, toolsUsed: [] })
    const draft = await generateDraft(theme, 'digest', { chat: fakeChat })
    expect([...draft].length).toBe(280)
    expect(/[\uD800-\uDBFF]$/.test(draft)).toBe(false)
  })
})
