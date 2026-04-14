import { Agent, type AgentMessage } from '@mariozechner/pi-agent-core'
import { getModel, type Model } from '@mariozechner/pi-ai'
import type { AgentTool } from '@mariozechner/pi-agent-core'
import type Anthropic from '@anthropic-ai/sdk'
import { toPiTools } from './tool-adapter.js'
import { getSipherModel } from './provider.js'

// ─────────────────────────────────────────────────────────────────────────────
// SIPHER Pi Agent Factory
// ─────────────────────────────────────────────────────────────────────────────
// Builds a fresh Pi Agent per request with sipher-style configuration:
//   - Anthropic-format tools converted to Pi AgentTool format
//   - Tool executor wrapped per-tool as the Pi `execute()` callback
//   - Optional prior history seeded into agent.state.messages
//   - Defaults to SIPHER model if no override provided
//
// Pi tool error convention: throw on failure (the Pi runtime converts throws
// into error ToolResultMessages). Never encode errors in content.
//
// Each call returns a NEW Agent. Callers should not cache or reuse instances
// across conversations — create a fresh agent per request.

export type ToolExecutor = (name: string, input: Record<string, unknown>) => Promise<unknown>

export interface CreatePiAgentOptions {
  systemPrompt: string
  tools: Anthropic.Tool[]
  toolExecutor: ToolExecutor
  /** Override model in 'provider:modelId' format (e.g. 'openrouter:anthropic/claude-haiku-4.5'). */
  model?: string
  /** Prior conversation history to seed into agent state. */
  history?: AgentMessage[]
  /** Optional session id forwarded to providers for cache-aware backends. */
  sessionId?: string
}

/**
 * Build a fresh Pi Agent with sipher-style configuration.
 *
 * Tool calls flow: Pi runtime invokes AgentTool.execute() → delegates to
 * toolExecutor(name, params) → result returned as AgentToolResult.
 * On error, toolExecutor throws propagate as-is — Pi encodes them as
 * error ToolResultMessages in the transcript.
 *
 * @param opts - Agent configuration options
 * @returns A configured Agent instance ready to accept prompts
 * @throws {Error} If opts.model is provided but not in 'provider:modelId' format
 */
export function createPiAgent(opts: CreatePiAgentOptions): Agent {
  const piTools: AgentTool[] = toPiTools(opts.tools).map((tool) => ({
    ...tool,
    // label is required by AgentTool — use description as fallback, then name
    label: tool.description || tool.name,
    execute: async (
      _toolCallId: string,
      params: unknown,
    ) => {
      // Pi convention: throw on failure, never encode errors in content.
      // toolExecutor is expected to throw on error — we let it propagate.
      const result = await opts.toolExecutor(tool.name, params as Record<string, unknown>)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        details: result,
      }
    },
  }))

  let model: Model<'openai-completions'>
  if (opts.model) {
    const colon = opts.model.indexOf(':')
    if (colon < 0) {
      throw new Error(
        `createPiAgent: model must be in 'provider:modelId' format, got '${opts.model}'`,
      )
    }
    const provider = opts.model.slice(0, colon)
    const modelId = opts.model.slice(colon + 1)
    model = getModel(provider as never, modelId as never)
  } else {
    model = getSipherModel()
  }

  return new Agent({
    initialState: {
      systemPrompt: opts.systemPrompt,
      tools: piTools,
      messages: opts.history ?? [],
      model,
    },
    sessionId: opts.sessionId,
  })
}
