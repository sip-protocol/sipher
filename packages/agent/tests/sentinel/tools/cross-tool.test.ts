// packages/agent/tests/sentinel/tools/cross-tool.test.ts
//
// Cross-tool invariants for the SENTINEL tool registry.
// Anything that belongs to a single tool lives in <tool>.test.ts;
// these are checks that span the registry as a whole.

import { describe, it, expect } from 'vitest'
import {
  SENTINEL_READ_TOOLS,
  SENTINEL_ACTION_TOOLS,
  SENTINEL_ALL_TOOLS,
  SENTINEL_READ_EXECUTORS,
  SENTINEL_ACTION_EXECUTORS,
  SENTINEL_ALL_EXECUTORS,
} from '../../../src/sentinel/tools/index.js'

describe('SENTINEL tool registry — read', () => {
  it('exports all 7 read tools by name', () => {
    const names = SENTINEL_READ_TOOLS.map((t) => t.name).sort()
    expect(names).toEqual([
      'checkReputation',
      'getDepositStatus',
      'getOnChainSignatures',
      'getPendingClaims',
      'getRecentActivity',
      'getRiskHistory',
      'getVaultBalance',
    ])
  })

  it('every read tool name has a matching executor', () => {
    for (const tool of SENTINEL_READ_TOOLS) {
      expect(SENTINEL_READ_EXECUTORS).toHaveProperty(tool.name)
      expect(typeof SENTINEL_READ_EXECUTORS[tool.name]).toBe('function')
    }
  })

  it('executor map has no orphan keys (every executor has a tool definition)', () => {
    const toolNames = new Set(SENTINEL_READ_TOOLS.map((t) => t.name))
    for (const key of Object.keys(SENTINEL_READ_EXECUTORS)) {
      expect(toolNames.has(key)).toBe(true)
    }
  })
})

describe('SENTINEL tool registry — action', () => {
  it('exports all 7 action tools by name', () => {
    const names = SENTINEL_ACTION_TOOLS.map((t) => t.name).sort()
    expect(names).toEqual([
      'addToBlacklist',
      'alertUser',
      'cancelPendingAction',
      'executeRefund',
      'removeFromBlacklist',
      'scheduleCancellableAction',
      'vetoSipherAction',
    ])
  })

  it('every action tool name has a matching executor', () => {
    for (const tool of SENTINEL_ACTION_TOOLS) {
      expect(SENTINEL_ACTION_EXECUTORS).toHaveProperty(tool.name)
      expect(typeof SENTINEL_ACTION_EXECUTORS[tool.name]).toBe('function')
    }
  })

  it('executor map has no orphan keys', () => {
    const toolNames = new Set(SENTINEL_ACTION_TOOLS.map((t) => t.name))
    for (const key of Object.keys(SENTINEL_ACTION_EXECUTORS)) {
      expect(toolNames.has(key)).toBe(true)
    }
  })
})

describe('SENTINEL tool registry — combined', () => {
  it('SENTINEL_ALL_TOOLS is the union of read + action (14 tools)', () => {
    expect(SENTINEL_ALL_TOOLS.length).toBe(14)
    expect(SENTINEL_ALL_TOOLS.length).toBe(
      SENTINEL_READ_TOOLS.length + SENTINEL_ACTION_TOOLS.length,
    )
  })

  it('SENTINEL_ALL_EXECUTORS covers every all-tool name', () => {
    const allNames = SENTINEL_ALL_TOOLS.map((t) => t.name).sort()
    const executorKeys = Object.keys(SENTINEL_ALL_EXECUTORS).sort()
    expect(executorKeys).toEqual(allNames)
  })

  it('all tool names are unique across the combined registry', () => {
    const names = SENTINEL_ALL_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
