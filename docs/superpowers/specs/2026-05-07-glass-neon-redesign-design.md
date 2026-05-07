# Glass-Neon Redesign + Vercel FE Migration — Design Spec

**Status:** Proposed 2026-05-07 (pending RECTOR review before writing-plans)
**Author:** RECTOR + CIPHER (brainstorm via Claude Designer + Chrome MCP)
**Trigger:** RECTOR completed a "Sipher Revamp" exploration in Claude.ai's design tool (project URL: `claude.ai/design/p/019dfc33-32d3-7cf3-9cbf-8be37ea0b1e4`) and wants to bring the visual language to production. Design exploration prepped a `pr-redesign-glass.zip` workflow but the contents are not used directly — the design is reproduced against existing patterns with a fresh token-driven implementation. Phase D X thread #1 launch is held pending this redesign landing live.
**Predecessor specs:**
- `2026-05-06-phase4a-auth-and-security-fix-design.md` (Phase 4a auth + security hardening — PRs #174/#175/#176 merged 2026-05-07)
- `2026-05-05-phase4-split-devnet-beta-mainnet-design.md` (Phase 4a/4b split, locks D1-D9 of devnet-beta-then-mainnet sequencing)
**Predecessor handoffs:** `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-07-d.md` (PR #176 opened + merged at `6f18e93`, deploy fix at `d10cf45`)
**Design assets captured:**
- 6 designer view screenshots (Dashboard, Vault, Deposit, Withdraw, Relayers, Keys) — extracted via Chrome MCP
- Full token sheet (`~/Downloads/sipher-redesign-tokens.css` — 301 lines, 17KB, 17 sections) — extracted via Claude Designer chat prompt + base64-safe download

---

## Why This Spec Exists

RECTOR's Claude Designer exploration produced a polished visual concept for Sipher under the language *"glass + neon refresh"*. The design is gorgeous — dark navy bg, glassmorphism panels, cyan→violet gradients, neon glow accents, mono-font hashes, animated conic gauges. But the design's **information architecture and product semantics are explicitly Tornado-Cash flavored** (note-based commitments, fixed denomination pools, relayer mesh, anonymity-set-per-pool, hops counters). Sipher's actual backend is `sipher_vault` — a single-PDA program that charges `fee_bps` on any amount, uses stealth-address derivation (not Tornado notes), and has no relayer mesh.

Three honest paths existed:

- **Path A** — Adopt visual language, reinterpret Tornado-flavored slots into thesis-aligned features. Visual win in 1-2 weeks. Thesis intact.
- **Path B** — Build a denominated-note-mixer as an *additional* SIP privacy backend (alongside stealth + Pedersen). Aligns with the dual-moat strategy ("Privacy backends → SIP Native, PrivacyCash, Arcium, Inco"). 4-6 month scope.
- **Path C** — Full pivot. Replace `sipher_vault` with a Tornado-Cash-style mixer. Abandons "any amount + viewing keys + compliance" thesis. Breaks Superteam Indo grant deliverables, blows up Solana Audit Subsidy V scope, requires re-pitching Solana Foundation.

This spec executes **Path A now + commits Path B as a Q3 2026 milestone (M19/M20)**. Path C is explicitly rejected. The redesign is the **content** of the X thread #1 launch — without it Phase D ships against the existing UI; with it Phase D ships against a polished launch surface that doubles as a roadmap visualization.

The spec also couples a **Vercel FE migration as PR 0** of the sprint. Sipher's frontend currently bundles with the agent backend in a single Docker image; splitting `app/` to Vercel unlocks per-PR preview URLs (essential for an 8-PR visual sprint), aligns with the broader "FE → Vercel, VPS keeps backend only" plan in MEMORY.md, and tests cross-origin auth in production-like conditions before users see it.

---

## Project Goals

After the sprint completes:

1. **Sipher's live UI matches the designer's glass-neon language across every surface** — Dashboard, Vault, Deposit, Withdraw, Chains (was "Relayers"), Keys (NEW), Settings (NEW), Privacy Report (NEW), plus restyled Herald + Squad/SENTINEL admin views.
2. **All Tornado-flavored slots are reinterpreted into honest, thesis-aligned features** — Network atlas → Privacy graph (stealth-address tree); Denomination pools → Multi-chain vault grid (per-chain TVL); Anonymity set → Shielded volume; Secret notes → Stealth address entries; Withdraw routing → Stealth derivation depth.
3. **No mock data is shipped.** Every number on the live site comes from a real endpoint or is removed. "1,284 active depositors", "11/12 relayers online", "0.001 SOL fee on 0.1 SOL pool" — none of those exist on the live site.
4. **Frontend is deployed on Vercel; backend stays on VPS.** `sipher.sip-protocol.org` resolves to Vercel (FE), `api.sipher.sip-protocol.org` resolves to VPS (backend). PR previews land at `*-sipher.vercel.app`.
5. **Cross-origin auth works for all PR #176 surfaces.** Phantom one-popup, JWT 24h, `/api/auth/refresh`, fail-closed `/pay/:id/confirm`, SENTINEL — all green on the new origin split.
6. **Design tokens are the single source of truth.** Components reference Tailwind utilities derived from `app/src/styles/tokens.css`; no hex/rgba in TSX (lint-enforced).
7. **The design doubles as the public roadmap visual.** `ROADMAP.md` is rewritten with design screenshots as section anchors per quarter milestone, including the explicit Path B (denominated note mixer) Q3 2026 milestone.
8. **Phase D X thread #1 launches against the redesigned site.** The thread is a launch + roadmap announcement, not just "beta open".
9. **Sprint completes within ~9-12 working days end-to-end** with each PR independently deployable, independently reviewable on a Vercel preview, and zero regressions to PR #176 surfaces.

---

## Locked Decisions

### D1 — Path A now, Path B as Q3 2026 milestone, Path C rejected

The visual concept is preserved. The **product semantics** are reinterpreted slot-by-slot to match `sipher_vault` reality. **Path B** (denominated note mixer as an additional privacy backend, not a replacement) is committed to the public roadmap as M19 or M20 work. **Path C** (replace `sipher_vault` with a Tornado clone) is rejected on grant + audit + foundation-pitch grounds.

### D2 — Couple Vercel FE migration with redesign as PR 0

Single spec, single sprint. PR 0 is mechanical infra (Vercel project link + DNS split + CORS update + remove static-file serve from agent). Zero visual change in PR 0. PRs 1-8 (visual sprint) all auto-deploy Vercel previews per PR. PR 9 is roadmap polish + Phase D gate. Total: 9 PRs.

Alternative considered: ship redesign on the current single-Docker setup, migrate to Vercel later. Rejected because every redesign PR needs a preview URL for review, and re-doing CORS + auth wiring after the fact would be wasteful.

### D3 — Reinterpretation table is binding

Designer's Tornado-flavored surfaces map 1:1 to thesis-aligned features. This table is binding for every PR in the sprint:

| Designer surface (mocked) | Production reinterpretation | Backend it reads from |
|---|---|---|
| **Network atlas** — relayer mesh viz, "11 of 12 online" | **Privacy graph** — stealth-address tree (root → derivation children) + viewing-key disclosure trail. react-flow viz, cyan glow. | New `GET /api/stealth/index` |
| **Denomination pools** — fixed 0.1/1/10/100 SOL | **Multi-chain vault grid** — per-chain vault cards (Solana mainnet/devnet, Sepolia, Arbitrum, Base, OP, Scroll, Linea, Mode) with TVL, fee bps, depositor count, deploy status | New `GET /api/chains` |
| **Anonymity set: 1,284** | **Shielded volume** — sum of vault TVL across chains, in USD or SOL | New `GET /api/chains/aggregate` |
| **Withdraw routing: 2 of 3 hops randomized** | **Stealth derivation depth** — `m/0'/k'` index used + viewing-key scope label | derived from existing wallet state (no backend) |
| **Secret notes** (`sipher-1.0-sol-1-0xa84e9c2f3b1d…`) | **Stealth address entries** — each deposit produces a stealth address, listed with derivation index, last-activity timestamp, "Manage" button (claim, refund, view) | existing `/api/vault` extended |
| **YOUR ROUTE: you → r#2 → pool → r#7 → stealth#4** | **Your derivation path: wallet → vault PDA → stealth #k** | derived (no backend) |
| **Hops count per note (380 HOPS)** | **Days since deposit** — same metric position, different label | derived from `created_at` timestamp |
| **Privacy Score (5 sub-metrics + gauge)** | **Adopt as-is** | existing `/v1/privacy/score` |
| **Activity Stream** | **Adopt as-is** | existing `/api/activity` |
| **Shield SOL CTA + glow** | **Adopt as-is** | existing `vault.deposit` |
| **View Key UX (copy/rotate + encrypted backup)** | **Adopt as-is** (UI gap that this spec fills) | New `GET /api/viewing-keys` + SDK `viewing-key.ts` |

### D4 — Token sheet adoption: file split for re-iteration

Designer's 17KB token sheet is dropped verbatim into `app/src/styles/tokens.css`. A separate `app/src/styles/theme.css` bridges those tokens to Tailwind 4 `@theme` utilities (e.g., `bg-bg`, `text-text-muted`, `shadow-glow-accent-lg`).

Rationale for the split:
- `tokens.css` stays a **drop-in updateable artifact** — if RECTOR runs another designer round and gets a refreshed token sheet, we replace the file
- `theme.css` is the **bridge** — components stay on Tailwind class names, gain new ones for free
- Existing components don't need to know which CSS variable maps to which utility

### D5 — Component file layout: NEW `app/src/components/ui/` for design-system primitives

Five new primitives (`Card`, `Pill`, `HashCell`, `MetricBar`, `Sheet`) plus four feature-specific NEW components (`Gauge`, `TickerBar`, `NodeGraph`, plus dashboard extractions) live under `app/src/components/ui/`. **Existing components stay where they are** and get restyled internally — no breaking import path changes.

### D6 — PR sequence: 9 PRs, dependency-aware parallelism

PRs 0+1+2 are sequential (foundation: Vercel + tokens + shell). PRs 3+5 can run in parallel after foundation lands. PRs 4, 6, 7, 8 can land in any order after PR 3. PR 9 closes the sprint and gates Phase D.

### D7 — Phase D coupling: redesign IS the launch content

X thread #1 is a 3-tweet launch + roadmap announcement, with screenshots from the redesigned production site embedded:
- Tweet 1: visual hook (Dashboard hero with Privacy Graph)
- Tweet 2: differentiation narrative (Multi-chain vault grid as proof of "any amount + multi-chain", contrasted with PrivacyCash's fixed pools)
- Tweet 3: roadmap pull (link to ROADMAP.md, Path B Q3 milestone teased)

### D8 — Admin views (Herald + Squad/SENTINEL) preserved, restyled, NOT in main nav

Designer's left-rail nav has 6 items (Dashboard, Vault, Deposit, Withdraw, Relayers, Keys). Herald + Squad/SENTINEL admin views stay accessible at `/herald` and `/squad` routes — gated by `isAdmin` from `useAuthState`. Reachable via Header avatar dropdown or Settings page. They get the new visual language (Herald uses `--color-herald` blue accents, SENTINEL uses `--color-sentinel` amber) but they don't pollute the public IA.

Designer's intent confirms this: they **explicitly defined** `--color-sipher`, `--color-herald`, `--color-sentinel`, `--color-courier` agent identity colors in the token sheet. The agents aren't deleted from the design system — they're just not promoted into the user-facing nav.

### D9 — Chat IA: collapse persistent right rail to "Ask SIPHER" slide-over

Designer's design folds the always-visible chat sidebar into a global "Ask SIPHER" trigger in the top bar. Clicking it opens a `Sheet` (right slide-over panel). Reclaims ~360px of horizontal canvas for the redesigned dashboard.

Rationale: the persistent chat rail consumes valuable space the new Dashboard hero (Privacy Graph) needs. Slide-over preserves chat functionality 1:1 (same SSE stream, same auth gate, same SENTINEL confirm flow) while letting the canvas breathe.

### D10 — No mock data leakage

Hard rule, lint-enforced where possible: every number visible on the live site comes from a real endpoint or is removed. No `1,284 active depositors`, no `11/12 relayers online`, no `380 HOPS`, no `0.001 SOL fee on 0.1 SOL pool`. PR review checklist includes a "scan for hardcoded numerical strings" pass.

If a designer surface needs data we don't yet have a backend for, the surface either:
- (a) doesn't ship until the backend lands, OR
- (b) ships with explicit "M18 in progress" / "Q3 2026" placeholder copy that's labeled as a roadmap teaser

### D11 — Bottom-nav left intact for mobile

Designer's design assumes desktop viewport. The existing `BottomNav.tsx` for mobile (md: breakpoint and below) stays — restyled with new tokens but functionally unchanged. Mobile users still get the 4-tab pattern (Home, Vault, Chat, plus a More-drawer that surfaces Herald/Squad/Settings/Disconnect for admin). Desktop users get the new 6-item left rail (Dashboard, Vault, Deposit, Withdraw, Chains, Keys).

---

## Information Architecture

### Final IA (left-rail nav, desktop ≥ md)

| # | Nav item | Route | What lives there |
|---|---|---|---|
| 1 | **Dashboard** | `/` | Privacy graph hero + Privacy Score + Shielded Volume + Activity Stream + Multi-chain mini-grid |
| 2 | **Vault** | `/vault` | Shielded vault balance + stealth-address list + Unshielded wallet + Shield-to-vault CTA + Route preview |
| 3 | **Deposit** | `/deposit` | Form-driven deposit (any amount) + real-time Privacy Preview right panel |
| 4 | **Withdraw** | `/withdraw` | Mirror of Deposit; claim flow against existing stealth addresses |
| 5 | **Chains** *(was "Relayers")* | `/chains` | Multi-chain vault status table (designer's relayer registry shape, repurposed) |
| 6 | **Keys** *(NEW)* | `/keys` | View Key card with Copy/Rotate + per-stealth-address derivation index list with "Download encrypted backup" |

### Admin routes (gated by `isAdmin`, NOT in main nav)

| Route | View | Identity color |
|---|---|---|
| `/herald` | HeraldView (queue, budget, X agent control) | `--color-herald` (blue) |
| `/squad` | SquadView (4-agent dashboard, kill switch) | `--color-sentinel` (amber) |
| `/settings` | SettingsView (network, SENTINEL mode, FUND_MOVING_TOOLS) | neutral |

### Top-level routes (NOT in nav, accessed via deep link or button)

| Route | View | Trigger |
|---|---|---|
| `/privacy-report` | PrivacyReportView (deep dive) | "View report →" button on Dashboard PrivacyScoreCard |

### Bottom nav (mobile, < md)

| Tab | View |
|---|---|
| Home | DashboardView |
| Vault | VaultView |
| Chat | (opens Ask SIPHER sheet) |
| ⋯ More | drawer with Herald (admin), Squad (admin), Settings, Disconnect |

---

## Visual System Foundation

### Token sheet — verbatim from designer, 17 sections

Source: `~/Downloads/sipher-redesign-tokens.css` (extracted via Claude Designer chat prompt asking for plain CSS custom properties, then downloaded as a file blob to bypass Chrome MCP output filtering on long key=value strings).

**17 sections, 301 lines, ~17KB:**

1. **COLOR — BACKGROUND LAYERS** (5 stops: bg, bg-1 through bg-4) — `#0A0A0F` page through `#232334` popovers
2. **SURFACE — translucent** (4 glass layers) — `rgba(255,255,255, 0.025 → 0.12)`
3. **HAIRLINES** (4 line variants including violet accent at `rgba(124,58,237,0.35)`)
4. **COLOR — TEXT HIERARCHY** (5 levels: text/secondary/muted/dim/inverse)
5. **COLOR — BRAND ACCENTS** — primary violet `#7C3AED` + cyan `#22D3EE`, with hi/lo/soft/glow variants each
6. **COLOR — STATUS** (success/warning/danger/info, each with soft + glow variants)
7. **COLOR — AGENT IDENTITY** — sipher emerald `#10B981`, herald blue `#3B82F6`, sentinel amber `#F59E0B`, courier violet `#8B5CF6`
8. **COLOR — PRIVACY GRADE** (A→F gradient: green/lime/yellow/orange/red)
9. **GRADIENTS** (11 named: brand, brand-vert, brand-soft, cta, cta-hover, cta-pressed, progress, progress-success, gauge conic, gauge-track, bloom radial, card-sheen, hairline)
10. **TYPOGRAPHY** — Inter sans + JetBrains Mono mono, modular text scale 10/11/12/14/15/17/20/24/32/44/60/84, weights 400-700, 6 letter-spacings (incl. `--tracking-mega: 0.22em` for SIPHER wordmark), 5 line-heights
11. **SPACING — 4px base** (19 stops: 0, px, 0-5, 1, 1-5, ..., 24)
12. **BORDER RADIUS** (8 values: xs through 3xl + pill 999px + full 9999px)
13. **BLUR — for glass/backdrop layers** (7 amounts + 3 saturation pairs: `blur(14px) saturate(140%)`, `blur(22px) saturate(160%)`, `blur(32px) saturate(180%)`)
14. **SHADOWS — elevation** (6 elevation levels + 2 inset hairlines)
15. **GLOW — neon recipes** — including the load-bearing `--glow-accent-lg` (Shield SOL primary CTA): multi-layer violet halo with cyan accent on bottom edge
16. **ANIMATION — durations + easings** (7 durations: 60ms instant through 8000ms bloom + 8 easings: linear/in/out/in-out/out-expo/out-back/spring/anticipate)
17. **LAYOUT** — 7 z-indices, 5 breakpoints, 2 container widths, sidebar widths, header heights

### File layout (additions)

```
app/src/styles/
├── tokens.css            NEW — verbatim designer dump (301 lines)
├── theme.css             NEW — @theme block bridging tokens to Tailwind utilities + base resets
├── glass.css             NEW — utility classes (.glass-1, .glass-2, .glass-strong)
└── animations.css        NEW — keyframes (pulse-bloom, shimmer, gauge-fill spring)

app/src/components/ui/    NEW directory — design-system primitives
├── Card.tsx              NEW — glass-paneled card with optional sheen + bloom variants
├── Gauge.tsx             NEW — privacy score circular gauge (cyan→violet conic, animated fill)
├── MetricBar.tsx         NEW — labeled progress bar (used by privacy score sub-metrics)
├── Pill.tsx              NEW — status/filter pills (ALL, DEPOSIT, WITHDRAW, etc.)
├── HashCell.tsx          NEW — mono-font truncated hash with copy-on-click
├── TickerBar.tsx         NEW — top-bar SOL/GAS/SLOT live ticker
├── NodeGraph.tsx         NEW — react-flow wrapper for Privacy graph
└── Sheet.tsx             NEW — right-side slide-over panel (used by "Ask SIPHER" trigger)
```

### Design language rules (enforced in PR review)

1. **No hardcoded colors in TSX.** ESLint rule (`no-restricted-syntax`) blocks hex/rgba in JSX/TSX expressions; use Tailwind utility derived from token.
2. **Glass panels use `Card` component**, three variants: `glass-1` (default), `glass-2` (hover/elevated), `glass-strong` (modals/popovers).
3. **Hero numerals use `--font-mono` with `--text-6xl` (84px)** — gauge value, shielded volume figure, vault balance.
4. **CTAs follow 3-tier glow recipe:**
   - Primary: `shadow-glow-accent-lg` (Shield SOL, Continue) — multi-layer violet halo with cyan accent
   - Secondary: `shadow-glow-accent-md`
   - Tertiary/outline: hairline border, no glow
5. **Eyebrow labels** above section headings: `--tracking-widest` (0.16em) all-caps in `--text-2xs` (10px) muted color.
6. **Animations:** Gauge fills use `--ease-spring`; drawer/sheet opens use `--ease-out-expo`; default UI transitions use `--ease-out` at `--duration-base` (200ms).
7. **Accessibility:** All glow shadows have a non-glow fallback for `prefers-reduced-motion`. Focus rings use `--glow-focus-ring` (4px violet at 0.22 opacity). All interactive elements have ARIA labels.

---

## Component Inventory

Each component listed below has: status (NEW / RESTYLE / DELETE), backend it reads from, and PR assignment.

### Shell (cross-cutting)

| Component | Status | Backend | PR |
|---|---|---|---|
| `app/src/components/Header.tsx` | RESTYLE | `useAuthState`, `useNetworkConfigStore` | PR 2 |
| `app/src/components/BottomNav.tsx` | RESTYLE | `useAppStore.activeView` | PR 2 |
| `app/src/components/ChatSidebar.tsx` | RESTYLE → SLIDE-OVER | unchanged | PR 2 |
| `app/src/components/ui/TickerBar.tsx` | NEW | client-side polling (Jupiter price-v3 + Helius slot) | PR 3 |
| `app/src/components/ui/Sheet.tsx` | NEW (primitive) | — | PR 1 |
| `app/src/components/ui/Card.tsx` | NEW (primitive) | — | PR 1 |
| `app/src/components/ui/Pill.tsx` | NEW (primitive) | — | PR 1 |
| `app/src/components/ui/HashCell.tsx` | NEW (primitive) | — | PR 1 |
| `app/src/components/ui/MetricBar.tsx` | NEW (primitive) | — | PR 1 |

### Dashboard surface

| Component | Status | Backend | PR |
|---|---|---|---|
| `app/src/views/DashboardView.tsx` | RESTYLE | unchanged | PR 3 |
| `app/src/components/ui/Gauge.tsx` | NEW | — | PR 3 |
| `app/src/components/PrivacyScoreCard.tsx` | NEW (extracts from DashboardView) | `/v1/privacy/score` | PR 3 |
| `app/src/components/ActivityStreamTable.tsx` | NEW (extracts from DashboardView) | `/api/activity` | PR 3 |
| `app/src/components/ShieldedVolumeCard.tsx` | NEW (replaces Anonymity Set) | `GET /api/chains/aggregate` (NEW) | PR 4 |
| `app/src/components/ui/NodeGraph.tsx` | NEW (react-flow wrapper) | — | PR 4 |
| `app/src/components/PrivacyGraph.tsx` | NEW (replaces Network atlas) | `GET /api/stealth/index` (NEW) | PR 4 |
| `app/src/components/MultiChainVaultGrid.tsx` | NEW (replaces Denomination pools mini) | `GET /api/chains` (NEW) | PR 5 |

### Vault surface

| Component | Status | Backend | PR |
|---|---|---|---|
| `app/src/views/VaultView.tsx` | RESTYLE — split into ShieldedVault + UnshieldedWallet panels + RoutePreview | `/api/vault`, `vault.deposit`, `/api/activity` | PR 6 |
| `app/src/components/StealthAddressList.tsx` | NEW (replaces "secret notes" list) | `/api/vault` extended | PR 6 |
| `app/src/components/RoutePreviewCard.tsx` | NEW (replaces multi-relayer route) | derived | PR 6 |

### Deposit / Withdraw surface

| Component | Status | Backend | PR |
|---|---|---|---|
| `app/src/views/DepositView.tsx` | NEW | `vault.deposit` | PR 6 |
| `app/src/views/WithdrawView.tsx` | NEW | `vault.withdraw_private`, `vault.refund` | PR 6 |
| `app/src/components/PrivacyPreviewPanel.tsx` | NEW | `/v1/privacy/score?projected=` (extended) | PR 6 |

### Chains surface (Relayers tab repurposed)

| Component | Status | Backend | PR |
|---|---|---|---|
| `app/src/views/ChainsView.tsx` | NEW | `GET /api/chains` (NEW) | PR 5 |

### Keys surface (NEW)

| Component | Status | Backend | PR |
|---|---|---|---|
| `app/src/views/KeysView.tsx` | NEW | `GET /api/viewing-keys` (NEW) | PR 7 |
| `app/src/components/ViewKeyCard.tsx` | NEW | — | PR 7 |
| `app/src/components/StealthAddressBackup.tsx` | NEW | SDK `viewing-key.ts` | PR 7 |

### Admin surfaces (preserve, restyle)

| Component | Status | Backend | PR |
|---|---|---|---|
| `app/src/views/HeraldView.tsx` | RESTYLE (uses `--color-herald` blue accents) | `/api/herald` | PR 8 |
| `app/src/views/SquadView.tsx` | RESTYLE (uses `--color-sentinel` amber accents) | `/api/squad`, `/api/sentinel` | PR 8 |
| `app/src/components/SentinelConfirm.tsx` | RESTYLE | `/api/sentinel/promise-gate/...` | PR 8 |

### Settings + Privacy report

| Component | Status | Backend | PR |
|---|---|---|---|
| `app/src/views/SettingsView.tsx` | NEW | env-derived | PR 7 |
| `app/src/views/PrivacyReportView.tsx` | NEW | existing `/v1/privacy/score` recommendations | PR 3 |

### Backend additions (5 new endpoints)

| Endpoint | Purpose | PR |
|---|---|---|
| `GET /api/chains` | Per-chain vault status (Solana + 7 EVM L2s with TVL, fee, program ID, status) | PR 5 |
| `GET /api/chains/aggregate` | Sum TVL across chains for Shielded Volume card | PR 4 |
| `GET /api/stealth/index` | Per-wallet stealth address tree + derivation indices for Privacy Graph | PR 4 |
| `GET /api/viewing-keys` | List user's viewing keys for Keys view | PR 7 |
| `POST /api/viewing-keys/rotate` | Rotate viewing key | PR 7 |

### Components NOT touched (preserved as-is)

- `app/src/providers/AuthSyncProvider.tsx` — auth surface from PR #176, untouchable
- `app/src/api/client.ts` — `apiFetch` + 401 interceptor
- `app/src/api/auth.ts` + `app/src/api/refresh.ts` — auth wiring
- `app/src/stores/app.ts` — Zustand persist store
- All hooks under `app/src/hooks/`
- `app/src/lib/networkConfig.ts`

### File count summary

- **NEW:** 9 ui/* primitives + 12 feature components + 5 views + 5 backend endpoints = **31 new files**
- **RESTYLE:** 6-8 existing files (Header, BottomNav, ChatSidebar, DashboardView, VaultView, HeraldView, SquadView, SentinelConfirm)
- **DELETE:** 0 files (zero regressions)

---

## PR Sequence

9 PRs total. Each independently deployable, each gets a Vercel preview URL after PR 0 lands. Estimated calendar time: **9-12 working days** assuming same-day reviews.

### PR 0 — Vercel FE migration (zero visual change)

**Branch:** `feat/vercel-fe-split`
**Goal:** Move `app/` to a Vercel deployment without changing UX or visuals.

**Tasks:**
- Add `vercel.json` at repo root with `app/` as project root
- Add `.vercelignore` excluding backend dirs
- Update `app/.env.example` with `VITE_API_URL=https://api.sipher.sip-protocol.org`
- Backend: remove `app.use(express.static(webRoot))` from `packages/agent/src/index.ts:222`
- Backend: tighten `CORS_ORIGINS` env to `https://sipher.sip-protocol.org,https://*-sipher.vercel.app`
- DNS: cut `sipher.sip-protocol.org` from VPS nginx → Vercel; create `api.sipher.sip-protocol.org` pointing at VPS via Cloudflare proxy
- Vercel project link: `vercel link` to sip-protocol org, configure env vars (`VITE_API_URL`)
- Update Phase 4a auth fix env doc with new origin
- Smoke: existing auth flow works on `https://sipher.sip-protocol.org` (Vercel) → `https://api.sipher.sip-protocol.org` (VPS)

**Acceptance:** sipher.sip-protocol.org loads on Vercel, hits api.sipher.sip-protocol.org for backend, all PR #176 surfaces (Phantom one-popup, /refresh, JWT 24h, /pay/:id/confirm, sentinel) work end-to-end. Backend CI stays green.

### PR 1 — Theme tokens + UI primitives (foundation)

**Branch:** `feat/redesign-tokens`
**Goal:** Drop in tokens.css, configure Tailwind 4 @theme, ship 5 primitive components. Zero visual change to existing screens.

**Tasks:**
- Move `~/Downloads/sipher-redesign-tokens.css` → `app/src/styles/tokens.css`
- Write `app/src/styles/theme.css` (@theme block + base resets)
- Write `app/src/styles/glass.css` + `animations.css`
- Update `app/src/main.tsx` imports
- Build 5 ui/* primitives: `Card`, `Pill`, `HashCell`, `MetricBar`, `Sheet`
- Vitest tests for primitives (snapshot + interactive states)
- Verify on Vercel preview that existing UI still renders identically

**Acceptance:** Vercel preview shows existing UI unchanged. Primitives covered by tests. Build size delta < 30KB gzipped.

### PR 2 — Shell restyle (Header + BottomNav + ChatSidebar slide-over)

**Branch:** `feat/redesign-shell`
**Goal:** Frame restyled. ChatSidebar collapses to "Ask SIPHER" trigger.

**Tasks:**
- Restyle `Header.tsx` with new bg, hairline border, ticker placeholder, identity colors
- Restyle `BottomNav.tsx` with new spacing, hover states
- Convert `ChatSidebar.tsx` from persistent right rail to `Sheet` slide-over, triggered by Header "Ask SIPHER" button
- Update `app/src/views/App.tsx` layout: full-width main canvas (no chat rail)
- Existing tests updated for new DOM structure

**Acceptance:** Vercel preview shows new shell. Chat input behaviorally identical. Screen reader/a11y validated.

### PR 3 — Dashboard refresh + Privacy report deep dive

**Branch:** `feat/redesign-dashboard`
**Goal:** Dashboard view fully restyled. PrivacyScore gauge animated. Live ticker. View report → deep dive page.

**Tasks:**
- Build `Gauge.tsx` (cyan→violet conic with spring fill, ARIA roles)
- Extract `PrivacyScoreCard.tsx`, `ActivityStreamTable.tsx` from `DashboardView.tsx`
- Build `TickerBar.tsx` (Jupiter price-v3 + Helius slot subscription, 5s polling)
- Build `PrivacyReportView.tsx` route (uses existing `/v1/privacy/score` recommendations array)
- Wire `View report →` button to navigate
- Tests: gauge snapshot at 0/50/100, ActivityStreamTable filter pills, ticker fallback when API down

**Acceptance:** Dashboard renders with new visuals. Gauge animates from 0 → 72 on mount. Activity stream filters work. Live ticker shows real SOL price. Privacy report page renders with recommendations.

### PR 4 — Privacy graph + Shielded Volume card

**Branch:** `feat/redesign-privacy-graph`
**Goal:** Replace mocked Network atlas + Anonymity Set with real reinterpreted surfaces.

**Tasks:**
- Backend: `GET /api/stealth/index` (per-wallet stealth tree + derivation indices)
- Backend: `GET /api/chains/aggregate` (sum TVL across chains)
- FE: Build `NodeGraph.tsx` (react-flow wrapper) + `PrivacyGraph.tsx` consumer
- FE: Build `ShieldedVolumeCard.tsx` (replaces AnonymityCard)
- FE: Wire into Dashboard layout (NodeGraph as hero, replaces Network atlas slot)
- Tests: stealth-index endpoint integration test, NodeGraph snapshot, ShieldedVolumeCard with mock TVL

**Acceptance:** Dashboard hero shows the user's actual stealth-address tree. Shielded Volume card shows real summed TVL across chains.

### PR 5 — Multi-chain vault grid (Chains tab)

**Branch:** `feat/redesign-chains`
**Goal:** New Chains page with per-chain vault status.

**Tasks:**
- Backend: `GET /api/chains` (per-chain vault state from M18 deployments)
- FE: Build `MultiChainVaultGrid.tsx` (Dashboard mini-cards)
- FE: Build `ChainsView.tsx` (full page table, /chains route)
- FE: Wire route + sidebar nav
- Tests: chains endpoint, ChainsView with mock data, mainnet/devnet differentiation

**Acceptance:** Chains tab shows live status of Solana + 7 EVM L2 vault deployments. Dashboard shows the mini-grid. Status pills correctly reflect deployment state from M18.

### PR 6 — Vault + Deposit + Withdraw surfaces

**Branch:** `feat/redesign-vault-flows`
**Goal:** Stealth-address-list view + amount-driven deposit/withdraw forms with real-time privacy preview.

**Tasks:**
- Restyle `VaultView.tsx` — split into ShieldedVault + UnshieldedWallet + RoutePreview
- Build `StealthAddressList.tsx` (replaces "secret notes" list)
- Build `RoutePreviewCard.tsx` (3-step path)
- Build `DepositView.tsx` route — amount input, real-time PrivacyPreviewPanel
- Build `WithdrawView.tsx` route — claim flow against existing stealth addresses
- Build `PrivacyPreviewPanel.tsx` (uses `/v1/privacy/score?projected=`)
- Backend: extend `/v1/privacy/score` to accept `?projected={amount}` query
- Tests: deposit form validation, projected privacy score, vault view layout

**Acceptance:** Vault renders the user's stealth address list with derivation depths. Deposit form computes projected privacy score in real time. Withdraw flow lists claimable stealth addresses.

### PR 7 — Keys + Settings (new surfaces)

**Branch:** `feat/redesign-keys-settings`
**Goal:** New Keys view (view key sharing + encrypted backup) + Settings view (admin config).

**Tasks:**
- Backend: `GET /api/viewing-keys` + `POST /api/viewing-keys/rotate`
- FE: Build `KeysView.tsx`, `ViewKeyCard.tsx`, `StealthAddressBackup.tsx`
- FE: Build `SettingsView.tsx` (network, SENTINEL mode, FUND_MOVING_TOOLS — admin gated)
- FE: Wire routes + sidebar nav
- Tests: viewing-keys endpoint integration, encrypted backup download flow, settings admin gate

**Acceptance:** Keys view lets user copy + rotate viewing key, download encrypted backup. Settings view exposes admin config behind auth gate.

### PR 8 — Admin views restyle (Herald + Squad + SENTINEL)

**Branch:** `feat/redesign-admin`
**Goal:** Apply visual language to admin surfaces. Use identity colors per agent.

**Tasks:**
- Restyle `HeraldView.tsx` with `--color-herald` blue accents
- Restyle `SquadView.tsx` with `--color-sentinel` amber accents
- Restyle `SentinelConfirm.tsx` (consistent with new modal/sheet patterns)
- Update existing tests for new DOM structure

**Acceptance:** Admin views match design language, no IA regression, admin gates intact, all kill-switch + circuit-breaker flows still work.

### PR 9 — ROADMAP.md update + Phase D launch prep

**Branch:** `chore/roadmap-design-anchor`
**Goal:** Public roadmap published with design as visual north star. Final pre-launch polish.

**Tasks:**
- Rewrite `ROADMAP.md` — embed design screenshots as section anchors per quarter milestone
- Add "Path B — Q3 2026 Note Mixer" milestone with M19/M20 references
- Spec polish (any drift from PRs 0-8)
- Final `/quality:qa` Phase 1 sweep against live Vercel deployment
- X thread #1 draft refresh with redesign live

**Acceptance:** ROADMAP.md merged + visible at github.com/sip-protocol/sipher/blob/main/ROADMAP.md. Zero P0 findings on QA. Ready for X thread #1 publication.

### Sprint cadence

```
Day 1   PR 0 (Vercel migration)         RECTOR reviews + merges
Day 2   PR 1 (Tokens) + PR 2 (Shell)    parallel reviews
Day 3-4 PR 3 (Dashboard) + PR 5 (Chains) parallel
Day 5-6 PR 4 (Privacy graph) + PR 6 (Vault flows)
Day 7   PR 7 (Keys/Settings)
Day 8   PR 8 (Admin restyle)
Day 9   PR 9 (Roadmap) + Phase D entry gate checks
Day 10  Phase D — X thread #1 publishes; monitoring kicks in
```

---

## Phase D Launch Coupling

### Phase D entry gates (all must be green before X thread publishes)

| Gate | Verifier |
|---|---|
| All 9 PRs merged to `main` | `gh pr list --repo sip-protocol/sipher --state closed` shows PRs 0-9 |
| Vercel production deployment live | `curl https://sipher.sip-protocol.org` returns redesigned HTML |
| Backend at `api.sipher.sip-protocol.org` healthy | `curl https://api.sipher.sip-protocol.org/api/health` returns `{status: "ok"}` |
| `/quality:qa` Phase 1 re-run | Zero P0 findings |
| Three-wallet manual QA | Phantom + Solflare + Jupiter, tested-against matrix in PR comment |
| ROADMAP.md visible publicly | github.com/sip-protocol/sipher/blob/main/ROADMAP.md returns 200 |
| Day 0 blog post still live | blog.sip-protocol.org/blog/sipher-vault-devnet-beta-open/ returns 200 |
| No PR #176 regressions | Smoke from `2026-05-07-d.md` handoff (config/refresh/nonce/rate-limit) against new origin |

### X thread #1 narrative (3 tweets)

**Tweet 1 — visual hook**
- Screenshot: redesigned Dashboard hero (Privacy Graph + Privacy Score + Shielded Volume)
- Copy: "Sipher devnet beta is open. Privacy-first wallet for Solana with stealth addresses, viewing keys, and a privacy graph showing your address tree in real time. Ship privacy with one click. → sipher.sip-protocol.org"

**Tweet 2 — narrative + differentiation**
- Screenshot: Multi-chain vault grid (real numbers, M18 deployments)
- Copy: "What makes Sipher different: any-amount privacy (no fixed pools), viewing keys for compliance, multi-chain vault routing. Tornado Cash forks lock you into 0.1/1/10/100 SOL. We don't."

**Tweet 3 — roadmap pull**
- Screenshot: redesigned Vault view + ROADMAP.md link
- Copy: "Where we're going: M18 closes Ethereum same-chain. M19 ships proof composition + denominated note mixer as a SECOND privacy backend (your choice — stealth or pool). Roadmap: github.com/sip-protocol/sipher/blob/main/ROADMAP.md"

### Day 0+ monitoring (first 72 hours)

| Signal | Source | Threshold | Action |
|---|---|---|---|
| Vercel error rate | Vercel dashboard | >0.5% 5xx | page RECTOR + CIPHER |
| Backend uptime | VPS + Cloudflare | <99% over 1h | investigate |
| GitHub issues filed | `gh issue list` | any P0/security | triage immediately |
| Steave referrals | direct DM | any | log in `~/Documents/secret/...` |
| X thread engagement | X analytics | — | RECTOR monitors |
| Auth errors / failed sign-ins | backend audit logs | spike >10/min | investigate cross-origin issue |

### Rollback plan

| Severity | Response |
|---|---|
| FE breaks (white screen, layout broken) | Vercel dashboard → "Promote previous deployment" (60s rollback) |
| Backend breaks | VPS: `cd ~/sipher && docker compose pull <previous-tag> && docker compose up -d` |
| Auth breaks (cross-origin issue from PR 0) | Hotfix CORS config + redeploy backend; FE doesn't need redeploy |
| Specific PR regression | revert PR on main, redeploy (Vercel auto-rebuilds on push to main) |

### Day 3+ gate check

Same `pnpm tsx scripts/devnet-beta-gate-check.ts` referenced in the Phase 4a plan. If it passes, Phase 4a is fully closed and the team hands off to M18 closeout work.

---

## Out of Scope (Deferred to Path B / M19+)

These items appear in the designer's exploration but are explicitly not built in this sprint:

1. **Note-based commitment scheme** (designer's "secret notes" model with `sipher-1.0-sol-1-0xa84e9c2f3b1d…`) — would require new ZK circuits + new Anchor program. Path B / M19.
2. **Relayer mesh program + registry** — multiple relayer operators with on-chain registration, fee market, latency tracking. Path B / M19.
3. **Fixed denomination pools** (0.1/1/10/100 SOL) — separate vault PDAs per denomination + routing. Path B / M19. Conflicts with current "any amount" thesis; will live alongside as a CHOICE for users.
4. **Withdraw routing with hop randomization** — multi-relayer route selection. Path B / M19.
5. **Anonymity-set-per-pool counter** — depends on (3). Path B / M19.
6. **Global ⌘K command palette** — entity search across vault + activity + chains + chat. Q3 2026 (M19 polish).
7. **Live network telemetry card** ("4,218 tps", "11/12 relayers") — TPS is achievable via Helius `getNetworkStatus` (cheap, can ship in PR 5), but the relayer count is a Path B concern. Cluster TPS is in scope; relayer count is not.

---

## Open Questions

None at spec time. All major decisions resolved through brainstorming. If implementation surfaces ambiguity, defer to the binding reinterpretation table (D3) or surface as a PR comment for RECTOR review.

---

## References

**Memory entries:**
- `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/MEMORY.md` — Sipher project status (May 4, 2026)
- `~/.claude/projects/.../memory/project_phase4a-auth-security-fix.md` — Phase 4a auth fix predecessor

**Predecessor specs:**
- `docs/superpowers/specs/2026-05-06-phase4a-auth-and-security-fix-design.md`
- `docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md`

**Predecessor handoffs:**
- `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-07-d.md`

**Merged PRs (Phase 4a foundation this redesign builds on):**
- PR #174 — docs spec+plan (merged 2026-05-07)
- PR #175 — FE AuthSyncProvider (merged 2026-05-07)
- PR #176 — BE auth surface hardening (merged 2026-05-07 at `6f18e93`)
- Docker fix at `d10cf45` (pnpm@10 pin + canonical `pnpm.onlyBuiltDependencies`)

**External design assets:**
- Claude Designer project: `claude.ai/design/p/019dfc33-32d3-7cf3-9cbf-8be37ea0b1e4`
- Token sheet: `~/Downloads/sipher-redesign-tokens.css` (will move to `app/src/styles/tokens.css` in PR 1)

**Related ecosystem context:**
- `sip-protocol/CLAUDE.md` — dual-moat strategy, "Privacy backends → SIP Native, PrivacyCash, Arcium, Inco — Choose your privacy model"
- Solana Audit Subsidy V grant — currently scoped for existing code; Path B (M19) would need separate audit
- Superteam Indo grant — T2 $3K approved, T3 $4K pending; deliverables align with current thesis (not Tornado clone)

**Deployment infrastructure:**
- VPS: `151.245.137.75` (reclabs3) — backend stays here
- Vercel: new — FE moves here
- DNS: Cloudflare — `sipher.sip-protocol.org` migrates to Vercel, new `api.sipher.sip-protocol.org` points at VPS
- Existing Cloudflare tunnel `reclabs3` — unaffected

---

**End of spec.**
