# Phase 2 — UI Gaps Design Spec

**Date:** 2026-04-26
**Status:** Approved, ready for implementation plan
**Scope:** Phase 2 of the audit-driven 6-phase effort
**Predecessor:** [2026-04-18-test-infrastructure-design.md](./2026-04-18-test-infrastructure-design.md)
**Related audit:** Spec-vs-implementation gap audit (2026-04-18)

## Summary

Ship the six UI gap fixes called out by the 2026-04-18 audit, plus the deferred items the audit explicitly recommended for follow-up. Three pull requests, scoped by layer: client polish (PR 1), HERALD edit + Vault quick-actions (PR 2a), SENTINEL server-side pause/resume (PR 2b). Built on top of the Phase 1 testing scaffold.

## Context

The 2026-04-18 spec-vs-implementation audit identified six UI gaps in the Command Center (`app/src/`). Reverification against current code (2026-04-26) found:

- **3 real gaps:** privacy score widget hardcoded `'—'`, ConfirmCard component orphaned (zero usages), HERALD queue Edit button dead (no handler).
- **2 false positives:** activity stream color dots already dynamic via `AGENTS` dict; MetricCard admin gating already enforced both client-side (4 `{isAdmin && ...}` guards) and server-side (`requireOwner` middleware on `/api/herald`).
- **1 partial:** ChatSidebar tool-use indicators exist as a header-during-streaming display only — no per-message audit trail in conversation history.

Decision: do not "skip" the false positives. Treat the audit as a starting prompt for product improvement and ship preventative refactors (`<AdminOnly>` wrapper) and product upgrades (Phosphor event icons replacing dots, pulsing animation for live events) rather than checking off the audit literally. Total scope grew from ~400 to ~830-1000 lines, justified across 3 PRs.

## Goals

- Make Privacy Score a hero dashboard metric — visible, computed, click-to-explain.
- Replace orphan ConfirmCard with two real use sites: SENTINEL advisory warnings (chat) and Vault quick-actions (deposit/withdraw).
- Surface the agent's tool-call audit trail in chat history — not just during streaming.
- Upgrade activity stream readability: event-type icons, pulsing animation for live events.
- Wire HERALD queue Edit fully — `PATCH` endpoint + inline textarea — to support the editorial workflow advisory mode requires.
- Centralize admin gating into a reusable `<AdminOnly>` wrapper component.
- Convert SENTINEL advisory mode from text-in-chat to a pause-and-confirm UX with override/cancel REST endpoints.

## Non-goals

- Activity stream redesign beyond icons + pulsing.
- Privacy score auto-refresh on a timer (only event-driven refresh — fund-mover tool results trigger a debounced refetch).
- Admin gating for components beyond MetricCard / Guardian Squad section.
- Optimistic UI for any write path. All writes wait for server confirmation.
- Cross-browser matrix for new Playwright specs (Chromium only, per Phase 1).
- DB migration. All new state is in-memory.
- Visual regression tests.

## Architecture

Three pull requests, sequenced for safety and review focus:

| PR | Branch | Base | Lines | Layer |
|---|---|---|---|---|
| **PR 1** | `feat/phase-2-client-polish` | `main` (or `feat/test-infra` if #152 unmerged) | ~350 | Client + 1 small server SSE addition |
| **PR 2a** | `feat/phase-2-herald-vault` | `main` after PR 1 | ~200 | Server (1 new route) + client |
| **PR 2b** | `feat/phase-2-sentinel-pause-resume` | `main` after PR 2a | ~350-400 | Server (agent loop refactor + 2 routes) + client |

**Why three PRs (not two):** SENTINEL pause/resume is a security-relevant agent-loop change. Bundling it with HERALD/Vault buries the security-critical diff. Independent PR makes it focused-reviewable and independently revertable if a prod bug surfaces.

**Why client-only first (not server-first):** PR 1 has zero migration risk and lands the most-visible items immediately (privacy score, icons, tool indicators). Quick wins prove the PR cadence works before harder changes.

## Item-by-item design

**Items grouped by PR:**

| PR | Items |
|---|---|
| **PR 1** | 1 (Privacy Score) · 4 (Activity icons + pulsing) · 3 (Tool timeline) · 2-B (ConfirmCard SENTINEL light) · 6 (AdminOnly wrapper) |
| **PR 2a** | 2-C (Vault quick-actions) · 5 (HERALD Edit) |
| **PR 2b** | 2-B-heavy (SENTINEL server pause/resume) |

The items below are described in spec-natural order (general → specific, light wiring → heavy refactor). Implementation order within each PR is captured in the implementation plan.

### Item 1 — Privacy Score hero widget (PR 1)

**Files touched:**
- `app/src/components/MetricCard.tsx` — add `variant?: 'normal' | 'hero'` and `factors?: Array<{ label: string; score: number }>` props.
- `app/src/views/DashboardView.tsx` — wire to `POST /v1/privacy/score`, replace literal `'—'` (line 94), add event-driven refresh.
- `app/src/stores/app.ts` — new `seedChat(prompt: string)` action: `set({ chatOpen: true })`, push user message, auto-send.

**Endpoint:** existing `POST /v1/privacy/score` body `{ address: string, limit?: number }`. Returns `{ score, grade, transactionsAnalyzed, factors: { addressReuse, amountPatterns, timingCorrelation, counterpartyExposure }, recommendations }`. No backend change.

**Layout:** Privacy Score card receives `lg:col-span-2`. When `!isAdmin`: 4-col grid renders Privacy×2 + SOL + Deposits = 4 cells perfectly. When `isAdmin`: 5 cells, Budget wraps to row 2.

**Color tier mapping:** `A=#22c55e` (green), `B=#84cc16` (lime), `C=#facc15` (yellow), `D=#fb923c` (orange), `F=#ef4444` (red). Applied to score number AND grade chip.

**Auto-refresh:** `useEffect` watches `events` array, filters `event.type` matching `/^(send|swap|claim|refund|deposit)\.(success|completed)$/`. On match → 5s debounce → refetch. No timer-based refresh (RPC cost concerns).

**Click handler:** card-level `onClick` → `seedChat(\`Why is my privacy score \${score}?\`)`. Opens chat sidebar with seeded prompt; SIPHER agent answers using existing `privacyScore` tool which produces the explanation.

**States:**
- Loading: pulsing `'—'`, factor bars hidden.
- Error: `'—'` with muted `?` icon, hover tooltip from `err.message`.
- No transactions: score 100 with grade A; recommendations recommend continued stealth-address use.

### Item 4 — Activity Phosphor icons + live pulsing (PR 1)

**Files touched:**
- `app/src/lib/event-icons.ts` — **new.** `event.type → Phosphor icon component` mapping.
- `app/src/components/EventIcon.tsx` — **new.** Tiny wrapper: `({ type, color, live }) => <Icon size={14} color={color} className={live ? 'animate-pulse' : ''} />`.
- `app/src/components/ActivityEntry.tsx` — replace `<div className="w-1.5 h-1.5 rounded-full">` with `<EventIcon ... />`. Add `isLive?: boolean` prop.
- `app/src/views/DashboardView.tsx` — tag merged events: `events.map(e => ({...e, isLive: true}))`, `history.map(e => ({...e, isLive: false}))`.

**Initial mapping:**
```ts
import { ArrowDown, ArrowUp, PaperPlaneTilt, ArrowsLeftRight, DownloadSimple,
         ArrowCounterClockwise, Eye, ShieldWarning, Shield, Megaphone, Circle } from '@phosphor-icons/react'

export const EVENT_ICONS = {
  'deposit': ArrowDown,
  'withdraw': ArrowUp,
  'send': PaperPlaneTilt,
  'swap': ArrowsLeftRight,
  'claim': DownloadSimple,
  'refund': ArrowCounterClockwise,
  'scan': Eye,
  'sentinel.flag': ShieldWarning,
  'sentinel.block': Shield,
  'herald.posted': Megaphone,
} as const

export function resolveEventIcon(type: string) {
  // exact match → prefix match → fallback
  if (type in EVENT_ICONS) return EVENT_ICONS[type as keyof typeof EVENT_ICONS]
  for (const key of Object.keys(EVENT_ICONS)) {
    if (type.startsWith(key + '.')) return EVENT_ICONS[key as keyof typeof EVENT_ICONS]
  }
  return Circle
}
```

**Pulsing:** `animate-pulse` is Tailwind built-in. Only applied when `isLive=true`.

### Item 3 — Chat tool-use timeline (PR 1)

**Files touched:**
- `app/src/stores/app.ts` — extend `ChatMessage`: `tools?: Array<{ name: string; args?: string; durationMs?: number; status: 'running' | 'success' | 'error' }>`. Add `appendTool(name, args)` and `completeTool(name, durationMs, status)` actions.
- `app/src/components/ChatSidebar.tsx` — extend SSE handler.
- `app/src/components/ToolTimeline.tsx` — **new.** Renders the timeline header inside an assistant bubble.
- `app/src/lib/sanitize-args.ts` — **new.** Pure function for redaction.

**SSE handler additions** (in `ChatSidebar.tsx`):
```ts
} else if (event.type === 'tool_use') {
  appendTool(event.name, sanitizeArgs(event.input))
  setActiveTool(event.name)
} else if (event.type === 'tool_result') {
  completeTool(event.name, /* durationMs computed in store */, event.is_error ? 'error' : 'success')
  setActiveTool(null)
}
```

**`sanitizeArgs(input: unknown): string`:**
- For each top-level key in `input` object:
  - Skip key if matches `/private|secret|mnemonic|password|seed/i`.
  - For string values: if length >12 and matches base58/hex regex, format as `XXXX...XXXX` (first-4-last-4). Else truncate to 40 chars + `…`.
  - For numbers/bools: stringify as-is.
- Return `key1=v1, key2=v2` joined string.

**`<ToolTimeline tools={msg.tools} />`:**
- Renders nothing if `tools` undefined.
- Otherwise: top section inside the assistant bubble, full-width, separated from text by 1px border. Each row: status icon + tool name (mono, blue) + args (mono, dim, truncate-overflow) + duration (mono, dim, right-aligned).
- Status icons: `🔄 → ✓ → ✕` via Phosphor `CircleNotch / CheckCircle / XCircle` at 11px.

### Item 2-B — ConfirmCard SENTINEL advisory (PR 1, light wiring)

**Files touched:**
- `app/src/components/ConfirmCard.tsx` — add `variant?: 'normal' | 'warning'` and `description?: string` props. Warning variant: amber border, amber primary button label `Override & Send`.
- `app/src/components/ChatSidebar.tsx` — handle new SSE event type `sentinel_advisory`.
- `app/src/stores/app.ts` — `ChatMessage.role` extended to `'user' | 'assistant' | 'system'`. System messages carry `kind: 'sentinel_advisory'` and props.
- **Server: `packages/agent/src/agent.ts`** — when SENTINEL preflight returns advisory result and `SENTINEL_MODE === 'advisory'`, emit a single SSE event `{ type: 'sentinel_advisory', action, amount, severity, description }` BEFORE the regular tool execution proceeds. ~10 lines, no agent-loop refactor.

**Important scoping note:** This is the *light* version. Tool execution is NOT paused — the SSE event is purely informational, and the user's "Override" / "Cancel" buttons fire client-side actions. PR 2b (later) replaces this light wiring with proper server-side pause/resume.

**Override button:** sets chat input to `"Yes, proceed anyway"` and triggers `sendMessage()`. SIPHER's next turn will rerun the same tool because the LLM context now includes user affirmation.

**Cancel button:** marks the system message `dismissed: true` (added field), hides the card. No backend action — light version assumes the LLM will figure out the user backed off from context.

### Item 2-C — ConfirmCard vault quick-actions (PR 2a)

**Files touched:**
- `app/src/views/VaultView.tsx` — add Deposit + Withdraw buttons, three-step flow state.
- `app/src/components/AmountForm.tsx` — **new.** ~40 lines, controlled input + Continue/Cancel buttons.

**Three-step flow:**
1. Initial: `[+ Deposit]` `[↗ Withdraw]` buttons visible above existing vault content.
2. Amount: clicking opens `<AmountForm action="Deposit" max={walletBalance} onSubmit={...} onCancel={...} />`. Validation: positive number, ≤ `walletBalance` for Deposit, ≤ `vaultBalance` for Withdraw.
3. Confirm: `<ConfirmCard action="Deposit" amount="1.0 SOL" onConfirm={...} onCancel={...} />`. Confirm → `seedChat("deposit 1.0 SOL to vault")`. Cancel → returns to step 1.

**Action dispatch via chat:** Confirm invokes the `seedChat()` action introduced in PR 1. SIPHER agent runs the existing `deposit`/`withdrawPrivate` tool. No new REST endpoints — the vault tools already exist agent-side.

### Item 5 — HERALD Edit endpoint + UI (PR 2a)

**Files touched:**
- `packages/agent/src/routes/herald-api.ts` — add `heraldRouter.patch('/queue/:id', ...)` route.
- `packages/agent/src/services/herald-queue.ts` — add `updateContent(id, content)` action.
- `app/src/views/HeraldView.tsx` (`QueueTab`) — wire Edit button to inline textarea state.

**Endpoint contract:**
- **Request:** `PATCH /api/herald/queue/:id` with body `{ content: string }`.
- **Validation (zod):** `content: z.string().trim().min(1).max(280)` — Twitter limit.
- **Response (200):** `{ id, content, scheduled_at, status, created_at, updated_at }`.
- **Errors:** `400 INVALID_CONTENT` (zod fail), `404 NOT_FOUND` (id unknown), `403 UNAUTHORIZED` (not admin — inherited from `requireOwner`).
- **Audit emission:** `bus.publish('herald.edited', { id, oldContent, newContent, by: req.wallet })` so the dashboard activity stream shows edits.

**UI inline edit:** Local state `editingId: string | null` and `editDraft: string`. Click Edit → `setEditingId(item.id); setEditDraft(item.content)`. While editing: that item's `<p>` becomes `<textarea value={editDraft}>` + Save / Cancel buttons (replacing the action button row). Save → PATCH → on success → exit edit mode + `load()` refresh. Cancel → exit edit mode without saving.

### Item 6 — `<AdminOnly>` wrapper + DashboardView refactor (PR 1)

**Files touched:**
- `app/src/components/AdminOnly.tsx` — **new.**
- `app/src/views/DashboardView.tsx` — replace 4 `{isAdmin && (...)}` blocks with `<AdminOnly>` wraps.

**Component:**
```tsx
import type { ReactNode } from 'react'
import { useIsAdmin } from '../hooks/useIsAdmin'

export default function AdminOnly({ children, fallback = null }: {
  children: ReactNode
  fallback?: ReactNode
}) {
  return useIsAdmin() ? <>{children}</> : <>{fallback}</>
}
```

**Migration:** the data-fetching `useEffect` (DashboardView.tsx:64-87) cannot be wrapped — it's a hook side-effect, not a render path. Keep the existing `if (isAdmin)` guard inside the effect, but use `useIsAdmin()` directly instead of the prop pattern.

### Item 2-B-heavy — SENTINEL server pause/resume (PR 2b)

**Files touched:**
- `packages/agent/src/services/sentinel-pending.ts` — **new.** In-memory flag store with timeout.
- `packages/agent/src/agent.ts` (or wherever `executeTool` runs) — preflight gate hook.
- `packages/agent/src/routes/sentinel.ts` — **new.** REST endpoints.
- `packages/agent/src/index.ts` — mount `/api/sentinel` router.
- `app/src/components/SentinelConfirm.tsx` — **new.** Wraps `<ConfirmCard variant="warning">` with REST POST handlers.
- `app/src/components/ChatSidebar.tsx` — handle new `sentinel_pause` SSE event.

**`sentinel-pending.ts` shape:**
```ts
interface PendingFlag {
  sessionId: string
  toolName: string
  toolInput: unknown
  createdAt: number
  resolver: (value: void) => void
  rejecter: (reason: string) => void
  timeoutHandle: NodeJS.Timeout
}

const TIMEOUT_MS = 120_000
const pending = new Map<string, PendingFlag>()

export function createPending(sessionId, toolName, toolInput): {
  flagId: string
  promise: Promise<void>
} { /* ... */ }
export function resolvePending(flagId: string): boolean { /* ... */ }
export function rejectPending(flagId: string, reason: string): boolean { /* ... */ }
export function clearAll(sessionId: string): void { /* ... */ }
```

**Agent loop hook:** when SENTINEL preflight returns `{ severity: 'high' | 'critical', mode: 'advisory' }`:
1. `const { flagId, promise } = createPending(sessionId, name, input)`.
2. Emit SSE: `{ type: 'sentinel_pause', flagId, action, amount, severity, description }`.
3. `await promise` — suspends the tool call.
4. On resolve → continue tool execution as if SENTINEL hadn't flagged.
5. On reject → push synthetic tool result `{ status: 'cancelled_by_user', reason }` to the LLM, which produces a graceful continuation message.

**Disconnect handling:** the chat-stream endpoint handles `req.on('close', ...)` already (per Phase 0 SSE work) — extend that handler to call `clearAll(sessionId)`, rejecting all pending with `'client_disconnected'`.

**REST routes:**
- `POST /api/sentinel/override/:flagId` → `resolvePending(flagId)`. Returns 204 / 404 / 410-expired.
- `POST /api/sentinel/cancel/:flagId` → `rejectPending(flagId, 'cancelled_by_user')`. Returns 204 / 404 / 410.
- Mounted with `verifyJwt + requireOwner` (admin-only).

**Client `<SentinelConfirm>`:** thin wrapper around `ConfirmCard variant="warning"` that wires Override/Cancel buttons to the REST endpoints. Override resolves → server resumes streaming, no UI re-render needed beyond hiding the card. Cancel rejects → server emits synthetic tool_result + LLM continuation.

**Replaces PR 1's light wiring:** when PR 2b ships, remove the `sentinel_advisory` SSE emission from `agent.ts` (introduced in PR 1). Replace with `sentinel_pause`. Update ChatSidebar to handle the new event type. The light Override/Cancel client actions are deleted in favor of the REST POSTs.

## Testing

| PR | Tests added |
|---|---|
| **PR 1** | RTL: `MetricCard` hero variant render, `EventIcon` mapping fallback, `ToolTimeline` empty/multi-tool, `AdminOnly` auth states, `ConfirmCard` warning variant. Vitest: 1 server-side test for `sentinel_advisory` SSE emission. |
| **PR 2a** | Vitest: `herald-queue.updateContent()` happy/not-found/invalid. REST: PATCH integration (auth, validation, 404). RTL: `AmountForm` validation, `VaultView` step transitions, `QueueTab` edit mode (textarea, save/cancel). |
| **PR 2b** | Vitest: `sentinel-pending` create/resolve/reject/timeout/clearAll. REST integration: override/cancel routes. RTL: `SentinelConfirm` button POST behaviors (mock fetch). E2E (Playwright spec, skipped until #1077 fixed): full chat → flag → override → tool runs flow. |

**Coverage gate:** per Phase 1 CI policy, new code must maintain 80%+ coverage. Existing `pnpm --filter @sipher/app test` and root vitest commands suffice.

## Error handling

| Surface | Pattern |
|---|---|
| **REST errors** | `{ error: { code, message } }` shape (existing convention). New codes: `INVALID_CONTENT`, `NOT_FOUND`, `EXPIRED`, `UNAUTHORIZED`. |
| **Client fetch errors** | `apiFetch` throws `Error(message)`. Component-level catch → local `error` state → inline error chip (existing HeraldView pattern at line 376-378). |
| **SSE event errors** | `event.type === 'error'` already handled. `sentinel_pause` timeout → server emits synthetic `tool_result { status: 'timeout' }` → LLM produces user-facing text. |
| **Form validation** | Inline below input (red text, 11px, mono). No modals. |
| **Network failures** | Metric cards show `'—'`. Chat shows "Connection failed" toast (existing). |
| **Optimistic UI** | None this phase. All writes wait for server confirmation. |

## Deployment & rollout

| PR | Deploy strategy |
|---|---|
| **PR 1** | Standard merge → main → CI builds Docker → GHCR push → SSH deploy → `docker compose up`. Zero migrations, zero feature flags. |
| **PR 2a** | Same path. New `PATCH /api/herald/queue/:id` is additive — no breaking change. |
| **PR 2b** | Same path. Behind existing `SENTINEL_MODE` env (default `advisory` in prod). For soft-launch: temporarily set `SENTINEL_MODE=yolo`, merge, observe, flip back. |

**Rollback:** each PR independently revertable. PR 2b carries the most risk (agent-loop change) — keep landing window short (few hours of observation) before assuming stable.

**No DB migrations.** All state changes in-memory (`herald-queue` Map, `sentinel-pending` Map). Restart wipes ephemeral state — acceptable for short-lived workflow state.

## Migration concerns

- **PR 1 store change:** `ChatMessage.tools` is additive optional. Persisted localStorage state needs no migration (undefined `tools` = empty timeline).
- **PR 2a queue store:** existing `queue` items lack `updated_at` — backfill with `Date.now()` on first PATCH; default to `created_at` for unedited items.
- **PR 2b SENTINEL pause persistence:** if a flag is created and the server restarts before the user decides, the pending flag is lost — client gets no resume signal. Mitigation: client treats `sentinel_pause` cards >5min old as stale → dismiss with "Server restarted, please retry." Future work: persist to SQLite if real users hit this.

## Acceptance criteria

**PR 1:**
- [ ] Privacy Score card displays computed score + grade chip + 4 factor bars when `vault.wallet` is loaded.
- [ ] Score color changes by grade tier (A=green … F=red).
- [ ] Card click opens chat with seeded prompt; SIPHER agent answers with explanation.
- [ ] Score auto-refreshes within 5s of any `(send|swap|claim|refund|deposit).success` event.
- [ ] Activity stream entries show Phosphor icons mapped from `event.type`.
- [ ] Live SSE events pulse; historical entries don't.
- [ ] Chat assistant messages with tool calls show timeline header above text with name, sanitized args, duration.
- [ ] Sensitive args (private keys, mnemonics) are redacted in display.
- [ ] When `SENTINEL_MODE=advisory` and a flag fires, ConfirmCard renders inline in chat with override/cancel.
- [ ] DashboardView's 4 admin guards now use `<AdminOnly>` wraps.
- [ ] All RTL component tests pass; root + app Vitest suites green.

**PR 2a:**
- [ ] `PATCH /api/herald/queue/:id` accepts content updates with zod validation.
- [ ] Edit button toggles inline textarea + Save/Cancel.
- [ ] Save → PATCH → refreshed list shows updated content.
- [ ] VaultView shows Deposit + Withdraw buttons.
- [ ] Three-step flow (Initial → Amount → Confirm) works for both actions.
- [ ] Confirm dispatches via `seedChat()`; SIPHER runs the existing tool.
- [ ] All Vitest + RTL tests pass.

**PR 2b:**
- [ ] In `SENTINEL_MODE=advisory`, risky tool calls pause execution and emit `sentinel_pause` SSE event.
- [ ] `POST /api/sentinel/override/:flagId` resumes; tool completes successfully.
- [ ] `POST /api/sentinel/cancel/:flagId` rejects; LLM produces "operation cancelled" message.
- [ ] 120s timeout auto-cancels with "operation timed out" if no decision.
- [ ] Client disconnect triggers `clearAll(sessionId)` server-side.
- [ ] PR 1's light `sentinel_advisory` wiring is removed; `sentinel_pause` replaces it.
- [ ] Playwright E2E spec exists (skipped pending #1077 fix).

## Out of scope (deferred or rejected)

- Privacy score time-based auto-refresh — RPC cost concern, not justified.
- Optimistic UI for any write path — adds reconciliation complexity.
- Cross-browser test matrix — Phase 1 decision stands (Chromium only).
- Persistent SENTINEL pending store (SQLite) — only if real users hit the restart edge case.
- HERALD edit history view — out of scope; emit edit events only.
- Vault deposit/withdraw direct REST endpoints — chat-as-trigger is YAGNI-correct.
- Visual regression testing.

## Open questions

None — all design decisions resolved during 2026-04-26 brainstorm.

---

**Next step:** invoke `superpowers:writing-plans` to break this into a step-by-step implementation plan across 3 PRs.
