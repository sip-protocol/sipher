import type { AgentMessage } from '@mariozechner/pi-agent-core'
import type { AnthropicTool } from '../pi/tool-adapter.js'
import type { GuardianEvent } from '../coordination/event-bus.js'
import { guardianBus } from '../coordination/event-bus.js'
import { createPiAgent } from '../pi/sipher-agent.js'
import {
  insertDecisionDraft,
  appendDecisionToolCall,
  finalizeDecision,
  insertRiskHistory,
  dailyDecisionCostUsd,
} from '../db.js'
import { isKillSwitchActive } from '../routes/squad-api.js'
import { getSentinelConfig } from './config.js'
import { SENTINEL_ALL_TOOLS, SENTINEL_ALL_EXECUTORS } from './tools/index.js'
import { SENTINEL_SYSTEM_PROMPT, buildUserMessage, type PreflightContext } from './prompts.js'
import { validateRiskReport, type RiskReport } from './risk-report.js'

const ACTION_TOOL_NAMES = new Set([
  'executeRefund', 'addToBlacklist', 'removeFromBlacklist', 'alertUser',
  'scheduleCancellableAction', 'cancelPendingAction', 'vetoSipherAction',
])

const MAX_TOOLS_PER_RUN = 10

export class SentinelCore {
  async assessRisk(ctx: PreflightContext): Promise<RiskReport> {
    return this.run('preflight', ctx, ctx.wallet ?? null)
  }

  async analyze(event: GuardianEvent): Promise<RiskReport> {
    const ctx: Record<string, unknown> = {
      eventType: event.type,
      wallet: event.wallet ?? null,
      data: event.data,
      level: event.level,
    }
    return this.run('reactive', ctx, event.wallet ?? null, undefined)
  }

  async query(ctx: PreflightContext): Promise<RiskReport> {
    return this.run('query', ctx, ctx.wallet ?? null)
  }

  private async run(
    source: 'preflight' | 'reactive' | 'query',
    context: Record<string, unknown>,
    wallet: string | null,
    triggerEventId?: string,
  ): Promise<RiskReport> {
    const config = getSentinelConfig()
    if (config.mode === 'off') {
      throw new Error('SENTINEL mode=off — LLM analyst disabled')
    }

    const started = Date.now()
    const decisionId = insertDecisionDraft({
      invocationSource: source,
      triggerEventId,
      triggerContext: context,
      model: config.model,
    })

    // Budget warning — non-blocking
    if (dailyDecisionCostUsd() > config.dailyBudgetUsd) {
      guardianBus.emit({
        source: 'sentinel', type: 'sentinel:budget-warning', level: 'important',
        data: { dailyBudgetUsd: config.dailyBudgetUsd },
        wallet, timestamp: new Date().toISOString(),
      })
    }

    let toolCallCount = 0
    const toolExecutor = async (name: string, input: Record<string, unknown>): Promise<unknown> => {
      if (toolCallCount >= MAX_TOOLS_PER_RUN) {
        return { error: 'MAX_TOOLS_PER_RUN reached' }
      }
      toolCallCount++

      // Advisory-mode guard: SENTINEL itself cannot invoke fund-moving action tools
      if (config.mode === 'advisory' && name === 'executeRefund') {
        const err = { error: 'advisory mode: SENTINEL cannot execute refund' }
        appendDecisionToolCall(decisionId, { name, args: input, result: err })
        return err
      }

      // Kill-switch guard (defense in depth, spec §9.5) — applies to all action tools
      if (ACTION_TOOL_NAMES.has(name) && isKillSwitchActive()) {
        const err = { error: 'kill switch active — action tools disabled' }
        appendDecisionToolCall(decisionId, { name, args: input, result: err })
        return err
      }

      const exec = SENTINEL_ALL_EXECUTORS[name]
      if (!exec) {
        const err = { error: `unknown tool: ${name}` }
        appendDecisionToolCall(decisionId, { name, args: input, result: err })
        return err
      }

      let result: unknown
      try {
        result = await exec(input)
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) }
      }
      appendDecisionToolCall(decisionId, { name, args: input, result })
      return result
    }

    const tools: AnthropicTool[] = SENTINEL_ALL_TOOLS
    const agent = createPiAgent({
      systemPrompt: SENTINEL_SYSTEM_PROMPT,
      tools,
      toolExecutor,
      model: config.model,
    })

    try {
      await agent.prompt(buildUserMessage(source, context))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      finalizeDecision(decisionId, {
        verdict: 'error', verdictDetail: { error: msg }, reasoning: '',
        durationMs: Date.now() - started, inputTokens: 0, outputTokens: 0, costUsd: 0,
      })
      // Error verdict returns a conservative block
      return {
        risk: 'high', score: 100, reasons: [`SENTINEL error: ${msg}`],
        recommendation: 'block', blockers: ['LLM invocation failed'],
        decisionId, durationMs: Date.now() - started,
      }
    }

    const messages = agent.state.messages
    const finalAssistant = [...messages].reverse().find(
      (m): m is AgentMessage & { content: Array<{ type: string; text?: string }> } =>
        (m as { role: string }).role === 'assistant',
    )
    const finalText = finalAssistant?.content
      ?.filter((c) => c.type === 'text')
      .map((c) => (c as { text?: string }).text ?? '')
      .join('') ?? ''

    let parsed: Awaited<ReturnType<typeof validateRiskReport>> = null
    try {
      const raw = JSON.parse(finalText) as unknown
      parsed = await validateRiskReport(raw)
    } catch {
      parsed = null
    }

    // Token + cost aggregation from accumulated usage
    let inputTokens = 0, outputTokens = 0, costUsd = 0
    for (const m of messages) {
      const u = (m as { usage?: { input?: number; output?: number; cost?: { total?: number } } }).usage
      if (u) {
        inputTokens += u.input ?? 0
        outputTokens += u.output ?? 0
        costUsd += u.cost?.total ?? 0
      }
    }

    if (!parsed) {
      guardianBus.emit({
        source: 'sentinel', type: 'sentinel:schema-violation', level: 'critical',
        data: { decisionId, rawText: finalText.slice(0, 500) },
        wallet, timestamp: new Date().toISOString(),
      })
      finalizeDecision(decisionId, {
        verdict: 'block', verdictDetail: { reason: 'schema violation' },
        reasoning: finalText.slice(0, 500),
        durationMs: Date.now() - started,
        inputTokens, outputTokens, costUsd,
      })
      return {
        risk: 'high', score: 100,
        reasons: ['SENTINEL output failed schema validation'],
        recommendation: 'block',
        blockers: ['schema-violation'],
        decisionId, durationMs: Date.now() - started,
      }
    }

    const report: RiskReport = {
      ...parsed,
      decisionId,
      durationMs: Date.now() - started,
    }

    // Persist risk-history for preflight + query paths
    if (source !== 'reactive' && typeof context.recipient === 'string') {
      insertRiskHistory({
        address: context.recipient,
        wallet: typeof context.wallet === 'string' ? context.wallet : undefined,
        contextAction: typeof context.action === 'string' ? context.action : undefined,
        risk: parsed.risk, score: parsed.score,
        reasons: parsed.reasons, recommendation: parsed.recommendation,
        decisionId,
      })
    }

    finalizeDecision(decisionId, {
      verdict: parsed.recommendation === 'block' ? 'block' : parsed.recommendation === 'warn' ? 'warn' : 'allow',
      verdictDetail: { ...parsed },
      reasoning: finalText,
      durationMs: Date.now() - started,
      inputTokens, outputTokens, costUsd,
    })

    return report
  }
}
