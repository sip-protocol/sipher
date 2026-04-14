import { describe, it, expect } from 'vitest'
import { mapPiEventToChunks, type ResponseChunk } from '../../src/pi/stream-bridge.js'
import type { AgentEvent } from '@mariozechner/pi-agent-core'

describe('mapPiEventToChunks', () => {
  it('maps text_delta to text chunk', () => {
    const event = {
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', delta: 'Hello' },
    } as unknown as AgentEvent
    const chunks = mapPiEventToChunks(event)
    expect(chunks).toEqual([{ type: 'text', text: 'Hello' }])
  })

  it('maps tool_execution_start to tool_use chunk', () => {
    const event = {
      type: 'tool_execution_start',
      toolCallId: 'call-1',
      toolName: 'deposit',
    } as unknown as AgentEvent
    const chunks = mapPiEventToChunks(event)
    expect(chunks).toEqual([{ type: 'tool_use', toolName: 'deposit', toolId: 'call-1' }])
  })

  it('maps successful tool_execution_end to tool_result chunk', () => {
    const event = {
      type: 'tool_execution_end',
      toolCallId: 'call-1',
      toolName: 'deposit',
      result: { isError: false, content: 'ok' },
    } as unknown as AgentEvent
    const chunks = mapPiEventToChunks(event)
    expect(chunks).toEqual([
      { type: 'tool_result', toolName: 'deposit', toolId: 'call-1', success: true },
    ])
  })

  it('maps failed tool_execution_end to tool_result chunk with success=false', () => {
    const event = {
      type: 'tool_execution_end',
      toolCallId: 'call-1',
      toolName: 'deposit',
      result: { isError: true, content: 'oops' },
    } as unknown as AgentEvent
    const chunks = mapPiEventToChunks(event)
    expect(chunks).toEqual([
      { type: 'tool_result', toolName: 'deposit', toolId: 'call-1', success: false },
    ])
  })

  it('maps agent_end to message_complete chunk with concatenated text', () => {
    const event = {
      type: 'agent_end',
      messages: [
        { role: 'assistant', content: [{ type: 'text', text: 'final answer' }] },
      ],
    } as unknown as AgentEvent
    const chunks = mapPiEventToChunks(event)
    expect(chunks).toEqual([{ type: 'message_complete', text: 'final answer' }])
  })

  it('returns empty array for unhandled events', () => {
    const event = { type: 'turn_start' } as unknown as AgentEvent
    expect(mapPiEventToChunks(event)).toEqual([])
  })
})
