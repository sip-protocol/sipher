# @sipher/sdk vault-fee tenths-bps migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `@sipher/sdk` (and its two in-repo consumers) from whole-basis-point vault fees to integer tenths-of-a-bps, mirroring the re-precisioned on-chain program, and fix the resulting 10× fee mis-report.

**Architecture:** The on-chain `VaultConfig.fee_tenths_bps` (u16, offset 40, ÷`100_000`) is decoded by a hand-rolled offset reader in three SDK sites (`vault.ts`, `privacy.ts`, `privacy-sol.ts`) and surfaced through the agent + a reference adapter. We rename the field `feeBps → feeTenthsBps` end-to-end, change every vault fee divisor `10_000n → 100_000n`, and preserve values by scaling constants/fixtures ×10 (0.1% stays 0.1%). The overloaded token `feeBps` also names an unrelated static per-chain list (`chains.ts`) and `sip_privacy` layout comments — both stay whole-bps and must NOT be renamed.

**Tech Stack:** TypeScript (ESM, `.js` import suffixes), Vitest, pnpm workspaces, `@solana/web3.js`, Anchor IDL JSON.

## Global Constraints

- **`sip_privacy` stays whole-bps forever** — never rename `fee_bps` in the `sip_privacy` layout comments inside `privacy.ts` / `privacy-sol.ts` (the `total_transfers` seek), nor touch `sip_privacy`'s `/ 10_000n`.
- **`packages/agent/src/routes/chains.ts` is OUT OF SCOPE** — its 13 `feeBps` entries are static per-chain display fees (whole bps), a different concept from the vault fee. Do not rename.
- **Value-preserving unit conversion:** `DEFAULT_FEE_BPS = 10` → `DEFAULT_FEE_TENTHS_BPS = 100` (0.1%); `MAX_FEE_BPS = 100` → `MAX_FEE_TENTHS_BPS = 1000` (1%). Every migrated fixture value scales ×10.
- **Divisor:** vault fee is `amount * feeTenthsBps / 100_000n` (exact integer BigInt). Never `BigInt(<fractional>)`.
- **Percent display:** `feeTenthsBps / 1000` (e.g. `100 → 0.1%`, `75 → 0.075%`).
- **2-space indent, no semicolons.** GPG-signed commits (`BF47B9DC1FA320FA`), **no AI attribution**, one commit per logical fix, **no self-merge**.
- **Naming gate** (before any commit touching `examples/` or docs): the partner/competitor deny-list grep over the changed paths must return empty. The deny-list pattern is **supplied out-of-band** (executor's prompt / private addendum) — never write the pattern itself into this repo.
- **Worktree:** all work in `/Users/rector/local-dev/sipher-wt/vault-fee-tenths-bps` (branch `fix/vault-fee-tenths-bps`, off `origin/main` @ `b48e8ed`).
- **Test flakes:** sipher has pre-existing rate-limiter / CORS / viewing-key flakes that pass in isolation — re-run rather than treat as regressions.

---

## Task 1: `@sipher/sdk` core — types, constants, decode, fee math

**Files:**
- Modify: `packages/sdk/src/types.ts:9`
- Modify: `packages/sdk/src/config.ts:48-50,55`
- Modify: `packages/sdk/src/vault.ts:105-156` (`deserializeVaultConfig` + doc comment)
- Modify: `packages/sdk/src/privacy.ts:142-146,165` (vault-fee fallback/decode/math; NOT the sip_privacy comment at :149)
- Modify: `packages/sdk/src/privacy-sol.ts:111-115,132` (same; NOT the sip_privacy comment at :119)
- Modify: `packages/sdk/src/index.ts` (2 re-exports of the renamed constants)
- Test: `packages/sdk/tests/vault.test.ts` (14 sites), `packages/sdk/tests/privacy-sol.test.ts` (5 sites), `packages/sdk/tests/privacy.test.ts` (add SPL fee guard)

**Interfaces:**
- Produces: `VaultConfig.feeTenthsBps: number`; consts `DEFAULT_FEE_TENTHS_BPS = 100`, `MAX_FEE_TENTHS_BPS = 1000`; `deserializeVaultConfig` returns `{ …, feeTenthsBps }`; `buildPrivateSendTx` / `buildPrivateSendSolTx` compute fee via `/ 100_000n`. Every later task consumes these names.

- [ ] **Step 1: Flip the constant + decode assertions to the new unit (failing tests)**

In `packages/sdk/tests/vault.test.ts`:
- `:68-69` →
```ts
    expect(DEFAULT_FEE_TENTHS_BPS).toBe(100)
    expect(MAX_FEE_TENTHS_BPS).toBe(1000)
```
- Builder default `:259` `feeBps = 10,` → `feeTenthsBps = 100,`; comment `:279` `// fee_bps: u16 LE` → `// fee_tenths_bps: u16 LE`; `:280` `buf.writeUInt16LE(feeBps, offset)` → `buf.writeUInt16LE(feeTenthsBps, offset)` (and the `overrides` param name).
- `:310` `expect(config.feeBps).toBe(10)` → `expect(config.feeTenthsBps).toBe(100)`.
- `:324-327` "handles max fee BPS" → rename test to "handles max fee tenths-bps"; `{ feeBps: 100 }` → `{ feeTenthsBps: 1000 }`; `expect(config.feeBps).toBe(100)` → `expect(config.feeTenthsBps).toBe(1000)`.
- `:353` `expect(config.feeBps).toBe(10)` → `expect(config.feeTenthsBps).toBe(100)`.

Update the imports at the top of the file: `DEFAULT_FEE_BPS`/`MAX_FEE_BPS` → `DEFAULT_FEE_TENTHS_BPS`/`MAX_FEE_TENTHS_BPS`.

- [ ] **Step 2: Add the 10× regression guard for the SOL fee path (failing test)**

In `packages/sdk/tests/privacy-sol.test.ts`, update `mockConn` (rename `feeBps` opt → `feeTenthsBps`, default `100`, comment `fee_bps` → `fee_tenths_bps`, `:34` `writeUInt16LE(feeTenthsBps, 40)`), then add:
```ts
  it('computes the fee at tenths-bps precision (÷100_000, not ÷10_000)', async () => {
    // 7.5 bps = 75 tenths on 2_000_000 → 1_500 (old whole-bps code gives 15_000)
    const res = await buildPrivateSendSolTx({
      ...baseParams,
      connection: mockConn({ feeTenthsBps: 75, stealthLamports: 1_000_000_000 }),
    })
    expect(res.feeAmount).toBe(1_500n)
    expect(res.netAmount).toBe(1_998_500n)
  })
```
(If a `feeAmount`/`netAmount` assertion already exists elsewhere in the file with `feeBps`, migrate it: rename the mock opt and scale expectations to the `/100_000n` result.)

- [ ] **Step 3: Add the same guard for the SPL path (currently untested)**

`packages/sdk/tests/privacy.test.ts` has no fee assertion today. Add one mirroring Step 2 but for `buildPrivateSendTx` (SPL). Use the file's existing mock/connection pattern; if it lacks a config mock, add one that writes `writeUInt16LE(75, 40)`. Assert `res.feeAmount === amount * 75n / 100_000n` and `res.netAmount === amount - res.feeAmount` for a chosen `amount` (e.g. `2_000_000n → fee 1_500n`).

- [ ] **Step 4: Run the SDK tests — verify they FAIL**

Run: `cd /Users/rector/local-dev/sipher-wt/vault-fee-tenths-bps && pnpm --filter @sipher/sdk test -- --run`
Expected: FAIL — unresolved `DEFAULT_FEE_TENTHS_BPS`/`feeTenthsBps`, and the ÷100_000 guards report `15_000n`/`1_500n` mismatches against the current `/10_000n` code.

- [ ] **Step 5: Rename constants + type**

`packages/sdk/src/config.ts`:
```ts
/** 0.10% fee (100 tenths-of-a-bps) */
export const DEFAULT_FEE_TENTHS_BPS = 100
/** Max 1% fee (1000 tenths-of-a-bps) */
export const MAX_FEE_TENTHS_BPS = 1000
```
And the layout comment `:55` `fee_bps(2)` → `fee_tenths_bps(2)`.

`packages/sdk/src/types.ts:9` `feeBps: number` → `feeTenthsBps: number`.

`packages/sdk/src/index.ts`: rename the two re-exported constant names.

- [ ] **Step 6: Rename the decode**

`packages/sdk/src/vault.ts` — in `deserializeVaultConfig`, the doc comment `:109` `fee_bps: u16` → `fee_tenths_bps: u16`; `:130` `const feeBps = data.readUInt16LE(offset)` → `const feeTenthsBps = data.readUInt16LE(offset)`; `:149` return `feeBps` → `feeTenthsBps`.

- [ ] **Step 7: Fix the two vault-fee math sites**

`packages/sdk/src/privacy.ts`:
- `:142` `let feeBps = 10 // fallback to default` → `let feeTenthsBps = DEFAULT_FEE_TENTHS_BPS // fallback to default` (import `DEFAULT_FEE_TENTHS_BPS` from `./config.js`).
- `:144` comment `// fee_bps is at offset …` → `// fee_tenths_bps is at offset …`; `:145` `feeBps = configInfo.data.readUInt16LE(40)` → `feeTenthsBps = …`.
- `:165` `const feeAmount = (amount * BigInt(feeBps)) / 10_000n` → `const feeAmount = (amount * BigInt(feeTenthsBps)) / 100_000n`.
- **Leave `:149` unchanged** — it documents the `sip_privacy` Config layout (`authority(32) + fee_bps(2) + paused(1) + total_transfers`) while seeking `total_transfers`; that `fee_bps` is `sip_privacy`'s and stays.

`packages/sdk/src/privacy-sol.ts`: identical edits at `:111` (fallback), `:113` (comment), `:114` (decode), `:132` (math). **Leave `:119`** (sip_privacy layout comment).

- [ ] **Step 8: Run the SDK tests — verify they PASS**

Run: `pnpm --filter @sipher/sdk test -- --run`
Expected: PASS (all vault/privacy/privacy-sol suites green).

- [ ] **Step 9: Typecheck the SDK**

Run: `pnpm --filter @sipher/sdk typecheck` (or `pnpm --filter @sipher/sdk exec tsc --noEmit`)
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
cd /Users/rector/local-dev/sipher-wt/vault-fee-tenths-bps
git add packages/sdk/src packages/sdk/tests
git commit -S -m "fix(sdk): vault fee → tenths-bps (feeTenthsBps, ÷100_000); fixes 10× report"
```

---

## Task 2: `@sipher/sdk` — IDL sync, recon scripts, version

**Files:**
- Modify: `packages/sdk/src/idl/sipher_vault.json` (8 sites)
- Modify: `packages/sdk/scripts/recon-devnet-vault-tokens.mjs:19`, `packages/sdk/scripts/devnet-check.ts:38`
- Modify: `packages/sdk/package.json` (version)

- [ ] **Step 1: Regenerate or hand-edit the IDL**

Preferred (if the host toolchain cooperates): in the OTHER repo,
`cd /Users/rector/local-dev/sip-protocol/programs/sipher-vault && anchor build` (or `anchor idl build`), then copy the field-relevant result. **This host's rustc (1.94) likely breaks Anchor IDL-gen** (removed `proc_macro2::Span::source_file`) — if it fails, hand-edit the committed JSON. The IDL is vendored-but-unused at runtime, and the change is a pure name rename (`u16`→`u16`, offset unchanged), so a verified hand-edit is sound.

Hand-edit `packages/sdk/src/idl/sipher_vault.json` — rename these 8 sites (values already located):
| Line | From | To |
|---|---|---|
| 458 | `…during withdraw_private_sol (fee_bps` | `…(fee_tenths_bps` (doc) |
| 1144 | `"name": "fee_bps"` (initialize arg) | `"name": "fee_tenths_bps"` |
| 1677 | `"name": "new_fee_bps"` (update_fee arg) | `"name": "new_fee_tenths_bps"` |
| 1973 | ``fee = amount · fee_bps / 10_000`` (doc) | ``fee = amount · fee_tenths_bps / 100_000`` |
| 2580 | `"name": "old_fee_bps"` (FeeUpdated event) | `"name": "old_fee_tenths_bps"` |
| 2584 | `"name": "new_fee_bps"` (FeeUpdated event) | `"name": "new_fee_tenths_bps"` |
| 2628 | `"name": "fee_bps"` (VaultConfig field) | `"name": "fee_tenths_bps"` |

Verify against source: `grep -n fee_tenths_bps /Users/rector/local-dev/sip-protocol/programs/sipher-vault/programs/sipher-vault/src/state.rs` (must show the u16 field at the config struct).

- [ ] **Step 2: Fix the recon/devnet scripts**

`packages/sdk/scripts/recon-devnet-vault-tokens.mjs:19` `const feeBps = d.readUInt16LE(off)` → `const feeTenthsBps = d.readUInt16LE(off)`; update any display line to divide by `10` for bps (or `1000` for percent). `packages/sdk/scripts/devnet-check.ts:38` `config.feeBps` → `config.feeTenthsBps` (display).

- [ ] **Step 3: Confirm no stray `fee_bps` remains in the IDL**

Run: `grep -nE '"name": *"(new_|old_)?fee_bps"' packages/sdk/src/idl/sipher_vault.json`
Expected: no output.

- [ ] **Step 4: Bump the version**

`packages/sdk/package.json` `"version": "0.1.0"` → `"version": "0.2.0"`.

- [ ] **Step 5: Commit (two logical commits)**

```bash
git add packages/sdk/src/idl/sipher_vault.json packages/sdk/scripts
git commit -S -m "fix(sdk): sync vault IDL + recon scripts to fee_tenths_bps"
git add packages/sdk/package.json
git commit -S -m "chore(sdk): bump @sipher/sdk to 0.2.0"
```

---

## Task 3: `@sipher/agent` — consumers + tests

**Files:**
- Modify: `packages/agent/src/tools/status.ts:61-62,73,89`
- Modify: `packages/agent/src/tools/send.ts:107-110,128,270`
- Modify: `packages/agent/src/routes/vault-deposit-tx.ts:73`
- Test: `status.test.ts` (2), `send.test.ts` (3), `tools.test.ts` (2), `routes/vault-deposit-tx.test.ts` (1), `fixtures/user-tool-mocks.ts` (2), and the send-output `privacy` mocks in `send-private-to-sns.test.ts` (1), `agent-signing-wrapper.test.ts` (3), `agent-display-formatter.test.ts` (2), `integration/signing-callback-roundtrip.test.ts` (2)
- **DO NOT TOUCH:** `packages/agent/src/routes/chains.ts` (per-chain static list)

**Interfaces:**
- Consumes: `VaultConfig.feeTenthsBps`, `DEFAULT_FEE_TENTHS_BPS` from `@sipher/sdk` (Task 1).
- Produces: agent responses surface `feeTenthsBps` (integer) + `feePercent` (unchanged strings).

- [ ] **Step 1: Flip the agent-test assertions/fixtures (failing tests)**

Every agent-test `feeBps` hit is vault-fee-related → rename key to `feeTenthsBps`, scale value ×10. `feePercent` string assertions stay identical (invariant under ×10).
- `status.test.ts:49` `feeBps).toBe(10)` → `feeTenthsBps).toBe(100)`; `:50` `feePercent).toBe('0.1%')` unchanged; `:107` `feeBps).toBe(10) // DEFAULT_FEE_BPS` → `feeTenthsBps).toBe(100) // DEFAULT_FEE_TENTHS_BPS`.
- `send.test.ts:185` `makeVaultConfig({ feeBps: 25 })` → `{ feeTenthsBps: 250 }`; `:184` comment `feeBps` → `feeTenthsBps`; `:199` `feeBps).toBe(25)` → `feeTenthsBps).toBe(250)`; `:215` `feeBps).toBe(10)` → `feeTenthsBps).toBe(100)`.
- `tools.test.ts:388` `privacy.feeBps).toBeGreaterThanOrEqual(0)` → `privacy.feeTenthsBps)…`; `:761` `vault.feeBps).toBe(10)` → `vault.feeTenthsBps).toBe(100)`.
- `routes/vault-deposit-tx.test.ts:72` `res.body.feeBps` → `res.body.feeTenthsBps`.
- `fixtures/user-tool-mocks.ts:68` `feeBps: number` → `feeTenthsBps: number`; `:80` `feeBps: 10` → `feeTenthsBps: 100`.
- Send-output `privacy` mocks (not asserted, but must match the renamed type): rename key `feeBps` → `feeTenthsBps`, value `50` → `500`, in `send-private-to-sns.test.ts:46`, `agent-signing-wrapper.test.ts:73,142,172`, `agent-display-formatter.test.ts:19,74`, `integration/signing-callback-roundtrip.test.ts:54,103`.

Also update the `makeVaultConfig` helper (wherever `send.test.ts`/`status.test.ts` import it) if it hardcodes a `feeBps` key.

- [ ] **Step 2: Run agent tests — verify they FAIL**

Run: `pnpm --filter @sipher/agent test -- --run`
Expected: FAIL (type errors + `feeTenthsBps` undefined on responses still emitting `feeBps`).

- [ ] **Step 3: Rename in `status.ts`**

`:61` `feeBps: DEFAULT_FEE_BPS,` → `feeTenthsBps: DEFAULT_FEE_TENTHS_BPS,`; `:62` `feePercent: \`${DEFAULT_FEE_BPS / 100}%\`,` → `\`${DEFAULT_FEE_TENTHS_BPS / 1000}%\`,`; `:73` `const feePercent = \`${config.feeBps / 100}%\`` → `\`${config.feeTenthsBps / 1000}%\``; `:89` `feeBps: config.feeBps,` → `feeTenthsBps: config.feeTenthsBps,`. Update the `DEFAULT_FEE_BPS` import → `DEFAULT_FEE_TENTHS_BPS`.

- [ ] **Step 4: Rename in `send.ts`**

`:107` comment `Fetch live fee_bps` → `fee_tenths_bps`; `:109` `const feeBps = config?.feeBps ?? DEFAULT_FEE_BPS` → `const feeTenthsBps = config?.feeTenthsBps ?? DEFAULT_FEE_TENTHS_BPS`; `:110` `const feePercent = feeBps / 100` → `const feePercent = feeTenthsBps / 1000`; `:128` and `:270` `feeBps,` → `feeTenthsBps,`. Update the import. (`feePercent` is still used at `:122,129,264,271` — those stay, now derived from the tenths value.)

- [ ] **Step 5: Rename in `vault-deposit-tx.ts`**

`:73` `feeBps: DEFAULT_FEE_BPS,` → `feeTenthsBps: DEFAULT_FEE_TENTHS_BPS,`. Update the import.

- [ ] **Step 6: Run agent tests + typecheck — verify PASS**

Run: `pnpm --filter @sipher/agent test -- --run && pnpm --filter @sipher/agent typecheck`
Expected: PASS. (Re-run once if a known flake reds.)

- [ ] **Step 7: Commit**

```bash
git add packages/agent/src/tools packages/agent/src/routes/vault-deposit-tx.ts packages/agent/tests
git commit -S -m "fix(agent): surface vault fee as feeTenthsBps (÷1000 percent)"
```

---

## Task 4: reference adapter `examples/vault-privacy-provider`

**Files:**
- Modify: `examples/vault-privacy-provider/src/types.ts:41-42`
- Modify: `examples/vault-privacy-provider/src/provider.ts:5,21,23-24,82`
- Test: `examples/vault-privacy-provider/test/provider.test.ts` (8 sites)
- Modify: `docs/superpowers/specs/2026-06-25-vault-privacy-provider-example-design.md` (the generic fee row → `feeTenthsBps` + note the single ÷10 to an integrator's `feeBps` happens downstream)

**Interfaces:**
- Consumes: `DEFAULT_FEE_TENTHS_BPS` from `@sipher/sdk`; `buildPrivateSendSolTx` (÷100_000 fee, Task 1).
- Produces: `VaultPrivacyProvider.feeTenthsBps: number`; `previewWithdraw` uses `/100_000n`.

- [ ] **Step 1: Flip the example tests (failing tests)**

`examples/vault-privacy-provider/test/provider.test.ts`:
- `:16-17` `mockConn` opt `feeBps` → `feeTenthsBps`, default `10` → `100`; `:19` comment `fee_bps` → `fee_tenths_bps`; `:20` `writeUInt16LE(feeBps, 40)` → `writeUInt16LE(feeTenthsBps, 40)`.
- `:43-46` default preview test → `expect(p.feeTenthsBps).toBe(100)`; keep `previewWithdraw(2_000_000n)` → `{ feeLamports: 2_000n, netLamports: 1_998_000n }` (100 tenths on 2M = 2000, unchanged).
- **Add an explicit tenths-precision guard** (the default case is divisor-invariant, so this is what actually exercises the fix):
```ts
  it('previewWithdraw uses tenths-bps precision (75 → 0.075%)', () => {
    const p = new SipherVaultPrivacyProvider(mockConn(), { feeTenthsBps: 75 })
    expect(p.previewWithdraw(2_000_000n)).toEqual({ feeLamports: 1_500n, netLamports: 1_998_500n })
  })
```
- `:89` `mockConn({ feeBps: 10 })` → `mockConn({ feeTenthsBps: 100 })` (the on-chain-path `privateWithdraw` test; `:91-92` `feeLamports 2_000n`/`withdrawnLamports 1_998_000n` unchanged).

- [ ] **Step 2: Run example tests — verify they FAIL**

Run: `pnpm --filter vault-privacy-provider test -- --run` (or `cd examples/vault-privacy-provider && pnpm test -- --run`)
Expected: FAIL — `feeTenthsBps` undefined, and the `75 → 1_500n` guard mismatches the current `BigInt(this.feeBps)/10_000n`.

- [ ] **Step 3: Migrate the interface + provider**

`examples/vault-privacy-provider/src/types.ts:41-42` — comment `Advertised withdraw fee (bps)` → `Advertised withdraw fee (tenths of a bps)`; `readonly feeBps: number` → `readonly feeTenthsBps: number`.

`examples/vault-privacy-provider/src/provider.ts`:
- `:5` import `DEFAULT_FEE_BPS` → `DEFAULT_FEE_TENTHS_BPS`.
- `:21` `readonly feeBps: number` → `readonly feeTenthsBps: number`.
- `:23` `opts: { feeBps?: number } = {}` → `opts: { feeTenthsBps?: number } = {}`.
- `:24` `this.feeBps = opts.feeBps ?? DEFAULT_FEE_BPS` → `this.feeTenthsBps = opts.feeTenthsBps ?? DEFAULT_FEE_TENTHS_BPS`.
- `:82` `const feeLamports = (grossLamports * BigInt(this.feeBps)) / 10_000n` → `const feeLamports = (grossLamports * BigInt(this.feeTenthsBps)) / 100_000n`.

- [ ] **Step 4: Update the generic example spec (naming-clean)**

In `docs/superpowers/specs/2026-06-25-vault-privacy-provider-example-design.md`, change the fee row/text from whole-bps `feeBps` to `feeTenthsBps`, and add: "an integrator whose interface uses whole-bps `feeBps` receives `feeTenthsBps / 10` at the downstream port — the sole conversion, kept out of this repo." Do not name any external party.

- [ ] **Step 5: Naming gate**

Run the partner/competitor deny-list grep (pattern supplied out-of-band — never commit it here) over `examples/vault-privacy-provider` and `docs/superpowers/specs/2026-06-25-vault-privacy-provider-example-design.md`.
Expected: no output.

- [ ] **Step 6: Run example tests + typecheck — verify PASS**

Run: `pnpm --filter vault-privacy-provider test -- --run && pnpm --filter vault-privacy-provider typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add examples/vault-privacy-provider docs/superpowers/specs/2026-06-25-vault-privacy-provider-example-design.md
git commit -S -m "fix(example): vault-privacy-provider fee → tenths-bps"
```

---

## Task 5: whole-branch verification + review + PR

**Files:** none (verification + review).

- [ ] **Step 1: Full workspace test + typecheck + build**

Run:
```bash
cd /Users/rector/local-dev/sipher-wt/vault-fee-tenths-bps
pnpm install
pnpm test -- --run
pnpm typecheck
pnpm build
cd packages/agent && pnpm test -- --run && cd ../..
```
Expected: all green (re-run any known flake once). If anything reds, STOP and fix before proceeding.

- [ ] **Step 2: Confirm the guard-rails held**

Run:
```bash
# chains.ts per-chain list untouched:
git diff --stat origin/main -- packages/agent/src/routes/chains.ts   # expect: empty
# no vault fee_bps / 10_000n left in migrated files:
grep -rnE 'feeBps|/ *10_000n' packages/sdk/src packages/agent/src/tools examples/vault-privacy-provider/src
#   → only allowed hits: sip_privacy layout comments in privacy.ts/privacy-sol.ts
# naming gate over the whole diff (deny-list pattern supplied out-of-band — do NOT inline it here):
#   run the partner/competitor deny-list grep over `git diff --name-only origin/main`; expect empty
```

- [ ] **Step 3: `/code-review` the whole branch**

Run the `/code-review` skill over the branch diff (high effort). Address findings (one commit per fix, GPG-signed). Re-run tests after fixes.

- [ ] **Step 4: Push + open PR (do NOT self-merge)**

```bash
git push -u origin fix/vault-fee-tenths-bps
gh pr create --repo sip-protocol/sipher --base main --head fix/vault-fee-tenths-bps \
  --title "fix(sdk): vault fee → tenths-bps (feeTenthsBps); publish-gate for @sipher/sdk 0.2.0" \
  --body "<summary: on-chain fee_tenths_bps migration; 10× report fix; 3 packages; sip_privacy + chains.ts untouched; publish is a separate explicit-go step>"
```
RECTOR reviews/merges. **npm publish of `@sipher/sdk@0.2.0` remains a separate, explicit-go step after merge.**

---

## Self-Review (author checklist — completed)

- **Spec coverage:** every spec §4 site → a task (SDK core T1, IDL/scripts/version T2, agent T3, example+generic-spec T4, verify/publish-gate T5). ✓
- **Placeholder scan:** no TBD/TODO; all code shown; the one open unknown (existing SPL fee assertion) is handled as "add if absent." ✓
- **Type consistency:** `feeTenthsBps` / `DEFAULT_FEE_TENTHS_BPS` / `MAX_FEE_TENTHS_BPS` / `/ 100_000n` used identically across all tasks; `feePercent` retained as string. ✓
- **Guard-rails:** `sip_privacy` comments (privacy.ts:149 / privacy-sol.ts:119) and `chains.ts` explicitly excluded in T1/T3 + verified in T5. ✓
