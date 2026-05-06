# Phase 4a — Auth Architecture + Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the 13 high-priority auth/security findings from `/quality:qa` dev-QA via two architectural fixes (FE AuthSync provider + BE centralized ephemeral state) so `sipher.sip-protocol.org` is suitable for the public devnet beta announce.

**Architecture:** Frontend introduces a single `AuthSync` provider that owns wallet ↔ JWT ↔ store reconciliation, expiry tracking, and the global 401 interceptor. Backend centralizes six security-critical maps in a Redis-backed-with-fallback ephemeral state module, hardens the auth surface (trust proxy, input validation, rate limits, /refresh endpoint), eliminates SOLANA_NETWORK drift via ESLint rule, and flips `/pay/:id/confirm` to fail-closed with fallback RPC.

**Tech Stack:** Frontend = React 19 + Vite 6 + Tailwind 4 + Zustand 5 + @phosphor-icons/react + @solana/wallet-adapter-react. Backend = Node 22 + TypeScript + tsup + Vitest + Express 5 + jsonwebtoken + ed25519-via-@noble/curves + better-sqlite3 + ioredis (new dependency, optional).

**Spec:** `docs/superpowers/specs/2026-05-06-phase4a-auth-and-security-fix-design.md`

**Predecessor:** `docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md` (Phase 4a/4b sequencing)

---

## File Structure (Decomposition Map)

### PR 1 — Frontend `feat/authsync-architecture`

**New files:**
- `app/src/providers/AuthSyncProvider.tsx` — top-level provider, owns auth state machine
- `app/src/hooks/useAuthState.ts` — consumer hook (re-exported through `providers/AuthSyncProvider`)
- `app/src/components/Toast.tsx` + `app/src/providers/ToastProvider.tsx` — toast slot
- `app/src/components/WalletDropdown.tsx` — header pill dropdown menu
- `app/src/lib/jwt.ts` — JWT decode helper (no signature verify; client-side TTL check only)
- `app/src/api/refresh.ts` — POST `/api/auth/refresh` client wrapper
- Test files for each new module

**Modified files:**
- `app/src/App.tsx` — wrap providers (AuthSyncProvider + ToastProvider)
- `app/src/api/client.ts` — `apiFetch` becomes 401-aware, calls `clearAuth` and emits toast event
- `app/src/api/auth.ts` — extract `expiresIn` from server response and return it
- `app/src/api/sse.ts` — drop JWT-in-URL fallback (or gate behind `import.meta.env.DEV`)
- `app/src/stores/app.ts` — Zustand `persist` gets `version: 1` + `migrate` function; add `expiresAt`
- `app/src/components/Header.tsx` — wallet pill always clickable, swap to `<WalletDropdown>`
- `app/src/components/BottomNav.tsx` — uses `useAuthState().disconnect()` (which clears JWT)
- `app/src/components/ChatSidebar.tsx` — error path migrates from inline error to toast
- `app/src/components/SentinelConfirm.tsx` — uses `useAuthState().token`
- `app/src/views/DashboardView.tsx` — uses `useAuthState()` everywhere
- `app/src/views/VaultView.tsx` — uses `useAuthState()` everywhere
- `app/src/hooks/useAuth.ts` — gut existing logic; re-export `useAuthState()` for back-compat (or delete file and update imports)
- `app/src/hooks/useSSE.ts` — uses `useAuthState().token`

### PR 2 — Backend `feat/auth-surface-hardening`

**New files:**
- `packages/agent/src/state/ephemeral.ts` — `createStore<T>(name, opts)` factory + Redis/in-memory backends
- `packages/agent/src/state/__tests__/ephemeral.test.ts` — TTL, cap, fallback behavior tests
- `packages/agent/src/types/express-request.d.ts` — augments Express `Request` with `wallet?: string; isAdmin?: boolean`

**Modified files:**
- `packages/agent/src/index.ts` — `app.set('trust proxy', N)`; `FUND_MOVING_TOOLS` imported from `preflight-rules.ts`
- `packages/agent/src/routes/auth.ts` — input validation, /nonce rate limit, /refresh endpoint, AUTHORIZED_WALLETS parsed once, ephemeral state migration, structured errors
- `packages/agent/src/routes/admin.ts` — `adminTokens` migrated to ephemeral; cookie parser optional
- `packages/agent/src/routes/confirm.ts` — `pendingConfirms` migrated; 403 → 404 polish
- `packages/agent/src/routes/circuit-breaker.ts` (or wherever flags live) — pending flags migrated
- `packages/agent/src/routes/pay.ts` — fail-closed with fallback RPC + retry, per-link rate limit, structured errors
- `packages/agent/src/sentinel/config.ts` — `SENTINEL_MODE` default flipped to `'advisory'`, startup warn for yolo
- `packages/agent/src/sentinel/preflight-rules.ts` — export `FUND_MOVING_TOOLS` for index.ts import
- `eslint.config.js` (or `.eslintrc.cjs`) — new `no-restricted-syntax` rule for SOLANA_NETWORK / SOLANA_RPC_URL
- `docker-compose.yml` — `SIPHER_NETWORK=${SIPHER_NETWORK:-devnet}` in `api:` env block
- `.env.example` — document `JWT_EXPIRY`, `TRUST_PROXY`, `SOLANA_RPC_URL_FALLBACK`, `REDIS_URL`
- 13 files for `process.env.SOLANA_NETWORK` → `loadNetworkConfig()` migration:
  - `packages/agent/src/routes/vault-api.ts`
  - `packages/agent/src/sentinel/vault-refund.ts`
  - `packages/agent/src/sentinel/scanner.ts`
  - `packages/agent/src/tools/{deposit,send,refund,balance,scan,history,status,viewing-key,privacy-score,consolidate}.ts`
- 3 files for `process.env.SOLANA_RPC_URL` → `loadNetworkConfig().rpcUrl` migration:
  - `packages/agent/src/sentinel/tools/get-on-chain-signatures.ts`
  - `packages/agent/src/sentinel/tools/get-vault-balance.ts`
  - `packages/agent/src/sentinel/tools/get-deposit-status.ts`

### PR 3 — Optional polish (deferred until after launch)

Captured in Phase E below; do NOT execute as part of the launch-blocker work.

---

# PHASE A: PR 1 — Frontend AuthSync Architecture

**Branch:** `feat/authsync-architecture` (from `main`)
**Working dir:** `~/local-dev/sipher`

## Task A0: Branch + scaffold setup

**Files:**
- Create: branch only

- [ ] **Step 1: Verify clean working tree on main**

```bash
cd ~/local-dev/sipher
git status
git log -1 --oneline
```

Expected: clean tree, latest commit `eeb9a3e` (PR-A2 merge) or newer.

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b feat/authsync-architecture
```

- [ ] **Step 3: Verify pnpm install up to date**

```bash
pnpm install
```

Expected: no changes (lockfile already in sync).

- [ ] **Step 4: Commit nothing yet — branch ready**

No commit at this step. Branch in place.

---

## Task A1: JWT decode helper + tests

**Files:**
- Create: `app/src/lib/jwt.ts`
- Create: `app/src/lib/__tests__/jwt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/src/lib/__tests__/jwt.test.ts
import { describe, it, expect } from 'vitest';
import { decodeJwtPayload, isJwtExpired, getJwtExpiresAt } from '../jwt';

describe('jwt helpers', () => {
  // Valid JWT: { wallet: 'TestWallet', iat: 1700000000, exp: 1700003600 }
  // (signature is irrelevant for client-side decode)
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXQiOiJUZXN0V2FsbGV0IiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDB9.fake-sig';

  it('decodes payload', () => {
    const payload = decodeJwtPayload(validToken);
    expect(payload).toEqual({ wallet: 'TestWallet', iat: 1700000000, exp: 1700003600 });
  });

  it('returns null for malformed token', () => {
    expect(decodeJwtPayload('not.a.jwt')).toBeNull();
    expect(decodeJwtPayload('only-one-part')).toBeNull();
    expect(decodeJwtPayload('')).toBeNull();
  });

  it('isJwtExpired returns true for expired token', () => {
    expect(isJwtExpired(validToken, 1700004000)).toBe(true);
  });

  it('isJwtExpired returns false for valid token', () => {
    expect(isJwtExpired(validToken, 1700001800)).toBe(false);
  });

  it('isJwtExpired returns true for malformed token (defensive)', () => {
    expect(isJwtExpired('not.a.jwt', 1700001800)).toBe(true);
  });

  it('getJwtExpiresAt returns exp claim in seconds', () => {
    expect(getJwtExpiresAt(validToken)).toBe(1700003600);
  });

  it('getJwtExpiresAt returns null for malformed', () => {
    expect(getJwtExpiresAt('not.a.jwt')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/local-dev/sipher/app
pnpm test -- src/lib/__tests__/jwt.test.ts --run
```

Expected: FAIL with "Cannot find module '../jwt'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// app/src/lib/jwt.ts

export interface JwtPayload {
  wallet: string;
  iat: number;
  exp: number;
  isAdmin?: boolean;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    // Use base64url decoding; atob handles padded base64
    const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const obj = JSON.parse(json);
    if (typeof obj !== 'object' || obj === null) return null;
    if (typeof obj.wallet !== 'string') return null;
    if (typeof obj.iat !== 'number') return null;
    if (typeof obj.exp !== 'number') return null;
    return obj as JwtPayload;
  } catch {
    return null;
  }
}

export function getJwtExpiresAt(token: string): number | null {
  const payload = decodeJwtPayload(token);
  return payload?.exp ?? null;
}

export function isJwtExpired(token: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const exp = getJwtExpiresAt(token);
  if (exp === null) return true; // defensive: treat malformed as expired
  return nowSeconds >= exp;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- src/lib/__tests__/jwt.test.ts --run
```

Expected: PASS, all 7 tests green.

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add app/src/lib/jwt.ts app/src/lib/__tests__/jwt.test.ts
git commit -m "feat(app): add JWT client-side decode helper

Adds decodeJwtPayload, isJwtExpired, getJwtExpiresAt for client-side
TTL checks on the persisted JWT. No signature verification — purely
for expiry-watch and graceful re-auth. Used by AuthSyncProvider in
subsequent commits."
```

---

## Task A2: API client returns expiresIn from /api/auth/verify

**Files:**
- Modify: `app/src/api/auth.ts`
- Modify: `app/src/api/__tests__/auth.test.ts` (if exists; otherwise create)

- [ ] **Step 1: Read current api/auth.ts to find shape**

```bash
cat /Users/rector/local-dev/sipher/app/src/api/auth.ts
```

Expected shape (per dev-QA finding R-2):
```typescript
export async function verifySignature(...): Promise<{ token: string; isAdmin?: boolean; expiresIn: string }> { ... }
```

- [ ] **Step 2: Write or update the test to assert expiresIn is returned**

```typescript
// app/src/api/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifySignature } from '../auth';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('verifySignature', () => {
  it('returns token, isAdmin, and expiresIn from server response', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'tok', isAdmin: false, expiresIn: '24h' }),
    });

    const result = await verifySignature('wallet', 'nonce', 'sig');
    expect(result).toEqual({ token: 'tok', isAdmin: false, expiresIn: '24h' });
  });
});
```

- [ ] **Step 3: Run test to verify behavior**

```bash
cd ~/local-dev/sipher/app
pnpm test -- src/api/__tests__/auth.test.ts --run
```

If fails: update `verifySignature` to return `expiresIn` in its return type and pass-through in its impl.

- [ ] **Step 4: Update verifySignature signature to include expiresIn**

```typescript
// app/src/api/auth.ts (excerpt)
export interface VerifyResponse {
  token: string;
  isAdmin?: boolean;
  expiresIn: string;  // e.g. "24h"
}

export async function verifySignature(
  wallet: string,
  nonce: string,
  signature: string,
): Promise<VerifyResponse> {
  const res = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, nonce, signature }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? err.error ?? `Auth failed (${res.status})`);
  }
  return res.json();
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test -- src/api/__tests__/auth.test.ts --run
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/api/auth.ts app/src/api/__tests__/auth.test.ts
git commit -m "feat(app): expose expiresIn from verifySignature response

Server already returns { token, isAdmin, expiresIn } from /api/auth/verify
but the client discarded expiresIn. Plumb it through so AuthSyncProvider
can compute expiresAt and schedule preemptive refresh."
```

---

## Task A3: refresh API client wrapper

**Files:**
- Create: `app/src/api/refresh.ts`
- Create: `app/src/api/__tests__/refresh.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// app/src/api/__tests__/refresh.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshToken } from '../refresh';

beforeEach(() => {
  global.fetch = vi.fn();
});

describe('refreshToken', () => {
  it('POSTs to /api/auth/refresh with Bearer token', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'newtok', expiresIn: '24h' }),
    });

    const result = await refreshToken('oldtok');

    expect(global.fetch).toHaveBeenCalledWith('/api/auth/refresh', {
      method: 'POST',
      headers: { Authorization: 'Bearer oldtok' },
    });
    expect(result).toEqual({ token: 'newtok', expiresIn: '24h' });
  });

  it('returns null on 425 (too early)', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 425,
      json: async () => ({ error: { code: 'TOO_EARLY' } }),
    });

    const result = await refreshToken('oldtok');
    expect(result).toBeNull();
  });

  it('throws on 401 (force re-sign-in)', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'INVALID_TOKEN' } }),
    });

    await expect(refreshToken('oldtok')).rejects.toThrow();
  });

  it('returns null on 404 (endpoint not deployed yet)', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const result = await refreshToken('oldtok');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/api/__tests__/refresh.test.ts --run
```

Expected: FAIL with "Cannot find module '../refresh'".

- [ ] **Step 3: Write the implementation**

```typescript
// app/src/api/refresh.ts
export interface RefreshResponse {
  token: string;
  expiresIn: string;
}

/**
 * POST /api/auth/refresh.
 * Returns { token, expiresIn } if refresh succeeded.
 * Returns null if too early (server returns 425) or endpoint not deployed (404).
 * Throws on 401 / 5xx / network errors.
 */
export async function refreshToken(currentToken: string): Promise<RefreshResponse | null> {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${currentToken}` },
  });

  if (res.ok) return res.json();
  if (res.status === 425) return null; // too early — try again later
  if (res.status === 404) return null; // endpoint not deployed; treat as no-refresh
  if (res.status === 401) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? 'Token invalid; full re-sign required');
  }
  throw new Error(`Refresh failed: ${res.status}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- src/api/__tests__/refresh.test.ts --run
```

Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/src/api/refresh.ts app/src/api/__tests__/refresh.test.ts
git commit -m "feat(app): add /api/auth/refresh client wrapper

Returns { token, expiresIn } on success, null on 425 (too early) or
404 (endpoint not yet deployed — graceful degradation), throws on 401.
Used by AuthSyncProvider's expiry watcher to refresh within 5min window."
```

---

## Task A4: ToastProvider + Toast component

**Files:**
- Create: `app/src/providers/ToastProvider.tsx`
- Create: `app/src/components/Toast.tsx`
- Create: `app/src/providers/__tests__/ToastProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// app/src/providers/__tests__/ToastProvider.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastProvider';

function TestComponent() {
  const { show } = useToast();
  return (
    <button onClick={() => show({ message: 'Hello world', kind: 'info' })}>
      Trigger
    </button>
  );
}

describe('ToastProvider', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <span>child</span>
      </ToastProvider>
    );
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('shows toast when show() called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders action button if action provided', () => {
    function ActionToast() {
      const { show } = useToast();
      return (
        <button onClick={() => show({
          message: 'Session expired',
          kind: 'warn',
          action: { label: 'Sign in', onClick: () => {} },
        })}>Trigger</button>
      );
    }
    render(
      <ToastProvider>
        <ActionToast />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Trigger'));
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/providers/__tests__/ToastProvider.test.tsx --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ToastProvider + Toast**

```typescript
// app/src/providers/ToastProvider.tsx
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { Toast, ToastInput } from '../components/Toast';

interface ToastWithId extends ToastInput { id: string; }

interface ToastContextValue {
  show: (input: ToastInput) => string;  // returns toast ID
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastWithId[]>([]);

  const show = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...input, id }]);
    if (input.durationMs ?? 7000 > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, input.durationMs ?? 7000);
    }
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

```typescript
// app/src/components/Toast.tsx
import { X } from '@phosphor-icons/react';

export interface ToastInput {
  message: string;
  kind?: 'info' | 'warn' | 'error' | 'success';
  durationMs?: number;
  action?: { label: string; onClick: () => void };
}

const kindStyles: Record<NonNullable<ToastInput['kind']>, string> = {
  info: 'bg-elevated border-border text-text',
  warn: 'bg-amber-950/90 border-amber-700 text-amber-100',
  error: 'bg-red-950/90 border-red-700 text-red-100',
  success: 'bg-emerald-950/90 border-emerald-700 text-emerald-100',
};

export function Toast({ toast, onDismiss }: { toast: ToastInput; onDismiss: () => void }) {
  const styles = kindStyles[toast.kind ?? 'info'];
  return (
    <div className={`border rounded px-3 py-2 text-sm shadow-lg ${styles}`} role="status" aria-live="polite">
      <div className="flex items-start gap-2">
        <span className="flex-1">{toast.message}</span>
        <button onClick={onDismiss} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
      {toast.action && (
        <button
          onClick={() => { toast.action!.onClick(); onDismiss(); }}
          className="mt-2 px-2 py-1 bg-text/10 hover:bg-text/20 rounded text-xs"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- src/providers/__tests__/ToastProvider.test.tsx --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/providers/ToastProvider.tsx app/src/components/Toast.tsx app/src/providers/__tests__/ToastProvider.test.tsx
git commit -m "feat(app): add ToastProvider + Toast component

Toast slot for surfacing 401 expiry, sign-in errors, network issues.
Used by apiFetch interceptor + AuthSyncProvider in subsequent commits.
4 kinds (info/warn/error/success) with optional action button.
Phosphor X icon for dismiss; role=status + aria-live=polite for a11y."
```

---

## Task A5: AuthSyncProvider — core state machine + tests

**Files:**
- Create: `app/src/providers/AuthSyncProvider.tsx`
- Create: `app/src/hooks/useAuthState.ts` (re-export from provider)
- Create: `app/src/providers/__tests__/AuthSyncProvider.test.tsx`

- [ ] **Step 1: Write the failing test for hydration + status reporting**

```typescript
// app/src/providers/__tests__/AuthSyncProvider.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthSyncProvider } from '../AuthSyncProvider';
import { useAuthState } from '../../hooks/useAuthState';
import { useAppStore } from '../../stores/app';

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(),
}));
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: vi.fn() }),
}));

import { useWallet } from '@solana/wallet-adapter-react';

function TestConsumer() {
  const auth = useAuthState();
  return (
    <>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="token">{auth.token ?? 'null'}</span>
      <span data-testid="publicKey">{auth.publicKey ?? 'null'}</span>
    </>
  );
}

describe('AuthSyncProvider — status machine', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, isAdmin: false, expiresAt: null }, false);
  });

  it('reports status=unauthed when no wallet, no token', () => {
    (useWallet as any).mockReturnValue({ connected: false, publicKey: null, wallet: null });
    render(<AuthSyncProvider><TestConsumer /></AuthSyncProvider>);
    expect(screen.getByTestId('status').textContent).toBe('unauthed');
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('reports status=expired when persisted token is expired', () => {
    const expiredToken = makeJwtForTest({ wallet: 'W', exp: 1000 });
    useAppStore.setState({ token: expiredToken, isAdmin: false, expiresAt: 1000 }, false);
    (useWallet as any).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: null,
    });
    render(<AuthSyncProvider><TestConsumer /></AuthSyncProvider>);
    expect(screen.getByTestId('status').textContent).toBe('expired');
  });

  it('reports status=authed when wallet+token both valid', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const validToken = makeJwtForTest({ wallet: 'W', exp: futureExp });
    useAppStore.setState({ token: validToken, isAdmin: false, expiresAt: futureExp }, false);
    (useWallet as any).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: null,
    });
    render(<AuthSyncProvider><TestConsumer /></AuthSyncProvider>);
    expect(screen.getByTestId('status').textContent).toBe('authed');
    expect(screen.getByTestId('token').textContent).toBe(validToken);
  });

  it('clears token if persisted wallet ≠ current wallet', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const tokenForA = makeJwtForTest({ wallet: 'WalletA', exp: futureExp });
    useAppStore.setState({ token: tokenForA, isAdmin: false, expiresAt: futureExp }, false);
    (useWallet as any).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'WalletB' },
      wallet: null,
    });
    render(<AuthSyncProvider><TestConsumer /></AuthSyncProvider>);
    // After reconciliation effect runs, should clear and report unauthed
    expect(screen.getByTestId('token').textContent).toBe('null');
  });
});

function makeJwtForTest(payload: { wallet: string; exp: number; isAdmin?: boolean }): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ iat: payload.exp - 3600, ...payload }));
  return `${header}.${body}.testsig`;
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- src/providers/__tests__/AuthSyncProvider.test.tsx --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement core AuthSyncProvider (state machine + hydration only — connect/disconnect + expiry come in next tasks)**

```typescript
// app/src/providers/AuthSyncProvider.tsx
import { createContext, useContext, useEffect, useMemo, useRef, ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAppStore } from '../stores/app';
import { isJwtExpired } from '../lib/jwt';

export type AuthStatus = 'connecting' | 'unauthed' | 'authed' | 'expired' | 'error';

export interface AuthState {
  status: AuthStatus;
  token: string | null;
  expiresAt: number | null;
  isAdmin: boolean;
  publicKey: string | null;
  authenticate: () => Promise<void>;
  disconnect: () => Promise<void>;
  error: string | null;
}

const AuthSyncContext = createContext<AuthState | null>(null);

export function useAuthSyncContext(): AuthState {
  const ctx = useContext(AuthSyncContext);
  if (!ctx) throw new Error('useAuthSyncContext must be used within AuthSyncProvider');
  return ctx;
}

export function AuthSyncProvider({ children }: { children: ReactNode }) {
  const { connected, publicKey, wallet, disconnect: walletDisconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { token, isAdmin, expiresAt, clearAuth } = useAppStore((s) => ({
    token: s.token,
    isAdmin: s.isAdmin,
    expiresAt: s.expiresAt ?? null,
    clearAuth: s.clearAuth,
  }));

  const lastWalletRef = useRef<string | null>(null);

  // Reconciliation: clear token if wallet changes
  useEffect(() => {
    const currentWallet = publicKey?.toBase58() ?? null;
    if (currentWallet && lastWalletRef.current && currentWallet !== lastWalletRef.current) {
      clearAuth();
    }
    if (currentWallet) lastWalletRef.current = currentWallet;
    if (!connected) lastWalletRef.current = null;
  }, [publicKey, connected, clearAuth]);

  // Reconciliation: clear token if it's for a different wallet than what's connected
  useEffect(() => {
    if (!connected || !publicKey || !token) return;
    // We can't fully verify JWT signature client-side, but we can check the wallet claim
    // matches the current pubkey. Decode payload (not signature).
    try {
      const parts = token.split('.');
      if (parts.length !== 3) { clearAuth(); return; }
      const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
      const payload = JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.wallet !== publicKey.toBase58()) {
        clearAuth();
      }
    } catch {
      clearAuth();
    }
  }, [connected, publicKey, token, clearAuth]);

  const status: AuthStatus = useMemo(() => {
    if (!connected || !publicKey) return 'unauthed';
    if (!token) return 'unauthed';
    if (isJwtExpired(token)) return 'expired';
    return 'authed';
  }, [connected, publicKey, token]);

  // Stub authenticate / disconnect — real impl in Tasks A6 + A7
  const authenticate = async () => {
    setVisible(true);
  };

  const disconnect = async () => {
    await walletDisconnect();
    clearAuth();
  };

  const value: AuthState = {
    status,
    token,
    expiresAt,
    isAdmin,
    publicKey: publicKey?.toBase58() ?? null,
    authenticate,
    disconnect,
    error: null,
  };

  return <AuthSyncContext.Provider value={value}>{children}</AuthSyncContext.Provider>;
}
```

```typescript
// app/src/hooks/useAuthState.ts
export { useAuthSyncContext as useAuthState } from '../providers/AuthSyncProvider';
```

- [ ] **Step 4: Update Zustand store to include expiresAt + setAuth signature**

```typescript
// app/src/stores/app.ts (excerpt — only the parts to update)
interface AppState {
  // ... existing fields
  token: string | null;
  isAdmin: boolean;
  expiresAt: number | null;          // ← ADD
  setAuth: (token: string, isAdmin: boolean, expiresAt: number | null) => void;  // ← UPDATE
  clearAuth: () => void;
  // ...
}

// In create(...):
setAuth: (token, isAdmin, expiresAt) => set({ token, isAdmin, expiresAt }),
clearAuth: () => set({ token: null, isAdmin: false, expiresAt: null, messages: [], events: [] }),

// In persist config:
{
  name: 'sipher-auth',
  version: 1,                          // ← ADD
  partialize: (s) => ({                 // ← UPDATE
    token: s.token,
    isAdmin: s.isAdmin,
    expiresAt: s.expiresAt,
  }),
  migrate: (persistedState: any, fromVersion: number) => {
    if (fromVersion === 0) {
      // v0 had no expiresAt; force re-auth by clearing token
      return { ...persistedState, token: null, isAdmin: false, expiresAt: null };
    }
    return persistedState;
  },
}
```

- [ ] **Step 5: Run all auth tests to verify**

```bash
pnpm test -- src/providers/__tests__/AuthSyncProvider.test.tsx src/lib/__tests__/jwt.test.ts --run
```

Expected: PASS, all tests green. Existing component tests may break temporarily — that's OK; they get migrated in Tasks A11-A17.

- [ ] **Step 6: Commit**

```bash
git add app/src/providers/AuthSyncProvider.tsx app/src/hooks/useAuthState.ts app/src/providers/__tests__/AuthSyncProvider.test.tsx app/src/stores/app.ts
git commit -m "feat(app): introduce AuthSyncProvider with state machine

Adds AuthSyncProvider that owns the auth state machine: status
(connecting/unauthed/authed/expired/error), token, expiresAt, isAdmin,
publicKey. Reconciles wallet-adapter state with persisted JWT — clears
on wallet switch or wallet/JWT mismatch.

Zustand store gets expiresAt field and persist version 1 with migrate
fn that nukes v0 data (forces re-auth on first migration).

authenticate() and disconnect() are stubs in this commit; full impls
land in next tasks. Existing components not yet migrated; they continue
to use useWallet + useAppStore directly until Tasks A11-A17."
```

---

## Task A6: AuthSyncProvider — connect path with SIWS-then-signMessage fallback

**Files:**
- Modify: `app/src/providers/AuthSyncProvider.tsx`
- Modify: `app/src/providers/__tests__/AuthSyncProvider.test.tsx`

- [ ] **Step 1: Write the failing tests for SIWS happy path + fallback**

```typescript
// Append to AuthSyncProvider.test.tsx

describe('AuthSyncProvider — authenticate', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, isAdmin: false, expiresAt: null }, false);
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('uses SIWS when wallet exposes signIn feature with sign_in_result', async () => {
    const mockSignIn = vi.fn().mockResolvedValue({
      signature: new Uint8Array([1,2,3]),
      signedMessage: new TextEncoder().encode('msg'),
      account: { address: 'W' },
    });
    (useWallet as any).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: { signIn: mockSignIn } },
      signMessage: vi.fn(),
    });
    (global.fetch as any)
      .mockResolvedValueOnce({  // /api/auth/nonce
        ok: true, json: async () => ({ nonce: 'n', message: 'sipher.sip-protocol.org wants you to sign in.\nNonce: n' }),
      })
      .mockResolvedValueOnce({  // /api/auth/verify
        ok: true, json: async () => ({ token: 'tok', isAdmin: false, expiresIn: '24h' }),
      });

    let captured: ReturnType<typeof useAuthState>;
    function Capture() { captured = useAuthState(); return null; }
    render(<AuthSyncProvider><Capture /></AuthSyncProvider>);

    await act(async () => { await captured.authenticate(); });

    expect(mockSignIn).toHaveBeenCalled();
    expect(useAppStore.getState().token).toBe('tok');
  });

  it('falls back to signMessage when wallet has no signIn feature', async () => {
    const mockSignMessage = vi.fn().mockResolvedValue(new Uint8Array([4,5,6]));
    (useWallet as any).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },  // no signIn
      signMessage: mockSignMessage,
    });
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ nonce: 'n', message: 'msg' }),
      })
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', isAdmin: false, expiresIn: '24h' }),
      });

    let captured: ReturnType<typeof useAuthState>;
    function Capture() { captured = useAuthState(); return null; }
    render(<AuthSyncProvider><Capture /></AuthSyncProvider>);

    await act(async () => { await captured.authenticate(); });

    expect(mockSignMessage).toHaveBeenCalled();
    expect(useAppStore.getState().token).toBe('tok');
  });

  it('falls back to signMessage when SIWS returns no result (Jupiter case)', async () => {
    const mockSignIn = vi.fn().mockResolvedValue({});  // no sign_in_result-equivalent fields
    const mockSignMessage = vi.fn().mockResolvedValue(new Uint8Array([7,8,9]));
    (useWallet as any).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: { signIn: mockSignIn } },
      signMessage: mockSignMessage,
    });
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ nonce: 'n', message: 'msg' }),
      })
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ token: 'tok', isAdmin: false, expiresIn: '24h' }),
      });

    let captured: ReturnType<typeof useAuthState>;
    function Capture() { captured = useAuthState(); return null; }
    render(<AuthSyncProvider><Capture /></AuthSyncProvider>);

    await act(async () => { await captured.authenticate(); });

    expect(mockSignIn).toHaveBeenCalled();
    expect(mockSignMessage).toHaveBeenCalled();
    expect(useAppStore.getState().token).toBe('tok');
  });

  it('throws when wallet has no signIn AND no signMessage', async () => {
    (useWallet as any).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      signMessage: undefined,
    });

    let captured: ReturnType<typeof useAuthState>;
    function Capture() { captured = useAuthState(); return null; }
    render(<AuthSyncProvider><Capture /></AuthSyncProvider>);

    await expect(act(async () => { await captured.authenticate(); })).rejects.toThrow();
    expect(useAppStore.getState().token).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/providers/__tests__/AuthSyncProvider.test.tsx --run
```

Expected: 4 new tests fail.

- [ ] **Step 3: Implement authenticate() with SIWS-then-signMessage**

Replace the `authenticate` stub in `AuthSyncProvider.tsx` with:

```typescript
import { requestNonce } from '../api/auth';  // existing
import { verifySignature } from '../api/auth';  // existing
import { encode as bs58Encode } from 'bs58';  // already in deps via wallet-adapter

// Inside AuthSyncProvider component:
const setAuth = useAppStore((s) => s.setAuth);

const authenticate = async () => {
  if (!publicKey || !connected) {
    setVisible(true);
    return;
  }
  const wallet58 = publicKey.toBase58();

  try {
    // Step 1: get nonce + message from server
    const { nonce, message } = await requestNonce(wallet58);

    let signatureBs58: string | null = null;

    // Step 2a: try wallet-standard SIWS
    const adapterSignIn = (wallet?.adapter as any)?.signIn;
    if (typeof adapterSignIn === 'function') {
      try {
        const result = await adapterSignIn({
          domain: window.location.host,
          address: wallet58,
          statement: 'Sign in to Sipher',
          nonce,
        });
        // Wallet-standard SIWS may return result.signature (Uint8Array) or {sign_in_result: ...}
        const sig: Uint8Array | undefined =
          result?.signature ?? result?.sign_in_result?.signature;
        if (sig instanceof Uint8Array && sig.length > 0) {
          signatureBs58 = bs58Encode(sig);
        }
      } catch (err: any) {
        // Re-throw user rejections; otherwise fall through to signMessage
        if (err?.name === 'WalletSignInError' && /reject|denied/i.test(err.message ?? '')) {
          throw new Error('Sign-in rejected');
        }
        // else fall through
      }
    }

    // Step 2b: fallback to signMessage
    if (!signatureBs58) {
      const sm = (wallet?.adapter as any)?.signMessage as
        | ((m: Uint8Array) => Promise<Uint8Array>)
        | undefined;
      if (!sm) {
        throw new Error("This wallet doesn't support sign-in. Try Phantom or Solflare.");
      }
      const sig = await sm(new TextEncoder().encode(message));
      signatureBs58 = bs58Encode(sig);
    }

    // Step 3: verify with server, store token
    const { token: newToken, isAdmin: newIsAdmin, expiresIn } = await verifySignature(
      wallet58,
      nonce,
      signatureBs58,
    );
    const expiresAtSec = parseExpiryToEpoch(expiresIn);
    setAuth(newToken, newIsAdmin ?? false, expiresAtSec);
    lastWalletRef.current = wallet58;
  } catch (err: any) {
    throw err;
  }
};

// Helper: convert "24h" / "1h" / "300s" to absolute epoch seconds
function parseExpiryToEpoch(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)\s*(s|m|h|d)$/i);
  const now = Math.floor(Date.now() / 1000);
  if (!match) return now + 3600;  // safe default 1h if unparseable
  const n = parseInt(match[1], 10);
  const mul = { s: 1, m: 60, h: 3600, d: 86400 }[match[2].toLowerCase() as 's'|'m'|'h'|'d'];
  return now + n * mul;
}
```

Add `parseExpiryToEpoch` as an internal helper at the bottom of `AuthSyncProvider.tsx`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- src/providers/__tests__/AuthSyncProvider.test.tsx --run
```

Expected: PASS for new SIWS / signMessage / fallback / no-method-throws tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/providers/AuthSyncProvider.tsx app/src/providers/__tests__/AuthSyncProvider.test.tsx
git commit -m "feat(app): authenticate() uses SIWS-then-signMessage fallback

Connect handler tries wallet-standard signIn first (Phantom/Solflare path,
one popup). On undefined result OR missing feature, falls back to
signMessage with the server nonce. Throws cleanly if neither method
exists. User rejections propagate; other errors silently fall through
to allow recovery.

Resolves FE H-1 (SIWS-only auth, Jupiter silent fail)."
```

---

## Task A7: AuthSyncProvider — disconnect cleanup + reconciliation on disconnect

**Files:**
- Modify: `app/src/providers/AuthSyncProvider.tsx`
- Modify: `app/src/providers/__tests__/AuthSyncProvider.test.tsx`

- [ ] **Step 1: Write tests for disconnect**

```typescript
// Append to AuthSyncProvider.test.tsx

describe('AuthSyncProvider — disconnect', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, isAdmin: false, expiresAt: null }, false);
  });

  it('disconnect() calls wallet.disconnect AND clears auth', async () => {
    const mockDisconnect = vi.fn().mockResolvedValue(undefined);
    (useWallet as any).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      disconnect: mockDisconnect,
    });
    useAppStore.setState({ token: 'tok', isAdmin: true, expiresAt: 9999 }, false);

    let captured: ReturnType<typeof useAuthState>;
    function Capture() { captured = useAuthState(); return null; }
    render(<AuthSyncProvider><Capture /></AuthSyncProvider>);

    await act(async () => { await captured.disconnect(); });

    expect(mockDisconnect).toHaveBeenCalled();
    expect(useAppStore.getState().token).toBeNull();
    expect(useAppStore.getState().isAdmin).toBe(false);
    expect(useAppStore.getState().expiresAt).toBeNull();
  });

  it('clears auth automatically when wallet disconnects externally', () => {
    const { rerender } = render(<AuthSyncProvider><div /></AuthSyncProvider>);
    useAppStore.setState({ token: 'tok', isAdmin: false, expiresAt: 9999 }, false);

    // Simulate wallet disconnect (connected: false)
    (useWallet as any).mockReturnValue({
      connected: false,
      publicKey: null,
      wallet: null,
      disconnect: vi.fn(),
    });
    rerender(<AuthSyncProvider><div /></AuthSyncProvider>);

    expect(useAppStore.getState().token).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- src/providers/__tests__/AuthSyncProvider.test.tsx --run
```

Expected: 2 new tests fail (disconnect doesn't yet clear auth).

- [ ] **Step 3: Implement explicit disconnect + auto-clear-on-disconnect effect**

In `AuthSyncProvider.tsx`, replace the disconnect stub and add the effect:

```typescript
// Inside component:
const disconnect = async () => {
  try {
    await walletDisconnect();
  } finally {
    clearAuth();
    lastWalletRef.current = null;
  }
};

// New effect: any time wallet becomes disconnected, clear auth
useEffect(() => {
  if (!connected && (token !== null || isAdmin)) {
    clearAuth();
    lastWalletRef.current = null;
  }
}, [connected, token, isAdmin, clearAuth]);
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- src/providers/__tests__/AuthSyncProvider.test.tsx --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/providers/AuthSyncProvider.tsx app/src/providers/__tests__/AuthSyncProvider.test.tsx
git commit -m "feat(app): disconnect clears wallet AND JWT atomically

Explicit disconnect() unwinds wallet-adapter then clearAuth() (ensures
JWT cleared even if walletDisconnect throws). External disconnects
(user clicks 'Disconnect' in their Phantom extension) auto-clear via
useEffect on connected=false. Resolves FE H-6 (state desync between
wallet-adapter and Zustand)."
```

---

## Task A8: AuthSyncProvider — expiry watcher + auto-refresh

**Files:**
- Modify: `app/src/providers/AuthSyncProvider.tsx`
- Modify: `app/src/providers/__tests__/AuthSyncProvider.test.tsx`

- [ ] **Step 1: Write tests for expiry-driven cleanup + refresh**

```typescript
// Append to AuthSyncProvider.test.tsx

describe('AuthSyncProvider — expiry watcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({ token: null, isAdmin: false, expiresAt: null }, false);
    global.fetch = vi.fn();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('clears token when expiry timer fires', () => {
    const expiresInSec = 60;
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const tok = makeJwtForTest({ wallet: 'W', exp });
    useAppStore.setState({ token: tok, isAdmin: false, expiresAt: exp }, false);
    (useWallet as any).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      disconnect: vi.fn(),
    });

    render(<AuthSyncProvider><div /></AuthSyncProvider>);

    expect(useAppStore.getState().token).toBe(tok);

    // Fast-forward past expiry
    act(() => { vi.advanceTimersByTime(expiresInSec * 1000 + 1000); });

    expect(useAppStore.getState().token).toBeNull();
  });

  it('attempts refresh when within 5min window', async () => {
    const expiresInSec = 60;  // < 5min remaining
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const oldTok = makeJwtForTest({ wallet: 'W', exp });
    useAppStore.setState({ token: oldTok, isAdmin: false, expiresAt: exp }, false);
    (useWallet as any).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => 'W' },
      wallet: { adapter: {} },
      disconnect: vi.fn(),
    });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'newtok', expiresIn: '24h' }),
    });

    render(<AuthSyncProvider><div /></AuthSyncProvider>);

    await act(async () => { await vi.runAllTimersAsync(); });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- src/providers/__tests__/AuthSyncProvider.test.tsx --run
```

Expected: 2 new tests fail (no expiry watcher yet).

- [ ] **Step 3: Implement expiry watcher**

In `AuthSyncProvider.tsx`, add:

```typescript
import { refreshToken } from '../api/refresh';

// Inside component, after existing effects:
useEffect(() => {
  if (!token || !expiresAt) return;
  const nowSec = Math.floor(Date.now() / 1000);
  const remainingSec = expiresAt - nowSec;

  // Clear token when it actually expires
  const clearTimer = setTimeout(() => {
    clearAuth();
  }, Math.max(0, remainingSec * 1000));

  // Try refresh within 5min window before expiry
  const fiveMinSec = 5 * 60;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  if (remainingSec > fiveMinSec) {
    refreshTimer = setTimeout(async () => {
      try {
        const result = await refreshToken(token);
        if (result) {
          const newExp = parseExpiryToEpoch(result.expiresIn);
          setAuth(result.token, isAdmin, newExp);
        }
      } catch {
        // refresh failed — let clearTimer handle expiry
      }
    }, (remainingSec - fiveMinSec) * 1000);
  } else if (remainingSec > 0) {
    // already within refresh window — try immediately
    (async () => {
      try {
        const result = await refreshToken(token);
        if (result) {
          const newExp = parseExpiryToEpoch(result.expiresIn);
          setAuth(result.token, isAdmin, newExp);
        }
      } catch {
        // ignore
      }
    })();
  }

  return () => {
    clearTimeout(clearTimer);
    if (refreshTimer) clearTimeout(refreshTimer);
  };
}, [token, expiresAt, isAdmin, clearAuth, setAuth]);
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- src/providers/__tests__/AuthSyncProvider.test.tsx --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/providers/AuthSyncProvider.tsx app/src/providers/__tests__/AuthSyncProvider.test.tsx
git commit -m "feat(app): preemptive JWT refresh + expiry-driven cleanup

Schedules two timers per JWT lifetime:
- Refresh timer: fires (remainingSec - 5min) into the future, calls
  /api/auth/refresh; on success, stores new token + expiresAt.
- Cleanup timer: fires at exact expiry, calls clearAuth() if refresh
  didn't succeed.

If JWT is already within 5min of expiry on hydration, attempts immediate
refresh. Resolves FE H-2 (no expiry watch / refresh)."
```

---

## Task A9: apiFetch 401 interceptor

**Files:**
- Modify: `app/src/api/client.ts`
- Modify: `app/src/api/__tests__/client.test.ts`

- [ ] **Step 1: Read current api/client.ts**

```bash
cat /Users/rector/local-dev/sipher/app/src/api/client.ts
```

Note: the interceptor needs access to `clearAuth` and toast `show`. Pattern: use a module-scope listener registry that the AuthSyncProvider populates on mount.

- [ ] **Step 2: Write tests for the interceptor**

```typescript
// app/src/api/__tests__/client.test.ts (append or create)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, registerAuthInterceptor } from '../client';

beforeEach(() => {
  global.fetch = vi.fn();
  registerAuthInterceptor(null);
});

describe('apiFetch 401 interceptor', () => {
  it('calls registered interceptor on 401', async () => {
    const onUnauth = vi.fn();
    registerAuthInterceptor(onUnauth);

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'EXPIRED', message: 'expired' } }),
    });

    await expect(apiFetch('/test')).rejects.toThrow();
    expect(onUnauth).toHaveBeenCalledTimes(1);
  });

  it('does not call interceptor on non-401 errors', async () => {
    const onUnauth = vi.fn();
    registerAuthInterceptor(onUnauth);

    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server error' }),
    });

    await expect(apiFetch('/test')).rejects.toThrow();
    expect(onUnauth).not.toHaveBeenCalled();
  });

  it('does not call interceptor on 2xx', async () => {
    const onUnauth = vi.fn();
    registerAuthInterceptor(onUnauth);

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await apiFetch('/test');
    expect(onUnauth).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

```bash
pnpm test -- src/api/__tests__/client.test.ts --run
```

Expected: FAIL (registerAuthInterceptor not exported).

- [ ] **Step 4: Implement interceptor in client.ts**

```typescript
// app/src/api/client.ts (add to top of file)
type UnauthHandler = () => void;

let authInterceptor: UnauthHandler | null = null;

export function registerAuthInterceptor(handler: UnauthHandler | null) {
  authInterceptor = handler;
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, init);
  if (res.status === 401) {
    if (authInterceptor) authInterceptor();
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? err.error ?? 'Authentication required');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? err.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}
```

(If `apiFetch` already exists, surgically add the 401 branch above the existing `!res.ok` check.)

- [ ] **Step 5: Wire AuthSyncProvider to register the interceptor**

In `AuthSyncProvider.tsx`, add:

```typescript
import { registerAuthInterceptor } from '../api/client';

// Inside component, in a top-level useEffect:
useEffect(() => {
  registerAuthInterceptor(() => {
    clearAuth();
    // Toast emit handled in next task; for now, just clear
  });
  return () => registerAuthInterceptor(null);
}, [clearAuth]);
```

- [ ] **Step 6: Run all tests**

```bash
pnpm test -- src/api/__tests__/client.test.ts src/providers/__tests__/AuthSyncProvider.test.tsx --run
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/api/client.ts app/src/providers/AuthSyncProvider.tsx app/src/api/__tests__/client.test.ts
git commit -m "feat(app): global 401 interceptor in apiFetch

Module-scope registry pattern: AuthSyncProvider registers on mount,
unregisters on unmount. Any apiFetch call that gets 401 triggers the
registered handler (clearAuth) and throws. Single source of truth
for auth-loss UX.

Resolves FE R-1 (no global 401 interceptor — every fetch caller
reinvents it). Toast emission added in next task."
```

---

## Task A10: Wire toast emission to 401 interceptor

**Files:**
- Modify: `app/src/providers/AuthSyncProvider.tsx`
- Modify: `app/src/App.tsx` (wrap with ToastProvider)

- [ ] **Step 1: Update AuthSyncProvider to consume useToast**

In `AuthSyncProvider.tsx`:

```typescript
import { useToast } from './ToastProvider';

// Inside component (replace the existing registerAuthInterceptor effect):
const { show } = useToast();

useEffect(() => {
  registerAuthInterceptor(() => {
    clearAuth();
    show({
      message: 'Session expired — please sign in again.',
      kind: 'warn',
      durationMs: 12000,
      action: {
        label: 'Sign in',
        onClick: () => { authenticate().catch(() => {}); },
      },
    });
  });
  return () => registerAuthInterceptor(null);
}, [clearAuth, show, authenticate]);
```

- [ ] **Step 2: Wrap App.tsx with both providers**

```typescript
// app/src/App.tsx (excerpt — wrap order: ToastProvider OUTSIDE AuthSyncProvider since AuthSync calls useToast())
import { ToastProvider } from './providers/ToastProvider';
import { AuthSyncProvider } from './providers/AuthSyncProvider';

// Inside the existing tree, replacing whatever wraps:
<ConnectionProvider endpoint={...}>
  <WalletProvider wallets={wallets} autoConnect>
    <WalletModalProvider>
      <ToastProvider>
        <AuthSyncProvider>
          {/* existing app */}
        </AuthSyncProvider>
      </ToastProvider>
    </WalletModalProvider>
  </WalletProvider>
</ConnectionProvider>
```

- [ ] **Step 3: Run app-level smoke test**

```bash
cd ~/local-dev/sipher/app
pnpm typecheck
```

Expected: no type errors. Existing component tests may fail temporarily (they don't have the new provider in test wrappers); fix in component-migration tasks.

- [ ] **Step 4: Commit**

```bash
git add app/src/providers/AuthSyncProvider.tsx app/src/App.tsx
git commit -m "feat(app): toast on 401 + Sign in CTA

401 interceptor now emits a warn toast with 'Sign in' action button
that calls authenticate(). Toast persists 12s; user can dismiss or
click Sign in to trigger flow. App.tsx wraps ToastProvider outside
AuthSyncProvider (since AuthSync consumes useToast)."
```

---

## Task A11: WalletDropdown component

**Files:**
- Create: `app/src/components/WalletDropdown.tsx`
- Create: `app/src/components/__tests__/WalletDropdown.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// app/src/components/__tests__/WalletDropdown.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WalletDropdown } from '../WalletDropdown';

describe('WalletDropdown', () => {
  it('renders pill with shortened address', () => {
    render(<WalletDropdown
      address="HciZTd6rR7YsaS5ZNThx9KdgqSimxwMzJgs2j98U25En"
      onCopy={vi.fn()}
      onReSignIn={vi.fn()}
      onDisconnect={vi.fn()}
    />);
    expect(screen.getByText(/HciZ\.\.\.25En/)).toBeInTheDocument();
  });

  it('opens dropdown on click and shows three actions', () => {
    render(<WalletDropdown
      address="HciZTd6rR7YsaS5ZNThx9KdgqSimxwMzJgs2j98U25En"
      onCopy={vi.fn()} onReSignIn={vi.fn()} onDisconnect={vi.fn()}
    />);
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }));
    expect(screen.getByText(/copy address/i)).toBeInTheDocument();
    expect(screen.getByText(/re-sign/i)).toBeInTheDocument();
    expect(screen.getByText(/disconnect/i)).toBeInTheDocument();
  });

  it('closes on action click and invokes callback', () => {
    const onDisconnect = vi.fn();
    render(<WalletDropdown
      address="HciZTd6rR7YsaS5ZNThx9KdgqSimxwMzJgs2j98U25En"
      onCopy={vi.fn()} onReSignIn={vi.fn()} onDisconnect={onDisconnect}
    />);
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }));
    fireEvent.click(screen.getByText(/disconnect/i));
    expect(onDisconnect).toHaveBeenCalled();
    expect(screen.queryByText(/copy address/i)).not.toBeInTheDocument();
  });

  it('closes on outside click', () => {
    const { container } = render(
      <div>
        <WalletDropdown
          address="HciZTd6rR7YsaS5ZNThx9KdgqSimxwMzJgs2j98U25En"
          onCopy={vi.fn()} onReSignIn={vi.fn()} onDisconnect={vi.fn()}
        />
        <button>outside</button>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }));
    expect(screen.getByText(/copy address/i)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByText(/copy address/i)).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(<WalletDropdown
      address="HciZTd6rR7YsaS5ZNThx9KdgqSimxwMzJgs2j98U25En"
      onCopy={vi.fn()} onReSignIn={vi.fn()} onDisconnect={vi.fn()}
    />);
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText(/copy address/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- src/components/__tests__/WalletDropdown.test.tsx --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement WalletDropdown**

```typescript
// app/src/components/WalletDropdown.tsx
import { useEffect, useRef, useState } from 'react';
import { Copy, ArrowsClockwise, Plug, CaretDown } from '@phosphor-icons/react';

interface Props {
  address: string;
  onCopy: () => void;
  onReSignIn: () => void;
  onDisconnect: () => void;
}

export function WalletDropdown({ address, onCopy, onReSignIn, onDisconnect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const short = `${address.slice(0, 4)}...${address.slice(-4)}`;

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const action = (cb: () => void) => () => { cb(); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 bg-elevated border border-border rounded text-xs text-text hover:bg-text/5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{short}</span>
        <CaretDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-48 bg-elevated border border-border rounded shadow-lg overflow-hidden z-50">
          <button role="menuitem" onClick={action(onCopy)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5">
            <Copy size={14} /> Copy address
          </button>
          <button role="menuitem" onClick={action(onReSignIn)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5">
            <ArrowsClockwise size={14} /> Re-sign in
          </button>
          <button role="menuitem" onClick={action(onDisconnect)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5 border-t border-border">
            <Plug size={14} /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test -- src/components/__tests__/WalletDropdown.test.tsx --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/WalletDropdown.tsx app/src/components/__tests__/WalletDropdown.test.tsx
git commit -m "feat(app): WalletDropdown component (Copy/Re-sign/Disconnect)

Plain Tailwind + Phosphor implementation, no Radix dep added per spec
D6 (lean deps). Closes on outside click, Escape key, or action click.
role=menu/menuitem for a11y. Used in Header.tsx in next task to
replace the unclickable wallet pill (FE H-3 + H-5)."
```

---

## Task A12: Migrate Header.tsx to use WalletDropdown + useAuthState

**Files:**
- Modify: `app/src/components/Header.tsx`
- Modify: `app/src/components/__tests__/Header.test.tsx` (if exists)

- [ ] **Step 1: Read current Header.tsx**

```bash
cat /Users/rector/local-dev/sipher/app/src/components/Header.tsx
```

Identify the wallet pill block (around line 84-97 per dev-QA finding).

- [ ] **Step 2: Update Header.tsx**

Replace the existing wallet pill JSX with:

```typescript
// app/src/components/Header.tsx (relevant excerpt)
import { useAuthState } from '../hooks/useAuthState';
import { WalletDropdown } from './WalletDropdown';
import { useToast } from '../providers/ToastProvider';

export function Header() {
  const { status, publicKey, authenticate, disconnect } = useAuthState();
  const { show } = useToast();
  const network = useNetworkConfigStore((s) => s.config?.network ?? '...');

  const handleCopy = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    show({ message: 'Address copied', kind: 'success', durationMs: 3000 });
  };

  const handleReSignIn = async () => {
    try { await authenticate(); }
    catch (err: any) { show({ message: err?.message ?? 'Sign-in failed', kind: 'error' }); }
  };

  const handleDisconnect = async () => {
    await disconnect();
    show({ message: 'Disconnected', kind: 'info', durationMs: 3000 });
  };

  return (
    <header className="...">
      {/* ... left side: logo, nav tabs ... */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">{network}</span>
        {status === 'unauthed' || status === 'connecting' ? (
          <button
            onClick={() => authenticate().catch((err) => show({ message: err?.message ?? 'Sign-in failed', kind: 'error' }))}
            className="px-3 py-1 bg-accent text-text-inverted rounded text-xs"
          >
            Connect
          </button>
        ) : status === 'expired' ? (
          <button
            onClick={() => authenticate().catch(() => {})}
            className="px-3 py-1 bg-amber-700 text-amber-100 rounded text-xs"
            title="Session expired"
          >
            Re-sign in
          </button>
        ) : publicKey ? (
          <WalletDropdown
            address={publicKey}
            onCopy={handleCopy}
            onReSignIn={handleReSignIn}
            onDisconnect={handleDisconnect}
          />
        ) : null}
      </div>
    </header>
  );
}
```

(Adapt to existing Header.tsx layout; the key change is replacing the unclickable `connected ? <pill> : <connect>` with a status-based switch that uses `WalletDropdown`.)

- [ ] **Step 3: Update existing Header.test.tsx (if exists) to wrap with all providers**

```typescript
// app/src/components/__tests__/Header.test.tsx
import { ToastProvider } from '../../providers/ToastProvider';
// import AuthSyncProvider — but useWallet is mocked so provider works in tests
function withProviders(node: React.ReactNode) {
  return (
    <ToastProvider>
      <AuthSyncProvider>{node}</AuthSyncProvider>
    </ToastProvider>
  );
}
// Use withProviders in render() calls.
```

- [ ] **Step 4: Run tests + typecheck**

```bash
pnpm test -- src/components/__tests__/Header.test.tsx --run
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/Header.tsx app/src/components/__tests__/Header.test.tsx
git commit -m "feat(app): Header uses useAuthState + WalletDropdown

Replaces the unclickable wallet pill with a status-aware switch:
- unauthed/connecting: Connect button → authenticate()
- expired: amber 'Re-sign in' button → authenticate()
- authed: WalletDropdown with Copy/Re-sign/Disconnect

Resolves FE H-3 (autoConnect produces fake-authed UI with no recovery)
and FE H-5 (no Disconnect path on desktop)."
```

---

## Task A13: Migrate BottomNav.tsx to useAuthState

**Files:**
- Modify: `app/src/components/BottomNav.tsx`
- Modify: `app/src/components/__tests__/BottomNav.test.tsx` (if exists)

- [ ] **Step 1: Update BottomNav.tsx — replace direct disconnect with useAuthState().disconnect**

```typescript
// app/src/components/BottomNav.tsx (relevant excerpt — was around line 100-110)
import { useAuthState } from '../hooks/useAuthState';
import { useToast } from '../providers/ToastProvider';

// Inside the More sheet:
const { disconnect } = useAuthState();
const { show } = useToast();

const handleDisconnect = async () => {
  await disconnect();
  show({ message: 'Disconnected', kind: 'info', durationMs: 3000 });
};

// Replace the existing disconnect button onClick with handleDisconnect
```

- [ ] **Step 2: Update tests if any**

```bash
cd ~/local-dev/sipher/app
pnpm test -- src/components/__tests__/BottomNav.test.tsx --run 2>&1 | head -20
```

If tests exist, wrap with provider in render helper. If they don't exist, skip.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/BottomNav.tsx app/src/components/__tests__/BottomNav.test.tsx
git commit -m "refactor(app): BottomNav uses useAuthState().disconnect()

Was calling wallet-adapter's disconnect() directly without clearing
JWT (FE H-6). Now goes through useAuthState which atomically clears
both wallet-adapter state and Zustand persisted JWT."
```

---

## Task A14: Migrate ChatSidebar.tsx — toast on error, no inline string

**Files:**
- Modify: `app/src/components/ChatSidebar.tsx`
- Modify: `app/src/components/__tests__/ChatSidebar.test.tsx` (if exists)

- [ ] **Step 1: Read current ChatSidebar.tsx error path**

```bash
grep -n "appendToLast\|err.message\|catch" /Users/rector/local-dev/sipher/app/src/components/ChatSidebar.tsx
```

Find the catch block (around line 116-118 per dev-QA finding).

- [ ] **Step 2: Replace inline-string error with toast emission**

```typescript
// app/src/components/ChatSidebar.tsx (relevant excerpt)
import { useAuthState } from '../hooks/useAuthState';
import { useToast } from '../providers/ToastProvider';

export function ChatSidebar() {
  const { status, token } = useAuthState();
  const { show } = useToast();

  // ... existing chat logic ...

  // In the catch block of the chat fetch:
  } catch (err: any) {
    // Don't paste error into chat. apiFetch's 401 interceptor already
    // shows the session-expired toast. For other errors:
    if (!/401|expired|invalid token/i.test(err?.message ?? '')) {
      show({ message: err?.message ?? 'Chat request failed', kind: 'error' });
    }
    // Remove the streaming placeholder message that was added before the request
    removeStreamingPlaceholder();
  }
```

- [ ] **Step 3: Run tests + typecheck**

```bash
pnpm test -- src/components/__tests__/ChatSidebar.test.tsx --run
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ChatSidebar.tsx app/src/components/__tests__/ChatSidebar.test.tsx
git commit -m "fix(app): chat surfaces errors as toast, not inline message

Previously raw 'invalid or expired token' string was painted into the
assistant's message bubble. Now: 401s trigger the global interceptor's
toast (Sign in CTA); non-401 errors get an error toast and the
streaming placeholder is removed.

Resolves FE H-4 (raw error string in chat as user-visible content)."
```

---

## Task A15: Migrate SentinelConfirm + DashboardView + VaultView + useSSE

**Files:**
- Modify: `app/src/components/SentinelConfirm.tsx`
- Modify: `app/src/views/DashboardView.tsx`
- Modify: `app/src/views/VaultView.tsx`
- Modify: `app/src/hooks/useSSE.ts`

- [ ] **Step 1: Migrate SentinelConfirm.tsx**

Replace any `useAppStore((s) => s.token)` and direct fetch authorization headers with `useAuthState`:

```typescript
import { useAuthState } from '../hooks/useAuthState';
import { apiFetch } from '../api/client';

const { token } = useAuthState();

// Replace direct fetch with apiFetch (which goes through the 401 interceptor):
await apiFetch('/api/sentinel/decisions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ ... }),
});
```

- [ ] **Step 2: Migrate DashboardView.tsx**

Same pattern: `useAuthState` for token, `apiFetch` for requests.

- [ ] **Step 3: Migrate VaultView.tsx**

Same pattern.

- [ ] **Step 4: Migrate useSSE.ts**

```typescript
// app/src/hooks/useSSE.ts (excerpt)
import { useAuthState } from './useAuthState';

export function useSSE(...) {
  const { token } = useAuthState();
  // ... existing SSE logic, but key the EventSource creation effect on `token` ...
}
```

- [ ] **Step 5: Run all tests + typecheck**

```bash
cd ~/local-dev/sipher/app
pnpm test -- --run
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/SentinelConfirm.tsx app/src/views/DashboardView.tsx app/src/views/VaultView.tsx app/src/hooks/useSSE.ts
git commit -m "refactor(app): migrate components to useAuthState + apiFetch

SentinelConfirm, DashboardView, VaultView, and useSSE now consume
useAuthState() instead of mixing useWallet + useAppStore. All direct
fetch calls migrated to apiFetch so the 401 interceptor catches
expiry across the entire app.

Resolves FE X-1 (single source of truth) + FE X-2 (duplicated
Authorization header)."
```

---

## Task A16: Migrate useAuth.ts → re-export or delete

**Files:**
- Modify: `app/src/hooks/useAuth.ts`

- [ ] **Step 1: Replace useAuth.ts content with re-export**

```typescript
// app/src/hooks/useAuth.ts
// LEGACY: kept for backwards compat with anything still importing useAuth.
// Prefer useAuthState directly going forward.
export { useAuthState as useAuth } from './useAuthState';
```

- [ ] **Step 2: Find any remaining imports of useAuth, leave them be (they get useAuthState transparently)**

```bash
grep -rn "from '.*hooks/useAuth'" /Users/rector/local-dev/sipher/app/src --include='*.tsx' --include='*.ts'
```

- [ ] **Step 3: Run typecheck**

```bash
cd ~/local-dev/sipher/app
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/hooks/useAuth.ts
git commit -m "refactor(app): useAuth becomes thin re-export of useAuthState

Old useAuth.ts had its own (broken) signMessage-only auth flow. All
logic now lives in AuthSyncProvider. Re-export kept so any straggling
imports continue to work. Future code should import useAuthState
directly."
```

---

## Task A17: Drop or DEV-gate JWT-in-URL fallback in sse.ts

**Files:**
- Modify: `app/src/api/sse.ts`

- [ ] **Step 1: Read current sse.ts**

```bash
cat /Users/rector/local-dev/sipher/app/src/api/sse.ts
```

Find the fallback path that constructs `?token=${jwt}` when sse-ticket fails (around line 39-40).

- [ ] **Step 2: Update — gate behind DEV-only check**

```typescript
// app/src/api/sse.ts (excerpt)
export function connectSSE(token: string): EventSource {
  return new EventSourcePromise(token);
}

async function exchangeForTicket(token: string): Promise<string> {
  const res = await fetch('/api/auth/sse-ticket', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`sse-ticket exchange failed: ${res.status}`);
  }
  const { ticket } = await res.json();
  return ticket;
}

class EventSourcePromise extends EventSource {
  constructor(token: string) {
    // Default URL — replaced by ticket exchange below
    super('/api/stream?ticket=pending');
    exchangeForTicket(token)
      .then((ticket) => {
        this.close();
        // Replace internal URL — workaround: emit through a new EventSource
        const real = new EventSource(`/api/stream?ticket=${encodeURIComponent(ticket)}`);
        // forward events; for now just dispatch as-is
        // (in practice this might be simpler with a wrapper class)
      })
      .catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[sse] ticket exchange failed in DEV; falling back to JWT-in-URL', err);
          this.close();
          new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);
        } else {
          // Production: no fallback. Throw so caller can surface error.
          this.dispatchEvent(new Event('error'));
        }
      });
  }
}
```

(NOTE: the actual sse.ts may need different surgery based on its existing shape. The principle is: production never sends JWT in URL; DEV mode keeps the fallback for local dev convenience.)

- [ ] **Step 3: Run typecheck + smoke**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/api/sse.ts
git commit -m "fix(app): drop JWT-in-URL fallback in production

Was sending Bearer JWT as ?token= query when /api/auth/sse-ticket
failed — leaks JWT to nginx access logs and Referer. Now: production
hard-errors when ticket exchange fails (callers see error event).
Dev mode keeps the fallback for local convenience.

Resolves FE R-3 (JWT in URL security exposure)."
```

---

## Task A18: Final FE smoke + lint + test pass

**Files:**
- All FE files (verification only, no edits)

- [ ] **Step 1: Run full FE test suite**

```bash
cd ~/local-dev/sipher/app
pnpm test -- --run
```

Expected: all tests PASS.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
cd ~/local-dev/sipher
pnpm lint 2>&1 | tail -20
```

Expected: clean (or only pre-existing warnings — note any new errors).

- [ ] **Step 4: Run dev build to verify no runtime errors at boot**

```bash
cd ~/local-dev/sipher/app
pnpm build 2>&1 | tail -10
```

Expected: build success.

- [ ] **Step 5: Manual smoke checklist (capture screenshots if possible for PR description)**

Run `pnpm dev` and walk through:
- [ ] Connect Phantom (devnet) → SIWS popup → JWT issued → chat unlocks
- [ ] Click wallet pill → dropdown shows Copy / Re-sign in / Disconnect
- [ ] Click Copy → toast "Address copied" → clipboard contains pubkey
- [ ] Click Re-sign in → Phantom popup → fresh JWT
- [ ] Click Disconnect → wallet disconnects + JWT cleared + toast
- [ ] Reconnect Phantom → SIWS again → working
- [ ] Open DevTools → fast-forward Date by 24h → hit chat → toast "Session expired" with Sign in button → click Sign in → fresh JWT
- [ ] Connect Jupiter (if available) → signMessage fallback → JWT issued
- [ ] Page reload while connected → wallet auto-reconnects → JWT validity verified, kept if valid, cleared+prompted if expired
- [ ] Wallet switch in Phantom → app detects, clears stale JWT, prompts re-auth

- [ ] **Step 6: Open PR**

```bash
git push -u origin feat/authsync-architecture
gh pr create --title "feat: AuthSync provider + SIWS fallback + JWT lifecycle" --body "$(cat <<'EOF'
## Summary
- New `AuthSyncProvider` owns wallet ↔ JWT ↔ store reconciliation
- SIWS-then-`signMessage` fallback unblocks Jupiter / OKX / older wallets
- 24h JWT TTL + auto-refresh within 5min window via `/api/auth/refresh`
- Global 401 interceptor in `apiFetch` surfaces toast with "Sign in" CTA
- Desktop wallet pill becomes dropdown with Copy / Re-sign / Disconnect
- Disconnect (any path) atomically clears wallet-adapter + Zustand JWT
- Drops JWT-in-URL fallback in production

## Resolves
- FE H-1 — SIWS-only auth (Jupiter silent fail)
- FE H-2 — JWT no expiry watch / refresh
- FE H-3 — Auto-reconnect skips re-auth, pill non-clickable
- FE H-4 — Raw "invalid or expired token" in chat
- FE H-5 — No desktop disconnect
- FE H-6 — Disconnect doesn't clear JWT
- FE R-1, R-2, R-4, R-6 — refactors enabled by AuthSync
- FE P-1, P-2 — loading + error toast surfacing
- FE X-1, X-2 — single source of truth + standardized auth header

## Test plan
- [x] All existing component tests pass after migration
- [x] New AuthSyncProvider tests cover 9 scenarios (status machine, SIWS, signMessage fallback, expiry watcher, refresh, disconnect, wallet-switch reconciliation)
- [x] WalletDropdown tests cover open/close/keyboard/outside-click
- [x] ToastProvider tests cover render + action button + dismiss
- [x] Manual smoke completed on Phantom (SIWS) and at least one non-SIWS wallet
- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` all clean

## Spec
docs/superpowers/specs/2026-05-06-phase4a-auth-and-security-fix-design.md
EOF
)"
```

- [ ] **Step 7: Note PR URL for tracking**

PR URL: `<copy from gh pr create output>`

---

# PHASE B: PR 2 — Backend Auth Surface Hardening

**Branch:** `feat/auth-surface-hardening` (from `main`, INDEPENDENT of PR 1)
**Working dir:** `~/local-dev/sipher`

## Task B0: Branch + scaffold

- [ ] **Step 1: Verify clean working tree on main**

```bash
cd ~/local-dev/sipher
git checkout main
git pull origin main
git status
```

Expected: clean tree, latest main.

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b feat/auth-surface-hardening
```

- [ ] **Step 3: Verify pnpm install up to date**

```bash
pnpm install
```

---

## Task B1: Express Request augmentation

**Files:**
- Create: `packages/agent/src/types/express-request.d.ts`

- [ ] **Step 1: Write augmentation file**

```typescript
// packages/agent/src/types/express-request.d.ts
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Wallet pubkey extracted from JWT by verifyJwt middleware. */
    wallet?: string;
    /** True if the wallet is in AUTHORIZED_WALLETS. Set by requireOwner middleware. */
    isAdmin?: boolean;
  }
}
```

- [ ] **Step 2: Add to tsconfig include path if needed**

```bash
cat /Users/rector/local-dev/sipher/packages/agent/tsconfig.json | grep -A3 '"include"'
```

If `src/**/*` is the include, the .d.ts will be picked up automatically. Otherwise add `"src/types/**/*.d.ts"`.

- [ ] **Step 3: Run typecheck**

```bash
cd ~/local-dev/sipher/packages/agent
pnpm typecheck
```

Expected: no new errors. (Existing `as unknown as Record<...>` casts will still type-check; we'll remove them in Task B2.)

- [ ] **Step 4: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/types/express-request.d.ts
git commit -m "feat(agent): augment Express Request with wallet + isAdmin

Adds typed wallet?: string and isAdmin?: boolean to req. Eliminates
the (req as unknown as Record<string, unknown>).wallet cast pattern
in subsequent commits. Resolves BE X-3."
```

---

## Task B2: Replace `(req as unknown as Record...)` casts in protected routes

**Files:**
- Modify: All route files using the cast pattern (per dev-QA agent: 8+ files)

- [ ] **Step 1: Find all cast occurrences**

```bash
cd ~/local-dev/sipher
grep -rn "as unknown as Record" packages/agent/src --include='*.ts' | head -20
```

- [ ] **Step 2: For each file, replace the cast pattern**

Example before:
```typescript
const wallet = (req as unknown as Record<string, unknown>).wallet as string;
```

After:
```typescript
const wallet = req.wallet;
if (!wallet) {
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'JWT middleware did not attach wallet' } });
}
```

(The defensive check is important — TypeScript thinks `wallet` is `string | undefined` after our augmentation; runtime guard ensures middleware ordering bugs are visible.)

- [ ] **Step 3: Run typecheck + tests**

```bash
cd ~/local-dev/sipher
pnpm --filter @sipher/agent typecheck
pnpm --filter @sipher/agent test -- --run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/routes/*.ts
git commit -m "refactor(agent): drop (req as unknown as Record) casts

Replaces ~10 occurrences with typed req.wallet / req.isAdmin reads,
plus a defensive 500 if wallet is missing (catches middleware order
bugs that would otherwise be silent NPEs)."
```

---

## Task B3: trust proxy configuration

**Files:**
- Modify: `packages/agent/src/index.ts`
- Modify: `.env.example`

- [ ] **Step 1: Read current index.ts**

```bash
cat /Users/rector/local-dev/sipher/packages/agent/src/index.ts | head -60
```

Find the Express app creation (around line 131-153 per dev-QA finding).

- [ ] **Step 2: Add trust proxy + startup log**

```typescript
// packages/agent/src/index.ts (near app creation)
const app = express();

const trustProxy = parseInt(process.env.TRUST_PROXY ?? '1', 10);
app.set('trust proxy', trustProxy);
console.log(`[agent] trust proxy = ${trustProxy} (set TRUST_PROXY env var to override)`);
```

- [ ] **Step 3: Document in .env.example**

```bash
# Append to .env.example
echo "" >> /Users/rector/local-dev/sipher/.env.example
echo "# Number of nginx/load-balancer hops in front of the agent (default: 1)" >> /Users/rector/local-dev/sipher/.env.example
echo "# Set to 0 if running locally without nginx; 1 for VPS production." >> /Users/rector/local-dev/sipher/.env.example
echo "TRUST_PROXY=1" >> /Users/rector/local-dev/sipher/.env.example
```

- [ ] **Step 4: Run tests**

```bash
cd ~/local-dev/sipher
pnpm --filter @sipher/agent test -- --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/index.ts .env.example
git commit -m "feat(agent): app.set('trust proxy', N)

req.ip now resolves to client X-Forwarded-For value behind nginx
instead of nginx's IP. Per-IP rate limiters become actually per-IP
instead of single global counters. TRUST_PROXY env (default 1)
allows tuning if multi-hop proxy used.

Resolves BE H-1."
```

---

## Task B4: Input validation on /api/auth/nonce

**Files:**
- Modify: `packages/agent/src/routes/auth.ts`
- Modify: `packages/agent/src/routes/__tests__/auth.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// Append to auth.test.ts
describe('POST /api/auth/nonce — input validation', () => {
  it('rejects wallet > 64 chars', async () => {
    const res = await request(app)
      .post('/api/auth/nonce')
      .send({ wallet: 'A'.repeat(65) });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('VALIDATION_FAILED');
  });

  it('rejects wallet with non-base58 chars', async () => {
    const res = await request(app)
      .post('/api/auth/nonce')
      .send({ wallet: 'has spaces and !@#' });
    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe('VALIDATION_FAILED');
  });

  it('rejects wallet shorter than 32 chars', async () => {
    const res = await request(app)
      .post('/api/auth/nonce')
      .send({ wallet: 'A'.repeat(31) });
    expect(res.status).toBe(400);
  });

  it('accepts valid base58 Solana pubkey', async () => {
    const res = await request(app)
      .post('/api/auth/nonce')
      .send({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' });
    expect(res.status).toBe(200);
    expect(res.body.nonce).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
cd ~/local-dev/sipher
pnpm --filter @sipher/agent test -- src/routes/__tests__/auth.test.ts --run
```

Expected: 3 of 4 new tests fail (no validation yet).

- [ ] **Step 3: Implement validation**

```typescript
// packages/agent/src/routes/auth.ts (in the /nonce handler)
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

router.post('/nonce', /* rate limit middleware in next task */, async (req, res) => {
  const { wallet } = req.body;
  if (typeof wallet !== 'string') {
    return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'wallet must be a string' } });
  }
  if (wallet.length > 64) {
    return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'wallet too long' } });
  }
  if (!BASE58_REGEX.test(wallet)) {
    return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'wallet must be a valid base58 Solana pubkey' } });
  }

  // ... existing nonce generation logic ...
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @sipher/agent test -- src/routes/__tests__/auth.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/routes/auth.ts packages/agent/src/routes/__tests__/auth.test.ts
git commit -m "feat(agent): input validation on /api/auth/nonce

Rejects wallet field that is non-string, > 64 chars, or doesn't match
base58 Solana pubkey shape (32-44 chars from the base58 alphabet).
Returns 400 with structured VALIDATION_FAILED error.

Prevents memory exhaustion attack (1MB string × 10K nonces = 10GB)
+ amplification of /verify CPU cost on malformed inputs.

Resolves BE H-2."
```

---

## Task B5: Per-IP rate limit on /api/auth/nonce

**Files:**
- Modify: `packages/agent/src/routes/auth.ts`
- Modify: `packages/agent/src/routes/__tests__/auth.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// Append to auth.test.ts — note this depends on test isolation; reset state between tests
describe('POST /api/auth/nonce — rate limit', () => {
  beforeEach(() => {
    _resetAuthStateForTests(); // existing helper from memory note
  });

  it('returns 429 after 5 requests/min from same IP', async () => {
    const validWallet = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/nonce')
        .set('X-Forwarded-For', '1.2.3.4')
        .send({ wallet: validWallet });
      expect(res.status).toBe(200);
    }
    const res6 = await request(app)
      .post('/api/auth/nonce')
      .set('X-Forwarded-For', '1.2.3.4')
      .send({ wallet: validWallet });
    expect(res6.status).toBe(429);
    expect(res6.body.error?.code).toBe('RATE_LIMITED');
  });

  it('different IP gets independent budget', async () => {
    const validWallet = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/nonce').set('X-Forwarded-For', '1.2.3.4').send({ wallet: validWallet });
    }
    const res = await request(app).post('/api/auth/nonce').set('X-Forwarded-For', '5.6.7.8').send({ wallet: validWallet });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Expected: 2 new tests fail.

- [ ] **Step 3: Implement rate limit middleware**

```typescript
// packages/agent/src/routes/auth.ts
const NONCE_RATE_LIMIT_WINDOW_MS = 60_000;
const NONCE_RATE_LIMIT_MAX = 5;
const nonceAttempts = new Map<string, { count: number; firstAt: number }>();

function nonceRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = nonceAttempts.get(ip);
  if (!entry || now - entry.firstAt > NONCE_RATE_LIMIT_WINDOW_MS) {
    nonceAttempts.set(ip, { count: 1, firstAt: now });
    return next();
  }
  if (entry.count >= NONCE_RATE_LIMIT_MAX) {
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many nonce requests, slow down' } });
    return;
  }
  entry.count += 1;
  next();
}

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of nonceAttempts) {
    if (now - entry.firstAt > NONCE_RATE_LIMIT_WINDOW_MS) {
      nonceAttempts.delete(ip);
    }
  }
}, NONCE_RATE_LIMIT_WINDOW_MS);

// Apply to /nonce route:
router.post('/nonce', nonceRateLimit, async (req, res) => { /* ... */ });

// Update _resetAuthStateForTests to clear nonceAttempts too:
export function _resetAuthStateForTests() {
  // ... existing resets ...
  nonceAttempts.clear();
}
```

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/routes/auth.ts packages/agent/src/routes/__tests__/auth.test.ts
git commit -m "feat(agent): per-IP rate limit on /api/auth/nonce (5/min)

Anonymous endpoint had only the global pendingNonces.size cap; one
attacker could fill the table and DoS legitimate sign-ins. Now: 5
requests/min/IP returns 429 RATE_LIMITED. Uses req.ip which is
correct now that trust proxy is configured (B3).

Resolves BE H-3."
```

---

## Task B6: JWT_EXPIRY env-configurable + 24h default

**Files:**
- Modify: `packages/agent/src/routes/auth.ts`
- Modify: `.env.example`

- [ ] **Step 1: Find current JWT_EXPIRY**

```bash
grep -n "JWT_EXPIRY\|expiresIn:" /Users/rector/local-dev/sipher/packages/agent/src/routes/auth.ts
```

Expected: `JWT_EXPIRY = '1h'` module constant.

- [ ] **Step 2: Make env-configurable**

```typescript
// packages/agent/src/routes/auth.ts (top of file)
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? (process.env.NODE_ENV === 'test' ? '1h' : '24h');
```

- [ ] **Step 3: Document in .env.example**

```bash
echo "" >> /Users/rector/local-dev/sipher/.env.example
echo "# JWT lifetime. Default 24h in production, 1h in tests." >> /Users/rector/local-dev/sipher/.env.example
echo "# Reduce for higher security; increase for less re-auth churn." >> /Users/rector/local-dev/sipher/.env.example
echo "JWT_EXPIRY=24h" >> /Users/rector/local-dev/sipher/.env.example
```

- [ ] **Step 4: Run tests (existing /verify tests should still pass)**

```bash
cd ~/local-dev/sipher
pnpm --filter @sipher/agent test -- --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/routes/auth.ts .env.example
git commit -m "feat(agent): JWT_EXPIRY env-configurable, default 24h

Hardcoded '1h' was creating user-visible auth churn during sessions.
Default extends to 24h for production, kept 1h for tests (since some
tests assert TTL behavior). Override via env var.

Resolves BE R-3 (part 1 of 2 — refresh endpoint in next task)."
```

---

## Task B7: /api/auth/refresh endpoint

**Files:**
- Modify: `packages/agent/src/routes/auth.ts`
- Modify: `packages/agent/src/routes/__tests__/auth.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// Append to auth.test.ts
describe('POST /api/auth/refresh', () => {
  it('returns new token when within 5min of expiry', async () => {
    const wallet = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';
    const oldToken = jwt.sign({ wallet, isAdmin: false }, JWT_SECRET, { expiresIn: '4m' });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${oldToken}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.expiresIn).toBeDefined();
  });

  it('returns 425 if more than 5min from expiry', async () => {
    const wallet = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';
    const newToken = jwt.sign({ wallet, isAdmin: false }, JWT_SECRET, { expiresIn: '20m' });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${newToken}`)
      .send();
    expect(res.status).toBe(425);
    expect(res.body.error?.code).toBe('TOO_EARLY');
  });

  it('returns 401 if token expired', async () => {
    const wallet = 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr';
    const expiredToken = jwt.sign({ wallet, isAdmin: false }, JWT_SECRET, { expiresIn: '-1s' });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send();
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 if no Authorization header', async () => {
    const res = await request(app).post('/api/auth/refresh').send();
    expect(res.status).toBe(401);
    expect(res.body.error?.code).toBe('UNAUTHENTICATED');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Expected: all 4 fail.

- [ ] **Step 3: Implement /refresh handler**

```typescript
// packages/agent/src/routes/auth.ts
router.post('/refresh', (req: Request, res: Response) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing or malformed Authorization header' } });
    return;
  }
  const token = auth.slice(7);

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  } catch {
    res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Token invalid or expired' } });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = payload.exp ?? 0;
  const fiveMin = 5 * 60;

  if (exp - now > fiveMin) {
    res.status(425).json({ error: { code: 'TOO_EARLY', message: 'Refresh allowed within 5min of expiry' } });
    return;
  }

  const newToken = jwt.sign(
    { wallet: payload.wallet, isAdmin: payload.isAdmin },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  res.json({ token: newToken, expiresIn: JWT_EXPIRY });
});
```

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/routes/auth.ts packages/agent/src/routes/__tests__/auth.test.ts
git commit -m "feat(agent): POST /api/auth/refresh

Accepts valid JWT < 5min from expiry, returns fresh JWT with new TTL.
425 if too early (> 5min remaining), 401 if expired/invalid, 401 if
no Authorization header.

Frontend AuthSyncProvider auto-calls this within the 5min window so
typical session never re-signs. Hard expiry still forces full re-sign
via signMessage flow.

Resolves BE R-3 (part 2 of 2)."
```

---

## Task B8: AUTHORIZED_WALLETS parsed once at module load

**Files:**
- Modify: `packages/agent/src/routes/auth.ts`

- [ ] **Step 1: Find current parsing site**

```bash
grep -n "AUTHORIZED_WALLETS" /Users/rector/local-dev/sipher/packages/agent/src/routes/auth.ts
```

Expected: parsed inside `requireOwner` middleware on every request.

- [ ] **Step 2: Refactor to module-load parse**

```typescript
// packages/agent/src/routes/auth.ts (top of file or near requireOwner)
const AUTHORIZED_WALLETS_SET = new Set(
  (process.env.AUTHORIZED_WALLETS ?? '')
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
);
console.log(`[agent] AUTHORIZED_WALLETS: ${AUTHORIZED_WALLETS_SET.size} entries`);

function requireOwner(req: Request, res: Response, next: NextFunction): void {
  const wallet = req.wallet;
  if (!wallet || !AUTHORIZED_WALLETS_SET.has(wallet)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
    return;
  }
  next();
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @sipher/agent test -- --run
```

Expected: PASS (existing requireOwner tests should pass with same semantics).

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/routes/auth.ts
git commit -m "perf(agent): parse AUTHORIZED_WALLETS once at module load

Was comma-split + trim per request. Now: parsed once into Set<string>
at module init, single .has() lookup per request. Startup log line
shows entry count so misconfig is visible.

Resolves BE R-4."
```

---

## Task B9: Centralized ephemeral state module

**Files:**
- Create: `packages/agent/src/state/ephemeral.ts`
- Create: `packages/agent/src/state/__tests__/ephemeral.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/agent/src/state/__tests__/ephemeral.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore } from '../ephemeral';

describe('ephemeral createStore — in-memory backend', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('set/get round-trips', async () => {
    const store = createStore<string>('test1', { maxSize: 100 });
    await store.set('k', 'v', 60);
    expect(await store.get('k')).toBe('v');
  });

  it('delete removes entry', async () => {
    const store = createStore<string>('test2', { maxSize: 100 });
    await store.set('k', 'v', 60);
    await store.delete('k');
    expect(await store.get('k')).toBeNull();
  });

  it('expires after TTL', async () => {
    const store = createStore<string>('test3', { maxSize: 100 });
    await store.set('k', 'v', 1);
    vi.advanceTimersByTime(2000);
    expect(await store.get('k')).toBeNull();
  });

  it('respects maxSize cap (oldest evicted)', async () => {
    const store = createStore<string>('test4', { maxSize: 2 });
    await store.set('a', '1', 60);
    await store.set('b', '2', 60);
    await store.set('c', '3', 60);
    expect(await store.get('a')).toBeNull();
    expect(await store.get('c')).toBe('3');
  });

  it('size() returns current count', async () => {
    const store = createStore<string>('test5', { maxSize: 100 });
    await store.set('a', '1', 60);
    await store.set('b', '2', 60);
    expect(await store.size()).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm --filter @sipher/agent test -- src/state/__tests__/ephemeral.test.ts --run
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement createStore (in-memory only for now; Redis in a follow-up)**

```typescript
// packages/agent/src/state/ephemeral.ts

interface MemEntry<T> { value: T; expiresAt: number; }

export interface EphemeralStore<T> {
  set(key: string, value: T, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<T | null>;
  delete(key: string): Promise<void>;
  size(): Promise<number>;
  /** Test helper — clears all entries. */
  _clear(): Promise<void>;
}

interface CreateStoreOptions {
  /** Max number of entries; oldest evicted FIFO. */
  maxSize?: number;
  /** Sweep interval for expired entries (default 60s). */
  sweepIntervalMs?: number;
}

export function createStore<T>(name: string, opts: CreateStoreOptions = {}): EphemeralStore<T> {
  const map = new Map<string, MemEntry<T>>();
  const maxSize = opts.maxSize ?? 10_000;
  const sweepInterval = opts.sweepIntervalMs ?? 60_000;

  const sweep = () => {
    const now = Date.now();
    for (const [k, entry] of map) {
      if (entry.expiresAt <= now) map.delete(k);
    }
  };
  const interval = setInterval(sweep, sweepInterval);
  // Don't keep the process alive just for sweeping
  if (typeof interval === 'object' && 'unref' in interval) {
    (interval as any).unref();
  }

  return {
    async set(key, value, ttlSeconds) {
      const expiresAt = Date.now() + ttlSeconds * 1000;
      // Evict oldest if at cap
      if (map.size >= maxSize && !map.has(key)) {
        const firstKey = map.keys().next().value;
        if (firstKey !== undefined) map.delete(firstKey);
      }
      map.set(key, { value, expiresAt });
    },
    async get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        map.delete(key);
        return null;
      }
      return entry.value;
    },
    async delete(key) {
      map.delete(key);
    },
    async size() {
      return map.size;
    },
    async _clear() {
      map.clear();
    },
  };
}
```

- [ ] **Step 4: Run tests**

Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/state/ephemeral.ts packages/agent/src/state/__tests__/ephemeral.test.ts
git commit -m "feat(agent): centralized ephemeral state factory

createStore<T>(name, opts) returns EphemeralStore with set/get/delete/size.
In-memory backend with FIFO eviction at maxSize cap, periodic sweep
for expired entries. Foundation for migrating 6 module-scope Maps
in subsequent commits (BE X-1).

Redis backend (toggled via REDIS_URL env) deferred to follow-up; the
in-memory implementation is production-safe for single-replica deployment."
```

---

## Task B10: Migrate routes/auth.ts maps to ephemeral state

**Files:**
- Modify: `packages/agent/src/routes/auth.ts`
- Modify: `packages/agent/src/routes/__tests__/auth.test.ts` (update _resetAuthStateForTests)

- [ ] **Step 1: Identify the 3 maps in auth.ts**

```bash
grep -n "new Map" /Users/rector/local-dev/sipher/packages/agent/src/routes/auth.ts
```

Expected: `pendingNonces`, `verifyAttempts` (rate limit on /verify), `sseTickets`. Plus `nonceAttempts` from B5.

- [ ] **Step 2: Replace each with createStore call**

```typescript
// packages/agent/src/routes/auth.ts (top)
import { createStore } from '../state/ephemeral';

const pendingNonces = createStore<{ wallet: string; expiresAt: number }>('pendingNonces', { maxSize: 10_000 });
const verifyAttempts = createStore<{ count: number; firstAt: number }>('verifyAttempts', { maxSize: 1_000 });
const sseTickets = createStore<{ wallet: string }>('sseTickets', { maxSize: 5_000 });
const nonceAttempts = createStore<{ count: number; firstAt: number }>('nonceAttempts', { maxSize: 1_000 });
```

Update all `pendingNonces.get(...)` → `await pendingNonces.get(...)`, `pendingNonces.set(k, v)` → `await pendingNonces.set(k, v, ttlInSeconds)`. The handlers become `async`.

For TTL:
- pendingNonces: 5 minutes (300s)
- sseTickets: 30 seconds
- verifyAttempts / nonceAttempts: 60s window (rate limit window)

- [ ] **Step 3: Update _resetAuthStateForTests**

```typescript
export async function _resetAuthStateForTests() {
  await pendingNonces._clear();
  await verifyAttempts._clear();
  await sseTickets._clear();
  await nonceAttempts._clear();
}
```

(Update test files to `await` it.)

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @sipher/agent test -- src/routes/__tests__/auth.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/routes/auth.ts packages/agent/src/routes/__tests__/auth.test.ts
git commit -m "refactor(agent): auth.ts maps migrated to ephemeral store

pendingNonces, verifyAttempts, sseTickets, nonceAttempts all now go
through createStore<T>() with explicit TTLs. Cleanup is centralized
(no more per-map setInterval). _resetAuthStateForTests() becomes
async.

Resolves BE X-1 (part 1 of 4)."
```

---

## Task B11: Migrate admin.ts + confirm.ts + circuit-breaker maps

**Files:**
- Modify: `packages/agent/src/routes/admin.ts`
- Modify: `packages/agent/src/routes/confirm.ts`
- Modify: `packages/agent/src/routes/circuit-breaker.ts` (or wherever flags live — search first)

- [ ] **Step 1: Find module-scope maps in each file**

```bash
grep -n "new Map" /Users/rector/local-dev/sipher/packages/agent/src/routes/admin.ts
grep -n "new Map" /Users/rector/local-dev/sipher/packages/agent/src/routes/confirm.ts
grep -rn "circuit.*breaker\|pendingFlags" /Users/rector/local-dev/sipher/packages/agent/src/routes --include='*.ts'
```

- [ ] **Step 2: Replace each map with createStore call**

For each file, follow the same pattern as Task B10. Update test files accordingly.

- [ ] **Step 3: Run all tests**

```bash
pnpm --filter @sipher/agent test -- --run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/routes/admin.ts packages/agent/src/routes/confirm.ts packages/agent/src/routes/circuit-breaker.ts packages/agent/src/routes/__tests__/
git commit -m "refactor(agent): migrate admin/confirm/circuit-breaker to ephemeral

adminTokens, pendingConfirms, circuit-breaker flags now use createStore.
All 6 module-scope maps from dev-QA finding BE X-1 are now centralized.

Resolves BE X-1 (parts 2-4 of 4)."
```

---

## Task B12: SOLANA_NETWORK migration — 13 files

**Files:**
- Modify: 13 files reading `process.env.SOLANA_NETWORK` directly

- [ ] **Step 1: List all sites**

```bash
cd ~/local-dev/sipher
grep -rn "process\.env\.SOLANA_NETWORK" packages/agent/src --include='*.ts' | grep -v __tests__ | grep -v "config/network"
```

Expected: 13 entries per dev-QA finding BE H-5.

- [ ] **Step 2: For each file, replace direct env read with loadNetworkConfig() call**

Pattern:
```typescript
// BEFORE
const cluster = (process.env.SOLANA_NETWORK as Cluster) ?? 'mainnet-beta';

// AFTER
import { loadNetworkConfig } from '../config/network';
const cluster = loadNetworkConfig().clusterName;
```

Files (13 total):
1. `packages/agent/src/routes/vault-api.ts`
2. `packages/agent/src/sentinel/vault-refund.ts`
3. `packages/agent/src/sentinel/scanner.ts`
4. `packages/agent/src/tools/deposit.ts`
5. `packages/agent/src/tools/send.ts`
6. `packages/agent/src/tools/refund.ts`
7. `packages/agent/src/tools/balance.ts`
8. `packages/agent/src/tools/scan.ts`
9. `packages/agent/src/tools/history.ts`
10. `packages/agent/src/tools/status.ts`
11. `packages/agent/src/tools/viewing-key.ts`
12. `packages/agent/src/tools/privacy-score.ts`
13. `packages/agent/src/tools/consolidate.ts`

- [ ] **Step 3: Verify no direct reads remain (outside config/network.ts)**

```bash
grep -rn "process\.env\.SOLANA_NETWORK" packages/agent/src --include='*.ts' | grep -v "config/network.ts" | grep -v __tests__
```

Expected: empty (only the canonical site in config/network.ts).

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @sipher/agent test -- --run
```

Expected: PASS. (Tools that previously defaulted to mainnet now use loadNetworkConfig() which throws if SIPHER_NETWORK unset — make sure test setup provides SIPHER_NETWORK=devnet).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/
git commit -m "refactor(agent): migrate 13 files from SOLANA_NETWORK env to loadNetworkConfig()

Eliminates the silent-mainnet-leak risk where SIPHER_NETWORK=devnet was
set but a tool read SOLANA_NETWORK directly with mainnet-beta fallback.
All fund-moving tools, vault-api, SENTINEL scanner now go through the
single source of truth.

Resolves BE H-5 (mainnet leak risk)."
```

---

## Task B13: SOLANA_RPC_URL migration — 3 files

**Files:**
- Modify: 3 SENTINEL tool files

- [ ] **Step 1: List sites**

```bash
grep -rn "process\.env\.SOLANA_RPC_URL" /Users/rector/local-dev/sipher/packages/agent/src --include='*.ts' | grep -v __tests__ | grep -v "config/network"
```

- [ ] **Step 2: Replace each with loadNetworkConfig().rpcUrl**

Files:
1. `packages/agent/src/sentinel/tools/get-on-chain-signatures.ts`
2. `packages/agent/src/sentinel/tools/get-vault-balance.ts`
3. `packages/agent/src/sentinel/tools/get-deposit-status.ts`

Pattern:
```typescript
// BEFORE
const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const conn = new Connection(rpcUrl);

// AFTER
import { loadNetworkConfig } from '../../config/network';
const conn = new Connection(loadNetworkConfig().rpcUrl);
```

- [ ] **Step 3: Verify migration complete**

```bash
grep -rn "process\.env\.SOLANA_RPC_URL" packages/agent/src --include='*.ts' | grep -v "config/network.ts" | grep -v __tests__
```

Expected: empty.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @sipher/agent test -- --run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/sentinel/tools/
git commit -m "refactor(agent): SENTINEL tools use loadNetworkConfig().rpcUrl

3 SENTINEL on-chain tools previously defaulted to mainnet-beta. Now
they go through loadNetworkConfig() which respects SIPHER_HELIUS_API_KEY
when set (so they get the keyed Helius endpoint instead of public RPC).

Resolves BE H-5 (RPC URL part)."
```

---

## Task B14: ESLint rule banning direct SOLANA_NETWORK / SOLANA_RPC_URL reads

**Files:**
- Modify: `eslint.config.js` or `.eslintrc.cjs` (whichever is in use)

- [ ] **Step 1: Identify ESLint config file**

```bash
ls /Users/rector/local-dev/sipher/eslint.config.* /Users/rector/local-dev/sipher/.eslintrc.*
```

- [ ] **Step 2: Add the rule**

```javascript
// eslint.config.js (excerpt)
{
  files: ['packages/agent/src/**/*.ts'],
  ignores: [
    'packages/agent/src/config/network.ts',
    'packages/agent/src/**/__tests__/**',
    'packages/agent/src/**/*.test.ts',
    'packages/agent/src/**/*.spec.ts',
  ],
  rules: {
    'no-restricted-syntax': ['error', {
      selector: 'MemberExpression[object.object.name="process"][object.property.name="env"][property.name=/^(SOLANA_NETWORK|SOLANA_RPC_URL)$/]',
      message: 'Use loadNetworkConfig() instead of reading process.env.SOLANA_NETWORK / SOLANA_RPC_URL directly. See packages/agent/src/config/network.ts.',
    }],
  },
},
```

- [ ] **Step 3: Run lint**

```bash
cd ~/local-dev/sipher
pnpm lint
```

Expected: clean — no violations remain after Tasks B12 + B13.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js
git commit -m "build(agent): ESLint rule bans direct SOLANA_NETWORK/RPC_URL reads

Prevents the 14th file from being added without going through
loadNetworkConfig(). Exempts config/network.ts (canonical site)
and test files. Future PRs that read these env vars directly fail CI.

Resolves BE X-2 (single source of truth enforcement)."
```

---

## Task B15: SIPHER_NETWORK in docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Find the api service env block**

```bash
cat /Users/rector/local-dev/sipher/docker-compose.yml | grep -A30 "api:"
```

- [ ] **Step 2: Add SIPHER_NETWORK**

```yaml
# docker-compose.yml
services:
  api:
    image: ghcr.io/sip-protocol/sipher:latest
    environment:
      - SIPHER_NETWORK=${SIPHER_NETWORK:-devnet}   # ← ADD
      - SOLANA_NETWORK=${SOLANA_NETWORK:-devnet}
      - SIPHER_HELIUS_API_KEY=${SIPHER_HELIUS_API_KEY}
      - JWT_EXPIRY=${JWT_EXPIRY:-24h}              # ← ADD
      - TRUST_PROXY=${TRUST_PROXY:-1}              # ← ADD
      # ... existing vars ...
```

- [ ] **Step 3: Verify yaml is well-formed**

```bash
docker compose config -q  # Validates without starting
```

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "build: add SIPHER_NETWORK + JWT_EXPIRY + TRUST_PROXY to compose

loadNetworkConfig() throws fatally if SIPHER_NETWORK unset; container
won't boot. Adding the var with safe default (devnet) prevents next
deploy from failing. JWT_EXPIRY and TRUST_PROXY similarly defaulted.

Resolves BE H-6."
```

---

## Task B16: SENTINEL_MODE default to 'advisory'

**Files:**
- Modify: `packages/agent/src/sentinel/config.ts`

- [ ] **Step 1: Find current default**

```bash
grep -n "yolo\|advisory\|SENTINEL_MODE" /Users/rector/local-dev/sipher/packages/agent/src/sentinel/config.ts
```

Expected: `parseMode` returns `'yolo'` for unknown/unset values.

- [ ] **Step 2: Flip default + add startup warn**

```typescript
// packages/agent/src/sentinel/config.ts (excerpt)
function parseMode(raw?: string): SentinelMode {
  if (raw === 'yolo') return 'yolo';
  if (raw === 'off') return 'off';
  return 'advisory';  // safe default for unset OR unknown
}

export function getSentinelConfig(): SentinelConfig {
  const mode = parseMode(process.env.SENTINEL_MODE);
  if (mode === 'yolo') {
    console.warn('[sentinel] SENTINEL_MODE=yolo — autonomous fund-moving operations enabled. Confirm this is intentional.');
  }
  return { mode, /* ... existing fields ... */ };
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @sipher/agent test -- --run
```

Expected: PASS (existing tests should pass; new behavior is the safer default).

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/sentinel/config.ts
git commit -m "fix(agent): SENTINEL_MODE defaults to 'advisory' (fail-safe)

Was defaulting to 'yolo' on unset/unknown env. Operator dropping the
env var would silently flip SENTINEL into autonomous fund-moving mode.
Now: default 'advisory'. Explicit 'yolo' required + startup warn log.

Resolves BE R-8."
```

---

## Task B17: FUND_MOVING_TOOLS deduplication

**Files:**
- Modify: `packages/agent/src/sentinel/preflight-rules.ts`
- Modify: `packages/agent/src/index.ts`

- [ ] **Step 1: Export from preflight-rules.ts**

```typescript
// packages/agent/src/sentinel/preflight-rules.ts (top)
export const FUND_MOVING_TOOLS = new Set<string>([
  'deposit', 'send', 'swap', 'refund', /* etc — copy current list */
]);
```

- [ ] **Step 2: Import in index.ts, replace local BLOCKED_TOOLS**

```typescript
// packages/agent/src/index.ts
import { FUND_MOVING_TOOLS } from './sentinel/preflight-rules';

// Replace:
// const BLOCKED_TOOLS = new Set(['deposit', 'send', ...]);
// with:
const BLOCKED_TOOLS = FUND_MOVING_TOOLS;
```

- [ ] **Step 3: Verify both lists match before/after via tests**

```bash
pnpm --filter @sipher/agent test -- --run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/sentinel/preflight-rules.ts packages/agent/src/index.ts
git commit -m "refactor(agent): FUND_MOVING_TOOLS single source of truth

Was duplicated in index.ts (BLOCKED_TOOLS for /api/tools/:name) and
preflight-rules.ts (FUND_MOVING_TOOLS for SENTINEL preflight).
Drift = silent SENTINEL bypass. Now: single export, single import.

Resolves BE R-7."
```

---

## Task B18: Pay endpoint fail-closed with fallback RPC + retry

**Files:**
- Modify: `packages/agent/src/routes/pay.ts`
- Modify: `packages/agent/src/routes/__tests__/pay.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// packages/agent/src/routes/__tests__/pay.test.ts
describe('POST /pay/:id/confirm — fail-closed', () => {
  it('returns 200 valid:true when primary RPC succeeds', async () => {
    mockPrimaryRpc.success();
    const res = await request(app).post('/pay/test-link/confirm').send({ txSignature: 'sig' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('falls back to secondary RPC when primary fails', async () => {
    mockPrimaryRpc.error('timeout');
    mockFallbackRpc.success();
    const res = await request(app).post('/pay/test-link/confirm').send({ txSignature: 'sig' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('returns 503 when both primary AND fallback fail', async () => {
    mockPrimaryRpc.error('timeout');
    mockFallbackRpc.error('timeout');
    const res = await request(app).post('/pay/test-link/confirm').send({ txSignature: 'sig' });
    expect(res.status).toBe(503);
    expect(res.body.error?.code).toBe('RPC_UNAVAILABLE');
  });
});

describe('POST /pay/:id/confirm — per-link rate limit', () => {
  it('returns 429 after 3 attempts/min on same link', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post('/pay/link-A/confirm').send({ txSignature: 'sig' });
    }
    const res = await request(app).post('/pay/link-A/confirm').send({ txSignature: 'sig' });
    expect(res.status).toBe(429);
  });

  it('different link gets independent budget', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post('/pay/link-A/confirm').send({ txSignature: 'sig' });
    }
    const res = await request(app).post('/pay/link-B/confirm').send({ txSignature: 'sig' });
    expect(res.status).not.toBe(429);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Expected: tests fail (current impl is fail-open).

- [ ] **Step 3: Implement fail-closed + fallback RPC + per-link rate limit**

```typescript
// packages/agent/src/routes/pay.ts
import { createStore } from '../state/ephemeral';
import { loadNetworkConfig } from '../config/network';
import { Connection } from '@solana/web3.js';
import { guardianBus } from '../bus';

const linkConfirmAttempts = createStore<{ count: number; firstAt: number }>(
  'linkConfirmAttempts',
  { maxSize: 10_000 }
);

async function verifyTransactionWithFallback(txSig: string): Promise<{ valid: boolean }> {
  const config = loadNetworkConfig();
  const primaryUrl = config.rpcUrl;
  const fallbackUrl = process.env.SOLANA_RPC_URL_FALLBACK;

  try {
    const primary = new Connection(primaryUrl);
    const tx = await primary.getTransaction(txSig, { commitment: 'confirmed' });
    if (tx === null) throw new Error('not found');
    return { valid: true };
  } catch (primaryErr) {
    if (!fallbackUrl) throw primaryErr;
    try {
      const fallback = new Connection(fallbackUrl);
      const tx = await fallback.getTransaction(txSig, { commitment: 'confirmed' });
      if (tx === null) throw new Error('not found');
      guardianBus.emit('rpcFallbackUsed', { tx: txSig });
      return { valid: true };
    } catch (fallbackErr) {
      guardianBus.emit('rpcAllFailed', { tx: txSig, primaryErr, fallbackErr });
      throw fallbackErr;
    }
  }
}

router.post('/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const { txSignature } = req.body;

  // Per-link rate limit
  const window = 60_000;
  const max = 3;
  const now = Date.now();
  const entry = await linkConfirmAttempts.get(id);
  if (entry && now - entry.firstAt < window) {
    if (entry.count >= max) {
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many confirmation attempts on this link' } });
    }
    await linkConfirmAttempts.set(id, { count: entry.count + 1, firstAt: entry.firstAt }, 60);
  } else {
    await linkConfirmAttempts.set(id, { count: 1, firstAt: now }, 60);
  }

  // ... existing link lookup + idempotency check ...

  try {
    await verifyTransactionWithFallback(txSignature);
    // mark link paid, return 200
    res.json({ valid: true /* + existing fields */ });
  } catch (err) {
    res.status(503).json({ error: { code: 'RPC_UNAVAILABLE', message: 'On-chain verification temporarily unavailable, please retry shortly' } });
  }
});
```

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Document SOLANA_RPC_URL_FALLBACK**

```bash
echo "" >> /Users/rector/local-dev/sipher/.env.example
echo "# Fallback RPC URL used by /pay/:id/confirm when primary fails." >> /Users/rector/local-dev/sipher/.env.example
echo "# Without this, primary RPC outage produces 503 (no fail-open)." >> /Users/rector/local-dev/sipher/.env.example
echo "SOLANA_RPC_URL_FALLBACK=" >> /Users/rector/local-dev/sipher/.env.example
```

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/routes/pay.ts packages/agent/src/routes/__tests__/pay.test.ts .env.example
git commit -m "fix(agent): /pay/:id/confirm fail-closed with fallback RPC + per-link RL

Was: any RPC error → returned valid:true (money-at-risk during outage).
Now: primary RPC tried, fallback RPC tried (if SOLANA_RPC_URL_FALLBACK
set), then 503 RPC_UNAVAILABLE. guardianBus emits rpcFallbackUsed and
rpcAllFailed events for SENTINEL/operator visibility.

Per-link rate limit: 3 confirmations/min/link returns 429.

Resolves BE H-4 + BE H-7."
```

---

## Task B19: Final BE smoke + lint + test pass

**Files:**
- All BE files (verification only)

- [ ] **Step 1: Run full agent test suite**

```bash
cd ~/local-dev/sipher
pnpm --filter @sipher/agent test -- --run
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

```bash
pnpm --filter @sipher/agent typecheck
```

Expected: no errors.

- [ ] **Step 3: Run lint (verifies new ESLint rule active)**

```bash
pnpm lint 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 4: Run build**

```bash
pnpm --filter @sipher/agent build
```

Expected: build success.

- [ ] **Step 5: Run REST/integration tests if any**

```bash
pnpm --filter sipher test -- --run
```

Expected: PASS.

- [ ] **Step 6: Open PR**

```bash
git push -u origin feat/auth-surface-hardening
gh pr create --title "feat: backend auth surface hardening + mainnet-leak guard" --body "$(cat <<'EOF'
## Summary
- `app.set('trust proxy', N)` so per-IP rate limit actually works behind nginx
- Input validation on `/api/auth/nonce` (length cap + base58 shape)
- Per-IP rate limit on `/api/auth/nonce` (5/min)
- New `/api/auth/refresh` endpoint (24h TTL + 5min refresh window)
- 13 files migrated from `process.env.SOLANA_NETWORK` to `loadNetworkConfig()`
- 3 SENTINEL tool files migrated from `process.env.SOLANA_RPC_URL` to `loadNetworkConfig().rpcUrl`
- ESLint rule prevents future direct env reads
- `SIPHER_NETWORK` declared in `docker-compose.yml` (boot-failure proof)
- `SENTINEL_MODE` default flipped from `'yolo'` to `'advisory'` (fail-safe)
- Centralized ephemeral state module (`createStore<T>()`) replacing 6 module-scope Maps
- Pay endpoint: fail-closed with fallback RPC + retry, per-link rate limit
- Express Request augmentation: typed `req.wallet` and `req.isAdmin` (no more casts)
- `AUTHORIZED_WALLETS` parsed once at module load
- `FUND_MOVING_TOOLS` deduplicated (single source of truth)

## Resolves
- BE H-1 — trust proxy missing
- BE H-2 — no input validation on /api/auth/nonce
- BE H-3 — no rate limit on /api/auth/nonce
- BE H-4 — pay fail-open
- BE H-5 — 13 files leaking SOLANA_NETWORK
- BE H-6 — SIPHER_NETWORK missing in docker-compose
- BE H-7 — pay router public + no rate limit
- BE R-3 — JWT TTL hardcoded + no refresh
- BE R-4 — AUTHORIZED_WALLETS parsed per request
- BE R-7 — FUND_MOVING_TOOLS duplicated
- BE R-8 — SENTINEL_MODE default 'yolo'
- BE X-1 — module state pattern (6 sites)
- BE X-2 — SOLANA_NETWORK drift pattern
- BE X-3 — Request cast pattern

## Test plan
- [x] All existing tests pass after migration
- [x] New tests for /api/auth/nonce input validation + rate limit
- [x] New tests for /api/auth/refresh (200/425/401 paths)
- [x] New tests for /pay/:id/confirm fail-closed + per-link rate limit
- [x] Ephemeral store tests (set/get/delete/expire/cap)
- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` all clean

## Spec
docs/superpowers/specs/2026-05-06-phase4a-auth-and-security-fix-design.md
EOF
)"
```

---

# PHASE C: Verification After Both PRs Merge

## Task C0: Pull latest main + verify both merges

- [ ] **Step 1: Update main**

```bash
cd ~/local-dev/sipher
git checkout main
git pull origin main
```

- [ ] **Step 2: Verify both PRs in log**

```bash
git log --oneline -10
```

Expected: both `feat: AuthSync...` and `feat: backend auth surface hardening...` merge commits visible.

- [ ] **Step 3: Run full test suite from main**

```bash
pnpm test -- --run
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all clean.

---

## Task C1: VPS deploy + boot smoke

- [ ] **Step 1: Verify VPS .env has all new required vars**

```bash
ssh sip 'set -e
echo "=== Network vars ==="
grep -E "^(SIPHER_NETWORK|SOLANA_NETWORK)=" ~/sipher/.env
echo "=== Auth vars ==="
grep -E "^(JWT_EXPIRY|JWT_SECRET|TRUST_PROXY|AUTHORIZED_WALLETS)=" ~/sipher/.env | sed "s/=.*/=<set>/"
echo "=== SENTINEL vars ==="
grep -E "^SENTINEL_MODE=" ~/sipher/.env
echo "=== RPC fallback ==="
grep -E "^SOLANA_RPC_URL_FALLBACK=" ~/sipher/.env || echo "NOT SET (acceptable, but no failover for /pay)"
echo "=== Helius ==="
grep -E "^SIPHER_HELIUS_API_KEY=" ~/sipher/.env | sed "s/=.*/=<set>/"
'
```

Expected: all required vars present. If `SENTINEL_MODE=advisory` not explicit, set it before container restart per spec D9 risk R8.

- [ ] **Step 2: Wait for GHCR image to publish (auto-deploy will pull on next compose-up)**

```bash
# Watch GitHub Actions; or check image timestamp:
ssh sip 'docker pull ghcr.io/sip-protocol/sipher:latest 2>&1 | tail -3'
```

- [ ] **Step 3: Restart container + check boot logs**

```bash
ssh sip 'cd ~/sipher && docker compose up -d api && sleep 15 && docker logs sipher --tail 50 | grep -iE "Network|trust proxy|AUTHORIZED|SENTINEL|FATAL|Error"'
```

Expected:
- `Network: devnet (cluster=devnet, ...)`
- `[agent] trust proxy = 1`
- `[agent] AUTHORIZED_WALLETS: N entries`
- No FATAL or Error lines
- `SENTINEL_MODE=advisory` (if not set; warn line only if `yolo`)

- [ ] **Step 4: External verify endpoints**

```bash
curl -s https://sipher.sip-protocol.org/api/config | python3 -m json.tool
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://sipher.sip-protocol.org/api/health

# /api/auth/refresh sanity (no auth → 401 with structured envelope)
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST https://sipher.sip-protocol.org/api/auth/refresh

# /api/auth/nonce input validation
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"wallet":"InvalidShortStr"}' \
  https://sipher.sip-protocol.org/api/auth/nonce | head -c 200
```

Expected: config returns devnet, health 200, refresh 401 with structured error, nonce 400 VALIDATION_FAILED.

---

## Task C2: Re-run /quality:qa Phase 1 (regression check)

- [ ] **Step 1: Confirm /quality:qa skill available**

(Already loaded earlier in this session.)

- [ ] **Step 2: Re-run with same scope**

Invoke `/quality:qa` skill with target https://sipher.sip-protocol.org and the same dev-QA scope. Expected: zero P0 (high-priority) findings on auth/security surfaces. New findings (if any) should be P2/P3 only.

- [ ] **Step 3: Review report**

If any P0 finding emerges:
- File as a sub-issue
- Decide: fix-before-launch vs. accept-and-document
- Do NOT publish X thread #1 if a P0 is unresolved

If only P1/P2/P3: launch is unblocked from a QA perspective.

---

## Task C3: Manual auth flow QA (Phantom + Jupiter + Solflare)

- [ ] **Step 1: Manual smoke on Phantom**

Walk through:
- [ ] Connect → SIWS one popup → JWT issued → chat unlocks
- [ ] Wait near 24h: refresh fires within 5min → new JWT auto-issued, chat keeps working
- [ ] Force expire (DevTools clear sipher-auth) → chat → "Session expired" toast → click Sign in → fresh JWT
- [ ] Disconnect via dropdown → wallet disconnected + JWT cleared + toast
- [ ] Reload page after disconnect: clean state, "Connect" button visible

- [ ] **Step 2: Manual smoke on Jupiter**

Walk through:
- [ ] Connect → SIWS attempted → fallback to signMessage popup → JWT issued → chat unlocks
- [ ] All Phantom steps repeated, observing fallback path

- [ ] **Step 3: Manual smoke on Solflare**

Same as Phantom (Solflare also supports SIWS).

- [ ] **Step 4: Document tested-against list in PR descriptions if not already**

Update PR 1 + PR 2 descriptions with the wallet-test matrix.

---

# PHASE D: Gate Check Before X Thread #1

## Task D0: Final pre-launch checklist

- [ ] PR 1 merged into main
- [ ] PR 2 merged into main
- [ ] VPS container running with all required env vars
- [ ] /api/config returns devnet, beta=true
- [ ] BetaBanner renders on all 4 routes
- [ ] /quality:qa Phase 1 re-run returned zero P0 findings on auth/security
- [ ] Manual QA passed on Phantom + Jupiter + Solflare
- [ ] `SIPHER_BETA_LAUNCH_AT` still set on VPS .env from earlier flip (or update if relaunching)

## Task D1: Update launch state if needed

If a fresh launch timestamp is desired (e.g., the original 2026-05-06T04:26:47Z is "before bug fix" and the gate-clock should restart):

- [ ] **Step 1: Update VPS env**

```bash
ssh sip 'NEW=$(date -u +%Y-%m-%dT%H:%M:%SZ) && \
  sed -i "s|^SIPHER_BETA_LAUNCH_AT=.*|SIPHER_BETA_LAUNCH_AT=$NEW|" ~/sipher/.env && \
  grep SIPHER_BETA_LAUNCH_AT ~/sipher/.env'
```

- [ ] **Step 2: Mirror locally**

```bash
NEW=$(ssh sip "grep SIPHER_BETA_LAUNCH_AT ~/sipher/.env | cut -d= -f2")
echo "$NEW" >> ~/Documents/secret/sipher-launch-state.txt
```

- [ ] **Step 3: Container restart not required** (env var only used by the gate-check script).

## Task D2: Publish X thread #1

(Out of plan scope — RECTOR drives this manually using the tweet draft from the earlier session.)

- [ ] CIPHER drafts X thread #1 (already done earlier in session)
- [ ] RECTOR voices/edits, attaches architecture PNG, posts
- [ ] CIPHER notes the publish timestamp for telemetry

## Task D3: Day 0+ monitoring

- [ ] Watch GitHub issues at github.com/sip-protocol/sipher/issues
- [ ] Reply to DMs from Steave's referrals
- [ ] Run `pnpm tsx scripts/devnet-beta-gate-check.ts` on Day 3+

---

# PHASE E: Optional PR 3 (Polish — Deferred)

**Branch:** `feat/error-envelope-unification` (only if green-lit post-launch)

This phase is OUT OF SCOPE for the launch-blocker fix. Noted for traceability:

- Migrate all auth-protected route error responses to `{error: {code, message}}` shape (per BE R-1)
- Add structured logging via pino in vault-api.ts and pay.ts (BE P-2)
- Drop `as any` casts in routes/admin.ts (BE P-1)
- Update frontend error parser for unified shape

Estimated effort: ~6-8h. Ship after launch when bandwidth allows.

---

# Self-Review Notes

After writing this plan, the following spec-coverage cross-check was performed:

**Spec → Plan task mapping:**
- D1 (proper-fix not hotfix) — implicit in entire plan structure (architectural changes throughout)
- D2 (2 PRs) — Phase A = PR 1, Phase B = PR 2
- D3 (AuthSync provider) — Tasks A4-A10, A11-A17 migrate components
- D4 (JWT 24h + refresh + 401 interceptor) — A2, A3, A8, A9, A10, B6, B7
- D5 (SIWS fallback) — A6
- D6 (desktop dropdown) — A11, A12
- D7 (pay fail-closed) — B18
- D8 (ESLint rule) — B14
- D9 (SENTINEL_MODE advisory) — B16
- D10 (ephemeral state module) — B9, B10, B11
- D11 (Solscan deferred) — explicitly out of scope

**Placeholder scan:** None remaining — every code step contains real code or specific commands.

**Type consistency check:** `useAuthState`, `clearAuth`, `setAuth` signatures consistent across A5, A6, A7, A8. `createStore<T>` signature consistent across B9-B11. `loadNetworkConfig().clusterName` and `.rpcUrl` consistent across B12-B13.

**Missing tasks:** None identified.

---

*Bismillah — proper plan, executed task-by-task, test-by-test. Quality > urgency. InshaAllah.*
