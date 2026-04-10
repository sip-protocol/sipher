# Platform Abstraction Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a platform-agnostic agent core so SIPHER can serve web, X DMs, and Telegram from the same conversation engine — no duplication.

**Architecture:** Define a `MsgContext` interface representing any inbound message (web command, X DM, Telegram text). Create an `AgentCore` class that owns the full cycle: session resolution → conversation load → LLM call → tool execution → conversation persist → response. Each platform implements a thin adapter that maps its I/O to `MsgContext`. The existing Express routes become the "web adapter."

**Tech Stack:** TypeScript, Anthropic SDK (via OpenRouter), Express 5, SQLite (better-sqlite3), Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| **Create:** `packages/agent/src/core/types.ts` | `MsgContext`, `AgentResponse`, `PlatformAdapter` interfaces |
| **Create:** `packages/agent/src/core/agent-core.ts` | Platform-agnostic message processing — session, conversation, LLM, tools |
| **Create:** `packages/agent/src/core/index.ts` | Barrel export |
| **Create:** `packages/agent/src/adapters/web.ts` | Express req/res → MsgContext → AgentCore → Express res |
| **Create:** `packages/agent/tests/core/agent-core.test.ts` | Unit tests for AgentCore |
| **Create:** `packages/agent/tests/adapters/web.test.ts` | Integration tests for web adapter |
| **Modify:** `packages/agent/src/agent.ts` | Remove session/conversation concerns (stays as LLM-only module) |
| **Modify:** `packages/agent/src/index.ts` | Replace inline chat/stream route handlers with web adapter |

---

### Task 1: Define core types

**Files:**
- Create: `packages/agent/src/core/types.ts`
- Create: `packages/agent/src/core/index.ts`

- [ ] **Step 1: Create the types file**

```typescript
// packages/agent/src/core/types.ts

/** Platform a message originated from */
export type Platform = 'web' | 'telegram' | 'x'

/**
 * Unified inbound message context — platform-agnostic.
 * Every adapter constructs this from its native format.
 */
export interface MsgContext {
  /** Platform the message came from */
  platform: Platform
  /** User identifier — wallet address (web), telegram user ID, X user ID */
  userId: string
  /** The user's message text */
  message: string
  /** Optional metadata from the platform (thread ID, reply-to, etc.) */
  metadata?: Record<string, unknown>
}

/** A single response chunk for streaming */
export interface ResponseChunk {
  type: 'text' | 'tool_start' | 'tool_end' | 'error' | 'done'
  text?: string
  toolName?: string
  toolId?: string
  success?: boolean
}

/** Full (non-streaming) agent response */
export interface AgentResponse {
  text: string
  toolsUsed: string[]
}
```

- [ ] **Step 2: Create the barrel export**

```typescript
// packages/agent/src/core/index.ts
export type {
  Platform,
  MsgContext,
  ResponseChunk,
  AgentResponse,
} from './types.js'
export { AgentCore } from './agent-core.js'
```

Note: `AgentCore` export will error until Task 2 creates the file. That's fine — we commit types first.

- [ ] **Step 3: Commit**

```bash
git add packages/agent/src/core/types.ts packages/agent/src/core/index.ts
git commit -m "feat: define MsgContext and AgentResponse types for platform abstraction"
```

---

### Task 2: Build AgentCore

**Files:**
- Create: `packages/agent/src/core/agent-core.ts`
- Create: `packages/agent/tests/core/agent-core.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/agent/tests/core/agent-core.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the LLM — we don't call OpenRouter in unit tests
vi.mock('../../src/agent.js', () => ({
  chat: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Mock response' }],
    stop_reason: 'end_turn',
  }),
  chatStream: vi.fn().mockImplementation(async function* () {
    yield { type: 'content_block_delta', text: 'Mock ' }
    yield { type: 'content_block_delta', text: 'stream' }
    yield { type: 'message_complete', content: 'Mock stream' }
  }),
  executeTool: vi.fn(),
  TOOLS: [],
  SYSTEM_PROMPT: 'test',
}))

const { AgentCore } = await import('../../src/core/agent-core.js')

describe('AgentCore', () => {
  let core: InstanceType<typeof AgentCore>

  beforeEach(() => {
    core = new AgentCore()
  })

  it('processMessage returns text response', async () => {
    const result = await core.processMessage({
      platform: 'web',
      userId: 'wallet123',
      message: 'hello',
    })

    expect(result.text).toBe('Mock response')
    expect(result.toolsUsed).toEqual([])
  })

  it('streamMessage yields chunks', async () => {
    const chunks = []
    for await (const chunk of core.streamMessage({
      platform: 'web',
      userId: 'wallet456',
      message: 'hello stream',
    })) {
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks.some(c => c.type === 'text')).toBe(true)
    expect(chunks[chunks.length - 1].type).toBe('done')
  })

  it('resolves session from userId', async () => {
    await core.processMessage({
      platform: 'web',
      userId: 'walletABC',
      message: 'test session',
    })

    // Calling again should reuse session (no error)
    const result = await core.processMessage({
      platform: 'web',
      userId: 'walletABC',
      message: 'test session again',
    })
    expect(result.text).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/agent && npx vitest run tests/core/agent-core.test.ts`
Expected: FAIL — `agent-core.js` does not exist

- [ ] **Step 3: Implement AgentCore**

```typescript
// packages/agent/src/core/agent-core.ts
import { chat, chatStream } from '../agent.js'
import { resolveSession, getConversation, appendConversation } from '../session.js'
import type { MsgContext, AgentResponse, ResponseChunk } from './types.js'
import type Anthropic from '@anthropic-ai/sdk'

/**
 * Platform-agnostic agent core.
 *
 * Owns the full message lifecycle:
 * 1. Resolve session from userId
 * 2. Load conversation history
 * 3. Call LLM (chat or stream)
 * 4. Persist conversation
 * 5. Return response
 */
export class AgentCore {
  /**
   * Process a message and return the full response (non-streaming).
   */
  async processMessage(ctx: MsgContext): Promise<AgentResponse> {
    const session = resolveSession(ctx.userId)
    const history = getConversation(session.id)

    const messages: Anthropic.MessageParam[] = [
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content as string })),
      { role: 'user' as const, content: ctx.message },
    ]

    const response = await chat(messages)

    // Extract text from content blocks
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    // Extract tool names used
    const toolsUsed = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map(b => b.name)

    // Persist conversation
    appendConversation(session.id, [
      { role: 'user', content: ctx.message },
      { role: 'assistant', content: text },
    ])

    return { text, toolsUsed }
  }

  /**
   * Process a message and yield streaming chunks.
   */
  async *streamMessage(ctx: MsgContext): AsyncGenerator<ResponseChunk> {
    const session = resolveSession(ctx.userId)
    const history = getConversation(session.id)

    const messages: Anthropic.MessageParam[] = [
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content as string })),
      { role: 'user' as const, content: ctx.message },
    ]

    let fullText = ''
    const toolsUsed: string[] = []

    for await (const event of chatStream(messages)) {
      switch (event.type) {
        case 'content_block_delta':
          fullText += event.text
          yield { type: 'text', text: event.text }
          break
        case 'tool_use':
          toolsUsed.push(event.name)
          yield { type: 'tool_start', toolName: event.name, toolId: event.id }
          break
        case 'tool_result':
          yield { type: 'tool_end', toolName: event.name, toolId: event.id, success: event.success }
          break
        case 'error':
          yield { type: 'error', text: event.message }
          break
        case 'message_complete':
          fullText = event.content
          break
      }
    }

    // Persist conversation
    appendConversation(session.id, [
      { role: 'user', content: ctx.message },
      { role: 'assistant', content: fullText },
    ])

    yield { type: 'done', text: fullText }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/agent && npx vitest run tests/core/agent-core.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/core/agent-core.ts packages/agent/tests/core/agent-core.test.ts
git commit -m "feat: implement AgentCore — platform-agnostic message processing"
```

---

### Task 3: Build the web adapter

**Files:**
- Create: `packages/agent/src/adapters/web.ts`
- Create: `packages/agent/tests/adapters/web.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/agent/tests/adapters/web.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the AgentCore
vi.mock('../../src/core/agent-core.js', () => ({
  AgentCore: vi.fn().mockImplementation(() => ({
    processMessage: vi.fn().mockResolvedValue({
      text: 'adapter response',
      toolsUsed: ['balance'],
    }),
    streamMessage: vi.fn().mockImplementation(async function* () {
      yield { type: 'text', text: 'streaming ' }
      yield { type: 'text', text: 'response' }
      yield { type: 'done', text: 'streaming response' }
    }),
  })),
}))

const { createWebAdapter } = await import('../../src/adapters/web.js')

describe('Web Adapter', () => {
  it('creates command handler that returns AgentResponse', async () => {
    const adapter = createWebAdapter()
    const mockReq = {
      body: { message: 'check balance' },
      wallet: 'walletXYZ',
    }
    const mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    }

    await adapter.handleCommand(mockReq as any, mockRes as any)

    expect(mockRes.json).toHaveBeenCalledWith({
      status: 'ok',
      wallet: 'walletXYZ',
      response: { text: 'adapter response', toolsUsed: ['balance'] },
    })
  })

  it('creates chat handler that returns full response', async () => {
    const adapter = createWebAdapter()
    const mockReq = {
      body: { messages: [{ role: 'user', content: 'hello' }] },
      wallet: 'walletXYZ',
    }
    const mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    }

    await adapter.handleChat(mockReq as any, mockRes as any)

    expect(mockRes.json).toHaveBeenCalledWith({
      text: 'adapter response',
      toolsUsed: ['balance'],
    })
  })

  it('creates stream handler that writes SSE events', async () => {
    const adapter = createWebAdapter()
    const writes: string[] = []
    const mockReq = {
      body: { messages: [{ role: 'user', content: 'stream test' }] },
      wallet: 'walletABC',
    }
    const mockRes = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: vi.fn((data: string) => writes.push(data)),
      writableEnded: false,
      on: vi.fn(),
      end: vi.fn(),
    }

    await adapter.handleChatStream(mockReq as any, mockRes as any)

    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream')
    expect(writes.some(w => w.includes('streaming '))).toBe(true)
    expect(writes.some(w => w.includes('[DONE]'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/agent && npx vitest run tests/adapters/web.test.ts`
Expected: FAIL — `web.js` does not exist

- [ ] **Step 3: Implement the web adapter**

```typescript
// packages/agent/src/adapters/web.ts
import type { Request, Response } from 'express'
import { AgentCore } from '../core/agent-core.js'
import type { ResponseChunk } from '../core/types.js'

/**
 * Web adapter — maps Express HTTP requests to AgentCore.
 *
 * Provides handlers for:
 * - handleCommand: POST /api/command (single message → full response)
 * - handleChat: POST /api/chat (messages array → full response)
 * - handleChatStream: POST /api/chat/stream (messages → SSE stream)
 */
export function createWebAdapter() {
  const core = new AgentCore()

  /** POST /api/command — single message in, full response out */
  async function handleCommand(req: Request, res: Response): Promise<void> {
    const wallet = (req as unknown as Record<string, unknown>).wallet as string
    const { message } = req.body as { message?: string }

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required' })
      return
    }

    if (message.length > 4000) {
      res.status(400).json({ error: 'message too long (max 4000 chars)' })
      return
    }

    const response = await core.processMessage({
      platform: 'web',
      userId: wallet,
      message,
    })

    res.json({ status: 'ok', wallet, response })
  }

  /** POST /api/chat — messages array in, full response out */
  async function handleChat(req: Request, res: Response): Promise<void> {
    const wallet = (req as unknown as Record<string, unknown>).wallet as string
    const { messages } = req.body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages is required and must be a non-empty array' })
      return
    }

    // Use the last user message for AgentCore processing
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    if (!lastUserMsg) {
      res.status(400).json({ error: 'messages must contain at least one user message' })
      return
    }

    const response = await core.processMessage({
      platform: 'web',
      userId: wallet,
      message: typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content),
    })

    res.json(response)
  }

  /** POST /api/chat/stream — messages in, SSE events out */
  async function handleChatStream(req: Request, res: Response): Promise<void> {
    const wallet = (req as unknown as Record<string, unknown>).wallet as string
    const { messages } = req.body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages is required and must be a non-empty array' })
      return
    }

    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    if (!lastUserMsg) {
      res.status(400).json({ error: 'messages must contain at least one user message' })
      return
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    let aborted = false
    res.on('close', () => { aborted = true })

    try {
      for await (const chunk of core.streamMessage({
        platform: 'web',
        userId: wallet,
        message: typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content),
      })) {
        if (aborted || res.writableEnded) break
        res.write(`data: ${JSON.stringify(chunkToSSE(chunk))}\n\n`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
      }
    } finally {
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n')
        res.end()
      }
    }
  }

  return { handleCommand, handleChat, handleChatStream, core }
}

/** Map internal ResponseChunk to the SSE event format the frontend expects */
function chunkToSSE(chunk: ResponseChunk): Record<string, unknown> {
  switch (chunk.type) {
    case 'text':
      return { type: 'content_block_delta', text: chunk.text }
    case 'tool_start':
      return { type: 'tool_use', name: chunk.toolName, id: chunk.toolId }
    case 'tool_end':
      return { type: 'tool_result', name: chunk.toolName, id: chunk.toolId, success: chunk.success }
    case 'error':
      return { type: 'error', message: chunk.text }
    case 'done':
      return { type: 'message_complete', content: chunk.text }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/agent && npx vitest run tests/adapters/web.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/adapters/web.ts packages/agent/tests/adapters/web.test.ts
git commit -m "feat: create web adapter mapping Express to AgentCore"
```

---

### Task 4: Wire web adapter into index.ts

**Files:**
- Modify: `packages/agent/src/index.ts`

- [ ] **Step 1: Add web adapter import and replace inline handlers**

In `packages/agent/src/index.ts`, add import at the top:

```typescript
import { createWebAdapter } from './adapters/web.js'
```

After the existing initialization block (after `console.log('  SENTINEL: started...')`), add:

```typescript
const webAdapter = createWebAdapter()
```

Replace the `/api/command` route (lines ~83-89):

```typescript
// Before:
app.post('/api/command', verifyJwt, (req, res, next) => {
  if (isKillSwitchActive()) {
    res.status(503).json({ error: 'operations paused — kill switch active' })
    return
  }
  commandHandler(req, res).catch(next)
})

// After:
app.post('/api/command', verifyJwt, (req, res, next) => {
  if (isKillSwitchActive()) {
    res.status(503).json({ error: 'operations paused — kill switch active' })
    return
  }
  webAdapter.handleCommand(req, res).catch(next)
})
```

Replace the `/api/chat` route (lines ~118-148):

```typescript
// After:
app.post('/api/chat', verifyJwt, async (req, res) => {
  if (isKillSwitchActive()) {
    res.status(503).json({ error: 'operations paused — kill switch active' })
    return
  }
  try {
    await webAdapter.handleChat(req, res)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[agent] chat error:', message)
    res.status(500).json({ error: message })
  }
})
```

Replace the `/api/chat/stream` route (lines ~152-203):

```typescript
// After:
app.post('/api/chat/stream', verifyJwt, async (req, res) => {
  if (isKillSwitchActive()) {
    res.status(503).json({ error: 'operations paused — kill switch active' })
    return
  }
  await webAdapter.handleChatStream(req, res)
})
```

Remove the `commandHandler` import (line 12) since it's no longer used:

```typescript
// Remove this line:
import { commandHandler } from './routes/command.js'
```

- [ ] **Step 2: Run full test suite**

Run: `pnpm test -- --run`
Expected: All 497+ tests pass. The web adapter is a drop-in replacement — same request/response shape.

- [ ] **Step 3: Commit**

```bash
git add packages/agent/src/index.ts
git commit -m "refactor: wire web adapter into Express routes, replacing inline handlers"
```

---

### Task 5: Verify no regressions + cleanup

**Files:**
- Possibly modify: `packages/agent/src/routes/command.ts` (delete if fully replaced)

- [ ] **Step 1: Check if command.ts is still imported anywhere**

```bash
grep -r "command.js\|commandHandler" packages/agent/src/ --include="*.ts"
```

If only in `routes/command.ts` itself (self-reference), it's dead code. Delete it.

- [ ] **Step 2: Run full test suite**

```bash
pnpm test -- --run
```

Expected: All tests pass. If `command.ts` was referenced in tests, update accordingly.

- [ ] **Step 3: Run the app build**

```bash
cd app && pnpm build
```

Expected: Clean build (frontend unchanged).

- [ ] **Step 4: Type check**

```bash
cd packages/agent && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A
git commit -m "chore: remove dead command handler, verify platform abstraction"
```

---

## Summary

After these 5 tasks, the architecture becomes:

```
                    ┌──────────────┐
                    │  MsgContext   │  ← Platform-agnostic message
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  AgentCore   │  ← Session + Conversation + LLM + Tools
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──┐  ┌──────▼──┐  ┌──────▼──┐
       │   Web   │  │Telegram │  │    X    │
       │ Adapter │  │ Adapter │  │ Adapter │
       └─────────┘  └─────────┘  └─────────┘
       (Task 3-4)   (Phase 2.2)  (Phase 2.3)
```

Web adapter is built and wired. Telegram and X adapters follow in subsequent plans — they just implement the same pattern: construct `MsgContext`, call `core.processMessage()` or `core.streamMessage()`.
