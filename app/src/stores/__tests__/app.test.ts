import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../app'

describe('app store — chatSheetOpen slice', () => {
  beforeEach(() => {
    useAppStore.setState({ chatSheetOpen: false }, false)
  })

  it('defaults to closed', () => {
    expect(useAppStore.getState().chatSheetOpen).toBe(false)
  })

  it('toggles via setChatSheetOpen', () => {
    useAppStore.getState().setChatSheetOpen(true)
    expect(useAppStore.getState().chatSheetOpen).toBe(true)
    useAppStore.getState().setChatSheetOpen(false)
    expect(useAppStore.getState().chatSheetOpen).toBe(false)
  })

  it('is excluded from persisted partialize (in-memory only)', () => {
    useAppStore.getState().setChatSheetOpen(true)
    const persisted = JSON.parse(localStorage.getItem('sipher-auth') ?? '{}')
    expect(persisted.state).not.toHaveProperty('chatSheetOpen')
  })
})
