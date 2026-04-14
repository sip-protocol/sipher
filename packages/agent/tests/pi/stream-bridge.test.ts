import { describe, it, expect } from 'vitest'
import { mapPiEventToSSE, streamPiAgent, type SSEEvent } from '../../src/pi/stream-bridge.js'
import type { Agent, AgentEvent } from '@mariozechner/pi-agent-core'

describe('mapPiEventToSSE', () => {
  it('maps text_delta to content_block_delta SSE event', () => {
    const event = {
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', delta: 'Hello' },
    } as unknown as AgentEvent
    expect(mapPiEventToSSE(event)).toEqual([{ type: 'content_block_delta', text: 'Hello' }])
  })

  it('maps tool_execution_start to tool_use SSE event', () => {
    const event = {
      type: 'tool_execution_start',
      toolCallId: 'call-1',
      toolName: 'deposit',
    } as unknown as AgentEvent
    expect(mapPiEventToSSE(event)).toEqual([{ type: 'tool_use', name: 'deposit', id: 'call-1' }])
  })

  it('maps successful tool_execution_end (real SDK isError shape) to tool_result success=true', () => {
    const event = {
      type: 'tool_execution_end',
      toolCallId: 'call-1',
      toolName: 'deposit',
      isError: false,
    } as unknown as AgentEvent
    expect(mapPiEventToSSE(event)).toEqual([
      { type: 'tool_result', name: 'deposit', id: 'call-1', success: true },
    ])
  })

  it('maps failed tool_execution_end (test fixture result.isError shape) to tool_result success=false', () => {
    const event = {
      type: 'tool_execution_end',
      toolCallId: 'call-1',
      toolName: 'deposit',
      result: { isError: true, content: 'oops' },
    } as unknown as AgentEvent
    expect(mapPiEventToSSE(event)).toEqual([
      { type: 'tool_result', name: 'deposit', id: 'call-1', success: false },
    ])
  })

  it('maps agent_end to message_complete SSE event with concatenated text', () => {
    const event = {
      type: 'agent_end',
      messages: [
        { role: 'assistant', content: [{ type: 'text', text: 'final answer' }] },
      ],
    } as unknown as AgentEvent
    expect(mapPiEventToSSE(event)).toEqual([{ type: 'message_complete', content: 'final answer' }])
  })

  it('returns empty array for unhandled events', () => {
    const event = { type: 'turn_start' } as unknown as AgentEvent
    expect(mapPiEventToSSE(event)).toEqual([])
  })
})

describe('streamPiAgent', () => {
  it('yields SSEEvents in the order they arrive via subscribe()', async () => {
    const subscribers: Array<(event: AgentEvent) => void> = []
    let promptResolve: () => void = () => {}
    const fakeAgent = {
      subscribe: (cb: (event: AgentEvent) => void) => {
        subscribers.push(cb)
        return () => {
          const idx = subscribers.indexOf(cb)
          if (idx >= 0) subscribers.splice(idx, 1)
        }
      },
      prompt: async () => {
        await new Promise<void>((resolve) => {
          promptResolve = resolve
        })
      },
      state: { messages: [] },
    } as unknown as Agent

    const collected: SSEEvent[] = []

    const collectAll = async () => {
      for await (const evt of streamPiAgent(fakeAgent, 'hi')) {
        collected.push(evt)
      }
    }
    const drain = collectAll()

    // Wait a tick so the generator subscribes
    await new Promise((r) => setImmediate(r))

    // Fire two events via subscriber, then agent_end
    subscribers.forEach((cb) =>
      cb({
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', delta: 'hello' },
      } as unknown as AgentEvent)
    )
    subscribers.forEach((cb) =>
      cb({
        type: 'agent_end',
        messages: [{ role: 'assistant', content: [{ type: 'text', text: 'hello' }] }],
      } as unknown as AgentEvent)
    )

    promptResolve()
    await drain

    expect(collected).toEqual([
      { type: 'content_block_delta', text: 'hello' },
      { type: 'message_complete', content: 'hello' },
    ])
  })

  it('emits an error SSE event when agent.prompt() rejects', async () => {
    const fakeAgent = {
      subscribe: (cb: (event: AgentEvent) => void) => {
        void cb
        return () => {}
      },
      prompt: async () => {
        throw new Error('network down')
      },
      abort: () => {},
      state: { messages: [] },
    } as unknown as Agent

    const collected: SSEEvent[] = []
    for await (const evt of streamPiAgent(fakeAgent, 'hi')) {
      collected.push(evt)
    }

    expect(collected).toEqual([{ type: 'error', message: 'network down' }])
  })

  it('calls agent.abort() when the consumer breaks out of the generator early', async () => {
    const subscribers: Array<(event: AgentEvent) => void> = []
    let aborted = false
    let promptResolve: () => void = () => {}

    const fakeAgent = {
      subscribe: (cb: (event: AgentEvent) => void) => {
        subscribers.push(cb)
        return () => {
          const idx = subscribers.indexOf(cb)
          if (idx >= 0) subscribers.splice(idx, 1)
        }
      },
      prompt: async () => {
        // Hangs until promptResolve() is called (by abort())
        await new Promise<void>((resolve) => {
          promptResolve = resolve
        })
      },
      abort: () => {
        aborted = true
        // Resolve the pending prompt so runPromise settles and finally can complete
        promptResolve()
      },
      state: { messages: [] },
    } as unknown as Agent

    const gen = streamPiAgent(fakeAgent, 'hi')

    // Kick off first gen.next() to start the generator body, which installs
    // subscribers and then suspends at `await new Promise` waiting for events.
    // We don't await it yet — we need to let the generator start first.
    const firstEventPromise = gen.next()

    // Allow the generator to start, subscribe, and reach the inner await
    await new Promise((r) => setImmediate(r))

    // Now subscribers are installed. Emit one text delta to wake the generator.
    subscribers.forEach((cb) =>
      cb({
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', delta: 'x' },
      } as unknown as AgentEvent),
    )

    // gen.next() should now resolve with the emitted event
    const first = await firstEventPromise
    expect(first.value).toMatchObject({ type: 'content_block_delta', text: 'x' })

    // The generator looped back and is now suspended at the inner `await new Promise`.
    // gen.return() injects a Return completion into that await, running finally.
    // finally: guardUnsub() + unsubscribe() + agent.abort() → promptResolve() → await runPromise resolves
    await gen.return(undefined)

    // abort() must have been called in the generator's finally block
    expect(aborted).toBe(true)
  })
})
