import { describe, it, expect } from 'vitest'
import { HERALD_CONTENT_SYSTEM_PROMPT, buildDraftPrompt } from '../../../src/herald/content/prompt.js'
import type { ContentTheme } from '../../../src/herald/content/calendar.js'

const theme: ContentTheme = { day: 'Mon', theme: 'SDK tip', focus: 'a concrete SDK snippet' }

describe('content prompt', () => {
  it('system prompt sets the HERALD voice and a 280-char constraint', () => {
    expect(HERALD_CONTENT_SYSTEM_PROMPT).toMatch(/HERALD/)
    expect(HERALD_CONTENT_SYSTEM_PROMPT).toMatch(/280/)
  })

  it('draft prompt embeds the theme focus and the digest', () => {
    const p = buildDraftPrompt(theme, 'Repo sip-protocol/sip-protocol (42 stars):')
    expect(p).toContain('a concrete SDK snippet')
    expect(p).toContain('42 stars')
    expect(p).toContain('280')
  })
})
