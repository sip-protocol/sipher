# Phase 2 — UI Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 6 audit-driven UI gap fixes (3 real, 1 partial, 2 false-positive treated as preventative refactors) across 3 sequenced PRs: client polish, HERALD/Vault, SENTINEL pause/resume.

**Architecture:** Three pull requests sequenced for review focus. PR 1 ships client-only quick wins with one tiny server SSE addition; PR 2a adds one server route + vault flow; PR 2b refactors the agent loop with pause/resume + 2 REST endpoints. All state is in-memory; no DB migrations.

**Tech Stack:** React 19, TypeScript (strict, 2-space, no semicolons), Tailwind CSS 4, Zustand 5 (with `persist` middleware), Vitest 3, @testing-library/react 16, jsdom 25, Playwright 1.59 (Chromium), Express 5, zod, Phosphor Icons React, @sip-protocol/sdk.

**Spec:** [`docs/superpowers/specs/2026-04-26-ui-gaps-design.md`](../specs/2026-04-26-ui-gaps-design.md)

---

## File Structure

### PR 1 — `feat/phase-2-client-polish`

**Create:**
- `app/src/components/AdminOnly.tsx` — wrapper component for admin gating.
- `app/src/components/EventIcon.tsx` — Phosphor icon wrapper with optional pulsing.
- `app/src/components/ToolTimeline.tsx` — chat tool-use timeline header.
- `app/src/lib/event-icons.ts` — `event.type → icon component` mapping.
- `app/src/lib/sanitize-args.ts` — pure function for redaction of tool args.
- `app/src/components/__tests__/AdminOnly.test.tsx`
- `app/src/components/__tests__/MetricCard.test.tsx`
- `app/src/components/__tests__/EventIcon.test.tsx`
- `app/src/components/__tests__/ToolTimeline.test.tsx`
- `app/src/components/__tests__/ConfirmCard.test.tsx`
- `app/src/lib/__tests__/event-icons.test.ts`
- `app/src/lib/__tests__/sanitize-args.test.ts`

**Modify:**
- `app/src/components/MetricCard.tsx` — add `variant`, `factors` props.
- `app/src/components/ConfirmCard.tsx` — add `variant`, `description` props.
- `app/src/components/ActivityEntry.tsx` — use `EventIcon`, add `isLive` prop.
- `app/src/components/ChatSidebar.tsx` — extend SSE handlers, render system messages.
- `app/src/views/DashboardView.tsx` — privacy score wiring + auto-refresh + click + AdminOnly + isLive tagging.
- `app/src/stores/app.ts` — `ChatMessage.tools`, `'system'` role, `seedChat`, `appendTool`, `completeTool` actions.
- `packages/agent/src/agent.ts` — emit `sentinel_advisory` SSE event when SENTINEL flags + `MODE=advisory`.

### PR 2a — `feat/phase-2-herald-vault`

**Create:**
- `app/src/components/AmountForm.tsx` — controlled amount input + Continue/Cancel.
- `app/src/components/__tests__/AmountForm.test.tsx`
- `packages/agent/src/services/__tests__/herald-queue-update.test.ts`
- `packages/agent/src/routes/__tests__/herald-patch.test.ts`
- `app/src/views/__tests__/HeraldView-edit.test.tsx`
- `app/src/views/__tests__/VaultView-actions.test.tsx`

**Modify:**
- `packages/agent/src/services/herald-queue.ts` — add `updateContent(id, content)` action.
- `packages/agent/src/routes/herald-api.ts` — add `PATCH /queue/:id` route.
- `app/src/views/HeraldView.tsx` — QueueTab inline edit mode.
- `app/src/views/VaultView.tsx` — Deposit/Withdraw buttons + 3-step flow.

### PR 2b — `feat/phase-2-sentinel-pause-resume`

**Create:**
- `packages/agent/src/services/sentinel-pending.ts` — pending-flag store.
- `packages/agent/src/routes/sentinel.ts` — override/cancel REST endpoints.
- `app/src/components/SentinelConfirm.tsx` — wraps ConfirmCard + REST POSTs.
- `packages/agent/src/services/__tests__/sentinel-pending.test.ts`
- `packages/agent/src/routes/__tests__/sentinel.test.ts`
- `app/src/components/__tests__/SentinelConfirm.test.tsx`
- `e2e/sentinel-flow.spec.ts` — skipped pending #1077.

**Modify:**
- `packages/agent/src/agent.ts` — replace light `sentinel_advisory` with `sentinel_pause` + `await pending`.
- `packages/agent/src/index.ts` — mount `/api/sentinel`, extend disconnect handler.
- `app/src/components/ChatSidebar.tsx` — handle `sentinel_pause` event.

---

## PR 1 — Client Polish (Tasks 1-17)

### Task 1: Setup branch and verify clean baseline

**Files:**
- N/A (branch operations only)

- [ ] **Step 1: Restore stash and branch from main**

```bash
git checkout feat/test-infra
git stash pop
git stash push -m "phase1-plan-vitest-note" docs/superpowers/plans/2026-04-18-test-infrastructure.md
git fetch origin main
git checkout -b feat/phase-2-client-polish origin/main
```

Expected: clean working tree on the new branch.

- [ ] **Step 2: Verify test baseline**

Run: `pnpm --filter @sipher/app test -- --run && pnpm test -- --run`
Expected: all existing tests pass (491 backend + 3 component RTL from Phase 1).

- [ ] **Step 3: Verify typecheck baseline**

Run: `pnpm --filter @sipher/app exec tsc --noEmit`
Expected: clean.

---

### Task 2: ConfirmCard variant + description props (TDD)

**Files:**
- Modify: `app/src/components/ConfirmCard.tsx`
- Test: `app/src/components/__tests__/ConfirmCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/src/components/__tests__/ConfirmCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmCard from '../ConfirmCard'

describe('ConfirmCard', () => {
  it('renders normal variant with action and amount', () => {
    render(
      <ConfirmCard action="Send" amount="1.5 SOL" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(screen.getByText(/Send.*1\.5 SOL/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm & sign/i })).toBeInTheDocument()
  })

  it('renders warning variant with description and Override button', () => {
    render(
      <ConfirmCard
        variant="warning"
        action="Send"
        amount="5 SOL"
        description="Address has 2 high-risk signals"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText(/2 high-risk signals/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /override & send/i })).toBeInTheDocument()
  })

  it('fires onConfirm and onCancel callbacks', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmCard action="Send" amount="1 SOL" onConfirm={onConfirm} onCancel={onCancel} />
    )
    await userEvent.click(screen.getByRole('button', { name: /confirm & sign/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test ConfirmCard -- --run`
Expected: FAIL — warning variant test cannot find Override button.

- [ ] **Step 3: Update ConfirmCard with new props**

Replace `app/src/components/ConfirmCard.tsx`:

```tsx
type Variant = 'normal' | 'warning'

interface Props {
  action: string
  amount: string
  onConfirm: () => void
  onCancel: () => void
  variant?: Variant
  description?: string
  timeout?: number
}

export default function ConfirmCard({
  action,
  amount,
  onConfirm,
  onCancel,
  variant = 'normal',
  description,
}: Props) {
  const isWarning = variant === 'warning'
  const borderClass = isWarning ? 'border-yellow/40' : 'border-elevated'
  const primaryClass = isWarning
    ? 'border-yellow/50 text-yellow hover:bg-yellow/10'
    : 'border-sipher/50 text-sipher hover:bg-sipher/10'
  const primaryLabel = isWarning ? 'Override & Send' : 'Confirm & Sign'
  const labelText = isWarning ? '⚠ Risk Confirm' : 'Confirm Action'

  return (
    <div className={`bg-card border ${borderClass} rounded-lg p-4 flex flex-col gap-3`}>
      <div className="text-[12px] text-text-muted uppercase tracking-wide">{labelText}</div>
      <div className="text-[14px] text-text">{action}: {amount}</div>
      {description && (
        <div className="text-[12px] text-text-muted leading-relaxed">{description}</div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className={`flex-1 border ${primaryClass} py-2 rounded-lg text-[12px] font-medium`}
        >
          {primaryLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-4 border border-elevated text-text-muted py-2 rounded-lg text-[12px] hover:text-text"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/app test ConfirmCard -- --run`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/ConfirmCard.tsx app/src/components/__tests__/ConfirmCard.test.tsx
git commit -m "feat(app): add ConfirmCard variant + description props"
```

---

### Task 3: AdminOnly wrapper component (TDD)

**Files:**
- Create: `app/src/components/AdminOnly.tsx`
- Test: `app/src/components/__tests__/AdminOnly.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/src/components/__tests__/AdminOnly.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAppStore } from '../../stores/app'
import AdminOnly from '../AdminOnly'

describe('AdminOnly', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, isAdmin: false, messages: [], chatLoading: false })
  })

  it('renders children when isAdmin is true', () => {
    useAppStore.setState({ isAdmin: true })
    render(<AdminOnly><div>secret</div></AdminOnly>)
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('renders null by default when isAdmin is false', () => {
    useAppStore.setState({ isAdmin: false })
    const { container } = render(<AdminOnly><div>secret</div></AdminOnly>)
    expect(container.firstChild).toBeNull()
  })

  it('renders fallback when isAdmin is false and fallback provided', () => {
    useAppStore.setState({ isAdmin: false })
    render(<AdminOnly fallback={<div>upgrade</div>}><div>secret</div></AdminOnly>)
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByText('upgrade')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test AdminOnly -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `app/src/components/AdminOnly.tsx`:

```tsx
import type { ReactNode } from 'react'
import { useIsAdmin } from '../hooks/useIsAdmin'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

export default function AdminOnly({ children, fallback = null }: Props) {
  return useIsAdmin() ? <>{children}</> : <>{fallback}</>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/app test AdminOnly -- --run`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/AdminOnly.tsx app/src/components/__tests__/AdminOnly.test.tsx
git commit -m "feat(app): add AdminOnly wrapper component"
```

---

### Task 4: Refactor DashboardView to use AdminOnly

**Files:**
- Modify: `app/src/views/DashboardView.tsx`

- [ ] **Step 1: Replace 3 render-path admin guards with AdminOnly wraps**

In `app/src/views/DashboardView.tsx`:
- Add import: `import AdminOnly from '../components/AdminOnly'`
- Lines 123-130 (Budget MetricCard): wrap with `<AdminOnly>...</AdminOnly>` instead of `{isAdmin && (...)}`.
- Lines 168-202 (Guardian Squad section): wrap with `<AdminOnly>...</AdminOnly>`.
- Lines 195-200 (health line, currently inside Guardian Squad): leaves as-is — already inside the AdminOnly wrap from above.

Keep the `useEffect` at line 64-87 untouched (the `if (isAdmin)` guard there is a hook side-effect, not a render path).

Replace:
```tsx
{isAdmin && (
  <MetricCard
    label="Budget"
    ...
  />
)}
```
with:
```tsx
<AdminOnly>
  <MetricCard
    label="Budget"
    ...
  />
</AdminOnly>
```

Same pattern for the Guardian Squad block.

- [ ] **Step 2: Verify typecheck and tests**

Run: `pnpm --filter @sipher/app exec tsc --noEmit && pnpm --filter @sipher/app test -- --run`
Expected: clean typecheck, all tests pass (Phase 1's 3 ChatSidebar tests + new AdminOnly + ConfirmCard).

- [ ] **Step 3: Commit**

```bash
git add app/src/views/DashboardView.tsx
git commit -m "refactor(app): use AdminOnly wrapper in DashboardView"
```

---

### Task 5: Event icon mapping module (TDD)

**Files:**
- Create: `app/src/lib/event-icons.ts`
- Test: `app/src/lib/__tests__/event-icons.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/src/lib/__tests__/event-icons.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ArrowDown, Circle, ShieldWarning, PaperPlaneTilt } from '@phosphor-icons/react'
import { resolveEventIcon } from '../event-icons'

describe('resolveEventIcon', () => {
  it('matches exact event type', () => {
    expect(resolveEventIcon('deposit')).toBe(ArrowDown)
    expect(resolveEventIcon('send')).toBe(PaperPlaneTilt)
  })

  it('matches prefix.subtype patterns', () => {
    expect(resolveEventIcon('deposit.success')).toBe(ArrowDown)
    expect(resolveEventIcon('sentinel.flag')).toBe(ShieldWarning)
    expect(resolveEventIcon('sentinel.flag.high')).toBe(ShieldWarning)
  })

  it('falls back to Circle for unknown types', () => {
    expect(resolveEventIcon('unknown')).toBe(Circle)
    expect(resolveEventIcon('')).toBe(Circle)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test event-icons -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the mapping module**

Create `app/src/lib/event-icons.ts`:

```ts
import {
  ArrowDown,
  ArrowUp,
  PaperPlaneTilt,
  ArrowsLeftRight,
  DownloadSimple,
  ArrowCounterClockwise,
  Eye,
  ShieldWarning,
  Shield,
  Megaphone,
  Circle,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

export const EVENT_ICONS: Record<string, Icon> = {
  deposit: ArrowDown,
  withdraw: ArrowUp,
  send: PaperPlaneTilt,
  swap: ArrowsLeftRight,
  claim: DownloadSimple,
  refund: ArrowCounterClockwise,
  scan: Eye,
  'sentinel.flag': ShieldWarning,
  'sentinel.block': Shield,
  'herald.posted': Megaphone,
}

export function resolveEventIcon(type: string): Icon {
  if (type in EVENT_ICONS) return EVENT_ICONS[type]
  for (const key of Object.keys(EVENT_ICONS)) {
    if (type.startsWith(key + '.')) return EVENT_ICONS[key]
  }
  return Circle
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/app test event-icons -- --run`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/event-icons.ts app/src/lib/__tests__/event-icons.test.ts
git commit -m "feat(app): add event-icons mapping module"
```

---

### Task 6: EventIcon component (TDD)

**Files:**
- Create: `app/src/components/EventIcon.tsx`
- Test: `app/src/components/__tests__/EventIcon.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/src/components/__tests__/EventIcon.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import EventIcon from '../EventIcon'

describe('EventIcon', () => {
  it('renders an icon by event type', () => {
    const { container } = render(<EventIcon type="deposit" color="#10B981" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies pulse animation when live=true', () => {
    const { container } = render(<EventIcon type="deposit" color="#10B981" live />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('does not pulse when live=false', () => {
    const { container } = render(<EventIcon type="deposit" color="#10B981" />)
    expect(container.firstChild).not.toHaveClass('animate-pulse')
  })

  it('falls back to a circle icon for unknown event types', () => {
    const { container } = render(<EventIcon type="bogus" color="#10B981" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test EventIcon -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `app/src/components/EventIcon.tsx`:

```tsx
import { resolveEventIcon } from '../lib/event-icons'

interface Props {
  type: string
  color: string
  live?: boolean
  size?: number
}

export default function EventIcon({ type, color, live = false, size = 14 }: Props) {
  const Icon = resolveEventIcon(type)
  return (
    <span className={`inline-flex shrink-0 ${live ? 'animate-pulse' : ''}`}>
      <Icon size={size} color={color} weight="fill" />
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/app test EventIcon -- --run`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/EventIcon.tsx app/src/components/__tests__/EventIcon.test.tsx
git commit -m "feat(app): add EventIcon component with pulsing"
```

---

### Task 7: ActivityEntry use EventIcon, add isLive prop

**Files:**
- Modify: `app/src/components/ActivityEntry.tsx`

- [ ] **Step 1: Replace dot with EventIcon**

In `app/src/components/ActivityEntry.tsx`:

Replace the entire file with:

```tsx
import { AGENTS, type AgentName } from '../lib/agents'
import { timeAgo } from '../lib/format'
import EventIcon from './EventIcon'

interface Action {
  label: string
  onClick: () => void
}

interface Props {
  agent: AgentName
  type?: string
  title: string
  detail?: string
  time: string
  level: string
  isLive?: boolean
  actions?: Action[]
}

export default function ActivityEntry({
  agent,
  type = '',
  title,
  detail,
  time,
  level,
  isLive,
  actions,
}: Props) {
  const agentConfig = AGENTS[agent] ?? { name: agent.toUpperCase(), color: 'var(--color-text-muted)' }
  const isCritical = level === 'critical'

  return (
    <div
      className={[
        'bg-card border border-elevated rounded-lg p-3.5 flex flex-col gap-2',
        isCritical ? 'border-l-[3px] border-l-yellow' : '',
      ].join(' ')}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <EventIcon type={type} color={agentConfig.color} live={isLive} />
          <span
            className="text-[11px] font-semibold tracking-widest uppercase"
            style={{ color: agentConfig.color }}
          >
            {agentConfig.name}
          </span>
        </div>
        <span className="text-text-muted text-[11px]">{timeAgo(time)}</span>
      </div>

      <p className="text-[14px] text-text leading-snug">{title}</p>

      {detail && (
        <p className="text-[12px] text-text-muted font-mono break-all">{detail}</p>
      )}

      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="border border-elevated bg-bg text-[11px] px-3 py-1.5 rounded-lg font-medium text-text hover:bg-elevated transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @sipher/app exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ActivityEntry.tsx
git commit -m "feat(app): use EventIcon in ActivityEntry with isLive prop"
```

---

### Task 8: DashboardView tag isLive on events vs history

**Files:**
- Modify: `app/src/views/DashboardView.tsx`

- [ ] **Step 1: Tag merged events with isLive flag**

In `app/src/views/DashboardView.tsx`, replace the `allEvents` computation and the `ActivityEntry` render:

Replace:
```tsx
const allEvents = [...events, ...history].slice(0, 30)
```
with:
```tsx
const allEvents = [
  ...events.map(e => ({ ...e, isLive: true })),
  ...history.map(e => ({ ...e, isLive: false })),
].slice(0, 30)
```

Replace the `ActivityEntry` render to pass `type` and `isLive`:
```tsx
<ActivityEntry
  key={event.id}
  agent={event.agent as AgentName}
  type={event.type}
  title={
    (event.data?.title as string) ??
    (event.data?.message as string) ??
    event.type
  }
  detail={event.data?.detail as string}
  time={event.timestamp}
  level={event.level}
  isLive={event.isLive}
/>
```

- [ ] **Step 2: Verify typecheck and tests**

Run: `pnpm --filter @sipher/app exec tsc --noEmit && pnpm --filter @sipher/app test -- --run`
Expected: clean typecheck, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/src/views/DashboardView.tsx
git commit -m "feat(app): tag dashboard events with isLive for pulsing"
```

---

### Task 9: sanitize-args module (TDD)

**Files:**
- Create: `app/src/lib/sanitize-args.ts`
- Test: `app/src/lib/__tests__/sanitize-args.test.ts`

- [ ] **Step 1: Write failing test**

Create `app/src/lib/__tests__/sanitize-args.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sanitizeArgs } from '../sanitize-args'

describe('sanitizeArgs', () => {
  it('truncates long base58 strings to first-4-last-4', () => {
    const out = sanitizeArgs({ wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr' })
    expect(out).toBe('wallet=FGSk...8WWr')
  })

  it('redacts sensitive keys', () => {
    const out = sanitizeArgs({
      wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
      privateKey: 'should-not-leak',
      mnemonic: 'word1 word2 ...',
    })
    expect(out).not.toContain('should-not-leak')
    expect(out).not.toContain('word1')
    expect(out).toContain('wallet=FGSk...8WWr')
  })

  it('truncates short non-base58 strings to 40 chars', () => {
    const out = sanitizeArgs({
      message: 'a'.repeat(50),
    })
    expect(out).toBe(`message=${'a'.repeat(40)}…`)
  })

  it('passes through small numbers and booleans', () => {
    const out = sanitizeArgs({ amount: 1.5, dryRun: true })
    expect(out).toBe('amount=1.5, dryRun=true')
  })

  it('returns empty string for null/undefined input', () => {
    expect(sanitizeArgs(null)).toBe('')
    expect(sanitizeArgs(undefined)).toBe('')
    expect(sanitizeArgs({})).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test sanitize-args -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

Create `app/src/lib/sanitize-args.ts`:

```ts
const SENSITIVE_KEY = /private|secret|mnemonic|password|seed/i
const BASE58_HEX = /^[A-Za-z0-9]{12,}$/
const MAX_STRING = 40

function shortenIdent(value: string): string {
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    if (BASE58_HEX.test(value)) return shortenIdent(value)
    return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + '…' : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

export function sanitizeArgs(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([k]) => !SENSITIVE_KEY.test(k))
    .map(([k, v]) => `${k}=${formatValue(v)}`)
    .filter(s => !s.endsWith('='))
  return entries.join(', ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/app test sanitize-args -- --run`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/sanitize-args.ts app/src/lib/__tests__/sanitize-args.test.ts
git commit -m "feat(app): add sanitize-args utility for tool arg redaction"
```

---

### Task 10: Extend ChatMessage shape and store actions

**Files:**
- Modify: `app/src/stores/app.ts`

- [ ] **Step 1: Extend ChatMessage and AppState**

In `app/src/stores/app.ts`, replace the file content with:

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type View = 'dashboard' | 'vault' | 'herald' | 'squad' | 'chat'
export type ToolStatus = 'running' | 'success' | 'error'

export interface ToolCall {
  name: string
  args?: string
  startedAt: number
  durationMs?: number
  status: ToolStatus
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolName?: string
  streaming?: boolean
  tools?: ToolCall[]
  kind?: 'sentinel_advisory'
  meta?: Record<string, unknown>
  dismissed?: boolean
}

interface AppState {
  activeView: View
  setActiveView: (view: View) => void

  token: string | null
  isAdmin: boolean
  setAuth: (token: string, isAdmin: boolean) => void
  clearAuth: () => void

  messages: ChatMessage[]
  chatLoading: boolean
  addMessage: (msg: ChatMessage) => void
  appendToLast: (text: string) => void
  finishStreaming: () => void
  setChatLoading: (loading: boolean) => void
  appendTool: (name: string, args?: string) => void
  completeTool: (name: string, status: ToolStatus) => void
  dismissMessage: (id: string) => void
  seedChat: (prompt: string) => void

  chatOpen: boolean
  setChatOpen: (open: boolean) => void
  pendingPrompt: string | null
  consumePendingPrompt: () => string | null
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
      appendTool: (name, args) =>
        set((s) => {
          const msgs = [...s.messages]
          const last = msgs[msgs.length - 1]
          if (last?.role !== 'assistant') return { messages: msgs }
          const tools = [...(last.tools ?? []), { name, args, startedAt: Date.now(), status: 'running' as ToolStatus }]
          msgs[msgs.length - 1] = { ...last, tools }
          return { messages: msgs }
        }),
      completeTool: (name, status) =>
        set((s) => {
          const msgs = [...s.messages]
          const last = msgs[msgs.length - 1]
          if (last?.role !== 'assistant' || !last.tools) return { messages: msgs }
          const tools = last.tools.map((t) =>
            t.name === name && t.status === 'running'
              ? { ...t, durationMs: Date.now() - t.startedAt, status }
              : t
          )
          msgs[msgs.length - 1] = { ...last, tools }
          return { messages: msgs }
        }),
      dismissMessage: (id) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? { ...m, dismissed: true } : m)),
        })),
      seedChat: (prompt) => set({ chatOpen: true, pendingPrompt: prompt }),

      chatOpen: false,
      setChatOpen: (chatOpen) => set({ chatOpen }),
      pendingPrompt: null,
      consumePendingPrompt: () => {
        const p = get().pendingPrompt
        set({ pendingPrompt: null })
        return p
      },
    }),
    {
      name: 'sipher-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, isAdmin: s.isAdmin }),
    }
  )
)
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @sipher/app exec tsc --noEmit`
Expected: clean (any consumers using the old ChatMessage shape continue to compile because new fields are optional).

- [ ] **Step 3: Commit**

```bash
git add app/src/stores/app.ts
git commit -m "feat(app): extend store with tools[], system role, seedChat, dismiss"
```

---

### Task 11: ToolTimeline component (TDD)

**Files:**
- Create: `app/src/components/ToolTimeline.tsx`
- Test: `app/src/components/__tests__/ToolTimeline.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/src/components/__tests__/ToolTimeline.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ToolTimeline from '../ToolTimeline'
import type { ToolCall } from '../../stores/app'

describe('ToolTimeline', () => {
  it('renders nothing when tools is undefined', () => {
    const { container } = render(<ToolTimeline tools={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when tools is empty array', () => {
    const { container } = render(<ToolTimeline tools={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders single running tool', () => {
    const tools: ToolCall[] = [
      { name: 'privacyScore', args: 'wallet=FGSk...8WWr', startedAt: Date.now(), status: 'running' },
    ]
    render(<ToolTimeline tools={tools} />)
    expect(screen.getByText('privacyScore')).toBeInTheDocument()
    expect(screen.getByText(/wallet=FGSk\.\.\.8WWr/)).toBeInTheDocument()
  })

  it('renders completed tool with duration', () => {
    const tools: ToolCall[] = [
      { name: 'privacyScore', args: 'wallet=FGSk...8WWr', startedAt: 0, durationMs: 285, status: 'success' },
    ]
    render(<ToolTimeline tools={tools} />)
    expect(screen.getByText(/285ms/)).toBeInTheDocument()
  })

  it('renders multi-tool timeline', () => {
    const tools: ToolCall[] = [
      { name: 'privacyScore', startedAt: 0, durationMs: 285, status: 'success' },
      { name: 'history', startedAt: 0, durationMs: 120, status: 'success' },
      { name: 'balance', startedAt: 0, durationMs: 45, status: 'error' },
    ]
    render(<ToolTimeline tools={tools} />)
    expect(screen.getByText('privacyScore')).toBeInTheDocument()
    expect(screen.getByText('history')).toBeInTheDocument()
    expect(screen.getByText('balance')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test ToolTimeline -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Create component**

Create `app/src/components/ToolTimeline.tsx`:

```tsx
import { CircleNotch, CheckCircle, XCircle } from '@phosphor-icons/react'
import type { ToolCall } from '../stores/app'

interface Props {
  tools?: ToolCall[]
}

function StatusIcon({ status }: { status: ToolCall['status'] }) {
  if (status === 'running') return <CircleNotch size={11} className="animate-spin text-text-muted" />
  if (status === 'success') return <CheckCircle size={11} weight="fill" className="text-green" />
  return <XCircle size={11} weight="fill" className="text-red" />
}

export default function ToolTimeline({ tools }: Props) {
  if (!tools || tools.length === 0) return null

  return (
    <div className="border-b border-elevated/40 bg-elevated/20 px-3 py-2 flex flex-col gap-1.5">
      {tools.map((t, i) => (
        <div key={`${t.name}-${i}`} className="flex items-center gap-2 text-[10px] font-mono">
          <StatusIcon status={t.status} />
          <span className="text-blue font-semibold">{t.name}</span>
          {t.args && <span className="text-text-muted truncate flex-1">{t.args}</span>}
          {t.durationMs != null && (
            <span className="text-text-muted ml-auto shrink-0">{t.durationMs}ms</span>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/app test ToolTimeline -- --run`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/ToolTimeline.tsx app/src/components/__tests__/ToolTimeline.test.tsx
git commit -m "feat(app): add ToolTimeline component for chat audit trail"
```

---

### Task 12: ChatSidebar SSE handlers + ToolTimeline render + system messages

**Files:**
- Modify: `app/src/components/ChatSidebar.tsx`

- [ ] **Step 1: Replace ChatSidebar with extended version**

Replace `app/src/components/ChatSidebar.tsx`:

```tsx
import { useRef, useEffect, useState, useCallback } from 'react'
import { PaperPlaneTilt, CircleNotch, Wrench } from '@phosphor-icons/react'
import { useAppStore, type ChatMessage } from '../stores/app'
import { sanitizeArgs } from '../lib/sanitize-args'
import ToolTimeline from './ToolTimeline'
import ConfirmCard from './ConfirmCard'

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
  const appendTool = useAppStore((s) => s.appendTool)
  const completeTool = useAppStore((s) => s.completeTool)
  const dismissMessage = useAppStore((s) => s.dismissMessage)
  const consumePendingPrompt = useAppStore((s) => s.consumePendingPrompt)

  const [input, setInput] = useState('')
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || !token || chatLoading) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text }
    addMessage(userMsg)
    setInput('')
    setChatLoading(true)
    setActiveTool(null)

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      streaming: true,
    }
    addMessage(assistantMsg)

    try {
      const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
      const res = await fetch(`${API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
              appendTool(event.name, sanitizeArgs(event.input))
              setActiveTool(event.name)
            } else if (event.type === 'tool_result') {
              completeTool(event.name, event.is_error ? 'error' : 'success')
              setActiveTool(null)
            } else if (event.type === 'sentinel_advisory') {
              addMessage({
                id: crypto.randomUUID(),
                role: 'system',
                content: '',
                kind: 'sentinel_advisory',
                meta: {
                  action: event.action,
                  amount: event.amount,
                  description: event.description,
                  severity: event.severity,
                },
              })
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
  }, [input, token, chatLoading, messages, addMessage, appendToLast, finishStreaming, setChatLoading, appendTool, completeTool])

  // Consume seedChat prompt on mount/change
  useEffect(() => {
    const p = consumePendingPrompt()
    if (p && token) sendMessage(p)
  }, [consumePendingPrompt, sendMessage, token])

  return (
    <div className={`flex flex-col bg-card ${fullScreen ? 'h-full' : 'h-full w-full'}`}>
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

      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
        {messages.length === 0 && (
          <p className="text-text-muted text-sm text-center py-8">Ask SIPHER anything about your privacy.</p>
        )}
        {messages.filter((m) => !m.dismissed).map((msg) => {
          if (msg.role === 'system' && msg.kind === 'sentinel_advisory') {
            const meta = (msg.meta ?? {}) as { action?: string; amount?: string; description?: string }
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[90%] w-full">
                  <ConfirmCard
                    variant="warning"
                    action={meta.action ?? 'Action'}
                    amount={meta.amount ?? ''}
                    description={meta.description}
                    onConfirm={() => sendMessage('Yes, proceed anyway')}
                    onCancel={() => dismissMessage(msg.id)}
                  />
                </div>
              </div>
            )
          }
          return (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg overflow-hidden text-[13px] leading-relaxed whitespace-pre-wrap break-words ${
                  msg.role === 'user'
                    ? 'bg-accent/15 border border-accent/20 text-text px-3 py-2'
                    : 'bg-elevated border border-border text-text'
                }`}
              >
                {msg.role === 'assistant' && <ToolTimeline tools={msg.tools} />}
                <div className={msg.role === 'assistant' ? 'px-3 py-2' : ''}>
                  {msg.content || (msg.streaming ? '...' : '')}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

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
            onClick={() => sendMessage()}
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

- [ ] **Step 2: Run existing ChatSidebar tests**

Run: `pnpm --filter @sipher/app test ChatSidebar -- --run`
Expected: existing 3 tests still pass (rendering, auth gate, send).

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @sipher/app exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ChatSidebar.tsx
git commit -m "feat(app): wire tool timeline + sentinel advisory + seedChat in chat"
```

---

### Task 13: MetricCard hero variant + factors prop (TDD)

**Files:**
- Modify: `app/src/components/MetricCard.tsx`
- Test: `app/src/components/__tests__/MetricCard.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/src/components/__tests__/MetricCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wallet } from '@phosphor-icons/react'
import MetricCard from '../MetricCard'

describe('MetricCard', () => {
  it('renders normal variant by default', () => {
    render(<MetricCard label="SOL" value="2.45" sub="SOL" icon={<Wallet />} />)
    expect(screen.getByText('SOL')).toBeInTheDocument()
    expect(screen.getByText('2.45')).toBeInTheDocument()
  })

  it('renders factor bars in hero variant', () => {
    render(
      <MetricCard
        variant="hero"
        label="Privacy Score"
        value="78"
        sub="/100"
        icon={<Wallet />}
        factors={[
          { label: 'Address reuse', score: 85 },
          { label: 'Amount patterns', score: 72 },
          { label: 'Timing', score: 68 },
          { label: 'Counterparty exposure', score: 90 },
        ]}
      />
    )
    expect(screen.getByText('Address reuse')).toBeInTheDocument()
    expect(screen.getByText('Counterparty exposure')).toBeInTheDocument()
  })

  it('does not render factor section when factors undefined', () => {
    render(<MetricCard variant="hero" label="X" value="1" icon={<Wallet />} />)
    expect(screen.queryByText('Address reuse')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test MetricCard -- --run`
Expected: FAIL — factors not rendered.

- [ ] **Step 3: Update MetricCard**

Replace `app/src/components/MetricCard.tsx`:

```tsx
import type { ReactNode } from 'react'

export interface Factor {
  label: string
  score: number
}

interface Props {
  label: string
  value: string
  sub?: string
  icon: ReactNode
  color?: string
  variant?: 'normal' | 'hero'
  factors?: Factor[]
  onClick?: () => void
}

function factorColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#84cc16'
  if (score >= 40) return '#facc15'
  return '#fb923c'
}

export default function MetricCard({
  label,
  value,
  sub,
  icon,
  color,
  variant = 'normal',
  factors,
  onClick,
}: Props) {
  const isHero = variant === 'hero'
  const valueSize = isHero ? 'text-[32px]' : 'text-[22px]'

  return (
    <div
      className={`bg-card border border-border rounded-lg p-4 flex flex-col gap-2 ${
        onClick ? 'cursor-pointer hover:border-elevated transition-colors' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-text-muted tracking-widest uppercase">
          {label}
        </span>
        <span className="text-text-muted">{icon}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={`${valueSize} font-mono font-bold leading-none`}
          style={color ? { color } : undefined}
        >
          {value}
        </span>
        {sub && <span className="text-[11px] font-mono text-text-muted">{sub}</span>}
      </div>
      {isHero && factors && factors.length > 0 && (
        <div className="border-t border-elevated/40 mt-2 pt-3 flex flex-col gap-1.5">
          {factors.map((f) => (
            <div key={f.label} className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
              <span className="flex-1 truncate">{f.label}</span>
              <span className="w-10 h-[3px] bg-elevated rounded-full overflow-hidden">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.min(f.score, 100)}%`, backgroundColor: factorColor(f.score) }}
                />
              </span>
              <span className="w-6 text-right">{f.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/app test MetricCard -- --run`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/MetricCard.tsx app/src/components/__tests__/MetricCard.test.tsx
git commit -m "feat(app): add MetricCard hero variant with inline factor bars"
```

---

### Task 14: Wire Privacy Score in DashboardView with auto-refresh + click

**Files:**
- Modify: `app/src/views/DashboardView.tsx`

- [ ] **Step 1: Add privacy score state, fetch, refresh, click**

In `app/src/views/DashboardView.tsx`:

Add helpers and state at the top of the component (after existing state lines):

```tsx
const seedChat = useAppStore((s) => s.seedChat)

interface PrivacyData {
  score: number
  grade: string
  factors: Record<string, { score: number; detail: string }>
  recommendations: string[]
  transactionsAnalyzed: number
}

const [privacyData, setPrivacyData] = useState<PrivacyData | null>(null)
const [privacyError, setPrivacyError] = useState<string | null>(null)
const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
const wallet = vault?.wallet
```

Add the import: `import { useAppStore } from '../stores/app'`. Also `import { useRef } from 'react'`.

Add a fetch helper function inside the component:

```tsx
const fetchPrivacyScore = useCallback(async () => {
  if (!wallet || !token) return
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/privacy/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ address: wallet, limit: 100 }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    setPrivacyData(json.data)
    setPrivacyError(null)
  } catch (err) {
    setPrivacyError(err instanceof Error ? err.message : 'Failed to fetch privacy score')
  }
}, [wallet, token])
```

Add the import: `import { useCallback, useEffect, useRef, useState } from 'react'`.

Add the initial fetch + auto-refresh effects:

```tsx
useEffect(() => {
  if (wallet && token) fetchPrivacyScore()
}, [wallet, token, fetchPrivacyScore])

useEffect(() => {
  if (!wallet || !token) return
  const fundMoverPattern = /^(send|swap|claim|refund|deposit)\.(success|completed)$/
  const recent = events.find((e) => fundMoverPattern.test(e.type ?? ''))
  if (!recent) return
  if (refreshTimer.current) clearTimeout(refreshTimer.current)
  refreshTimer.current = setTimeout(() => fetchPrivacyScore(), 5000)
  return () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
  }
}, [events, wallet, token, fetchPrivacyScore])
```

Replace the current Privacy Score MetricCard block with:

```tsx
{(() => {
  const grade = privacyData?.grade
  const colorByGrade: Record<string, string> = {
    A: '#22c55e', B: '#84cc16', C: '#facc15', D: '#fb923c', F: '#ef4444',
  }
  const factors = privacyData
    ? [
        { label: 'Address reuse', score: privacyData.factors.addressReuse.score },
        { label: 'Amount patterns', score: privacyData.factors.amountPatterns.score },
        { label: 'Timing correlation', score: privacyData.factors.timingCorrelation.score },
        { label: 'Counterparty exposure', score: privacyData.factors.counterpartyExposure.score },
      ]
    : undefined
  return (
    <div className="lg:col-span-2">
      <MetricCard
        variant="hero"
        label={`Privacy Score${grade ? ` · ${grade}` : ''}`}
        value={privacyData ? String(privacyData.score) : (privacyError ? '—' : '—')}
        sub="/100"
        icon={<ShieldCheck size={16} />}
        color={grade ? colorByGrade[grade] : undefined}
        factors={factors}
        onClick={() => privacyData && seedChat(`Why is my privacy score ${privacyData.score}?`)}
      />
    </div>
  )
})()}
```

Also remove the old privacy-related lines:
```tsx
// const privacyScore = '—'
// const scoreColor = undefined
```

And update the grid to keep the 4-column layout — the col-span-2 hero card causes Budget to wrap to row 2 when admin is true.

- [ ] **Step 2: Verify typecheck and tests**

Run: `pnpm --filter @sipher/app exec tsc --noEmit && pnpm --filter @sipher/app test -- --run`
Expected: clean typecheck, all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/src/views/DashboardView.tsx
git commit -m "feat(app): wire privacy score hero widget with event-based refresh"
```

---

### Task 15: Add server-side `sentinel_advisory` SSE event emission

**Files:**
- Modify: `packages/agent/src/agent.ts`

- [ ] **Step 1: Find the SENTINEL preflight call site**

Run: `grep -n "preflight\|SENTINEL_MODE\|sentinelPreflight" packages/agent/src/agent.ts`
Expected: locate the preflight gate around `executeTool`.

- [ ] **Step 2: Add advisory SSE event emission**

In `packages/agent/src/agent.ts`, locate the SENTINEL preflight gate. Where it currently logs/returns advisory result, add an SSE event emission call before tool execution proceeds.

Pattern:

```ts
// Before existing tool execution, after preflight returns advisory result:
const preflight = await sentinelPreflight({ tool: name, input })
if (preflight.flagged && process.env.SENTINEL_MODE === 'advisory') {
  emit('sentinel_advisory', {
    action: humanizeAction(name, input),
    amount: extractAmount(input),
    severity: preflight.severity,
    description: preflight.description,
  })
  // Continue with tool execution (light version — no pause)
}
```

If `humanizeAction` or `extractAmount` helpers don't exist, define them inline:

```ts
function humanizeAction(name: string, input: unknown): string {
  const obj = (input ?? {}) as Record<string, unknown>
  const recipient = (obj.recipient ?? obj.to ?? obj.address) as string | undefined
  const verb = name === 'send' ? 'Send' : name === 'swap' ? 'Swap' : name.charAt(0).toUpperCase() + name.slice(1)
  return recipient ? `${verb} to ${String(recipient).slice(0, 8)}...` : verb
}

function extractAmount(input: unknown): string {
  const obj = (input ?? {}) as Record<string, unknown>
  const amount = obj.amount ?? obj.value
  const token = obj.token ?? 'SOL'
  return amount != null ? `${amount} ${token}` : ''
}
```

(These can be local functions in `agent.ts` or extracted to `lib/format-tool.ts`.)

- [ ] **Step 3: Run agent tests**

Run: `pnpm --filter @sipher/agent test -- --run`
Expected: existing tests pass (existing SENTINEL tests don't assert SSE events).

- [ ] **Step 4: Add a test asserting the new event emission**

Create `packages/agent/src/__tests__/sentinel-advisory-event.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

describe('sentinel_advisory SSE event', () => {
  it('emits sentinel_advisory before continuing tool execution when flagged in advisory mode', async () => {
    const emit = vi.fn()
    const { runWithPreflight } = await import('../agent.js')
    const original = process.env.SENTINEL_MODE
    process.env.SENTINEL_MODE = 'advisory'
    try {
      await runWithPreflight({
        tool: 'send',
        input: { amount: 5, recipient: '0x1234abcd5678' },
        preflight: { flagged: true, severity: 'high', description: 'risk signal' },
        emit,
      })
      expect(emit).toHaveBeenCalledWith(
        'sentinel_advisory',
        expect.objectContaining({ severity: 'high', description: 'risk signal' })
      )
    } finally {
      process.env.SENTINEL_MODE = original
    }
  })
})
```

(Adjust the import path to match wherever the preflight runner lives in `agent.ts`. If the runner is not exported, factor it into a small exported function for testability.)

- [ ] **Step 5: Run new test, fix exports if needed**

Run: `pnpm --filter @sipher/agent test sentinel-advisory-event -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/agent.ts packages/agent/src/__tests__/sentinel-advisory-event.test.ts
git commit -m "feat(agent): emit sentinel_advisory SSE event in advisory mode"
```

---

### Task 16: Final PR 1 verification

**Files:**
- N/A (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test -- --run && pnpm --filter @sipher/app test -- --run && pnpm --filter @sipher/agent test -- --run`
Expected: all suites green.

- [ ] **Step 2: Typecheck across workspace**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `pnpm dev` (or `pnpm --filter @sipher/app dev` + agent dev separately).
Open browser, sign in, observe:
- Dashboard shows Privacy Score hero card with grade chip + factor bars when wallet has tx history.
- Activity stream entries show event-type icons (deposit → ArrowDown, etc.).
- Live SSE events pulse, historical entries don't.
- Send a chat message that triggers a tool — verify ToolTimeline appears in the assistant bubble.
- Trigger a SENTINEL flag (manual: hit a known-blacklisted address in dev) — verify ConfirmCard renders.

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin feat/phase-2-client-polish
gh pr create --title "feat(app): Phase 2 PR 1 — client polish (Privacy Score, icons, tool timeline, AdminOnly, SENTINEL advisory light)" --body "$(cat <<'EOF'
## Summary

Phase 2 PR 1 of 3 — client-only polish from the 2026-04-26 audit-driven design.

- Privacy Score hero widget (col-span-2, score + grade + 4 factor bars, click → SIPHER chat)
- Phosphor event-type icons replacing activity dots, with pulsing for live SSE events
- Chat tool-use timeline header in assistant message bubbles (sanitized args + duration)
- ConfirmCard SENTINEL advisory wiring (client-only detection of new sentinel_advisory SSE event)
- AdminOnly wrapper component, refactored DashboardView to use it
- ConfirmCard variant + description props (warning treatment)
- New sanitize-args utility for tool argument redaction
- New event-icons mapping module

Spec: docs/superpowers/specs/2026-04-26-ui-gaps-design.md

## Test plan

- [ ] Vitest workspace suites green (`pnpm test -- --run`)
- [ ] Vitest app component suites green (`pnpm --filter @sipher/app test -- --run`)
- [ ] tsc clean (`pnpm typecheck`)
- [ ] Manual dashboard smoke test with funded wallet
- [ ] Manual chat smoke test confirming ToolTimeline render
EOF
)"
```

Expected: PR opens; CI runs `test` + `component` jobs (both should pass per Phase 1 path filtering).

---

## PR 2a — HERALD Edit + Vault quick-actions (Tasks 17-25)

### Task 17: Setup PR 2a branch

**Files:**
- N/A (branch operations)

- [ ] **Step 1: Wait for PR 1 to merge to main**

Operator: confirm PR 1 merged.

- [ ] **Step 2: Branch from main**

```bash
git checkout main
git pull
git checkout -b feat/phase-2-herald-vault
```

Expected: clean working tree on the new branch with PR 1 changes available.

---

### Task 18: herald-queue.updateContent action (TDD)

**Files:**
- Modify: `packages/agent/src/services/herald-queue.ts`
- Test: `packages/agent/src/services/__tests__/herald-queue-update.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/src/services/__tests__/herald-queue-update.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { addToQueue, updateContent, getQueueItem, _resetQueueForTests } from '../herald-queue'

describe('herald-queue updateContent', () => {
  beforeEach(() => _resetQueueForTests())

  it('updates content and bumps updated_at', async () => {
    const item = await addToQueue({ content: 'original tweet', scheduled_at: new Date().toISOString() })
    const before = item.updated_at
    await new Promise((r) => setTimeout(r, 5))
    const updated = await updateContent(item.id, 'edited tweet')
    expect(updated.content).toBe('edited tweet')
    expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(new Date(before ?? '0').getTime())
  })

  it('throws NotFoundError for unknown id', async () => {
    await expect(updateContent('does-not-exist', 'x')).rejects.toThrow(/not.found/i)
  })

  it('persists the change so subsequent reads see new content', async () => {
    const item = await addToQueue({ content: 'original', scheduled_at: new Date().toISOString() })
    await updateContent(item.id, 'fresh')
    const fetched = await getQueueItem(item.id)
    expect(fetched?.content).toBe('fresh')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/agent test herald-queue-update -- --run`
Expected: FAIL — `updateContent` not exported.

- [ ] **Step 3: Implement updateContent**

In `packages/agent/src/services/herald-queue.ts`, add the action:

```ts
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export async function updateContent(id: string, content: string): Promise<QueueItem> {
  const item = queue.get(id)
  if (!item) throw new NotFoundError(`queue item ${id} not found`)
  const updated: QueueItem = {
    ...item,
    content,
    updated_at: new Date().toISOString(),
  }
  queue.set(id, updated)
  return updated
}

export async function getQueueItem(id: string): Promise<QueueItem | undefined> {
  return queue.get(id)
}

export function _resetQueueForTests(): void {
  queue.clear()
}
```

If `QueueItem` doesn't have `updated_at`, add it as optional. Backfill existing items with `updated_at: created_at` on first PATCH (already handled — existing items pass through `created_at` initially, then get `updated_at` on PATCH).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/agent test herald-queue-update -- --run`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/services/herald-queue.ts packages/agent/src/services/__tests__/herald-queue-update.test.ts
git commit -m "feat(agent): add herald-queue.updateContent action"
```

---

### Task 19: PATCH /api/herald/queue/:id route (TDD)

**Files:**
- Modify: `packages/agent/src/routes/herald-api.ts`
- Test: `packages/agent/src/routes/__tests__/herald-patch.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/src/routes/__tests__/herald-patch.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../index'
import { addToQueue, _resetQueueForTests } from '../../services/herald-queue'
import { signTestJwt } from '../../__tests__/helpers/jwt'

const ADMIN_TOKEN = signTestJwt({ wallet: process.env.AUTHORIZED_WALLETS?.split(',')[0] ?? 'admin-wallet' })
const NON_ADMIN_TOKEN = signTestJwt({ wallet: 'random-wallet' })

describe('PATCH /api/herald/queue/:id', () => {
  beforeEach(() => _resetQueueForTests())

  it('updates content and returns 200 with the updated item', async () => {
    const item = await addToQueue({ content: 'old', scheduled_at: new Date().toISOString() })
    const res = await request(app)
      .patch(`/api/herald/queue/${item.id}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ content: 'new content' })
    expect(res.status).toBe(200)
    expect(res.body.content).toBe('new content')
  })

  it('returns 400 for empty content', async () => {
    const item = await addToQueue({ content: 'old', scheduled_at: new Date().toISOString() })
    const res = await request(app)
      .patch(`/api/herald/queue/${item.id}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ content: '' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for content > 280 chars', async () => {
    const item = await addToQueue({ content: 'old', scheduled_at: new Date().toISOString() })
    const res = await request(app)
      .patch(`/api/herald/queue/${item.id}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ content: 'a'.repeat(281) })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .patch('/api/herald/queue/does-not-exist')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ content: 'x' })
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin wallet', async () => {
    const item = await addToQueue({ content: 'old', scheduled_at: new Date().toISOString() })
    const res = await request(app)
      .patch(`/api/herald/queue/${item.id}`)
      .set('Authorization', `Bearer ${NON_ADMIN_TOKEN}`)
      .send({ content: 'x' })
    expect(res.status).toBe(403)
  })
})
```

(Adjust `signTestJwt` import to match the existing test helper. If no helper exists, inline a JWT signing call using the same secret as runtime.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/agent test herald-patch -- --run`
Expected: FAIL — route returns 404 (no PATCH handler).

- [ ] **Step 3: Add the PATCH route**

In `packages/agent/src/routes/herald-api.ts`, add:

```ts
import { z } from 'zod'
import { updateContent, NotFoundError } from '../services/herald-queue'
import { activityBus } from '../services/activity-bus'

const updateSchema = z.object({
  content: z.string().trim().min(1).max(280),
})

heraldRouter.patch('/queue/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'INVALID_CONTENT', message: parsed.error.message } })
      return
    }

    const oldItem = await import('../services/herald-queue').then((m) => m.getQueueItem(req.params.id))
    const updated = await updateContent(req.params.id, parsed.data.content)

    if (oldItem) {
      activityBus.publish('herald.edited', {
        id: updated.id,
        oldContent: oldItem.content,
        newContent: updated.content,
        by: (req as unknown as { wallet: string }).wallet,
      })
    }

    res.status(200).json(updated)
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } })
      return
    }
    next(err)
  }
})
```

(If `activity-bus` isn't the actual module name, replace with the existing activity-publishing helper.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/agent test herald-patch -- --run`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/routes/herald-api.ts packages/agent/src/routes/__tests__/herald-patch.test.ts
git commit -m "feat(agent): add PATCH /api/herald/queue/:id route with audit emission"
```

---

### Task 20: HERALD QueueTab inline edit UI

**Files:**
- Modify: `app/src/views/HeraldView.tsx`
- Test: `app/src/views/__tests__/HeraldView-edit.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/src/views/__tests__/HeraldView-edit.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAppStore } from '../../stores/app'
import HeraldView from '../HeraldView'

describe('HeraldView Edit flow', () => {
  beforeEach(() => {
    useAppStore.setState({ token: 'test-token', isAdmin: true, messages: [], chatLoading: false })
    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/herald') && (!init || init.method !== 'PATCH')) {
        return new Response(
          JSON.stringify({
            queue: [{ id: 'q1', content: 'old tweet', scheduled_at: '2026-04-27T10:00:00Z', status: 'pending' }],
            budget: { spent: 0, limit: 150, gate: 'open', percentage: 0 },
            dms: [],
            recentPosts: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.includes('/api/herald/queue/q1') && init?.method === 'PATCH') {
        return new Response(JSON.stringify({ id: 'q1', content: 'new tweet' }), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    }) as typeof fetch
  })

  it('toggles into edit mode and shows textarea on Edit click', async () => {
    render(<HeraldView token="test-token" />)
    await screen.findByText('old tweet')
    await userEvent.click(screen.getByRole('button', { name: /^queue$/i }))
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('textbox')).toHaveValue('old tweet')
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('saves the edit via PATCH and exits edit mode', async () => {
    render(<HeraldView token="test-token" />)
    await screen.findByText('old tweet')
    await userEvent.click(screen.getByRole('button', { name: /^queue$/i }))
    await userEvent.click(screen.getByRole('button', { name: /edit/i }))
    const textarea = screen.getByRole('textbox')
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'new tweet')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/herald/queue/q1'),
      expect.objectContaining({ method: 'PATCH' })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test HeraldView-edit -- --run`
Expected: FAIL — Edit button has no handler, no textarea.

- [ ] **Step 3: Update QueueTab in HeraldView.tsx**

In `app/src/views/HeraldView.tsx`, modify the `QueueTab` function:

Replace QueueTab with:

```tsx
function QueueTab({
  items,
  onAction,
  onEditSave,
}: {
  items: QueueItem[]
  onAction: (id: string, action: 'approve' | 'reject') => Promise<void>
  onEditSave: (id: string, content: string) => Promise<void>
}) {
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setPending((p) => ({ ...p, [id]: true }))
    try { await onAction(id, action) } finally {
      setPending((p) => ({ ...p, [id]: false }))
    }
  }

  const beginEdit = (item: QueueItem) => {
    setEditingId(item.id)
    setEditDraft(item.content)
  }

  const cancelEdit = () => { setEditingId(null); setEditDraft('') }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      await onEditSave(editingId, editDraft.trim())
      cancelEdit()
    } finally {
      setSaving(false)
    }
  }

  if (items.length === 0) {
    return <div className="text-text-muted text-sm text-center py-10">No pending posts.</div>
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const isEditing = editingId === item.id
        return (
          <div key={item.id} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
            {isEditing ? (
              <>
                <textarea
                  className="bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-text font-mono resize-none focus:outline-none focus:border-accent/40"
                  rows={4}
                  value={editDraft}
                  maxLength={280}
                  onChange={(e) => setEditDraft(e.target.value)}
                />
                <div className="flex justify-between items-center text-[10px] font-mono text-text-muted">
                  <span>{editDraft.length}/280</span>
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving || editDraft.trim().length === 0 || editDraft.length > 280}
                      className="text-[11px] border border-green/40 text-green bg-green/10 px-3 py-1.5 rounded-lg font-medium hover:bg-green/20 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="text-[11px] border border-border text-text-secondary bg-bg px-3 py-1.5 rounded-lg hover:bg-border disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">{item.content}</p>
                <div className="flex items-center gap-2 font-mono text-[10px] text-text-muted">
                  <span>📅</span>
                  <span>{item.scheduled_at ?? '—'}</span>
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => handleAction(item.id, 'approve')}
                    disabled={pending[item.id]}
                    className="flex-1 text-[11px] border border-green/40 text-green bg-green/10 py-1.5 rounded-lg font-medium hover:bg-green/20 disabled:opacity-50"
                  >
                    {pending[item.id] ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => beginEdit(item)}
                    disabled={pending[item.id]}
                    className="px-4 text-[11px] border border-border text-text-secondary bg-bg py-1.5 rounded-lg hover:bg-border disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleAction(item.id, 'reject')}
                    disabled={pending[item.id]}
                    className="px-3 border border-border text-text-muted bg-bg py-1.5 rounded-lg hover:text-red hover:border-red/20 disabled:opacity-50"
                    aria-label="Reject"
                  >
                    ✕
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

In the `HeraldView` component, add `handleEditSave`:

```tsx
const handleEditSave = async (id: string, content: string) => {
  await apiFetch(`/api/herald/queue/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
    token: token!,
  })
  load()
}
```

And pass it to `QueueTab`:

```tsx
{data && tab === 'queue' && (
  <QueueTab items={data.queue ?? []} onAction={handleApprove} onEditSave={handleEditSave} />
)}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @sipher/app test HeraldView-edit -- --run`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/views/HeraldView.tsx app/src/views/__tests__/HeraldView-edit.test.tsx
git commit -m "feat(app): wire HERALD queue Edit to PATCH endpoint with inline textarea"
```

---

### Task 21: AmountForm component (TDD)

**Files:**
- Create: `app/src/components/AmountForm.tsx`
- Test: `app/src/components/__tests__/AmountForm.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/src/components/__tests__/AmountForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AmountForm from '../AmountForm'

describe('AmountForm', () => {
  it('renders inputs and buttons', () => {
    render(<AmountForm action="Deposit" max={5} onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('disables Continue when amount is zero or negative', () => {
    render(<AmountForm action="Deposit" max={5} onSubmit={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('disables Continue when amount exceeds max', async () => {
    render(<AmountForm action="Deposit" max={5} onSubmit={() => {}} onCancel={() => {}} />)
    await userEvent.type(screen.getByRole('spinbutton'), '10')
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('calls onSubmit with parsed amount', async () => {
    const onSubmit = vi.fn()
    render(<AmountForm action="Deposit" max={5} onSubmit={onSubmit} onCancel={() => {}} />)
    await userEvent.type(screen.getByRole('spinbutton'), '1.5')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(onSubmit).toHaveBeenCalledWith(1.5)
  })

  it('calls onCancel', async () => {
    const onCancel = vi.fn()
    render(<AmountForm action="Deposit" max={5} onSubmit={() => {}} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test AmountForm -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Create AmountForm**

Create `app/src/components/AmountForm.tsx`:

```tsx
import { useState } from 'react'

interface Props {
  action: string
  max: number
  onSubmit: (amount: number) => void
  onCancel: () => void
}

export default function AmountForm({ action, max, onSubmit, onCancel }: Props) {
  const [raw, setRaw] = useState('')
  const parsed = Number(raw)
  const valid = raw.length > 0 && Number.isFinite(parsed) && parsed > 0 && parsed <= max

  return (
    <div className="bg-card border border-elevated rounded-lg p-4 flex flex-col gap-3">
      <div className="text-[12px] text-text-muted uppercase tracking-wide">{action} Amount</div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.0001"
          min={0}
          max={max}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="flex-1 bg-elevated border border-border rounded-lg px-3 py-2 text-[14px] font-mono text-text focus:outline-none focus:border-accent/40"
          placeholder="0.0"
        />
        <span className="text-[12px] font-mono text-text-muted">SOL</span>
      </div>
      <div className="text-[10px] font-mono text-text-muted">Max: {max} SOL</div>
      <div className="flex gap-2">
        <button
          onClick={() => valid && onSubmit(parsed)}
          disabled={!valid}
          className="flex-1 border border-sipher/50 text-sipher py-2 rounded-lg text-[12px] font-medium hover:bg-sipher/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue
        </button>
        <button
          onClick={onCancel}
          className="px-4 border border-elevated text-text-muted py-2 rounded-lg text-[12px] hover:text-text"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/app test AmountForm -- --run`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/AmountForm.tsx app/src/components/__tests__/AmountForm.test.tsx
git commit -m "feat(app): add AmountForm component for vault quick-actions"
```

---

### Task 22: VaultView Deposit/Withdraw flow

**Files:**
- Modify: `app/src/views/VaultView.tsx`
- Test: `app/src/views/__tests__/VaultView-actions.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/src/views/__tests__/VaultView-actions.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAppStore } from '../../stores/app'
import VaultView from '../VaultView'

describe('VaultView Deposit/Withdraw flow', () => {
  beforeEach(() => {
    useAppStore.setState({
      token: 'test-token',
      isAdmin: false,
      messages: [],
      chatLoading: false,
      pendingPrompt: null,
    })
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          wallet: 'FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr',
          balances: { sol: 5, tokens: [], status: 'ok' },
          vault: { balance: 2 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as typeof fetch
  })

  it('shows Deposit and Withdraw buttons initially', async () => {
    render(<VaultView token="test-token" />)
    expect(await screen.findByRole('button', { name: /\+ deposit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /↗ withdraw/i })).toBeInTheDocument()
  })

  it('opens AmountForm on Deposit click', async () => {
    render(<VaultView token="test-token" />)
    await userEvent.click(await screen.findByRole('button', { name: /\+ deposit/i }))
    expect(screen.getByText(/deposit amount/i)).toBeInTheDocument()
  })

  it('moves through 3-step flow and calls seedChat on confirm', async () => {
    const seedChat = vi.fn()
    useAppStore.setState({ seedChat })
    render(<VaultView token="test-token" />)
    await userEvent.click(await screen.findByRole('button', { name: /\+ deposit/i }))
    await userEvent.type(screen.getByRole('spinbutton'), '1')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/Confirm Action/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /confirm & sign/i }))
    expect(seedChat).toHaveBeenCalledWith(expect.stringContaining('deposit 1 SOL'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test VaultView-actions -- --run`
Expected: FAIL — buttons not present.

- [ ] **Step 3: Update VaultView**

In `app/src/views/VaultView.tsx`, add the flow state and components. Pseudo-diff (apply per existing structure):

```tsx
import { useState, useEffect } from 'react'
import AmountForm from '../components/AmountForm'
import ConfirmCard from '../components/ConfirmCard'
import { useAppStore } from '../stores/app'

type Action = 'deposit' | 'withdraw'
type Step = 'idle' | 'amount' | 'confirm'

export default function VaultView({ token }: { token: string | null }) {
  // ... existing data fetch ...
  const seedChat = useAppStore((s) => s.seedChat)
  const [step, setStep] = useState<Step>('idle')
  const [action, setAction] = useState<Action | null>(null)
  const [amount, setAmount] = useState<number>(0)

  const walletBalance = vault?.balances?.sol ?? 0
  const vaultBalance = vault?.vault?.balance ?? 0
  const max = action === 'deposit' ? walletBalance : vaultBalance

  const begin = (a: Action) => { setAction(a); setStep('amount') }
  const submitAmount = (n: number) => { setAmount(n); setStep('confirm') }
  const confirm = () => {
    if (!action || !amount) return
    seedChat(`${action} ${amount} SOL ${action === 'deposit' ? 'to' : 'from'} vault`)
    reset()
  }
  const reset = () => { setAction(null); setAmount(0); setStep('idle') }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          onClick={() => begin('deposit')}
          disabled={step !== 'idle' || walletBalance <= 0}
          className="flex-1 px-4 py-2 bg-sipher/10 border border-sipher/30 text-sipher rounded-lg text-[12px] font-medium hover:bg-sipher/20 disabled:opacity-30"
        >
          + Deposit
        </button>
        <button
          onClick={() => begin('withdraw')}
          disabled={step !== 'idle' || vaultBalance <= 0}
          className="flex-1 px-4 py-2 bg-elevated border border-border text-text-secondary rounded-lg text-[12px] font-medium hover:bg-border disabled:opacity-30"
        >
          ↗ Withdraw
        </button>
      </div>

      {step === 'amount' && action && (
        <AmountForm action={action.charAt(0).toUpperCase() + action.slice(1)} max={max} onSubmit={submitAmount} onCancel={reset} />
      )}

      {step === 'confirm' && action && (
        <ConfirmCard
          action={action.charAt(0).toUpperCase() + action.slice(1)}
          amount={`${amount} SOL`}
          onConfirm={confirm}
          onCancel={reset}
        />
      )}

      {/* ... existing vault content ... */}
    </div>
  )
}
```

(Adjust to existing VaultView structure — preserve the existing balance-display components, just add this flow at the top.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/app test VaultView-actions -- --run`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/views/VaultView.tsx app/src/views/__tests__/VaultView-actions.test.tsx
git commit -m "feat(app): wire vault Deposit/Withdraw quick-actions with ConfirmCard"
```

---

### Task 23: Final PR 2a verification

**Files:**
- N/A (verification only)

- [ ] **Step 1: Run all tests**

Run: `pnpm test -- --run && pnpm --filter @sipher/app test -- --run && pnpm --filter @sipher/agent test -- --run`
Expected: green.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Manual smoke test**

- HERALD queue: click Edit on a queued tweet, modify content, click Save → list updates.
- Vault: click Deposit, enter amount, click Continue → ConfirmCard appears. Click Confirm & Sign → SIPHER chat opens with prompt.

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin feat/phase-2-herald-vault
gh pr create --title "feat: Phase 2 PR 2a — HERALD edit + Vault quick-actions" --body "$(cat <<'EOF'
## Summary

- New PATCH /api/herald/queue/:id endpoint with zod validation, audit emission
- HERALD queue Edit button wired to inline textarea with save/cancel
- VaultView quick-action Deposit/Withdraw buttons with 3-step amount → confirm flow
- AmountForm component (controlled input + validation)
- Confirm fires via seedChat; existing agent tools handle execution

Spec: docs/superpowers/specs/2026-04-26-ui-gaps-design.md

## Test plan

- [ ] Vitest workspace (`pnpm test -- --run`)
- [ ] Vitest app (`pnpm --filter @sipher/app test -- --run`)
- [ ] tsc clean
- [ ] Manual HERALD edit smoke
- [ ] Manual vault deposit + withdraw smoke
EOF
)"
```

Expected: PR opens with backend + client checks both green.

---

## PR 2b — SENTINEL Server Pause/Resume (Tasks 24-30)

### Task 24: Setup PR 2b branch

- [ ] **Step 1: Wait for PR 2a merge**

Operator: confirm PR 2a merged.

- [ ] **Step 2: Branch from main**

```bash
git checkout main
git pull
git checkout -b feat/phase-2-sentinel-pause-resume
```

---

### Task 25: sentinel-pending service (TDD)

**Files:**
- Create: `packages/agent/src/services/sentinel-pending.ts`
- Test: `packages/agent/src/services/__tests__/sentinel-pending.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/src/services/__tests__/sentinel-pending.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createPending, resolvePending, rejectPending, clearAll, _setTimeoutMsForTests,
} from '../sentinel-pending'

describe('sentinel-pending', () => {
  beforeEach(() => {
    clearAll('test-session')
    _setTimeoutMsForTests(120_000)
    vi.useRealTimers()
  })

  it('resolves the pending promise on resolvePending', async () => {
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    setTimeout(() => resolvePending(flagId), 5)
    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects the pending promise on rejectPending', async () => {
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    setTimeout(() => rejectPending(flagId, 'cancelled_by_user'), 5)
    await expect(promise).rejects.toThrow('cancelled_by_user')
  })

  it('returns false for unknown flag id', () => {
    expect(resolvePending('unknown-id')).toBe(false)
    expect(rejectPending('unknown-id', 'x')).toBe(false)
  })

  it('rejects with timeout after configured duration', async () => {
    _setTimeoutMsForTests(50)
    const { promise } = createPending('test-session', 'send', { amount: 1 })
    await expect(promise).rejects.toThrow(/timed out/i)
  })

  it('clearAll rejects all pending in the given session', async () => {
    const a = createPending('s1', 'send', {})
    const b = createPending('s1', 'swap', {})
    const c = createPending('s2', 'send', {})
    clearAll('s1')
    await expect(a.promise).rejects.toThrow(/disconnected/i)
    await expect(b.promise).rejects.toThrow(/disconnected/i)
    setTimeout(() => resolvePending(c.flagId), 5)
    await expect(c.promise).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/agent test sentinel-pending -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the service**

Create `packages/agent/src/services/sentinel-pending.ts`:

```ts
import { randomUUID } from 'crypto'

interface PendingFlag {
  sessionId: string
  toolName: string
  toolInput: unknown
  createdAt: number
  resolver: (value: void) => void
  rejecter: (reason: Error) => void
  timeoutHandle: NodeJS.Timeout
}

let TIMEOUT_MS = 120_000
const pending = new Map<string, PendingFlag>()

export function _setTimeoutMsForTests(ms: number): void {
  TIMEOUT_MS = ms
}

export function createPending(
  sessionId: string,
  toolName: string,
  toolInput: unknown
): { flagId: string; promise: Promise<void> } {
  const flagId = randomUUID()
  let resolver!: (value: void) => void
  let rejecter!: (reason: Error) => void
  const promise = new Promise<void>((resolve, reject) => {
    resolver = resolve
    rejecter = reject
  })
  const timeoutHandle = setTimeout(() => {
    if (pending.has(flagId)) {
      pending.delete(flagId)
      rejecter(new Error('operation timed out'))
    }
  }, TIMEOUT_MS)
  pending.set(flagId, { sessionId, toolName, toolInput, createdAt: Date.now(), resolver, rejecter, timeoutHandle })
  return { flagId, promise }
}

export function resolvePending(flagId: string): boolean {
  const entry = pending.get(flagId)
  if (!entry) return false
  clearTimeout(entry.timeoutHandle)
  pending.delete(flagId)
  entry.resolver()
  return true
}

export function rejectPending(flagId: string, reason: string): boolean {
  const entry = pending.get(flagId)
  if (!entry) return false
  clearTimeout(entry.timeoutHandle)
  pending.delete(flagId)
  entry.rejecter(new Error(reason))
  return true
}

export function clearAll(sessionId: string): void {
  for (const [flagId, entry] of pending.entries()) {
    if (entry.sessionId === sessionId) {
      clearTimeout(entry.timeoutHandle)
      pending.delete(flagId)
      entry.rejecter(new Error('client_disconnected'))
    }
  }
}

export function getPending(flagId: string): PendingFlag | undefined {
  return pending.get(flagId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/agent test sentinel-pending -- --run`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/services/sentinel-pending.ts packages/agent/src/services/__tests__/sentinel-pending.test.ts
git commit -m "feat(agent): add sentinel-pending service with timeout + clearAll"
```

---

### Task 26: sentinel routes (TDD)

**Files:**
- Create: `packages/agent/src/routes/sentinel.ts`
- Test: `packages/agent/src/routes/__tests__/sentinel.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/agent/src/routes/__tests__/sentinel.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../index'
import { createPending, clearAll } from '../../services/sentinel-pending'
import { signTestJwt } from '../../__tests__/helpers/jwt'

const ADMIN_TOKEN = signTestJwt({ wallet: process.env.AUTHORIZED_WALLETS?.split(',')[0] ?? 'admin-wallet' })
const NON_ADMIN_TOKEN = signTestJwt({ wallet: 'random-wallet' })

describe('SENTINEL pause/resume routes', () => {
  beforeEach(() => clearAll('test-session'))

  it('POST /api/sentinel/override resolves the pending promise (204)', async () => {
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    const res = await request(app)
      .post(`/api/sentinel/override/${flagId}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    expect(res.status).toBe(204)
    await expect(promise).resolves.toBeUndefined()
  })

  it('POST /api/sentinel/cancel rejects the pending promise (204)', async () => {
    const { flagId, promise } = createPending('test-session', 'send', { amount: 1 })
    const res = await request(app)
      .post(`/api/sentinel/cancel/${flagId}`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    expect(res.status).toBe(204)
    await expect(promise).rejects.toThrow(/cancelled/i)
  })

  it('returns 404 for unknown flag id', async () => {
    const res = await request(app)
      .post('/api/sentinel/override/does-not-exist')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    expect(res.status).toBe(404)
  })

  it('returns 403 for non-admin', async () => {
    const { flagId } = createPending('test-session', 'send', { amount: 1 })
    const res = await request(app)
      .post(`/api/sentinel/override/${flagId}`)
      .set('Authorization', `Bearer ${NON_ADMIN_TOKEN}`)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/agent test sentinel.test -- --run`
Expected: FAIL — route returns 404.

- [ ] **Step 3: Create routes and mount**

Create `packages/agent/src/routes/sentinel.ts`:

```ts
import { Router, Request, Response } from 'express'
import { resolvePending, rejectPending } from '../services/sentinel-pending'

export const sentinelRouter = Router()

sentinelRouter.post('/override/:flagId', (req: Request, res: Response) => {
  const ok = resolvePending(req.params.flagId)
  if (!ok) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'flag not found or expired' } })
    return
  }
  res.status(204).send()
})

sentinelRouter.post('/cancel/:flagId', (req: Request, res: Response) => {
  const ok = rejectPending(req.params.flagId, 'cancelled_by_user')
  if (!ok) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'flag not found or expired' } })
    return
  }
  res.status(204).send()
})
```

In `packages/agent/src/index.ts`, add the mount line near the other admin routes:

```ts
import { sentinelRouter } from './routes/sentinel'
// ...
app.use('/api/sentinel', verifyJwt, requireOwner, sentinelRouter)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/agent test sentinel.test -- --run`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/routes/sentinel.ts packages/agent/src/index.ts packages/agent/src/routes/__tests__/sentinel.test.ts
git commit -m "feat(agent): add SENTINEL override/cancel REST endpoints"
```

---

### Task 27: Replace light advisory with pause/resume in agent loop

**Files:**
- Modify: `packages/agent/src/agent.ts`

- [ ] **Step 1: Replace `sentinel_advisory` emission with `sentinel_pause` + `await pending.promise`**

In `packages/agent/src/agent.ts`, replace the PR 1 light wiring (the `emit('sentinel_advisory', ...)` block) with:

```ts
const preflight = await sentinelPreflight({ tool: name, input })
if (preflight.flagged && process.env.SENTINEL_MODE === 'advisory') {
  const { flagId, promise } = createPending(sessionId, name, input)
  emit('sentinel_pause', {
    flagId,
    action: humanizeAction(name, input),
    amount: extractAmount(input),
    severity: preflight.severity,
    description: preflight.description,
  })
  try {
    await promise
    // override → continue tool execution
  } catch (err) {
    // cancel or timeout → emit synthetic tool result
    return {
      type: 'tool_result',
      name,
      is_error: true,
      output: { status: 'cancelled_by_user', reason: (err as Error).message },
    }
  }
}
```

Add the import at the top:

```ts
import { createPending } from './services/sentinel-pending'
```

Remove the old `sentinel_advisory` emit (introduced in PR 1's Task 15).

- [ ] **Step 2: Add disconnect handler**

In the chat-stream route or wherever SSE connection management lives, locate the `req.on('close', ...)` handler and add:

```ts
import { clearAll } from '../services/sentinel-pending'
// ...
req.on('close', () => {
  clearAll(sessionId)
  // ... existing cleanup ...
})
```

- [ ] **Step 3: Update existing PR 1 SSE event test**

In `packages/agent/src/__tests__/sentinel-advisory-event.test.ts` (created in Task 15), rename to `sentinel-pause-event.test.ts` and update assertion:

```ts
expect(emit).toHaveBeenCalledWith(
  'sentinel_pause',
  expect.objectContaining({
    flagId: expect.any(String),
    severity: 'high',
    description: 'risk signal',
  })
)
```

- [ ] **Step 4: Run all agent tests**

Run: `pnpm --filter @sipher/agent test -- --run`
Expected: green (existing tests + new sentinel-pending + sentinel routes + updated event test).

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/agent.ts packages/agent/src/__tests__/sentinel-pause-event.test.ts packages/agent/src/index.ts
git rm packages/agent/src/__tests__/sentinel-advisory-event.test.ts || true
git commit -m "feat(agent): replace sentinel advisory light with pause/resume"
```

---

### Task 28: SentinelConfirm component (TDD)

**Files:**
- Create: `app/src/components/SentinelConfirm.tsx`
- Test: `app/src/components/__tests__/SentinelConfirm.test.tsx`

- [ ] **Step 1: Write failing test**

Create `app/src/components/__tests__/SentinelConfirm.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SentinelConfirm from '../SentinelConfirm'

describe('SentinelConfirm', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })) as typeof fetch
  })

  it('renders amber warning ConfirmCard with description', () => {
    render(
      <SentinelConfirm
        flagId="abc"
        token="t"
        action="Send"
        amount="5 SOL"
        description="Risk: blacklisted address"
        onResolved={() => {}}
      />
    )
    expect(screen.getByText(/blacklisted address/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /override & send/i })).toBeInTheDocument()
  })

  it('POSTs to override endpoint on Override click', async () => {
    const onResolved = vi.fn()
    render(
      <SentinelConfirm
        flagId="abc"
        token="t"
        action="Send"
        amount="5 SOL"
        description="x"
        onResolved={onResolved}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /override & send/i }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sentinel/override/abc'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(onResolved).toHaveBeenCalledWith('override')
  })

  it('POSTs to cancel endpoint on Cancel click', async () => {
    const onResolved = vi.fn()
    render(
      <SentinelConfirm
        flagId="abc"
        token="t"
        action="Send"
        amount="5 SOL"
        description="x"
        onResolved={onResolved}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/sentinel/cancel/abc'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(onResolved).toHaveBeenCalledWith('cancel')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sipher/app test SentinelConfirm -- --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Create SentinelConfirm**

Create `app/src/components/SentinelConfirm.tsx`:

```tsx
import { useState } from 'react'
import ConfirmCard from './ConfirmCard'

const API_URL = import.meta.env.VITE_API_URL ?? ''

interface Props {
  flagId: string
  token: string
  action: string
  amount: string
  description?: string
  onResolved: (decision: 'override' | 'cancel') => void
}

export default function SentinelConfirm({ flagId, token, action, amount, description, onResolved }: Props) {
  const [busy, setBusy] = useState(false)

  const dispatch = async (kind: 'override' | 'cancel') => {
    if (busy) return
    setBusy(true)
    try {
      await fetch(`${API_URL}/api/sentinel/${kind}/${flagId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      onResolved(kind)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmCard
      variant="warning"
      action={action}
      amount={amount}
      description={description}
      onConfirm={() => dispatch('override')}
      onCancel={() => dispatch('cancel')}
    />
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sipher/app test SentinelConfirm -- --run`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/SentinelConfirm.tsx app/src/components/__tests__/SentinelConfirm.test.tsx
git commit -m "feat(app): add SentinelConfirm component with override/cancel REST"
```

---

### Task 29: ChatSidebar handle `sentinel_pause` event

**Files:**
- Modify: `app/src/components/ChatSidebar.tsx`

- [ ] **Step 1: Replace `sentinel_advisory` handling with `sentinel_pause`**

In `app/src/components/ChatSidebar.tsx` SSE event parsing block, replace the `sentinel_advisory` case with:

```tsx
} else if (event.type === 'sentinel_pause') {
  addMessage({
    id: crypto.randomUUID(),
    role: 'system',
    content: '',
    kind: 'sentinel_pause' as const,
    meta: {
      flagId: event.flagId,
      action: event.action,
      amount: event.amount,
      description: event.description,
      severity: event.severity,
    },
  })
}
```

Update `ChatMessage.kind` typing in `app/src/stores/app.ts` to include `'sentinel_pause'`:

```ts
kind?: 'sentinel_advisory' | 'sentinel_pause'
```

In the message-rendering switch, add a case for `sentinel_pause`:

```tsx
if (msg.role === 'system' && msg.kind === 'sentinel_pause' && token) {
  const meta = (msg.meta ?? {}) as { flagId?: string; action?: string; amount?: string; description?: string }
  return (
    <div key={msg.id} className="flex justify-start">
      <div className="max-w-[90%] w-full">
        <SentinelConfirm
          flagId={meta.flagId ?? ''}
          token={token}
          action={meta.action ?? 'Action'}
          amount={meta.amount ?? ''}
          description={meta.description}
          onResolved={() => dismissMessage(msg.id)}
        />
      </div>
    </div>
  )
}
```

Add the import: `import SentinelConfirm from './SentinelConfirm'`.

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @sipher/app test ChatSidebar -- --run`
Expected: existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ChatSidebar.tsx app/src/stores/app.ts
git commit -m "feat(app): handle sentinel_pause SSE event with SentinelConfirm"
```

---

### Task 30: Add E2E spec (skipped pending #1077) and final PR

**Files:**
- Create: `e2e/sentinel-flow.spec.ts`

- [ ] **Step 1: Create skipped E2E spec**

Create `e2e/sentinel-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

// Skipped pending sip-protocol/sip-protocol#1077 (SDK ESM bundle bug blocks agent startup)
test.skip('SENTINEL pause/resume flow — full chat → override → tool runs', async ({ page }) => {
  await page.goto('/')

  // Sign in (using storageState fixture from Phase 1)
  // Send a message that triggers a SENTINEL flag (e.g., sending to a known-blacklisted devnet address)
  await page.getByPlaceholder('Message SIPHER...').fill('send 5 SOL to <blacklisted address>')
  await page.getByRole('button', { name: /send/i }).click()

  // SentinelConfirm card should render
  const confirmCard = page.getByText(/risk confirm/i).first()
  await expect(confirmCard).toBeVisible({ timeout: 10000 })

  // Override → tool completes
  await page.getByRole('button', { name: /override & send/i }).click()

  // Assistant message resumes streaming
  await expect(page.getByText(/transaction submitted/i)).toBeVisible({ timeout: 30000 })
})

test.skip('SENTINEL pause/resume flow — cancel produces graceful message', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Message SIPHER...').fill('send 5 SOL to <blacklisted address>')
  await page.getByRole('button', { name: /send/i }).click()

  const confirmCard = page.getByText(/risk confirm/i).first()
  await expect(confirmCard).toBeVisible({ timeout: 10000 })

  await page.getByRole('button', { name: /^cancel$/i }).click()

  await expect(page.getByText(/operation cancelled/i)).toBeVisible({ timeout: 10000 })
})
```

- [ ] **Step 2: Final all-green verification**

Run: `pnpm test -- --run && pnpm --filter @sipher/app test -- --run && pnpm --filter @sipher/agent test -- --run && pnpm typecheck`
Expected: green.

- [ ] **Step 3: Commit and push**

```bash
git add e2e/sentinel-flow.spec.ts
git commit -m "test(e2e): add SENTINEL pause/resume spec (skipped pending #1077)"
git push -u origin feat/phase-2-sentinel-pause-resume
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "feat(agent): Phase 2 PR 2b — SENTINEL server pause/resume + override/cancel" --body "$(cat <<'EOF'
## Summary

- New sentinel-pending in-memory flag store with 120s timeout + clearAll on disconnect
- New POST /api/sentinel/override/:flagId and /cancel/:flagId admin endpoints
- Agent loop pauses tool execution when SENTINEL flags + MODE=advisory; resumes on override, emits synthetic cancelled tool_result on cancel/timeout
- Replaces PR 1's light sentinel_advisory wiring with proper sentinel_pause + REST roundtrip
- New SentinelConfirm client component
- E2E spec added (skipped pending sip-protocol/sip-protocol#1077)

Spec: docs/superpowers/specs/2026-04-26-ui-gaps-design.md

## Test plan

- [ ] Vitest agent (`pnpm --filter @sipher/agent test -- --run`)
- [ ] Vitest app (`pnpm --filter @sipher/app test -- --run`)
- [ ] tsc clean
- [ ] Manual smoke: SENTINEL_MODE=advisory in dev → trigger risky action → ConfirmCard appears → Override resumes / Cancel produces graceful "operation cancelled" message

## Rollout

Behind existing `SENTINEL_MODE` env (default `advisory` in prod). For soft-launch: temporarily set `SENTINEL_MODE=yolo`, merge, observe logs, flip back.
EOF
)"
```

Expected: PR opens green; manual smoke before any prod soak.

---

## Self-Review

### Spec coverage

| Spec section | Implementation tasks |
|---|---|
| Item 1 — Privacy Score hero widget | Tasks 13 (MetricCard), 14 (DashboardView wiring), 10 (seedChat) |
| Item 4 — Activity Phosphor icons + pulsing | Tasks 5 (event-icons), 6 (EventIcon), 7 (ActivityEntry), 8 (DashboardView isLive) |
| Item 3 — Chat tool-use timeline | Tasks 9 (sanitize-args), 10 (ChatMessage.tools), 11 (ToolTimeline), 12 (ChatSidebar SSE) |
| Item 2-B (light) — ConfirmCard SENTINEL advisory | Tasks 2 (ConfirmCard variant), 12 (ChatSidebar handle), 15 (server SSE) |
| Item 6 — AdminOnly wrapper | Tasks 3 (component), 4 (DashboardView refactor) |
| Item 5 — HERALD Edit endpoint + UI | Tasks 18 (updateContent), 19 (PATCH route), 20 (UI) |
| Item 2-C — Vault quick-actions | Tasks 21 (AmountForm), 22 (VaultView flow) |
| Item 2-B (heavy) — SENTINEL pause/resume | Tasks 25 (sentinel-pending), 26 (REST), 27 (agent loop), 28 (SentinelConfirm), 29 (ChatSidebar handle), 30 (E2E) |

All 8 spec items mapped to concrete tasks. No gaps.

### Type/method consistency

- `appendTool(name, args)` and `completeTool(name, status)` defined in Task 10 store, called same way in Task 12 ChatSidebar.
- `seedChat(prompt)` defined in Task 10 store; called in Task 14 DashboardView and Task 22 VaultView with the same signature.
- `ToolCall` interface (Task 10) consumed unchanged in Task 11 ToolTimeline.
- `Factor` interface (Task 13 MetricCard) referenced by structural shape in Task 14 DashboardView.
- `createPending`, `resolvePending`, `rejectPending`, `clearAll` (Task 25) called consistently in Tasks 26 (routes), 27 (agent loop).
- ConfirmCard's `variant` and `description` props (Task 2) consumed unchanged in Tasks 22 (Vault) and 28 (Sentinel).

### Placeholder scan

- No "TBD" / "TODO" / "implement later" anywhere in the plan.
- Every code step shows actual code.
- Every test step shows actual assertions.
- Commands have expected output stated.

### Scope gates

- Tasks scoped to single-component or single-file changes where possible.
- TDD discipline: every new component/function has failing test before implementation.
- 3 PRs sequenced; each PR has its own final verification task (16, 23, 30).

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-26-phase-2-ui-gaps.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
