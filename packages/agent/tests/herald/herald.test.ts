import { describe, it, expect } from 'vitest'

const {
  HERALD_SYSTEM_PROMPT,
  HERALD_TOOLS,
  HERALD_TOOL_EXECUTORS,
  HERALD_IDENTITY,
} = await import('../../packages/agent/src/herald/herald.js')

describe('HERALD agent factory', () => {
  it('exports HERALD_SYSTEM_PROMPT with HERALD and cypherpunk keywords', () => {
    expect(HERALD_SYSTEM_PROMPT).toContain('HERALD')
    expect(HERALD_SYSTEM_PROMPT).toContain('cypherpunk')
    expect(HERALD_SYSTEM_PROMPT).toContain('X/Twitter')
  })

  it('exports HERALD_TOOLS with 9 tools', () => {
    expect(HERALD_TOOLS).toHaveLength(9)
    const toolNames = HERALD_TOOLS.map((t: { name: string }) => t.name)
    expect(toolNames).toContain('readMentions')
    expect(toolNames).toContain('readDMs')
    expect(toolNames).toContain('searchPosts')
    expect(toolNames).toContain('readUserProfile')
    expect(toolNames).toContain('postTweet')
    expect(toolNames).toContain('replyTweet')
    expect(toolNames).toContain('likeTweet')
    expect(toolNames).toContain('sendDM')
    expect(toolNames).toContain('schedulePost')
  })

  it('exports HERALD_TOOL_EXECUTORS with functions for all 9 tools', () => {
    const executorKeys = Object.keys(HERALD_TOOL_EXECUTORS)
    expect(executorKeys).toHaveLength(9)
    expect(executorKeys).toContain('readMentions')
    expect(executorKeys).toContain('readDMs')
    expect(executorKeys).toContain('searchPosts')
    expect(executorKeys).toContain('readUserProfile')
    expect(executorKeys).toContain('postTweet')
    expect(executorKeys).toContain('replyTweet')
    expect(executorKeys).toContain('likeTweet')
    expect(executorKeys).toContain('sendDM')
    expect(executorKeys).toContain('schedulePost')

    for (const key of executorKeys) {
      expect(typeof HERALD_TOOL_EXECUTORS[key]).toBe('function')
    }
  })

  it('exports HERALD_IDENTITY with correct metadata', () => {
    expect(HERALD_IDENTITY.name).toBe('HERALD')
    expect(HERALD_IDENTITY.role).toBe('Content Agent')
    expect(HERALD_IDENTITY.llm).toBe(true)
    expect(HERALD_IDENTITY.model).toContain('claude')
  })
})
