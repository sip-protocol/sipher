# Phase 4 — Mainnet Sipher Vault Deploy + SIPHER Integration — Design Spec

**Date:** 2026-05-04
**Status:** Approved scope, ready for implementation plan
**Audit phase:** Phase 4 of the 2026-04-18 SENTINEL audit-driven plan (last deferred phase)
**Predecessor specs:** `2026-05-04-phase3-devnet-refund-e2e-design.md` (devnet refund E2E — closes Day 2 the morning before Phase 4 starts)
**Related programs:** `sip_privacy` (already mainnet-live, Mar 7 2026), `sipher_vault` (devnet-live since Mar 31 2026)

## Summary

Deploy the `sipher_vault` Anchor program (with the `withdraw_private` → `sip_privacy.create_transfer_announcement` CPI) to Solana mainnet, integrate with the SIPHER agent, surface a vault tab in the Command Center UI, and announce publicly. Linear 4-day execution: one PR per day, `--merge` style.

```
Day 1 (sip-protocol)              Day 2 (sip-protocol)              Day 3 (sipher)                   Day 4 (sipher + comms)
├ Build CPI binary                 ├ Deploy binary to mainnet        ├ Flip SDK mainnet flag          ├ Command Center vault tab
├ Deploy to devnet (upgrade)       ├ Initialize config (10bps,24h)   ├ Wire agent vault tools         ├ E2E verify on mainnet
├ E2E: deposit → withdraw_private  ├ Smoke test (read config)        │   (deposit, refund, balance)   ├ Public announce (X / TG)
│   → announcement check           ├ Rehearse pause / unpause        │   via mainnet RPC              └ Update memory + SOT docs
├ Update DEPLOYMENT.md (devnet)    ├ Update CLAUDE.md keypair table  └ PR-3 merged
└ PR-1 merged                      └ PR-2 merged
```

After Phase 4 lands, every deferred SENTINEL audit phase is closed. The vault stops being "devnet-only" and becomes the production foundation for `sipher` agentic privacy flows.

## Context

The SENTINEL audit (2026-04-18) enumerated six follow-up phases. Phases 1–6 of the original list have all closed (most recently Phase 6 / Chrome MCP QA on 2026-05-04). Two long-deferred items remain in the audit charter:

- Phase 3 — Devnet refund E2E. Day 1 done in the predecessor session (2026-05-04 morning). Day 2 is scheduled for ≥ 2026-05-05T14:13:14Z, once the on-chain 24h refund timeout elapses; an automated reminder routine pings RECTOR at T-elapsed so the work doesn't slip.
- Phase 4 — Mainnet `sipher_vault` deploy. This spec.

The current devnet `sipher_vault` (program `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`, deployed Mar 31 2026) ships **without** the CPI to `sip_privacy.create_transfer_announcement`. The CPI implementation has been merged to `main` (commit `79133d0`) but never deployed anywhere. Without that CPI, `withdraw_private` transfers tokens but creates no on-chain announcement — recipients have no way to discover their funds without out-of-band signaling, which defeats the whole point of the vault as a privacy primitive.

Phase 4 ships the CPI version to mainnet, wires it into `sipher` (SDK + agent + Command Center UI), and announces. After this lands, agentic privacy flows become a usable product on mainnet, not a devnet demo.

## Goals

1. **Mainnet program live** — `sipher_vault` deployed at the existing `S1Phr5rm…U4kHB` vanity ID with the CPI version of `withdraw_private`.
2. **Mainnet config initialized** — `VaultConfig` PDA created with fee `10` bps, refund timeout `86400` seconds, authority `S1P6j1y…wWMd` (same as `sip_privacy` mainnet).
3. **SIPHER agent uses mainnet** — `VAULT_NETWORK=mainnet-beta` becomes the default in the sipher repo. Agent vault tools (`deposit`, `refund`, `balance`) round-trip against the real mainnet program.
4. **Command Center vault tab live** — `sipher.sip-protocol.org` exposes a vault interface (deposit, balance, refund) reading mainnet state.
5. **Public announcement posted** — X primary, Telegram + Discord secondary.
6. **Real on-chain proof** — at least one mainnet `deposit` + one mainnet `withdraw_private` (with CPI announcement) + one mainnet `authority_refund` executed by RECTOR before announcement, evidence recorded.
7. **Devnet stays consistent** — devnet `sipher_vault` upgraded to the same CPI binary so devnet and mainnet behave identically. (The Phase 3 refund-script will continue to work after upgrade because the refund instruction signature is unchanged.)

## Non-goals

- **External security audit.** The program goes to mainnet without an external audit. The Solana Audit Subsidy V program is on the roadmap but is *not* a Phase 4 prerequisite. Risk explicitly accepted by RECTOR.
- **TVL cap.** The program has no max-deposit guard. Adding one would require a program change and re-audit; out of scope.
- **Token allowlist.** Any SPL token is supported, same as devnet. UI may surface only a subset for ergonomics, but the program imposes no restriction.
- **Multisig authority.** `S1P6j1y…wWMd` is a single-sig authority backed by `~/Documents/secret/authority.json`. Migrating to Squads or similar is out of scope; same trust model as `sip_privacy` mainnet.
- **Production-grade SENTINEL monitoring of mainnet vault.** SENTINEL's current scope (covered in the SENTINEL audit phases) is sipher-internal action gating, not mainnet on-chain monitoring. Wiring SENTINEL to monitor mainnet `sipher_vault` events is a separate future spec.
- **Fee withdrawal automation.** `collect_fee` exists; automating it is out of scope. RECTOR will run it manually as needed.
- **Mobile (`sip-mobile`) integration.** Phase 4 ships web (Command Center) only.
- **Marketing assets** beyond the announcement post (no landing page redesign, no demo video, no documentation rewrite). Those can come after.

## Decisions Locked

### D1 — Scope: full production (deploy + agent + UI)

Phase 4 is "done" only when the program is live, the agent uses it, and a real user can deposit through `sipher.sip-protocol.org`. Deferring agent/UI work to a later phase was rejected — the program alone has no consumer.

### D2 — Posture: full public launch + announce

Deploy unpaused, integrate, post a public announcement on X (primary) and Telegram/Discord (secondary). Rejected alternatives: deploy-paused-then-unpause (recommended for unaudited code, but RECTOR explicitly chose maximum velocity); stealth launch (no announce); audit-first (4–6 week delay).

This decision is high-risk for unaudited code holding real funds. Section "Risks → mitigations" enumerates how each risk is bounded.

### D3 — Sequencing: devnet upgrade → mainnet deploy

The CPI version goes to devnet first, runs an E2E test on devnet, then ships to mainnet. Rejected: direct-to-mainnet (saves ~half a day, surfaces CPI bugs on mainnet with real funds) and devnet-only-this-phase (defers mainnet to Phase 5, contradicts the "agent + UI" scope).

### D4 — Config parameters: same as devnet

`fee_bps = 10`, `refund_timeout = 86400` seconds (24 hours). Rejected alternatives: higher fee (25 or 50 bps) and longer timeout (48–72h). Rationale: consistency lowers cognitive load and matches the Phase 3 evidence we already have. `update_fee` exists if we want to change the fee later; refund timeout is set-once at init, so it's worth getting right the first time, but 24h is the well-tested default.

### D5 — Authority: reuse `sip_privacy` mainnet authority

`S1P6j1y…wWMd` (from `~/Documents/secret/authority.json`). Same authority across both SIP mainnet programs simplifies key management and matches the existing trust model. Rejected: a new vault-only keypair (smaller blast radius if compromised, but adds a key to manage); cipher-admin wallet (couples vault authority with admin login).

## Architecture

### Stages

| Stage | Repo | Outputs | PR proves |
|---|---|---|---|
| 1 | `sip-protocol/sip-protocol` | CPI binary built, deployed to devnet, E2E pass | Withdraw_private creates a real `transfer_record` on devnet `sip_privacy` |
| 2 | `sip-protocol/sip-protocol` | Mainnet program live, config initialized | `getAccountInfo(config)` returns expected fee / timeout / authority on mainnet |
| 3 | `sip-protocol/sipher` | SDK mainnet flag flipped, agent tools verified | At least one mainnet round-trip via Sipher REST API |
| 4 | `sip-protocol/sipher` | Vault tab on Command Center, public announce | UI displays mainnet TVL / balance; announcement live |

### Why linear (Approach A) over parallel (B) or phased (C)

PR-2 is the pivot. Until it merges and the mainnet config PDA exists, no downstream work can validate against real mainnet state. Parallel staging (writing SDK changes on a feature branch before mainnet exists) saves ~25% wall-clock but costs disproportionately in PR-sequencing risk: if devnet E2E surfaces a CPI bug, parallel SDK work might need rework. Phased rollout (4 weeks, soak between stages) was rejected as over-cautious for the chosen public-launch posture.

### Cross-program dependency

| Dep | Mainnet program ID | Status |
|---|---|---|
| `sip_privacy` | `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` | Already mainnet-live (Mar 7 2026) |
| `sipher_vault` | `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` | To deploy in Stage 2 |

The CPI target already exists on mainnet — no additional deploys required. The hardcoded program ID at `lib.rs:30-33` matches the deployed `sip_privacy` byte-for-byte. Pre-deploy checklist verifies this.

## Components per stage

### Stage 1 — devnet upgrade (sip-protocol repo)

| File | Action | Purpose |
|---|---|---|
| `programs/sipher-vault/programs/sipher-vault/src/lib.rs` | rebuild | CPI code already present (commit `79133d0`); no source change |
| `programs/sipher-vault/scripts/upgrade-devnet.ts` | new | `solana program deploy --program-id <vanity>` against devnet, verify deployed slot |
| `programs/sipher-vault/scripts/e2e-cpi-test.ts` | new | Real on-chain: deposit → withdraw_private → confirm `sip_privacy.TransferRecord` PDA on devnet |
| `programs/sipher-vault/scripts/set-paused.ts` | new | Helper for emergency pause / unpause; rehearsed against devnet first |
| `programs/sipher-vault/DEPLOYMENT.md` | update | Append devnet upgrade section with timestamps, slot, evidence |
| `CHANGELOG.md` (root) | update | Phase 4 Stage 1 entry |

### Stage 2 — mainnet deploy (sip-protocol repo)

| File | Action | Purpose |
|---|---|---|
| `programs/sipher-vault/Anchor.toml` | update | Add `[programs.mainnet]` entry with the S1Phr ID |
| `programs/sipher-vault/scripts/deploy-mainnet.ts` | new | Atomic deploy + initialize: build → deploy → wait for confirmation → call `initialize` ix in same script run, no announce window |
| `programs/sipher-vault/scripts/smoke-mainnet.ts` | new | Read-only mainnet verification: config exists, fee/timeout/authority correct, program data slot matches |
| `programs/sipher-vault/DEPLOYMENT.md` | update | Append mainnet section: program ID, config PDA, deploy slot, init TX, smoke results |
| `CLAUDE.md` (root) | update | Add mainnet `sipher_vault` row to keypair / deployment tables |
| `CHANGELOG.md` (root) | update | Phase 4 Stage 2 entry with mainnet TX links |

### Stage 3 — SDK + agent (sipher repo)

| File | Action | Purpose |
|---|---|---|
| `packages/sdk/src/config.ts` | edit | Add `mainnet-beta` cluster constants; default network → `mainnet-beta` |
| `packages/sdk/src/connection.ts` | edit | Mainnet RPC endpoint handling (Helius primary) |
| `packages/sdk/tests/vault.mainnet.test.ts` | new (gated) | Live mainnet smoke test, `describe.skipIf(!process.env.TEST_MAINNET)` |
| `packages/agent/src/services/vault-deposit.ts` | edit | Read `VAULT_NETWORK` env, default `mainnet-beta` |
| `packages/agent/src/services/vault-refund.ts` | edit | Same env-driven switch |
| `packages/agent/.env.example` | edit | New `VAULT_NETWORK=mainnet-beta` line; comments explaining devnet override |
| `CHANGELOG.md` | update | Stage 3 entry |
| `CLAUDE.md` (sipher repo) | update | Vault network defaults, env table |

### Stage 4 — UI + announce (sipher repo)

| File | Action | Purpose |
|---|---|---|
| `app/src/views/Vault.tsx` | new (or extend) | Command Center vault tab |
| `app/src/components/VaultDepositCard.tsx` | new | Token + amount input, deposit button |
| `app/src/components/VaultBalanceCard.tsx` | new | TVL + per-depositor balance display |
| `app/src/components/VaultRefundCard.tsx` | new | Refund eligibility + button |
| `app/src/store/vault.ts` | new | Zustand store: balance, deposit history, mainnet refresh |
| `app/src/router.tsx` (or layout) | edit | Add vault route to Command Center navigation |
| `CHANGELOG.md` | update | Stage 4 entry with announcement metadata |
| `CLAUDE.md` (sipher repo) | update | Mark Phase 4 complete; reference announcement |

## Data flow — what the CPI buys us

```
DEPOSITOR → sipher_vault.deposit(amount, mint)
  ├ tokens: depositor_ata → vault_token PDA
  ├ writes: DepositRecord PDA  (balance, last_deposit_at)
  └ emits: DepositEvent

DEPOSITOR → sipher_vault.withdraw_private(
                amount, mint, stealth_recipient,
                commitment, ephemeral_pubkey
            )
  ├ debits: DepositRecord.balance -= amount        (debit-first per program design)
  ├ fee:    amount * fee_bps / 10000 → fee_token PDA
  ├ tokens: vault_token PDA → recipient_ata
  ├ CPI →  sip_privacy.create_transfer_announcement(commitment, ephemeral_pubkey)
  │         └ writes TransferRecord PDA on sip_privacy
  └ emits: WithdrawPrivateEvent
                 ↓
RECIPIENT (offline) → sip_privacy.scanAnnouncements(viewingKey)
  └ finds the TransferRecord → decrypts → calls sipher_vault to claim ownership
```

Today's devnet `withdraw_private` transfers tokens but does **not** create the announcement. Recipients must rely on out-of-band signaling. Phase 4's CPI version closes the loop: a single TX produces both the transfer and the on-chain announcement.

## Configuration parameters (mainnet `initialize` ix)

| Param | Value | Notes |
|---|---|---|
| `fee_bps` | `10` | 0.1 % per `withdraw_private`. Mutable post-init via `update_fee`. |
| `refund_timeout` | `86400` (seconds) | 24h. **Set-once** — no `update_refund_timeout` instruction exists in the program today. Must be exact at init. |
| `authority` | `S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd` | Same as `sip_privacy` mainnet. |
| `paused` | `false` | Hardcoded `false` in `initialize`. Public-launch posture: no pre-pause. Emergency pause via `set_paused` ix is rehearsed on devnet first. |

## Risks → mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Mainnet config PDA front-run between deploy and init | High | `deploy-mainnet.ts` is atomic: deploy → initialize in the same run, no announcement window |
| R2 | CPI to `sip_privacy` fails on mainnet (program ID mismatch) | High | Stage 1 devnet E2E catches this; pre-deploy step asserts `lib.rs:30-33` byte-for-byte matches deployed `sip_privacy` |
| R3 | Critical bug surfaces post-launch with TVL on it | High | Pause-flag rehearsal on Day 1; emergency runbook in `DEPLOYMENT.md`; `authority_refund` available after 24h |
| R4 | Authority key compromised | Critical | Existing trust model: `authority.json` iCloud-encrypted + Bitwarden backup. Same as `sip_privacy` mainnet, accepted risk. |
| R5 | Wrong fee or timeout at init (typo, off-by-one) | Medium | `deploy-mainnet.ts` asserts integer literals before sending the ix; fail loudly if anything mismatches |
| R6 | Real user loss in early hours | High | 1–4h post-deploy soak before public announce, even though scope is "public launch" |
| R7 | RPC outage breaks SDK / agent | Low | SDK already supports multiple RPC providers (Helius / QuickNode / Triton) |
| R8 | Deploy fails mid-upload (insufficient SOL or RPC stall) | Medium | `solana program deploy` is resumable via the buffer account; `DEPLOYMENT.md` documents the recovery command |
| R9 | Anchor build artifacts stale | Low | Stage 2 script: `anchor clean && anchor build` before deploy |
| R10 | Devnet upgrade breaks Phase 3 evidence (existing `DepositRecord` PDA) | Low | The deposit/refund instruction signatures are unchanged in the CPI version; only `withdraw_private` got the CPI added. Phase 3's existing devnet `DepositRecord` continues to work, refund script unaffected. |

## Pre-deploy checklist (Stage 2 mainnet)

Before `solana program deploy --url mainnet-beta`:

1. All anchor tests pass: `anchor test` returns 0 (currently 17 unit + 3 authority_refund = 20 tests)
2. `Anchor.toml` `[programs.mainnet]` entry added with `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`
3. Authority wallet `S1P6j1y…wWMd` has ≥10 SOL (deploy ~5–7 SOL + buffer)
4. Vanity keypair `~/Documents/secret/sipher-vault-program-id.json` matches the expected ID — `solana address -k <file>` returns `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` exactly
5. Hardcoded `sip_privacy` program ID at `lib.rs:30-33` matches deployed mainnet `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` byte-for-byte
6. Stage 1 (devnet) E2E completed within the last 24h with green output
7. `set-paused.ts` rehearsed end-to-end on devnet (pause → confirm `paused=true` → unpause → confirm `paused=false`)
8. `~/Documents/secret/authority.json` (deployer) reachable; `solana balance --keypair <file>` succeeds
9. Anchor toolchain version verified: `anchor --version` returns `0.30.1`
10. RPC endpoint reachable: `solana cluster-version --url mainnet-beta` succeeds

If any check fails, do not deploy. Fix or escalate.

## Rollback per stage

| Stage | Failure mode | Rollback |
|---|---|---|
| 1 (devnet upgrade) | E2E test fails | Source-revert the offending commit, redeploy old binary OR fix-forward. Devnet has no real funds — low cost. |
| 2 (mainnet deploy) | `initialize` ix fails | Config PDA does not yet exist → no funds at risk → rerun init with corrected params. |
| 2 (mainnet deploy) | Smoke test reveals critical bug, no deposits yet | `set_paused(true)` immediately. Investigate. Do not announce. |
| 2 (mainnet deploy) | Critical bug after first deposits | `set_paused(true)` blocks new deposits. Existing depositors must wait 24h, then `authority_refund` returns funds. Communicate publicly with TX evidence. |
| 3 (sipher SDK + agent) | Mainnet round-trip test fails | Revert PR. `VAULT_NETWORK=devnet` remains the safe default until fixed. |
| 4 (UI + announce) | UI bug or wrong announcement copy | Revert UI PR. Edit / delete announcement on X / TG within minutes of posting. |

## Emergency pause runbook

To be rehearsed against devnet on Day 1, then ready to fire on mainnet from Day 2 onwards.

```bash
# Pause sipher_vault mainnet (blocks new deposits and withdraw_private; refund/authority_refund still work)
ANCHOR_WALLET=~/Documents/secret/authority.json \
ANCHOR_PROVIDER_URL=https://api.mainnet-beta.solana.com \
pnpm exec tsx programs/sipher-vault/scripts/set-paused.ts true

# Verify
solana account <CONFIG_PDA> --output json --url mainnet-beta | jq '.account.data'
# decode → assert paused=true

# Unpause
ANCHOR_WALLET=~/Documents/secret/authority.json \
ANCHOR_PROVIDER_URL=https://api.mainnet-beta.solana.com \
pnpm exec tsx programs/sipher-vault/scripts/set-paused.ts false
```

The script will be written and rehearsed on devnet during Stage 1 so the exact command is known to work before mainnet has any TVL.

## Testing per stage

| Stage | Test | What it proves |
|---|---|---|
| 1 | `anchor test` (20 unit + integration) | Logic correct, no regressions vs current mainnet |
| 1 | `scripts/e2e-cpi-test.ts` on devnet | Full CPI round-trip: deposit → withdraw_private creates a real `sip_privacy.TransferRecord` PDA, scan finds it, claim succeeds |
| 1 | `scripts/set-paused.ts true / false` rehearsal | Emergency pause works end-to-end on devnet |
| 2 | `scripts/smoke-mainnet.ts` (read-only) | Mainnet config PDA exists; fee=10, timeout=86400, authority=`S1P6j1y…wWMd` |
| 2 | RECTOR runs `deposit` of 0.001 SOL via raw script | One real on-chain mainnet deposit lands; `DepositRecord` PDA created |
| 2 | RECTOR runs `withdraw_private` of the 0.001 SOL via raw script | Mainnet CPI produces real `TransferRecord` on `sip_privacy` mainnet |
| 2 | RECTOR runs `authority_refund` (after 24h wait, or in a follow-up session) | The refund path also works on mainnet |
| 3 | `pnpm test -- --run` (sipher repo) | Existing 1300+ agent tests + 555+ REST tests still green |
| 3 | New gated test `vault.mainnet.test.ts` (`TEST_MAINNET=1`) | SDK `getVaultBalance()` reads live mainnet config |
| 3 | Agent REST round-trip via curl | `POST /agent/tools/deposit` with mainnet network → real TX hash returned |
| 4 | Manual UI walk on `sipher.sip-protocol.org` | Vault tab loads, balance reads, deposit form submits, TX shown |
| 4 | Reviewer dry-read of announcement copy | Tone matches RECTOR's voice; no broken links; risks disclosed |

## Success metrics — definition of done

**Objective (binary, verifiable on the day):**

1. Mainnet `sipher_vault` program live at `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` — `solana program show <ID> --url mainnet-beta` returns the deployed slot.
2. Mainnet `VaultConfig` PDA initialized — `getAccountInfo` returns the expected struct (fee=10, timeout=86400, authority=`S1P6j1y…wWMd`, paused=false).
3. ≥1 mainnet `deposit` + ≥1 mainnet `withdraw_private` (with CPI announcement on `sip_privacy`) + ≥1 mainnet `authority_refund` executed by RECTOR. Any token, any amount — even 0.001 SOL is sufficient.
4. Sipher repo: `VAULT_NETWORK=mainnet-beta` is the default in `.env.example`; `pnpm test` green.
5. Command Center vault tab visible at `sipher.sip-protocol.org` (logged in as cipher-admin), reads real mainnet TVL.
6. Public announcement posted (X primary; TG / Discord secondary).
7. CHANGELOG entries committed in both repos.
8. MEMORY updated: mainnet `sipher_vault` program + config PDA recorded; "Phase 4 still deferred" replaced with "Phase 4 COMPLETE [date]".

**Lagging (assess at +7 days):**

- No funds stuck (no `set_paused(true)` activated).
- No critical bugs reported.
- ≥3 unique mainnet depositors (organic interest signal — could be friends/team for a soft launch).

**Explicitly not measured:**

- TVL targets — vanity metric that pressures scope creep.
- Twitter engagement — out of our control, doesn't reflect program quality.
- Number of integrations / downstream consumers — long-tail, not a 7-day signal.

## Soft-launch buffer inside Stage 4

Even though the launch posture is "public + announce," a tight soak buffer is built into the schedule. The buffer is measured **in hours after Stage 2 mainnet deploy**, not in calendar days, because Stage 3 + Stage 4 implementation can compress or stretch.

1. **T+0h:** Stage 2 done (mainnet program live + config initialized). Calendar: Day 2.
2. **T+1–4h:** Internal smoke (RECTOR + CIPHER deposits, claims, refunds via raw scripts and via Sipher agent). Catches obvious bugs that pure unit tests miss. Calendar: Day 2 evening.
3. **T+4–24h:** Stage 3 lands (SDK + agent), Stage 4 UI work in progress. Vault tab can go live in this window but **no announcement push yet**. Calendar: Day 3 → Day 4.
4. **T+≥24h, all stages green:** Public announcement on X / TG / Discord. Earliest calendar slot is end of Day 3; realistically lands Day 4 evening or Day 5 morning. The announcement does not block on the 24h being a hard cutoff — it blocks on (a) all four stage PRs merged, (b) at least one full deposit→withdraw_private→authority_refund cycle witnessed on mainnet, and (c) no critical bugs in the smoke window.

This is **not** Approach C's 4-week phased rollout. It is a 4–24 hour "prove it works in production at $5 of TVL before you invite $5K of TVL" buffer. If the buffer is uncomfortable, Stage 4's announcement can land same-day after smoke (T+4–8h); if a bug surfaces during the buffer, the announcement is held and the bug is fixed before any external comms.

The architecture diagram at the top of this spec shows announcement on Day 4 because that is the earliest realistic landing slot once Stages 1–4 have shipped sequentially. The actual announcement timing is gated on the three conditions above, not on a calendar date.

## Out of scope (already covered in non-goals, restated for clarity)

- External audit (subsidy program tracking continues separately).
- TVL / max-deposit guards.
- Token allowlist at the program level.
- Multisig authority migration.
- SENTINEL on-chain monitoring of the mainnet vault.
- Automated `collect_fee`.
- `sip-mobile` integration.
- Marketing assets beyond the announcement post.

## Open questions

None. All clarifying questions resolved during brainstorm; decisions D1–D5 captured above.
