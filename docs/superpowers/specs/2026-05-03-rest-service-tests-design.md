# Phase 4 — REST Service Tests Design Spec

**Date:** 2026-05-03
**Status:** Approved scope, ready for implementation plan
**Scope:** Phase 4 of the "address all audit findings" multi-phase effort
**Related audits:** Spec-vs-implementation gap audit (2026-04-18); test-infrastructure spec line 267 lists this phase
**Predecessor specs:** `2026-04-18-test-infrastructure-design.md` (Phase 1), `2026-04-26-ui-gaps-design.md` (Phase 2), `2026-04-27-sentinel-surface-docs-design.md` (Phase 3)

## Summary

Add isolated unit-level test coverage for the three REST API service-layer modules under `src/services/` that compose Solana transactions for SIPHER's stealth-transfer and private-swap flows: `transaction-builder.ts`, `chain-transfer-builder.ts`, and `private-swap-builder.ts`. Currently uncovered as units (one of the three has partial transitive coverage via `tests/private-swap.test.ts`). Phase 4 adds **~37 new tests** across **3 new test files** in root `tests/`, plus **1 shared fixture file** at `tests/fixtures/builder-mocks.ts`. Tests follow the same real-SDK + mocked-network pattern as the existing `tests/private-swap.test.ts`. Zero source-code changes to the builders. Single PR.

## Context

The 2026-04-18 test-infrastructure audit listed Phase 4 as: *"REST service tests (chain-transfer-builder, transaction-builder, private-swap-builder) — Phase 4."* The audit located these files at `packages/agent/src/services/`, but verification on 2026-05-03 found them at root `src/services/`:

- `src/services/transaction-builder.ts` (308 lines) — Solana transaction builders: `buildShieldedSolTransfer`, `buildShieldedSplTransfer`, `buildAnchorShieldedSolTransfer`. The Anchor builder reads `CONFIG_PDA` bytes from RPC, parses the `total_transfers` counter at byte offset 43, derives a `transfer_record` PDA, and packs an 8+33+32+32+32+8+128+8 byte instruction-data buffer for the live `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` program.
- `src/services/chain-transfer-builder.ts` (290 lines) — Multi-chain orchestrator: `buildPrivateTransfer`, `isTransferSupported`, `getSupportedTransferChains`. Branches across 7 chains (Solana with Anchor / system / SPL fallbacks; Ethereum, Polygon, Arbitrum, Optimism, Base via EVM family with ERC20 calldata; NEAR with native Transfer or NEP-141 FunctionCall).
- `src/services/private-swap-builder.ts` (173 lines) — Jupiter-routed private-swap orchestrator: `buildPrivateSwap`. Calls Jupiter for quote + swap tx, generates stealth output address, optionally wraps via C-SPL with try/catch fallback, computes Pedersen commitment.

**Existing coverage map:**

| File | Existing route-level coverage | Existing unit-level coverage |
|------|------------------------------|------------------------------|
| `transaction-builder.ts` | None directly; called via `chain-transfer-builder` from `transfer-shield.test.ts` | None |
| `chain-transfer-builder.ts` | Partial via `transfer-shield.test.ts` (Solana branch only) | None |
| `private-swap-builder.ts` | `tests/private-swap.test.ts` — 18 supertest tests (happy, validation, idempotency, beta, E2E) | None |

The existing tests are restaurant-review-style: order at the route, kitchen cooks, plate goes out. Phase 4 adds chef-interview-style: import the builder, call it directly, assert its branches and contracts. Both styles have value (Phase 4 lesson Q2 = option A: add alongside, not replace).

## Goals

1. Land **3 new test files** in root `tests/` covering the 3 builders directly.
2. **~37 tests** total (full-branch coverage, see Test Categories section). Numbers may flex ±2 during TDD.
3. **Zero regression** in existing root suite (33 files), agent suite (938 tests), app suite (45 tests).
4. **Zero source-code changes** to the 3 builders — Phase 4 is test-only.
5. **Single PR** vs `main` (avoid Phase 2's stacked-spec-branch orphan trap).
6. **Spec + plan + impl** all bundled in one PR.

## Non-goals

- Tests for other services in `src/services/*.ts` (jupiter-provider, cspl, redis, helius-provider, solana, etc.) — not in audit scope, future phase.
- Modifying `tests/private-swap.test.ts` or `tests/transfer-shield.test.ts` — Q2 chose to add alongside, not replace.
- Testing CSPL service internals (`cspl.ts` itself) — we mock at the boundary.
- E2E tests against devnet/mainnet — already covered by existing `private-swap.test.ts` E2E section.
- Refactoring builders to be more testable — Phase 4 tests them as-is. If a test reveals a real bug, file a follow-up issue and pause; do not fix in this PR.
- Performance / load tests, snapshot tests.
- Migrating existing tests to a new pattern.

## Architecture

### File layout

```
tests/
  private-swap-builder.test.ts     (NEW — sits next to existing private-swap.test.ts)
  chain-transfer-builder.test.ts   (NEW)
  transaction-builder.test.ts      (NEW)
  fixtures/
    builder-mocks.ts               (NEW — shared mocks)
```

Why a shared `fixtures/builder-mocks.ts`: all 3 test files need the same `vi.mock('@solana/web3.js')` pattern (faked `Connection` returning `getLatestBlockhash` + `getAccountInfo`). Inlining 3 copies is duplication. The shared module exports:

- `mockSolanaConnection(overrides?)` — returns the Connection mock factory
- `makeConfigPDABytes(counter: bigint)` — produces a `Buffer.alloc(51)` with `total_transfers` written at offset 43 as u64 LE
- `makeJupiterQuote(opts?)` — returns a typed `QuoteEntry` shape for use with `vi.mock('./jupiter-provider.js')` (preferred over fetch-global stubbing — mocks at module boundary so the builder gets the same shape it would receive in production)
- `makeJupiterSwapTx(swapTransaction?)` — returns a typed `SwapTransactionResult` shape for `buildSwapTransaction` mock
- `mockCSPLService(behavior: 'success' | 'fail' | 'throws')` — returns the CSPL service mock

### Mocking strategy per file (Q1 = real-kitchen / service-integration)

#### `transaction-builder.test.ts` — the prep cook

**Faked:**
- `@solana/web3.js` `Connection` via `vi.mock` with `vi.importActual` spread (matches existing `tests/private-swap.test.ts:7-22` pattern)
- `./solana.js` `getConnection` returns the mocked Connection

**Real:**
- `@noble/hashes/sha256`, `@solana/spl-token` instruction builders (pure crypto / byte helpers, no I/O)
- All inputs are fixed deterministic values (no SDK randomness inside this file — Q4 dealer strategy: fixed bytes since the prep cook doesn't roll dice)

**Anchor mocking trick:** `buildAnchorShieldedSolTransfer` reads `total_transfers` from CONFIG_PDA bytes at offset 43. Tests use `makeConfigPDABytes(counter)` to generate `Buffer.alloc(51)` with `writeBigUInt64LE(counter, 43)`. This lets us test counter=0, counter=42, counter=2^53-1 cases without touching the chain.

#### `chain-transfer-builder.test.ts` — the head chef

**Faked:**
- `./transaction-builder.js` — mock all 3 exports (`buildShieldedSolTransfer`, `buildShieldedSplTransfer`, `buildAnchorShieldedSolTransfer`) to return predictable strings. Lets us test "did the head chef call the right prep cook with the right args?" in isolation.

**Real:**
- `@sip-protocol/sdk` — real `generateStealthAddress`, real `commit()`, real `isEd25519Chain`, real curve detection. Q4 dealer strategy: invariants (assert "stealth address is a valid 32-byte ed25519 pubkey for solana/near", "valid 0x-prefixed hex secp256k1 pubkey for evm").

#### `private-swap-builder.test.ts` — the specialty chef

**Faked:**
- `./jupiter-provider.js` `getQuote` and `buildSwapTransaction` — return canned quote + canned swap tx
- `./cspl.js` `getCSPLService` — three configurable behaviors via `mockCSPLService(behavior)`: `'success'` (returns wrap result with signature), `'fail'` (returns `{success: false}`), `'throws'` (rejects)

**Real:**
- `@sip-protocol/sdk` — real stealth gen + real commit (same as chain-transfer-builder)

### Dealer strategy by layer (Q4 = match strategy to layer)

| Layer | File | Strategy | Why |
|-------|------|----------|-----|
| Prep cook | `transaction-builder.ts` | Fixed-byte inputs, byte-precise assertions | No randomness inside this file — receives stealth addresses as parameters. Byte layout matters (instruction data has specific offsets). |
| Orchestrator | `chain-transfer-builder.ts` | Real SDK randomness, invariant assertions | Calls SDK's `generateStealthAddress` which uses `crypto.getRandomValues`. Asserting specific addresses would freeze SDK internals. |
| Orchestrator | `private-swap-builder.ts` | Real SDK randomness, invariant assertions | Same reason. |

This is not "two patterns" — it is matching the test to the layer.

## Test Categories (the menu)

Per Q3 = full chef's table. ~37 tests total. Each test sentence becomes one task in the implementation plan (some grouped via `it.each` parameterization).

### `transaction-builder.test.ts` — 14 tests

**`buildShieldedSolTransfer` (3)**
1. Builds `SystemProgram.transfer` instruction with correct `fromPubkey` / `toPubkey` / `lamports`
2. Tx has `recentBlockhash`, `lastValidBlockHeight`, `feePayer` set
3. Returned base64 deserializes back to a valid unsigned tx

**`buildShieldedSplTransfer` (4)**
1. When stealth ATA does **not** exist → tx contains `createAssociatedTokenAccountInstruction` + `createTransferInstruction`
2. When stealth ATA **exists** → tx contains only `createTransferInstruction` (no ATA creation)
3. Uses correct sender-ATA derivation (`getAssociatedTokenAddress(mint, sender)`)
4. Uses `allowOwnerOffCurve=true` for stealth-ATA derivation (critical — stealth addresses can be off-curve)

**`buildAnchorShieldedSolTransfer` (7)**
1. Throws `"CONFIG_PDA account not found"` when RPC returns `null`
2. Parses `total_transfers` correctly when counter = 0
3. Parses correctly when counter = 42
4. Parses correctly when counter = `2n ** 53n - 1n` (near `Number.MAX_SAFE_INTEGER`)
5. Derives `transferRecordPDA` from `[TRANSFER_RECORD_SEED, senderPubkey, counter_le_bytes]`
6. Instruction data byte layout assertion at exact offsets: discriminator(0-7), commitment(8-40), stealth(41-72), ephemeral(73-104), vkHash(105-136), encryptedAmount(137-144), proof(145-272), amount(273-280)
7. Handles hex inputs with AND without `0x` prefix (parameterized via `it.each([true, false])` over each hex field)

### `chain-transfer-builder.test.ts` — 13 tests

**`isTransferSupported` (2)**
1. Returns `true` for all 7 supported chains (parameterized: solana, ethereum, polygon, arbitrum, optimism, base, near)
2. Returns `false` for unsupported chain (`'bitcoin'`)

**`getSupportedTransferChains` (1)**
1. Returns array containing all 7 chains

**`buildPrivateTransfer` — Solana branch (3)**
1. Native SOL → calls `buildAnchorShieldedSolTransfer` (Anchor path), returned `instructionType === 'anchor'`
2. Native SOL → if Anchor mock throws, falls back to `buildShieldedSolTransfer`, returned `instructionType === 'system'`
3. SPL token (mint provided) → calls `buildShieldedSplTransfer` with mint

**`buildPrivateTransfer` — EVM branch (3)**
1. Native ETH → returns `{type:'evm', to: stealth, value: amount, data: '0x'}` for all 5 EVM chains (parameterized over `[ethereum, polygon, arbitrum, optimism, base]`)
2. ERC20 (token contract provided) → `data` starts with `0xa9059cbb` + 32-byte-padded stealth address + 32-byte-padded amount
3. Correct `chainId` per chain (parameterized — defends against per-chain encoding regression)

**`buildPrivateTransfer` — NEAR branch (2)**
1. Native NEAR → `actions: [{type: 'Transfer', amount}]`
2. NEP-141 FT (token contract provided) → `FunctionCall` with `methodName: 'ft_transfer'`, base64-encoded args containing `receiver_id`, `amount`, `memo`, gas `30000000000000`, deposit `'1'`

**`buildPrivateTransfer` — error / curve detection (2)**
1. Throws on unsupported chain (e.g., `'bitcoin'`)
2. Returns correct `curve` (`'ed25519'` for solana/near, `'secp256k1'` for evm) — parameterized over all 7 chains

### `private-swap-builder.test.ts` — 10 tests

**Happy path (3)**
1. With provided meta-address → uses it (not ephemeral)
2. Without meta-address → generates ephemeral meta-address
3. Returns expected `PrivateSwapResult` shape (all documented fields populated)

**C-SPL branches (3)**
1. CSPL wrap **succeeds** → `transactions[0].type === 'wrap'`, `csplWrapped === true`, `estimatedComputeUnits === 400_000`, `executionOrder` includes `'wrap'`
2. CSPL returns `{success: false}` → no wrap tx, `csplWrapped === false`, `estimatedComputeUnits === 200_000`
3. CSPL **throws** → silently caught, no wrap tx, `csplWrapped === false`, `estimatedComputeUnits === 200_000`

**Stealth + commitment (2)**
1. `outputStealthAddress` is a valid 32-byte ed25519 Solana address (invariant)
2. `commitment` is a 33-byte compressed point (66 hex chars after `0x`), `blindingFactor` is 32-byte hex

**Viewing key hash (2)**
1. With provided meta-address → `viewingKeyHash === '0x' + sha256(viewingKey bytes)`
2. Without meta-address (ephemeral) → `viewingKeyHash === '0x' + sha256("ephemeral-" + outputStealthAddress)`

## Implementation Notes

- **`vi.mock('@solana/web3.js')` pattern:** Use `vi.importActual<typeof import('@solana/web3.js')>('@solana/web3.js')` and spread, only override `Connection`. Copy verbatim from `tests/private-swap.test.ts:7-22`. Without `importActual`, `PublicKey`, `Transaction`, `SystemProgram` constructors break.
- **`makeConfigPDABytes(counter: bigint): Buffer`** lives in `tests/fixtures/builder-mocks.ts`. Returns `Buffer.alloc(51)` with `buf.writeBigUInt64LE(counter, 43)`. Document the offset reference in a comment pointing at `transaction-builder.ts:155-159`.
- **Parameterized EVM tests** use `it.each([['ethereum', 1], ['polygon', 137], ['arbitrum', 42161], ['optimism', 10], ['base', 8453]])` — keeps the test code single-source and asserts the exact `chainId` mapping.
- **Hex prefix parameterization** uses `it.each([['with prefix', true], ['without prefix', false]])` — wraps each Anchor input field through both forms in a single test definition.
- **Test inputs:** Reuse fixed `Keypair.generate()` once per test file at top, store in `const`, reuse across tests. Avoids regenerating identities per test (faster + deterministic).
- **No source-code changes** to the 3 builders — if a test reveals a bug, file as a separate issue and pause Phase 4 to discuss. Phase 4 PR ships only tests.

## Acceptance Criteria

- [ ] 3 new test files committed under `tests/`: `transaction-builder.test.ts`, `chain-transfer-builder.test.ts`, `private-swap-builder.test.ts`
- [ ] 1 new shared fixture file at `tests/fixtures/builder-mocks.ts`
- [ ] ~37 tests added (±2 acceptable)
- [ ] Root suite goes 33 → 36 files, all green: `pnpm test -- --run`
- [ ] Zero regression in agent (938) and app (45) test suites
- [ ] `pnpm typecheck` clean across workspace
- [ ] Single PR vs `main` (no stacked spec branch)
- [ ] Spec + plan files committed alongside test code in same PR
- [ ] PR description lists what was tested and what was deferred (with links to follow-up issues, if any filed)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Anchor instruction byte layout shifts when `sip_privacy` program is updated | Test file header comment references `programs/sip_privacy/src/lib.rs` so future devs know which source to update |
| SDK upgrades change stealth function return shape | Q4 invariants are resilient. If SDK breaks invariants intentionally, our tests catch it (correct behavior). |
| `crypto.getRandomValues` flake from accidentally pinning specific values | Q4 forbids specific-value assertions in orchestrator tests; PR reviewer must scan for `expect(addr).toBe('...')` patterns |
| `vi.mock('@solana/web3.js')` over-mocks and breaks unrelated tests | Use `vi.importActual` + spread pattern (existing `private-swap.test.ts:7-22`). Verify via `pnpm test -- --run` after every test added. |
| Discovering real bugs in builders during test writing expands scope | **Hard rule:** file as separate follow-up issue, pause Phase 4, do not fix in this PR. Tests prove the bug exists; the fix is a separate PR. |
| Mock factory drift between 3 test files | Single shared `tests/fixtures/builder-mocks.ts` is the only source of truth; lint review catches inline duplication. |

## PR + Commit Strategy

**Branch:** `feat/phase-4-rest-service-tests` (single branch off `main`)

**Why single PR (no stacked spec branch):** Phase 3 lesson #4 — the stacked-spec-branch pattern leaves orphans. Phase 2's spec was orphaned and required a rescue PR (#161). Phase 4 lands as one combined PR with spec + plan + tests bundled.

**Commit cadence (TDD-style, one commit per task):**

```
docs(phase-4): add rest service tests spec
docs(phase-4): add rest service tests plan
test(fixtures): add shared builder-mocks helper
test(transaction-builder): add buildShieldedSolTransfer tests (3)
test(transaction-builder): add buildShieldedSplTransfer tests (4)
test(transaction-builder): add buildAnchorShieldedSolTransfer tests (7)
test(chain-transfer-builder): add isTransferSupported + getSupportedTransferChains tests (3)
test(chain-transfer-builder): add Solana branch tests (3)
test(chain-transfer-builder): add EVM branch tests (3, parameterized)
test(chain-transfer-builder): add NEAR branch tests (2)
test(chain-transfer-builder): add error + curve detection tests (2)
test(private-swap-builder): add happy path tests (3)
test(private-swap-builder): add C-SPL branch tests (3)
test(private-swap-builder): add stealth + commitment invariant tests (2)
test(private-swap-builder): add viewing key hash tests (2)
chore: bump test count baseline in CLAUDE.md
```

~16 commits / ~14-15 plan tasks (some commits group small related tests).

**Verification before opening PR:**

```bash
# Per-task TDD loop (during execution)
pnpm test tests/transaction-builder -- --run
pnpm typecheck

# Final pre-PR checklist
pnpm test -- --run                          # full root suite, expect 33→36 files green
pnpm --filter @sipher/agent test -- --run   # agent baseline 938 unchanged
pnpm --filter @sipher/app test -- --run     # app baseline 45 unchanged
pnpm typecheck                              # workspace
pnpm exec playwright test                   # E2E: 8/8 + 2 skipped (cipher-admin keypair)
git diff main --stat                        # sanity check scope
```

## Naming Conventions

- **Test file naming:** `{builder-name}.test.ts` (kebab-case, exactly matches source file basename)
- **Test description style:** `describe('buildShieldedSolTransfer', () => { it('builds System.transfer with correct from/to/lamports', ...) })` — function name as describe, behavior phrase as it
- **Fixture file:** `tests/fixtures/builder-mocks.ts` (one helper per public mock, named after what it mocks)
- **Mock variable convention:** `mockGetAccountInfo`, `mockGetLatestBlockhash` (prefix with `mock`, follow with method name being mocked)

## Out of Scope (deferred or explicitly excluded)

- Source-code changes to the 3 builders — test-only PR.
- Tests for other `src/services/*.ts` files (jupiter-provider, cspl, redis, helius-provider, solana, etc.).
- Modifying `tests/private-swap.test.ts` or `tests/transfer-shield.test.ts`.
- Testing CSPL service internals.
- E2E tests against devnet/mainnet.
- Performance / load tests.
- Snapshot testing.
- Migrating existing tests to a new pattern.
- Refactoring `transaction-builder.ts` to extract CONFIG_PDA reader (would simplify testing — file as follow-up issue if testing turns out painful, do not do in this PR).

## Follow-up Issues (filed during PR open if discovered)

- Bugs surfaced by tests during execution
- Refactor opportunities noted but not pursued (e.g., CONFIG_PDA reader extraction)
- Test coverage gaps for adjacent uncovered files (other `src/services/`)

## Phase 4 Lessons to Carry Forward (post-execution)

To be filled in during PR open / session handoff.

---

**Spec status:** Approved sections 1-5 in brainstorming dialogue 2026-05-03 with RECTOR. Ready for `superpowers:writing-plans` to convert into TDD task list.
