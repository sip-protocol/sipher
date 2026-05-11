# QA Sweep — Tier 4 (Independent Leaves) — Design

**Date:** 2026-05-11
**Session:** frontier_49
**Status:** Approved (RECTOR, this session)
**Predecessor:**
  - Handoff: `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-11-b.md`
  - Tier 3 spec: `docs/superpowers/specs/2026-05-11-qa-sweep-tier-3-design.md`
  - Tier 2 spec: `docs/superpowers/specs/2026-05-10-qa-sweep-tier-2-design.md`
  - Tier 0+1 spec: `docs/superpowers/specs/2026-05-10-qa-sweep-tier-0-1-design.md`
  - QA report: `~/Documents/secret/qa-reports/sipher/1778399617-both-fresh+skeptic/report.md`
  - Sprint memory: `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`
**Scope:** 24 issues (18 leaves + 6 followups) of 33-issue QA sweep — DAG Tier 4
**Out of scope (this session):** Phase D launch-gate close (`/quality:qa --diff-from`, 3-wallet QA, X thread #1)
**Estimated work-time:** 16-24h across 6 PRs (3+3 waves)

---

## Why this slice

Tier 0+1 (frontier_46) shipped auth-lifecycle foundations: test util, `onAuthClear` registry + 5 consumers, network-error banner, ChatSidebar 401 interceptor — 6 issues closed. Tier 2 (frontier_47) shipped unauthed UX: `<UnauthedEmptyState>` primitive, React Router 7 migration, onboarding content — 6 more issues closed. Tier 3 (frontier_48) shipped admin-view reliability: `useIsAdmin` delegation, AbortController-aware `load(signal?)` pattern in admin views, `mountedRef` for action-handler reloads — 3 more issues closed.

Tier 4 closes out the remaining **independent leaves** — 18 issues with no shared state or sequential dependencies, plus 6 polish followups filed during prior tiers. Once Tier 4 lands, `/quality:qa --diff-from=1778399617-both-fresh+skeptic` should show zero open issues, flipping the last automatable Phase D launch gate to green.

The 24 issues split into 6 thematic clusters (A–F) that can be parallelized via subagent fanout. Each cluster touches different files/concerns; cross-cluster overlap is minimal. The sprint runs as two waves of 3 parallel clusters each, with a mid-sprint sync gate.

---

## Locked decisions

| #   | Decision                                                                                                              | Source                          |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| D1  | Ship all 24 in 6-cluster fanout (A–F)                                                                                 | RECTOR via AskUserQuestion      |
| D2  | Wave-based 3+3 dispatch: Wave 1 = A+B+F (smallest/most-bounded), Wave 2 = C+D+E (heaviest)                            | RECTOR via AskUserQuestion      |
| D3  | All Wave 1 clusters use SUBAGENT mode (NOT INLINE for F — would context-crowd while A+B are also live)                | Spec — matches Phase 4b pattern |
| D4  | Each cluster = 1 PR by default; Cluster E may split into E1+E2 during mid-sprint brainstorm                           | RECTOR via AskUserQuestion      |
| D5  | Wave sync gate: All 3 PRs in Wave 1 merge to main before Wave 2 dispatches                                            | Spec — prevents overlap         |
| D6  | Two-stage review per subagent (spec-compliance THEN code-quality)                                                     | Carry-forward from Tiers 0–3    |
| D7  | When PrivacyScoreCard delta is null, render NEITHER the delta UI NOR the " vs last week" copy (strict-D10 invisible)  | RECTOR via AskUserQuestion      |
| D8  | RoutePreviewCard mainnet fallback copy: "Vault on mainnet coming soon"                                                | RECTOR via AskUserQuestion      |
| D9  | walletName cleanup mechanism: subagent investigates (wallet-adapter API vs direct localStorage)                       | RECTOR via AskUserQuestion      |
| D10 | Cluster C #206 SEO mechanism: native React 19 metadata (`<title>` + `<meta>` in components, auto-hoisted to `<head>`) | RECTOR via AskUserQuestion      |
| D11 | Wave 2 spec: append to this document after mid-sprint brainstorm (single source of truth for the whole tier)          | RECTOR via AskUserQuestion      |

---

## Wave 1 — Clusters A, B, F (parallel SUBAGENT dispatch)

### Cluster A — Hardcoded data cleanup (P1)

- **Branch:** `fix/hardcoded-data-cleanup`
- **Issues:** #195, #196, #197
- **Mode:** SUBAGENT (multi-file across 3 components)
- **Estimated:** 3-4h

**Issues + targets:**

- **#195 PrivacyScoreCard hardcoded `delta={4}` + orphan " vs last week":** `delta={4}` is hardcoded at `app/src/views/DashboardView.tsx` call site (not the component). " vs last week" copy is in `app/src/components/PrivacyScoreCard.tsx:70`. Existing test (`app/src/components/__tests__/PrivacyScoreCard.test.tsx:34`) asserts " vs last week" is present — must invert to `queryByText(/vs last week/) === null` when `delta == null`.
- **#196 RoutePreviewCard hardcoded devnet vault PDA:** `app/src/components/vault/RoutePreviewCard.tsx`. Derive PDA from `useNetworkConfigStore.config.network` + `@sipher/sdk` vault helpers.
- **#197 M19 placeholder copy:** `app/src/components/vault/StealthAddressList.tsx` (verified single-file location).

**Locked decisions (carry from spec):**

- D-A1 (= D7 above): When `delta == null`, wrap BOTH the delta `<span>` AND the " vs last week" `<span>` in `{delta != null && ...}`. Remove `delta={4}` prop from `DashboardView.tsx` call site. No em-dash, no "N/A" fallback.
- D-A2 (= D8 above): For mainnet (vault not yet deployed there), RoutePreviewCard renders empty state with copy "Vault on mainnet coming soon."
- D-A3: M19 placeholders removed entirely (per D10 from Phase 4b redesign spec — no mock data). If a section becomes empty after removal, render no UI rather than empty state placeholder.

**Test strategy:**

- `PrivacyScoreCard.test.tsx`: Update existing test asserting " vs last week" presence → invert to `queryByText(/vs last week/)` returning null when delta omitted. Add second test: when `delta={3}`, both delta UI AND label render.
- `RoutePreviewCard.test.tsx`: Add test for mainnet network → renders "Vault on mainnet coming soon" empty state. Add test for devnet → renders derived PDA from SDK.
- `StealthAddressList.test.tsx`: Verify no "M19" string in rendered output (grep-style assertion or explicit `queryByText(/M19/)` returning null).

**Risks:**

- RoutePreviewCard depends on `@sipher/sdk` — subagent must run `pnpm --filter @sipher/sdk build` in fresh worktree before app tests.
- `useNetworkConfigStore.config?.network` may be undefined on first mount (auth-pending state) — guard before mainnet/devnet branching.

**Out-of-scope guardrails for Cluster A subagent:**

- DON'T touch auth/session lifecycle (Cluster B territory)
- DON'T touch useSSE/apiFetch/onAuthClear (Cluster F territory)
- DON'T add SEO meta tags or accessibility primitives (Cluster C territory)
- DON'T touch Header / AmountForm / TickerBar (Cluster D territory)

---

### Cluster B — Auth/session UX (P1+P2)

- **Branch:** `fix/auth-session-ux`
- **Issues:** #203, #213
- **Mode:** SUBAGENT (subtle auth-lifecycle race conditions)
- **Estimated:** 2-3h

**Issues:**

- **#203 Duplicate "Session expired" toasts:** Multiple concurrent in-flight requests all fail with 401 → toast stacks N times. Root cause: AuthSyncProvider's 401 handler fires the toast on every 401 with no debounce/single-shot guard.
- **#213 walletName carryover in localStorage:** User clicks "Connect Phantom" → rejects in wallet popup → `walletName=Phantom` persists in localStorage (or wallet adapter persistence). On next page load, app auto-connects to a wallet user never actually authenticated with.

**Locked decisions:**

- D-B1: Session-expired toast deduplication via single-shot ref in AuthSyncProvider. Pattern: `sessionExpiredToastShownRef.current` flag set to `true` on first 401-triggered toast emission; reset to `false` on next successful auth or after a timeout (default 30s, subagent confirms). Concurrent 401s within the window emit only one toast.
- D-B2 (= D9 above): walletName cleanup mechanism — subagent investigates whether `@solana/wallet-adapter-react` exposes a programmatic disconnect-and-clear, OR whether direct localStorage cleanup is necessary. Subagent picks the cleaner path and documents the choice in the PR description.
- D-B3: Cleanup must hook into existing `onAuthClear` registry (from Tier 0+1). Wallet cleanup happens AFTER store auth-clear, NOT on initial mount (returning users with valid JWT should still auto-reconnect their wallet).

**Test strategy:**

- #203: Mock multiple concurrent 401 responses, assert toast count === 1 in the deduplication window.
- #213: Simulate user-cancels-wallet flow (wallet adapter mock returns connection-cancelled), assert localStorage `walletName` key cleared after `clearAuth` fires.
- Cleanup test: Returning user with valid JWT + persisted `walletName` should auto-connect normally (don't break the happy path).

**Risks:**

- Solana wallet adapter's `WalletProvider` has `autoConnect` prop — subagent must understand JWT-clear vs wallet-clear interaction to avoid breaking auto-reconnect for valid sessions.
- Multiple 401 toasts may indicate broader issue (AuthSyncProvider firing toast in two paths). Subagent investigates root before fixing symptom.
- localStorage key name is likely `walletName` or similar — actual key TBD by wallet adapter version. Subagent confirms via investigation.

**Out-of-scope guardrails for Cluster B subagent:**

- DON'T touch network-error event handling (Cluster F #227, #228)
- DON'T touch Header network defaults (Cluster D #208)
- DON'T modify PrivacyScoreCard / RoutePreviewCard (Cluster A)
- DON'T touch SEO / a11y primitives (Cluster C)

---

### Cluster F — Tech-debt followups

- **Branch:** `chore/tech-debt-followups`
- **Issues:** #225, #226, #227, #228, #234, #235
- **Mode:** SUBAGENT (6 mechanical fixes applied serially)
- **Estimated:** 3-5h

**Issues + dependency order:**

| Order | Issue                                                                          | File                                                                   |
| ----- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1     | #227 narrow `apiFetch` TypeError catch to actual network errors                | `app/src/api/client.ts`                                                |
| 2     | #228 `emitNetworkRecovered` only on offline→online transition                  | `app/src/api/client.ts`                                                |
| 3     | #225 `useSSE` in-flight `connectSSE` race tightening (`authClearedRef` flag)   | `app/src/hooks/useSSE.ts`                                              |
| 4     | #226 dev-only `console.warn` on swallowed `onAuthClear` callback throws        | `app/src/store/onAuthClear.ts`                                         |
| 5     | #234 mock hygiene gap in admin AbortController test blocks (`mockReset`)       | `app/src/views/__tests__/HeraldView.test.tsx`, `SquadView.test.tsx`    |
| 6     | #235 SettingsView abort-error filter pattern (`err.name === 'AbortError'`)     | `app/src/views/SettingsView.tsx`                                       |

**Locked decisions:**

- D-F1: All 6 issues in one PR, applied in the order above. #227 + #228 both touch `apiFetch` so order matters (#228 builds on #227's narrowed catch); rest are independent.
- D-F2: Each issue gets a red-green commit pair following TDD discipline (no skipped tests).
- D-F3: No new test infrastructure — reuse `vi.mock`, `makeFakeAuthState`, existing patterns.
- D-F4: `console.warn` for #226 gated on `import.meta.env.DEV` (Vite). Test mocks `import.meta.env.DEV` via `vi.stubEnv('DEV', true | false)` + `vi.unstubAllEnvs()` in `afterEach`.
- D-F5: `useSSE` `authClearedRef` for #225 — flag set to `true` when `onAuthClear` callback fires; checked inside async `connectSSE` resolution before any state setter. Reset to `false` on next successful auth/token-restore.

**Test strategy:**

- #227: Mock fetch throwing a non-network TypeError (e.g., JSON parse error) — assert it does NOT fire `sipher:network-error` event. Mock fetch throwing `TypeError('Failed to fetch')` — assert it DOES fire the event.
- #228: Initial successful fetch → no `sipher:network-recovered` fired (wasn't offline). After network-error event → next success fires the recovery event. Subsequent successes don't refire.
- #225: Simulate `clearAuth` mid-`connectSSE` resolution — assert state setters skip and SSE source closes. Verify happy path (auth restored, connectSSE resolves cleanly) still works.
- #226: Mock `onAuthClear` callback that throws — in DEV mode, expect `console.warn` called with error context. In prod mode (DEV=false), expect no warn.
- #234: Inspect new `beforeEach` blocks in HeraldView.test.tsx + SquadView.test.tsx — must call `mockReset` (not just `mockClear`) on `apiFetch` mock. Add a follow-up test that would have failed under `mockClear` only (e.g., a previously-set `mockResolvedValueOnce` leaking into next test).
- #235: Single-line change — `if (err.name === 'AbortError') return` replaces `if (!signal.aborted) ...` filter pattern. Existing test still passes.

**Risks:**

- `useSSE` is sensitive — wrong race fix could break the reconnect-after-token-refresh flow. Subagent references `app/src/hooks/__tests__/useSSE.test.tsx` carefully.
- `apiFetch` is touched by multiple issues — applying changes in dependency order is critical. Subagent commits each issue separately to allow rollback.
- `import.meta.env.DEV` mocking in Vitest can be finicky — subagent may need `vi.stubEnv('DEV', true/false)` per test.

**Out-of-scope guardrails for Cluster F subagent:**

- DON'T touch admin view source files (HeraldView/SquadView body) beyond #235 SettingsView 1-line fix
- DON'T touch auth state or wallet adapter (Cluster B)
- DON'T touch any UI components or views (everything else)
- DON'T modify test infrastructure beyond fixing #234 mock hygiene

---

## Wave 1 dispatch protocol

1. **Pre-dispatch (sequential, on main):** Create 3 worktrees under `.worktrees/` (one per cluster branch). Each worktree starts from current `origin/main`. Build `@sipher/sdk` once per worktree (Cluster A needs it for RoutePreviewCard, Cluster B may need it for vault helpers).
2. **Parallel dispatch:** Spawn 3 subagent dispatches in a single message (Agent tool calls in parallel). Each subagent receives:
   - Cluster's spec section (verbatim from this document)
   - Out-of-scope guardrails (verbatim)
   - Carry-forward conventions (verbatim from end of this doc)
   - Branch name + worktree path
3. **Subagent execution per cluster:** TDD-first (red test → implementation → green test, one issue at a time within the cluster). Conventional commits with appropriate scope. Push branch when all cluster issues green.
4. **Spec review (sequential, post-implementation):** Spawn spec-reviewer for each cluster as soon as that cluster's subagent reports done. Validates each cluster's D-items met.
5. **Code-quality review (sequential, post-spec-review):** Spawn code-quality-reviewer for each cluster. Critical/Important findings → fix loop within the cluster's subagent. Minor findings → file as Tier 4-deferred-polish issues.
6. **PR creation + CI gate:** `gh pr create` per cluster, multi-issue PRs use one `Closes #X` line per issue (NOT comma-separated — `gh` auto-close fires only on FIRST match). Wait for CI green.
7. **Merge sequence (sequential, on main):** Switch to main, `gh pr merge --merge --delete-branch`, sync local main, remove worktree, delete local branch. Repeat per cluster.
8. **Wave sync gate (D5):** All 3 Wave 1 PRs must be merged + main synced before Wave 2 dispatch begins.

---

## Wave 2 — Clusters C, D, E (parallel SUBAGENT dispatch — DETAILS DEFERRED)

After Wave 1 merges, run a **mid-sprint brainstorm** to:

1. Lock Cluster E subdivision decision (E1+E2 split vs single PR)
2. Surface any pattern lessons from Wave 1 (test patterns, scope guardrails that worked, dispatch issues encountered)
3. Refine Cluster C / D specifics with any context Wave 1 surfaced

The Wave 2 detail-locking lives in an **appendix to THIS spec** (per D11), added once the mid-sprint brainstorm completes.

### Cluster C — A11y + SEO (P2) — sketch only

- **Branch:** `feat/a11y-seo`
- **Issues:** #206 (`<h1>` + OG meta), #210 (Privacy Graph loading state), #211 (audit toast `role`/`aria-live`), #214 (ChatSidebar input `aria-label` + `maxLength` fix)
- **Mode:** SUBAGENT
- **Mechanism:** Native React 19 metadata for #206 (D10)

### Cluster D — Network/asset alignment (P2) — sketch only

- **Branch:** `fix/network-asset-alignment`
- **Issues:** #207 (AmountForm "SOL" hardcode), #208 (Header default `network` mismatch), #209 (TickerBar 5s polling + dead `slot` field)
- **Mode:** SUBAGENT

### Cluster E — Marketing surfaces (P3) — sketch only, subdivision TBD

- **Branch (tentative):** `feat/marketing-surfaces` (may split E1/E2)
- **Issues:** #216 (demo mode), #217 (live activity teaser), #218 (unauthed Ask SIPHER), #219 (connection-quality indicator), #220 (DEVNET dismissal localStorage), #221 (About SIPHER copy)
- **Mode:** SUBAGENT
- **Provisional split:** E1 polish (#219, #220, #221), E2 features (#216, #217, #218)

---

## Risks & mitigations (cross-cluster)

| Risk                                                                                                    | Likelihood | Mitigation                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wave 1 PRs conflict on shared file (e.g., A + B both touch DashboardView, or B + F both touch apiFetch) | Medium     | File audit done at brainstorm — A touches Card/Dashboard call site, B touches AuthSyncProvider, F touches api/client.ts. No file overlap. Verified.                         |
| Cluster F subagent applies changes out of order, breaking #227→#228 dependency                          | Medium     | D-F1 explicitly locks issue application order. Subagent dispatch prompt includes the ordered table verbatim.                                                                |
| Cluster B subagent breaks wallet auto-reconnect for valid JWT sessions                                  | Medium     | D-B3 explicit: cleanup only on `clearAuth`, NOT on initial mount. Test pattern covers happy path.                                                                           |
| Parallel subagent dispatch context-thrashes my session, blocking RECTOR feedback                        | Low        | Wave-based 3+3 limits to 3 concurrent dispatches max. Subagent reports come back individually, not all at once.                                                             |
| Mid-sprint brainstorm reveals Cluster E needs 2 sessions, not 1                                         | Medium     | Spec explicitly defers Wave 2 detail-locking. Mid-sprint brainstorm has authority to split, defer, or re-cluster Wave 2 issues.                                             |
| CI flakes during 3-way parallel CI runs                                                                 | Low        | Phase 4b convention "if flake recurs ≥2x, investigate" still applies. Frontier_48 hit PrivacyPreviewPanel flake; fix landed in `1efa3c0`. Suite should be more stable now.   |
| `gh issue close` doesn't auto-fire on multi-issue PR (comma-separated `Closes #X, #Y`)                  | High       | Frontier_47 hit this. Spec mandates ONE `Closes #X` line per issue in PR body. Subagent prompts include this rule.                                                          |
| Subagent picks suboptimal walletName cleanup mechanism (D-B2 left flexible)                             | Low        | Code-quality reviewer flags as Important if mechanism is wrong; fix loop applies. Subagent must document choice in PR description so reviewer can challenge.                |

---

## Sprint cadence

- **Wave 1 dispatch:** ~30min setup (worktrees, sdk build) → 3 parallel SUBAGENT dispatches (~3-5h each, may run staggered) → 3 spec reviews → 3 code-quality reviews → 3 PR creations → 3 sequential merges → main sync
- **Wave 1 total wall-clock:** ~6-8h if subagents finish in sync, ~10-14h if staggered (typical)
- **Mid-sprint brainstorm:** ~30-60min — lock Cluster E subdivision + Wave 2 details into spec appendix
- **Wave 2 dispatch:** Same pattern as Wave 1 (~6-8h sync, ~10-14h staggered, may be ~14-18h if E splits to E1+E2)
- **Total tier wall-clock:** ~16-24h across 1-2 long sessions

---

## Out of scope (this session and this tier)

- Phase D launch close (3-wallet manual QA + X thread #1 + final `/quality:qa --diff-from` validation) — RECTOR-driven gates after Tier 4
- Any non-Tier-4 issues in the QA sweep (all 33 - 15 closed = 18 leaves are the entirety of Tier 4 scope, plus 6 followups)
- Tier 2 deferred polish items NOT bundled into Tier 4 clusters (Tooltip cloneElement footgun, Sheet onClose re-creation, Banner copy differentiation, VIEW_TO_PATH dedup, etc.) — defer to post-launch cleanup session
- Backend API changes — Tier 4 is pure FE
- VPS / Vercel / Cloudflare infrastructure changes — not needed

---

## Carry-forward conventions (from Phase 4b sprint, applies to all 6 clusters)

1. NO AI attribution in commits / PRs / files
2. NO semicolons in TS/TSX (single quotes for imports)
3. Conventional commits with appropriate scope (`fix(app)`, `test(app)`, `chore(app)`, `feat(app)`, `refactor(app)`)
4. NEVER amend commits; create new ones
5. TDD discipline (failing test → implement → passing test) for code changes
6. CI must be green before merge; if flaky, retry once before investigating
7. `--merge --delete-branch` (NOT squash). After merge: sync local main, remove worktree, delete local branch
8. Multi-issue PRs: use one `Closes #X` per line in description (NOT comma-separated) — `gh` auto-closes only the FIRST match
9. Subagent-driven for genuinely complex; INLINE for mechanical (but all Wave 1 is SUBAGENT per D3)
10. Use `superpowers:verification-before-completion` before claiming any task done
11. Switch to main BEFORE running `gh pr merge` (avoid worktree-owns-branch local-cleanup quirk)
12. Build `@sipher/sdk` (`pnpm --filter "@sipher/sdk" build`) before running agent tests in a fresh worktree (NOT needed for app tests — pure FE)
13. Run app tests from inside `app/` directory: `cd app && pnpm test --run src/...`
14. Typecheck command is `pnpm exec tsc --noEmit` from `app/` (NOT `pnpm typecheck` — script doesn't exist)
15. Subagent prompts must include explicit out-of-scope list to prevent scope drift across clusters

---

## Appendix — Wave 2 detail-locking (to be added after mid-sprint brainstorm)

_This section is intentionally empty. After Wave 1 merges, a mid-sprint brainstorm will lock:_

- _Cluster E subdivision decision (E1+E2 split vs single PR)_
- _Cluster C/D detailed issue analysis (file targets, locked decisions, test strategy, risks, out-of-scope guardrails)_
- _Any pattern lessons from Wave 1 that should propagate to Wave 2_

_Appendix content gets added directly to this spec file via a subsequent commit titled `docs(spec): append Wave 2 detail-locking to Tier 4 design`._

---

## Plan scope note

**The implementation plan written immediately after this spec covers Wave 1 ONLY** (Clusters A, B, F — 12 issues + their cluster overheads). Wave 2 plan happens as a separate planning step after the mid-sprint brainstorm fills in the appendix above.

This keeps the active plan to a manageable size (~3 cluster sections × ~6-8 tasks per cluster = ~18-24 tasks) and avoids speculative planning for Wave 2 issues whose detailed decisions are not yet locked.
