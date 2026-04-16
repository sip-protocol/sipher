import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('runPreflightRules — β static rules', () => {
  beforeEach(() => { process.env.DB_PATH = ':memory:' })
  afterEach(() => { delete process.env.DB_PATH })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  it('Rule 1 — non-fund-moving tool → allow, needsLLM=false', async () => {
    await freshDb()
    const { runPreflightRules } = await import('../../src/sentinel/preflight-rules.js')
    const r = runPreflightRules('balance', { wallet: 'w1' })
    expect(r.needsLLM).toBe(false)
    expect(r.recommendation).toBe('allow')
    expect(r.staticRuleHit).toBe('not-fund-moving')
  })

  it('Rule 2 — self-transfer → allow, needsLLM=false', async () => {
    await freshDb()
    const { runPreflightRules } = await import('../../src/sentinel/preflight-rules.js')
    const r = runPreflightRules('send', { wallet: 'addr1', recipient: 'addr1', amount: 5 })
    expect(r.needsLLM).toBe(false)
    expect(r.staticRuleHit).toBe('self-transfer')
  })

  it('Rule 3 — blacklist hit → block, needsLLM=false', async () => {
    await freshDb()
    const { insertBlacklist } = await import('../../src/db.js')
    const { runPreflightRules } = await import('../../src/sentinel/preflight-rules.js')
    insertBlacklist({ address: 'badguy', reason: 'scam', severity: 'block', addedBy: 'sentinel' })
    const r = runPreflightRules('send', { wallet: 'w1', recipient: 'badguy', amount: 0.5 })
    expect(r.needsLLM).toBe(false)
    expect(r.recommendation).toBe('block')
    expect(r.staticRuleHit).toBe('blacklist-hit')
  })

  it('Rule 4 — known repeat recipient under skip amount → allow', async () => {
    await freshDb()
    const { getDb } = await import('../../src/db.js')
    const { ulid } = await import('ulid')
    getDb().prepare(`
      INSERT INTO activity_stream (id, agent, level, type, title, detail, wallet, created_at)
      VALUES (?, 'sipher', 'important', 'action', 'send', ?, 'w1', ?)
    `).run(ulid(), JSON.stringify({ recipient: 'friend', amount: 0.5 }), new Date().toISOString())

    const { runPreflightRules } = await import('../../src/sentinel/preflight-rules.js')
    const r = runPreflightRules('send', { wallet: 'w1', recipient: 'friend', amount: 0.05 })
    expect(r.needsLLM).toBe(false)
    expect(r.recommendation).toBe('allow')
    expect(r.staticRuleHit).toBe('known-repeat')
  })

  it('Rule 5 — dust amount (any recipient) → allow', async () => {
    await freshDb()
    const { runPreflightRules } = await import('../../src/sentinel/preflight-rules.js')
    const r = runPreflightRules('send', { wallet: 'w1', recipient: 'stranger', amount: 0.005 })
    expect(r.needsLLM).toBe(false)
    expect(r.staticRuleHit).toBe('dust')
  })

  it('Rule 6 — fallback → needsLLM=true', async () => {
    await freshDb()
    const { runPreflightRules } = await import('../../src/sentinel/preflight-rules.js')
    const r = runPreflightRules('send', { wallet: 'w1', recipient: 'stranger', amount: 5 })
    expect(r.needsLLM).toBe(true)
    expect(r.staticRuleHit).toBeUndefined()
  })

  it('blacklist check runs BEFORE known-repeat (order matters)', async () => {
    await freshDb()
    const { getDb, insertBlacklist } = await import('../../src/db.js')
    const { ulid } = await import('ulid')
    getDb().prepare(`
      INSERT INTO activity_stream (id, agent, level, type, title, detail, wallet, created_at)
      VALUES (?, 'sipher', 'important', 'action', 'send', ?, 'w1', ?)
    `).run(ulid(), JSON.stringify({ recipient: 'friend' }), new Date().toISOString())
    insertBlacklist({ address: 'friend', reason: 'compromised', severity: 'block', addedBy: 'sentinel' })

    const { runPreflightRules } = await import('../../src/sentinel/preflight-rules.js')
    const r = runPreflightRules('send', { wallet: 'w1', recipient: 'friend', amount: 0.05 })
    expect(r.recommendation).toBe('block')
    expect(r.staticRuleHit).toBe('blacklist-hit')
  })

  it('respects SENTINEL_PREFLIGHT_SKIP_AMOUNT override', async () => {
    await freshDb()
    process.env.SENTINEL_PREFLIGHT_SKIP_AMOUNT = '1'
    const { runPreflightRules } = await import('../../src/sentinel/preflight-rules.js')
    const r = runPreflightRules('send', { wallet: 'w1', recipient: 'stranger', amount: 0.05 })
    expect(r.needsLLM).toBe(false)
    expect(r.staticRuleHit).toBe('dust')
    delete process.env.SENTINEL_PREFLIGHT_SKIP_AMOUNT
  })
})
