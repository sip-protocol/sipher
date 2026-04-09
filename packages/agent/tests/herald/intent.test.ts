import { describe, it, expect } from 'vitest'
import { classifyIntent } from '../../src/herald/intent.js'

describe('HERALD intent classifier', () => {
  it('classifies privacy score command', () => {
    const result = classifyIntent('@SipProtocol privacy score for 7xKz...abc')
    expect(result.intent).toBe('command')
    expect(result.tool).toBe('privacyScore')
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('classifies threat check command', () => {
    const result = classifyIntent('@SipProtocol is 8xAb...def safe?')
    expect(result.intent).toBe('command')
    expect(result.tool).toBe('threatCheck')
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('classifies deposit command with needsExecLink', () => {
    const result = classifyIntent('@SipProtocol deposit 5 SOL')
    expect(result.intent).toBe('command')
    expect(result.tool).toBe('send')
    expect(result.needsExecLink).toBe(true)
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('classifies question about stealth addresses', () => {
    const result = classifyIntent('@SipProtocol how do stealth addresses work?')
    expect(result.intent).toBe('question')
    expect(result.confidence).toBeGreaterThan(0.7)
  })

  it('classifies engagement as default', () => {
    const result = classifyIntent('@SipProtocol this is amazing, love the privacy!')
    expect(result.intent).toBe('engagement')
    expect(result.confidence).toBeLessThanOrEqual(0.6)
  })

  it('classifies scam link as spam', () => {
    const result = classifyIntent('Buy now! Click http://scam.link @SipProtocol')
    expect(result.intent).toBe('spam')
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  it('classifies bare mention as spam', () => {
    const result = classifyIntent('@SipProtocol')
    expect(result.intent).toBe('spam')
    expect(result.confidence).toBeGreaterThan(0.8)
  })
})
