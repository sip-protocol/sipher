import type { AuthState } from '../hooks/useAuthState'

/**
 * Build an AuthState fixture for component tests.
 *
 * Defaults to `'unauthed'` so tests opt INTO authentication state explicitly.
 * Overrides are applied after the defaults; pass `{ status: 'authed', token: '…' }`
 * to simulate a signed-in user.
 *
 * Why this exists: the field name `isAuthenticated` does NOT exist on
 * AuthState. Several test fixtures previously mocked it, which TypeScript did
 * not catch because vi.mock returns are loosely typed. This factory enforces
 * the real shape via the `AuthState` interface.
 */
export function makeFakeAuthState(overrides?: Partial<AuthState>): AuthState {
  return {
    status: 'unauthed',
    token: null,
    expiresAt: null,
    isAdmin: false,
    publicKey: null,
    authenticate: async () => {},
    disconnect: async () => {},
    error: null,
    ...overrides,
  }
}
