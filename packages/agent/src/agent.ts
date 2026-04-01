import Anthropic from '@anthropic-ai/sdk'
import {
  depositTool,
  executeDeposit,
  sendTool,
  executeSend,
  refundTool,
  executeRefund,
  balanceTool,
  executeBalance,
  scanTool,
  executeScan,
  claimTool,
  executeClaim,
} from './tools/index.js'

// ─────────────────────────────────────────────────────────────────────────────
// System prompt — Sipher's identity and behavior rules
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are Sipher — SIP Protocol's privacy agent.
Tagline: "Plug in. Go private."

You help users manage private transactions on Solana through a PDA vault.
Users deposit tokens, then you execute private sends, swaps, and refunds.

Tone: Confident, technical, slightly cypherpunk. Never corporate.
Never say "I'm just an AI." Speak like a privacy engineer who cares.

Available tools: deposit, send, refund, balance, scan, claim.

Rules:
- Every fund-moving operation shows a confirmation before executing
- Never display full viewing keys in chat — provide download links
- If vault anonymity set is low, warn the user
- Always reassure funds are safe when errors occur
- Be concise — bullet points over paragraphs`

// ─────────────────────────────────────────────────────────────────────────────
// Tool registry
// ─────────────────────────────────────────────────────────────────────────────

export const TOOLS: Anthropic.Tool[] = [
  depositTool,
  sendTool,
  refundTool,
  balanceTool,
  scanTool,
  claimTool,
]

type ToolExecutor = (params: Record<string, unknown>) => Promise<unknown>

const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  deposit: (p) => executeDeposit(p as unknown as Parameters<typeof executeDeposit>[0]),
  send: (p) => executeSend(p as unknown as Parameters<typeof executeSend>[0]),
  refund: (p) => executeRefund(p as unknown as Parameters<typeof executeRefund>[0]),
  balance: (p) => executeBalance(p as unknown as Parameters<typeof executeBalance>[0]),
  scan: (p) => executeScan(p as unknown as Parameters<typeof executeScan>[0]),
  claim: (p) => executeClaim(p as unknown as Parameters<typeof executeClaim>[0]),
}

/**
 * Execute a tool by name with the given input.
 * Throws if the tool name is not registered.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const executor = TOOL_EXECUTORS[name]
  if (!executor) {
    throw new Error(`Unknown tool: ${name}`)
  }
  return executor(input)
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent conversation loop
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL = process.env.SIPHER_MODEL || 'anthropic/claude-sonnet-4-6'
const DEFAULT_MAX_TOKENS = 1024
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export interface AgentOptions {
  model?: string
  maxTokens?: number
  apiKey?: string
}

/**
 * Run a single chat turn with tool execution loop.
 *
 * If Claude responds with tool_use blocks, we execute each tool and
 * feed the results back until Claude produces a final text response
 * (stop_reason === 'end_turn').
 *
 * Returns the final Message (with all content blocks).
 */
export async function chat(
  messages: Anthropic.MessageParam[],
  options: AgentOptions = {}
): Promise<Anthropic.Message> {
  const client = new Anthropic({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: options.apiKey || process.env.SIPHER_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY,
  })
  const model = options.model ?? DEFAULT_MODEL
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS

  // Mutable copy — we append tool results as we loop
  const conversationMessages = [...messages]

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: conversationMessages,
    })

    // If no tool use, we're done
    if (response.stop_reason !== 'tool_use') {
      return response
    }

    // Execute each tool_use block
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlockParam & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use'
    )

    // Add assistant's response (with tool_use blocks) to conversation
    conversationMessages.push({ role: 'assistant', content: response.content })

    // Execute tools and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of toolUseBlocks) {
      try {
        const result = await executeTool(block.name, block.input)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ error: message }),
          is_error: true,
        })
      }
    }

    // Feed tool results back
    conversationMessages.push({ role: 'user', content: toolResults })
  }
}
