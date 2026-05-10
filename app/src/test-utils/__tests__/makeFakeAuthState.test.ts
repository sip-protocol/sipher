import { describe, it, expect, vi } from 'vitest'
import { makeFakeAuthState } from '../makeFakeAuthState'
import type { AuthState } from '../../hooks/useAuthState'

describe('makeFakeAuthState', () => {
  it('returns a valid unauthed AuthState by default', () => {
    const state: AuthState = makeFakeAuthState()
    expect(state.status).toBe('unauthed')
    expect(state.token).toBeNull()
    expect(state.expiresAt).toBeNull()
    expect(state.isAdmin).toBe(false)
    expect(state.publicKey).toBeNull()
    expect(state.error).toBeNull()
    expect(typeof state.authenticate).toBe('function')
    expect(typeof state.disconnect).toBe('function')
  })

  it('authenticate and disconnect default to no-op promises', async () => {
    const state = makeFakeAuthState()
    await expect(state.authenticate()).resolves.toBeUndefined()
    await expect(state.disconnect()).resolves.toBeUndefined()
  })

  it('applies overrides while preserving the rest of the shape', () => {
    const state = makeFakeAuthState({
      status: 'authed',
      token: 'jwt-token',
      publicKey: 'pubkey-base58',
      isAdmin: true,
    })
    expect(state.status).toBe('authed')
    expect(state.token).toBe('jwt-token')
    expect(state.publicKey).toBe('pubkey-base58')
    expect(state.isAdmin).toBe(true)
    expect(state.expiresAt).toBeNull()
    expect(state.error).toBeNull()
  })

  it('lets caller override authenticate and disconnect with custom mocks', async () => {
    const authenticate = vi.fn(async () => {})
    const disconnect = vi.fn(async () => {})
    const state = makeFakeAuthState({ authenticate, disconnect })
    await state.authenticate()
    await state.disconnect()
    expect(authenticate).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
