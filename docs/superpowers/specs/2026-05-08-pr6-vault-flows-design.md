# PR 6 — Vault + Deposit + Withdraw Surfaces — Design Spec

**Date:** 2026-05-08
**Status:** Approved scope, ready for implementation plan
**Sprint:** Glass-neon redesign sprint (Phase 4b) · 6 of 10 sprint PRs already merged
**Predecessor specs:** `2026-05-07-glass-neon-redesign-design.md` (sprint master spec, locks D1–D11)
**Predecessor handoffs:** `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-08-b.md`

## Summary

PR 6 is split into two PRs that ship the form-driven, real-on-chain Sipher Vault interaction layer for the redesigned web app.

**PR 6a — `feat/redesign-vault-flows-deposit`** delivers:
- VaultView restyled as a glass-neon split-panel (ShieldedVault left, UnshieldedWallet right) with a hybrid stealth/positions list.
- New full-page DepositView that signs a real `sipher_vault.deposit` transaction via the existing `useTransactionSigner` hook.
- A privacy-preview panel that consumes an extended `/v1/privacy/score` endpoint to show projected score after the hypothetical deposit lands.
- Three new backend routes: `POST /api/vault/deposit-tx`, `GET /api/vault/positions`, and an extension to `POST /v1/privacy/score`.

**PR 6b — `feat/redesign-vault-flows-withdraw`** delivers:
- New full-page WithdrawView with per-mint refund rows. Each row signs a real `sipher_vault.refund` transaction.
- 24-hour cooldown chip with self-ticking countdown.
- One new backend route: `POST /api/vault/refund-tx`.

Both PRs respect the network constraint (Sipher Vault is devnet-only — `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`) by surfacing a Beta banner extension and disabling action CTAs when the user is on mainnet. No SDK changes are required — every needed builder (`buildDepositTx`, `buildRefundTx`, `fetchDepositRecord`) already exists.

## Context

The redesign sprint master spec called for a "Vault + Deposit + Withdraw" PR (PR 6 of 10) but only sketched the new components in 1–2 lines per task. The plan section reads as a TODO list, not a design — DepositView is one bullet, "Form-driven UI — amount input, asset selector, real-time PrivacyPreviewPanel on the right." This spec fills that gap.

The current `VaultView.tsx` (242 lines) has an inline `AmountForm` + `ConfirmCard` flow that, on submit, calls `seedChat()` to delegate to the chat agent. That delegation pattern works (the `deposit` agent tool already builds the transaction and returns a serialized base64 tx), but it makes the new visual artifacts of the redesign — RoutePreviewCard, PrivacyPreviewPanel — decorative. The form is just a wrapper around chat.

The on-chain reality also imposes constraints not visible from the master spec:

- `sipher_vault.deposit` (wired) takes `(user, token_mint, amount)` and creates/updates a `DepositRecord` PDA per `(user, mint)`. Stealth addresses are not part of the deposit flow.
- `sipher_vault.refund` (wired) returns the deposited balance to the user's wallet, gated by a 24h cooldown.
- `sipher_vault.withdraw_private` (wired in SDK as `buildPrivateSendTx`) sends from vault to a stealth address via CPI to `sip_privacy.create_transfer_announcement`. Already exposed through the existing `send` agent tool, which the chat surface uses.
- `sip_privacy.claim_transfer` (Phase 1 scaffolded only — `serializedTx: null` in the `claim` tool today). Receiving stealth payments requires ECDH derivation that ships in Phase 2 / M19.

This means the master plan's mockup of "Claim from stealth addresses #0/#1/#2" was forward-looking — the on-chain claim path is not actually shippable today. PR 6b accordingly reframes "Withdraw" as "Refund-to-self" — the only on-chain withdraw flow that has end-to-end coverage and ships immediately.

## Goals

1. **Form-driven Sipher Vault UX with first-class transaction signing.** Real wallet popup, real on-chain confirmation, real success state. No chat delegation for the new flows.
2. **Visual flagship surface.** Vault is the heart of the product; PR 6 makes its surface match. Every new component (StealthAddressList, RoutePreviewCard, PrivacyPreviewPanel, DepositForm) uses ui/* primitives shipped in PRs 1–3.
3. **Honest data model.** Where on-chain reality differs from the master plan's sketch (no claim wiring, stub stealth tree, devnet-only), the UI surfaces that explicitly rather than faking it. Banner copy + empty states say "M19 pending" or "devnet only" — never lies, never fakes.
4. **Zero SDK changes.** Every builder PR 6 needs is already in `@sipher/sdk`. The work is endpoint plumbing + components + routes.
5. **Sprint-pace velocity.** PR 6a is roughly the size of PR 4 (~1,500 LOC incl. tests, 8 commits). PR 6b is half that. Both ship within the sprint window without forcing PR 7–9 to wait.

## Non-goals

- **Real `claim_transfer` wiring.** Phase 2 / M19 work. Out of scope; deferred explicitly.
- **Real stealth-tree derivation backing `/api/stealth/index`.** Stub from PR 4 stays; M19 deliverable.
- **Private-send-to-stealth as a new UI flow in WithdrawView.** Already exposed via the `send` agent tool inside chat. Adding a duplicate UI surface risks two ways to do the same thing.
- **Mainnet vault execution.** Sipher Vault is devnet-only. Mainnet is a separate audit + deploy milestone.
- **URL-based deep linking (react-router).** The sprint kept the existing Zustand `activeView` pattern. Phase D launch checklist does not require URL routing.
- **Multi-tx batching** (e.g., deposit + immediate private-send in one signature). Future UX iteration if usage signals warrant.
- **TickerBar SLOT field** (PR 3 stub). Out of PR 6 scope; needs `/api/slot` endpoint that doesn't exist.
- **Reactflow code-splitting** (PR 4 deferred). Bundle size warning is pre-existing; performance follow-up.

## Decisions Locked

Each decision below was adjudicated in dialogue. The table summarizes; subsections detail.

| # | Decision | Lock |
|---|---|---|
| D1 | Scope & integration depth | **Real SDK signing**; PR 6 split into 6a (deposit) + 6b (refund) |
| D2 | Routes vs sub-views | **Full-page routes** added as View enum values (`'deposit'`, `'withdraw'`); CTAs from VaultView panels |
| D3 | Stealth-list data source | **Use existing `/api/stealth/index`** separately (parallel fetch); do NOT extend `/api/vault` |
| D4 | DepositForm structure | **Compose existing `AmountForm`**; new DepositForm wraps AmountForm + AssetSelector + TxStatusBadge |
| D5 | Projected privacy score algorithm | **Synthetic-tx re-run** — append a fake shielded deposit record, re-run all 4 factors |
| D6 | StealthAddressList data model | **Hybrid** — vault positions (real, by mint) + stealth tree (stub from `/api/stealth/index` with M19 banner) |
| D7 | PR 6b withdraw scope | **Refund-to-self only** — list `DepositRecord`s with per-row Refund button. Claim and private-send-to-stealth deferred |
| D8 | Network gating | **Banner extension + disabled CTAs on mainnet**. Server endpoints return 409 `VAULT_UNAVAILABLE` |
| D9 | Asset support | **SOL + USDC + USDT** in selector — matches existing tool support via `resolveTokenMint()` |

### D1 — Real SDK signing, split into 6a and 6b

The existing VaultView delegates to chat via `seedChat()`. PR 6 instead routes form submission through `useTransactionSigner`, which already implements the full state machine (`idle → signing → broadcasting → confirmed | error`). The hook is at `app/src/hooks/useTransactionSigner.ts` (82 lines) and is consumed by no current view — PR 6 is its first FE consumer.

**Why split.** PR 6a (deposit) introduces five new components, three new endpoints, and a major restyle. Adding the withdraw path on top would push the PR past 2,000 LOC and cross-cut two flows in one review. PR 6b is a clean follow-up that reuses everything PR 6a establishes (DepositForm composition pattern, TxStatusBadge, AssetSelector, route-and-CTA pattern, server endpoint shape) — execution should be fast.

**Justification for real signing over delegation.** The plan calls for "Form-driven UI." Chat delegation makes the new visual artifacts decorative. PrivacyPreviewPanel showing projected privacy *before commitment* is meaningful only when the form is the commitment ceremony. A user typing into chat does not pause to read a projection panel.

### D2 — Full-page routes via View enum

The sprint kept Zustand `activeView` as the navigation primitive. PR 3 (`'privacyReport'`) and PR 5 (`'chains'`) followed this pattern. PR 6a adds `'deposit'`; PR 6b adds `'withdraw'`. No new Header tabs (these are actions, not destinations). Entry points are CTAs inside VaultView; exit points are a `← Back to Vault` chip and an auto-redirect on `confirmed` for DepositView.

### D3 — `/api/stealth/index` reused, not duplicated on `/api/vault`

The master plan asked PR 6 to extend `/api/vault` to include `stealthAddresses[]`. But PR 4 already shipped `GET /api/stealth/index`. Duplicating the shape on `/api/vault` would force two contracts to evolve in lockstep and require both shapes to be mocked in tests.

VaultView fires three parallel fetches on mount: `/api/vault`, `/api/stealth/index`, `/api/vault/positions` (new in PR 6a). Each has its own loading state. PrivacyScoreCard fetches `/v1/privacy/score` separately, matching the existing DashboardView pattern.

### D4 — Compose `AmountForm`, do not extend it in place

`AmountForm.tsx` (49 lines, 5 tests) is a single-responsibility component: amount input + max display + submit/cancel. PR 6's DepositForm composes it as a child, owning the surrounding tx state machine and asset selector. AmountForm's existing tests stay green; no migration cost.

The alternative — extending AmountForm with `assets`, `selectedAsset`, and tx-status props — bloats it into a multi-job component, breaks tests, and creates a second migration burden when WithdrawView's RefundList wants different ergonomics.

### D5 — Synthetic-tx re-run for projected privacy score

The existing `/v1/privacy/score` endpoint analyzes up to 100 prior signatures across four factors: `addressReuse`, `amountPatterns`, `timingCorrelation`, `counterpartyExposure`. Each factor's analyzer takes the structured `txData`, `amounts`, or `timestamps` as input.

For projection, PR 6a appends ONE synthetic record reflecting the proposed deposit:

- A synthetic destination address representing a fresh stealth pubkey (32 zero bytes, never previously seen by the analyzer — guarantees `+1 unique counterparty`).
- The projected amount in lamports / base units.
- Timestamp `now`.

The four factor analyzers re-run on the augmented input. The endpoint returns the original shape PLUS a `projected` block with `{ score, grade, factors, delta }`. Backwards-compatible — when `projectedAmount` is absent, the response is byte-for-byte identical to today.

**Why honest math over heuristic deltas.** Heuristic deltas violate D10 of the master spec ("no mock data leakage"). Real math may produce small deltas (often 0–5 points when a wallet has 100 prior txs); the panel surfaces that truthfully with informational copy ("Already at maximum — no improvement projected" when current score is 100, "No prior history — projection identical to current" when txCount is 0).

### D6 — Hybrid StealthAddressList: positions (real) + tree (stub)

The plan sketched a list of derived stealth addresses with per-row amounts. The real `/api/stealth/index` returns a single root row stub; full derivation is M19 work. To avoid a hollow visual, PR 6a renders two stacked sections inside StealthAddressList:

- **Top: Vault positions.** One row per `DepositRecord` with non-zero balance, grouped by token mint. Real on-chain data via the new `GET /api/vault/positions` endpoint. Renders mint symbol, balance, last deposit timestamp, lockedAmount status.
- **Bottom: Stealth tree.** Renders the `/api/stealth/index` tree. While PR 4's stub returns root only, the section displays a single row + a `M19` pill explaining "Derived stealth tree expands when M19 ships."

When real derivation lands, the bottom section lights up automatically — no FE migration needed.

### D7 — PR 6b WithdrawView is refund-to-self only

The on-chain options for "withdraw" are:

1. `refund` — return depositor's balance to depositor's wallet (24h cooldown). **Wired.**
2. `withdraw_private` (`buildPrivateSendTx`) — send from vault to a stealth address. **Wired.** Already exposed via the `send` agent tool used in chat.
3. `claim_transfer` (sip_privacy) — claim a received stealth payment. **Phase 1 scaffolded, NOT WIRED.** The `claim` tool returns `serializedTx: null` and a `Phase 2 will wire to the real claim_transfer instruction` comment.

PR 6b ships option (1) only. Per-mint rows show balance + cooldown chip. When the cooldown elapses, the per-row Refund button enables; clicking it signs `buildRefundTx` and broadcasts. Option (2) is left to chat (no UI duplication); option (3) defers to Phase 2 / M19.

### D8 — Banner + disabled CTAs on mainnet

Sipher Vault's program ID `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` is deployed on devnet only. On mainnet, every vault transaction would fail at chain time. The UX response:

- `BetaBanner.tsx` extends to display "Sipher Vault is on devnet — switch network to deposit/withdraw" when `network === 'mainnet-beta'`.
- VaultView's Deposit and Withdraw CTAs render with `disabled` attribute and a tooltip "Devnet only — switch network."
- `/api/vault/positions` returns `{ positions: [], available: false, reason: 'mainnet-beta_no_vault' }` on mainnet rather than 500 errors.
- `/api/vault/deposit-tx` and `/api/vault/refund-tx` return `409 { code: 'VAULT_UNAVAILABLE', message: 'Sipher Vault is on devnet only' }` on mainnet (defense in depth — UI shouldn't allow the request, but the server enforces too).
- DepositView and WithdrawView, if reached directly via `setActiveView`, render their disabled-on-mainnet variants.

### D9 — Multi-asset (SOL + USDC + USDT)

`resolveTokenMint()` in `@sipher/sdk` already maps `'SOL' | 'USDC' | 'USDT'` (and any base58 mint string) to a `PublicKey`. The `deposit`, `send`, and `refund` agent tools all support these. PR 6's AssetSelector exposes the same three options. SOL deposits use the WSOL mint; the existing builders handle that internally (no FE wrapping logic).

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (sipher.sip-protocol.org)                                         │
│                                                                            │
│ VaultView (restyled)             DepositView (PR 6a)    WithdrawView (6b) │
│ ├─ ShieldedVault (left)          ├─ DepositForm         ├─ RefundList     │
│ │  ├─ Total balance              │  ├─ AmountForm       │  ├─ per-record   │
│ │  ├─ StealthAddressList         │  ├─ AssetSelector    │  │   row         │
│ │  │  ├─ Vault positions (real)  │  └─ TxStatusBadge    │  └─ CooldownChip │
│ │  │  └─ Stealth tree (stub)     ├─ RoutePreviewCard    └─ TxStatusBadge   │
│ │  └─ "Withdraw" CTA             ├─ PrivacyPreviewPanel    (per row)       │
│ └─ UnshieldedWallet (right)      └─ useTransactionSigner                   │
│    ├─ Wallet balance                                                       │
│    ├─ RoutePreviewCard                                                     │
│    └─ "Shield to vault" CTA                                                │
└────────────────────────────────────────────────────────────────────────────┘
                                    ↓ HTTPS
┌────────────────────────────────────────────────────────────────────────────┐
│ BACKEND (sipher-api.sip-protocol.org)                                      │
│                                                                            │
│ Existing (untouched):  GET /api/vault, GET /api/stealth/index,             │
│                        GET /api/chains, POST /v1/privacy/score (extended)  │
│ New (PR 6a):           POST /api/vault/deposit-tx                          │
│                        GET  /api/vault/positions                           │
│ New (PR 6b):           POST /api/vault/refund-tx                           │
│ Extended (PR 6a):      POST /v1/privacy/score adds projectedAmount field   │
└────────────────────────────────────────────────────────────────────────────┘
                                    ↓ SDK
┌────────────────────────────────────────────────────────────────────────────┐
│ @sipher/sdk (no changes)                                                   │
│  buildDepositTx ✓     buildRefundTx ✓      fetchDepositRecord ✓            │
│  resolveTokenMint ✓   getTokenDecimals ✓   toBaseUnits ✓                   │
│  buildPrivateSendTx ✓ (used by chat send tool, NOT in PR 6 scope)          │
└────────────────────────────────────────────────────────────────────────────┘
                                    ↓ Anchor program
┌────────────────────────────────────────────────────────────────────────────┐
│ sipher_vault (devnet only)                                                 │
│  S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB                               │
│   deposit (PR 6a)              refund (PR 6b)                              │
│   withdraw_private (chat)      authority_refund (SENTINEL)                 │
└────────────────────────────────────────────────────────────────────────────┘
```

## Backend Changes

### `POST /api/vault/deposit-tx` (new, PR 6a)

**Body:** `{ amount: number, token: string }` — `token` ∈ `['SOL', 'USDC', 'USDT']` or any base58 mint string.

**Auth:** `verifyJwt` middleware; `wallet` derived from `req.wallet` (never trust body for wallet).

**Response (200):**

```json
{
  "serializedTx": "<base64>",
  "depositRecordAddress": "<base58 PDA>",
  "vaultTokenAddress": "<base58 PDA>",
  "amountBaseUnits": "<string, decimal lamports/atoms>",
  "feeBps": 10,
  "network": "devnet"
}
```

**Errors:**

- `400 { error: { code: 'INVALID_AMOUNT', message: 'Amount must be > 0' } }`
- `400 { error: { code: 'INVALID_TOKEN', message: 'Token must be SOL, USDC, USDT, or a valid mint' } }`
- `401` — JWT missing/expired (existing global handler envelope).
- `409 { error: { code: 'VAULT_UNAVAILABLE', message: 'Sipher Vault is on devnet only' } }` when `network !== 'devnet'`.

**Implementation:** wraps the existing `executeDeposit()` from `packages/agent/src/tools/deposit.ts`. The tool already builds and serializes the transaction. The route is a thin REST adapter over it.

### `GET /api/vault/positions` (new, PR 6a)

**Auth:** `verifyJwt`.

**Response (200):**

```json
{
  "positions": [
    {
      "mint": "So11111111111111111111111111111111111111112",
      "symbol": "SOL",
      "balance": "2500000000",
      "balanceUiAmount": 2.5,
      "lockedAmount": "0",
      "decimals": 9,
      "lastDepositAt": 1715000000,
      "refundableAt": 1715086400,
      "cooldownActive": true,
      "depositRecordAddress": "<base58 PDA>"
    }
  ],
  "network": "devnet",
  "available": true
}
```

When `network !== 'devnet'` or RPC unavailable: `{ positions: [], available: false, reason: 'mainnet-beta_no_vault' | 'rpc_unavailable' }` with HTTP 200 (graceful — never 500 the page).

**Implementation:** iterates over `[WSOL_MINT, USDC_MINT, USDT_MINT]`, calls `fetchDepositRecord` for each, filters records with `record.balance > 0n`. Returns rows in insertion order (could sort by balance descending — implementation detail, decide at code time).

### `POST /api/vault/refund-tx` (new, PR 6b)

**Body:** `{ token: string }` — same token semantics as deposit-tx.

**Auth:** `verifyJwt`.

**Response (200):**

```json
{
  "serializedTx": "<base64>",
  "refundAmount": "<string, decimal>",
  "network": "devnet"
}
```

**Errors:**

- `400 { error: { code: 'INVALID_TOKEN', ... } }`
- `404 { error: { code: 'NOT_FOUND', message: 'No deposit found for this token' } }` when no `DepositRecord` exists or `record.balance === 0n`.
- `409 { error: { code: 'COOLDOWN_ACTIVE', message: 'Refund cooldown not yet elapsed', secondsRemaining: <number> } }`.
- `409 { error: { code: 'VAULT_UNAVAILABLE', ... } }` on mainnet.

**Implementation:** calls `fetchDepositRecord` to validate balance and read `lastDepositAt`, computes `refundableAt = lastDepositAt + refundTimeout`, returns 409 if `now < refundableAt`. Otherwise, calls `buildRefundTx` from `@sipher/sdk` and serializes.

### `POST /v1/privacy/score` (extended, PR 6a)

**New optional body fields:**

```ts
{
  address: string,
  limit?: number,
  projectedAmount?: number,  // NEW — human-readable units
  projectedToken?: string,   // NEW — defaults to 'SOL' if absent
}
```

**Backwards-compatible:** when `projectedAmount` is absent, the response is byte-for-byte identical to today's (`{ success: true, data: { address, score, grade, transactionsAnalyzed, factors, recommendations } }`).

**With projection:** the response gains a `projected` block:

```json
{
  "success": true,
  "data": {
    "address": "...",
    "score": 68,
    "grade": "C",
    "transactionsAnalyzed": 50,
    "factors": { ... },
    "recommendations": [ ... ],
    "projected": {
      "score": 78,
      "grade": "B",
      "factors": {
        "addressReuse": { "score": 78, "detail": "..." },
        "amountPatterns": { "score": 80, "detail": "..." },
        "timingCorrelation": { "score": 75, "detail": "..." },
        "counterpartyExposure": { "score": 79, "detail": "..." }
      },
      "delta": {
        "score": 10,
        "addressReuse": 8,
        "amountPatterns": 4,
        "timingCorrelation": 0,
        "counterpartyExposure": 2
      }
    }
  }
}
```

**Algorithm.** After fetching real signatures + parsed transactions and constructing the existing `txData`, `amounts`, `timestamps` arrays, the route:

1. If `projectedAmount` is present, validates it is a finite number > 0; else returns `400 INVALID_PROJECTED_AMOUNT`.
2. Resolves `projectedToken` to a mint; computes `lamportsOrAtoms = toBaseUnits(projectedAmount, decimals)`.
3. Constructs ONE synthetic record: a fresh stealth-recipient address (32-byte buffer of zeros for analyzer purposes — never collides with any real chain address) added to `txData`'s last entry's `to` set, plus the synthetic amount appended to `amounts` and `Date.now()/1000` to `timestamps`.
4. Re-runs all four factor analyzers on the augmented arrays.
5. Computes weighted `projected.score`, returns the `delta` block.

**Validation gates:**

- `projectedAmount === 0` → `400 INVALID_PROJECTED_AMOUNT` (matches non-zero rule of `executeDeposit`).
- `projectedAmount > Number.MAX_SAFE_INTEGER` after base-unit conversion → `400 INVALID_PROJECTED_AMOUNT`.
- `projectedToken` invalid → `400 INVALID_TOKEN`.

## Frontend Components

### File layout

```
app/src/views/
  DepositView.tsx                     PR 6a — full-page route
  WithdrawView.tsx                    PR 6b
  VaultView.tsx                       (modified, PR 6a)

app/src/components/vault/
  StealthAddressList.tsx              PR 6a
  RoutePreviewCard.tsx                PR 6a
  PrivacyPreviewPanel.tsx             PR 6a
  DepositForm.tsx                     PR 6a
  AssetSelector.tsx                   PR 6a
  TxStatusBadge.tsx                   PR 6a
  RefundList.tsx                      PR 6b
  CooldownChip.tsx                    PR 6b
```

### Component contracts

| Component | Props | Responsibility |
|---|---|---|
| `<DepositView />` | none — reads `token` from `useAuthState`, fetches `/api/vault/positions` + `/v1/privacy/score` | Owns the deposit ceremony + tx state |
| `<WithdrawView />` | none — same pattern | Owns refund-per-record orchestration |
| `<StealthAddressList positions={Position[]} stealthTree={StealthNode[]} loading={boolean} />` | parent owns data | Stateless render of two stacked sections |
| `<RoutePreviewCard wallet={string} amount?={number} asset?={string} stealthIndex?={number} />` | optional amount/asset for placeholder | Static 3-step list |
| `<PrivacyPreviewPanel address={string} projectedAmount={number} projectedToken={string} debounceMs?={number} />` | debounce default 300ms | Owns its own fetch; renders gauge pair |
| `<DepositForm onSubmit={(amount: number, asset: string) => Promise<void>} maxByAsset={Record<string, number>} disabled={boolean} status={SignStatus} signature?={string} />` | controlled by parent | Composes AmountForm + AssetSelector + TxStatusBadge |
| `<AssetSelector assets={readonly string[]} value={string} onChange={(asset) => void} />` | controlled | Pill row, click to select |
| `<TxStatusBadge status={SignStatus} signature?={string} />` | stateless | 5-state pill with optional Solscan link |
| `<RefundList records={Position[]} onRefund={(token: string) => Promise<void>} statusByToken={Record<string, SignStatus>} signaturesByToken={Record<string, string>} />` | parent owns sign/broadcast | Per-row layout + dispatch |
| `<CooldownChip refundableAt={number} onElapsed?={() => void} />` | self-ticking via `setInterval(1000)` | Counts down to "Available now" |

### Modifications to existing files

- **`app/src/views/VaultView.tsx`** (PR 6a) — split-panel restyle. Drops inline `AmountForm` + `ConfirmCard`. New CTAs: "Shield to vault" and "Withdraw" call `setActiveView('deposit')` / `setActiveView('withdraw')`. Adds parallel `/api/vault/positions` + `/api/stealth/index` fetches. Migrates legacy color tokens (`bg-card` → `bg-bg-2`, `text-red` → `text-danger`) since this view is being touched anyway.
- **`app/src/stores/app.ts`** (PR 6a + 6b) — `View` type extended.
- **`app/src/App.tsx`** (PR 6a + 6b) — `renderView` switch cases added.
- **`app/src/components/BetaBanner.tsx`** (PR 6a) — extended copy when network is mainnet AND user is on `vault` / `deposit` / `withdraw`. Existing beta-prop semantics preserved.
- **`app/src/components/Header.tsx`** (PR 6a) — Vault tab active-state matcher widens to `['vault', 'deposit', 'withdraw']` so the tab stays highlighted when user is in a sub-flow.

### Reuse audit

Every visual primitive is from PRs 1–3: `Card`, `Pill`, `HashCell`, `MetricBar`, `Sheet`, `Gauge`. Logic primitives: `useTransactionSigner`, `apiFetch`, `useAuthState`, `useAppStore`, `AmountForm`. Net new component count: 9 (5 in 6a + 4 in 6b). Net new view count: 2.

## Routes & Navigation

### View enum changes

```ts
// PR 6a:
export type View = 'dashboard' | 'vault' | 'herald' | 'squad'
                 | 'chat' | 'privacyReport' | 'chains' | 'deposit'

// PR 6b additionally:
export type View = ... | 'deposit' | 'withdraw'
```

### `App.tsx renderView` cases

```ts
case 'deposit':
  return <DepositView />          // PR 6a
case 'withdraw':
  return <WithdrawView />         // PR 6b
```

### Entry points

| Source | Trigger | Target |
|---|---|---|
| VaultView · UnshieldedWallet panel · "Shield to vault" CTA | click | `setActiveView('deposit')` |
| VaultView · ShieldedVault panel · "Withdraw" CTA | click | `setActiveView('withdraw')` |
| StealthAddressList · per-record row · Manage menu (PR 6b) | click "Refund" | `setActiveView('withdraw')` |

### Exit points

| Trigger | Effect |
|---|---|
| `← Back to Vault` chip (top-left of DepositView/WithdrawView) | `setActiveView('vault')` |
| DepositView tx reaches `confirmed` | toast + 2s delay (constant `DEPOSIT_SUCCESS_REDIRECT_MS = 2000`) + `setActiveView('vault')` |
| WithdrawView per-row tx reaches `confirmed` | row badge stays confirmed; user remains on /withdraw to refund more |
| Tx reaches `error` | inline error banner with retry; user stays on view |
| Wallet disconnects mid-flow | toast + `setActiveView('vault')` |
| Network changes mid-flow | toast "Network changed — flow cancelled" + `setActiveView('vault')` |

### What is NOT touched

- BottomNav: 5 tabs preserved. Vault tab stays active during /deposit and /withdraw (the Header's active-state matcher is extended; BottomNav's matcher mirrors it).
- Header tabs: no new tabs added.
- URL/hash routing: unchanged. Refresh on /deposit returns to /dashboard (existing behavior). Acceptable per Phase D entry checklist.

## Data Flow

### VaultView mount (PR 6a)

```
mount → 3 parallel fetches:
  ├─ GET /api/vault              wallet, balances, activity
  ├─ GET /api/stealth/index      stub tree, rootWallet
  └─ GET /api/vault/positions    deposit_records by mint (NEW PR 6a)

Each has its own loading state. PrivacyScoreCard fetches /v1/privacy/score
separately (matches existing DashboardView pattern, no projection there).

On mainnet:
  /api/vault/positions returns { positions: [], available: false, reason: 'mainnet-beta_no_vault' }
  StealthAddressList renders empty state + "Switch to devnet" link.
  CTAs disabled, BetaBanner extension visible.
```

### Deposit flow (PR 6a)

```
DepositView mount
  → GET /api/vault                        (wallet + max-balance per asset)
  → POST /v1/privacy/score                (current state, no projectedAmount)

User edits amount in DepositForm
  → 300ms debounce
  → POST /v1/privacy/score with { projectedAmount, projectedToken }
  → PrivacyPreviewPanel renders side-by-side gauges + factor delta bars

User clicks "Sign & deposit"
  → DepositForm.onSubmit → DepositView.handleDeposit
  → POST /api/vault/deposit-tx { amount, token }
  → response: { serializedTx, depositRecordAddress, ... }
  → useTransactionSigner.signAndBroadcast(serializedTx)
       status: idle → signing → broadcasting → confirmed | error

On confirmed:
  → toast: "Deposit confirmed · 2.5 SOL · view on Solscan"
  → 2s delay → setActiveView('vault')
  → VaultView re-fetches on mount; positions list reflects new deposit

On error:
  → inline banner with err.message
  → "Try again" resets form to amount input (status: idle)
```

### Refund flow (PR 6b)

```
WithdrawView mount
  → GET /api/vault/positions
  → render RefundList — each row mint + balance + CooldownChip

CooldownChip self-ticks via setInterval(1000ms):
  refundableAt = lastDepositAt + 86400 (24h, from on-chain config)
  if now < refundableAt → "Available in 17h 23m" + Refund button disabled
  if now >= refundableAt → "Available now" + Refund button enabled

User clicks Refund on a row
  → POST /api/vault/refund-tx { token }
  → response: { serializedTx, refundAmount } | 404 | 409
  → useTransactionSigner.signAndBroadcast(serializedTx)
  → row badge: signing → broadcasting → confirmed
  → on confirmed: row stays, balance shows 0, banner "Refund complete · view tx"
  → user stays on /withdraw to refund more, or clicks ← Back to Vault
```

## Error Handling

### Tx-level errors (`useTransactionSigner`)

| Error | UX |
|---|---|
| Wallet not connected | Form disabled with "Connect wallet" CTA in place of Sign button |
| User rejects in wallet popup | Status returns to `idle`, no toast (rejection is a user choice, not an error) |
| Signing fails (wallet bug, wrong network) | Inline banner: "Signing failed: {err.message}" + "Try again" resets to idle |
| Broadcast fails (RPC down, blockhash expired) | Banner: "Broadcast failed: {err.message}" + "Retry" re-calls `/api/vault/deposit-tx` to fetch a fresh tx |
| Confirmation timeout (>60s, hook caps wait) | Banner: "Tx submitted but not yet confirmed. Signature: {sig}. Check Solscan." + dismiss |

### Backend errors (envelope `{ error: { code, message, ... } }`)

| Endpoint | Failure | Status |
|---|---|---|
| `POST /api/vault/deposit-tx` | mainnet | 409 `VAULT_UNAVAILABLE` |
| | invalid token | 400 `INVALID_TOKEN` |
| | amount ≤ 0 | 400 `INVALID_AMOUNT` |
| | JWT missing/expired | 401 (existing handler) |
| `GET /api/vault/positions` | mainnet | 200 `{ available: false, reason: 'mainnet-beta_no_vault' }` |
| | RPC down | 200 `{ available: false, reason: 'rpc_unavailable' }` |
| `POST /api/vault/refund-tx` | no deposit_record / zero balance | 404 `NOT_FOUND` |
| | cooldown active | 409 `COOLDOWN_ACTIVE` with `secondsRemaining` |
| | mainnet | 409 `VAULT_UNAVAILABLE` |
| `POST /v1/privacy/score` | invalid projectedAmount | 400 `INVALID_PROJECTED_AMOUNT` |
| | invalid projectedToken | 400 `INVALID_TOKEN` |

All error envelopes match the post-#158 shape used by SENTINEL routes (`{ error: { code, message } }`). The shared `apiFetch` client unwraps the envelope and throws an `Error` with `error.message` as the throw message — components catch and display `err.message` directly (matching the existing pattern in DashboardView, VaultView, SentinelConfirm).

### Race conditions

| Scenario | Mitigation |
|---|---|
| User submits two deposits back-to-back | DepositForm disables Submit while status ∈ `{signing, broadcasting}` |
| User on /deposit, network switches mid-flow | `useNetworkConfigStore` subscription in DepositView triggers `setActiveView('vault')` + toast |
| Cooldown timer ticks past zero mid-render | CooldownChip subscribes to its own interval; refresh on tick. Refund button enables automatically. |
| Two tabs both refunding same record | Backend returns 404 on the second tab (record balance is 0 after first tx confirms); inline error banner |
| Deposit confirmed but `/api/vault/positions` not yet reflecting | Auto-redirect already fires on `confirmed`; VaultView remount fetches fresh; race window <1s — acceptable |

### Privacy-score edge cases

| Case | Behavior |
|---|---|
| Address has zero prior txs | Existing endpoint returns score: 100. Projected: synthetic-tx alone produces score: 100. Delta 0. PrivacyPreviewPanel shows "No prior history — projection is identical." |
| Address at 100 already | Projected stays 100. All factor deltas 0. Panel shows "Already at maximum — deposit doesn't change score." |
| `projectedAmount > wallet balance` | Backend computes anyway (it's hypothetical). DepositForm's amount validation catches the issue at submit. |

### Empty / loading / error states

- StealthAddressList empty (no positions, no tree): "No vault positions yet — deposit to get started" + CTA to /deposit
- RefundList empty: "No active vault positions" + link back to /vault
- PrivacyPreviewPanel no projected: shows current gauge only with subtitle "Enter an amount to preview"
- RoutePreviewCard zero amount: shows steps with placeholder dashes
- All views: skeleton state for ~250ms, then real data or error

### Security

All new endpoints sit behind `verifyJwt`. `req.wallet` is derived from JWT — never trusted from request body. Tx serialization sets `requireAllSignatures: false` (existing pattern); FE adds the wallet signature. No secret material crosses the wire — backend builds the unsigned tx, FE signs.

## Testing Strategy

### Backend tests (supertest, vitest)

| File | Coverage | ~Cases |
|---|---|---|
| `packages/agent/tests/routes/vault-deposit-tx.test.ts` (PR 6a) | Happy path SOL/USDC/USDT (mock SDK builders); 401 no JWT; 400 invalid amount; 400 invalid token; 409 mainnet | 6 |
| `packages/agent/tests/routes/vault-positions.test.ts` (PR 6a) | Empty; single mint; multi-mint; mainnet → `{ available: false }`; RPC failure → `{ available: false, reason: 'rpc_unavailable' }` | 5 |
| `packages/agent/tests/routes/privacy-score-projected.test.ts` (PR 6a) | Backwards-compat (no projected fields = identical response); projected SOL non-round; projected USDC; zero-history → projected=current; address-at-100 → delta=0; invalid projectedAmount → 400 | 6 |
| `packages/agent/tests/routes/vault-refund-tx.test.ts` (PR 6b) | Happy path; 404 no record; 409 cooldown active with `secondsRemaining`; 401 no JWT; 409 mainnet | 5 |

**Mocking strategy:** mock SDK builders (`buildDepositTx`, `buildRefundTx`, `fetchDepositRecord`) at module level. Avoid hitting devnet RPC in unit tests. The `useTransactionSigner` interaction is FE-only — backend tests stop at "returns serializedTx string." Auth helper: reuse `createApp()` from PR 4 (mounts router under test + supertest, mocks auth middleware to attach `req.wallet`).

### Frontend tests (vitest, jsdom)

| File | Coverage | ~Cases |
|---|---|---|
| `app/src/views/__tests__/DepositView.test.tsx` (PR 6a) | Renders form; debounced projected fetch fires after 300ms; submit calls deposit-tx; success path triggers `setActiveView('vault')`; error path shows banner; mainnet path renders disabled | 7 |
| `app/src/views/__tests__/WithdrawView.test.tsx` (PR 6b) | Renders RefundList; cooldown ticks; click Refund → tx flow; 404 row error; mainnet disabled | 6 |
| `app/src/components/vault/__tests__/StealthAddressList.test.tsx` (PR 6a) | Hybrid render (positions + tree); empty positions; empty tree → M19 banner; address copy; pill counts | 5 |
| `app/src/components/vault/__tests__/RoutePreviewCard.test.tsx` (PR 6a) | Renders 3 steps; zero amount placeholder; long address truncation | 3 |
| `app/src/components/vault/__tests__/PrivacyPreviewPanel.test.tsx` (PR 6a) | Side-by-side gauges; debounced fetch; "no history" empty state; "already at 100" state; factor delta colors | 5 |
| `app/src/components/vault/__tests__/DepositForm.test.tsx` (PR 6a) | AmountForm composition; AssetSelector toggle; Submit disabled while signing; status badge transitions | 5 |
| `app/src/components/vault/__tests__/AssetSelector.test.tsx` (PR 6a) | Renders 3 assets; click → onChange; selected pill style | 3 |
| `app/src/components/vault/__tests__/TxStatusBadge.test.tsx` (PR 6a) | All 5 states render distinct labels/colors; signature link on confirmed | 5 |
| `app/src/components/vault/__tests__/RefundList.test.tsx` (PR 6b) | Renders rows; per-row callbacks; status badges per row; empty state | 4 |
| `app/src/components/vault/__tests__/CooldownChip.test.tsx` (PR 6b) | Tick from 24h to 0; "Available now" state; cleanup timer on unmount | 3 |
| `app/src/views/__tests__/VaultView.test.tsx` (modified, PR 6a) | New: 3-parallel-fetch behavior; CTAs route to /deposit and /withdraw; mainnet disabled state. Existing tests adapted to split-panel structure. | +5 over existing |

**Mocking strategy:** `vi.mock('../../api/client')` for apiFetch; `vi.mock('../../hooks/useAuthState')` for token; `vi.mock('@solana/wallet-adapter-react')` for useWallet; mock `useTransactionSigner` per-test with controlled status state machine. Match existing pattern from PRs 3–5.

### Integration / smoke (manual, against devnet)

Pre-merge gate per PR — 1 deposit + 1 refund on devnet from RECTOR's wallet, screenshots in PR description. Not automated (devnet faucet rate-limits + 24h cooldown timing make CI integration tests fragile).

### Test count target

|                          | App tests | Agent tests |
|--------------------------|-----------|-------------|
| Pre-PR-6a (current main) | 237       | 1,357       |
| After PR 6a              | ~282 (+45)| ~1,374 (+17)|
| After PR 6b              | ~300 (+18)| ~1,382 (+8) |

### What is NOT tested

- The Anchor program itself (separate test suite in `programs/sipher-vault`).
- The `@sipher/sdk` builders themselves (own test suite; PR 6 doesn't modify them).
- Real wallet-adapter integration in jsdom (jsdom can't sign — covered by manual smoke).
- Mainnet path beyond "renders disabled" (no mainnet vault to integration-test against).

## Out of Scope / Deferred

| Item | Reason | Lands in |
|---|---|---|
| `claim_transfer` real wiring | Phase 1 scaffold only; needs ECDH derivation + claim instruction builder + viewing-key UX | Phase 2 / M19 PR series |
| Real stealth-tree derivation in `/api/stealth/index` | PR 4 stub; SDK viewing-key derivation not yet exposed | M19 |
| Private-send-to-stealth as a distinct UI flow in WithdrawView | Already exposed via chat `send` tool; UI duplication risk | Possible future PR if usage data warrants |
| Real on-chain TVL aggregation in MultiChainVaultGrid | PR 5 deferred; needs Helius + EVM RPC fan-out | Per-chain pricing PR |
| Mainnet vault deploy | Authority + audit gating; not a frontend concern | Pre-launch milestone (separate spec) |
| URL-based deep linking (react-router) | Sprint kept Zustand-only nav; works with Phase D entry checklist | M19+ |
| Multi-tx batching (deposit + private-send in one click) | Adds wallet-signing complexity; not in plan | Future UX iteration |
| `SLOT` field in TickerBar | Backend `/api/slot` doesn't exist | Future endpoint PR |
| Reactflow code-splitting | Bundle size warning is pre-existing, not a regression | Performance follow-up |
| Mobile native bottom sheet for DepositForm | Existing Sheet primitive works; native feel is polish | Phase D+ if signal |

### Deferred decisions inside PR 6 (resolved at code time)

| Detail | Default |
|---|---|
| BetaBanner exact copy on mainnet | "Sipher Vault is on devnet — switch network to deposit/withdraw" |
| Auto-redirect delay after deposit confirms | 2s, constant `DEPOSIT_SUCCESS_REDIRECT_MS = 2000` |
| Cooldown chip granularity | mm:ss when <1h, "Xh Ym" when ≥1h, "Available now" when ready |
| PrivacyPreviewPanel debounce | 300ms |
| Toast library | Existing ToastProvider (no new dep) |
| Solscan vs SolanaFM links | Solscan to match existing usage (HashCell href) |

## Risk + Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `executeDeposit` tool changes break the new route | low | high | Route imports `executeDeposit` directly. If tool surface changes, route's tests catch it. |
| Real on-chain RPC latency spikes during deposit | medium | medium | `useTransactionSigner` caps confirmation wait at 60s with informative dismiss. Banner says "Tx submitted, check Solscan." |
| Devnet faucet exhaustion blocks RECTOR's smoke test | low | low | Use the shared devnet wallet (`solana-devnet.json`, `FGSk..WWr` per global CLAUDE.md). RECTOR can fund from treasury. |
| Privacy-score projection produces deltas of 0 in most cases | high | low | Already designed for. Empty/no-change banners ship from day one. Panel still renders the side-by-side gauge as a visual artifact. |
| Mainnet user clicks Deposit anyway (cosmic-ray-level edge) | low | low | Defense in depth: server returns 409 `VAULT_UNAVAILABLE`; FE renders the error banner. |
| Cooldown chip drifts because client clock differs from server | low | low | `refundableAt` is computed server-side from on-chain `lastDepositAt`. Client renders the timer based on `now - clientReferenceTime` only after computing `delta = serverNow - clientNow` (accept ±5s drift; cosmetic only). |
| TxStatusBadge state machine confuses users in error states | low | medium | Status copy is explicit ("Signing…", "Broadcasting…", "Confirmed", "Failed — try again"). Manual smoke verifies. |
| Bundle size grows past 1 MB warning | low | low | New components are small. Reactflow (the prior offender) is not touched. Code-splitting deferred remains the answer if alarm fires. |

## Open Questions

None at the time of writing. Every architectural decision (D1–D9) is locked. Implementation-time micro-decisions are tabulated in the "Deferred decisions inside PR 6" subsection above with sensible defaults.

## Acceptance Criteria

### PR 6a

- [ ] `POST /api/vault/deposit-tx` returns a valid base64 serialized tx for SOL, USDC, USDT on devnet; 409 on mainnet.
- [ ] `GET /api/vault/positions` returns deposit_records by mint on devnet; `{ available: false, reason }` on mainnet or RPC failure.
- [ ] `POST /v1/privacy/score` is backwards-compatible when `projectedAmount` is absent; returns a `projected` block when present.
- [ ] VaultView renders split-panel with ShieldedVault + UnshieldedWallet + Stealth tree section.
- [ ] DepositView happy-path: form → backend → wallet popup → broadcast → confirmation → toast → auto-redirect to /vault.
- [ ] DepositView mainnet path: BetaBanner extension visible, CTAs disabled, server returns 409 if forced.
- [ ] PrivacyPreviewPanel renders side-by-side gauges when amount is present, debounced ~300ms, factor deltas surfaced.
- [ ] All app tests + agent tests green; counts at or near projected targets.
- [ ] Manual smoke on devnet: 1 successful deposit from RECTOR's wallet, screenshots in PR description.
- [ ] No new mock data; all visible numbers are real on-chain or "M19 pending" empty state.

### PR 6b

- [ ] `POST /api/vault/refund-tx` returns a valid base64 serialized tx when balance > 0 and cooldown elapsed; 404/409 errors as specified.
- [ ] WithdrawView renders RefundList with one row per non-zero deposit_record.
- [ ] CooldownChip self-ticks; transitions from "Available in X" to "Available now" when the timer elapses.
- [ ] Refund happy-path: row Refund button → backend → wallet popup → broadcast → confirmation → row badge confirmed.
- [ ] Mainnet path renders disabled state.
- [ ] Manual smoke on devnet: 1 successful refund (using a deposit that has elapsed the 24h cooldown), screenshots in PR description.

## Implementation Sequencing

**PR 6a** — single PR, ~8 commits, ~1,500 LOC:

1. `feat(agent): POST /api/vault/deposit-tx` — endpoint + tests.
2. `feat(agent): GET /api/vault/positions` — endpoint + tests.
3. `feat(agent): extend POST /v1/privacy/score for projectedAmount` — endpoint + tests.
4. `feat(ui): AssetSelector + TxStatusBadge` — primitives + tests.
5. `feat(ui): DepositForm` — composes AmountForm + AssetSelector + TxStatusBadge + tests.
6. `feat(ui): RoutePreviewCard + PrivacyPreviewPanel + StealthAddressList` — components + tests.
7. `feat(redesign): DepositView route + nav wire-in (View enum, App.tsx, Header active-state matcher)`.
8. `feat(redesign): VaultView split-panel restyle + BetaBanner mainnet extension` — view rewrite + tests.

**PR 6b** — single PR, ~5 commits, ~700 LOC:

1. `feat(agent): POST /api/vault/refund-tx` — endpoint + tests.
2. `feat(ui): CooldownChip` — component + tests.
3. `feat(ui): RefundList` — component + tests.
4. `feat(redesign): WithdrawView route + nav wire-in`.
5. `docs(redesign): PR 6 wrap-up notes in plan + memory update`.

Each commit is its own conventional commit per sprint cadence; no `Co-Authored-By: Claude` (per CLAUDE.md). Worktrees:

- `.worktrees/feat-redesign-vault-flows-deposit/` for 6a
- `.worktrees/feat-redesign-vault-flows-withdraw/` for 6b

CI must be green before merge; Vercel preview is the visual gate. Merge with `--merge --delete-branch`.

## End-of-PR-6 State

- Vault page is the visual flagship of the redesign.
- Real on-chain deposit + refund flows wired with first-class form UX (no chat delegation for vault actions).
- Privacy preview is honest math, not theater.
- Devnet-only constraint is explicit in UI, not silently broken.
- Remaining sprint surface (PRs 7–9) unblocked.

**End of spec.**
