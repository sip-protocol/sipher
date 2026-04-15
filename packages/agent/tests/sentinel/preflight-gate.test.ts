import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('preflight gate in executeTool', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:'
    vi.resetModules()
  })
  afterEach(() => { delete process.env.DB_PATH })

  async function freshDb() {
    const { closeDb, getDb } = await import('../../src/db.js')
    closeDb()
    getDb()
  }

  it('non-fund-moving tools bypass preflight entirely', async () => {
    await freshDb()
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    const assess = vi.fn()
    setSentinelAssessor(assess as never)
    const { executeTool } = await import('../../src/agent.js')
    // balance is not fund-moving — should not call assessor
    try { await executeTool('balance', { wallet: 'w1', token: 'SOL' }) } catch {}
    expect(assess).not.toHaveBeenCalled()
  })

  it('fund-moving action with blacklisted recipient → blocks before LLM', async () => {
    await freshDb()
    const { insertBlacklist } = await import('../../src/db.js')
    insertBlacklist({ address: 'badguy', reason: 'scam', severity: 'block', addedBy: 'sentinel' })
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    const assess = vi.fn()
    setSentinelAssessor(assess as never)
    const { executeTool } = await import('../../src/agent.js')
    await expect(
      executeTool('send', { wallet: 'w1', recipient: 'badguy', amount: 5 }),
    ).rejects.toThrow(/SENTINEL blocked/i)
    expect(assess).not.toHaveBeenCalled() // static rule hit; no LLM call
  })

  it('fund-moving action with unknown recipient → LLM engaged; allow passes through', async () => {
    await freshDb()
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    const assess = vi.fn().mockResolvedValue({
      risk: 'low', score: 5, reasons: ['ok'], recommendation: 'allow',
      decisionId: 'dec1', durationMs: 100,
    })
    setSentinelAssessor(assess as never)
    // Mock the send tool's SDK dependencies so it doesn't hit RPC
    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: vi.fn().mockResolvedValue({ action: 'send', success: true }),
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')
    const result = await executeTool('send', { wallet: 'w1', recipient: 'stranger', amount: 5 })
    expect(assess).toHaveBeenCalledWith(expect.objectContaining({
      action: 'send', wallet: 'w1', recipient: 'stranger', amount: 5,
    }))
    expect(result).toMatchObject({ success: true })
    vi.doUnmock('../../src/tools/send.js')
  })

  it('LLM returns block → executeTool throws', async () => {
    await freshDb()
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    const assess = vi.fn().mockResolvedValue({
      risk: 'high', score: 90, reasons: ['suspicious'],
      recommendation: 'block', blockers: ['address was reported yesterday'],
      decisionId: 'dec1', durationMs: 100,
    })
    setSentinelAssessor(assess as never)
    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: vi.fn(),
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')
    await expect(executeTool('send', { wallet: 'w1', recipient: 'stranger', amount: 5 }))
      .rejects.toThrow(/SENTINEL blocked.*reported yesterday/i)
    vi.doUnmock('../../src/tools/send.js')
  })

  it('SENTINEL_MODE=off skips preflight entirely', async () => {
    await freshDb()
    process.env.SENTINEL_MODE = 'off'
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    const assess = vi.fn()
    setSentinelAssessor(assess as never)
    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: vi.fn().mockResolvedValue({ action: 'send', success: true }),
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')
    await executeTool('send', { wallet: 'w1', recipient: 'stranger', amount: 5 })
    expect(assess).not.toHaveBeenCalled()
    delete process.env.SENTINEL_MODE
    vi.doUnmock('../../src/tools/send.js')
  })

  it('SentinelCore error with SENTINEL_BLOCK_ON_ERROR=true → blocks', async () => {
    await freshDb()
    process.env.SENTINEL_BLOCK_ON_ERROR = 'true'
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockRejectedValue(new Error('LLM outage')) as never)
    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: vi.fn(),
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')
    await expect(executeTool('send', { wallet: 'w1', recipient: 'stranger', amount: 5 }))
      .rejects.toThrow(/SENTINEL/)
    delete process.env.SENTINEL_BLOCK_ON_ERROR
    vi.doUnmock('../../src/tools/send.js')
  })

  it('SentinelCore error with default (fail-open) → tool proceeds', async () => {
    await freshDb()
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockRejectedValue(new Error('LLM outage')) as never)
    vi.doMock('../../src/tools/send.js', () => ({
      executeSend: vi.fn().mockResolvedValue({ action: 'send', success: true }),
      sendTool: { name: 'send', description: '', input_schema: { type: 'object', properties: {} } },
    }))
    const { executeTool } = await import('../../src/agent.js')
    const r = await executeTool('send', { wallet: 'w1', recipient: 'stranger', amount: 5 })
    expect(r).toMatchObject({ success: true })
    vi.doUnmock('../../src/tools/send.js')
  })

  it('assessRiskTool invokes the injected SentinelCore assessor', async () => {
    await freshDb()
    const report = { risk: 'medium', score: 40, reasons: ['new'], recommendation: 'warn',
      decisionId: 'dec1', durationMs: 200 }
    const { setSentinelAssessor } = await import('../../src/sentinel/preflight-gate.js')
    setSentinelAssessor(vi.fn().mockResolvedValue(report) as never)
    const { executeAssessRisk } = await import('../../src/tools/assess-risk.js')
    const out = await executeAssessRisk({ action: 'send', wallet: 'w1', recipient: 'r1', amount: 2 })
    expect(out).toEqual(report)
  })
})
