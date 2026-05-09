# PR 7 — Keys + Settings Surfaces (Design)

**Date:** 2026-05-09
**Branch:** `feat/redesign-keys-settings`
**Sprint:** Phase 4b glass-neon redesign — PR 7 of 9
**Predecessor specs:** [`2026-05-07-glass-neon-redesign-design.md`](./2026-05-07-glass-neon-redesign-design.md) (umbrella), [`2026-05-08-pr6-vault-flows-design.md`](./2026-05-08-pr6-vault-flows-design.md) (PR 6 cadence reference)

---

## Context

PR 6 (vault flows) shipped 2026-05-09 across two sub-PRs (#183 + #184). The redesign sprint is at 7-of-9. PR 7 introduces the `/keys` and `/settings` routes. The umbrella sprint plan sketch (`2026-05-07-glass-neon-redesign.md` lines 3273–3294) was a four-line outline that left several architectural questions unspecified: how viewing keys are persisted, what "encrypted backup" actually backs up, how `/settings` is gated for non-admins, and whether `FUND_MOVING_TOOLS`/`SENTINEL_MODE` are display-only or editable. This spec resolves those questions and replaces the sketch as the binding contract for PR 7 implementation.

The `<Chip>` primitive extraction is folded into PR 7 as Task 0 — `CHIP_BASE` is currently duplicated 5× across vault components and would hit 9× if PR 7 added new chips on top. Extracting first lets new PR 7 surfaces consume the primitive natively.

## Goal

Ship two new full-page views (`KeysView`, `SettingsView`) and a `<Chip>` design-system primitive. Surface viewing-key and stealth-address-backup workflows for all logged-in users. Surface the SENTINEL operating envelope (read-only) for admins. Net delta: +28 app tests, +4 agent tests, ~600 LOC.

## Success criteria

- All logged-in users can reach `/keys`, generate or rotate a viewing key, copy its hash, and download an encrypted stealth-address-list backup.
- Admins can reach `/settings` and inspect the live SENTINEL config (mode, preflight scope, thresholds, model, daily budget vs spend, fund-moving-tools allowlist).
- Non-admins navigating directly to `/settings` are redirected to `/dashboard` (no rendering of the page).
- `<Chip>` primitive replaces all 5 existing `CHIP_BASE` call sites with no visual regression.
- CI is 7/7 green and Vercel preview ships.

## Locked decisions (D1–D6)

These were locked through brainstorming on 2026-05-09. Each rolls back the corresponding alternative explicitly so the rationale survives the next contributor.

### D1 — Viewing keys have no server-side persistence; thin generator endpoint only

The viewing-key tool comment at `packages/agent/src/tools/viewing-key.ts:160-164` already states "Phase 1: no persistent key storage". The SQLite schema has no `viewing_keys` table. PR 7 keeps that posture and DOES NOT add one. The lone backend touch is a thin `POST /api/keys/generate` endpoint that wraps the existing `executeViewingKey('generate')` helper — it takes no input, persists nothing, and returns the keypair + download payload in the response body. "Rotate" calls the same endpoint again; revocation is the user's responsibility (share the new hash with auditors, archive the old key file if past payments still need disclosure).

The FE cannot generate keys directly today: `app/package.json` does not depend on `@sipher/sdk` or `@sip-protocol/sdk`. Adding the SDK to FE deps would bundle crypto into every page; a thin BE endpoint is lighter and matches the existing FE/BE pattern (FE always calls BE for crypto).

**Rejected (server persistence):** Server-side persistent storage. Even encrypted-at-rest, the server holds the unwrap key, which makes compliance audits server-attested rather than cryptographically self-evident. Hybrid wallet-sig-derived encryption was also rejected — it adds rotation-counter UX and persistence-layer complexity that PR 7's scope can't justify.

**Rejected (FE-side SDK):** Adding `@sipher/sdk` to `app/package.json` so `generateViewingKey` runs in the browser. Bundle weight and crypto-in-browser concerns aren't justified for a single endpoint.

### D2 — `StealthAddressBackup` backs up the stealth-address list, not the keypair

Two distinct concerns get two distinct cards:
- **`ViewKeyCard` (left)** — manages the viewing keypair (generate, copy hash, rotate, download .json).
- **`StealthAddressBackup` (right)** — produces a passphrase-encrypted snapshot of `/api/stealth/index`, the existing PR 4 endpoint that today returns root-only stub data and will return the full address tree in M19.

Recovery from cold storage uses the keypair download (re-import the viewing key, the agent re-derives the address tree by scanning chain state). The list backup is an audit-friendly point-in-time artifact, not a recovery primitive.

**Rejected:** Combined backup (keypair + list in one file) couples two unrelated concerns into one card. Viewing-key-only "backup" is what `ViewKeyCard`'s download already does — `StealthAddressBackup` would be redundant.

### D3 — `/settings` is admin-only; `/keys` is visible to all logged-in users

Hard split. `/settings` mirrors Herald and Squad's existing `adminOnly: true` nav flag. Non-admins reaching the route by URL get redirected to `/dashboard`. The Header avatar dropdown adds a Settings entry conditional on `useAuthState.isAdmin`. `/keys` has no admin gate — every logged-in user has a viewing key.

**Rejected:** Soft split (visible to all, sections gated). Adds conditional rendering and tests without meaningfully serving non-admin users — there is no per-user preference Sipher actually persists today, so the user-facing portion would be empty. A future `/preferences` route can be added once Sipher has real per-user settings; not in PR 7.

### D4 — `FUND_MOVING_TOOLS` is read-only display

Render the hardcoded `FUND_MOVING_TOOLS` Set from `packages/agent/src/sentinel/preflight-rules.ts:4-7` as `<Chip tone="cyan">` items. Informational. No toggles, no allowlist edits, no new persistence surface. Editable allowlist is security-sensitive (a wrong toggle disables SENTINEL preflight for `send`/`swap`) and should wait until Sipher has hardened audit-log infra.

### D5 — `SENTINEL_MODE` is read-only display

Render current mode (`yolo` | `advisory` | `off`) as a tonally-mapped chip. The mode is set via the `SENTINEL_MODE` env var only; changing it requires redeploying the agent. SettingsView caption: "Set via `SENTINEL_MODE` env var. Restart agent to change." Editable mode would need a persistence table, audit-log entries per change, restart-safe flush logic, and an admin permission boundary that doesn't yet exist; all out of scope.

**Net effect of D4 + D5:** SettingsView is a pure read-only inspector. No POST/PATCH endpoints. No state mutations. Lower risk surface, faster review cycle.

### D6 — `<Chip>` primitive extraction is PR 7 Task 0

`CHIP_BASE` is duplicated 5× today: `CooldownChip`, `RefundList` symbol pill, `StealthAddressList` symbol pill, `VaultView` legacy pill, `TxStatusBadge` `BADGE_BASE`. PR 7 adds 3 new chip uses (network, mode, fund-moving-tools list) — without extraction the count climbs to 9×. Extracting first as Task 0, then migrating the 5 existing sites mechanically, keeps the duplicate count at 0 going into PR 8 (which will add even more chips for Herald/Squad identity colors).

**Rejected:** Defer to PR 8 prelude (one more sprint with 6× duplication). Standalone PR between 7 and 8 (adds a sprint cycle for what is mechanical refactor work).

## Architecture

### Components

```
app/src/components/ui/Chip.tsx                          (new, ~40 LOC)
app/src/components/keys/ViewKeyCard.tsx                 (new, ~140 LOC)
app/src/components/keys/StealthAddressBackup.tsx        (new, ~160 LOC)
app/src/views/KeysView.tsx                              (new, ~80 LOC)
app/src/views/SettingsView.tsx                          (new, ~140 LOC)

app/src/stores/keys.ts                                  (new, ~40 LOC) — useKeyStore Zustand
app/src/lib/crypto/passphrase-encrypt.ts                (new, ~70 LOC) — PBKDF2 + XChaCha20-Poly1305

packages/agent/src/routes/keys.ts                       (new, ~40 LOC) — POST /api/keys/generate (thin wrapper)
packages/agent/src/routes/sentinel-api.ts               (extend) — GET /api/sentinel/config admin endpoint
```

### Routing + nav

```
app/src/stores/app.ts                                   View enum +'keys' +'settings'
app/src/App.tsx                                         case 'keys' / case 'settings'
app/src/components/Header.tsx                           NAV_ITEMS: {id:'keys', label:'Keys', icon:Key} +
                                                                   {id:'settings', label:'Settings',
                                                                    icon:Gear, adminOnly:true}
app/src/components/Header.tsx                           WalletDropdown adds Settings entry
                                                        (already shown for admins via existing pattern)
app/src/components/BottomNav.tsx                        mobile drawer surfaces Keys for all,
                                                        Settings under admin section
```

### Migrations (PR 7 Task 0 — extract `<Chip>`)

```
app/src/components/vault/CooldownChip.tsx               replace inline CHIP_BASE → <Chip tone={…}>
app/src/components/vault/RefundList.tsx                 replace symbol pill <span> → <Chip tone="neutral">
app/src/components/vault/StealthAddressList.tsx         replace symbol pill <span> → <Chip tone="neutral">
app/src/views/VaultView.tsx                             replace legacy pill <span> → <Chip>
app/src/components/vault/TxStatusBadge.tsx              replace BADGE_BASE → <Chip tone={…}>
```

### Backend extension

The existing `GET /api/sentinel/status` (sentinel-api.ts:75-85) returns six fields and is `verifyJwt`-only. SettingsView needs more (thresholds, scan intervals, FUND_MOVING_TOOLS) and should not leak operational thresholds to non-admins. New endpoint:

```ts
// packages/agent/src/routes/sentinel-api.ts (extend)
sentinelAdminRouter.get('/config', (_req, res) => {
  const config = getSentinelConfig()
  res.json({
    mode: config.mode,
    preflightScope: config.preflightScope,
    preflightSkipAmount: config.preflightSkipAmount,
    largeTransferThreshold: config.largeTransferThreshold,
    threatCheckEnabled: config.threatCheckEnabled,
    blacklistAutonomy: config.blacklistAutonomy,
    cancelWindowMs: config.cancelWindowMs,
    rateLimitFundPerHour: config.rateLimitFundPerHour,
    rateLimitBlacklistPerHour: config.rateLimitBlacklistPerHour,
    scanInterval: config.scanInterval,
    activeScanInterval: config.activeScanInterval,
    autoRefundThreshold: config.autoRefundThreshold,
    model: config.model,
    dailyBudgetUsd: config.dailyBudgetUsd,
    dailyCostUsd: dailyDecisionCostUsd(),
    blockOnError: config.blockOnError,
    fundMovingTools: Array.from(FUND_MOVING_TOOLS),
  })
})
```

This sits behind `verifyJwt + requireOwner` (the same gate used by `/blacklist` POST and `/decisions` GET) so non-admins reaching the URL get a 403 ErrorEnvelope (`FORBIDDEN`).

## Component contracts

### `<Chip>` primitive

```ts
type ChipTone =
  | 'neutral'    // border-line text-text-muted
  | 'success'    // border-success/40 bg-success-soft text-success
  | 'danger'     // border-danger/40 bg-danger-soft text-danger
  | 'warning'    // border-warning/40 bg-warning-soft text-warning
  | 'cyan'       // border-cyan/40 bg-cyan-soft text-cyan-hi
  | 'herald'     // border-herald/40 bg-herald-soft text-herald
  | 'sentinel'   // border-sentinel/40 bg-sentinel-soft text-sentinel

interface ChipProps {
  tone?: ChipTone           // default 'neutral'
  icon?: ReactNode          // optional leading icon
  className?: string        // forwarded for callers that need to layer (e.g. animate)
  children: ReactNode
}
```

`CHIP_BASE` constant lives inside `Chip.tsx` and is no longer exported; consumers always use `<Chip>`. The 5 migration sites replace their local string + className composition with a `<Chip tone={…}>` JSX element.

### `useKeyStore` Zustand store

```ts
interface KeyState {
  hash: string | null           // in-memory only; never persisted
  set(hash: string): void
  clear(): void
}
```

In-memory only by D1's "keys are client-only" decision. The download is the persistent artifact. Tab refresh wipes `hash`; KeysView's empty state guides the user to import or regenerate. (RECTOR confirmed this trade-off during brainstorming on 2026-05-09.)

### `passphrase-encrypt` lib

```ts
// app/src/lib/crypto/passphrase-encrypt.ts
export interface EncryptedBlob {
  v: 1
  alg: 'xchacha20poly1305-pbkdf2sha256-310k'
  salt: string    // base64, 16 bytes
  nonce: string   // base64, 24 bytes
  ct: string      // base64
}

export async function encryptWithPassphrase(
  plaintext: Uint8Array,
  passphrase: string,
): Promise<EncryptedBlob>
```

PBKDF2-SHA256 with 310 000 iterations (OWASP 2023 minimum). XChaCha20-Poly1305 from `@noble/ciphers/chacha`. Plaintext is JSON-encoded `/api/stealth/index` payload. Output schema includes `v: 1` so future format upgrades are clean. Decryption is OUT of scope per D1's recovery model — restore lands when M19 makes the address tree real.

### `ViewKeyCard`

States:
- **Empty** (`hash === null`): Card with title "Viewing Key", caption "Generate a viewing key to enable selective disclosure", primary button "Generate".
- **Generated** (`hash !== null`): Card shows `HashCell hash={hash}` (truncated) + Copy hash button + Rotate button (secondary) + Download key file button.
- **Generating**: Buttons disabled + spinner; toast on error.
- **Rotating**: Modal: "Rotating invalidates this key for new payments. Save the old key file if past payments still need auditor visibility." [Cancel] [Confirm rotate] → on confirm, generate new keypair, replace hash, trigger download.

### `StealthAddressBackup`

States:
- **Loading**: skeleton card.
- **Empty** (`/api/stealth/index` returns 0 addresses): "No stealth addresses yet. Make a private deposit to populate this." (PR 4 stub returns root-only — copy stays accurate.)
- **Loaded**: `<Chip tone="cyan">{count} addresses</Chip>` + last-updated timestamp + "Download encrypted backup" button.
- **Encrypting**: spinner + disabled button + step copy ("Deriving key..." → "Encrypting...").
- **Error**: `<Card role="alert">` with retry.

The Download flow:
1. User clicks button → Sheet opens with two passphrase inputs (passphrase + confirm).
2. Validation: both non-empty, match, ≥ 8 chars (warn at < 12, block at < 8).
3. On submit: `encryptWithPassphrase(JSON.stringify(stealthIndexPayload), passphrase)` → trigger `<a download>` of `sipher-stealth-backup-<wallet8>-<unix>.enc.json`.
4. Sheet closes with success toast.

### `KeysView`

Two-column responsive layout (stacks below `md:`). Composition over custom — uses `<Card>` for both columns, `<HashCell>` for the key hash, `<Chip>` for the status badge, existing `<Sheet>` for the rotate confirm and passphrase modals. Read pattern matches `VaultView` (Auth-gated wrapper, AbortController on mount fetch).

### `SettingsView`

Single column, five sections (`<Card>` each):

1. **Network**: chip (tone matches network — cyan for mainnet, warning for devnet) + caption ("Set via `SIPHER_NETWORK` env var").
2. **SENTINEL mode**: chip with tone-by-mode (`yolo` → danger, `advisory` → warning, `off` → neutral) + caption ("Set via `SENTINEL_MODE` env var. Restart agent to change.").
3. **Preflight envelope**: definition list — `preflightScope`, `preflightSkipAmount`, `largeTransferThreshold`, `threatCheckEnabled`, `blacklistAutonomy`, `cancelWindowMs`, `rateLimit{Fund,Blacklist}PerHour`, `scanInterval`, `activeScanInterval`, `autoRefundThreshold`. Each as a row with field name + current value as a chip.
4. **LLM cost guard**: `model` (chip), `dailyBudgetUsd` + `dailyCostUsd` rendered as a `<MetricBar>` with budget remaining; `blockOnError` (chip).
5. **Fund-moving tools**: heading "Tools requiring SENTINEL preflight" + caption ("Hardcoded in `preflight-rules.ts`; allowlist edits are deferred until audit-log infra lands.") + flex-wrap of `<Chip tone="cyan">{toolName}</Chip>` items.

Admin gate: `if (!isAdmin) return <Navigate to="/dashboard" replace />` at the top of the component, exactly like Herald and Squad. The router still renders the route entry; the gate is component-level.

## Data flow

```
KeysView mount
  → useKeyStore.hash === null → ViewKeyCard renders empty state
  → user clicks Generate → POST /api/keys/generate (auth-gated, no body)
  → response: { hash, downloadData } from executeViewingKey('generate')
  → trigger anchor download + useKeyStore.set(hash)
  → ViewKeyCard re-renders generated state
  → user clicks Rotate → Sheet confirm → re-call generate → useKeyStore.set(newHash) + new download

KeysView mount (parallel with above)
  → StealthAddressBackup fetches /api/stealth/index (existing PR 4 endpoint, AbortController on cleanup)
  → renders count + chip
  → user clicks Download → Sheet with passphrase inputs
  → submit → encryptWithPassphrase → trigger anchor download
  → close Sheet + toast

SettingsView mount (admin only)
  → if (!isAdmin) → <Navigate to="/dashboard" />
  → read useNetworkConfigStore.config (already hydrated globally in App.tsx)
  → fetch GET /api/sentinel/config (admin-only endpoint, AbortController on cleanup)
  → render 5 sections
```

No SSE, no streaming, no long-polling. Page is fully static once data lands.

## Error handling

| Failure | Behavior |
|---|---|
| `POST /api/keys/generate` fails | Toast: "Failed to generate viewing key. Please retry." No retry-with-backoff in PR 7. |
| `/api/stealth/index` returns 401 | Card shows "Sign in to view stealth addresses." (Should not happen — KeysView is auth-gated; this is defense-in-depth.) |
| `/api/stealth/index` returns 5xx | `<Card role="alert">` with retry button. Reuses the error-banner pattern from VaultView. |
| `/api/sentinel/config` returns 403 | `Navigate` to `/dashboard`. (Should not happen — SettingsView gates on `isAdmin` first; defense-in-depth for stale auth state.) |
| `encryptWithPassphrase` throws | Toast: "Encryption failed. Please retry." |
| Passphrase mismatch | Modal validation, prevents submit. |
| Passphrase < 8 chars | Modal validation, prevents submit. |
| Passphrase 8–11 chars | Warning copy under input ("Use a stronger passphrase for stronger protection") but allows submit. |
| `useNetworkConfigStore.config === null` (initial fetch failed) | Network section renders "Unknown network" chip with neutral tone; rest of SettingsView renders independently. |
| Direct URL nav to `/settings` as non-admin | `<Navigate to="/dashboard" replace />` — no flash, no error toast. |

All error envelopes from the agent follow the existing PR #167 5-code taxonomy (`VALIDATION_FAILED` | `NOT_FOUND` | `FORBIDDEN` | `UNAVAILABLE` | `INTERNAL`). FE error display reads `envelope.message`.

## Testing

TDD throughout. Each task produces failing tests first, then implementation.

| Suite | New tests | Notes |
|---|---|---|
| `app/src/components/ui/__tests__/Chip.test.tsx` | 6 | Renders each tone with expected token classes; icon slot; base class includes `rounded-pill`; default tone is `neutral`; passes through `className`; accepts ReactNode children |
| `app/src/components/vault/__tests__/CooldownChip.test.tsx` | (existing) | Snapshot stays green after migration; assert `<Chip>` is the underlying primitive (`getByRole('status')` still works) |
| `app/src/components/vault/__tests__/RefundList.test.tsx` | (existing) | Symbol-pill assertions adapted to new `<Chip>` DOM (no behavior change) |
| `app/src/components/vault/__tests__/TxStatusBadge.test.tsx` | (existing) | Same migration shape |
| `app/src/views/__tests__/VaultView.test.tsx` | (existing) | Same |
| `app/src/components/vault/__tests__/StealthAddressList.test.tsx` | (existing) | Same |
| `app/src/components/keys/__tests__/ViewKeyCard.test.tsx` | 4 | empty state; generated state shows hash + buttons; copy-hash callback; rotate confirm flow |
| `app/src/components/keys/__tests__/StealthAddressBackup.test.tsx` | 5 | loading skeleton; empty state copy; loaded count chip; encrypt+download flow; error banner with retry |
| `app/src/views/__tests__/KeysView.test.tsx` | 4 | renders both cards; generate button wires to ViewKeyCard; download button wires to backup card; AbortController on unmount |
| `app/src/views/__tests__/SettingsView.test.tsx` | 5 | non-admin redirects to `/dashboard`; network chip reads from mocked `useNetworkConfigStore`; SENTINEL mode chip tone-by-mode; FUND_MOVING_TOOLS list count; daily-cost MetricBar |
| `app/src/stores/__tests__/keys.test.ts` | 3 | initial state null; set updates hash; clear resets |
| `app/src/lib/crypto/__tests__/passphrase-encrypt.test.ts` | 4 | round-trip with same passphrase; wrong passphrase throws; output shape matches schema; salt+nonce are random per call |
| `packages/agent/tests/routes/sentinel-config.test.ts` | 4 | admin gate (403 for non-owner); payload shape includes all 17 fields; `fundMovingTools` is an array; `dailyCostUsd` reflects DB |
| `packages/agent/tests/routes/keys.test.ts` | 4 | auth gate (401 unauthenticated); generates valid keypair; response shape `{ hash, downloadData }`; no DB mutation (audit/sessions tables unchanged after call) |

**Net delta:** +28 app tests (291 → 319), +8 agent tests (1391 → 1399). Migration suites (5 files) only adapt existing assertions — no test count change there.

## Out of scope (explicit)

- Persistent server-side viewing keys (D1 — deferred indefinitely; revisit if multi-device demand emerges).
- Editable SENTINEL mode/thresholds (D5 — deferred to post-audit-log-infra PR).
- FUND_MOVING_TOOLS allowlist toggle (D4 — deferred).
- Backup decryption / restore UI (D2 — lands in M19 with real address tree).
- `/preferences` route for non-admin per-user settings (D3 — deferred until Sipher persists per-user preferences).
- Migrating `Pill.tsx` itself to use `<Chip>` (different component contract — `Pill` is interactive, `Chip` is presentational).
- New backend endpoints other than `POST /api/keys/generate` (auth-only, no storage) and `GET /api/sentinel/config` (admin-only).

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| `useKeyStore` in-memory hash lost on tab refresh | Acceptable — viewing-key file IS the persistent artifact. Empty-state copy: "No viewing key in this session. Generate one or import a key file." |
| Passphrase typo silently encrypts garbage | "Confirm passphrase" field; reject mismatch before encrypting. |
| Web Crypto PBKDF2 at 310k iters laggy on low-end devices | Bench in test on a typical iter; if > 500ms median, lower to 200k OR show spinner during derivation. PR description records the chosen iteration count. |
| Admin-gate bypass via direct URL | Component-level `<Navigate>` redirect; backend `requireOwner` middleware on `/api/sentinel/config`; integration test asserts 403 for non-admin. |
| `/api/sentinel/config` exposes operational heuristics if leaked | Admin-gated; no token, no payload. Same threat surface as existing `/api/sentinel/decisions` (already admin-only). |
| Migration touches 5 vault components — visual regression | Screenshot snapshot tests are not enforced today, but Vercel preview is the visual gate per the sprint's carry-forward rules. Reviewer must compare preview vs main on the affected pages. |
| Tailwind 4 token classes (`bg-warning-soft`, `bg-herald-soft`, `bg-sentinel-soft`, `*-soft` variants for the agent identity colors) | `--color-warning` + `--color-warning-soft` already exist in theme.css. `--color-herald` and `--color-sentinel` exist as base tokens but `*-soft` variants are NOT defined yet. PR 7 Task 0 audits `theme.css` first and adds missing `*-soft` variants for `herald` and `sentinel` if the chip tones need them. The redesign tokens.css from PR 1 already defines the base `--color-herald` (blue) and `--color-sentinel` (amber) variables. |
| `useKeyStore` state collision with multi-tab usage | Each tab has independent in-memory state; confusion is possible but acceptable. PR 7 documentation (KeysView empty-state copy) sets the expectation. |

## Carry-forward execution rules (from sprint)

1. NO AI attribution in commits/PRs/files.
2. NO semicolons in TS/TSX (single quotes for imports).
3. Conventional commits: `feat(ui):` for `<Chip>`, `feat(redesign):` for views, `feat(agent):` for backend, `test(...)`, `refactor(redesign):` for migrations, `docs(...)`.
4. NEVER amend commits; create new ones.
5. TDD: failing test → implement → passing test, per task.
6. CI must be green before merge — Vercel preview is the visual gate.
7. `--merge --delete-branch` (NOT squash). After merge: sync local main, remove worktree, delete local branch. Switch to main BEFORE running `gh pr merge` to avoid the worktree-owns-main quirk from PR 6b.
8. Subagent-driven for genuinely complex tasks (each major view + the crypto helper); INLINE for mechanical (chip migrations, nav wire-up).
9. `superpowers:verification-before-completion` before any "task done" claim.
10. `git status` after every subagent run before committing — subagents have touched out-of-scope files in past PRs.

## Carry-forward gotchas (must not re-discover)

From PRs 6a + 6b memory:

1. `@sipher/sdk` is not in root `package.json` deps. Importing from `src/*` (root, non-package) will fail CI typecheck. Inline helpers locally if root-level code needs them. Agent (`packages/agent/*`) and app (`app/*`) CAN import freely.
2. `Pill` is interactive (`{ label, active, onClick? }`), NOT a generic chip. Use `<Chip>` for non-interactive labels.
3. `HashCell` uses `hash` prop (not `address`).
4. Network store: `config.network` ('devnet' | 'mainnet') for FE; backend uses `clusterName` ('devnet' | 'mainnet-beta').
5. `useAuthState` exposes `publicKey` (not `wallet`); `token: string | null`; `isAuthenticated`; `isAdmin`.
6. `getVaultBalance` returns `{exists, balance, ...}` without throwing — prefer over `fetchDepositRecord`.
7. `DEFAULT_REFUND_TIMEOUT` from SDK (not local hardcode).
8. Tailwind 4: `text-success`, `text-danger`, `bg-cyan-soft`, `text-cyan-hi`, `border-cyan/40`, `--color-herald` (blue), `--color-sentinel` (amber). `text-green` does NOT exist.
9. `TxStatusBadge` consumes `useNetworkConfigStore` — any test mounting a transitively-rendering component must `vi.mock('../../../lib/networkConfig', async (importOriginal) => { ... })` with `importOriginal` to preserve `solscanUrl`.
10. setTimeout-based refresh: `useRef + cleanup useEffect` pattern from `DepositView.tsx` to avoid orphan timers on unmount.
11. `gh pr merge` from a parent-worktree-owns-main branch fails local cleanup. Switch to main first OR run from the PR worktree.
12. After every subagent run: `git status` before committing.

## References

- Spec D8: `2026-05-07-glass-neon-redesign-design.md` (admin views NOT in main nav, `--color-herald` / `--color-sentinel` tokens).
- Spec PR 7 sketch: `2026-05-07-glass-neon-redesign.md` lines 3273–3294 (replaced by this spec).
- PR 6 cadence: `2026-05-08-pr6-vault-flows-design.md` (subagent-driven workflow + two-stage review).
- Existing viewing-key tool: `packages/agent/src/tools/viewing-key.ts` (the client-side Phase 1 baseline).
- Existing SENTINEL config: `packages/agent/src/sentinel/config.ts` + `preflight-rules.ts` (the read-only display source).
- PR 4 stealth index endpoint: `packages/agent/src/routes/stealth-index.ts` (currently stub, full tree in M19).
