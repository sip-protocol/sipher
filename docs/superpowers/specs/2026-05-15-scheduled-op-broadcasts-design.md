# Scheduled-Op Broadcasts (drip / splitSend / sweep / consolidate / recurring / scheduleSend) — Design

**Date:** 2026-05-15
**Session:** frontier_sip_13
**Status:** Proposed — awaiting RECTOR review
**Predecessor:**
  - README emission table: `packages/agent/src/integrations/torque/README.md:129` — "Scheduled-op broadcasts not yet wired. Needs wallet-delegation or pre-signed-batch design — separate follow-up."
  - Existing crank: `packages/agent/src/crank.ts:99-113` — COURIER ticks every 60s and calls `executeTool(op.action, op.params)`
  - Existing tools that write `scheduled_ops` rows but don't actually broadcast: `tools/drip.ts`, `tools/splitSend.ts`, `tools/sweep.ts`, `tools/consolidate.ts`, `tools/schedule-send.ts`, `tools/recurring.ts`
  - Trust boundary anchor: server can't sign as the user; user can't be online forever
**Scope:** Define broadcasting paths for each scheduled-op tool, classified by execution horizon (immediate batch / time-bounded / indefinite). Recommend per-tool execution strategies. Specify the on-chain delegation contract (or use of existing Squads Smart Account) for indefinite ops. Spec the durable-nonce flow for time-bounded ops. Out-of-scope: writing the on-chain delegation program; refining the UX flows for delegation approvals; mainnet rollout decisions.
**Out of scope:** Cross-chain scheduled ops (Ethereum); fiat-denominated triggers; price-conditional sends; full Squads integration (separate sip-arcium-style spec).
**Estimated work-time:** 3 PRs minimum across 2-3 weeks. PR-A: durable-nonce path for scheduleSend + drip + splitSend. PR-B: delegation contract + sweep + recurring. PR-C: COURIER hardening + observability.

---

## Why this build

**The shape of the problem.** A scheduled op is a promise to broadcast a Solana transaction at a future time. Solana transactions must be signed by all required signers. The user IS one of those signers (fee payer or stealth-source). The server is NOT — and shouldn't be, by default. Yet the user is rarely online at the precise moment the op fires.

This is a classic key-availability problem. Three families of solutions exist:

| Family | Mechanism | Trust delegated | Horizon |
|---|---|---|---|
| **Immediate batch** | Sign N txs back-to-back within one user session | None new | Minutes |
| **Pre-signed durable nonce** | User signs N future txs at create time, each anchored to a single-use durable nonce so blockhash never expires | None — txs are immutable post-sign | Hours to weeks |
| **Wallet delegation** | User grants a scope-limited authority to a server-controlled key (PDA or Squads Smart Account); server signs within that scope | Bounded — scope, time, amount | Indefinite |

The current sipher implementation persists scheduled ops to SQLite but the crank's executor (`executeTool`) routes through the tool-signing wrapper, which awaits the user to sign — and times out after 5 minutes when the user isn't there. So all scheduled ops "fail" silently after 5 min of crank ticking.

**What this spec delivers.** A per-tool classification of which family applies, plus a concrete design for each family. PR-A targets the time-bounded family (durable nonce) — this unblocks 4 of the 6 scheduled tools. PR-B targets indefinite (delegation). PR-C hardens the COURIER for unattended operation (retries, observability, deduplication).

---

## Per-tool classification

| Tool | Op intent | Horizon | Recommended family |
|---|---|---|---|
| `splitSend` | Split a single logical send into N small txs for privacy/obfuscation | Minutes (all within one session) | **Immediate batch** |
| `consolidate` | Collect dust + stealth balance into main wallet | Minutes (one session) | **Immediate batch** |
| `scheduleSend` | Send X tokens at a specific future time | Hours to days | **Pre-signed durable nonce** |
| `drip` | DCA-style — distribute X tokens over N days in M chunks | Days | **Pre-signed durable nonce** |
| `sweep` | Auto-shield incoming wallet funds, on each detected deposit | Indefinite | **Wallet delegation** |
| `recurring` | Send X tokens every K days, forever | Indefinite | **Wallet delegation** |

---

## Family A: Immediate batch (splitSend, consolidate)

### How it works

User invokes splitSend. Server builds N transactions immediately (recent-blockhash-based; ~60s validity per tx). Frontend renders an "approve all" SignTxCard variant that walks the user through N consecutive signatures (or — preferred — uses a wallet adapter's `signAllTransactions(txs)` to batch-prompt). Each signed tx is broadcast in sequence (with small delay for privacy obfuscation).

### Why this works for these tools

splitSend's whole point is fragmenting one user-driven send. The user is online by definition. They can sign all N within minutes. Same for consolidate — it's a one-shot housekeeping action triggered manually.

### What changes

1. **Tool result** — splitSend returns an array of `serializedTx` strings (not a single tx). New result shape:
   ```ts
   {
     action: 'splitSend',
     status: 'awaiting_signature',
     serializedTxs: string[],         // N base64 txs
     batchId: string,                 // server-side correlation
     // existing fields ...
   }
   ```

2. **SignTxCard batch mode** — frontend gains a "sign all" UI that calls `wallet.signAllTransactions(txs)`. The card shows a single Approve button + a progress strip (3/5 signed, broadcasting...).

3. **Promise gate** — extend `pending-signing.ts` to handle batches: one flagId, N signatures expected. Confirm route posts the array; reject any if any sig is missing.

4. **Growth-hook emission** — emit `sipher_private_split_send_completed` ONCE per batch, with `tx_signature` = the first tx's signature (arbitrary anchor) plus a new `batch_size` field. (Schema change to Torque dashboard event definition — operator action.)

### Risks

- **Mid-batch failures.** If tx 3 of 5 lands but txs 4-5 expire (blockhash), the user has partially executed a split. Acceptable for splitSend's privacy intent (some chunks went through). Mitigation: server broadcasts in parallel-with-rate-limit; refetch blockhash between txs.
- **Wallet UX.** Some wallets refuse multi-sign (Backpack supports it, Phantom historically iffy). Mitigation: feature-detect; fall back to N-prompts with a polished UI.

---

## Family B: Pre-signed durable nonce (scheduleSend, drip)

### Background on Solana durable nonces

A nonce account is a Solana account that stores a "durable" blockhash that never expires. A transaction can reference the nonce account in place of `recentBlockhash`, and the nonce program's `AdvanceNonceAccount` instruction must be the first instruction in the tx. Each nonce account is single-use — advancing consumes its current nonce; future txs need re-initialized nonces or new accounts.

Rent: each nonce account ~0.0015 SOL minimum balance. For a 30-day drip with daily chunks (N=30), the user pays ~0.045 SOL up front for nonce accounts. Acceptable.

### How it works

```
User invokes drip(amount=10 SOL, days=7, recipient=rector.sol)
   │
   ▼
Server splits into 7 chunks, generates 7 nonce-account public keys
   │
   ▼
Server builds 7 transactions, each:
   - ix[0]: AdvanceNonceAccount(nonce_i)
   - ix[1]: stealth send (sip_privacy program)
   - referencing nonce_i instead of recent_blockhash
   │
   ▼
Returns to client: {
   serializedTxs: [7 base64 txs],   // unsigned
   nonceAccounts: [7 pubkeys],
   nonceInitInstructions: [...]     // to create+seed the 7 nonces
}
   │
   ▼
Frontend SignTxCard "schedule batch":
   - Sign-and-broadcast the nonceInit batch FIRST (creates+seeds 7 nonce accounts on-chain)
   - User signs all 7 drip txs WITHOUT broadcasting; signed txs returned to server
   │
   ▼
POST /api/scheduled-ops/:opId/seal { signedTxs: [7 base64 signed-but-not-broadcast] }
   │
   ▼
Server persists signed txs in scheduled_ops table (new column: signed_tx)
   │
   ▼
COURIER tick: for each op whose next_exec ≤ now AND status === 'sealed':
   - submit signed_tx to RPC
   - on confirm: status='completed', emit growth-hook
   - on transient fail: leave 'sealed', retry next tick
   - on permanent fail (nonce already consumed): status='failed'
```

### Why this works

The user's signature is captured ONCE at create time. The signed tx is bytes-immutable. The server stores and broadcasts; can't tamper without invalidating the signature. The nonce makes the tx valid indefinitely (until the nonce is advanced).

### Trust analysis

| Concern | Defended? |
|---|---|
| Server modifies tx before broadcast | No — signature breaks |
| Server delays broadcast | Yes (cosmetic only); user can cancel any time |
| Server reorders broadcasts | Cosmetic; each tx is independent |
| Server replays a tx | Nonce single-use prevents on-chain |
| Server censors a tx | Yes (out-of-band: user can broadcast manually if they have the signed tx) |
| Server leaks signed txs | Severe — would allow front-running. Mitigation: encrypt-at-rest, viewing-key-scoped. |

### What changes

1. **scheduled_ops table** — add columns: `signed_tx: BLOB`, `nonce_account: TEXT`, `op_kind: 'awaiting_seal' | 'sealed' | 'pending' | ...`

2. **Tool flow** — drip / scheduleSend return both `serializedTxs` (unsigned) AND `nonceInitInstructions` for the user to broadcast first. After nonce init confirms, user signs the drip txs and posts to a NEW endpoint `POST /api/scheduled-ops/:batchId/seal`.

3. **Crank executor** — for `op_kind === 'sealed'` ops, the executor reads `signed_tx` and broadcasts directly via `connection.sendRawTransaction(signed_tx, { skipPreflight: true, maxRetries: 3 })`. No tool-signing wrapper involvement.

4. **Cancellation** — new tool `cancelScheduledOp(opId)` builds a tx that calls Solana's `nonce.withdraw` instruction, draining the nonce account back to the user (also invalidates the pending signed_tx since the nonce is gone).

### Risks

- **Nonce setup complexity.** First-time user pays 0.045 SOL for 30 nonce accounts. UX friction. Mitigation: pool nonces across ops; recycle after consumption.
- **Signed-tx storage.** SQLite blobs in the agent server. Encrypt-at-rest via OS-level disk encryption (already true on VPS). Memorialize the storage-sensitivity in CLAUDE.md / README.
- **Recipient changes.** If recipient's stealth meta-address rotates between create and broadcast, the broadcast still targets the OLD address. Mitigation: nonce-based pre-signing pins stealth addresses; document trade-off.
- **Recent-mainnet-rent-spike.** If Solana raises rent, future broadcasts may fail because the tx allocates a stealth ATA with insufficient lamports. Mitigation: include rent-buffer (small extra SOL) in the original tx.

---

## Family C: Wallet delegation (sweep, recurring)

### Two options

**C.1 — Custom delegation program** (clean privacy alignment, more build cost):

A new on-chain program `sipher_delegation` exposes:
- `create_delegation(scope, max_amount, valid_until, allow_list)` — user creates a delegation PDA with strict scope
- `execute_delegated_send(amount, recipient, commitment)` — server signs as delegation PDA's "operator"; program validates scope+amount+allow_list+expiry
- `revoke_delegation()` — user pulls back, refunds remaining

Pros: scope tailored to sipher's stealth send needs (Pedersen commitment + stealth address routing). Privacy posture stays clean.
Cons: another on-chain program to maintain + audit; 4-8 weeks of build.

**C.2 — Squads Smart Account integration** (existing infra, less control):

Use Squads' Smart Account Program (referenced in [[solana-defi:squads]] skill). User creates a Smart Account with sipher operator added as a "spending member" with custom spending limits. Server signs transactions as the spending member; Smart Account program enforces the limit logic.

Pros: production-tested, audited. No new program. Squads UI for user to monitor and revoke.
Cons: less alignment with sipher's privacy primitives — Smart Account is a transparent on-chain entity, defeats some privacy gains; spending limit semantics may not perfectly model sipher's needs.

**Recommendation:** Start with C.2 (Squads) to ship sweep+recurring quickly. Migrate to C.1 (custom) when sipher_arcium or other in-house programs mature enough to justify the build. Tracking issue should explicitly call this out as a deliberate phasing.

### What changes (assuming C.2)

1. **New onboarding step for sweep/recurring** — first invocation in a user's session prompts them to:
   - Create a Squads Smart Account (or link existing)
   - Add sipher's operator pubkey as a spending member with caps tailored to the requested op
   - Approve via Squads UI in a popup or redirect

2. **scheduled_ops execution** — for `op_kind === 'delegated'`, crank invokes a path that:
   - Loads the user's Smart Account + spending member config
   - Builds the transaction (stealth send / sweep / etc.)
   - Server signs with the sipher operator key
   - Broadcasts; on success, growth-hook fires; on Smart Account rejection (limit exceeded, revoked), update op status accordingly

3. **Operator key management** — sipher needs a per-deployment operator keypair (mainnet, devnet). Stored in VPS secrets, never committed. Rotation procedure documented.

### Risks

- **Operator key compromise.** If sipher's mainnet operator key leaks, ALL delegated wallets are exposed within their spending limits. Mitigation: HSM/KMS for prod; small rotating per-day operators; alert on any out-of-scope tx attempts.
- **User trust ceiling.** Delegation = real trust. Many users won't grant it. That's fine — sweep+recurring become opt-in premium features.
- **Smart Account UX friction.** Squads' Smart Account creation is a non-trivial flow. Some users won't complete it. Mitigation: clear UX scaffolding; show value upfront.

---

## COURIER hardening (PR-C)

Today's crank works at a coarse level but isn't production-hardened. Issues:

1. **No retries on transient failures.** A network blip during broadcast marks the op `pending` again, but the next tick will retry immediately — no backoff. Could DOS the RPC during outages.

2. **No deduplication.** If crank ticks while a previous tick's executor is still mid-broadcast, duplicate broadcasts can hit the chain (Solana dedupes by signature, but it's wasteful).

3. **Limited observability.** Only one line per tick. No per-op latency, no growth-hook emission correlation, no failure-rate dashboard signal.

4. **Race conditions on op_status.** Two cranks in parallel (e.g. multi-process deploy) could both pick up the same op. Status update is the dedupe mechanism but isn't atomic-CAS today.

### Improvements

- Exponential backoff per op: `next_exec` = `now + min(max_backoff, base * 2^attempts)`
- Single-flight per op: lock by op-id in a Map for the duration of a tick
- Structured logging: emit per-op start/end events with latency + result
- Atomic status CAS: SQLite `UPDATE ... WHERE status='pending'` returning rowcount, only proceed if rowcount=1
- Metrics endpoint: `GET /admin/api/courier/stats` — last-N-tick summary

---

## Test plan (per PR)

### PR-A (durable nonce family)

- [ ] Unit: drip/scheduleSend produce N valid unsigned txs anchored to N nonce accounts
- [ ] Unit: nonce init instructions produce txs that correctly create + seed nonce accounts
- [ ] Unit: `POST /api/scheduled-ops/:batchId/seal` rejects mismatched batchIds, accepts valid signed batches, persists signed_tx blobs
- [ ] Integration: full devnet flow — drip(N=3) → user signs nonce init → confirms → user signs drip txs → posts seal → crank picks up + broadcasts each at scheduled time
- [ ] Tests for cancel: nonce withdrawal invalidates pending signed_tx
- [ ] E2E: simulate a 3-day drip with `next_exec` set to ~1 minute apart; verify all 3 txs land

### PR-B (delegation family — Squads C.2)

- [ ] Onboarding integration test: invoke sweep without existing Smart Account → server returns onboarding instructions
- [ ] Unit: sweep tool builds correct Smart Account txn (spending member with caps matching tool input)
- [ ] Integration: sweep on devnet — user authorizes via Smart Account → crank fires on incoming deposit → stealth send confirms
- [ ] Tests for spending-limit edge cases (over-limit attempt fails cleanly)
- [ ] Tests for revocation — user revokes via Squads → next crank tick fails with `delegation_revoked` reason → op transitions to `cancelled`

### PR-C (COURIER hardening)

- [ ] Unit: exponential backoff increases between failed ticks
- [ ] Unit: single-flight lock prevents concurrent execution of the same op
- [ ] Integration: simulated multi-tick race; verify only one broadcast occurs
- [ ] Stats endpoint returns sane summary

### Cross-PR regression

- [ ] All existing scheduled-op creation tests still pass
- [ ] Growth-hook receives correct emission events per family (`sipher_private_send_completed` for sweep, `sipher_private_split_send_completed` for splitSend, `sipher_private_drip_completed` for drip)
- [ ] [[2026-05-15-server-side-sig-verification-design]] verifier runs against scheduled-op confirms — different path (server-broadcast, so no client signature to verify); audit verifier compatibility

---

## Risks

**Trust delegation is real money risk.** Family C is irreducibly a trust delegation. Even with scope+caps, a compromised sipher operator key drains delegated wallets within caps. Mitigation: HSM, rotation, alerts. Treat operator key like a vault key — minimal access, audit logs.

**Signed-tx blob leakage.** Family B persists signed txs in SQLite. Server compromise = pre-signed broadcasts an attacker could publish (front-running, censorship). Mitigation: encrypt-at-rest on VPS (already standard), audit OS-level access, document the trust surface.

**Privacy regression.** Family C with Squads makes the user's stealth-send linkable to their public Smart Account (the account that delegated). This partially defeats sipher's privacy goal. Mitigation: messaging — sweep / recurring are convenience features with privacy trade-offs; users should know. Long-term: Family C.1 (custom program) restores full privacy posture.

**Solana protocol changes.** Durable nonces could be deprecated or reformed (unlikely but possible — see SIMD discussions). Mitigation: monitor SIMD signals; design abstractions so the "pre-signed" mechanism is swappable.

**Recipient meta-address rotation.** A drip authored today pins the recipient's stealth meta-address from today. If they rotate at day 10, days 10-30 land at the old address (still reachable by them, just stale UX). Mitigation: document; offer "refresh recipient" UX.

**Crank competing with main agent stream for RPC budget.** Both call Solana RPC. Heavy crank tick could starve interactive UX. Mitigation: dedicated RPC connection for crank; per-tool rate limits; observability.

**Torque rebate fairness.** Crank-driven emissions fire even when the user is offline. The fresh stealth destination derived from SNS record routes the rebate correctly (the stealth meta-address points to the user's wallet). Verify that derivation works even with no live SSE — should, since [[project_torque-mcp-integration-shipped]] cache + SNS resolution is server-side.

---

## Migration / rollout

**Phase 1 (PR-A, 2-3 weeks):** Land durable-nonce family. Wire scheduleSend, drip, splitSend, consolidate. splitSend + consolidate may not even need durable nonces if they're truly immediate batch — choose per their session-presence assumption. Feature-flag: `SIPHER_SCHEDULED_OPS_ENABLED=false` until verified on devnet.

**Phase 2 (PR-B, 3-4 weeks):** Land delegation family with Squads. Wire sweep + recurring. Separate feature flag: `SIPHER_DELEGATED_OPS_ENABLED=false`.

**Phase 3 (PR-C, 1-2 weeks):** COURIER hardening. Apply across both families.

**Phase 4 (future):** Migrate to custom delegation program (C.1) when justified.

**Coordination with other specs:**
- [[2026-05-15-assert-never-exhaustiveness-design]] — landing first prevents plumbing drops when new event types are added (sealed-op-broadcast events, delegation events)
- [[2026-05-15-server-side-sig-verification-design]] — server-broadcast signatures don't need verification (server holds the signed bytes) BUT a stricter check could verify the broadcast landed correctly via getSignatureStatuses post-broadcast
- [[2026-05-15-tool-signing-expired-sse-design]] — the new `POST /api/scheduled-ops/:batchId/seal` endpoint should reuse the same TTL-driven expiry SSE event for consistency

---

## Follow-ups (out of scope)

- Custom delegation program `sipher_delegation` (replaces Squads dependency)
- Price-conditional triggers (send when SOL > $X)
- Recipient meta-address auto-refresh
- Cross-chain scheduled ops (Ethereum via Gelato)
- Operator key rotation procedure documentation
- Per-tool tunable rate-limit for crank execution
- Squads spending-limit policy templates (one per sipher tool)
