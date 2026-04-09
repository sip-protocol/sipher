import { Router, type Request, type Response } from 'express'
import { getCostTotals, getAgentEvents } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Kill switch — module-level so it persists across requests within a process.
// Toggled via POST /api/squad/kill.
// ─────────────────────────────────────────────────────────────────────────────

let killSwitchActive = false

export const squadRouter = Router()

/**
 * GET /api/squad
 * Returns the current agent roster, today's LLM costs, recent agent events,
 * and the kill switch state.
 */
squadRouter.get('/', (_req: Request, res: Response) => {
  const costs = getCostTotals('today')
  const events = getAgentEvents({ limit: 20 })

  res.json({
    agents: {
      sipher:   { status: 'active' },
      herald:   { status: 'idle' },
      sentinel: { status: 'idle' },
      courier:  { status: 'idle' },
    },
    costs,
    events,
    killSwitch: killSwitchActive,
  })
})

/**
 * POST /api/squad/kill
 * Toggles the global kill switch. Returns the new state.
 */
squadRouter.post('/kill', (_req: Request, res: Response) => {
  killSwitchActive = !killSwitchActive
  res.json({ killSwitch: killSwitchActive })
})

/** Read-only accessor for other modules that need to honour the kill switch. */
export function isKillSwitchActive(): boolean {
  return killSwitchActive
}
