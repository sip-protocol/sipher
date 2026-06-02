import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateDailyContent, startContentCron, stopContentCron, type DailyContentDeps } from '../../../src/herald/content/cron.js'

function makeDeps(over: Partial<DailyContentDeps> = {}): DailyContentDeps {
  return {
    isKillSwitchActive: vi.fn().mockReturnValue(false),
    isPaused: vi.fn().mockReturnValue(false),
    hasGeneratedToday: vi.fn().mockReturnValue(false),
    fetchGitHubDigest: vi.fn().mockResolvedValue({ repo: 'r', stars: 1, commits: [], mergedPRs: [], releases: [], errors: [] }),
    formatDigest: vi.fn().mockReturnValue('digest text'),
    themeForDate: vi.fn().mockReturnValue({ day: 'Mon', theme: 'SDK tip', focus: 'a snippet' }),
    generateDraft: vi.fn().mockResolvedValue('a fresh draft'),
    enqueueContentPost: vi.fn().mockReturnValue({ id: 'q1' }),
    now: () => new Date('2026-06-02T12:00:00Z'),
    ...over,
  }
}

afterEach(() => {
  delete process.env.HERALD_CONTENT_CRON_ENABLED
})

describe('generateDailyContent', () => {
  it('skips when a post was already generated today', async () => {
    const deps = makeDeps({ hasGeneratedToday: vi.fn().mockReturnValue(true) })
    const result = await generateDailyContent(deps)
    expect(result).toEqual({ generated: false, reason: 'already-generated-today' })
    expect(deps.enqueueContentPost).not.toHaveBeenCalled()
  })

  it('drafts and enqueues when none exists yet', async () => {
    const deps = makeDeps()
    const result = await generateDailyContent(deps)
    expect(deps.generateDraft).toHaveBeenCalledWith(expect.objectContaining({ theme: 'SDK tip' }), 'digest text')
    expect(deps.enqueueContentPost).toHaveBeenCalledWith('a fresh draft')
    expect(result).toEqual({ generated: true, id: 'q1' })
  })

  it('skips enqueue when the draft is empty', async () => {
    const deps = makeDeps({ generateDraft: vi.fn().mockResolvedValue('   ') })
    const result = await generateDailyContent(deps)
    expect(result).toEqual({ generated: false, reason: 'empty-draft' })
    expect(deps.enqueueContentPost).not.toHaveBeenCalled()
  })

  it('skips when the kill switch is active', async () => {
    const deps = makeDeps({ isKillSwitchActive: vi.fn().mockReturnValue(true) })
    const result = await generateDailyContent(deps)
    expect(result).toEqual({ generated: false, reason: 'kill-switch-active' })
    expect(deps.enqueueContentPost).not.toHaveBeenCalled()
  })

  it('skips when the budget gate is paused', async () => {
    const deps = makeDeps({ isPaused: vi.fn().mockReturnValue(true) })
    const result = await generateDailyContent(deps)
    expect(result).toEqual({ generated: false, reason: 'budget-paused' })
    expect(deps.enqueueContentPost).not.toHaveBeenCalled()
  })
})

describe('startContentCron', () => {
  it('returns null when disabled', () => {
    delete process.env.HERALD_CONTENT_CRON_ENABLED
    expect(startContentCron()).toBeNull()
  })

  it('returns a timer when enabled', () => {
    process.env.HERALD_CONTENT_CRON_ENABLED = 'true'
    const timer = startContentCron()
    expect(timer).not.toBeNull()
    if (timer) clearInterval(timer)
  })

  it('stopContentCron is a no-op on null and clears a real timer', () => {
    expect(() => stopContentCron(null)).not.toThrow()
    process.env.HERALD_CONTENT_CRON_ENABLED = 'true'
    const timer = startContentCron()
    expect(() => stopContentCron(timer)).not.toThrow()
  })
})
