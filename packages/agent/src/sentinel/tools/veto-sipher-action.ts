import type { AnthropicTool } from '../../pi/tool-adapter.js'
import { guardianBus } from '../../coordination/event-bus.js'

export interface VetoSipherParams { contextId: string; reason: string }
export interface VetoSipherResult { vetoed: true; reason: string }

export const vetoSipherTool: AnthropicTool = {
  name: 'vetoSipherAction',
  description:
    'Veto an in-progress SIPHER fund-moving action. Only valid during preflight invocation. ' +
    'Surfaces to the caller as recommendation=block in the RiskReport.',
  input_schema: {
    type: 'object' as const,
    properties: {
      contextId: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['contextId', 'reason'],
  },
}

export async function executeVetoSipher(params: VetoSipherParams): Promise<VetoSipherResult> {
  guardianBus.emit({
    source: 'sentinel',
    type: 'sentinel:veto',
    level: 'critical',
    data: { contextId: params.contextId, reason: params.reason },
    wallet: null,
    timestamp: new Date().toISOString(),
  })
  return { vetoed: true, reason: params.reason }
}
