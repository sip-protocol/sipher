# Command Center UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite Sipher's frontend from a basic chat widget into a professional privacy command center with adaptive desktop/mobile layout, persistent chat sidebar, role-based admin views, and new dark professional design system.

**Architecture:** Adaptive layout — desktop (≥1024px) shows top header with tab navigation + main content area + 300px persistent chat sidebar. Tablet (768-1023px) shows top header + main content + chat as a navigable tab. Mobile (<768px) shows bottom tab nav + full-screen views + chat as its own tab. Role-based access hides Herald/Squad tabs for non-admin wallets. Zustand replaces prop-drilling for shared state (auth, navigation, chat messages).

**Tech Stack:** React 19, Vite 6, Tailwind CSS 4, Zustand, @phosphor-icons/react, @solana/wallet-adapter

**Design spec:** `docs/superpowers/specs/2026-04-10-command-center-ui-design.md`

---

## File Structure

| Status | Path | Purpose |
|--------|------|---------|
| **Create** | `app/src/stores/app.ts` | Zustand store — navigation, auth, chat state |
| **Create** | `app/src/hooks/useIsAdmin.ts` | Admin check hook (reads from store) |
| **Create** | `app/src/components/ChatSidebar.tsx` | Persistent chat sidebar with SSE streaming |
| **Create** | `app/src/components/MetricCard.tsx` | Reusable metric display card |
| **Create** | `app/src/views/DashboardView.tsx` | Home dashboard — metrics, activity, agent panel |
| **Modify** | `app/src/styles/theme.css` | New color system (bg-base, card, elevated, accent) |
| **Modify** | `app/index.html` | Remove Phosphor CDN script |
| **Modify** | `app/src/api/auth.ts` | Add `isAdmin` to verify return type |
| **Modify** | `app/src/hooks/useAuth.ts` | Store token + isAdmin in Zustand |
| **Modify** | `app/src/components/Header.tsx` | Desktop/tablet top nav with tabs, agent dots, wallet |
| **Modify** | `app/src/components/BottomNav.tsx` | Mobile bottom nav (Home, Vault, Chat, More) |
| **Modify** | `app/src/App.tsx` | Adaptive layout shell |
| **Modify** | `app/src/views/VaultView.tsx` | Rewrite with new design tokens |
| **Modify** | `app/src/views/HeraldView.tsx` | Rewrite with new design tokens |
| **Modify** | `app/src/views/SquadView.tsx` | Rewrite with new design tokens |
| **Modify** | `packages/agent/src/routes/auth.ts` | Add `isAdmin` field to verify response |
| **Delete** | `app/src/components/CommandBar.tsx` | Replaced by ChatSidebar |
| **Delete** | `app/src/views/StreamView.tsx` | Absorbed into DashboardView |

---

### Task 1: Foundation Setup

**Files:**
- Modify: `app/package.json` (install deps)
- Modify: `app/src/styles/theme.css`
- Modify: `app/index.html`

- [ ] **Step 1: Create feature branch**

```bash
cd ~/local-dev/sipher && git checkout main && git pull && git checkout -b feat/command-center-ui
```

- [ ] **Step 2: Install dependencies**

```bash
cd ~/local-dev/sipher/app && pnpm add zustand @phosphor-icons/react
```

- [ ] **Step 3: Update theme.css with new color system**

Write `app/src/styles/theme.css`:

```css
@import 'tailwindcss';

@theme {
  /* Backgrounds */
  --color-bg: #111113;
  --color-card: #161618;
  --color-elevated: #1E1E22;
  --color-border: #232326;

  /* Text hierarchy */
  --color-text: #E4E4E7;
  --color-text-secondary: #A1A1AA;
  --color-text-muted: #71717A;
  --color-text-dim: #52525B;

  /* Brand */
  --color-accent: #7C3AED;

  /* Status */
  --color-green: #22C55E;
  --color-yellow: #F59E0B;
  --color-red: #EF4444;

  /* Agent identity */
  --color-sipher: #10B981;
  --color-herald: #3B82F6;
  --color-sentinel: #F59E0B;
  --color-courier: #8B5CF6;

  --radius-lg: 8px;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
  margin: 0;
  min-height: 100dvh;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior-y: none;
}

.font-mono {
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
}
```

- [ ] **Step 4: Remove Phosphor CDN from index.html**

In `app/index.html`, remove this line:
```html
<script src="https://unpkg.com/@phosphor-icons/web"></script>
```

Also update the `<title>` to:
```html
<title>SIPHER — Privacy Command Center</title>
```

Full `app/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SIPHER — Privacy Command Center</title>
    <meta name="description" content="Privacy command center by SIP Protocol" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Verify build**

```bash
cd ~/local-dev/sipher/app && pnpm build
```

Build will have type errors from Phosphor icon CDN class references in existing files — that's expected, the views haven't been rewritten yet. Just confirm the build process runs. If TypeScript strict mode prevents build, proceed to the next tasks — the icon references will be fixed when views are rewritten.

- [ ] **Step 6: Commit**

```bash
cd ~/local-dev/sipher
git add app/package.json app/pnpm-lock.yaml app/src/styles/theme.css app/index.html
git commit -m "feat(app): foundation setup — zustand, phosphor-react, new color system"
```

---

### Task 2: State Management + Hooks

**Files:**
- Create: `app/src/stores/app.ts`
- Create: `app/src/hooks/useIsAdmin.ts`
- Modify: `app/src/api/auth.ts`
- Modify: `app/src/hooks/useAuth.ts`

- [ ] **Step 1: Create Zustand store**

Write `app/src/stores/app.ts`:

```typescript
import { create } from 'zustand'

export type View = 'dashboard' | 'vault' | 'herald' | 'squad' | 'chat'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolName?: string
  streaming?: boolean
}

interface AppState {
  // Navigation
  activeView: View
  setActiveView: (view: View) => void

  // Auth
  token: string | null
  isAdmin: boolean
  setAuth: (token: string, isAdmin: boolean) => void
  clearAuth: () => void

  // Chat
  messages: ChatMessage[]
  chatLoading: boolean
  addMessage: (msg: ChatMessage) => void
  appendToLast: (text: string) => void
  finishStreaming: () => void
  setChatLoading: (loading: boolean) => void

  // UI (tablet/mobile chat visibility)
  chatOpen: boolean
  setChatOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'dashboard',
  setActiveView: (activeView) => set({ activeView }),

  token: null,
  isAdmin: false,
  setAuth: (token, isAdmin) => set({ token, isAdmin }),
  clearAuth: () => set({ token: null, isAdmin: false, messages: [], activeView: 'dashboard' }),

  messages: [],
  chatLoading: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendToLast: (text) =>
    set((s) => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + text }
      }
      return { messages: msgs }
    }),
  finishStreaming: () =>
    set((s) => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last?.streaming) {
        msgs[msgs.length - 1] = { ...last, streaming: false }
      }
      return { messages: msgs }
    }),
  setChatLoading: (chatLoading) => set({ chatLoading }),

  chatOpen: false,
  setChatOpen: (chatOpen) => set({ chatOpen }),
}))
```

- [ ] **Step 2: Update auth API return type**

Write `app/src/api/auth.ts`:

```typescript
import { apiFetch } from './client'

export async function requestNonce(wallet: string): Promise<{ nonce: string; message: string }> {
  return apiFetch('/api/auth/nonce', { method: 'POST', body: JSON.stringify({ wallet }) })
}

export async function verifySignature(
  wallet: string,
  nonce: string,
  signature: string
): Promise<{ token: string; expiresIn: string; isAdmin: boolean }> {
  return apiFetch('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ wallet, nonce, signature }),
  })
}
```

- [ ] **Step 3: Update useAuth to use Zustand store**

Write `app/src/hooks/useAuth.ts`:

```typescript
import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { requestNonce, verifySignature } from '../api/auth'
import { useAppStore } from '../stores/app'

export function useAuth() {
  const { publicKey, signMessage } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = useAppStore((s) => s.token)
  const isAdmin = useAppStore((s) => s.isAdmin)
  const setAuth = useAppStore((s) => s.setAuth)
  const clearAuth = useAppStore((s) => s.clearAuth)

  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage) return null
    setLoading(true)
    setError(null)
    try {
      const wallet = publicKey.toBase58()
      const { nonce, message } = await requestNonce(wallet)
      const encoded = new TextEncoder().encode(message)
      const sig = await signMessage(encoded)
      const sigHex = Array.from(sig)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const result = await verifySignature(wallet, nonce, sigHex)
      setAuth(result.token, result.isAdmin ?? false)
      return result.token
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [publicKey, signMessage, setAuth])

  return { token, isAdmin, authenticate, loading, error, isAuthenticated: !!token, clearAuth }
}
```

- [ ] **Step 4: Create useIsAdmin hook**

Write `app/src/hooks/useIsAdmin.ts`:

```typescript
import { useAppStore } from '../stores/app'

export function useIsAdmin() {
  return useAppStore((s) => s.isAdmin)
}
```

- [ ] **Step 5: Verify build**

```bash
cd ~/local-dev/sipher/app && pnpm build
```

There may be build errors from App.tsx still importing old modules — that's expected since App.tsx hasn't been rewritten yet. Confirm the new files themselves have no type errors by checking the output.

- [ ] **Step 6: Commit**

```bash
cd ~/local-dev/sipher
git add app/src/stores/ app/src/hooks/useAuth.ts app/src/hooks/useIsAdmin.ts app/src/api/auth.ts
git commit -m "feat(app): zustand store, auth hooks with isAdmin support"
```

---

### Task 3: Backend isAdmin

**Files:**
- Modify: `packages/agent/src/routes/auth.ts:196-197`

- [ ] **Step 1: Add isAdmin to verify response**

In `packages/agent/src/routes/auth.ts`, find lines 193-197:

```typescript
  // One-time use — consume before responding
  pendingNonces.delete(nonce)

  const token = jwt.sign({ wallet }, getSecret(), { expiresIn: JWT_EXPIRY, algorithm: 'HS256' })
  res.json({ token, expiresIn: JWT_EXPIRY })
```

Replace with:

```typescript
  // One-time use — consume before responding
  pendingNonces.delete(nonce)

  const allowed = (process.env.AUTHORIZED_WALLETS ?? '').split(',').map((w) => w.trim()).filter(Boolean)
  const isAdmin = allowed.length > 0 && allowed.includes(wallet)

  const token = jwt.sign({ wallet }, getSecret(), { expiresIn: JWT_EXPIRY, algorithm: 'HS256' })
  res.json({ token, expiresIn: JWT_EXPIRY, isAdmin })
```

- [ ] **Step 2: Run tests**

```bash
cd ~/local-dev/sipher && pnpm test -- --run
```

Expected: All 497 tests pass. The auth tests should still pass since `isAdmin` is a new additive field.

- [ ] **Step 3: Commit**

```bash
cd ~/local-dev/sipher
git add packages/agent/src/routes/auth.ts
git commit -m "feat(auth): include isAdmin in verify response for frontend role gating"
```

---

### Task 4: Layout Shell (App + Header + BottomNav)

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/Header.tsx`
- Modify: `app/src/components/BottomNav.tsx`

**Context:** Read the existing files first. The Header needs to become a desktop/tablet top navigation bar. BottomNav needs to become a mobile-only bottom bar with a "More" sheet. App.tsx needs to wire the adaptive layout. The `View` type is now imported from the Zustand store.

- [ ] **Step 1: Rewrite Header.tsx**

Write `app/src/components/Header.tsx`:

```tsx
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import {
  ChartBar,
  Vault,
  Broadcast,
  UsersThree,
  ChatCircle,
} from '@phosphor-icons/react'
import { useAppStore, type View } from '../stores/app'
import { useAuth } from '../hooks/useAuth'
import AgentDot from './AgentDot'
import { truncateAddress } from '../lib/format'

const NETWORK = (import.meta.env.VITE_SOLANA_NETWORK ?? 'mainnet-beta') as string

interface Tab {
  id: View
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>
  adminOnly?: boolean
  tabletOnly?: boolean
}

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartBar },
  { id: 'vault', label: 'Vault', icon: Vault },
  { id: 'chat', label: 'Chat', icon: ChatCircle, tabletOnly: true },
  { id: 'herald', label: 'Herald', icon: Broadcast, adminOnly: true },
  { id: 'squad', label: 'Squad', icon: UsersThree, adminOnly: true },
]

export default function Header() {
  const { publicKey, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const { isAuthenticated, authenticate, isAdmin } = useAuth()
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)

  const visibleTabs = TABS.filter((t) => {
    if (t.adminOnly && !isAdmin) return false
    return true
  })

  return (
    <header className="hidden md:flex h-12 border-b border-border items-center justify-between px-4 bg-bg shrink-0 z-10">
      <div className="flex items-center gap-1">
        <span className="font-semibold text-[13px] tracking-widest uppercase text-text mr-4">
          Sipher
        </span>
        <nav className="flex items-center">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const active = activeView === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors',
                  tab.tabletOnly ? 'lg:hidden' : '',
                  active ? 'text-text bg-elevated' : 'text-text-muted hover:text-text-secondary',
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
        <div className="flex items-center gap-1.5">
          <AgentDot agent="sipher" size={5} />
          <AgentDot agent="herald" size={5} />
          <AgentDot agent="sentinel" size={5} />
        </div>

        <span className="text-[10px] font-mono text-text-muted bg-elevated px-1.5 py-0.5 rounded">
          {NETWORK === 'mainnet-beta' ? 'mainnet' : 'devnet'}
        </span>

        {connected && publicKey ? (
          <button
            onClick={isAuthenticated ? undefined : authenticate}
            className="flex items-center gap-2 bg-card border border-border px-2.5 py-1 rounded-lg hover:bg-elevated transition-colors"
          >
            <span className="text-[11px] font-mono text-text-secondary">
              {truncateAddress(publicKey.toBase58())}
            </span>
            <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">
                {publicKey.toBase58()[0]}
              </span>
            </div>
          </button>
        ) : (
          <button
            onClick={() => setVisible(true)}
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

- [ ] **Step 2: Rewrite BottomNav.tsx**

Write `app/src/components/BottomNav.tsx`:

```tsx
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import {
  ChartBar,
  Vault,
  ChatCircle,
  DotsThree,
  Broadcast,
  UsersThree,
  SignOut,
} from '@phosphor-icons/react'
import { useAppStore, type View } from '../stores/app'
import { useIsAdmin } from '../hooks/useIsAdmin'

interface TabDef {
  id: View
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>
}

const TABS: TabDef[] = [
  { id: 'dashboard', label: 'Home', icon: ChartBar },
  { id: 'vault', label: 'Vault', icon: Vault },
  { id: 'chat', label: 'Chat', icon: ChatCircle },
]

export default function BottomNav() {
  const activeView = useAppStore((s) => s.activeView)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const isAdmin = useIsAdmin()
  const { disconnect } = useWallet()
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      <nav className="flex md:hidden border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeView === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
                active ? 'text-text' : 'text-text-muted'
              }`}
            >
              <Icon size={20} weight={active ? 'fill' : 'regular'} />
              <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
            </button>
          )
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
            moreOpen ? 'text-text' : 'text-text-muted'
          }`}
        >
          <DotsThree size={20} weight="bold" />
          <span className="text-[10px] font-medium tracking-wide">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 inset-x-0 bg-card border-t border-border rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-8 h-1 bg-border rounded-full mx-auto mb-4" />
            <div className="flex flex-col gap-1">
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setActiveView('herald')
                      setMoreOpen(false)
                    }}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-text-secondary hover:bg-elevated transition-colors"
                  >
                    <Broadcast size={20} />
                    <span className="text-sm font-medium">Herald</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveView('squad')
                      setMoreOpen(false)
                    }}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-text-secondary hover:bg-elevated transition-colors"
                  >
                    <UsersThree size={20} />
                    <span className="text-sm font-medium">Squad</span>
                  </button>
                  <div className="border-t border-border my-1" />
                </>
              )}
              <button
                onClick={() => {
                  disconnect()
                  setMoreOpen(false)
                }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-red hover:bg-red/10 transition-colors"
              >
                <SignOut size={20} />
                <span className="text-sm font-medium">Disconnect Wallet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Rewrite App.tsx**

Write `app/src/App.tsx`:

```tsx
import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'
import './styles/theme.css'

import Header from './components/Header'
import BottomNav from './components/BottomNav'
import ChatSidebar from './components/ChatSidebar'
import DashboardView from './views/DashboardView'
import VaultView from './views/VaultView'
import HeraldView from './views/HeraldView'
import SquadView from './views/SquadView'
import { useAppStore } from './stores/app'
import { useAuth } from './hooks/useAuth'
import { useSSE } from './hooks/useSSE'

const NETWORK = (import.meta.env.VITE_SOLANA_NETWORK ?? 'mainnet-beta') as 'devnet' | 'mainnet-beta'
const ENDPOINTS: Record<string, string> = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
}

function AppShell() {
  const activeView = useAppStore((s) => s.activeView)
  const { token, isAdmin } = useAuth()
  const { events } = useSSE(token)

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView events={events} token={token} />
      case 'vault':
        return <VaultView token={token} />
      case 'herald':
        return isAdmin ? <HeraldView token={token} /> : <DashboardView events={events} token={token} />
      case 'squad':
        return isAdmin ? <SquadView token={token} /> : <DashboardView events={events} token={token} />
      case 'chat':
        return (
          <div className="lg:hidden h-full">
            <ChatSidebar fullScreen />
          </div>
        )
      default:
        return <DashboardView events={events} token={token} />
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-bg">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-6">
          {renderView()}
        </main>

        {/* Desktop persistent chat sidebar */}
        <aside className="hidden lg:flex w-[300px] border-l border-border shrink-0">
          <ChatSidebar />
        </aside>
      </div>

      <BottomNav />
    </div>
  )
}

export default function App() {
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL ?? ENDPOINTS[NETWORK]
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppShell />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
cd ~/local-dev/sipher/app && pnpm build
```

Build will fail on missing `ChatSidebar` and `DashboardView` — those are created in Tasks 5 and 6. If blocking, create empty placeholder files:

```bash
echo 'export default function ChatSidebar(_props: { fullScreen?: boolean }) { return <div /> }' > app/src/components/ChatSidebar.tsx
echo 'export default function DashboardView(_props: { events: any[]; token: string | null }) { return <div /> }' > app/src/views/DashboardView.tsx
```

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add app/src/App.tsx app/src/components/Header.tsx app/src/components/BottomNav.tsx
git add app/src/components/ChatSidebar.tsx app/src/views/DashboardView.tsx  # if placeholders created
git commit -m "feat(app): adaptive layout shell — desktop sidebar, mobile bottom nav"
```

---

### Task 5: ChatSidebar

**Files:**
- Create: `app/src/components/ChatSidebar.tsx`
- Delete: `app/src/components/CommandBar.tsx`

**Context:** This replaces the `CommandBar.tsx` modal. On desktop (≥1024px), it's a 300px persistent sidebar on the right. On mobile/tablet (<1024px), it renders as a full-screen view when the "Chat" tab is active. Uses SSE streaming via `POST /api/chat/stream` which returns events: `content_block_delta` (text chunks), `tool_use`, `tool_result`, `message_complete`, `error`, and `[DONE]`.

- [ ] **Step 1: Write ChatSidebar.tsx**

Write `app/src/components/ChatSidebar.tsx`:

```tsx
import { useRef, useEffect, useState, useCallback } from 'react'
import { PaperPlaneTilt, CircleNotch, Wrench } from '@phosphor-icons/react'
import { useAppStore, type ChatMessage } from '../stores/app'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface Props {
  fullScreen?: boolean
}

export default function ChatSidebar({ fullScreen }: Props) {
  const token = useAppStore((s) => s.token)
  const messages = useAppStore((s) => s.messages)
  const chatLoading = useAppStore((s) => s.chatLoading)
  const addMessage = useAppStore((s) => s.addMessage)
  const appendToLast = useAppStore((s) => s.appendToLast)
  const finishStreaming = useAppStore((s) => s.finishStreaming)
  const setChatLoading = useAppStore((s) => s.setChatLoading)

  const [input, setInput] = useState('')
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !token || chatLoading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    }
    addMessage(userMsg)
    setInput('')
    setChatLoading(true)
    setActiveTool(null)

    // Create assistant placeholder
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      streaming: true,
    }
    addMessage(assistantMsg)

    try {
      const allMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? `Error ${res.status}`)
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break

          try {
            const event = JSON.parse(data)
            if (event.type === 'content_block_delta' && event.text) {
              appendToLast(event.text)
            } else if (event.type === 'tool_use') {
              setActiveTool(event.name)
            } else if (event.type === 'tool_result') {
              setActiveTool(null)
            } else if (event.type === 'error') {
              appendToLast(`\n\nError: ${event.message}`)
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      appendToLast(msg || 'Connection failed')
    } finally {
      finishStreaming()
      setChatLoading(false)
      setActiveTool(null)
    }
  }, [input, token, chatLoading, messages, addMessage, appendToLast, finishStreaming, setChatLoading])

  return (
    <div
      className={`flex flex-col bg-card ${
        fullScreen ? 'h-full' : 'h-full w-full'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-sipher" />
        <span className="text-[13px] font-semibold text-text">SIPHER</span>
        {chatLoading && activeTool && (
          <span className="text-[11px] text-text-muted flex items-center gap-1">
            <Wrench size={11} className="animate-spin" />
            {activeTool}
          </span>
        )}
        {chatLoading && !activeTool && (
          <CircleNotch size={12} className="text-text-muted animate-spin" />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
        {messages.length === 0 && (
          <p className="text-text-muted text-sm text-center py-8">
            Ask SIPHER anything about your privacy.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-accent/15 border border-accent/20 text-text'
                  : 'bg-elevated border border-border text-text'
              }`}
            >
              {msg.content || (msg.streaming ? '...' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder={token ? 'Message SIPHER...' : 'Connect wallet first'}
            className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text-muted focus:outline-none focus:border-accent/40 transition-colors"
            disabled={!token || chatLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !token || chatLoading}
            className="bg-accent/15 border border-accent/20 rounded-lg px-3 py-2 text-accent hover:bg-accent/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Send"
          >
            <PaperPlaneTilt size={16} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Delete CommandBar.tsx**

```bash
rm ~/local-dev/sipher/app/src/components/CommandBar.tsx
```

- [ ] **Step 3: Verify build**

```bash
cd ~/local-dev/sipher/app && pnpm build
```

- [ ] **Step 4: Commit**

```bash
cd ~/local-dev/sipher
git add app/src/components/ChatSidebar.tsx
git rm app/src/components/CommandBar.tsx
git commit -m "feat(app): streaming chat sidebar — replaces CommandBar modal"
```

---

### Task 6: DashboardView + MetricCard

**Files:**
- Create: `app/src/components/MetricCard.tsx`
- Create: `app/src/views/DashboardView.tsx`
- Delete: `app/src/views/StreamView.tsx`

**Context:** The DashboardView is the new home screen. It shows 4 metric cards (SOL balance, privacy score, vault deposits, agent budget), an activity stream (from SSE events + history API), and a guardian squad panel (admin only). Data comes from `GET /api/vault`, `GET /api/activity`, `GET /api/health`, and SSE events.

- [ ] **Step 1: Create MetricCard component**

Write `app/src/components/MetricCard.tsx`:

```tsx
import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string
  sub?: string
  icon: ReactNode
  color?: string
}

export default function MetricCard({ label, value, sub, icon, color }: Props) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-text-muted tracking-widest uppercase">
          {label}
        </span>
        <span className="text-text-muted">{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="text-[22px] font-mono font-bold leading-none"
          style={color ? { color } : undefined}
        >
          {value}
        </span>
        {sub && <span className="text-[11px] font-mono text-text-muted">{sub}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create DashboardView**

Write `app/src/views/DashboardView.tsx`:

```tsx
import { useEffect, useState } from 'react'
import {
  Wallet,
  ShieldCheck,
  ArrowDown,
  Lightning,
} from '@phosphor-icons/react'
import { apiFetch } from '../api/client'
import { type ActivityEvent } from '../hooks/useSSE'
import { useIsAdmin } from '../hooks/useIsAdmin'
import MetricCard from '../components/MetricCard'
import ActivityEntry from '../components/ActivityEntry'
import AgentDot from '../components/AgentDot'
import { AGENTS, type AgentName } from '../lib/agents'
import { formatSOL } from '../lib/format'

interface VaultData {
  wallet: string
  balances: { sol: number; tokens: unknown[]; status: string }
}

interface HealthData {
  status: string
  tools: string[]
  uptime: number
  activeSessions: number
}

interface HeraldBudget {
  budget: { spent: number; limit: number; percentage: number; gate: string }
}

export default function DashboardView({
  events,
  token,
}: {
  events: ActivityEvent[]
  token: string | null
}) {
  const isAdmin = useIsAdmin()
  const [vault, setVault] = useState<VaultData | null>(null)
  const [health, setHealth] = useState<HealthData | null>(null)
  const [heraldBudget, setHeraldBudget] = useState<HeraldBudget | null>(null)
  const [history, setHistory] = useState<ActivityEvent[]>([])

  useEffect(() => {
    if (!token) return

    apiFetch<VaultData>('/api/vault', { token }).then(setVault).catch(() => {})
    apiFetch<HealthData>('/api/health', { token }).then(setHealth).catch(() => {})
    apiFetch<{ activity: any[] }>('/api/activity', { token })
      .then((data) => {
        setHistory(
          (data.activity ?? []).map((a: any) => ({
            id: a.id,
            agent: a.agent,
            type: a.type,
            level: a.level,
            data: typeof a.detail === 'string' ? (() => { try { return JSON.parse(a.detail) } catch { return { detail: a.detail } } })() : a.detail ?? {},
            timestamp: a.created_at,
          }))
        )
      })
      .catch(() => {})

    if (isAdmin) {
      apiFetch<HeraldBudget>('/api/herald', { token }).then(setHeraldBudget).catch(() => {})
    }
  }, [token, isAdmin])

  const solBalance = vault?.balances?.sol
  const depositCount = history.filter((e) => e.type?.includes('deposit')).length
  const allEvents = [...events, ...history].slice(0, 30)

  // Privacy score placeholder — computed by SIPHER agent tool, not a REST endpoint
  const privacyScore = '—'
  const scoreColor = undefined

  const budgetSpent = heraldBudget?.budget?.spent
  const budgetLimit = heraldBudget?.budget?.limit

  return (
    <div className="flex flex-col gap-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="SOL Balance"
          value={solBalance != null ? formatSOL(solBalance) : '—'}
          sub="SOL"
          icon={<Wallet size={16} />}
        />
        <MetricCard
          label="Privacy Score"
          value={privacyScore}
          sub="/100"
          icon={<ShieldCheck size={16} />}
          color={scoreColor}
        />
        <MetricCard
          label="Deposits"
          value={depositCount.toString()}
          sub="total"
          icon={<ArrowDown size={16} />}
        />
        {isAdmin && (
          <MetricCard
            label="Budget"
            value={budgetSpent != null ? `$${budgetSpent.toFixed(0)}` : '—'}
            sub={budgetLimit != null ? `/ $${budgetLimit}` : ''}
            icon={<Lightning size={16} />}
          />
        )}
      </div>

      {/* Two columns: Activity + Agent Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Stream */}
        <div className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <h3 className="text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-3 px-1">
            Activity Stream
          </h3>
          {allEvents.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <p className="text-text-muted text-sm">No activity yet.</p>
              <p className="text-text-dim text-xs mt-1">
                Connect your wallet to start monitoring.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {allEvents.map((event) => (
                <ActivityEntry
                  key={event.id}
                  agent={event.agent as AgentName}
                  title={
                    (event.data?.title as string) ??
                    (event.data?.message as string) ??
                    event.type
                  }
                  detail={event.data?.detail as string}
                  time={event.timestamp}
                  level={event.level}
                />
              ))}
            </div>
          )}
        </div>

        {/* Guardian Squad (admin only) */}
        {isAdmin && (
          <div>
            <h3 className="text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-3 px-1">
              Guardian Squad
            </h3>
            <div className="flex flex-col gap-2">
              {(Object.keys(AGENTS) as AgentName[]).map((id) => {
                const agent = AGENTS[id]
                return (
                  <div
                    key={id}
                    className="bg-card border border-border rounded-lg p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <AgentDot agent={id} size={6} />
                      <span
                        className="text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: agent.color }}
                      >
                        {agent.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-green font-mono">online</span>
                  </div>
                )
              })}
            </div>
            {health && (
              <p className="text-text-dim text-[10px] font-mono mt-2 px-1">
                Uptime: {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
                · {health.tools.length} tools · {health.activeSessions} sessions
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Delete StreamView.tsx**

```bash
rm ~/local-dev/sipher/app/src/views/StreamView.tsx
```

- [ ] **Step 4: Verify build**

```bash
cd ~/local-dev/sipher/app && pnpm build
```

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/sipher
git add app/src/components/MetricCard.tsx app/src/views/DashboardView.tsx
git rm app/src/views/StreamView.tsx
git commit -m "feat(app): dashboard view with metric cards, activity stream, agent panel"
```

---

### Task 7: VaultView Rewrite

**Files:**
- Modify: `app/src/views/VaultView.tsx`

**Context:** Read the existing `app/src/views/VaultView.tsx` first. Preserve all data fetching logic and business logic (classifyActivity, extractAmount, nextIn). Replace hardcoded hex colors with theme tokens. Replace Phosphor CDN icon classes (`<i className="ph ph-xxx">`) with React imports (`import { Xxx } from '@phosphor-icons/react'`). Use the vault API response which now returns real balances: `balances.sol` (number), `balances.tokens[]` (array with mint, symbol, uiAmount). Remove mock data — use real API data only, showing "—" if unavailable. Remove the `max-w-[720px]` constraint from the view (App.tsx now handles layout).

- [ ] **Step 1: Rewrite VaultView.tsx**

Write `app/src/views/VaultView.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { timeAgo, truncateAddress, formatSOL } from '../lib/format'
import {
  ArrowDownLeft,
  MaskHappy,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowsLeftRight,
  ArrowRight,
  ArrowUUpLeft,
  CheckCircle,
  Binoculars,
} from '@phosphor-icons/react'

interface TokenBalance {
  mint: string
  symbol: string
  amount: string
  decimals: number
  uiAmount: number
}

interface ActivityRow {
  id: string
  agent: string
  type: string
  level: string
  title: string
  detail?: string
  wallet?: string
  created_at: string
}

interface VaultData {
  wallet: string
  activity: ActivityRow[]
  balances: {
    sol: number
    tokens: TokenBalance[]
    status: string
  }
}

function classifyActivity(row: ActivityRow) {
  const t = row.type?.toLowerCase() ?? ''
  const title = row.title?.toLowerCase() ?? ''

  if (t.includes('refund') || title.includes('refund'))
    return { Icon: ArrowUUpLeft, iconColor: 'text-courier', label: 'Refund', statusLabel: 'Auto-refund', statusColor: 'text-courier', isStealth: false }
  if (t.includes('deposit') || title.includes('deposit'))
    return { Icon: ArrowDown, iconColor: 'text-green', label: 'Deposit', statusLabel: 'Confirmed', statusColor: 'text-green', isStealth: false }
  if (t.includes('withdraw') || title.includes('withdraw'))
    return { Icon: ArrowUp, iconColor: 'text-text', label: 'Withdraw', statusLabel: 'Stealth', statusColor: 'text-text-muted', isStealth: true }
  if (t.includes('send') || title.includes('send'))
    return { Icon: ArrowUpRight, iconColor: 'text-text', label: 'Send', statusLabel: 'Stealth', statusColor: 'text-text-muted', isStealth: true }
  if (t.includes('swap') || title.includes('swap'))
    return { Icon: ArrowsLeftRight, iconColor: 'text-herald', label: 'Swap', statusLabel: 'Confirmed', statusColor: 'text-green', isStealth: false }
  return { Icon: ArrowRight, iconColor: 'text-text-muted', label: row.type ?? 'Action', statusLabel: 'Done', statusColor: 'text-text-muted', isStealth: false }
}

function extractAmount(row: ActivityRow): string {
  const text = `${row.title ?? ''} ${row.detail ?? ''}`
  const match = text.match(/([\d.]+)\s*SOL/i)
  return match ? `${match[1]} SOL` : ''
}

export default function VaultView({ token }: { token: string | null }) {
  const [data, setData] = useState<VaultData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(false)
    apiFetch<VaultData>('/api/vault', { token })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  const sol = data?.balances?.sol
  const tokens = data?.balances?.tokens ?? []
  const activity = data?.activity ?? []
  const wallet = data?.wallet

  return (
    <div className="flex flex-col gap-6 pb-2">
      {error && (
        <div className="text-text-muted text-xs font-mono bg-card border border-border rounded-lg px-3 py-2">
          Could not load vault data
        </div>
      )}

      {/* Balance Card */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-[11px] font-semibold text-text-muted tracking-widest uppercase mb-4">
          Vault Balance
        </h2>
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-[32px] font-mono font-bold text-text tracking-tight">
            {sol != null ? formatSOL(sol) : '—'}
          </span>
          <span className="text-sm font-mono text-text-muted">SOL</span>
        </div>
        {tokens.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tokens.map((t) => (
              <span
                key={t.mint}
                className="text-[11px] font-mono text-text-secondary bg-elevated px-2 py-0.5 rounded"
              >
                {t.uiAmount.toLocaleString()} {t.symbol}
              </span>
            ))}
          </div>
        )}
        {wallet && (
          <p className="font-mono text-[11px] text-text-dim mb-4">
            {truncateAddress(wallet, 6)}
          </p>
        )}
        <div className="flex gap-3">
          <button className="flex-1 border border-green/40 text-green py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-green/10 transition-colors flex justify-center items-center gap-2">
            <ArrowDownLeft size={16} />
            Deposit
          </button>
          <button className="flex-1 border border-border text-text py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-elevated transition-colors flex justify-center items-center gap-2">
            <MaskHappy size={16} />
            Withdraw
          </button>
          <button className="flex-1 border border-border text-text-secondary py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-elevated transition-colors flex justify-center items-center gap-2">
            <Binoculars size={16} />
            Scan
          </button>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="flex flex-col gap-3">
        <h3 className="text-[10px] font-semibold text-text-muted tracking-widest uppercase px-1">
          Recent Activity
        </h3>
        {loading ? (
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-text-muted text-xs font-mono">Loading...</span>
          </div>
        ) : activity.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-3.5">
            <span className="text-text-muted text-xs font-mono">No activity yet</span>
          </div>
        ) : (
          <div className="border border-border bg-card rounded-lg flex flex-col font-mono text-sm overflow-hidden">
            {activity.map((row, i) => {
              const cls = classifyActivity(row)
              const amount = extractAmount(row)
              const isLast = i === activity.length - 1

              return (
                <div
                  key={row.id}
                  className={`flex items-center justify-between p-3 ${!isLast ? 'border-b border-border' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <cls.Icon size={14} className={`${cls.iconColor} shrink-0`} />
                    <span className="text-text-muted">{cls.label}</span>
                    {amount && (
                      <span className="text-text font-medium truncate">{amount}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-text-muted text-xs">{timeAgo(row.created_at)}</span>
                    {cls.isStealth ? (
                      <span className="text-text-muted text-xs flex items-center gap-1">
                        Stealth <CheckCircle size={12} weight="fill" className="text-text" />
                      </span>
                    ) : (
                      <span className={`${cls.statusColor} text-xs`}>{cls.statusLabel}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd ~/local-dev/sipher/app && pnpm build
```

- [ ] **Step 3: Commit**

```bash
cd ~/local-dev/sipher
git add app/src/views/VaultView.tsx
git commit -m "feat(app): vault view rewrite — real balances, new design tokens, phosphor react"
```

---

### Task 8: HeraldView Rewrite

**Files:**
- Modify: `app/src/views/HeraldView.tsx`

**Context:** Read the existing `app/src/views/HeraldView.tsx` first. Preserve all business logic (BudgetBar, SubTabs, ActivityTimeline, QueueTab, DmsTab). Replace hardcoded colors with theme tokens. Replace Phosphor CDN icons with React imports. This view is admin-only — it's already gated in App.tsx.

- [ ] **Step 1: Rewrite HeraldView.tsx**

Write `app/src/views/HeraldView.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../api/client'
import { timeAgo } from '../lib/format'

type Tab = 'activity' | 'queue' | 'dms'

interface BudgetInfo {
  spent: number
  limit: number
  gate: string
  percentage: number
}

interface ActivityEntry {
  id: string
  type: 'posted' | 'replied' | 'liked' | 'dm_handled'
  timestamp: string
  content?: string
  replyTo?: string
  engagement?: { likes: number; retweets: number; replies: number }
  action?: string
  tweetUrl?: string
}

interface QueueItem {
  id: string
  content: string
  scheduled_at?: string
  status?: string
}

interface DmEntry {
  id: string
  x_user_id?: string
  username?: string
  text?: string
  preview?: string
  intent?: string
  tool?: string
  response?: string
  resolution?: string
  action?: string
  created_at?: string
}

interface HeraldData {
  queue: QueueItem[]
  budget: BudgetInfo
  dms: DmEntry[]
  recentPosts: ActivityEntry[]
}

function BudgetBar({ budget }: { budget: BudgetInfo }) {
  const pct = Math.min(budget.percentage ?? (budget.spent / budget.limit) * 100, 100)
  const barColor = pct >= 95 ? 'bg-red' : pct >= 80 ? 'bg-yellow' : 'bg-green'

  return (
    <div className="px-4 py-3 border-b border-border shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">
          X API Budget
        </span>
        <div className="font-mono text-xs">
          <span className="text-text">${budget.spent.toFixed(2)}</span>
          <span className="text-text-muted"> / ${budget.limit}</span>
        </div>
      </div>
      <div className="w-full h-1 bg-elevated rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 text-[10px] font-mono text-text-dim">
        Gate: {budget.gate}
      </div>
    </div>
  )
}

function SubTabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'activity', label: 'Activity' },
    { id: 'queue', label: 'Queue' },
    { id: 'dms', label: 'DMs' },
  ]
  return (
    <div className="flex px-4 border-b border-border shrink-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-3 text-sm relative transition-colors ${
            active === t.id ? 'text-text font-medium' : 'text-text-muted'
          }`}
        >
          {t.label}
          {active === t.id && (
            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-herald" />
          )}
        </button>
      ))}
    </div>
  )
}

function ActivityTimeline({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return <div className="text-text-muted text-sm text-center py-10">No recent activity.</div>
  }

  return (
    <div className="relative pl-4">
      <div className="absolute left-[3px] top-2 bottom-4 w-px bg-border" />
      {entries.map((entry, i) => (
        <div key={entry.id} className={`flex gap-3 relative ${i < entries.length - 1 ? 'mb-6' : ''}`}>
          <div className="w-2 h-2 rounded-full bg-herald mt-1.5 relative z-10 ring-4 ring-bg shrink-0" />
          <div className="flex-1 min-w-0">
            {entry.type === 'posted' && (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-text">Posted</span>
                  <span className="font-mono text-[10px] text-text-muted">{timeAgo(entry.timestamp)}</span>
                </div>
                <div className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
                  <p className="text-sm text-text-secondary">{entry.content}</p>
                  {(entry.engagement || entry.tweetUrl) && (
                    <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
                      {entry.engagement && (
                        <div className="flex items-center gap-3 font-mono text-[10px] text-text-muted">
                          <span>♥ {entry.engagement.likes}</span>
                          <span>⇄ {entry.engagement.retweets}</span>
                          <span>◯ {entry.engagement.replies}</span>
                        </div>
                      )}
                      {entry.tweetUrl && (
                        <a
                          href={entry.tweetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono text-text-muted border border-border px-2 py-1 rounded bg-bg flex items-center gap-1 hover:text-text transition-colors"
                        >
                          View on X ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {entry.type === 'replied' && (
              <>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-text">Replied to</span>
                  {entry.replyTo && <span className="font-mono text-[10px] text-herald">@{entry.replyTo}</span>}
                  <span className="font-mono text-[10px] text-text-muted">{timeAgo(entry.timestamp)}</span>
                </div>
                <div className="bg-card border border-border rounded-lg p-3">
                  {entry.content && (
                    <div className="pl-2.5 border-l-2 border-border">
                      <p className="text-[13px] text-text-muted italic">{entry.content}</p>
                    </div>
                  )}
                  {entry.tweetUrl && (
                    <div className="flex justify-end mt-2">
                      <a href={entry.tweetUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-text-muted border border-border px-2 py-1 rounded bg-bg flex items-center gap-1 hover:text-text transition-colors">
                        View on X ↗
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}
            {entry.type === 'liked' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-text">Liked</span>
                  <span className="font-mono text-[10px] text-text-muted">{timeAgo(entry.timestamp)}</span>
                </div>
                <p className="text-sm text-text-muted">
                  ♥ Liked{entry.replyTo ? <> <span className="font-mono text-xs text-text">@{entry.replyTo}</span>'s post</> : ' a post'}
                  {entry.content ? ` about ${entry.content}` : ''}
                </p>
              </>
            )}
            {entry.type === 'dm_handled' && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-text">DM Handled</span>
                  <span className="font-mono text-[10px] text-text-muted">{timeAgo(entry.timestamp)}</span>
                </div>
                <div className="bg-card border border-border border-dashed rounded-lg p-3">
                  {entry.replyTo && <><span className="font-mono text-xs text-herald">@{entry.replyTo}:</span>{' '}</>}
                  <span className="text-sm text-text-muted">{entry.content}</span>
                  {entry.action && (
                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-2">→ {entry.action}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function QueueTab({ items, onAction }: { items: QueueItem[]; onAction: (id: string, action: 'approve' | 'reject') => Promise<void> }) {
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setPending((p) => ({ ...p, [id]: true }))
    try { await onAction(id, action) } finally { setPending((p) => ({ ...p, [id]: false })) }
  }

  if (items.length === 0) return <div className="text-text-muted text-sm text-center py-10">No pending posts.</div>

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
          <p className="text-sm text-text-secondary">{item.content}</p>
          <div className="flex items-center gap-2 font-mono text-[10px] text-text-muted">
            <span>{item.scheduled_at ?? '—'}</span>
          </div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => handleAction(item.id, 'approve')} disabled={pending[item.id]} className="flex-1 text-[11px] border border-green/40 text-green bg-green/10 py-1.5 rounded-lg font-medium hover:bg-green/20 transition-colors disabled:opacity-50">
              {pending[item.id] ? '...' : 'Approve'}
            </button>
            <button disabled={pending[item.id]} className="px-4 text-[11px] border border-border text-text-secondary bg-bg py-1.5 rounded-lg hover:bg-elevated transition-colors disabled:opacity-50">
              Edit
            </button>
            <button onClick={() => handleAction(item.id, 'reject')} disabled={pending[item.id]} className="px-3 border border-border text-text-muted bg-bg py-1.5 rounded-lg hover:text-red hover:border-red/30 transition-colors disabled:opacity-50" aria-label="Reject">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function DmsTab({ dms }: { dms: DmEntry[] }) {
  if (dms.length === 0) return <div className="text-text-muted text-sm text-center py-10">No recent DMs.</div>

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {dms.map((dm, i) => (
        <div key={dm.id} className={`flex flex-col p-3 ${i < dms.length - 1 ? 'border-b border-border' : ''}`}>
          <div className="flex justify-between mb-1">
            <span className="font-mono text-xs text-herald">@{dm.x_user_id ?? dm.username ?? 'unknown'}</span>
            {dm.resolution === 'resolved' ? (
              <span className="text-[9px] text-green bg-green/10 px-1.5 py-0.5 rounded border border-green/20">Resolved</span>
            ) : (
              <span className="text-[9px] text-yellow bg-yellow/10 px-1.5 py-0.5 rounded border border-yellow/20">Actioned</span>
            )}
          </div>
          <p className="text-[13px] text-text-muted mb-1">{dm.text ?? dm.preview ?? ''}</p>
          {dm.action && (
            <div className={`flex items-center gap-1.5 text-[11px] ${dm.resolution === 'resolved' ? 'text-text-muted' : 'text-herald'}`}>
              ↳ {dm.action ?? dm.tool}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function HeraldView({ token }: { token: string | null }) {
  const [tab, setTab] = useState<Tab>('activity')
  const [data, setData] = useState<HeraldData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setError(null)
    apiFetch<HeraldData>('/api/herald', { token })
      .then(setData)
      .catch((err: Error) => setError(err.message))
  }, [token])

  useEffect(() => { load() }, [load])

  const handleApprove = async (id: string, action: 'approve' | 'reject') => {
    await apiFetch(`/api/herald/approve/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action }),
      token: token!,
    })
    load()
  }

  if (!token) {
    return <div className="text-text-muted text-sm text-center py-20">Connect your wallet to view HERALD activity.</div>
  }

  const budget = data?.budget ?? { spent: 0, limit: 150, gate: 'open', percentage: 0 }

  return (
    <div className="flex flex-col h-full -mx-4 -my-5 lg:-mx-6">
      <BudgetBar budget={budget} />
      <SubTabs active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {error && (
          <div className="text-red text-xs font-mono bg-red/10 border border-red/20 rounded-lg px-3 py-2 mb-4">{error}</div>
        )}
        {!data && !error && <div className="text-text-muted text-sm text-center py-10">Loading...</div>}
        {data && tab === 'activity' && <ActivityTimeline entries={data.recentPosts ?? []} />}
        {data && tab === 'queue' && <QueueTab items={data.queue ?? []} onAction={handleApprove} />}
        {data && tab === 'dms' && <DmsTab dms={data.dms ?? []} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd ~/local-dev/sipher/app && pnpm build
```

- [ ] **Step 3: Commit**

```bash
cd ~/local-dev/sipher
git add app/src/views/HeraldView.tsx
git commit -m "feat(app): herald view rewrite — new design tokens, theme consistency"
```

---

### Task 9: SquadView Rewrite

**Files:**
- Modify: `app/src/views/SquadView.tsx`

**Context:** Read the existing `app/src/views/SquadView.tsx` first. Preserve the normalize logic and data fetching. Replace hardcoded colors with theme tokens. Replace Phosphor CDN icon classes with React imports. Replace the kill switch button icon. Remove mock data fallback for agent grid (use real API data, show loading state). Keep mock data for stats only as a fallback.

- [ ] **Step 1: Rewrite SquadView.tsx**

Write `app/src/views/SquadView.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { AGENTS, type AgentName } from '../lib/agents'
import { WarningOctagon, ArrowRight, Power } from '@phosphor-icons/react'
import AgentDot from '../components/AgentDot'

interface AgentStatus {
  id: AgentName
  statusText: string
  cost?: number | null
}

interface TodayStats {
  toolCalls: number
  walletSessions: number
  xPosts: number
  xReplies: number
  blocksScanned: number
  alerts: number
}

interface CoordEntry {
  id: string
  timestamp: string
  from: AgentName
  to: AgentName
  description: string
  codeSpan?: string
}

interface SquadRaw {
  agents: AgentStatus[] | Record<string, { status?: string }>
  stats?: TodayStats
  costs?: Record<string, number>
  coordination?: CoordEntry[]
  events?: CoordEntry[]
  killSwitch?: boolean
}

interface SquadData {
  agents: AgentStatus[]
  stats: TodayStats
  coordination: CoordEntry[]
  killSwitch: boolean
}

const DEFAULT_STATS: TodayStats = {
  toolCalls: 0,
  walletSessions: 0,
  xPosts: 0,
  xReplies: 0,
  blocksScanned: 0,
  alerts: 0,
}

function normalizeSquadData(raw: SquadRaw): SquadData {
  const agents: AgentStatus[] = Array.isArray(raw.agents)
    ? raw.agents
    : Object.entries(raw.agents ?? {}).map(([id, info]) => ({
        id: id as AgentName,
        statusText: info.status ?? 'unknown',
        cost: null,
      }))

  return {
    agents,
    stats: raw.stats ?? DEFAULT_STATS,
    coordination: raw.coordination ?? raw.events ?? [],
    killSwitch: raw.killSwitch ?? false,
  }
}

function AgentGrid({ agents }: { agents: AgentStatus[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {agents.map((a) => {
        const agent = AGENTS[a.id]
        if (!agent) return null
        return (
          <div key={a.id} className="bg-card border border-border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <AgentDot agent={a.id} size={6} />
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: agent.color }}>
                  {agent.name}
                </span>
              </div>
              <span className="text-[10px] font-mono text-text-muted">
                {a.cost != null ? `$${a.cost.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="text-[11px] text-text-muted">{a.statusText}</div>
          </div>
        )
      })}
    </div>
  )
}

function StatsGrid({ stats }: { stats: TodayStats }) {
  const items = [
    { value: stats.toolCalls.toLocaleString(), label: 'Tool calls' },
    { value: stats.walletSessions.toLocaleString(), label: 'Wallet sessions' },
    { value: stats.xPosts.toLocaleString(), label: 'X posts' },
    { value: stats.xReplies.toLocaleString(), label: 'X replies' },
    { value: stats.blocksScanned.toLocaleString(), label: 'Blocks scanned' },
    { value: stats.alerts.toLocaleString(), label: 'Alerts' },
  ]

  return (
    <section>
      <h3 className="text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-3 px-1">
        Today's Stats
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ value, label }) => (
          <div key={label} className="bg-card border border-border rounded-lg p-3">
            <div className="text-[22px] font-mono font-medium text-text leading-none mb-1">{value}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CoordLog({ entries }: { entries: CoordEntry[] }) {
  if (entries.length === 0) return null

  return (
    <section>
      <h3 className="text-[10px] font-semibold text-text-muted tracking-widest uppercase mb-3 px-1">
        Coordination (last 24h)
      </h3>
      <div className="flex flex-col gap-4">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-4">
            <div className="text-[11px] font-mono text-text-muted pt-[1px] w-[38px] shrink-0">
              {entry.timestamp}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted uppercase tracking-wider">
                <AgentDot agent={entry.from} size={5} />
                <span>{AGENTS[entry.from]?.name ?? entry.from}</span>
                <ArrowRight size={9} />
                <AgentDot agent={entry.to} size={5} />
                <span>{AGENTS[entry.to]?.name ?? entry.to}</span>
              </div>
              <div className="text-[13px] text-text">
                {entry.codeSpan ? (
                  <>
                    {entry.description.split('  ')[0]}
                    <span className="font-mono text-[12px] bg-elevated px-1 py-0.5 rounded border border-border">
                      {entry.codeSpan}
                    </span>
                    {entry.description.split('  ')[1]}
                  </>
                ) : (
                  entry.description
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function KillSwitch({ token, active, onToggle }: { token: string | null; active: boolean; onToggle: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = async () => {
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/api/squad/kill', { method: 'POST', token })
      onToggle()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleToggle}
        disabled={busy || !token}
        className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 border rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          active
            ? 'border-green/30 text-green hover:bg-green/10'
            : 'border-red/30 text-red hover:bg-red/10 hover:border-red'
        }`}
      >
        {active ? <Power size={18} /> : <WarningOctagon size={18} />}
        <span className="text-sm font-semibold tracking-wide">
          {busy ? (active ? 'Resuming...' : 'Pausing...') : active ? 'Resume Operations' : 'Pause All Vault Ops'}
        </span>
      </button>
      {error && (
        <div className="mt-2 text-red text-xs font-mono bg-red/10 border border-red/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
    </div>
  )
}

export default function SquadView({ token }: { token: string | null }) {
  const [data, setData] = useState<SquadData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setError(null)
    apiFetch<SquadRaw>('/api/squad', { token })
      .then((raw) => setData(normalizeSquadData(raw)))
      .catch((err: Error) => setError(err.message))
  }, [token])

  useEffect(() => { load() }, [load])

  if (!data && !error) {
    return <div className="text-text-muted text-sm text-center py-20">Loading squad data...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="text-text-muted text-xs font-mono bg-card border border-border rounded-lg px-3 py-2">
          Live data unavailable — {error}
        </div>
      )}
      {data && (
        <>
          <AgentGrid agents={data.agents} />
          <StatsGrid stats={data.stats} />
          <CoordLog entries={data.coordination} />
          <KillSwitch
            token={token}
            active={data.killSwitch}
            onToggle={() => setData((d) => d ? { ...d, killSwitch: !d.killSwitch } : d)}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd ~/local-dev/sipher/app && pnpm build
```

- [ ] **Step 3: Commit**

```bash
cd ~/local-dev/sipher
git add app/src/views/SquadView.tsx
git commit -m "feat(app): squad view rewrite — new tokens, real data, toggle kill switch"
```

---

### Task 10: Cleanup & Build Verification

**Files:**
- Delete: `app/src/hooks/useApi.ts` (if unused)
- Verify: all remaining files compile cleanly

- [ ] **Step 1: Check for any remaining CDN icon references**

```bash
cd ~/local-dev/sipher/app && grep -rn 'className="ph ' src/ || echo "No CDN icon references found"
```

If any `ph ph-` or `ph-fill ph-` class references remain, replace them with Phosphor React component imports.

- [ ] **Step 2: Check for remaining hardcoded colors**

```bash
cd ~/local-dev/sipher/app && grep -rn '#0A0A0B\|#141416\|#F5F5F5' src/ || echo "No old colors found"
```

The old theme colors (#0A0A0B, #141416, #F5F5F5) should be replaced with theme tokens (`bg-bg`, `bg-card`, `text-text`). Fix any remaining references.

- [ ] **Step 3: Delete unused files**

Check if `app/src/hooks/useApi.ts` is imported anywhere:

```bash
grep -rn 'useApi' ~/local-dev/sipher/app/src/ || echo "useApi not used"
```

If not used, delete it:

```bash
rm ~/local-dev/sipher/app/src/hooks/useApi.ts
```

- [ ] **Step 4: Full build verification**

```bash
cd ~/local-dev/sipher/app && pnpm build
```

Expected: Build succeeds with zero errors. The `dist/` output should be generated.

- [ ] **Step 5: Type check**

```bash
cd ~/local-dev/sipher && pnpm typecheck
```

Or if typecheck script doesn't exist in root:

```bash
cd ~/local-dev/sipher/app && npx tsc --noEmit
```

Expected: Zero type errors.

- [ ] **Step 6: Run backend tests to verify no regressions**

```bash
cd ~/local-dev/sipher && pnpm test -- --run
```

Expected: All 497 tests pass.

- [ ] **Step 7: Commit cleanup**

```bash
cd ~/local-dev/sipher
git add -A app/src/
git commit -m "chore(app): cleanup — remove old files, fix remaining color refs"
```

---

## Execution Notes

- **Task order:** Tasks 1-3 are foundational. Task 4 depends on Tasks 1-2. Task 5 depends on Task 2. Tasks 6-9 depend on Tasks 1-4. Task 10 is final cleanup.
- **Parallel candidates:** Tasks 2 and 3 can run in parallel (frontend store vs backend change). Tasks 7, 8, 9 can run in parallel (independent view rewrites — each is a separate file).
- **Build may fail between tasks** — that's expected during a rewrite. Each task should produce a building codebase by its final step.
- **Agent colors are NOT changing** — SIPHER=#10B981 (green), HERALD=#3B82F6 (blue), SENTINEL=#F59E0B (yellow), COURIER=#8B5CF6 (purple). The design spec's activity stream color mapping in the spec was misleading — ignore it, keep existing colors.
- **Privacy score** shows "—" in v1 dashboard — there's no REST endpoint for it. Users ask SIPHER in chat.
- **No test infrastructure** in app/ — verification is `pnpm build` + `tsc --noEmit`.
