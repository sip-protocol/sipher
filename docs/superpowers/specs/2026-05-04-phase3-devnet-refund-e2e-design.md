# Phase 3 — Devnet Refund E2E — Design Spec

**Date:** 2026-05-04
**Status:** Approved scope, ready for implementation plan
**Audit reference:** 2026-04-18 SENTINEL audit, Phase 3 (long-deferred — last open item after Phase 6 closure on 2026-05-04)
**Predecessor specs:** `2026-04-15-sentinel-formalization-design.md` (introduced `performVaultRefund`), `~/local-dev/sip-protocol/docs/superpowers/specs/2026-04-16-authority-refund-design.md` (added the `authority_refund` Anchor instruction this E2E exercises)

## Summary

Two manually-invoked TypeScript scripts under `scripts/` that produce one observed end-to-end execution of `performVaultRefund` against the live `sipher_vault` program on Solana devnet. Bootstrap script (run today) wraps 0.01 SOL into wSOL and deposits it into the live devnet vault, then saves state to a gitignored JSON file. Refund script (run 24h+ later) reads that state, calls the production `performVaultRefund` function with real RPC + real keypair signing, asserts pre/post chain state (depositor's wSOL ATA balance + `DepositRecord` PDA closure), and writes a committed JSON evidence artifact to `docs/sentinel/evidence/`.

Single blessed run scope. No CI integration, no recurring test, no fixture mocks. The output is one auditable JSON receipt proving the agent's authority-refund code path drives the live program correctly.

## Context

`performVaultRefund` (`packages/agent/src/sentinel/vault-refund.ts`, 95 lines) is SENTINEL's mechanism for returning user funds when SENTINEL cancels a flagged fund-moving action. It loads the authority keypair from `SENTINEL_AUTHORITY_KEYPAIR`, fetches the on-chain `DepositRecord`, calls `buildAuthorityRefundTx` from `@sipher/sdk`, signs with the authority, and submits with `skipPreflight: true`.

The function ships in production right now in advisory mode. If an admin clicks "Cancel & refund" in the Command Center UI today, this code path fires.

Existing test coverage:

- **Unit tests** (`packages/agent/tests/sentinel/vault-refund.test.ts`, 183 lines) — full-mock harness: `@sipher/sdk` and `node:fs` are stubbed. Validates that the wiring is correct *given the SDK behaves as expected*.
- **Anchor program tests** (`~/local-dev/sip-protocol/programs/sipher-vault/tests/sipher-vault/03-refund.test.ts`) — three `authority_refund` scenarios (pre-timeout reject, unauthorized signer reject, happy path). Run against `solana-test-validator`, not real devnet.

The gap: nobody has ever observed the agent talk to a real Solana RPC node and successfully drive the live `sipher_vault` program through an authority refund. Subtle issues that mocks miss — RPC version drift, ATA semantics, fee math, transaction sizing, CU budgeting — would only surface here.

This spec closes that gap with one blessed run, captured as a committed evidence artifact, before the vault is promoted to mainnet (Phase 4).

## Goals

1. **One observed end-to-end run** of `performVaultRefund` against live devnet, captured in version control as a JSON evidence artifact.
2. **Production function under test, not a re-implementation** — the refund script imports and calls the actual `performVaultRefund` from `packages/agent/src/sentinel/vault-refund.ts`, with `SENTINEL_AUTHORITY_KEYPAIR` set to the real keypair file. No re-implementation of refund logic in test code.
3. **Pre/post on-chain assertions** — refund TX reaches `finalized` commitment, depositor's wSOL ATA balance increases by the pre-refund `DepositRecord.balance`, `DepositRecord` PDA is closed (or `balance` is zeroed). All three assertions logged in the evidence file.
4. **Reusable diagnostic scripts** — the recon scripts written during this design (`scripts/recon-devnet-deposits.mjs`, `scripts/recon-devnet-vault-tokens.mjs`) ship alongside as committed utilities for Phase 4 prep.
5. **Land as a single PR** with the four scripts, evidence artifact, and a one-line CHANGELOG entry referencing the audit closure.

## Non-goals

- **CI integration.** This is a one-shot. The 24h timeout makes it inherently incompatible with a per-PR CI gate, and adding `workflow_dispatch` plumbing for a script that runs once doesn't earn its complexity.
- **Mainnet execution.** Devnet only. Phase 4 (mainnet vault deploy) is a separate spec.
- **Negative-path coverage at agent layer.** Pre-timeout and unauthorized-signer rejection paths are already covered in the Anchor tests at `programs/sipher-vault/tests/.../03-refund.test.ts`. Mirroring them at the agent layer adds duplicate coverage at a different abstraction level without providing meaningfully different signal.
- **`update_timeout` instruction or short-timeout test vault.** The 24h timeout is a feature, not a limitation. We accept the wait once.
- **Bus event assertions.** The unit tests already verify `bus.emit('sentinel.refund.executed', ...)` wiring with mocks. Re-asserting it through real network adds no signal.
- **Vault config or fee changes.** The test consumes whatever fee_bps and timeout the live config has (10 bps, 86400s as of 2026-03-31).

## Decisions Locked

### Scope: single blessed run (option A from brainstorm)

Not "repeatable on demand" (would require an `update_timeout` ix on the program — bigger scope). Not "automated in CI" (24h timeout incompatible). Not "comprehensive coverage" (anchor tests already cover negatives).

**Justification:** The audit gap is "have we ever observed this work on real Solana?" — a single green run answers that. Anything beyond is over-engineering for an audit-closure piece. The script artifacts remain available for re-runs if SDK or program version changes warrant it.

### Fixture: two-phase bootstrap + refund (option β)

Forced by reality: devnet vault has zero existing `DepositRecord` accounts (verified via `scripts/recon-devnet-deposits.mjs`). Path α (scan + refund existing) had nothing to scan. Bootstrap creates the deposit; 24h+ later, refund consumes it.

**Justification:** The 24h wait is the only viable option without program changes. The wait costs nothing — start it once, evidentiary run is 5 seconds the next day.

### Location: `scripts/` (option A)

Two new TypeScript files: `scripts/devnet-vault-bootstrap.ts` and `scripts/devnet-vault-refund-e2e.ts`. Run with `pnpm tsx <path>`.

**Justification:** Matches existing convention (`scripts/devnet-shielded-transfer.ts` is already there). Vitest with a `skipIf` gate would imply recurring test, which is dishonest to the actual lifecycle. The Playwright `e2e/` directory is for frontend specs — keeping these separate avoids confusion.

### Identity: single wallet plays both roles (option A)

Shared devnet wallet (`FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr`, keypair at `~/Documents/secret/solana-devnet.json`) is both depositor (wraps SOL → wSOL → deposits) and authority (signs `create_vault_token`, `create_fee_token`, and the `authority_refund` ix). One keypair, one funded wallet.

**Justification:** The `performVaultRefund` code path reads the destination from the on-chain `DepositRecord.depositor` field — it does not validate that depositor differs from authority. So testing with same-wallet preserves full code-path coverage without the funding-the-second-wallet ceremony. Production deployment will have separate identities; that distinction is enforced by data, not code, and no test fidelity is lost here.

### State handoff: gitignored JSON file + committed evidence artifact (option A)

Bootstrap writes `scripts/.devnet-vault-bootstrap.json` (gitignored, mode 600). Refund script reads it, augments it with refund details, and emits the final artifact to `docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json` (committed).

**Justification:** The 24h gap is wide enough that copy-pasting CLI args from yesterday's terminal is fragile. The state file IS the artifact. Committed evidence in `docs/sentinel/evidence/` makes "Phase 3 closed" verifiable, not asserted.

### Token: wSOL, with explicit init of vault_token + fee_token + depositor ATA as prerequisites

Bootstrap uses **wSOL** (`So11111111111111111111111111111111111111112`) as the deposit currency. Recon (`scripts/recon-devnet-vault-tokens.mjs`) confirmed:
- The live vault's `VaultConfig` shows `total_deposits=0`, `total_depositors=0` — the vault has never been used.
- No `vault_token` PDA exists for wSOL (or any other mint) on devnet.
- No `fee_token` PDA exists for wSOL.
- The two non-config program accounts (4812 + 2428 bytes, identical discriminator `184662bf3a907b9e`) are not vault/fee tokens — they are program-owned artifacts (likely IDL buffers from `anchor idl init`), not relevant to deposit flow.

This means the bootstrap script must perform three setup actions before `buildDepositTx`:

1. **`create_vault_token` for wSOL** — call the vault program's `create_vault_token` instruction to initialize the SPL TokenAccount at `[b"vault_token", wSOL]` PDA.
2. **`create_fee_token` for wSOL** — call `create_fee_token` to initialize the SPL TokenAccount at `[b"fee_token", wSOL]` PDA.
3. **Depositor wSOL ATA + wrap** — derive depositor's ATA for wSOL via `getAssociatedTokenAddress`. Create with `createAssociatedTokenAccountInstruction` if missing. Transfer 0.01 SOL into the ATA via `SystemProgram.transfer`. Call `createSyncNativeInstruction` to convert the lamport balance into wSOL token balance.

These three setup steps each emit one transaction (or can be batched — see "Implementation note" below). Then bootstrap calls `buildDepositTx` and the deposit completes.

**Justification:**
- wSOL is the natural test currency: the shared devnet wallet has SOL, wrapping is well-trodden, no need to acquire a custom SPL token.
- Initialization steps are one-time. Once `create_vault_token` and `create_fee_token` succeed for wSOL, future deposits skip those steps. The bootstrap script idempotently checks PDA existence and skips the init call if present.
- The wrap step is per-run since the wSOL ATA is consumed during deposit (transferred to vault).

**Implementation note (informational, not locked):** The four init+deposit actions can either be (a) sent sequentially with confirmation between each, simplifying error attribution, or (b) batched into one or two transactions for atomicity. The implementation plan will choose; for "single blessed run," sequential is fine and arguably better for debugging. Either way, all four actions land before the bootstrap script writes its state JSON.

### Refund amount: bootstrap-time deposit amount

Bootstrap uses 0.01 SOL (10M lamports). Refund script passes the same amount as the second arg to `performVaultRefund(pda, amount)`. The function applies its own 1% safety check against on-chain reality.

**Justification:** Tiny amount keeps blast radius minimal — worst-case loss if everything fails is ~$1.50 + rent (recoverable later by redeploying the vault config or manually closing). The 1% safety check inside `performVaultRefund` will validate the on-chain deposit matches what the agent thinks; we want that check to PASS, so we pass the true deposit amount.

## Architecture

### Component map

```
scripts/
├── recon-devnet-deposits.mjs              # diagnostic: list all DepositRecord PDAs (already written)
├── recon-devnet-vault-tokens.mjs          # diagnostic: list all program-owned accounts (already written)
├── devnet-vault-bootstrap.ts              # NEW: deposit 0.01 SOL, save state
└── devnet-vault-refund-e2e.ts             # NEW: read state, call performVaultRefund, write evidence

scripts/.devnet-vault-bootstrap.json       # NEW: gitignored handoff file (mode 600)

docs/sentinel/evidence/
└── devnet-refund-YYYY-MM-DD.json          # NEW: committed evidence artifact

.gitignore                                  # add: scripts/.devnet-vault-bootstrap.json
```

### Bootstrap script flow

```
load shared devnet keypair from ~/Documents/secret/solana-devnet.json
├─ assert SOL balance ≥ 0.1 (refuse with actionable error if not)
│
verify vault_config + authority match
├─ getAccountInfo(VAULT_CONFIG_PDA) → deserialize → { authority, feeBps, refundTimeout }
├─ assert authority == loaded keypair pubkey
│
ensure vault_token PDA exists for wSOL
├─ deriveVaultTokenPDA(WSOL_MINT) → check getAccountInfo
├─ if NOT exists: call create_vault_token (signed by authority), confirm
│
ensure fee_token PDA exists for wSOL
├─ deriveFeeTokenPDA(WSOL_MINT) → check getAccountInfo
├─ if NOT exists: call create_fee_token (signed by authority), confirm
│
prepare depositor's wSOL ATA + wrap 0.01 SOL
├─ getAssociatedTokenAddress(WSOL_MINT, depositor) → check getAccountInfo
├─ if NOT exists: createAssociatedTokenAccountInstruction
├─ SystemProgram.transfer(depositor → wSOL ATA, 10_000_000 lamports)
├─ createSyncNativeInstruction(wSOL ATA)
├─ batch (create-ATA-if-needed + transfer + sync) into one TX, sign, send, confirm
│
build + send deposit transaction
├─ deriveDepositRecordPDA(depositor, WSOL_MINT)
├─ buildDepositTx(connection, depositor, WSOL_MINT, depositor wSOL ATA, amount=10_000_000n)
├─ tx.sign(authority)
├─ sendRawTransaction(skipPreflight: false, maxRetries: 3)
├─ confirmTransaction(txId, 'confirmed')
│
fetch resulting DepositRecord
├─ getAccountInfo(depositRecordPDA) → deserialize
├─ assert balance == 10_000_000n  (deposit does NOT deduct fee; only withdraw_private does)
│
write state JSON
└─ scripts/.devnet-vault-bootstrap.json (mode 600):
   { vaultProgramId, vaultConfig, depositor, tokenMint: wSOL,
     amount: 0.01, amountLamports: 10_000_000, depositedNet: 10_000_000,
     pda: depositRecordPDA, depositTxId, lastDepositAt, earliestRefundAt,
     depositConfirmedAt, setupTxIds: { vaultToken?, feeToken?, ataAndWrap },
     network: 'devnet' }

print "✓ Deposit recorded. Earliest refund at: <ISO>. Run scripts/devnet-vault-refund-e2e.ts after that time."
```

### Refund script flow

```
read scripts/.devnet-vault-bootstrap.json
├─ bail if missing with actionable message
├─ assert now() ≥ earliestRefundAt; print remaining time + exit 1 if not
│
set process.env.SENTINEL_AUTHORITY_KEYPAIR=~/Documents/secret/solana-devnet.json
set process.env.SOLANA_NETWORK=devnet
│
capture pre-state
├─ preDepositorWSolBalance = getTokenAccountBalance(depositor wSOL ATA)
├─ preDepositRecord        = getAccountInfo(pda) → assert exists, deserialize, capture .balance
│
import { performVaultRefund } from '../packages/agent/src/sentinel/vault-refund.js'
result = await performVaultRefund(pda, amount)
├─ assert result.success === true
├─ assert typeof result.txId === 'string'
│
capture post-state
├─ postDepositorWSolBalance = getTokenAccountBalance(depositor wSOL ATA)
├─ postDepositRecord        = getAccountInfo(pda)  → expect null OR deserialized.balance === 0n
│
compute assertions
├─ txConfirmed         = await confirmTransaction(result.txId, 'finalized')
├─ wSolDelta           = postDepositorWSolBalance - preDepositorWSolBalance
├─ expectedDelta       = preDepositRecord.balance (full pre-refund balance returns to depositor)
├─ balanceIncreased    = wSolDelta == expectedDelta
├─ depositRecordClosed = postDepositRecord === null OR postDepositRecord.balance === 0n
│
on any assertion fail
├─ dump pre/post snapshot to stderr
└─ exit 1, do NOT write evidence

on all assertions pass
└─ write docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json:
   { phase: 'phase-3-devnet-refund-e2e',
     vaultProgramId, vaultConfig, depositor, tokenMint: wSOL, amount,
     deposit:  { txId, confirmedAt, lastDepositAt, depositedNet },
     refund:   { txId, confirmedAt, earliestRefundAt },
     balances: { depositorWSolBefore, depositorWSolAfter, wSolDelta },
     solscan:  { deposit: 'https://solscan.io/tx/...?cluster=devnet',
                 refund:  'https://solscan.io/tx/...?cluster=devnet' },
     assertions: { txConfirmed, balanceIncreased, depositRecordClosed },
     executedBy, executedAt }

print summary table to stdout
```

**Note on refund destination:** The `authority_refund` instruction sends tokens back to `DepositRecord.depositor`'s ATA for the deposit's `tokenMint`. Since we use wSOL, the depositor's wSOL ATA receives the refund, NOT the depositor's native SOL balance. To convert back to native SOL, one would close the wSOL ATA (returns wrapped balance + rent as SOL). This conversion is OUT OF SCOPE for the E2E — the assertion verifies the refund landed in the wSOL ATA, which proves `performVaultRefund` works. Closing the ATA afterward is a manual cleanup step.

### Evidence artifact schema

```json
{
  "phase": "phase-3-devnet-refund-e2e",
  "vaultProgramId": "S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB",
  "vaultConfig": "CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u",
  "depositor": "FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr",
  "tokenMint": "So11111111111111111111111111111111111111112",
  "tokenSymbol": "wSOL",
  "amount": 0.01,
  "amountLamports": 10000000,
  "feeBps": 10,
  "depositedNetLamports": 10000000,
  "setup": {
    "vaultTokenCreatedTxId": "<base58 sig | null if pre-existed>",
    "feeTokenCreatedTxId":   "<base58 sig | null if pre-existed>",
    "ataAndWrapTxId":        "<base58 sig>"
  },
  "deposit": {
    "txId": "<base58 sig>",
    "confirmedAt": "2026-05-04T...Z",
    "lastDepositAt": "2026-05-04T...Z"
  },
  "refund": {
    "txId": "<base58 sig>",
    "confirmedAt": "2026-05-05T...Z",
    "earliestRefundAt": "2026-05-05T...Z"
  },
  "balances": {
    "depositorWSolBefore": "<lamports of wSOL ATA>",
    "depositorWSolAfter":  "<lamports of wSOL ATA>",
    "wSolDelta":           "<lamports>"
  },
  "solscan": {
    "deposit": "https://solscan.io/tx/<sig>?cluster=devnet",
    "refund":  "https://solscan.io/tx/<sig>?cluster=devnet"
  },
  "assertions": {
    "txConfirmed": true,
    "balanceIncreased": true,
    "depositRecordClosed": true
  },
  "executedBy": "RECTOR",
  "executedAt": "2026-05-05T...Z"
}
```

## Error handling

Three failure modes worth being explicit about:

### Bootstrap fails after deposit lands

If the deposit TX confirms but the script crashes before writing state JSON (RPC timeout during PDA fetch, disk error, etc.), the deposit IS on-chain but unrecorded.

**Recovery:** rerun bootstrap with `--resume <depositTxId>` flag. Script fetches the deposit TX, parses out the depositor + record PDA, reconstructs state from on-chain data, writes JSON. No new deposit is made.

If `--resume` is not implemented in time and a crash happens: manual recovery via `scripts/recon-devnet-deposits.mjs` (lists all PDAs with metadata) — operator copies values into state JSON by hand.

### Refund fails the 1% amount-mismatch safety check

`performVaultRefund` throws when `|expected - on-chain|` exceeds 1% tolerance. This is the production safety check we are explicitly testing.

**Behavior:** script catches the throw, dumps `expected vs actual` lamports + the full error to stderr, exits 1. Does NOT write the evidence file. The evidence file is the proof of success — failed runs leave no committed artifact, only debug logs.

### Refund TX submitted but unconfirmed

If `sendRawTransaction` returns a sig but `confirmTransaction` times out, the TX is pending in the mempool. State on-chain is uncertain.

**Behavior:** script polls `confirmTransaction(txId, 'finalized')` with a 60s timeout. On timeout: prints `"TX submitted but unconfirmed: <sig> — check Solscan, may need manual recovery"`, dumps state to stderr, exits 1. No evidence file. Operator checks Solscan; if the TX eventually finalizes, they can re-run the refund script with a `--evidence-only --txId <sig>` flag to skip the send step and just write evidence.

The `--evidence-only` flag is a fallback path; happy-path runs do not use it.

## File hygiene

The two recon scripts written during this design — `scripts/recon-devnet-deposits.mjs` and `scripts/recon-devnet-vault-tokens.mjs` — ship alongside the bootstrap + refund scripts as committed diagnostic utilities. They are useful for Phase 4 prep (mainnet vault deploy will want the same enumeration). Add a one-line header comment to each:

```js
// Diagnostic: list all DepositRecord PDAs on the live sipher_vault program.
// Used by Phase 3 refund E2E for verification + Phase 4 mainnet prep.
```

State file `scripts/.devnet-vault-bootstrap.json` is added to `.gitignore`. Mode 600 enforced by the bootstrap script.

## Open questions

None. All design decisions locked above.

## Acceptance criteria

1. Four scripts present and runnable with `pnpm tsx`:
   - `scripts/recon-devnet-deposits.mjs` (committed, header comment added)
   - `scripts/recon-devnet-vault-tokens.mjs` (committed, header comment added)
   - `scripts/devnet-vault-bootstrap.ts` (new, runs vault_token + fee_token init if needed, wraps SOL → wSOL, runs deposit, writes state JSON)
   - `scripts/devnet-vault-refund-e2e.ts` (new, runs refund via `performVaultRefund`, asserts pre/post, writes evidence artifact)
2. `scripts/.devnet-vault-bootstrap.json` listed in `.gitignore`.
3. Bootstrap script run successfully on 2026-05-04: deposit TX confirmed on devnet, `vault_token` + `fee_token` PDAs initialized for wSOL, depositor wSOL ATA has the wrapped balance, state JSON written.
4. Refund script run successfully on 2026-05-05 (or later): `performVaultRefund` returns `{ success: true, txId }`, all three pre/post assertions pass:
   - `txConfirmed` — refund TX reaches `finalized` commitment
   - `balanceIncreased` — depositor's wSOL ATA balance increases by exactly the pre-refund `DepositRecord.balance`
   - `depositRecordClosed` — `getAccountInfo(pda)` returns null OR the deserialized record's `balance === 0n`
5. Committed evidence artifact `docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json` matches the schema above with all three assertions `true`.
6. CHANGELOG entry in sipher repo: `- Phase 3 (devnet refund E2E) closed — see docs/sentinel/evidence/devnet-refund-YYYY-MM-DD.json (#<PR>)`.
7. Memory updated: `Sipher Project Status` line "Phase 3 (devnet refund E2E)" moves from "long-deferred" to "COMPLETE 2026-05-05".

## Out of scope

- Phase 4 (mainnet `sipher_vault` deploy) — separate spec.
- `update_timeout` Anchor instruction — would let the test be repeatable, but adds program-level scope and audit re-review. Defer until/unless we want recurring E2E.
- Negative-path E2E (pre-timeout reject, unauthorized signer reject) — covered at the program layer in `03-refund.test.ts`.
- Frontend test for the SENTINEL "Cancel & refund" button — UI test, separate scope.
- E2E test for the user-facing `refund` agent tool (depositor-signed, different code path) — separate scope; that flow already has unit coverage and would need its own fixture story.
- Bus event assertions on `sentinel.refund.executed` — already covered in unit tests.
