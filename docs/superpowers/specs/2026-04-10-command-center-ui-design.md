# Sipher Command Center UI — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Replaces:** Current basic Vite React chat UI (4 tab views, ~1,365 lines)

---

## Overview

Redesign Sipher's frontend from a basic chat widget into a privacy command center — a professional dashboard for both end users (vault operations, privacy scores) and admins (agent management, HERALD approval, SENTINEL monitoring). Adaptive layout: desktop gets a dense command center with persistent chat sidebar; mobile gets a streamlined wallet experience.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| User persona | Both (admin + user) | Role-based via `AUTHORIZED_WALLETS` — admin tabs hidden for regular users |
| Layout | Adaptive | Desktop: dense panels. Mobile: stacked tabs. One codebase, responsive breakpoints |
| Chat placement | Persistent sidebar (desktop) | SIPHER always available while monitoring. Collapses to own tab on mobile |
| Navigation | Top tabs (desktop), bottom tabs (mobile) | Familiar web-app pattern. Wider main area than icon rail |
| Visual style | Dark professional | `#111113` base, `#161618` cards, `#232326` borders. Rounded, spaced, clean |

## Views

### 1. Dashboard (default view, all users)

**Purpose:** Overview of everything at a glance — the home screen.

**Layout:**
- **Metric cards row** (4 cards, grid):
  - SOL Balance (with USD estimate)
  - Privacy Score (color-coded: green ≥70, yellow 40-69, red <40)
  - Vault Deposits (count + pending claims)
  - Agent Budget (used/total, percentage — admin only, hidden for regular users)
- **Two-column below** (desktop) / stacked (mobile):
  - **Activity Stream** (left/top): Real-time event feed from guardian bus via SSE. Color-coded dots per agent (green=SENTINEL, purple=HERALD, blue=SIPHER, yellow=COURIER). Timestamps as relative time ("2m ago").
  - **Guardian Squad** (right/bottom): Agent status cards showing each agent's state, key metrics, and health dot. Admin only.

**Data sources:**
- `GET /api/vault` — SOL balance, token balances, `balanceStatus`
- `GET /api/stream` (SSE) — real-time activity events
- `GET /api/health` — agent uptime, tool count
- `GET /api/squad` — agent pool status, kill switch state
- `GET /api/herald` — budget, queue length

### 2. Vault (all users)

**Purpose:** Wallet's privacy operations — balances, transactions, deposit/send.

**Layout:**
- **Balance card** — SOL + SPL tokens with real on-chain amounts (from vault API `balances` field)
- **Quick actions** — Deposit, Send, Scan buttons (trigger chat commands)
- **Transaction history** — recent vault activity (deposits, sends, claims, refunds)
- **Privacy score widget** — compact score display with breakdown

**Data sources:**
- `GET /api/vault` — balances, activity
- Chat commands via SIPHER sidebar for operations

### 3. Herald (admin only)

**Purpose:** X/Twitter agent management — approval queue, budget, content.

**Layout:**
- **Budget bar** — spent/remaining with gate indicator (normal/cautious/dm-only/paused)
- **Approval queue** — pending posts with approve/reject/edit actions
- **Recent posts** — posted content with tweet IDs and engagement metrics
- **DM log** — recent DM interactions with intent classification

**Data sources:**
- `GET /api/herald` — queue, budget, DMs, recent posts
- `POST /api/herald/approve/:id` — approve/reject

**Visibility:** Only shown when `wallet ∈ AUTHORIZED_WALLETS`. Tab hidden otherwise.

### 4. Squad (admin only)

**Purpose:** Agent coordination dashboard — health, kill switch, costs.

**Layout:**
- **Kill switch** — prominent toggle with confirmation dialog
- **Agent cards** — expanded versions of dashboard agent cards with:
  - Status (running/stopped/error)
  - Model + provider info
  - Session count
  - Cost this month
  - Last activity timestamp
- **Cost breakdown** — per-agent cost table
- **SENTINEL config** — wallets being monitored, scan interval, alert thresholds

**Data sources:**
- `GET /api/squad` — pool stats, kill switch state, agent details
- `POST /api/squad/kill-switch` — toggle

**Visibility:** Only shown when `wallet ∈ AUTHORIZED_WALLETS`. Tab hidden otherwise.

## Chat Sidebar

**Desktop:** 300px fixed-width panel on the right side of every view. Always visible. Contains:
- Agent name + online status indicator
- Scrollable message history (user messages right-aligned purple, SIPHER left-aligned gray)
- Tool use indicators (loading states when SIPHER calls tools)
- Confirmation cards for fund-moving operations (inline in chat)
- Text input + send button at bottom

**Mobile:** Chat becomes its own tab (💬) in the bottom navigation. Full-screen conversation view when active.

**Streaming:** Uses SSE via `POST /api/chat/stream`. Shows token-by-token text, tool use/result events, and final message.

## Adaptive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| ≥1024px (desktop) | Top tabs + main content + chat sidebar |
| 768-1023px (tablet) | Top tabs + main content, chat as overlay drawer |
| <768px (mobile) | Bottom tab nav, chat as dedicated tab, single column |

## Navigation

### Desktop (top bar)
```
[SIPHER logo] | Dashboard | Vault | Herald* | Squad* |  ··· (agent dots)  mainnet  FGSk...BWWr [avatar]
```
*Hidden for non-admin wallets

### Mobile (bottom bar)
```
📊 Home  |  🏦 Vault  |  💬 Chat  |  ⚙️ More
```
"More" opens a sheet with: Herald*, Squad*, Settings, Disconnect Wallet.
*Hidden for non-admin wallets

## Header Elements

- **Logo:** "SIPHER" text, left-aligned
- **Agent status dots:** 3 colored dots (SIPHER/HERALD/SENTINEL) — green=healthy, yellow=degraded, red=error
- **Network badge:** "mainnet" or "devnet" — small text
- **Wallet address:** Truncated (FGSk...BWWr)
- **Avatar:** Purple circle with first letter of wallet or identicon

## Color System

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#111113` | Page background |
| `--bg-card` | `#161618` | Cards, panels, sidebar |
| `--bg-elevated` | `#1E1E22` | Nested elements, input fields |
| `--border` | `#232326` | Card borders, dividers |
| `--text-primary` | `#E4E4E7` | Headings, values |
| `--text-secondary` | `#A1A1AA` | Body text, descriptions |
| `--text-muted` | `#71717A` | Labels, timestamps |
| `--text-dim` | `#52525B` | Tertiary info |
| `--accent` | `#7C3AED` | Brand purple — avatar, chat bubbles, active states |
| `--green` | `#22C55E` | Healthy, good score, online |
| `--yellow` | `#F59E0B` | Warning, budget caution |
| `--red` | `#EF4444` | Error, critical alert, low score |
| `--blue` | `#3B82F6` | SIPHER agent events |
| `--purple` | `#A855F7` | HERALD agent events |

## Tech Stack

- **Framework:** React 19 (existing)
- **Styling:** Tailwind CSS 4 via the existing `app/` Vite setup
- **State:** Zustand (add — currently using useState only)
- **Icons:** Phosphor Icons (lightweight, consistent)
- **Charts:** None for v1 (metric cards are sufficient — charts add complexity without clear value)
- **Build:** Vite (existing)

## Component Architecture

```
App.tsx
├── Header.tsx (logo, tabs, agent dots, wallet)
├── ChatSidebar.tsx (persistent on desktop, own tab on mobile)
├── views/
│   ├── DashboardView.tsx
│   │   ├── MetricCard.tsx (reusable)
│   │   ├── ActivityStream.tsx
│   │   └── AgentStatusPanel.tsx
│   ├── VaultView.tsx (existing, refactored)
│   │   ├── BalanceCard.tsx
│   │   ├── QuickActions.tsx
│   │   └── TransactionHistory.tsx
│   ├── HeraldView.tsx (existing, refactored)
│   │   ├── BudgetBar.tsx
│   │   ├── ApprovalQueue.tsx
│   │   └── DMLog.tsx
│   └── SquadView.tsx (existing, refactored)
│       ├── KillSwitch.tsx
│       ├── AgentCard.tsx (reusable)
│       └── CostBreakdown.tsx
├── components/
│   ├── MetricCard.tsx
│   ├── AgentDot.tsx (existing, enhanced)
│   ├── ActivityEntry.tsx (existing, enhanced)
│   └── ConfirmCard.tsx (existing)
├── hooks/
│   ├── useAuth.ts (existing)
│   ├── useSSE.ts (existing)
│   ├── useApi.ts (existing)
│   └── useIsAdmin.ts (new — checks AUTHORIZED_WALLETS)
└── stores/
    └── app.ts (Zustand — active view, chat messages, vault data cache)
```

## API Endpoints Used

All endpoints already exist. No backend changes needed.

| Endpoint | Used by | Auth |
|----------|---------|------|
| `POST /api/auth/nonce` | Login flow | None |
| `POST /api/auth/verify` | Login flow | None |
| `GET /api/health` | Header agent dots | JWT |
| `GET /api/stream` (SSE) | Activity stream | JWT (query param) |
| `POST /api/chat/stream` | Chat sidebar | JWT |
| `POST /api/command` | Chat sidebar (single message) | JWT |
| `GET /api/vault` | Vault view, dashboard balance | JWT |
| `GET /api/activity` | Dashboard activity history | JWT |
| `GET /api/herald` | Herald view | JWT + owner |
| `POST /api/herald/approve/:id` | Herald approval | JWT + owner |
| `GET /api/squad` | Squad view | JWT + owner |
| `POST /api/squad/kill-switch` | Kill switch toggle | JWT + owner |

## Admin Detection

The frontend needs to know if the connected wallet is an admin. Two approaches:

**Chosen:** The `GET /api/health` response includes `tools` and `uptime`. Add an `isAdmin` field to the JWT verify response (`POST /api/auth/verify`). The auth endpoint already checks `AUTHORIZED_WALLETS` — just include the result in the JWT payload or response body. Frontend stores this in the auth hook and uses it to show/hide Herald + Squad tabs.

## What This Does NOT Include

- User registration / profiles (wallet = identity)
- Charts or graphs (metric cards are sufficient for v1)
- Telegram/Discord adapters UI (backend-only for now)
- Payment link creation UI (use chat command)
- Settings page (use "More" menu on mobile, future expansion)
- Dark/light mode toggle (dark only)

## Migration Strategy

This is a **rewrite** of `app/src/`, not an incremental refactor. The current UI is ~1,365 lines across 10 files. The new UI will be ~2,500-3,500 lines across ~20 files. Same `app/` directory, same Vite config, same build pipeline.

Existing files to **keep and refactor:** `App.tsx`, `vite-env.d.ts`, `main.tsx`, hooks, API client.
Existing files to **rewrite:** all views and most components.
New files: `ChatSidebar.tsx`, `DashboardView.tsx`, `stores/app.ts`, `hooks/useIsAdmin.ts`, several sub-components.
