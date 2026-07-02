# @sipher/sdk vault-fee unit migration — whole-bps → tenths-of-bps

**Date:** 2026-07-02
**Branch:** `fix/vault-fee-tenths-bps` (off `origin/main` @ `b48e8ed`)
**Status:** design — awaiting review before writing the implementation plan.

---

## 1. Context & problem

The on-chain `sipher_vault` program re-precisioned its fee field from whole basis
points to **tenths of a basis point** (sip-protocol #1213, deployed to devnet
2026-06-30):

- Field renamed `fee_bps` → `fee_tenths_bps` (`u16`, same account offset **40** =
  8 disc + 32 authority).
- Divisor changed `10_000` → **`100_000`** (`FEE_TENTHS_BPS_DENOMINATOR`).
- Cap `MAX_FEE_TENTHS_BPS = 1000` (still 1%).
- Live devnet config now stores **`75` = 7.5 bps = 0.075%**.

`@sipher/sdk` (and its two in-repo consumers) still speak the **old whole-bps model**.
Left unchanged, the SDK decodes the raw `75` and computes `75 / 10_000 = 0.75%` — a
**10× fee over-report**. This corrupts every returned fee/net figure and, in the
native-SOL path, can trip the rent-exempt guard into false rejections.

This SDK is the packaging gate for a downstream privacy-provider integration, so
its reported fees must be exact. This migration makes the SDK report the fee
correctly and is the prerequisite for publishing the package.

## 2. Goal & non-goals

**Goal:** Represent the vault fee as **integer `feeTenthsBps`** everywhere in the
`sipher` repo, mirroring the on-chain source of truth, with all fee arithmetic in
exact integer `BigInt` math (`amount * feeTenthsBps / 100_000n`). No fractional
"bps" anywhere in our code — the fractional 7.5 only ever materialises at the true
downstream integrator boundary (outside this repo).

**Non-goals (hard guard-rails):**

- **`sip_privacy` stays whole-bps forever.** It is a *separate* program (`fee_bps`,
  ÷`10_000`). This includes the *skipped-byte* `fee_bps(2)` layout comments inside
  `privacy.ts` / `privacy-sol.ts` that describe the `sip_privacy` Config while
  seeking to `total_transfers` — those are **not** renamed.
- **App static per-chain fee list** (`packages/agent/src/routes/chains.ts`,
  `feeBps: 50/10/…`) is hardcoded display data for other chains, unrelated to the
  vault config; the app never decodes the vault fee. Untouched.
- **npm publish** is a separate, explicit-go action after this PR merges (§9).
- **The downstream backend port** is out of scope (gated on packaging + the
  integrator's seam).

## 3. Key decision — representation (approved)

Mirror the chain: rename the SDK's public `feeBps` → **`feeTenthsBps: number`**
(integer, e.g. `75`). Rationale:

- All fee math stays exact integer `BigInt` — permanently removes the `BigInt(7.5)`
  landmine that a fractional-`feeBps` approach would introduce.
- Single unit end-to-end; the field name documents its own unit.
- Matches the sip-protocol repo convention (already standardised on `feeTenthsBps`).
- `@sipher/sdk` is unpublished (npm 404), so there is **no external API break** —
  every consumer is in this monorepo and updated in the same branch.

Human-readable display everywhere derives a percent: `feeTenthsBps / 1000`
(`75 / 1000 = 0.075%`).

The agent's **outbound** response field is renamed to `feeTenthsBps` too (approved —
full consistency), keeping `feePercent` as the human number.

## 4. Blast-radius map (three packages + tests + docs)

### 4.1 `@sipher/sdk` (`packages/sdk/`)

| File | Change |
|---|---|
| `src/types.ts` | `VaultConfig.feeBps` → `feeTenthsBps: number` |
| `src/config.ts` | `DEFAULT_FEE_BPS = 10` → `DEFAULT_FEE_TENTHS_BPS = 100` (value-preserving: 0.1% in tenths, **not** 75); `MAX_FEE_BPS = 100` → `MAX_FEE_TENTHS_BPS = 1000` (value-preserving: 1%); layout comment `fee_bps(2)` → `fee_tenths_bps(2)` |
| `src/vault.ts` | `deserializeVaultConfig`: decode field → `feeTenthsBps` (offset 40, still `readUInt16LE`); update the layout doc comment |
| `src/privacy.ts` | vault-fee fallback → `DEFAULT_FEE_TENTHS_BPS`; decode → `feeTenthsBps`; fee math `/ 10_000n` → `/ 100_000n`; vault-fee comment. **Leave the `sip_privacy` layout comment (`total_transfers` seek) as `fee_bps`.** |
| `src/privacy-sol.ts` | Same as `privacy.ts` (fallback, decode, `/100_000n` math, comment; leave sip_privacy comment) |
| `src/idl/sipher_vault.json` | Rename structural sites (`initialize` arg, `update_fee` arg, `FeeUpdated` event old/new, `VaultConfig` field) + doc lines (§6) |
| `scripts/recon-devnet-vault-tokens.mjs` | Decode + display → tenths |
| `package.json` | `0.1.0` → `0.2.0` |
| `tests/vault.test.ts` | Constant + builder + decode assertions → tenths |
| `tests/privacy-sol.test.ts` (+ `privacy.test.ts` if present) | Fee-math assertions → `/100_000n` |

### 4.2 `@sipher/agent` (`packages/agent/`)

| File | Change |
|---|---|
| `src/tools/status.ts` | Fallback; `feePercent = feeTenthsBps / 1000`; surfaced field → `feeTenthsBps` |
| `src/tools/send.ts` | Fallback; percent; surfaced field (and the fee-override *input* field, if present, → `feeTenthsBps`) |
| `src/routes/vault-deposit-tx.ts` | `feeTenthsBps: DEFAULT_FEE_TENTHS_BPS` |
| `tests/tools/status.test.ts`, `tests/tools/send.test.ts`, `tests/tools.test.ts`, `tests/routes/vault-deposit-tx.test.ts` | Fee assertions → tenths |

### 4.3 Reference adapter (`examples/vault-privacy-provider/`)

This package is on `origin/main` (merged #354) and **breaks on the constant rename**
(`provider.ts:5` imports `DEFAULT_FEE_BPS`), so it must migrate in the same branch to
keep the build green. It also carries the same 10× bug (`provider.ts:82` `/10_000n`).

| File | Change |
|---|---|
| `src/types.ts` | Interface `feeBps` → `feeTenthsBps` |
| `src/provider.ts` | Import `DEFAULT_FEE_TENTHS_BPS`; field + constructor opt → `feeTenthsBps`; `previewWithdraw`: `gross * BigInt(this.feeTenthsBps) / 100_000n` (exact; sync signature preserved) |
| `test/provider.test.ts` | Config-buffer write + `feeTenthsBps` assertions (default `100`; explicit `75` case for the 7.5 bps math) |
| `docs/superpowers/specs/2026-06-25-vault-privacy-provider-example-design.md` | Update the generic fee row to `feeTenthsBps` + note the single ÷10 conversion to the integrator's `feeBps` happens *downstream* (naming-clean) |

**Adapter-boundary treatment (recommended, confirm at review):** the adapter keeps
the *consistent* `feeTenthsBps` unit like the rest of the repo. The downstream port
maps `feeTenthsBps (75)` → the integrator's `feeBps (7.5)` with a single documented
÷10 at the real seam — keeping *our* repo free of any fractional-bps / `BigInt(7.5)`
edge. (Alternative: keep the example's field as fractional `feeBps` for a 1:1
field-name port — rejected to avoid reintroducing the fractional edge here.)

## 5. IDL regeneration approach

The bundled IDL (`packages/sdk/src/idl/sipher_vault.json`) is **vendored but not
imported at runtime** (decode is a hand-rolled offset reader), so this update is for
correctness/consistency, not behaviour.

1. **Preferred:** `anchor build` in `sip-protocol/programs/sipher-vault` to regenerate
   `target/idl/sipher_vault.json`, then copy the field-relevant result across.
2. **Fallback (likely needed):** the host rustc (1.94) removed
   `proc_macro2::Span::source_file`, which currently breaks Anchor's IDL generator
   (flagged in `tests/sipher-vault/02-deposit.test.ts`). If so, **surgically rename**
   the field in the committed JSON. The change is a pure name rename (`u16`→`u16`,
   offset unchanged), verified line-by-line against the Rust source — low-risk, and
   the IDL is unused at runtime regardless.

## 6. IDL rename sites (`sipher_vault.json`)

Structural (`fee_bps` → `fee_tenths_bps`, `new_fee_bps` → `new_fee_tenths_bps`,
`old_fee_bps` → `old_fee_tenths_bps`):

- `initialize` instruction arg
- `update_fee` instruction arg
- `FeeUpdated` event `old_*` / `new_*` fields
- `VaultConfig` account struct field

Doc-comment lines mentioning `fee = amount · fee_bps / 10_000` → `… fee_tenths_bps /
100_000`.

## 7. Testing strategy (TDD — failing first)

- **Regression guard (the 10× fix):** withdraw `1_000_000` at `feeTenthsBps = 75` →
  `feeAmount = 750`, `netAmount = 999_250` (old whole-bps code yields `7_500`). Add
  to the vault / privacy-sol fee tests and the example's `previewWithdraw`.
- **Constants:** `DEFAULT_FEE_TENTHS_BPS === 100` (value-preserving 0.1%), `MAX_FEE_TENTHS_BPS === 1000`.
- **Decode round-trip:** a config buffer with `writeUInt16LE(75, 40)` deserialises to
  `feeTenthsBps === 75`.
- **Display:** `feeTenthsBps / 1000 === 0.075` percent.
- Order: write/flip the tenths-bps assertions, watch them fail against current code,
  then apply the rename + divisor fix.

Run per package: `pnpm --filter @sipher/sdk test`, agent tests, and the example's
`vitest`. Note: sipher has pre-existing flakes (rate-limiter / CORS / viewing-key)
that pass in isolation — re-run rather than treat as regressions.

## 8. Version

Bump `@sipher/sdk` `0.1.0` → **`0.2.0`** — first published version, and the fee
semantics change warrants a minor. (Alternative: publish first as `0.1.0`; rejected —
the change is worth signalling.)

## 9. Publish gating

Land the **reviewed** PR this session (RECTOR reviews/merges — never self-merged).
npm publish is a **separate, explicit-go** step after merge: verify the npm
token/scope, `pnpm --filter @sipher/sdk build`, then `publish`. Publishing is outward
and hard to reverse — it does not happen without an explicit go.

## 10. Decision points to confirm at review

1. **Adapter boundary** — `feeTenthsBps` (consistent; ÷10 downstream) vs a fractional
   `feeBps` for 1:1 port parity. Recommended: `feeTenthsBps`.
2. **Version** — `0.2.0` (recommended) vs `0.1.0` first-publish.
3. **Branch name** — `fix/vault-fee-tenths-bps` (it is a correctness fix + unit
   adaptation).

## 11. Process

Full superpowers cycle: this spec → writing-plans → TDD → `/code-review` (per-logical-
task + whole-branch). GPG-signed commits (`BF47B9DC1FA320FA`), **no AI attribution**,
one commit per logical fix, **no self-merge**. Naming-gate grep must return empty over
any public artifact before each commit.
