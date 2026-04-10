# HERALD X Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give HERALD an LLM brain — when a mention or DM arrives via the poller, the agent reasons about it, uses tools, and responds autonomously through the approval/publishing pipeline.

**Architecture:** Extend `chat()`/`chatStream()` to accept configurable tools and system prompt. Extend `AgentCore` constructor to accept agent identity config. Convert HERALD's Pi SDK tools to Anthropic format. Build an X adapter that subscribes to poller events on the guardian event bus, constructs `MsgContext`, calls AgentCore, and routes responses through HERALD's existing approval queue (mentions) or direct send (DMs).

**Tech Stack:** TypeScript, Anthropic SDK (via OpenRouter), twitter-api-v2, guardian EventBus

---

## Existing Infrastructure (already built, DO NOT rebuild)

| Module | What it does |
|--------|-------------|
| `herald/poller.ts` | Polls mentions, DMs, scheduled posts. Emits `herald:mention` and `herald:dm` events on guardianBus |
| `herald/intent.ts` | Regex classifier → `command \| question \| engagement \| spam` |
| `herald/herald.ts` | `HERALD_SYSTEM_PROMPT`, `HERALD_TOOLS` (Pi SDK format), `HERALD_TOOL_EXECUTORS` |
| `herald/approval.ts` | SQLite queue: pending → approved → posted. Auto-approve with timeout |
| `herald/budget.ts` | Circuit breaker: normal → cautious → dm-only → paused. Per-operation costs |
| `herald/x-client.ts` | Real X API client (bearer read + OAuth write) via `twitter-api-v2` |
| `herald/tools/*` | 9 tools: readMentions, readDMs, searchPosts, readUserProfile, postTweet, replyTweet, likeTweet, sendDM, schedulePost |
| `coordination/event-bus.ts` | `guardianBus` singleton. `emit()`, `on(type, handler)`, `onAny(handler)` |

## Key Design Constraint

HERALD tools use Pi SDK `Tool` type (`parameters` field). The Anthropic API expects `input_schema`. The conversion is a simple field rename: `{ ...tool, input_schema: tool.parameters }`.

## File Structure

| File | Responsibility |
|------|---------------|
| **Modify:** `packages/agent/src/agent.ts` | Accept optional `systemPrompt`, `tools`, `toolExecutors` in `chat()` and `chatStream()` |
| **Modify:** `packages/agent/src/core/types.ts` | Add `AgentConfig` interface |
| **Modify:** `packages/agent/src/core/agent-core.ts` | Constructor accepts `AgentConfig`, passes to chat/chatStream |
| **Create:** `packages/agent/src/adapters/x.ts` | X adapter: subscribe to events → AgentCore → route responses |
| **Create:** `packages/agent/tests/adapters/x.test.ts` | X adapter unit tests |
| **Modify:** `packages/agent/src/index.ts` | Start X adapter alongside poller |

---

### Task 1: Make chat/chatStream accept configurable tools and system prompt

**Files:**
- Modify: `packages/agent/src/agent.ts`

- [ ] **Step 1: Extend AgentOptions interface**

In `packages/agent/src/agent.ts`, extend the `AgentOptions` interface (around line 154):

```typescript
export interface AgentOptions {
  model?: string
  maxTokens?: number
  apiKey?: string
  systemPrompt?: string
  tools?: Anthropic.Tool[]
  toolExecutor?: (name: string, input: Record<string, unknown>) => Promise<unknown>
}
```

- [ ] **Step 2: Update chat() to use options**

In the `chat()` function, replace the hardcoded `SYSTEM_PROMPT` and `TOOLS` with optional overrides:

```typescript
// Line ~222-228: change from
const response = await client.messages.create({
  model,
  max_tokens: maxTokens,
  system: SYSTEM_PROMPT,
  tools: TOOLS,
  messages: conversationMessages,
})

// To:
const response = await client.messages.create({
  model,
  max_tokens: maxTokens,
  system: options.systemPrompt ?? SYSTEM_PROMPT,
  tools: options.tools ?? TOOLS,
  messages: conversationMessages,
})
```

Also update the tool execution inside the loop to use the custom executor:

```typescript
// Line ~249: change from
const result = await executeTool(block.name, block.input)

// To:
const execute = options.toolExecutor ?? executeTool
const result = await execute(block.name, block.input)
```

- [ ] **Step 3: Update chatStream() the same way**

Apply the same pattern to `chatStream()`:
- Use `options.systemPrompt ?? SYSTEM_PROMPT` at line ~299
- Use `options.tools ?? TOOLS` at line ~300
- Use `options.toolExecutor ?? executeTool` at line ~336

- [ ] **Step 4: Run existing tests**

Run: `cd ~/local-dev/sipher && pnpm test -- --run`
Expected: 497 tests pass (no behavior change — all overrides are optional with same defaults)

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/agent.ts
git commit -m "feat: make chat/chatStream accept configurable tools and system prompt"
```

---

### Task 2: Extend AgentCore to accept agent config

**Files:**
- Modify: `packages/agent/src/core/types.ts`
- Modify: `packages/agent/src/core/agent-core.ts`

- [ ] **Step 1: Add AgentConfig type**

In `packages/agent/src/core/types.ts`, add:

```typescript
import type Anthropic from '@anthropic-ai/sdk'

/** Configuration for an agent identity (tools, prompt, model) */
export interface AgentConfig {
  /** System prompt override (defaults to SIPHER's prompt) */
  systemPrompt?: string
  /** Tool definitions override (defaults to SIPHER's 21 tools) */
  tools?: Anthropic.Tool[]
  /** Tool executor override (defaults to SIPHER's executeTool) */
  toolExecutor?: (name: string, input: Record<string, unknown>) => Promise<unknown>
  /** Model override (defaults to SIPHER_MODEL env) */
  model?: string
}
```

Also export it from `packages/agent/src/core/index.ts`.

- [ ] **Step 2: Update AgentCore constructor**

In `packages/agent/src/core/agent-core.ts`:

```typescript
import type { AgentOptions } from '../agent.js'

export class AgentCore {
  private config: AgentConfig

  constructor(config: AgentConfig = {}) {
    this.config = config
  }
```

Then in `processMessage`, pass config to `chat()`:

```typescript
const response = await chat(messages, {
  systemPrompt: this.config.systemPrompt,
  tools: this.config.tools,
  toolExecutor: this.config.toolExecutor,
  model: this.config.model,
})
```

And in `streamMessage`, pass to `chatStream()`:

```typescript
for await (const event of chatStream(messages, {
  systemPrompt: this.config.systemPrompt,
  tools: this.config.tools,
  toolExecutor: this.config.toolExecutor,
  model: this.config.model,
})) {
```

- [ ] **Step 3: Run all tests**

Run: `cd ~/local-dev/sipher && pnpm test -- --run`
Expected: 497 pass. Run: `cd ~/local-dev/sipher/packages/agent && npx vitest run`
Expected: All agent tests pass (config is optional, defaults unchanged).

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/core/types.ts packages/agent/src/core/index.ts packages/agent/src/core/agent-core.ts
git commit -m "feat: AgentCore accepts configurable agent identity (tools, prompt, model)"
```

---

### Task 3: Build the X adapter

**Files:**
- Create: `packages/agent/src/adapters/x.ts`
- Create: `packages/agent/tests/adapters/x.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// packages/agent/tests/adapters/x.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock AgentCore
vi.mock('../../src/core/agent-core.js', () => ({
  AgentCore: vi.fn().mockImplementation(() => ({
    processMessage: vi.fn().mockResolvedValue({
      text: 'Privacy is a right, not a privilege.',
      toolsUsed: [],
    }),
  })),
}))

// Mock herald tools (don't call real X API)
vi.mock('../../src/herald/herald.js', () => ({
  HERALD_SYSTEM_PROMPT: 'test herald prompt',
  HERALD_TOOLS: [],
  HERALD_TOOL_EXECUTORS: {},
}))

// Mock budget
vi.mock('../../src/herald/budget.js', () => ({
  getBudgetStatus: vi.fn().mockReturnValue({ gate: 'normal', budget: { remaining: 100 } }),
  canMakeCall: vi.fn().mockReturnValue(true),
  trackXApiCost: vi.fn(),
}))

// Mock X client
vi.mock('../../src/herald/x-client.js', () => ({
  getWriteClient: vi.fn().mockReturnValue({
    v2: {
      reply: vi.fn().mockResolvedValue({ data: { id: 'reply_123' } }),
      sendDmInConversation: vi.fn().mockResolvedValue({ data: { dm_event_id: 'dm_456' } }),
    },
  }),
}))

// Mock event bus
vi.mock('../../src/coordination/event-bus.js', () => {
  const handlers: Record<string, Function[]> = {}
  return {
    guardianBus: {
      on: vi.fn((type: string, handler: Function) => {
        if (!handlers[type]) handlers[type] = []
        handlers[type].push(handler)
      }),
      emit: vi.fn((event: any) => {
        const fns = handlers[event.type] ?? []
        fns.forEach(fn => fn(event))
      }),
    },
  }
})

const { createXAdapter } = await import('../../src/adapters/x.js')
const { guardianBus } = await import('../../src/coordination/event-bus.js')

describe('X Adapter', () => {
  let adapter: ReturnType<typeof createXAdapter>

  beforeEach(() => {
    adapter = createXAdapter()
  })

  it('subscribes to herald:mention and herald:dm events', () => {
    expect(vi.mocked(guardianBus.on)).toHaveBeenCalledWith('herald:mention', expect.any(Function))
    expect(vi.mocked(guardianBus.on)).toHaveBeenCalledWith('herald:dm', expect.any(Function))
  })

  it('ignores spam mentions', async () => {
    const core = adapter.core
    guardianBus.emit({
      source: 'herald',
      type: 'herald:mention',
      level: 'routine',
      data: { mentionId: '1', authorId: 'u1', text: 'spam', intent: 'spam', confidence: 0.95 },
      timestamp: new Date().toISOString(),
    })

    // Give async handler time to run
    await new Promise(r => setTimeout(r, 10))
    expect(core.processMessage).not.toHaveBeenCalled()
  })

  it('processes question mentions through AgentCore', async () => {
    const core = adapter.core
    guardianBus.emit({
      source: 'herald',
      type: 'herald:mention',
      level: 'routine',
      data: { mentionId: '2', authorId: 'u2', text: 'How does SIP work?', intent: 'question', confidence: 0.75 },
      timestamp: new Date().toISOString(),
    })

    await new Promise(r => setTimeout(r, 10))
    expect(core.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'x',
        userId: 'u2',
        message: 'How does SIP work?',
      })
    )
  })

  it('processes DMs through AgentCore', async () => {
    const core = adapter.core
    guardianBus.emit({
      source: 'herald',
      type: 'herald:dm',
      level: 'routine',
      data: { dmId: 'd1', senderId: 'u3', text: 'Check my privacy score', intent: 'command', confidence: 0.88 },
      timestamp: new Date().toISOString(),
    })

    await new Promise(r => setTimeout(r, 10))
    expect(core.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: 'x',
        userId: 'u3',
        message: 'Check my privacy score',
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/local-dev/sipher/packages/agent && npx vitest run tests/adapters/x.test.ts`
Expected: FAIL — `x.js` does not exist

- [ ] **Step 3: Implement the X adapter**

```typescript
// packages/agent/src/adapters/x.ts
import type Anthropic from '@anthropic-ai/sdk'
import { AgentCore } from '../core/agent-core.js'
import type { GuardianEvent } from '../coordination/event-bus.js'
import { guardianBus } from '../coordination/event-bus.js'
import {
  HERALD_SYSTEM_PROMPT,
  HERALD_TOOLS,
  HERALD_TOOL_EXECUTORS,
} from '../herald/herald.js'
import { getBudgetStatus } from '../herald/budget.js'

/**
 * Convert Pi SDK Tool format (parameters) to Anthropic Tool format (input_schema).
 */
function toAnthropicTools(piTools: Array<{ name: string; description: string; parameters: unknown }>): Anthropic.Tool[] {
  return piTools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool.InputSchema,
  }))
}

/** Execute a HERALD tool by name */
function heraldToolExecutor(name: string, input: Record<string, unknown>): Promise<unknown> {
  const executor = HERALD_TOOL_EXECUTORS[name]
  if (!executor) throw new Error(`Unknown HERALD tool: ${name}`)
  return executor(input)
}

/**
 * X adapter — bridges guardian bus events to AgentCore with HERALD identity.
 *
 * Subscribes to:
 * - herald:mention → classify intent → skip spam → AgentCore → reply
 * - herald:dm → classify intent → skip spam → AgentCore → send DM
 */
export function createXAdapter() {
  const core = new AgentCore({
    systemPrompt: HERALD_SYSTEM_PROMPT,
    tools: toAnthropicTools(HERALD_TOOLS as Array<{ name: string; description: string; parameters: unknown }>),
    toolExecutor: heraldToolExecutor,
    model: process.env.HERALD_MODEL ?? 'anthropic/claude-sonnet-4-6',
  })

  // ── Mention handler ──────────────────────────────────────────────────────

  async function handleMention(event: GuardianEvent): Promise<void> {
    const { intent, text, mentionId, authorId } = event.data as {
      intent: string
      text: string
      mentionId: string
      authorId: string | null
    }

    // Skip spam
    if (intent === 'spam') return

    // Check budget gate
    const { gate } = getBudgetStatus()
    if (gate === 'paused' || gate === 'dm-only') return

    const userId = authorId ?? `mention-${mentionId}`

    try {
      const response = await core.processMessage({
        platform: 'x',
        userId,
        message: text,
        metadata: { mentionId, intent },
      })

      // If AgentCore used replyTweet tool, the reply is already posted.
      // If it only returned text, we need to post the reply ourselves.
      if (!response.toolsUsed.includes('replyTweet') && response.text) {
        // Queue as a reply via the tool executor (goes through budget check)
        await heraldToolExecutor('replyTweet', {
          tweet_id: mentionId,
          text: response.text.slice(0, 280),
        })
      }

      guardianBus.emit({
        source: 'herald',
        type: 'herald:reply-sent',
        level: 'routine',
        data: { mentionId, intent, response: response.text.slice(0, 100) },
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      guardianBus.emit({
        source: 'herald',
        type: 'herald:reply-failed',
        level: 'important',
        data: { mentionId, error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      })
    }
  }

  // ── DM handler ────────────────────────────────────────────────────────────

  async function handleDM(event: GuardianEvent): Promise<void> {
    const { intent, text, dmId, senderId } = event.data as {
      intent: string
      text: string
      dmId: string
      senderId: string | null
    }

    // Skip spam
    if (intent === 'spam') return

    // Check budget gate
    const { gate } = getBudgetStatus()
    if (gate === 'paused') return

    const userId = senderId ?? `dm-${dmId}`

    try {
      const response = await core.processMessage({
        platform: 'x',
        userId,
        message: text,
        metadata: { dmId, intent, isDM: true },
      })

      // If AgentCore used sendDM tool, the DM is already sent.
      // If it only returned text, send the DM ourselves.
      if (!response.toolsUsed.includes('sendDM') && response.text && senderId) {
        await heraldToolExecutor('sendDM', {
          user_id: senderId,
          text: response.text,
        })
      }

      guardianBus.emit({
        source: 'herald',
        type: 'herald:dm-replied',
        level: 'routine',
        data: { dmId, senderId, intent, response: response.text.slice(0, 100) },
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      guardianBus.emit({
        source: 'herald',
        type: 'herald:dm-reply-failed',
        level: 'important',
        data: { dmId, error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date().toISOString(),
      })
    }
  }

  // ── Subscribe to events ───────────────────────────────────────────────────

  guardianBus.on('herald:mention', handleMention)
  guardianBus.on('herald:dm', handleDM)

  return { core, handleMention, handleDM }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/local-dev/sipher/packages/agent && npx vitest run tests/adapters/x.test.ts`
Expected: PASS (4+ tests)

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/adapters/x.ts packages/agent/tests/adapters/x.test.ts
git commit -m "feat: create X adapter — HERALD LLM brain for mentions and DMs"
```

---

### Task 4: Wire X adapter startup in index.ts

**Files:**
- Modify: `packages/agent/src/index.ts`

- [ ] **Step 1: Import and start X adapter alongside poller**

In `packages/agent/src/index.ts`, find the HERALD poller startup block (around line 287):

```typescript
// Before:
if (process.env.X_BEARER_TOKEN && process.env.X_CONSUMER_KEY) {
  import('./herald/poller.js').then(({ createPollerState, startPoller }) => {
    const heraldState = createPollerState()
    startPoller(heraldState)
    console.log('  HERALD:  poller started (mentions + DMs + scheduled posts)')
  }).catch(err => {
    console.warn('  HERALD:  poller not started:', (err as Error).message)
  })
}

// After:
if (process.env.X_BEARER_TOKEN && process.env.X_CONSUMER_KEY) {
  Promise.all([
    import('./herald/poller.js'),
    import('./adapters/x.js'),
  ]).then(([{ createPollerState, startPoller }, { createXAdapter }]) => {
    // Start X adapter first (subscribes to events before poller emits them)
    createXAdapter()
    console.log('  HERALD:  X adapter started (LLM brain for mentions + DMs)')

    // Then start poller (emits events the adapter handles)
    const heraldState = createPollerState()
    startPoller(heraldState)
    console.log('  HERALD:  poller started (mentions + DMs + scheduled posts)')
  }).catch(err => {
    console.warn('  HERALD:  not started:', (err as Error).message)
  })
}
```

- [ ] **Step 2: Run all tests**

Run: `cd ~/local-dev/sipher && pnpm test -- --run`
Expected: 497 pass (Herald only starts when X_BEARER_TOKEN is set — not in test env)

- [ ] **Step 3: Commit**

```bash
git add packages/agent/src/index.ts
git commit -m "feat: wire X adapter startup — HERALD gets LLM brain on mention/DM events"
```

---

### Task 5: Full verification

- [ ] **Step 1: Run root test suite**

```bash
cd ~/local-dev/sipher && pnpm test -- --run
```
Expected: 497 pass

- [ ] **Step 2: Run agent test suite**

```bash
cd ~/local-dev/sipher/packages/agent && npx vitest run
```
Expected: All agent tests pass (core + adapters + existing)

- [ ] **Step 3: Type check**

```bash
cd ~/local-dev/sipher/packages/agent && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 4: Build frontend**

```bash
cd ~/local-dev/sipher/app && pnpm build
```
Expected: Clean build

- [ ] **Step 5: Commit any remaining cleanup**

---

## Architecture After This Plan

```
                 ┌─────────────────┐
                 │   Poller         │
                 │  (mentions/DMs)  │
                 └────────┬────────┘
                          │ emit herald:mention / herald:dm
                          ▼
                 ┌─────────────────┐
                 │  Guardian Bus   │
                 └───┬─────────┬───┘
                     │         │
              ┌──────▼──┐  ┌──▼───────┐
              │ X Adapt  │  │ Activity │
              │ (HERALD) │  │ Logger   │
              └──────┬───┘  └──────────┘
                     │
              ┌──────▼──────────┐
              │   AgentCore     │
              │ (HERALD config) │
              │ tools: 9 X tools│
              │ prompt: HERALD  │
              └──────┬──────────┘
                     │
              ┌──────▼──────────┐
              │  chat() / LLM   │
              │  (OpenRouter)   │
              └──────┬──────────┘
                     │
              ┌──────▼──────────┐
              │  Tool execution │
              │ replyTweet →    │
              │ X API (real)    │
              └─────────────────┘
```

The web adapter (SIPHER) and X adapter (HERALD) share AgentCore but with different configs — different tools, system prompts, and models.
