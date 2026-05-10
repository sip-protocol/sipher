# PR 8 — Admin Views Restyle (Glass-Neon Sprint)

**Date:** 2026-05-10
**Branch:** `feat/redesign-admin`
**Worktree:** `.worktrees/feat-redesign-admin/`
**Sprint:** Phase 4b Glass-Neon Redesign — PR 8 of 9
**Predecessor:** PR 7 (Keys + Settings) — merged via #186 (`7a29d95`) on 2026-05-09
**Successor:** PR 9 (ROADMAP + Phase D launch prep)

## Goal

Apply the glass-neon visual language to the three admin surfaces — Herald, Squad/SENTINEL, SentinelConfirm — using identity colors per agent (Herald = blue, Sentinel = amber). Migrate Herald, Squad, and Settings out of the public main nav into the Header avatar dropdown per Spec D8. Migrate legacy Tailwind aliases (`bg-card`, `border-border`, `bg-red/yellow/green`) to the new design system tokens (`bg-glass-1`, `border-line`, semantic state tokens) across all touched files.

## Locked decisions

### D1 — Admin views migrate from main nav to Header avatar dropdown

PR 7 left `herald`, `squad`, and `settings` as `adminOnly: true` tabs in `NAV_ITEMS` for continuity. PR 8 honors Spec D8 literally: those three views move OUT of `NAV_ITEMS` into a new admin section inside the Header `<UserMenu>` (renamed from `<WalletDropdown>`).

**Rejected alternatives:**
- *Hybrid (Settings stays as nav tab, Herald + Squad to dropdown).* Cleaner conceptual separation but contradicts Spec D8 which lists exactly 6 nav items.
- *Keep PR 7 pattern (all three stay as adminOnly tabs).* Zero IA churn but explicitly contradicts D8 — would need to be undone before Phase D launch anyway.

**Why:** Public IA stays clean (5 nav items + Chat tablet-only); admin operations live where universal app patterns put them (avatar dropdown). Backend admin gates already enforce security; nav location is purely UX.

**How to apply:** When restyling Herald/Squad/Settings, treat them as standalone surfaces reachable from `<UserMenu>` (and from `BottomNav` mobile drawer, unchanged).

### D2 — Accent-only color application strategy

Identity colors (`--color-herald`, `--color-sentinel`) appear on chips, status pills, sub-tab active underlines, and hero CTAs. Cards stay neutral (`bg-glass-1` / `border-line`). No bulk soft-tinted card backgrounds, no border-herald/40 borders on every container.

**Rejected alternatives:**
- *Accent + soft card backgrounds.* Hero card gets soft tint. Slightly more visual brand but trends toward over-tinting; adds inconsistency between hero card and rest.
- *Full identity coloring.* Every card gets soft tint, every border gets identity color. Strong brand per view but fights readability of dense data tables and charts.

**Why:** Accent-only matches the spec wording ("accents") and preserves Sipher's overall neutral-glass aesthetic. Identity colors signal "this is HERALD's screen" / "this is SENTINEL's screen" without overwhelming.

**How to apply:** Reach for `<Chip tone="herald">` or `<Chip tone="sentinel">` for state pills and view eyebrows. Use `bg-herald` / `text-herald` / `border-herald/40` only for active states (sub-tab underline, hero CTA hover) — not as ambient backgrounds.

### D3 — SentinelConfirm restyles inline (no Sheet wrap)

The sprint-plan sketch said "Sheet primitive for the confirmation modal," but the current implementation is INLINE inside `ChatSidebar.tsx:167` as a `<ConfirmCard variant="warning">`, not a modal. PR 8 keeps the inline layout and only restyles `ConfirmCard` warning-variant tones from yellow to sentinel.

**Rejected alternatives:**
- *Promote to Sheet (auto-open over chat).* Spec-literal. But: dual surface (chat + Sheet) confuses source-of-truth; auto-opening sheets are a UX risk if the user dismisses; loses chat-history audit trail of "SENTINEL paused at 14:32".
- *Replace ConfirmCard with Sheet content entirely.* Drops the inline confirm card, loses chat-history visibility of confirmations.

**Why:** Inline ConfirmCard already provides attention-grab in context (it interrupts the chat flow visually). Promoting to Sheet adds layout complexity without meaningfully improving UX.

**How to apply:** `ConfirmCard.tsx` `variant="warning"` path: replace yellow tones with sentinel tones throughout. `SentinelConfirm.tsx` wrapper unchanged. Normal-variant ConfirmCard (used by non-Sentinel confirmations) stays sipher-toned.

### D4 — Full legacy token migration of touched files

All legacy Tailwind aliases in HeraldView.tsx, SquadView.tsx, ConfirmCard.tsx, and SentinelConfirm.tsx migrate to new design system tokens. Sprint memory: "Each later restyle PR can migrate its callers; once empty the alias block disappears."

**Rejected alternatives:**
- *Identity-color migration only.* Smaller diff but leaves alias usage in restyled files — future PRs still need to clean up.
- *Pure accent addition, zero migration.* Smallest diff, but mixes new tokens and legacy aliases inconsistently in the same files.

**Why:** Touching these files anyway; one pass is cleaner than two. Reduces total alias usage substantially in a single PR.

**How to apply:** Use the migration table in §4 below as the literal mapping. Visual output should be identical or nearly so (legacy aliases resolve to the same colors); changes are nominal/semantic.

### D5 — Mobile BottomNav drawer unchanged

`BottomNav.tsx:95-130` already shapes the admin drawer correctly: Keys (always), then Herald/Squad/Settings (when `isAdmin`), then Disconnect. PR 8 is a desktop Header rework only.

**Why:** Mobile already follows the avatar-dropdown pattern via the More-drawer "..." button. No code change needed; just verify post-Header changes that the mobile flow is intact.

### D6 — URL deep-linking deferred to a future PR

`/herald`, `/squad`, `/settings` URL routes are mentioned in Spec D8 but require adding a router library (or hand-rolled router) — too big for a restyle PR. Navigation continues to use `setActiveView()` Zustand state.

**Why:** PR 8 is a visual/IA PR. Routing is a separate architectural concern with its own design space (history API, browser back-button semantics, deep-link recovery from cold load, etc.). Defer to a later PR with its own brainstorm.

## Architecture

### Net IA shift on desktop Header

Before:
```
[SIPHER · network · ticker]  Dashboard | Vault | Chains | Keys | Chat |
                             Herald | Squad | Settings (adminOnly tabs)
                                                               [Ask SIPHER · agent dots · WalletDropdown ▼]
```

After:
```
[SIPHER · network · ticker]  Dashboard | Vault | Chains | Keys | Chat
                                                               [Ask SIPHER · agent dots · UserMenu ▼]
                                                                                            │
                                                                                            ├── Admin (eyebrow, isAdmin only)
                                                                                            │   ├── ⚙ Settings
                                                                                            │   ├── 📡 Herald
                                                                                            │   └── 👥 Squad
                                                                                            │   ──── divider ────
                                                                                            ├── ⎘ Copy address
                                                                                            ├── ↻ Re-sign in
                                                                                            └── ⏻ Disconnect
```

`NAV_ITEMS` shrinks from 8 to 5 entries (`dashboard`, `vault`, `chains`, `keys`, `chat`). The `adminOnly?: boolean` field on the `Tab` interface and the `visibleTabs` filter are removed (no admin tabs left to filter).

### Defense-in-depth admin gating (three layers)

1. `<UserMenu>` admin section conditional on `isAdmin` (UI surface)
2. `HeraldView` and `SquadView` gain component-level redirect (matching `SettingsView.tsx:40-69`): if `!isAdmin`, call `setActiveView('dashboard')` and return null
3. Backend endpoints (`/api/squad`, `/api/squad/kill`, `/api/sentinel/config`) already enforce `requireOwner` (security boundary)

This closes a real gap: `SettingsView` had this redirect (PR 7), but `HeraldView` and `SquadView` rendered fully even for non-admin users who landed on them via stale state.

### No backend changes

PR 8 is `app/` only. No SDK, no agent, no contract changes. Agent test count stays at 1399.

## Components

### `UserMenu.tsx` (renamed from `WalletDropdown.tsx`)

**File:** `app/src/components/UserMenu.tsx` (rename) and `app/src/components/__tests__/UserMenu.test.tsx` (rename).

**Props additions:** `isAdmin: boolean` and `onNavigate: (view: 'settings' | 'herald' | 'squad') => void`.

**Dropdown structure:**
```
[address pill button] ▼
┌─────────────────────────┐
│ ADMIN                   │  ← eyebrow, only when isAdmin
│ ⚙ Settings              │
│ 📡 Herald               │
│ 👥 Squad                │
│ ─────────────────────── │  ← divider (only when isAdmin)
│ ⎘ Copy address          │
│ ↻ Re-sign in            │
│ ⏻ Disconnect            │
└─────────────────────────┘
```

Eyebrow uses `text-2xs text-text-muted tracking-widest uppercase` (per PR 7 gotcha #10). Admin section icons: `Gear`, `Broadcast`, `UsersThree` from `@phosphor-icons/react` — same icons that were in `NAV_ITEMS`. Wallet section unchanged.

When `isAdmin === false`, only the wallet section renders (current behavior preserved for non-admin users).

### Header.tsx changes

- Remove `Broadcast`, `UsersThree`, `Gear` imports.
- `TABS: Tab[]` shrinks to 5 entries: `dashboard`, `vault`, `chains`, `keys`, `chat` (chat keeps `tabletOnly: true`).
- `Tab` interface drops `adminOnly?: boolean` field.
- `visibleTabs` filter removed (or simplified to just the `tabletOnly` filter if needed).
- `WalletDropdown` import → `UserMenu`. Pass `isAdmin` and `onNavigate={setActiveView}` plus existing `address`/`onCopy`/`onReSignIn`/`onDisconnect` props.

### HeraldView.tsx restyle (subagent task)

**Migrations** (~30 legacy occurrences): see §4 migration table below.

**Herald accents added:**
- Sub-tab active underline already `bg-herald` (line 106) — preserved.
- Queue item action buttons (lines 305, 330): currently green/border-green. Keep `success` semantic — these are "approve" actions where success is the right intent.
- DM intent pills (lines 376, 380): migrate green/yellow → success/warning semantics.
- Optionally a `<Chip tone="herald">HERALD</Chip>` view eyebrow if it reads natural; subagent may exercise judgment.

**Admin redirect added:** matches SettingsView.tsx pattern (see §3 Architecture).

### SquadView.tsx restyle (subagent task)

**Migrations** (~10 legacy occurrences): see §4.

**Sentinel accents added:**
- Add a header eyebrow `<Chip tone="sentinel">SENTINEL</Chip>` to identify the view (the view title/eyebrow is currently absent — adding minimal identity).
- AgentGrid cards: `border-line` only; keep neutral `bg-glass-1`. Inline `style={{ color: agent.color }}` runtime style preserved (per-agent unique colors from AGENTS map).
- StatsGrid: `bg-glass-1` + `border-line`. Stat values stay `text-text` (universal counters; sentinel-coloring them is over-tinting).
- KillSwitch active state: `border-success/30 text-success hover:bg-success-soft`. Inactive state: `border-danger/30 text-danger hover:bg-danger-soft hover:border-danger`. Error banner: `bg-danger-soft border-danger/20 text-danger`.

**Admin redirect added:** matches SettingsView.tsx pattern.

### ConfirmCard.tsx + SentinelConfirm.tsx restyle (subagent task)

`ConfirmCard.tsx` `variant="warning"` semantic shift (yellow → sentinel):
- `borderClass`: `border-yellow/40` → `border-sentinel/40`
- `primaryClass`: `border-yellow/50 text-yellow hover:bg-yellow/10` → `border-sentinel/50 text-sentinel hover:bg-sentinel-soft`
- Warning icon: `text-yellow` → `text-sentinel`
- `bg-card` → `bg-glass-1`
- Cancel button `border-elevated` → `border-line`

`ConfirmCard.tsx` `variant="normal"` path stays sipher-toned (unchanged).

`SentinelConfirm.tsx`: error display `text-red` → `text-danger`. Wrapper layout untouched. Component remains inline in `ChatSidebar.tsx:167`.

## Data flow + admin gating

No store/state shape changes. `useAppStore.activeView` and `useAuthState` interfaces are untouched.

```
useAuthState() ──┬─→ status, publicKey, isAdmin ──→ Header
                 │
Header ──────────┼─→ <UserMenu address={publicKey} isAdmin={isAdmin}
                 │       onNavigate={setActiveView}
                 │       onCopy/onReSignIn/onDisconnect={existing handlers} />
                 │
UserMenu ────────┴─→ click "Settings" → onNavigate('settings') → setActiveView('settings')
```

`HeraldView` + `SquadView` admin-redirect pattern (matches `SettingsView.tsx:40-69`):

```tsx
const { token, isAdmin } = useAuthState()
const setActiveView = useAppStore((s) => s.setActiveView)

useEffect(() => {
  if (!isAdmin) {
    setActiveView('dashboard')
    return
  }
  // ... existing data fetch
}, [isAdmin, token, setActiveView])

if (!isAdmin) return null
```

## Token migration table

### Mapping (applies across all 4 touched files)

| Old token | New token | Semantic note |
|---|---|---|
| `bg-card` | `bg-glass-1` | neutral surface card |
| `bg-elevated` | `bg-glass-2` | elevated/inset surface |
| `border-elevated` | `border-line` | border using line color (not bg fill) |
| `border-border` | `border-line` | standard hairline border |
| `bg-red` / `text-red` | `bg-danger-soft` / `text-danger` | semantic danger state |
| `bg-red/N` / `border-red/N` | `bg-danger/N` / `border-danger/N` | opacity preserved (Tailwind syntax) |
| `bg-green` / `text-green` | `bg-success-soft` / `text-success` | semantic success state |
| `bg-green/N` / `border-green/N` | `bg-success/N` / `border-success/N` | opacity preserved |
| `bg-yellow` / `text-yellow` (semantic) | `bg-warning-soft` / `text-warning` | HeraldView budget bar / generic warning state |
| `bg-yellow` / `text-yellow` (sentinel-specific) | `bg-sentinel-soft` / `text-sentinel` | **ConfirmCard `variant="warning"` only** — semantic shift: yellow here is SENTINEL's color |
| inline `style={{ color: agent.color }}` | unchanged | runtime AGENTS map; preserved |

### Per-file scope

**`HeraldView.tsx`** (472 LOC, ~30 legacy occurrences across budget bar, sub-tabs, agent grid, DM cards, queue cards, action buttons, error banner). All semantic state colors (success/warning/danger). Sub-tab `bg-herald` underline preserved.

**`SquadView.tsx`** (262 LOC, ~10 legacy occurrences across agent grid, stats grid, code-span pill, KillSwitch, error banner). KillSwitch toggles between success and danger semantics. Inline `agent.color` runtime style preserved.

**`ConfirmCard.tsx`** (63 LOC, 4 legacy occurrences). Yellow → sentinel for `variant="warning"` only. Normal variant unchanged.

**`SentinelConfirm.tsx`** (58 LOC, 1 legacy occurrence). Error display only.

## Testing strategy

Per Approach A (subagent fan-out with TDD discipline): every subagent task starts with a failing test, then implements, then confirms passing.

### Existing tests inventory

| File | Status |
|---|---|
| `Header.test.tsx` (5.8k) | needs updates — admin tabs no longer in `TABS` |
| `WalletDropdown.test.tsx` (4.2k) | rename to `UserMenu.test.tsx` + extend |
| `ConfirmCard.test.tsx` (1.5k) | needs sentinel-tone assertions for warning variant |
| `SentinelConfirm.test.tsx` (4.6k) | needs `text-danger` assertion update |
| `BottomNav.test.tsx` (3.0k) | likely no change |
| `HeraldView-edit.test.tsx` (2.4k) | likely safe (semantic queries) |
| `SquadView.test.tsx` | **does not exist** — PR 8 adds bare-minimum coverage |

### Updated tests

1. `Header.test.tsx` — replace `WalletDropdown` references with `UserMenu`; remove admin-tab assertions; add assertion that admin tabs are NOT rendered for admin user (they're in dropdown now).
2. `UserMenu.test.tsx` (renamed) — preserve all wallet-op tests; add 5 new tests:
   - Admin section visible when `isAdmin={true}`
   - Admin section hidden when `isAdmin={false}` (only wallet section renders)
   - Click "Settings" → `onNavigate` called with `'settings'` and dropdown closes
   - Click "Herald" → `onNavigate` called with `'herald'`
   - Click "Squad" → `onNavigate` called with `'squad'`
3. `ConfirmCard.test.tsx` — update warning-variant test to assert `border-sentinel/40` / `text-sentinel` (was `border-yellow/40` / `text-yellow`). Normal-variant test unchanged.
4. `SentinelConfirm.test.tsx` — update error-display assertion to `text-danger` (was `text-red`).

### New tests

5. `HeraldView` admin-redirect test — non-admin renders → `setActiveView('dashboard')` called + view returns null. (Append to `HeraldView-edit.test.tsx` or create `HeraldView.test.tsx`.)
6. `SquadView.test.tsx` (new file) — minimum coverage:
   - Admin redirect when `!isAdmin`
   - Sentinel eyebrow chip renders
   - KillSwitch active state uses success tones; inactive uses danger tones (regression guard for the migration)

### Acceptance criteria

- App tests: 330 → ~343 (+13 net: 8 new tests, 5 updates that don't add count)
- Agent tests: 1399 unchanged (no BE changes)
- TSC: clean (`cd app && npx tsc --noEmit`)
- Build: `pnpm build` succeeds
- CI: 7/7 green (Vercel, Vercel Preview Comments, component, playwright, test, Scan for secrets, build-and-push, deploy)

### Manual smoke (Vercel preview)

- Admin user: address dropdown shows ADMIN section above wallet section; clicking each admin item navigates to the right view; dropdown closes after click.
- Non-admin user: dropdown shows only wallet section; no admin tabs visible anywhere; admin views redirect to dashboard if accessed via stale state.
- HeraldView: budget bar colors render correctly across success/warning/danger states.
- SquadView: KillSwitch shows success tones when active, danger tones when paused.
- SentinelConfirm in chat: amber "Risk Confirm" eyebrow, "Override & Send" button uses sentinel tones (not yellow).
- Mobile (Seeker or browser dev tools mobile mode): BottomNav More-drawer Keys/Herald/Squad/Settings all navigate correctly.

## Out of scope (explicit deferrals)

- URL routing / deep-linking (`/herald`, `/squad`, `/settings`) — future PR.
- Mobile BottomNav reshape — already correctly structured, no change.
- Other view restyles (ChatSidebar, DashboardView, VaultView, etc.) — out of PR 8 scope; PR 9 is ROADMAP + Phase D.
- `<UserMenu>` Tab-key traversal between admin and wallet sections — preserves existing keyboard behavior (Escape close, outside-click close); doesn't add full accessible-menu-pattern Tab navigation.
- Agent identity colors beyond Herald + Sentinel — `--color-sipher` and `--color-courier` remain unused in PR 8.
- `AGENTS.color` runtime map migration — inline `style={{ color: agent.color }}` preserved; not migrated to token classes (each agent has unique hex).
- Sheet primitive promotion for SentinelConfirm — see D3.

## Task sequence (Approach A — per-view subagent fan-out)

| # | Task | Mode | Approx LOC delta |
|---|---|---|---|
| 1 | Rename `WalletDropdown.tsx` → `UserMenu.tsx`, extend with admin section. Update Header.tsx (drop adminOnly tabs, swap import, pass new props). Rename test file. | INLINE | +60 / -20 |
| 2 | BottomNav verify (read-only audit; expected zero code changes) | INLINE | 0 |
| 3 | HeraldView restyle: token migration + herald accents + admin redirect. TDD-driven. | Subagent + 2-stage review | ~40 line edits |
| 4 | SquadView restyle: token migration + sentinel eyebrow chip + admin redirect + new test file. TDD-driven. Parallel with #3. | Subagent + 2-stage review | ~30 line edits + new test file |
| 5 | ConfirmCard + SentinelConfirm restyle (sentinel tones for warning variant; text-danger for error). Update existing tests. | Subagent + 2-stage review | ~10 line edits |
| 6 | Run full test suite + tsc + lint. Open PR. | INLINE | — |

Tasks 3 and 4 dispatch in parallel (independent files, no shared state). Task 5 may dispatch in parallel too if desired.

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| `Header.test.tsx` breaks unexpectedly during NAV_ITEMS migration | Run `Header.test.tsx` immediately after Task 1 INLINE; treat as gate before dispatching subagents |
| Subagent over-scopes into accent saturation (full identity coloring instead of accent-only) | Explicit reminder in subagent prompt: "Accent-only per D2 — chips, status pills, hero CTAs only. Cards stay neutral." |
| Color migration accidentally breaks semantic states (e.g., "approve" button becomes danger) | TDD discipline: each subagent writes a regression test for at least one color-state assertion before changing classes |
| Mobile drawer regressions from Header changes | `BottomNav.test.tsx` covers drawer; run after Task 1 |
| HeraldView 472 LOC subagent run blows context | Subagent should focus on one section at a time (BudgetBar / SubTabs / ActivityTimeline / QueueTab / DMsTab); commit per section if needed |
| AbortController / setTimeout patterns in HeraldView drift during restyle | Preserve existing `useEffect` cleanup patterns; don't refactor lifecycle during restyle |
| `WalletDropdown` rename triggers import-chain ripple | Single consumer is `Header.tsx` (verified via grep); confirm again post-rename |

## Pre-merge gates

1. App tests: 330 → ~343, all pass
2. Agent tests: 1399 unchanged
3. `npx tsc --noEmit` clean
4. `pnpm build` succeeds
5. CI 7/7 green
6. Vercel preview deploys; manual smoke checklist passes
7. PR description references this spec + Sprint Plan PR 8 outline (lines 3296-3313)
8. After merge: switch to main BEFORE `gh pr merge` (carry-forward gotcha #15) to avoid worktree-owns-branch quirk; sync local main, remove worktree, delete local branch

## Coupling to broader sprint

- **Phase D entry gate.** PR 8 is the penultimate sprint PR. Visible identity colors on Herald/Squad/SentinelConfirm align with X thread #1 launch narrative ("our agents have personality").
- **Sprint memory update.** After merge, update `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md` PR 8 row to MERGED with merge SHA + narrative.
- **PR 9 dependency.** PR 9 is ROADMAP rewrite + Phase D launch prep — it expects all prior PRs (including PR 8) to be live in production. PR 9 can begin while PR 8 is in review if desired.

## References

- Sprint plan PR 8 outline: `docs/superpowers/plans/2026-05-07-glass-neon-redesign.md` lines 3296-3313
- Spec D8: `docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md` lines 102-106
- Sprint memory: `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`
- Predecessor handoff: `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-09-c.md`
- PR 7 spec: `docs/superpowers/specs/2026-05-09-pr7-keys-settings-design.md` (`<Chip>` primitive contract, `Sheet` primitive contract, `useAuthState` shape)
