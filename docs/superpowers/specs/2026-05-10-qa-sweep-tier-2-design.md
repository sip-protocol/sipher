# QA Sweep — Tier 2 (Unauthed UX) — Design

**Date:** 2026-05-10
**Session:** frontier_47
**Status:** Approved (RECTOR, this session)
**Predecessor:**
  - Handoff: `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-10-d.md`
  - Tier 0+1 spec: `docs/superpowers/specs/2026-05-10-qa-sweep-tier-0-1-design.md`
  - QA report: `~/Documents/secret/qa-reports/sipher/1778399617-both-fresh+skeptic/report.md`
  - Sprint memory: `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`
**Scope:** 6 issues (#190, #194, #200, #201, #204, #215) of 33-issue QA sweep — DAG Tier 2
**Out of scope (this session):** Tier 3 (#198, #199, #212), Tier 4 (19 leaves + 4 followups #225-#228), Phase D launch-gate close
**Estimated work-time:** 20-26h across 3 PRs

---

## Why this slice

Tier 0+1 (frontier_46) shipped the auth-lifecycle foundations: test util (`makeFakeAuthState`), console cleanup (deprecated wallet adapters), `onAuthClear` registry + 5 consumers, network-error banner, ChatSidebar 401 interceptor. 6 issues closed.

Tier 2 layers the **unauthed UX** on top: every visible gap a fresh-eyes visitor encounters between landing and connecting a wallet. The 6 issues split cleanly into three dependent groups:

```
PR1 — UnauthedEmptyState primitive ──► reused 3× (Vault, Keys, Report modal)
  closes #190 (P0) + #201 + #215

PR2 — URL router ──► foundation for #204 breadcrumb + future deep linking
  closes #194

PR3 — Onboarding content ──► uses primitive + router from PR1+2
  closes #200 + #204
```

PR1 ships first to close the lone P0 (#190 Vault Withdraw visible to unauthed) and validate primitive ergonomics against three distinct mounts before the router migration shuffles the same components. PR2 is the cross-cutting router migration. PR3 layers Footer + Tooltip primitive + jargon term wrappers + `/about` marketing page + Privacy Graph empty-state copy + auth-fallback breadcrumb.

The remaining 23 issues + 4 followups land across Tier 3 (admin reliability — 3 issues), Tier 4 (19 leaves + 4 followups — independent fanout), and Phase D launch close.

---

## Locked decisions

| # | Decision | Source |
|---|----------|--------|
| D1 | Path A — 3 PRs in dependency order: primitive → router → onboarding | RECTOR via AskUserQuestion |
| D2 | React Router 7 (`react-router-dom@^7`) | RECTOR via AskUserQuestion |
| D3 | #215 Path 2 — teaser modal renders `<UnauthedEmptyState>` as Sheet body | RECTOR via AskUserQuestion |
| D4 | #200 closure includes `/about` route (NOT collapsible) + Footer + tooltips on jargon terms + Privacy Graph empty-state copy | RECTOR via AskUserQuestion |
| D5 | All three PRs SUBAGENT-driven w/ TDD; two-stage reviewer (spec-compliance THEN code-quality) per task | RECTOR ("do your best") |
| D6 | `/about` placeholder route lands in PR2; content fills in PR3 | RECTOR ("do not skip /about") |
| D7 | #221 ([P3] About SIPHER copy) stays open as Tier 4 polish; do NOT close as duplicate of #200 | RECTOR ("polish is good") |

---

## PRs

### PR1 — `feat/unauthed-empty-state-primitive` (closes #190 + #201 + #215)

- **Mode:** SUBAGENT-driven w/ TDD
- **Estimated:** 6-8h
- **Why first:** Closes the lone P0 (#190) before the router migration scrambles VaultView. Three distinct mount patterns validate the primitive's prop API early.

**Architecture:**

New primitive at `app/src/components/ui/UnauthedEmptyState.tsx`:

```ts
export interface UnauthedEmptyStateProps {
  title: string                    // e.g., "Shielded Vault"
  body: ReactNode                  // string OR rich content with <strong>, <a>
  cta?: ReactNode                  // defaults to wallet-adapter "Select Wallet" trigger
  illustration?: ReactNode         // optional hero (route preview, icon, etc.)
}

export function UnauthedEmptyState({ title, body, cta, illustration }: UnauthedEmptyStateProps): ReactElement
```

- Pure rendering — no internal state, no `useOnAuthClear` wiring needed.
- Glass-neon styling baked in (matches D4 `tokens.css` + `theme.css` from PR 1 / Phase 4b).
- Default CTA reuses the existing wallet-adapter trigger pattern (currently rendered by Header on landing); subagent decides whether to extract that into a shared `<ConnectWalletCTA>` helper or import inline. If extraction warranted, place under `app/src/components/ui/ConnectWalletCTA.tsx`.

**Consumer wirings (3):**

1. **`app/src/views/VaultView.tsx`** — top of view branches on `useAuthState().status`. Unauthed branch renders `<UnauthedEmptyState illustration={<RoutePreviewDiagram />} title="Shielded Vault" body="Privacy-preserving SOL + token vault on Solana. Stealth output addresses by default. Connect a wallet to deposit." />`. Hides ShieldedVaultPanel + UnshieldedWalletPanel + Withdraw button entirely (Path 1 from #190 issue). Authed branch unchanged.

2. **`app/src/views/KeysView.tsx`** — unauthed branch renders `<UnauthedEmptyState title="Stealth Keys" body="Your spending and viewing keys are derived from your wallet. Connect to view, rotate, or back them up." />`. Authed branch unchanged.

3. **`app/src/components/PrivacyScoreCard.tsx`** — current "View report →" `onClick` calls `setActiveView('privacyReport')`. New behavior:
   - Authed (`status === 'authed'`): unchanged — `setActiveView('privacyReport')` (or `useNavigate('/privacy-report')` post-PR2; PR1 keeps current setActiveView path).
   - Unauthed: open `<Sheet>` whose body is `<UnauthedEmptyState title="Privacy Score Report" body="Network analysis · surveillance score · personalized recommendations." />`. Sheet API matches existing PR 7 ViewKeyCard rotate-confirm pattern (`{ open, onClose, children, ariaLabel? }`).

**Files:**

- `app/src/components/ui/UnauthedEmptyState.tsx` (new)
- `app/src/components/ui/__tests__/UnauthedEmptyState.test.tsx` (new)
- `app/src/views/VaultView.tsx` (modified)
- `app/src/views/__tests__/VaultView.test.tsx` (modified)
- `app/src/views/KeysView.tsx` (modified)
- `app/src/views/__tests__/KeysView.test.tsx` (modified)
- `app/src/components/PrivacyScoreCard.tsx` (modified)
- `app/src/components/__tests__/PrivacyScoreCard.test.tsx` (modified)
- Optional: `app/src/components/ui/ConnectWalletCTA.tsx` if subagent decides to extract

**TDD order:**

1. `UnauthedEmptyState.test.tsx` — primitive renders title + body + default CTA + illustration when provided; ARIA + glass-neon class names asserted
2. Implement primitive
3. `VaultView.test.tsx` — assert unauthed branch renders UnauthedEmptyState (no Withdraw button); authed branch renders ShieldedVaultPanel
4. Wire VaultView
5. `KeysView.test.tsx` — assert unauthed branch renders UnauthedEmptyState
6. Wire KeysView
7. `PrivacyScoreCard.test.tsx` — click "View report" when unauthed opens Sheet with UnauthedEmptyState body; when authed calls `setActiveView('privacyReport')`
8. Wire PrivacyScoreCard

**Acceptance:**

- `pnpm typecheck` clean
- All new + modified tests pass
- Manual repro 1: load Vercel preview without connecting wallet → click Vault tab → marketing illustration + Connect CTA shown, NO Withdraw button visible
- Manual repro 2: same session → click Keys tab → empty state with title + body + Connect CTA, no blank page
- Manual repro 3: same session → click "View report →" on Dashboard → Sheet opens with primitive body, dismissable; connect wallet → click again → navigates to /privacy-report (existing behavior preserved)

**Fallback:** If `<Sheet>` styling clashes with the primitive's glass-neon look (Sheet may have its own card chrome), fall back to inline-mounted UnauthedEmptyState below the PrivacyScoreCard with a "Connect to view full report" framing. Primitive prop API stays the same.

---

### PR2 — `feat/url-router` (closes #194)

- **Mode:** SUBAGENT-driven w/ TDD
- **Estimated:** 6-8h
- **Why second:** Router migration is the largest cross-cutting change. Lands after PR1's primitive validates so the router subagent doesn't have to also reason about new component design.

**Architecture:**

- `react-router-dom@^7` added to `app/package.json`. Use `<BrowserRouter>` + declarative `<Routes>` + `<Route>` (the v7 "data router" mode is overkill for an SPA without loaders/actions).
- Wrap `<App>` shell in `<BrowserRouter>` (or wrap in `main.tsx` if cleaner).
- Routes (13 total — 11 existing + `/about` placeholder + `*` 404):

```tsx
<Routes>
  <Route path="/" element={<DashboardView />} />
  <Route path="/vault" element={<VaultView />} />
  <Route path="/vault/deposit" element={<DepositView />} />
  <Route path="/vault/withdraw" element={<WithdrawView />} />
  <Route path="/chains" element={<ChainsView />} />
  <Route path="/keys" element={<KeysView />} />
  <Route path="/chat" element={<ChatView />} />          {/* tablet-only nav item; verify view target */}
  <Route path="/herald" element={<HeraldView />} />      {/* admin */}
  <Route path="/sentinel" element={<SquadView />} />     {/* admin (squad → sentinel rename optional) */}
  <Route path="/settings" element={<SettingsView />} />  {/* admin */}
  <Route path="/privacy-report" element={<PrivacyReportView />} />
  <Route path="/about" element={<AboutPlaceholderView />} />  {/* PR3 fills */}
  <Route path="*" element={<NotFoundView />} />
</Routes>
```

`/chat` IS a route in current usage — Header + BottomNav both list `{ id: 'chat', label: 'Chat', icon: ChatCircle }` and `app/src/App.tsx` has a `case 'chat':` branch in the activeView switch. Subagent identifies the rendered view component (likely a dedicated chat screen on tablet/mobile, distinct from the desktop slide-over `<ChatSidebar>`) — name it `<ChatView />` and add it to the routes table verbatim. Do NOT delete the `'chat'` View enum value.

- `useAppStore.activeView` field deleted from store. `setActiveView` action removed. The View enum union (`'dashboard' | 'vault' | ...`) stays — used by `useActiveView()` hook return value and admin-redirect typing.
- New helper `app/src/hooks/useActiveView.ts`:

```ts
const PATH_TO_VIEW: Record<string, View> = {
  '/': 'dashboard',
  '/vault': 'vault',
  '/vault/deposit': 'deposit',
  '/vault/withdraw': 'withdraw',
  '/chains': 'chains',
  '/keys': 'keys',
  '/chat': 'chat',
  '/herald': 'herald',
  '/sentinel': 'squad',  // route is /sentinel but existing View name is 'squad'
  '/settings': 'settings',
  '/privacy-report': 'privacyReport',
  '/about': 'about',     // new View name added to enum (View union extended)
}

export function useActiveView(): View {
  const { pathname } = useLocation()
  return PATH_TO_VIEW[pathname] ?? 'dashboard'  // unknown paths still highlight Dashboard nav
}
```

- Header.tsx + BottomNav.tsx: replace `setActiveView('vault')` with `<Link to="/vault">` (preferred — no extra hook) or `useNavigate('/vault')`. Active-tab highlighting reads `useActiveView()`.
- Admin redirects in HeraldView, SquadView, SettingsView, plus `clearAuth` reset in `app/src/stores/app.ts:69`: `set({ activeView: 'dashboard' })` becomes `useNavigate('/')` from inside a `useEffect`. Clearing auth no longer sets activeView (it's URL-derived).
- `useIsAdmin.ts` is independent of activeView; no router change needed.
- Migration of consumers (per `grep useAppStore.*activeView` audit, ~12 files): App.tsx, providers/AuthSyncProvider.tsx, stores/app.ts (+ test), components/{BottomNav,BetaBanner,Header,PrivacyScoreCard,ChatSidebar}.tsx (+ tests), views/{SettingsView,VaultView}.tsx, hooks/useIsAdmin.ts (audit only — likely no change).

**404 view:**

- `app/src/views/NotFoundView.tsx` — title "Not found", body "We couldn't find that page.", CTA "Back to Dashboard" using `<Link to="/">`. Same glass-neon styling as UnauthedEmptyState (consider rendering UnauthedEmptyState with title/body/cta for free reuse — primitive earns its keep again).
- Invalid paths like `/vault/abc`, `/keys/<script>alert(1)</script>`, `/admin` all match `*` and render NotFoundView. URL preserved in address bar.

**Files:**

- `app/package.json` (modified — add `react-router-dom@^7`)
- `app/src/main.tsx` OR `app/src/App.tsx` (modified — wrap in `<BrowserRouter>`, replace activeView switch with `<Routes>`)
- `app/src/stores/app.ts` (modified — drop `activeView` field, drop `setActiveView`, drop activeView reset in `clearAuth`)
- `app/src/stores/__tests__/app.test.ts` (modified)
- `app/src/hooks/useActiveView.ts` (new)
- `app/src/hooks/__tests__/useActiveView.test.tsx` (new)
- `app/src/views/NotFoundView.tsx` (new)
- `app/src/views/__tests__/NotFoundView.test.tsx` (new)
- `app/src/views/AboutPlaceholderView.tsx` (new — minimal "Coming soon" page; PR3 fills)
- `app/src/components/Header.tsx` (modified — `<Link>` not setActiveView; `useActiveView()` for highlighting)
- `app/src/components/__tests__/Header.test.tsx` (modified — wrap in MemoryRouter, assert navigation)
- `app/src/components/BottomNav.tsx` (modified)
- `app/src/components/__tests__/BottomNav.test.tsx` (modified)
- `app/src/components/BetaBanner.tsx` (modified — drop activeView reads if any)
- `app/src/components/__tests__/BetaBanner.test.tsx` (modified)
- `app/src/components/PrivacyScoreCard.tsx` (modified — `setActiveView('privacyReport')` → `useNavigate('/privacy-report')`; preserves PR1 unauthed Sheet branch)
- `app/src/components/__tests__/PrivacyScoreCard.test.tsx` (modified)
- `app/src/components/ChatSidebar.tsx` (modified — drop activeView reads if any; the slide-over remains an overlay independent of `/chat` route, which renders a separate `<ChatView />`)
- `app/src/components/__tests__/ChatSidebar.test.tsx` (modified)
- `app/src/views/HeraldView.tsx` (modified — admin redirect uses `useNavigate('/')`)
- `app/src/views/__tests__/HeraldView.test.tsx` (modified)
- `app/src/views/SquadView.tsx` (modified — same)
- `app/src/views/__tests__/SquadView.test.tsx` (modified)
- `app/src/views/SettingsView.tsx` (modified — same)
- `app/src/views/__tests__/SettingsView.test.tsx` (modified)
- `app/src/views/VaultView.tsx` (modified — Withdraw button onClick: `setActiveView('withdraw')` → `useNavigate('/vault/withdraw')`; deposit similarly)
- `app/src/views/__tests__/VaultView.test.tsx` (modified)
- `app/src/views/DepositView.tsx` (audit — back-button to `/vault`)
- `app/src/views/WithdrawView.tsx` (audit — back-button to `/vault`)
- `app/src/providers/AuthSyncProvider.tsx` (audit — drop activeView writes if any)
- `app/src/providers/__tests__/AuthSyncProvider.test.tsx` (modified if AuthSync touches activeView)
- `e2e/herald.spec.ts` + `e2e/squad.spec.ts` + any other e2e specs that navigate via Header/BottomNav (selector update from `data-testid` activeView lookups to `getByRole('link', { name: 'Vault' })` or URL path assertions)

**TDD order:**

1. `useActiveView.test.tsx` — pathname → view name mapping
2. Implement `useActiveView`
3. `NotFoundView.test.tsx` — renders + has "Back to Dashboard" link
4. Wire NotFoundView
5. `App.test.tsx` (or main.tsx render test) — `<BrowserRouter>` + `<Routes>` mounts correct view per path; * renders NotFoundView
6. Wire App routes
7. `Header.test.tsx` — clicking Vault nav (in MemoryRouter) navigates to `/vault`; active highlight matches current path
8. Wire Header
9. `BottomNav.test.tsx` — same pattern
10. Wire BottomNav
11. `HeraldView.test.tsx` — non-admin user sees redirect to `/` (via `useNavigate` mock)
12. Wire admin redirects in Herald/Squad/Settings
13. `app.test.ts` — store no longer has `activeView`; `clearAuth()` resets token but not view
14. Wire store
15. PrivacyScoreCard, ChatSidebar, BetaBanner audits + tests
16. Wire those
17. E2E spec updates

**Acceptance:**

- `pnpm typecheck` clean
- Direct visit to `/vault`, `/chains`, `/keys`, `/privacy-report`, `/about`, `/herald`, `/sentinel`, `/settings`, `/vault/deposit`, `/vault/withdraw` mounts respective views
- Browser back/forward + bookmarks work
- Invalid paths render NotFoundView with URL preserved
- Admin views still redirect non-admin (via `useNavigate('/')`)
- `pnpm test --run` all pass; e2e specs pass
- No regression: PR1's UnauthedEmptyState mounts on `/vault`, `/keys`; PR1's PrivacyScoreCard Sheet still opens for unauthed (now triggered via `useLocation`/`useNavigate` if needed)

**Fallback:** If `<BrowserRouter>` interferes with Vercel deploy (404 on direct navigation due to missing rewrites), add `vercel.json` rewrite rule: `{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/" }] }`. SPA fallback is standard.

---

### PR3 — `feat/onboarding-content` (closes #200 + #204)

- **Mode:** SUBAGENT-driven w/ TDD
- **Estimated:** 8-10h
- **Why third:** Depends on PR1 primitive (banners + tooltips reuse same glass-neon design language) and PR2 router (`/about` route + `<Link>` from Footer + breadcrumb on auth-fallback routes).

**Architecture:**

**`/about` route content (`app/src/views/AboutView.tsx`):**

Replaces the AboutPlaceholderView from PR2. Sections:

1. **Hero** — `<h1>Privacy-by-default for Solana</h1>` + 1-line tagline ("Wallet + autonomous agent for shielded payments, swaps, and stealth-address management") + primary CTA "Open SIPHER" (`<Link to="/">`) + secondary CTA "Read the docs" (anchor to docs.sip-protocol.org).
2. **Wallet identity** — what Sipher does as a wallet: stealth addresses by default, viewing keys, multi-chain (12 chains), Pedersen commitments. 3 sub-cards or 1 narrative paragraph.
3. **Agent identity** — what SIPHER does as an autonomous agent: HERALD (X auto-response), SENTINEL (security analyst), command center UI. 3 sub-cards.
4. **Architecture diagram** — reference ROADMAP.md anchor diagrams (placeholder 1×1 PNG OK; RECTOR fills production screenshots in followup).
5. **Footer CTAs** — "Open SIPHER" + "Read the docs" + "Star on GitHub" + "Follow on X".

Copy is drafted by the subagent; RECTOR reviews via Vercel preview during PR3 review window. Iterations land as new commits on the PR branch (NOT new PRs).

**`<Footer>` (`app/src/components/Footer.tsx`):**

- Mounted in App.tsx shell, always visible across all routes (authed + unauthed, admin + non-admin). Position: bottom of `<main>` flow, NOT sticky. Sits below the route content, before `<ChatSidebar>` overlay.
- Links (all `target="_blank" rel="noopener noreferrer"`):
  - `docs.sip-protocol.org` (with explicit `https://`)
  - `blog.sip-protocol.org`
  - `https://github.com/sip-protocol/sipher`
  - `https://x.com/SIPProtocol` (or whatever the verified handle is — check `~/.claude/sip-protocol/` strategy notes if missing; fall back to `https://x.com/sip_protocol`)
  - `https://sip-protocol.org`
  - Copyright "© 2026 SIP Labs"
- Use existing tokens from `app/src/styles/tokens.css` and `theme.css`. No new tokens needed.

**`<Tooltip>` primitive (`app/src/components/ui/Tooltip.tsx`):**

```ts
export interface TooltipProps {
  content: ReactNode
  children: ReactElement   // single trigger element
  side?: 'top' | 'right' | 'bottom' | 'left'  // default 'top'
}

export function Tooltip({ content, children, side }: TooltipProps): ReactElement
```

- Hover-triggered (delay 200ms), focus-triggered, touch-friendly (long-press optional).
- ARIA: trigger gets `aria-describedby={tooltipId}`, tooltip gets `role="tooltip"`.
- Glass-neon styling — small floating card with neon border and dark background. Position via simple CSS positioning (no `@floating-ui/react` dep — YAGNI for 6 jargon terms).
- Subagent verifies whether an existing simple tooltip exists before adding (e.g., `<button title="...">` HTML titles are insufficient for the educational copy length; need rendered tooltip).

**`<JargonTerm>` wrapper (`app/src/components/ui/JargonTerm.tsx`):**

```ts
const JARGON_DEFINITIONS: Record<string, ReactNode> = {
  'Privacy Score': 'Composite metric of address reuse, amount patterns, timing correlation, and counterparty exposure. Higher = more private.',
  'Stealth Address Tree': 'Each leaf is a one-time recipient address. Connecting your wallet derives the tree from your viewing key.',
  'Vault PDA': 'Program-Derived Address — the on-chain account holding shielded vault state. Owned by the Sipher Vault program, not by any wallet.',
  'fee 50 bps': '0.5% fee on shielded transfers — funds protocol development. Paid in the transferred token.',
  'Pedersen': 'Cryptographic commitment scheme used to hide amounts. Each commitment combines value × G + blinding × H, where G and H are base points on the secp256k1 curve.',
  'DKSAP': 'Dual-Key Stealth Address Protocol — sender derives a one-time recipient address from the recipient\'s spending + viewing public keys. Only the recipient can spend.',
}

export function JargonTerm({ term, children }: { term: keyof typeof JARGON_DEFINITIONS; children: ReactNode }): ReactElement
```

Wraps a span with an info icon, content from JARGON_DEFINITIONS keyed by term. The 6 terms are the ones called out in #200's body.

Wire `<JargonTerm>` in:
- DashboardView near "Privacy Score" label
- PrivacyGraph near "Stealth Address Tree" heading
- VaultView near "Vault PDA" label (authed branch)
- VaultView near "fee 50 bps" or wherever fee shown
- Anywhere Pedersen / DKSAP terms appear (likely DashboardView feature copy)

**Privacy Graph empty-state copy:**

`app/src/components/PrivacyGraph.tsx:63` currently: `Connect a wallet to see your privacy graph.` Expand to:

```
Each node is a one-time stealth address.
Connect a wallet and send/receive shielded payments to populate.
```

Wrap in glass-neon card. Test asserts new copy.

**`<Banner>` for #204 breadcrumb:**

Either reuse the existing `<NetworkBanner>` shell (rename to `<Banner>` with `kind` prop, or add `<Banner>` as a sibling primitive). Renders at top of unauthed branch in VaultView, KeysView, ChainsView (per #204 issue + the unauthed-branch refactor from PR1):

```tsx
{status !== 'authed' && (
  <Banner kind="info">
    Vault is a connected-wallet feature. <ConnectWalletCTA inline />
  </Banner>
)}
<UnauthedEmptyState ... />  /* PR1's branch */
```

Keep separate from `<UnauthedEmptyState>` — banner is a prefix breadcrumb, primitive is the main content. Same wallet-CTA reused.

**Files:**

- `app/src/views/AboutView.tsx` (replaces AboutPlaceholderView from PR2; full content)
- `app/src/views/__tests__/AboutView.test.tsx` (new)
- `app/src/components/Footer.tsx` (new)
- `app/src/components/__tests__/Footer.test.tsx` (new)
- `app/src/components/ui/Tooltip.tsx` (new)
- `app/src/components/ui/__tests__/Tooltip.test.tsx` (new)
- `app/src/components/ui/JargonTerm.tsx` (new)
- `app/src/components/ui/__tests__/JargonTerm.test.tsx` (new)
- `app/src/components/ui/Banner.tsx` (new — extracted from existing NetworkBanner shell OR sibling primitive)
- `app/src/components/ui/__tests__/Banner.test.tsx` (new)
- `app/src/App.tsx` (modified — mount `<Footer>` in shell)
- `app/src/components/PrivacyGraph.tsx` (modified — empty-state copy)
- `app/src/components/__tests__/PrivacyGraph.test.tsx` (modified)
- `app/src/views/VaultView.tsx` (modified — add `<Banner>` above unauthed `<UnauthedEmptyState>`; add `<JargonTerm>` wrappers in authed branch)
- `app/src/views/__tests__/VaultView.test.tsx` (modified)
- `app/src/views/KeysView.tsx` (modified — add `<Banner>` above unauthed `<UnauthedEmptyState>`)
- `app/src/views/__tests__/KeysView.test.tsx` (modified)
- `app/src/views/ChainsView.tsx` (modified — add `<Banner>` to unauthed branch IF ChainsView has unauthed gating; if not, leave alone)
- `app/src/views/__tests__/ChainsView.test.tsx` (modified if ChainsView changed)
- `app/src/views/DashboardView.tsx` (modified — wrap "Privacy Score" / "Pedersen" / "DKSAP" labels in `<JargonTerm>`)
- `app/src/views/__tests__/DashboardView.test.tsx` (modified)

**TDD order:**

1. `Footer.test.tsx` — renders all 5+ links with correct hrefs, target=_blank, rel=noopener
2. Wire Footer
3. Mount Footer in App.tsx (test asserts visible on /, /vault, /about)
4. `Tooltip.test.tsx` — hover shows content; aria-describedby wired; ESC dismisses
5. Wire Tooltip primitive
6. `JargonTerm.test.tsx` — 6 known terms render correct content
7. Wire JargonTerm
8. `Banner.test.tsx` — kind variants render correct color/icon (info/warning/error)
9. Wire Banner (extract from NetworkBanner OR sibling)
10. `AboutView.test.tsx` — renders hero + wallet identity + agent identity + footer CTAs
11. Wire AboutView (replaces AboutPlaceholderView)
12. PrivacyGraph empty-state copy test
13. Update copy
14. VaultView/KeysView add Banner test
15. Wire Banner in views
16. DashboardView JargonTerm wrappers test
17. Wire JargonTerm wrappers

**Acceptance:**

- `pnpm typecheck` clean
- All new + modified tests pass
- `/about` route renders full marketing page (Vercel preview screenshot reviewed by RECTOR before merge)
- Footer always visible across all routes (test asserts presence on `/`, `/vault`, `/keys`, `/about`, `/privacy-report`, `/herald`, NotFound — covers unauthed + authed + admin sample)
- Tooltips work on hover + focus, ARIA-described
- 6 jargon terms have correct content; clicking outside dismisses tooltip
- Privacy Graph empty state shows expanded copy
- Banner shows on unauthed Vault / Keys / Chains, hidden on authed

**Fallback:**

- If the existing `<NetworkBanner>` shell can't be cleanly extracted into a generic `<Banner>` primitive without risking PR-D regressions (PR-D's NetworkBanner is wired to network-error / network-recovered events), add `<Banner>` as a sibling primitive. Two banners coexist — NetworkBanner for transient connectivity, Banner for static breadcrumbs.
- If `/about` copy gets bikeshed-cycled mid-PR3, RECTOR edits inline on the PR branch (skeletal copy from subagent → RECTOR fills via direct edits). Iterations are commits, not new PRs.
- If `<Tooltip>` primitive grows complex (positioning quirks across viewport edges), pull in `@floating-ui/react` as a localized dependency. ~10 KB gzip but solves edge cases. Document in PR description if added.

---

## Verification cadence

**Per-PR gate** (run before merging each PR):

```bash
git fetch --prune
pnpm typecheck                                # repo root
pnpm test --run                               # repo root (sdk + agent + utils)
cd app && pnpm test --run                     # app-only
gh pr checks <pr#> --watch                    # CI green (component + playwright)
```

**Post-merge ritual** (every PR):

1. Switch to `main` BEFORE running `gh pr merge` (avoid worktree-owns-branch quirk — carry-forward gotcha)
2. `gh pr merge <pr#> --merge --delete-branch` (NOT squash — RECTOR's preferred merge style)
3. `git checkout main && git pull && git worktree remove <path> && git branch -d <branch>`
4. Verify HEAD on `gh run list --limit 1` is green

**Session-end checkpoint** (after PR3 merges):

- NOT running `/quality:qa --diff-from=1778399617-both-fresh+skeptic` mid-sprint — informational only, conserves tokens (per Tier 0+1 K5 decision)
- Final `--diff-from` becomes Phase D launch gate after Tier 4 closes
- Update `MEMORY.md` + `project_phase4b-redesign-sprint.md` with this session's outcomes
- Write next-session handoff `session-handoff-2026-05-1X-X.md` covering Tier 3 starting state

---

## Risks + mitigations

| # | Risk | Mitigation |
|---|------|------------|
| R1 | PR2 router migration breaks admin-redirect pattern in HeraldView/SquadView/SettingsView (PR 8 wired specific `setActiveView('dashboard')` semantics) | Subagent prompt explicitly preserves the redirect behavior; tests assert non-admin redirect still renders Dashboard (now via `useNavigate('/')`) — see PR 8 carry-forward gotcha "Data-fetch useEffect must be gated on `isAdmin`" |
| R2 | E2E specs (`e2e/herald.spec.ts`, `e2e/squad.spec.ts`) break on URL-based navigation; PR 8 documented they navigate via mobile BottomNav drawer because UserMenu requires `publicKey` | E2E selectors update from `data-testid` activeView lookups to `getByRole('link', { name: 'Vault' })` or URL path assertions. Mobile-viewport pattern from PR 8 still applies for admin nav |
| R3 | `<UnauthedEmptyState>` modal mount in PR1 (#215) clashes with existing Sheet styling | Verify `<Sheet>` API supports rich body (already used by PR 7 ViewKeyCard rotate-confirm). Fallback: inline-mounted UnauthedEmptyState below PrivacyScoreCard with "Connect to view full report" framing |
| R4 | `/about` route copy bikeshed-cycles mid-PR3 | Subagent drafts skeletal copy; RECTOR reviews via Vercel preview; copy iterations land as commits on the PR branch (NOT separate PRs) |
| R5 | Tooltip primitive needs design tokens (z-index, shadow) that don't exist in tokens.css | Audit `app/src/styles/tokens.css` + `theme.css` before subagent dispatch; if missing, add tokens in PR3 (small surface). Predecessor PR 1 used `@utility` directives in theme.css for `--z-*` and `--duration-*` — same pattern works here |
| R6 | `<ChatView>` (target of `/chat` route) doesn't exist as a standalone component — `case 'chat':` in App.tsx may render the slide-over `<ChatSidebar>` directly | Subagent identifies what `case 'chat':` currently renders. If it renders ChatSidebar inline, extract the rendering into a `<ChatView>` view component (or render ChatSidebar full-screen on the `/chat` route via a thin wrapper). Do NOT delete the `'chat'` View enum value or remove tablet-only Chat nav item |
| R7 | Vercel deploy returns 404 on direct navigation to `/vault`, `/about`, etc. (SPA fallback missing) | Add `vercel.json` rewrite rule: `{ "rewrites": [{ "source": "/((?!api/).*)", "destination": "/" }] }` in PR2 if absent. Verify Vercel preview tests deep-link before merging PR2 |
| R8 | `useAppStore` consumers found in PR2 audit (~12 files) exceed estimated 6-8h scope | Subagent prompt sets explicit acceptance: typecheck + all tests pass after migration. If migration grows, file follow-up issue rather than expanding PR scope |
| R9 | `<Banner>` extraction from NetworkBanner risks PR-D (Tier 0+1) regression on network-error events | Default to sibling primitive — leave NetworkBanner alone; new Banner is a separate primitive in `app/src/components/ui/`. Two banners coexist by purpose: transient network state vs. static breadcrumb |
| R10 | Subagent over-dispatches on PR1 (primitive is small enough to inline) | Per RECTOR's "do your best": dispatch SUBAGENT only if scope warrants. PR1 has 3 distinct mount patterns + new primitive; enough complexity to justify two-stage review. Borderline-but-defensible. If subagent surfaces over-engineering, fall back to inline implementation |

---

## Carry-forward execution rules (apply to ALL 3 PRs)

1. NO AI attribution in commits/PRs/files (CLAUDE.md global rule)
2. NO semicolons in TS/TSX, single quotes for imports
3. Conventional commits with appropriate scope (`feat(app)`, `fix(app)`, `chore(app)`, `test(app)`, `docs(app)`)
4. NEVER amend commits; create new ones
5. TDD discipline (failing test → implement → passing test) for code changes
6. CI must be green before merge; if flaky, retry once before investigating
7. Use `superpowers:verification-before-completion` before claiming any task done
8. Switch to `main` BEFORE running `gh pr merge` (worktree-owns-branch local-cleanup quirk)
9. Build `@sipher/sdk` (`pnpm --filter "@sipher/sdk" build`) before running agent tests in a fresh worktree
10. Run app tests from inside `app/` directory: `cd app && pnpm test --run src/...`
11. `--merge --delete-branch` (NOT squash). After merge: sync local main, remove worktree, delete local branch
12. Subagent prompts MUST include explicit out-of-scope list to prevent drift (per Tier 0+1 carry-forward finding)
13. Two-stage review per task: spec-compliance THEN code-quality (per Tier 0+1 carry-forward finding — code reviewer caught 2 real UX bugs in PR-D pre-merge)
14. Code-review re-review loop is mandatory if reviewer finds blocking issues — apply fixes inline, re-run tests, re-verify before merging

---

## Out of scope (this session)

- **Tier 3** (#198, #199, #212) — admin reliability fixes; next session
- **Tier 4** (#195-#197, #203, #206-#211, #213-#214, #216-#221) + 4 followups (#225-#228) — independent leaves; subsequent sessions via subagent fanout
- **Phase D launch-gate close** — 3-wallet manual QA, X thread copy review, final `/quality:qa --diff-from` check; post-Tier-4
- **#221 ([P3] About SIPHER copy)** — explicitly Tier 4 polish per D7; do NOT close as duplicate of #200 even though `/about` route covers similar content
- **Production screenshots for `/about`** — placeholder 1×1 PNGs OK; RECTOR captures real screenshots in followup commit
- **Demo mode / sample wallet preview** (#216 P3) — Tier 4
- **Live activity teaser** (#217 P3) — Tier 4
- **Ask SIPHER unauthed mode** (#218 P3) — Tier 4
- **Connection-quality indicator** (#219 P3) — Tier 4
- **DEVNET banner localStorage dismissal** (#220 P3) — Tier 4

---

## Tier 3-4 outline (subsequent sessions — preview only, will brainstorm at start of each)

| Session | Tier | Scope | Issues | Estimated |
|---------|------|-------|--------|-----------|
| 3 (next) | Tier 3 — Admin reliability | `token!` crash fix, AbortController on async fetches, `useIsAdmin` delegate to `useAuthState().isAdmin` | #198, #199, #212 | 4-6h |
| 4 | Tier 4 — Independent leaves (parallel via subagent fanout) | Hardcoded delta, M19 placeholder copy, hardcoded vault PDA, duplicate session-expired toasts, mock data in TickerBar/AmountForm/Header network default, A11y/SEO (h1/OG, toast roles, ChatSidebar aria-label, walletName carryover), Privacy Graph loading state, P3 delight gaps (demo mode, live activity, Ask SIPHER unauthed, connection quality, DEVNET banner persistence, About SIPHER copy on unauthed) | #195-#197, #203, #206-#211, #213-#214, #216-#221 + 4 followups #225-#228 (23 issues) | 14-22h |
| 5 | Phase D launch | `/quality:qa --diff-from=1778399617-both-fresh+skeptic` zero open → 3-wallet QA (Phantom + Solflare + Jupiter) → X thread #1 copy reviewed → LAUNCH | — | 4-8h |

**Total sprint estimate after Tier 2:** ~3 more sessions, ~22-36h work-time, then Phase D launches.

---

## Approval log

| Decision | Date | Source |
|----------|------|--------|
| Path A — 3 PRs (primitive → router → onboarding) | 2026-05-10 | RECTOR via AskUserQuestion |
| Router = React Router 7 | 2026-05-10 | RECTOR via AskUserQuestion |
| #215 Path 2 — teaser modal with UnauthedEmptyState | 2026-05-10 | RECTOR via AskUserQuestion |
| #200 closure includes /about route | 2026-05-10 | RECTOR via AskUserQuestion |
| All 3 PRs SUBAGENT-driven | 2026-05-10 | RECTOR ("do your best") |
| /about placeholder in PR2, content in PR3 | 2026-05-10 | RECTOR ("do not skip /about") |
| #221 stays open as Tier 4 polish | 2026-05-10 | RECTOR ("polish is good") |
| Spec written + committed | 2026-05-10 | This document |
