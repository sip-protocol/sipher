import type { AnthropicTool } from './pi/tool-adapter.js'
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
  swapTool,
  executeSwap,
  viewingKeyTool,
  executeViewingKey,
  historyTool,
  executeHistory,
  statusTool,
  executeStatus,
  paymentLinkTool,
  executePaymentLink,
  invoiceTool,
  executeInvoice,
  privacyScoreTool,
  executePrivacyScore,
  threatCheckTool,
  executeThreatCheck,
  roundAmountTool,
  executeRoundAmount,
  scheduleSendTool,
  executeScheduleSend,
  splitSendTool,
  executeSplitSend,
  dripTool,
  executeDrip,
  recurringTool,
  executeRecurring,
  sweepTool,
  executeSweep,
  consolidateTool,
  executeConsolidate,
  assessRiskTool,
  executeAssessRisk,
} from './tools/index.js'
import type { AgentMessage } from '@mariozechner/pi-agent-core'
import { createPiAgent } from './pi/sipher-agent.js'
import { streamPiAgent } from './pi/stream-bridge.js'
import { attachToolGuard } from './pi/tool-guard.js'
import { runPreflightGate, type AdvisoryInfo } from './sentinel/preflight-gate.js'
import { getSentinelConfig } from './sentinel/config.js'
import { createPending } from './sentinel/pending.js'

// ─────────────────────────────────────────────────────────────────────────────
// System prompt — Sipher's identity and behavior rules
// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are Sipher — SIP Protocol's privacy agent.
Tagline: "Plug in. Go private."

You help users manage private transactions on Solana through a PDA vault.
Users deposit tokens, then you execute private sends, swaps, and refunds.

Tone: Confident, technical, slightly cypherpunk. Never corporate.
Never say "I'm just an AI." Speak like a privacy engineer who cares.

Available tools: deposit, send, refund, balance, scan, claim, swap, viewingKey, history, status, paymentLink, invoice, privacyScore, threatCheck, roundAmount, scheduleSend, splitSend, drip, recurring, sweep, consolidate, assessRisk.

Rules:
- Every fund-moving operation shows a confirmation before executing
- Never display full viewing keys in chat — provide download links
- If vault anonymity set is low, warn the user
- Always reassure funds are safe when errors occur
- Be concise — bullet points over paragraphs
- Before large sends, run threatCheck on the recipient address
- Offer privacyScore when users ask about their wallet's exposure
- Payment links and invoices generate stealth addresses — sender needs no Sipher account
- Scheduled ops (scheduleSend, splitSend, drip, recurring) run via the crank worker — user signs once
- Suggest splitSend for large amounts and drip for recurring distributions
- sweep is persistent — runs every 60 seconds until expired
- consolidate staggers claims to prevent timing analysis`

// ─────────────────────────────────────────────────────────────────────────────
// Tool registry
// ─────────────────────────────────────────────────────────────────────────────

export const TOOLS: AnthropicTool[] = [
  depositTool,
  sendTool,
  refundTool,
  balanceTool,
  scanTool,
  claimTool,
  swapTool,
  viewingKeyTool,
  historyTool,
  statusTool,
  paymentLinkTool,
  invoiceTool,
  privacyScoreTool,
  threatCheckTool,
  roundAmountTool,
  scheduleSendTool,
  splitSendTool,
  dripTool,
  recurringTool,
  sweepTool,
  consolidateTool,
  assessRiskTool,
]

type ToolExecutor = (params: Record<string, unknown>) => Promise<unknown>

const TOOL_EXECUTORS: Record<string, ToolExecutor> = {
  deposit: (p) => executeDeposit(p as unknown as Parameters<typeof executeDeposit>[0]),
  send: (p) => executeSend(p as unknown as Parameters<typeof executeSend>[0]),
  refund: (p) => executeRefund(p as unknown as Parameters<typeof executeRefund>[0]),
  balance: (p) => executeBalance(p as unknown as Parameters<typeof executeBalance>[0]),
  scan: (p) => executeScan(p as unknown as Parameters<typeof executeScan>[0]),
  claim: (p) => executeClaim(p as unknown as Parameters<typeof executeClaim>[0]),
  swap: (p) => executeSwap(p as unknown as Parameters<typeof executeSwap>[0]),
  viewingKey: (p) => executeViewingKey(p as unknown as Parameters<typeof executeViewingKey>[0]),
  history: (p) => executeHistory(p as unknown as Parameters<typeof executeHistory>[0]),
  status: () => executeStatus(),
  paymentLink: (p) => executePaymentLink(p as unknown as Parameters<typeof executePaymentLink>[0]),
  invoice: (p) => executeInvoice(p as unknown as Parameters<typeof executeInvoice>[0]),
  privacyScore: (p) => executePrivacyScore(p as unknown as Parameters<typeof executePrivacyScore>[0]),
  threatCheck: (p) => executeThreatCheck(p as unknown as Parameters<typeof executeThreatCheck>[0]),
  roundAmount: (p) => executeRoundAmount(p as unknown as Parameters<typeof executeRoundAmount>[0]),
  scheduleSend: (p) => executeScheduleSend(p as unknown as Parameters<typeof executeScheduleSend>[0]),
  splitSend: (p) => executeSplitSend(p as unknown as Parameters<typeof executeSplitSend>[0]),
  drip: (p) => executeDrip(p as unknown as Parameters<typeof executeDrip>[0]),
  recurring: (p) => executeRecurring(p as unknown as Parameters<typeof executeRecurring>[0]),
  sweep: (p) => executeSweep(p as unknown as Parameters<typeof executeSweep>[0]),
  consolidate: (p) => executeConsolidate(p as unknown as Parameters<typeof executeConsolidate>[0]),
  assessRisk: (p) => executeAssessRisk(p as unknown as Parameters<typeof executeAssessRisk>[0]),
}

/**
 * Execute a tool by name with the given input.
 * Runs preflight gate for fund-moving tools before dispatching.
 * Throws if the tool name is not registered or SENTINEL blocks.
 *
 * `onPause` is awaited (before the underlying executor) when SENTINEL flagged
 * the action without blocking AND mode === 'advisory'. The callback's promise
 * represents the user-driven approve/cancel decision:
 *   - resolves → continue and run the tool
 *   - rejects  → return a synthetic `{ status: 'cancelled_by_user', reason }`
 *                result instead of running the tool. Pi treats this as the
 *                tool's output; the LLM then communicates cancellation to the
 *                user per its system prompt.
 *
 * The callback is optional — existing 2-arg callers compile unchanged and
 * silently skip the pause (the tool runs as if no advisory existed).
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  onPause?: (info: AdvisoryInfo) => Promise<void>,
): Promise<unknown> {
  const executor = TOOL_EXECUTORS[name]
  if (!executor) {
    throw new Error(`Unknown tool: ${name}`)
  }
  // Preflight gate — runs static rules first, then optionally SENTINEL LLM
  const gate = await runPreflightGate(name, input)
  if (!gate.allowed) {
    throw new Error(`SENTINEL blocked: ${gate.reasons.join('; ')}`)
  }
  if (gate.advisory && onPause && getSentinelConfig().mode === 'advisory') {
    try {
      await onPause(gate.advisory)
    } catch (err) {
      // User cancelled or the pending promise timed out — return a synthetic
      // tool result so Pi's tool loop continues instead of throwing. The LLM
      // sees this output and reports cancellation gracefully to the user.
      return {
        status: 'cancelled_by_user',
        reason: err instanceof Error ? err.message : 'cancelled',
      }
    }
  }
  return executor(input)
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent conversation loop — Pi SDK backed
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatOptions {
  /** Override system prompt */
  systemPrompt?: string
  /** Override tool registry */
  tools?: AnthropicTool[]
  /** Override tool executor (defaults to executeTool) */
  toolExecutor?: (name: string, input: Record<string, unknown>) => Promise<unknown>
  /** Override model in 'provider:modelId' format (defaults to getSipherModel()) */
  model?: string
  /** Prior conversation history in Pi AgentMessage format */
  history?: AgentMessage[]
  /** Optional session id for cache routing */
  sessionId?: string
}

// ─── SSE event types emitted by chatStream ──────────────────────────────────

export interface SSEContentDelta {
  type: 'content_block_delta'
  text: string
}

export interface SSEToolUse {
  type: 'tool_use'
  name: string
  id: string
}

export interface SSEToolResult {
  type: 'tool_result'
  name: string
  id: string
  success: boolean
}

export interface SSEMessageComplete {
  type: 'message_complete'
  content: string
}

export interface SSEError {
  type: 'error'
  message: string
}

export interface SSESentinelPause {
  type: 'sentinel_pause'
  /** Server-issued ID — client posts to /api/sentinel/override/:flagId or /cancel/:flagId */
  flagId: string
  /** Humanized action label, e.g. "Send to Abc...123" */
  action: string
  /** Optional amount string, e.g. "5 SOL" — empty when not applicable */
  amount: string
  /** Risk severity — low | medium | high */
  severity: string
  /** Concatenated reasons from the RiskReport */
  description: string
}

export type SSEEvent =
  | SSEContentDelta
  | SSEToolUse
  | SSEToolResult
  | SSEMessageComplete
  | SSEError
  | SSESentinelPause

// ─── Local helpers — humanize advisory metadata for the UI ──────────────────

/**
 * Build a short, human-readable label describing the action being taken.
 * Best-effort — falls back to the tool name when no recipient is present.
 */
function humanizeAction(name: string, input: Record<string, unknown>): string {
  const recipient = typeof input.recipient === 'string' ? input.recipient : undefined
  const verb =
    name === 'send' ? 'Send to' :
    name === 'swap' ? 'Swap' :
    name === 'deposit' ? 'Deposit' :
    name === 'refund' ? 'Refund' :
    name === 'sweep' ? 'Sweep' :
    name === 'consolidate' ? 'Consolidate' :
    name === 'splitSend' ? 'Split-send to' :
    name === 'scheduleSend' ? 'Schedule send to' :
    name === 'drip' ? 'Drip to' :
    name === 'recurring' ? 'Recurring send to' :
    name
  if (recipient) {
    const short = recipient.length > 8 ? `${recipient.slice(0, 4)}...${recipient.slice(-4)}` : recipient
    return `${verb} ${short}`
  }
  return verb
}

/**
 * Format the input amount + token (e.g. "5 SOL") or empty string when unset.
 */
function extractAmount(input: Record<string, unknown>): string {
  const amount = input.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return ''
  const token = typeof input.token === 'string' && input.token ? input.token : 'SOL'
  return `${amount} ${token}`
}

/**
 * Run the SIPHER agent loop to completion via Pi SDK.
 *
 * Returns final assistant text and the list of tool names invoked during
 * this turn. Pi handles the agentic tool loop internally — no manual
 * while-loop required.
 */
export async function chat(
  userMessage: string,
  opts: ChatOptions = {},
): Promise<{ text: string; toolsUsed: string[] }> {
  const agent = createPiAgent({
    systemPrompt: opts.systemPrompt ?? SYSTEM_PROMPT,
    tools: opts.tools ?? TOOLS,
    toolExecutor: opts.toolExecutor ?? executeTool,
    model: opts.model,
    history: opts.history,
    sessionId: opts.sessionId,
  })

  const toolsUsed: string[] = []
  agent.subscribe((event) => {
    if (event.type === 'tool_execution_start') {
      const e = event as { type: 'tool_execution_start'; toolName: string }
      toolsUsed.push(e.toolName)
    }
  })

  const guardUnsub = attachToolGuard(agent)
  try {
    await agent.prompt(userMessage)
  } finally {
    guardUnsub()
  }

  // Extract final assistant text from agent.state.messages
  const messages = agent.state.messages
  const finalAssistant = [...messages]
    .reverse()
    .find((m) => (m as { role: string }).role === 'assistant') as
    | { role: string; content?: Array<{ type: string; text?: string }> }
    | undefined

  const text =
    finalAssistant?.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('') ?? ''

  return { text, toolsUsed }
}

/**
 * Streaming version — yields SSE-compatible events as the Pi agent runs.
 *
 * Pi SDK drives the agentic tool loop internally. The stream-bridge converts
 * Pi's push-based event model to a pull-based async generator of SSEEvents
 * compatible with AgentCore's SSEEvent vocabulary.
 *
 * SENTINEL pause/resume: When the default executor (`executeTool`) is in use
 * and SENTINEL flagged the action without blocking, a pending flag is created
 * (sentinel/pending.ts) and a `sentinel_pause` SSE event is injected into the
 * stream-bridge's external queue. The executor awaits the pending promise
 * until the user POSTs to `/api/sentinel/override/:flagId` (resume) or
 * `/cancel/:flagId` (cancel). Cancellation is surfaced as a synthetic
 * `{ status: 'cancelled_by_user' }` tool result; the LLM reports it back.
 *
 * The pause event MUST go through streamPiAgent's external queue (not a
 * chatStream-local buffer) — the wrapped executor blocks Pi between
 * `tool_execution_start` and `tool_execution_end`, so any local drain pattern
 * keyed on `tool_result` deadlocks: client never sees pause → never approves
 * → executor blocks forever → bridge yields nothing. The external queue lets
 * the bridge emit pause events while the executor is still mid-await.
 *
 * Custom `opts.toolExecutor` overrides bypass pause capture (no preflight gate).
 */
export async function* chatStream(
  userMessage: string,
  opts: ChatOptions = {},
): AsyncGenerator<SSEEvent> {
  const sessionId = opts.sessionId ?? 'unknown'
  const externalQueue: SSESentinelPause[] = []
  let externalWake: (() => void) | null = null
  const baseExecutor = opts.toolExecutor ?? executeTool

  // Wrap the executor so SENTINEL advisory pauses are captured and routed
  // through the stream-bridge's external queue. We keep the wrapper signature
  // `(name, input) => Promise` to match the Pi executor contract and only
  // intercept calls that route through the default `executeTool`. Custom
  // executors are invoked unchanged.
  const wrappedExecutor = (name: string, input: Record<string, unknown>): Promise<unknown> => {
    if (baseExecutor === executeTool) {
      return executeTool(name, input, async (adv) => {
        const { flagId, promise } = createPending(sessionId, name, input)
        externalQueue.push({
          type: 'sentinel_pause',
          flagId,
          action: humanizeAction(name, input),
          amount: extractAmount(input),
          severity: adv.severity,
          description: adv.description,
        })
        // Wake the bridge so it drains externalQueue immediately. Without this
        // the pause event would sit until Pi emitted another event — which
        // can't happen because Pi is blocked on this awaiting executor.
        if (externalWake) externalWake()
        await promise
      })
    }
    return baseExecutor(name, input)
  }

  const agent = createPiAgent({
    systemPrompt: opts.systemPrompt ?? SYSTEM_PROMPT,
    tools: opts.tools ?? TOOLS,
    toolExecutor: wrappedExecutor,
    model: opts.model,
    history: opts.history,
    sessionId: opts.sessionId,
  })

  for await (const event of streamPiAgent<SSESentinelPause>(agent, userMessage, {
    externalQueue,
    attachWake: (wake) => {
      externalWake = wake
    },
  })) {
    yield event
  }
}
