import { describe, it, expect, beforeEach } from 'vitest'
import { useKeyStore } from '../keys'

describe('useKeyStore', () => {
  beforeEach(() => {
    useKeyStore.setState({ hash: null })
  })

  it('starts with hash null', () => {
    expect(useKeyStore.getState().hash).toBeNull()
  })

  it('set updates the hash', () => {
    useKeyStore.getState().set('0xabc123')
    expect(useKeyStore.getState().hash).toBe('0xabc123')
  })

  it('clear resets the hash to null', () => {
    useKeyStore.getState().set('0xabc123')
    useKeyStore.getState().clear()
    expect(useKeyStore.getState().hash).toBeNull()
  })
})
