import { logCost, getCostTotals } from '../db.js'
import { guardianBus } from '../coordination/event-bus.js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BudgetGate = 'normal' | 'cautious' | 'dm-only' | 'paused'

// ─────────────────────────────────────────────────────────────────────────────
// Cost table — X API v2 pay-per-use pricing (USD per resource unit)
// ─────────────────────────────────────────────────────────────────────────────

const COST_TABLE: Record<string, number> = {
  posts_read: 0.005,
  user_read: 0.010,
  dm_read: 0.010,
  content_create: 0.005,
  dm_create: 0.015,
  user_interaction: 0.015,
  mentions_read: 0.005,
  search_read: 0.005,
}

// ─────────────────────────────────────────────────────────────────────────────
// Gate → blocked operation sets (circuit breaker)
// dm-only: blocks everything except dm_read, dm_create, user_read
// paused:  blocks all operations
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_OPS: Record<BudgetGate, Set<string>> = {
  normal: new Set(),
  cautious: new Set(),
  'dm-only': new Set([
    'mentions_read',
    'search_read',
    'posts_read',
    'content_create',
    'user_interaction',
  ]),
  paused: new Set(Object.keys(COST_TABLE)),
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal state for gate-change events
// ─────────────────────────────────────────────────────────────────────────────

let _lastGate: BudgetGate = 'normal'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getMonthlyBudget(): number {
  return Number(process.env.HERALD_MONTHLY_BUDGET ?? '150')
}

function computeGate(percentage: number): BudgetGate {
  if (percentage >= 100) return 'paused'
  if (percentage >= 95) return 'dm-only'
  if (percentage >= 80) return 'cautious'
  return 'normal'
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record an X API call cost.
 * Emits a `herald:budget` event on the guardianBus if the gate changes.
 */
export function trackXApiCost(operation: string, resourceCount: number): void {
  const unitCost = COST_TABLE[operation] ?? 0.005
  const totalCost = unitCost * resourceCount

  logCost({
    agent: 'herald',
    provider: 'x_api',
    operation,
    cost_usd: totalCost,
    resources: resourceCount,
  })

  // emit gate-change event if the budget gate has shifted
  const { gate, spent, limit, percentage } = getBudgetStatus()
  if (gate !== _lastGate) {
    const prev = _lastGate
    _lastGate = gate
    guardianBus.emit({
      source: 'herald',
      type: 'herald:budget',
      level: gate === 'paused' ? 'critical' : gate === 'dm-only' ? 'important' : 'routine',
      data: { gate, prev, spent, limit, percentage },
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Return current budget status.
 * Reads live totals from the cost_log via getCostTotals('month').
 */
export function getBudgetStatus(): {
  spent: number
  limit: number
  gate: BudgetGate
  percentage: number
} {
  const totals = getCostTotals('month')
  const spent = totals.herald ?? 0
  const limit = getMonthlyBudget()
  const percentage = limit > 0 ? (spent / limit) * 100 : 0
  const gate = computeGate(percentage)

  return { spent, limit, gate, percentage }
}

/**
 * Returns false if the given operation is blocked by the current budget gate.
 */
export function canMakeCall(operation: string): boolean {
  const { gate } = getBudgetStatus()
  return !BLOCKED_OPS[gate].has(operation)
}
