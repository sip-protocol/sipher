# PR 8 — Admin Views Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply glass-neon visual language to Herald, Squad, and SentinelConfirm with identity colors (Herald = blue, Sentinel = amber), migrate Herald/Squad/Settings out of public main nav into Header avatar dropdown, and migrate legacy Tailwind aliases to new design system tokens across all touched files.

**Architecture:** Five tasks across the desktop Header (rename WalletDropdown → UserMenu, drop adminOnly tabs), HeraldView (token migration + herald accents + admin redirect), SquadView (token migration + sentinel accents + admin redirect + new test file), and ConfirmCard/SentinelConfirm (sentinel tones for warning variant + text-danger). Tasks 3 and 4 are independent files and may dispatch in parallel under subagent-driven execution.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4 (with Sipher tokens), Vitest, @testing-library/react, @phosphor-icons/react, Zustand (`useAppStore`, `useAuthState` hook).

**Spec:** `docs/superpowers/specs/2026-05-10-pr8-admin-restyle-design.md` (committed at `b3a4ad4`).

---

## Pre-flight (one-time setup before Task 1)

- [ ] **Step 0.1: Create worktree**

Run from `~/local-dev/sipher`:

```bash
git worktree add .worktrees/feat-redesign-admin -b feat/redesign-admin main
cd .worktrees/feat-redesign-admin
pnpm install
```

Expected: worktree created on new branch `feat/redesign-admin` from `main` (HEAD `b3a4ad4`).

- [ ] **Step 0.2: Build SDK (required for fresh worktree)**

```bash
pnpm --filter "@sipher/sdk" build
```

Expected: SDK builds cleanly. Without this, ~46 agent tests fail with "Failed to resolve entry for package" (carry-forward gotcha from PR 6 session).

- [ ] **Step 0.3: Verify baseline tests**

```bash
cd app && pnpm test --run 2>&1 | tail -3
cd ../packages/agent && pnpm test --run 2>&1 | tail -3
cd ../../app && npx tsc --noEmit
```

Expected: app 330 / 57 suites; agent 1399 / 116 suites; tsc clean. If counts diverge, investigate before continuing.

---

## Task 1: Rename WalletDropdown → UserMenu and add admin section

**Goal:** Single `<UserMenu>` component replaces `<WalletDropdown>`, exposing existing wallet ops plus a new admin section (Settings/Herald/Squad) gated by `isAdmin`.

**Files:**
- Rename: `app/src/components/WalletDropdown.tsx` → `app/src/components/UserMenu.tsx`
- Rename: `app/src/components/__tests__/WalletDropdown.test.tsx` → `app/src/components/__tests__/UserMenu.test.tsx`
- Modify: `app/src/components/UserMenu.tsx` — extend with admin section
- Modify: `app/src/components/__tests__/UserMenu.test.tsx` — update import + add 5 new tests

- [ ] **Step 1.1: Rename files via git mv (preserves history)**

From the worktree root (`.worktrees/feat-redesign-admin`):

```bash
git mv app/src/components/WalletDropdown.tsx app/src/components/UserMenu.tsx
git mv app/src/components/__tests__/WalletDropdown.test.tsx app/src/components/__tests__/UserMenu.test.tsx
```

Expected: two files renamed, working tree shows them as renames in `git status`.

- [ ] **Step 1.2: Update test file import + describe block to UserMenu**

Edit `app/src/components/__tests__/UserMenu.test.tsx` — replace all occurrences of `WalletDropdown` with `UserMenu`:

```typescript
// At top:
import { UserMenu } from '../UserMenu'

// Replace describe:
describe('UserMenu', () => {
```

Existing tests pass `<WalletDropdown ... />`. They need to also pass `isAdmin={false}` and `onNavigate={vi.fn()}` (we'll add those props in next step). For now, also add those defaults. Use replace-all for `WalletDropdown` → `UserMenu` and add the two new required props to every render call.

Expected after edit: every `render(<UserMenu ... />)` call passes `address`, `onCopy`, `onReSignIn`, `onDisconnect`, `isAdmin`, and `onNavigate`.

- [ ] **Step 1.3: Update UserMenu.tsx component name + add new props (no behavior change yet)**

Edit `app/src/components/UserMenu.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react'
import { Copy, ArrowsClockwise, Plug, CaretDown, Gear, Broadcast, UsersThree } from '@phosphor-icons/react'

type AdminView = 'settings' | 'herald' | 'squad'

interface Props {
  address: string
  isAdmin: boolean
  onCopy: () => void
  onReSignIn: () => void
  onDisconnect: () => void
  onNavigate: (view: AdminView) => void
}

export function UserMenu({ address, isAdmin, onCopy, onReSignIn, onDisconnect, onNavigate }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const short = `${address.slice(0, 4)}...${address.slice(-4)}`

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleAction = (cb: () => void) => () => {
    cb()
    setOpen(false)
  }

  const handleNavigate = (view: AdminView) => () => {
    onNavigate(view)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 bg-glass-2 border border-line rounded text-xs text-text hover:bg-text/5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{short}</span>
        <CaretDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-48 bg-glass-2 border border-line rounded shadow-lg overflow-hidden z-50"
        >
          {isAdmin && (
            <>
              <div className="px-3 pt-2 pb-1 text-2xs text-text-muted tracking-widest uppercase">
                Admin
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleNavigate('settings')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5"
              >
                <Gear size={14} /> Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleNavigate('herald')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5"
              >
                <Broadcast size={14} /> Herald
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleNavigate('squad')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5"
              >
                <UsersThree size={14} /> Squad
              </button>
              <div className="border-t border-line" />
            </>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleAction(onCopy)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5"
          >
            <Copy size={14} /> Copy address
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleAction(onReSignIn)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5"
          >
            <ArrowsClockwise size={14} /> Re-sign in
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleAction(onDisconnect)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text hover:bg-text/5 border-t border-line"
          >
            <Plug size={14} /> Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
```

Note token migrations applied: `bg-elevated` → `bg-glass-2`, `border-border` → `border-line` (matches Section 4 spec migration table, scope-creep'd into UserMenu since we're already touching the file).

- [ ] **Step 1.4: Run existing UserMenu tests — verify they still pass with new shape**

```bash
cd app && pnpm test --run src/components/__tests__/UserMenu.test.tsx
```

Expected: all existing tests pass (we only renamed + added optional props; default `isAdmin={false}` should preserve current behavior). If failures, fix imports / test prop signatures.

- [ ] **Step 1.5: Write failing test — admin section visible when isAdmin=true**

Add to `app/src/components/__tests__/UserMenu.test.tsx`:

```typescript
  it('shows admin section above wallet ops when isAdmin', () => {
    render(
      <UserMenu
        address={FULL}
        isAdmin={true}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Settings/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Herald/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Squad/ })).toBeInTheDocument()
  })
```

- [ ] **Step 1.6: Run test — should pass (admin section already implemented in 1.3)**

```bash
cd app && pnpm test --run src/components/__tests__/UserMenu.test.tsx
```

Expected: PASS for the new test. (Implementation already in place from Step 1.3 — TDD discipline here is to confirm test exercises the right path.)

- [ ] **Step 1.7: Write failing test — admin section hidden when !isAdmin**

```typescript
  it('hides admin section when !isAdmin', () => {
    render(
      <UserMenu
        address={FULL}
        isAdmin={false}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Settings/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Herald/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Squad/ })).not.toBeInTheDocument()
    // Wallet section still renders
    expect(screen.getByRole('menuitem', { name: /Copy address/ })).toBeInTheDocument()
  })
```

Run: should pass (existing implementation already gates by `isAdmin`).

- [ ] **Step 1.8: Write failing tests — onNavigate fires for each admin item with correct view name**

```typescript
  it('fires onNavigate("settings") when Settings clicked', async () => {
    const onNavigate = vi.fn()
    render(
      <UserMenu
        address={FULL}
        isAdmin={true}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={onNavigate}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Settings/ }))
    expect(onNavigate).toHaveBeenCalledWith('settings')
  })

  it('fires onNavigate("herald") when Herald clicked', () => {
    const onNavigate = vi.fn()
    render(
      <UserMenu
        address={FULL}
        isAdmin={true}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={onNavigate}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Herald/ }))
    expect(onNavigate).toHaveBeenCalledWith('herald')
  })

  it('fires onNavigate("squad") when Squad clicked', () => {
    const onNavigate = vi.fn()
    render(
      <UserMenu
        address={FULL}
        isAdmin={true}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={onNavigate}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Squad/ }))
    expect(onNavigate).toHaveBeenCalledWith('squad')
  })

  it('closes dropdown after admin item click', () => {
    render(
      <UserMenu
        address={FULL}
        isAdmin={true}
        onCopy={vi.fn()}
        onReSignIn={vi.fn()}
        onDisconnect={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /HciZ\.\.\.25En/ }))
    expect(screen.getByText('Admin')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: /Settings/ }))
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })
```

Run: all should pass (impl already in place).

- [ ] **Step 1.9: Run full UserMenu test suite, verify all pass**

```bash
cd app && pnpm test --run src/components/__tests__/UserMenu.test.tsx
```

Expected: all tests pass (existing 5+ + 6 new).

- [ ] **Step 1.10: Commit**

```bash
git add app/src/components/UserMenu.tsx app/src/components/__tests__/UserMenu.test.tsx
git status  # confirm WalletDropdown.* removed (rename), UserMenu.* added
git commit -m "feat(redesign): rename WalletDropdown to UserMenu with admin section

Adds isAdmin-gated admin section (Settings/Herald/Squad) above the
existing wallet ops in the dropdown. Wallet section behavior unchanged.
Token migrations applied: bg-elevated -> bg-glass-2, border-border ->
border-line."
```

---

## Task 2: Update Header.tsx — drop adminOnly tabs, integrate UserMenu

**Goal:** `NAV_ITEMS` shrinks from 8 to 5 tabs (no more adminOnly entries). Header renders `<UserMenu>` with new props.

**Files:**
- Modify: `app/src/components/Header.tsx`
- Modify: `app/src/components/__tests__/Header.test.tsx`

- [ ] **Step 2.1: Update Header.test.tsx — anticipate new TABS shape**

Read existing tests: `cat app/src/components/__tests__/Header.test.tsx`. Look for any test asserting Herald/Squad/Settings tabs render (e.g., `screen.getByText('Herald')`, `screen.getByRole('button', { name: /Squad/ })`).

For each such test, change the assertion to `not.toBeInTheDocument()` (those tabs no longer render in nav). Tests that simulated `setActiveView` calls via clicking those tabs need to be removed or rewritten to test nav clicking on remaining tabs.

If the test file mocks `WalletDropdown`, update the mock to `UserMenu` (matching new import path).

Expected mocks/imports in updated tests:

```typescript
// At top of Header.test.tsx if it mocks WalletDropdown:
vi.mock('../UserMenu', () => ({
  UserMenu: ({ isAdmin, onNavigate }: { isAdmin: boolean, onNavigate: (v: string) => void }) => (
    <div data-testid="user-menu" data-is-admin={String(isAdmin)}>
      <button onClick={() => onNavigate('settings')} data-testid="usermenu-settings">Settings</button>
      <button onClick={() => onNavigate('herald')} data-testid="usermenu-herald">Herald</button>
      <button onClick={() => onNavigate('squad')} data-testid="usermenu-squad">Squad</button>
    </div>
  ),
}))
```

- [ ] **Step 2.2: Run Header tests — verify the failures match what we expect**

```bash
cd app && pnpm test --run src/components/__tests__/Header.test.tsx
```

Expected: tests fail at the current Header.tsx because Header still imports WalletDropdown and still has Herald/Squad/Settings in TABS. Failures should reference `WalletDropdown` import or the absent admin tabs in the new test setup.

- [ ] **Step 2.3: Update Header.tsx — drop adminOnly fields, swap to UserMenu**

Edit `app/src/components/Header.tsx`:

```typescript
import {
  ChartBar,
  Vault,
  ChatCircle,
  GlobeHemisphereWest,
  Key,
} from '@phosphor-icons/react'
import { useAppStore, type View } from '../stores/app'
import { useAuthState } from '../hooks/useAuthState'
import { useToast } from '../providers/ToastProvider'
import AgentDot from './AgentDot'
import { UserMenu } from './UserMenu'
import { useNetworkConfigStore } from '../lib/networkConfig'
import { TickerBar } from './ui/TickerBar'

interface Tab {
  id: View
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>
  tabletOnly?: boolean
}

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartBar },
  { id: 'vault', label: 'Vault', icon: Vault },
  { id: 'chains', label: 'Chains', icon: GlobeHemisphereWest },
  { id: 'keys', label: 'Key', icon: Key },
  { id: 'chat', label: 'Chat', icon: ChatCircle, tabletOnly: true },
]

export default function Header() {
  const { status, publicKey, authenticate, disconnect, isAdmin } = useAuthState()
  const { show: showToast } = useToast()
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const setChatSheetOpen = useAppStore((s) => s.setChatSheetOpen)
  const network = useNetworkConfigStore((s) => s.config?.network ?? 'mainnet')

  const handleConnectOrSignIn = () => {
    authenticate().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Sign-in failed'
      showToast({ message, kind: 'error' })
    })
  }

  const handleCopy = async () => {
    if (!publicKey) return
    await navigator.clipboard.writeText(publicKey)
    showToast({ message: 'Address copied', kind: 'success', durationMs: 3000 })
  }

  const handleDisconnect = async () => {
    await disconnect()
    showToast({ message: 'Disconnected', kind: 'info', durationMs: 3000 })
  }

  return (
    <header className="hidden md:flex h-12 border-b border-line items-center justify-between px-4 bg-bg shrink-0 z-sticky">
      <div className="flex items-center gap-3">
        <span
          className="font-semibold text-sm text-text"
          style={{ letterSpacing: 'var(--tracking-mega)' }}
        >
          SIPHER
        </span>
        <span className="text-2xs text-text-muted font-mono uppercase">{network}</span>
        <TickerBar />
        <nav className="flex items-center ml-3">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active =
              activeView === tab.id ||
              (tab.id === 'vault' && (activeView === 'deposit' || activeView === 'withdraw'))
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  tab.tabletOnly ? 'lg:hidden' : '',
                  active ? 'text-text bg-glass-2' : 'text-text-muted hover:text-text-secondary',
                ].join(' ')}
              >
                <Icon size={14} weight={active ? 'fill' : 'regular'} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setChatSheetOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary border border-line rounded-md hover:border-line-2 hover:text-text transition-colors"
        >
          <ChatCircle size={14} />
          Ask SIPHER
        </button>

        <div className="flex items-center gap-1.5">
          <AgentDot agent="sipher" size={5} />
          <AgentDot agent="herald" size={5} />
          <AgentDot agent="sentinel" size={5} />
        </div>

        {status === 'authed' && publicKey ? (
          <UserMenu
            address={publicKey}
            isAdmin={isAdmin}
            onNavigate={setActiveView}
            onCopy={handleCopy}
            onReSignIn={handleConnectOrSignIn}
            onDisconnect={handleDisconnect}
          />
        ) : status === 'expired' ? (
          <button
            onClick={handleConnectOrSignIn}
            title="Session expired — sign in to continue"
            className="bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-lg text-[11px] text-amber-400 font-medium hover:bg-amber-500/20 transition-colors"
          >
            Re-sign in
          </button>
        ) : (
          <button
            onClick={handleConnectOrSignIn}
            className="bg-accent/10 border border-accent/20 px-3 py-1 rounded-lg text-[11px] text-accent font-medium hover:bg-accent/20 transition-colors"
          >
            Connect
          </button>
        )}
      </div>
    </header>
  )
}
```

Note: `setActiveView` accepts any `View` enum value but `UserMenu.onNavigate` is typed as `'settings' | 'herald' | 'squad'`. TypeScript narrowing should handle this since those are subset of `View`. If TSC complains, wrap in a typed handler:

```typescript
const handleNavigate = (view: 'settings' | 'herald' | 'squad') => {
  setActiveView(view)
}
// then: onNavigate={handleNavigate}
```

- [ ] **Step 2.4: Run Header tests — verify pass**

```bash
cd app && pnpm test --run src/components/__tests__/Header.test.tsx
```

Expected: all tests pass. Investigate failures by re-reading test mocks vs new Header structure.

- [ ] **Step 2.5: Run BottomNav tests — verify mobile drawer untouched**

```bash
cd app && pnpm test --run src/components/__tests__/BottomNav.test.tsx
```

Expected: all pass unchanged.

- [ ] **Step 2.6: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: clean. If failures reference `View` narrowing in `onNavigate`, apply the typed wrapper from Step 2.3.

- [ ] **Step 2.7: Commit**

```bash
git add app/src/components/Header.tsx app/src/components/__tests__/Header.test.tsx
git commit -m "feat(redesign): drop adminOnly tabs from main nav, integrate UserMenu

NAV_ITEMS shrinks from 8 to 5 entries (Dashboard, Vault, Chains, Keys,
Chat). Herald/Squad/Settings now live in <UserMenu> dropdown when
isAdmin. Tab interface drops adminOnly?: boolean field."
```

---

## Task 3: HeraldView restyle — token migration + herald accents + admin redirect

**Goal:** Migrate ~30 legacy token occurrences in HeraldView.tsx to new design system tokens; add component-level admin redirect (matching SettingsView pattern); preserve existing herald sub-tab underline; surface herald identity color where natural.

**Files:**
- Modify: `app/src/views/HeraldView.tsx`
- Create: `app/src/views/__tests__/HeraldView.test.tsx` (admin redirect + budget bar regression tests)
- Read-only: `app/src/views/__tests__/HeraldView-edit.test.tsx` (existing edit tests should still pass)

- [ ] **Step 3.1: Write failing admin-redirect test in new HeraldView.test.tsx**

Create `app/src/views/__tests__/HeraldView.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import HeraldView from '../HeraldView'

const setActiveViewMock = vi.fn()

vi.mock('../../stores/app', () => ({
  useAppStore: (selector: (s: unknown) => unknown) => selector({ setActiveView: setActiveViewMock }),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    queue: [],
    budget: { spent: 0, limit: 100, gate: 'open', percentage: 0 },
    dms: [],
    recentPosts: [],
  }),
}))

import { useAuthState } from '../../hooks/useAuthState'

describe('HeraldView admin gating', () => {
  beforeEach(() => {
    setActiveViewMock.mockClear()
  })

  it('redirects to dashboard when !isAdmin and renders null', () => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: false,
    } as ReturnType<typeof useAuthState>)
    const { container } = render(<HeraldView />)
    expect(setActiveViewMock).toHaveBeenCalledWith('dashboard')
    expect(container.firstChild).toBeNull()
  })

  it('does NOT redirect when isAdmin', () => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
    const { container } = render(<HeraldView />)
    expect(setActiveViewMock).not.toHaveBeenCalled()
    expect(container.firstChild).not.toBeNull()
  })
})
```

Note: HeraldView's actual signature today is `function HeraldView({ token }: ...)` — verify this when writing the test. If `token` is required as a prop, pass it. The mock for `useAuthState` may need to match what HeraldView actually consumes. Read `HeraldView.tsx:1-30` and `HeraldView.tsx` near its top-level `export default function` to confirm the prop signature, and adjust the test render call accordingly.

If HeraldView accepts `{ token: string | null }`, pass `<HeraldView token="t" />`.

- [ ] **Step 3.2: Run test — verify it fails**

```bash
cd app && pnpm test --run src/views/__tests__/HeraldView.test.tsx
```

Expected: FAIL with "expected setActiveViewMock to have been called with 'dashboard'" (HeraldView has no admin redirect yet).

- [ ] **Step 3.3: Add admin redirect to HeraldView.tsx**

Find the top of the `export default function HeraldView(...)` body. Add at the very start, before any state/effect:

```typescript
import { useAuthState } from '../hooks/useAuthState'
import { useAppStore } from '../stores/app'
// ... existing imports ...

export default function HeraldView(/* existing signature */) {
  const { isAdmin } = useAuthState()
  const setActiveView = useAppStore((s) => s.setActiveView)

  useEffect(() => {
    if (!isAdmin) {
      setActiveView('dashboard')
    }
  }, [isAdmin, setActiveView])

  if (!isAdmin) return null

  // ... existing body unchanged ...
}
```

If `useEffect` is not yet imported in this file, add `import { useEffect, ... } from 'react'`.

- [ ] **Step 3.4: Run test — verify pass**

```bash
cd app && pnpm test --run src/views/__tests__/HeraldView.test.tsx
```

Expected: PASS for both tests.

- [ ] **Step 3.5: Run existing HeraldView-edit tests — verify no regression**

```bash
cd app && pnpm test --run src/views/__tests__/HeraldView-edit.test.tsx
```

Expected: all pass. If failures reference missing `useAuthState` mock or absent `setActiveView` mock, add equivalent mocks to that test file's beforeEach.

- [ ] **Step 3.6: Write failing budget bar color regression tests**

Append to `app/src/views/__tests__/HeraldView.test.tsx`:

```typescript
describe('HeraldView budget bar colors', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
  })

  it('uses success-soft when budget < 80%', async () => {
    const { apiFetch } = await import('../../api/client')
    vi.mocked(apiFetch).mockResolvedValueOnce({
      queue: [],
      budget: { spent: 30, limit: 100, gate: 'open', percentage: 30 },
      dms: [],
      recentPosts: [],
    })
    const { container } = render(<HeraldView />)
    await new Promise((r) => setTimeout(r, 0))  // flush microtasks for fetch
    const bar = container.querySelector('[class*="bg-success-soft"]')
    expect(bar).toBeTruthy()
  })

  it('uses warning-soft when budget >= 80%', async () => {
    const { apiFetch } = await import('../../api/client')
    vi.mocked(apiFetch).mockResolvedValueOnce({
      queue: [],
      budget: { spent: 85, limit: 100, gate: 'limited', percentage: 85 },
      dms: [],
      recentPosts: [],
    })
    const { container } = render(<HeraldView />)
    await new Promise((r) => setTimeout(r, 0))
    const bar = container.querySelector('[class*="bg-warning-soft"]')
    expect(bar).toBeTruthy()
  })

  it('uses danger-soft when budget >= 95%', async () => {
    const { apiFetch } = await import('../../api/client')
    vi.mocked(apiFetch).mockResolvedValueOnce({
      queue: [],
      budget: { spent: 96, limit: 100, gate: 'blocked', percentage: 96 },
      dms: [],
      recentPosts: [],
    })
    const { container } = render(<HeraldView />)
    await new Promise((r) => setTimeout(r, 0))
    const bar = container.querySelector('[class*="bg-danger-soft"]')
    expect(bar).toBeTruthy()
  })
})
```

- [ ] **Step 3.7: Run test — verify fails (HeraldView still uses bg-red/bg-yellow/bg-green)**

```bash
cd app && pnpm test --run src/views/__tests__/HeraldView.test.tsx
```

Expected: 3 budget bar tests FAIL (no `bg-success-soft` / `bg-warning-soft` / `bg-danger-soft` classes present yet).

- [ ] **Step 3.8: Migrate HeraldView.tsx legacy tokens — full pass through file**

Apply these find-replace operations in `app/src/views/HeraldView.tsx` (use Edit tool with `replace_all: true` per pattern; if pattern is not unique, scope to specific lines):

1. `bg-card` → `bg-glass-1` (replace_all)
2. `bg-elevated` → `bg-glass-2` (replace_all — verify no `border-elevated` matches; if so, use specific edits)
3. `border-border` → `border-line` (replace_all — verify `border-bordered` or other accidental matches)
4. `bg-red'` → `bg-danger-soft'` (with closing quote, to avoid matching `bg-red/10`)
5. `bg-yellow'` → `bg-warning-soft'`
6. `bg-green'` → `bg-success-soft'`
7. `text-red` → `text-danger` (replace_all)
8. `text-yellow` → `text-warning` (replace_all)
9. `text-green` → `text-success` (replace_all)
10. `bg-red/` → `bg-danger/` (replace_all — opacity variants)
11. `bg-yellow/` → `bg-warning/` (replace_all)
12. `bg-green/` → `bg-success/` (replace_all)
13. `border-red/` → `border-danger/` (replace_all)
14. `border-yellow/` → `border-warning/` (replace_all)
15. `border-green/` → `border-success/` (replace_all)
16. `border-border/50` → `border-line/50` (if pattern still matches after step 3)

After all edits, verify no `bg-card|bg-elevated|border-border|bg-red|bg-yellow|bg-green|text-red|text-yellow|text-green` remain:

```bash
grep -nE "bg-card|bg-elevated|border-border|bg-red|bg-yellow|bg-green|text-red|text-yellow|text-green" app/src/views/HeraldView.tsx
```

Expected: no output (or only `bg-herald` / similar that we want to keep).

- [ ] **Step 3.9: Run all HeraldView tests — verify pass**

```bash
cd app && pnpm test --run src/views/__tests__/HeraldView.test.tsx src/views/__tests__/HeraldView-edit.test.tsx
```

Expected: all pass (admin redirect + 3 budget bar color regressions + edit tests).

- [ ] **Step 3.10: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3.11: Commit**

```bash
git add app/src/views/HeraldView.tsx app/src/views/__tests__/HeraldView.test.tsx
git commit -m "feat(redesign): restyle HeraldView with new tokens + admin redirect

Migrates ~30 legacy Tailwind alias occurrences (bg-card, border-border,
bg-red/yellow/green, text-red/yellow/green) to new design system
tokens (bg-glass-1, border-line, bg-success-soft/warning-soft/
danger-soft, text-success/warning/danger).

Adds component-level admin redirect matching SettingsView pattern:
non-admin users get setActiveView('dashboard') + view returns null.
Closes a defense-in-depth gap from PR 7."
```

---

## Task 4: SquadView restyle — token migration + sentinel accents + admin redirect + new test file

**Goal:** Migrate ~10 legacy token occurrences; add `<Chip tone="sentinel">SENTINEL</Chip>` view eyebrow; preserve inline `agent.color` runtime style; add admin redirect; create new test file with admin redirect, sentinel eyebrow, and KillSwitch tone regressions.

**Files:**
- Modify: `app/src/views/SquadView.tsx`
- Create: `app/src/views/__tests__/SquadView.test.tsx`

- [ ] **Step 4.1: Create SquadView.test.tsx with failing admin-redirect test**

Create `app/src/views/__tests__/SquadView.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SquadView from '../SquadView'

const setActiveViewMock = vi.fn()

vi.mock('../../stores/app', () => ({
  useAppStore: (selector: (s: unknown) => unknown) => selector({ setActiveView: setActiveViewMock }),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn(),
}))

import { useAuthState } from '../../hooks/useAuthState'
import { apiFetch } from '../../api/client'

describe('SquadView admin gating', () => {
  beforeEach(() => {
    setActiveViewMock.mockClear()
    vi.mocked(apiFetch).mockReset()
  })

  it('redirects to dashboard when !isAdmin and renders null', () => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: false,
    } as ReturnType<typeof useAuthState>)
    const { container } = render(<SquadView token="t" />)
    expect(setActiveViewMock).toHaveBeenCalledWith('dashboard')
    expect(container.firstChild).toBeNull()
  })
})
```

Note: SquadView signature today is `function SquadView({ token }: { token: string | null })`. Confirm prop signature when reading the file.

- [ ] **Step 4.2: Run test — verify fails**

```bash
cd app && pnpm test --run src/views/__tests__/SquadView.test.tsx
```

Expected: FAIL.

- [ ] **Step 4.3: Add admin redirect to SquadView.tsx**

In `app/src/views/SquadView.tsx`, near the top of the `export default function SquadView(...)` body:

```typescript
import { useAppStore } from '../stores/app'
import { useAuthState } from '../hooks/useAuthState'
// ... existing imports

export default function SquadView({ token }: { token: string | null }) {
  const { isAdmin } = useAuthState()
  const setActiveView = useAppStore((s) => s.setActiveView)

  useEffect(() => {
    if (!isAdmin) {
      setActiveView('dashboard')
    }
  }, [isAdmin, setActiveView])

  if (!isAdmin) return null

  // ... rest of body unchanged
}
```

- [ ] **Step 4.4: Run test — verify pass**

```bash
cd app && pnpm test --run src/views/__tests__/SquadView.test.tsx
```

Expected: PASS.

- [ ] **Step 4.5: Write failing sentinel eyebrow test**

Append to `SquadView.test.tsx`:

```typescript
describe('SquadView sentinel identity', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
    vi.mocked(apiFetch).mockResolvedValue({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: false,
    })
  })

  it('renders SENTINEL eyebrow chip', async () => {
    const { container } = render(<SquadView token="t" />)
    await new Promise((r) => setTimeout(r, 0))
    // Looks for the chip text
    expect(screen.getByText('SENTINEL')).toBeInTheDocument()
    // And the chip-tone class
    const chip = container.querySelector('[class*="text-sentinel"]')
    expect(chip).toBeTruthy()
  })
})
```

- [ ] **Step 4.6: Run test — verify fails (no chip yet)**

```bash
cd app && pnpm test --run src/views/__tests__/SquadView.test.tsx
```

Expected: FAIL on the sentinel eyebrow test.

- [ ] **Step 4.7: Add SENTINEL eyebrow chip to SquadView return JSX**

In `SquadView.tsx`, modify the main return block:

```typescript
import Chip from '../components/ui/Chip'  // verify exact import path; component file is app/src/components/ui/Chip.tsx
// ... rest of imports

  return (
    <div data-testid="squad-view" className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Chip tone="sentinel">SENTINEL</Chip>
        <span className="text-2xs text-text-muted tracking-widest uppercase">Operations</span>
      </div>
      {error && (
        <div className="text-text-muted text-xs font-mono bg-glass-1 border border-line rounded-lg px-3 py-2">
          Live data unavailable — {error}
        </div>
      )}
      {/* ... rest of body unchanged */}
```

Verify the Chip import path against `app/src/components/ui/Chip.tsx` — adjust if the relative path differs.

- [ ] **Step 4.8: Run test — verify pass**

```bash
cd app && pnpm test --run src/views/__tests__/SquadView.test.tsx
```

Expected: all 2 tests pass.

- [ ] **Step 4.9: Write failing KillSwitch tone tests**

Append to `SquadView.test.tsx`:

```typescript
describe('SquadView KillSwitch tones', () => {
  beforeEach(() => {
    vi.mocked(useAuthState).mockReturnValue({
      status: 'authed',
      token: 't',
      publicKey: 'pk',
      isAdmin: true,
    } as ReturnType<typeof useAuthState>)
  })

  it('uses success tones when killSwitch active', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: true,
    })
    const { container } = render(<SquadView token="t" />)
    await new Promise((r) => setTimeout(r, 0))
    const btn = screen.getByRole('button', { name: /resume operations/i })
    expect(btn.className).toMatch(/border-success/)
    expect(btn.className).toMatch(/text-success/)
  })

  it('uses danger tones when killSwitch inactive', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      agents: [],
      stats: { toolCalls: 0, walletSessions: 0, xPosts: 0, xReplies: 0, blocksScanned: 0, alerts: 0 },
      coordination: [],
      killSwitch: false,
    })
    const { container } = render(<SquadView token="t" />)
    await new Promise((r) => setTimeout(r, 0))
    const btn = screen.getByRole('button', { name: /pause all vault ops/i })
    expect(btn.className).toMatch(/border-danger/)
    expect(btn.className).toMatch(/text-danger/)
  })
})
```

- [ ] **Step 4.10: Run test — verify fails**

```bash
cd app && pnpm test --run src/views/__tests__/SquadView.test.tsx
```

Expected: 2 KillSwitch tone tests FAIL (still using `border-green`/`text-green` and `border-red`/`text-red`).

- [ ] **Step 4.11: Migrate SquadView.tsx legacy tokens**

In `app/src/views/SquadView.tsx`, apply these edits:

1. `bg-card` → `bg-glass-1` (replace_all — 3 sites)
2. `border-border` → `border-line` (replace_all — ~6 sites, including line 161 `border-border` for code-span pill)
3. `bg-elevated` → `bg-glass-2` (line 161, code-span pill background)
4. `bg-green/10` → `bg-success-soft` (line 203, KillSwitch active hover bg — NOTE: bg-green/10 is a soft tint, replace with bg-success-soft for cleaner semantic)
5. `border-green/30` → `border-success/30` (line 203)
6. `text-green` → `text-success` (line 203)
7. `bg-red/10` → `bg-danger-soft` (line 204 hover bg, line 213 error banner)
8. `border-red/30` → `border-danger/30` (line 204)
9. `border-red` (non-fractional) → `border-danger` (line 204 — `hover:border-red`)
10. `text-red` → `text-danger` (line 204, line 213)
11. `border-red/20` → `border-danger/20` (line 213 error banner)

Specifically the KillSwitch button block becomes:

```typescript
className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 border rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
  active
    ? 'border-success/30 text-success hover:bg-success-soft'
    : 'border-danger/30 text-danger hover:bg-danger-soft hover:border-danger'
}`}
```

And error banner:

```typescript
<div className="mt-2 text-danger text-xs font-mono bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
  {error}
</div>
```

Verify no legacy tokens remain:

```bash
grep -nE "bg-card|bg-elevated|border-border|bg-red|bg-yellow|bg-green|text-red|text-yellow|text-green" app/src/views/SquadView.tsx
```

Expected: no output.

- [ ] **Step 4.12: Run all SquadView tests — verify all pass**

```bash
cd app && pnpm test --run src/views/__tests__/SquadView.test.tsx
```

Expected: all 5 tests pass (admin redirect + sentinel chip + 2 KillSwitch tone regressions).

- [ ] **Step 4.13: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4.14: Commit**

```bash
git add app/src/views/SquadView.tsx app/src/views/__tests__/SquadView.test.tsx
git commit -m "feat(redesign): restyle SquadView with sentinel accents + admin redirect

Migrates ~10 legacy Tailwind alias occurrences to new design system
tokens. Adds <Chip tone='sentinel'>SENTINEL</Chip> view eyebrow.
KillSwitch toggles between success tones (active) and danger tones
(paused).

Adds component-level admin redirect matching SettingsView pattern and
creates new SquadView.test.tsx with admin-redirect, sentinel-eyebrow,
and KillSwitch-tone regression tests."
```

---

## Task 5: ConfirmCard + SentinelConfirm restyle

**Goal:** ConfirmCard `variant="warning"` shifts from yellow to sentinel tones; ConfirmCard `bg-card`/`border-elevated` migrate to new tokens; SentinelConfirm error display uses `text-danger`.

**Files:**
- Modify: `app/src/components/ConfirmCard.tsx`
- Modify: `app/src/components/__tests__/ConfirmCard.test.tsx`
- Modify: `app/src/components/SentinelConfirm.tsx`
- Modify: `app/src/components/__tests__/SentinelConfirm.test.tsx`

- [ ] **Step 5.1: Update ConfirmCard.test.tsx — add failing tone assertions for warning variant**

Add or modify the warning-variant test in `app/src/components/__tests__/ConfirmCard.test.tsx`:

```typescript
  it('uses sentinel tones for warning variant', () => {
    const { container } = render(
      <ConfirmCard
        variant="warning"
        action="Send"
        amount="5 SOL"
        description="Address has 2 high-risk signals"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    // Card border
    const card = container.querySelector('[class*="border-sentinel"]')
    expect(card).toBeTruthy()
    // Override button
    const overrideBtn = screen.getByRole('button', { name: /override & send/i })
    expect(overrideBtn.className).toMatch(/text-sentinel/)
    expect(overrideBtn.className).toMatch(/border-sentinel/)
    // Warning icon (verify it has text-sentinel; query by aria-hidden + svg)
    const icon = container.querySelector('svg[aria-hidden="true"]')
    expect(icon).toBeTruthy()
    expect(icon?.getAttribute('class') ?? '').toMatch(/text-sentinel/)
  })

  it('uses bg-glass-1 (not bg-card) for both variants', () => {
    const { container: c1 } = render(
      <ConfirmCard action="Send" amount="1 SOL" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(c1.querySelector('[class*="bg-glass-1"]')).toBeTruthy()
    expect(c1.querySelector('[class*="bg-card"]')).toBeNull()

    const { container: c2 } = render(
      <ConfirmCard variant="warning" action="Send" amount="1 SOL" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(c2.querySelector('[class*="bg-glass-1"]')).toBeTruthy()
    expect(c2.querySelector('[class*="bg-card"]')).toBeNull()
  })
```

- [ ] **Step 5.2: Run test — verify fails**

```bash
cd app && pnpm test --run src/components/__tests__/ConfirmCard.test.tsx
```

Expected: 2 new tests FAIL (still using yellow tones + bg-card).

- [ ] **Step 5.3: Update ConfirmCard.tsx**

Edit `app/src/components/ConfirmCard.tsx`:

```typescript
import { Warning } from '@phosphor-icons/react'

type Variant = 'normal' | 'warning'

interface Props {
  action: string
  amount: string
  onConfirm: () => void
  onCancel: () => void
  variant?: Variant
  description?: string
  disabled?: boolean
  timeout?: number
}

export default function ConfirmCard({
  action,
  amount,
  onConfirm,
  onCancel,
  variant = 'normal',
  description,
  disabled = false,
}: Props) {
  const isWarning = variant === 'warning'
  const borderClass = isWarning ? 'border-sentinel/40' : 'border-line'
  const primaryClass = isWarning
    ? 'border-sentinel/50 text-sentinel hover:bg-sentinel-soft'
    : 'border-sipher/50 text-sipher hover:bg-sipher/10'
  const primaryLabel = isWarning ? 'Override & Send' : 'Confirm & Sign'
  const labelText = isWarning ? 'Risk Confirm' : 'Confirm Action'

  return (
    <div className={`bg-glass-1 border ${borderClass} rounded-lg p-4 flex flex-col gap-3`}>
      <div className="text-[12px] text-text-muted uppercase tracking-wide flex items-center gap-1">
        {isWarning && <Warning size={12} weight="fill" className="text-sentinel" aria-hidden="true" />}
        <span>{labelText}</span>
      </div>
      <div className="text-[14px] text-text">{action}: {amount}</div>
      {description && (
        <div className="text-[12px] text-text-muted leading-relaxed">{description}</div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={disabled}
          className={`flex-1 border ${primaryClass} py-2 rounded-lg text-[12px] font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {primaryLabel}
        </button>
        <button
          onClick={onCancel}
          disabled={disabled}
          className="px-4 border border-line text-text-muted py-2 rounded-lg text-[12px] hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5.4: Run test — verify pass**

```bash
cd app && pnpm test --run src/components/__tests__/ConfirmCard.test.tsx
```

Expected: all tests pass (existing + 2 new).

- [ ] **Step 5.5: Update SentinelConfirm.test.tsx — failing assertion for text-danger**

Find the test in `app/src/components/__tests__/SentinelConfirm.test.tsx` that exercises the error display path. Modify the assertion to expect `text-danger`:

```typescript
  it('shows error message in text-danger when API call fails', async () => {
    server.use(...)  // Or however the existing mock setup works — keep it
    // existing arrange + act ...
    await waitFor(() => {
      const errorEl = screen.getByText(/Network error/)
      expect(errorEl.className).toMatch(/text-danger/)
    })
  })
```

If the existing test uses `text-red`, change it to `text-danger`. Read the test file first; the exact phrasing depends on the existing assertion shape.

- [ ] **Step 5.6: Run test — verify fails**

```bash
cd app && pnpm test --run src/components/__tests__/SentinelConfirm.test.tsx
```

Expected: error display test FAILS (still `text-red`).

- [ ] **Step 5.7: Update SentinelConfirm.tsx error display class**

Edit `app/src/components/SentinelConfirm.tsx` line 55:

```typescript
{error && <div className="text-[12px] text-danger px-1">{error}</div>}
```

- [ ] **Step 5.8: Run test — verify pass**

```bash
cd app && pnpm test --run src/components/__tests__/SentinelConfirm.test.tsx
```

Expected: all SentinelConfirm tests pass.

- [ ] **Step 5.9: Verify ChatSidebar tests still pass (consumes SentinelConfirm)**

```bash
cd app && pnpm test --run src/components/__tests__/ChatSidebar.test.tsx
```

Expected: all pass.

- [ ] **Step 5.10: Verify no remaining legacy tokens in touched files**

```bash
grep -nE "bg-card|bg-elevated|border-elevated|border-border|bg-red|bg-yellow|bg-green|text-red|text-yellow|text-green" app/src/components/ConfirmCard.tsx app/src/components/SentinelConfirm.tsx
```

Expected: no output.

- [ ] **Step 5.11: TypeScript check**

```bash
cd app && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5.12: Commit**

```bash
git add app/src/components/ConfirmCard.tsx app/src/components/__tests__/ConfirmCard.test.tsx app/src/components/SentinelConfirm.tsx app/src/components/__tests__/SentinelConfirm.test.tsx
git commit -m "feat(redesign): sentinel tones for ConfirmCard warning variant

ConfirmCard variant='warning' shifts from yellow to sentinel tones
(border, primary button, icon). variant='normal' stays sipher-toned.
bg-card -> bg-glass-1 and border-elevated -> border-line on the card
container and Cancel button.

SentinelConfirm error display: text-red -> text-danger.

Component still renders inline in ChatSidebar (no Sheet wrap per
spec D3)."
```

---

## Task 6: Final verification + open PR

**Goal:** Confirm full test suite green, tsc clean, build succeeds, then push branch and open PR.

- [ ] **Step 6.1: Run full app test suite**

```bash
cd .worktrees/feat-redesign-admin/app && pnpm test --run 2>&1 | tail -10
```

Expected: ~343 tests pass across ~58 suites. If counts are off, investigate before proceeding.

- [ ] **Step 6.2: Run agent test suite (sanity check — should be unchanged)**

```bash
cd ../packages/agent && pnpm test --run 2>&1 | tail -3
```

Expected: 1399 tests across 116 suites — unchanged from baseline.

- [ ] **Step 6.3: TypeScript check across app**

```bash
cd ../../app && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6.4: Build check**

```bash
cd .. && pnpm build
```

Expected: build succeeds for sdk + agent + app.

- [ ] **Step 6.5: Spot-check legacy tokens are out of touched files**

```bash
grep -nE "bg-card|bg-elevated|border-border|bg-red|bg-yellow|bg-green|text-red|text-yellow|text-green" \
  app/src/components/UserMenu.tsx \
  app/src/components/Header.tsx \
  app/src/views/HeraldView.tsx \
  app/src/views/SquadView.tsx \
  app/src/components/ConfirmCard.tsx \
  app/src/components/SentinelConfirm.tsx
```

Expected: no output. (If `bg-card`/`border-border` remain in Header.tsx — those are shared utility classes preserved by Tailwind aliases; check if they're meaningful in context. If they're just legacy that we missed, migrate them.)

- [ ] **Step 6.6: Push branch**

```bash
git push -u origin feat/redesign-admin
```

- [ ] **Step 6.7: Open PR via gh**

```bash
gh pr create --base main --title "feat(redesign): PR 8 — Admin views restyle (Herald, Squad, SentinelConfirm)" --body "$(cat <<'EOF'
## Summary
- Migrates Herald, Squad, and Settings out of the public main nav into the Header avatar dropdown (per spec D8). Renames `<WalletDropdown>` → `<UserMenu>` and adds an admin section gated by `isAdmin`.
- Restyles HeraldView, SquadView, and SentinelConfirm with the glass-neon visual language. Identity colors applied as **accents only** — chips, status pills, hero CTAs, sub-tab underlines. Cards stay neutral.
- Migrates legacy Tailwind aliases to new design system tokens across all touched files (`bg-card`, `border-border`, `bg-red/yellow/green`, `text-red/yellow/green`, `bg-elevated`).
- Closes a defense-in-depth gap: `HeraldView` and `SquadView` now have the admin-redirect pattern that PR 7 added to `SettingsView`.
- Mobile `BottomNav` drawer unchanged (already correctly shaped per PR 7).

## Spec
[docs/superpowers/specs/2026-05-10-pr8-admin-restyle-design.md](https://github.com/sip-protocol/sipher/blob/main/docs/superpowers/specs/2026-05-10-pr8-admin-restyle-design.md)

## Test plan
- [ ] App tests: 330 → 343 (or thereabouts), all pass
- [ ] Agent tests: 1399 unchanged
- [ ] `npx tsc --noEmit` clean in `app/`
- [ ] `pnpm build` succeeds
- [ ] CI 7/7 green (Vercel preview, component, playwright, scan, build-and-push, deploy)
- [ ] Vercel preview manual smoke:
  - [ ] Admin user: address dropdown shows "ADMIN" eyebrow, then Settings/Herald/Squad, divider, then wallet ops
  - [ ] Click each admin item navigates correctly + dropdown closes
  - [ ] Non-admin user: dropdown shows only wallet section
  - [ ] HeraldView: budget bar uses success/warning/danger across thresholds
  - [ ] SquadView: SENTINEL eyebrow chip renders; KillSwitch tones flip correctly between active/paused
  - [ ] SentinelConfirm in chat: amber sentinel tone on "Risk Confirm" eyebrow + "Override & Send" button
  - [ ] Mobile BottomNav drawer admin section unchanged

## Sprint context
PR 8 of 9 in the Phase 4b glass-neon redesign sprint. Predecessor PR 7 (#186, `7a29d95`). Successor PR 9 (ROADMAP + Phase D launch prep).
EOF
)"
```

- [ ] **Step 6.8: Watch CI; fix any failures**

```bash
gh pr checks --watch
```

If failures: investigate locally, fix, push new commits (NEVER `--amend` per carry-forward rule #4). Do not merge until CI is fully green.

- [ ] **Step 6.9: After CI green, merge from main worktree to avoid worktree-owns-branch quirk**

```bash
cd ~/local-dev/sipher  # back to main checkout, NOT the worktree
git checkout main
git pull
gh pr merge <pr-number> --merge --delete-branch
git pull
git worktree remove .worktrees/feat-redesign-admin
git branch -D feat/redesign-admin  # if local branch lingers
```

(Per carry-forward gotcha #15: server-side merge succeeds either way; `--delete-branch` blocks if any worktree owns the branch. Switching to main first avoids the quirk.)

- [ ] **Step 6.10: Update sprint memory**

Edit `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`:

- Mark PR 8 row MERGED with the merge SHA
- Add a narrative paragraph capturing test counts (e.g., 330 → 343 app, 1399 agent unchanged), commit count, decisions reaffirmed
- Add any new carry-forward gotchas surfaced during execution

---

## Self-review checklist

**1. Spec coverage:**
- D1 (admin views to dropdown): Task 1 (UserMenu admin section) + Task 2 (Header NAV_ITEMS shrink) ✓
- D2 (accent-only): Tasks 3, 4, 5 — accents on chips, status pills, sub-tab underlines, hero CTAs; cards stay neutral ✓
- D3 (SentinelConfirm inline): Task 5 — no Sheet wrap; ConfirmCard restyles in place ✓
- D4 (full token migration): Tasks 1, 3, 4, 5 cover all 4 files + UserMenu ✓
- D5 (BottomNav unchanged): Task 2 Step 2.5 verifies mobile drawer untouched ✓
- D6 (URL deep-linking deferred): no plan task adds routing — defer confirmed ✓
- Three-layer admin gate: Task 1 (UI surface), Tasks 3 + 4 (component redirects), backend already enforced ✓

**2. Placeholder scan:** None — every step has actual code or exact commands.

**3. Type consistency:** `onNavigate: (view: 'settings' | 'herald' | 'squad') => void` consistent across UserMenu and Header. `setActiveView` accepts the wider `View` type — narrowed via typed handler in Step 2.3 if TSC complains.

**4. Test counts:** Plan adds 8+ new tests (5 UserMenu + 2 HeraldView + 5 SquadView + 2 ConfirmCard); existing test updates may net +1-3 more. Projected app test count 330 → ~343 (close to spec acceptance criteria).

**5. Migration completeness:** Step 6.5 grep verifies no legacy tokens remain in touched files; per-file Steps 3.8, 4.11 also grep. Belt-and-suspenders.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-10-pr8-admin-restyle.md`. Two execution options:

1. **Subagent-Driven (recommended)** — Tasks 3, 4, 5 are independent files; dispatch in parallel under `superpowers:subagent-driven-development` for fastest wall-clock. Tasks 1, 2, 6 are INLINE (mechanical / sequential).

2. **Inline Execution** — Execute tasks sequentially in this session via `superpowers:executing-plans`, batch with checkpoints for review. Slower but lowest cognitive load.

Which approach?
