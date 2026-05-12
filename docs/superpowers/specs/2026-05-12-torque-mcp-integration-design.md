# Torque MCP Integration — Privacy-Native Growth Loops — Design

**Date:** 2026-05-12
**Session:** frontier_sip_6
**Status:** Approved by RECTOR — awaiting written-spec review
**Predecessor:**
  - Hackathon analysis: `~/Documents/secret/claude-strategy/sip-protocol/research/frontier-april-2026-analysis.html` (Listing 07: Build with Torque MCP, $3K USDC)
  - Listing surface inspection (Chrome MCP, this session): https://superteam.fun/earn/listing/build-with-torque-mcp-1
  - Existing March integration: `sip-app/src/lib/loyalty/*` (Solana Graveyard Torque Sponsor Track winner, $750)
**Scope:** Add Torque MCP consumer integration to sipher's agent layer. Emit `custom_events` from fund-moving sipher tools. Drive a per-action rebate growth loop with reward distribution to fresh stealth addresses.
**Out of scope (this spec):** sipher MCP server (sipher exposing tools as MCP — separate concern), sip-app loyalty UI extension (existing reader stays as-is), mainnet rollout decisions (separate sign-off after devnet demo verified)
**Estimated work-time:** 8-12 days across 4-5 PRs over a 2-week shadow window

---

## Why this build

**Bounty context.** Torque's Frontier hackathon track ($3K USDC, judges score May 27 — 15-day shadow window from today) requires participants to *consume* Torque MCP / API to drive growth in their own project. Specifically: emit `custom_events` to Torque, run a campaign that rewards those events, prove live activity. RECTOR's directive: build the integration first; submission decision comes after the build is real.

**Strategic frame.** Sipher is the "Privacy-as-a-Skill" REST API + agent layer (22 tools, mainnet-live, 1,495+ tests). It has no growth loop today — users discover tools, use them, and leave with no incentive to come back or invite others. Torque solves exactly that. Wiring sipher's fund-moving tools to Torque adds programmable retention without compromising sipher's privacy positioning, **provided the rebate destination is itself a stealth address.**

**Why MCP, not just SDK.** The bounty explicitly names "Torque MCP" as the integration surface. Sipher already speaks the agent-tool dialect (Pi SDK + AnthropicTool); MCP is the natural protocol for tool-to-tool composition. The existing `sip-app` integration uses Torque's REST/SDK and qualifies for a different bounty class. This spec is purely about the MCP consumer side.

---

## Architecture

```
sipher agent (existing)
   │
   ├─ Tools: send, swap, claim, drip, splitSend, ... (fund-moving subset)
   │       │
   │       │  (after on-chain confirmation)
   │       ▼
   │   TorqueGrowthHook  ← new middleware
   │       │
   │       ▼
   │   TorqueMCPClient   ← new MCP consumer
   │       │
   │       ▼
   └─► Torque MCP server (external)
           │
           ▼
       Torque Campaign Engine
           │
           ▼
       Rebate → fresh stealth address derived per-event
```

**New module: `packages/agent/src/integrations/torque/`**
- `mcp-client.ts` — wraps Torque MCP calls (`emit_event`, `get_campaign_status`, `get_campaign`)
- `growth-hook.ts` — post-success middleware on fund-moving tools
- `rebate-destination.ts` — derives fresh stealth address per event from user's published meta-address
- `types.ts` — event payload + MCP response types
- `README.md` — setup, env vars, privacy posture disclosure
- `tests/...` — unit + integration + e2e

**New documentation: `docs/integrations/torque/`**
- `FRICTION-LOG.md` — live-updated build journal (bounty deliverable)

**Privacy posture (surfaced explicitly).** Torque MCP needs the user's public Solana wallet to attribute actions and route rebates. Torque learns "wallet X used sipher" — a small but real linkage leak. Recipients of the user's private actions stay opaque to Torque. We disclose this in README + Friction Log so users can make informed consent.

**Trade-off accepted:** the alternative (zero-leak attribution) requires either (a) ZK-proven anonymous credentials or (b) Torque-side architectural changes — both out of scope for a 2-week build. The leak is bounded to "wallet X engaged with sipher tools," not "wallet X sent N SOL to recipient Y."

---

## Event emission

**Tools that emit `custom_events` (fund-moving subset of sipher's 22):**

| Sipher tool | Event name | Why we emit |
|---|---|---|
| `send` | `sipher.private_send_completed` | Core privacy action |
| `swap` | `sipher.private_swap_completed` | Privacy + DEX volume signal |
| `claim` | `sipher.private_claim_completed` | Receiving side of stealth flow |
| `drip` | `sipher.recurring_send_tick` | Recurring engagement |
| `splitSend` | `sipher.batch_send_completed` | Power-user signal |

**Skipped intentionally:** read-only tools (`balance`, `history`, `viewingKey`, `privacyScore`, `threatCheck`, `assessRisk`), admin tools (`status`, `viewingKey`), and `sipher_vault` deposit/withdraw (devnet-only, CPI complexity, defer to a future sweep).

**Event payload (canonical shape):**
```ts
type SipherGrowthEvent = {
  event: string                    // 'sipher.private_send_completed'
  wallet: string                   // user's public Solana pubkey (attribution)
  ts: string                       // ISO-8601
  tx_signature: string             // Solana TX sig (idempotency key)
  network: 'mainnet-beta' | 'devnet'
  metadata: {
    amount_lamports?: number       // OMITTED for `send`, INCLUDED for `swap`
    asset?: string                 // 'SOL' | 'USDC' | mint address
    rebate_destination: string     // fresh stealth address
  }
}
```

**Per-event privacy decisions, not blanket:**
- `send` events OMIT `amount_lamports` — sender wallet + amount = nearly full deanonymization
- `swap` events INCLUDE `amount_lamports` — DEX trade is already public on-chain; redaction would be pointless
- `claim` events OMIT `amount_lamports` — receiver-side flow, amount isn't needed for attribution
- All events include `tx_signature` for idempotency (Torque deduplicates retries)

**Emission rules:**
- Fire **only after** on-chain confirmation. Never on submit. Never on optimistic UI.
- Failures to emit must **never** break the user's tool call. Wrap in try/catch, log + drop.
- Idempotency: `tx_signature` field guarantees Torque ignores duplicate emissions.
- SENTINEL preflight runs before the tool. If SENTINEL blocks → tool never runs → no event. Correct behavior (the user didn't take the action).
- Growth hook runs after tool success. SENTINEL doesn't gate it (it's a post-action analytics emit, not a fund-moving action).

**Rebate destination derivation (`rebate-destination.ts`):**
- Preferred: SNS `SIP-STEALTH` record via `@sip-protocol/sns-stealth@0.1.1` (just shipped today)
- Fallback: legacy hex stealth meta-address from sipher's existing identity flow
- Neither available: rebate skipped silently; event still emitted for analytics; log warning ("publish your sip.sol record to claim rebates")

This wires sip.sol Phase A-E directly into the Torque growth loop — strong narrative composition for the Friction Log + demo video.

---

## Campaign + reward pool

**One campaign initially** (multi-campaign later if it proves out):

| Param | Value |
|---|---|
| Name | `Sipher Private Action Rebate` |
| Reward primitive | Token rebate (Torque's built-in) |
| Reward token | SOL on devnet (shadow phase), USDC on mainnet (production) |
| Per-action rebate | 0.005 SOL devnet ≈ symbolic ~$1; tunable per network |
| Pool size (devnet) | 5 SOL = ~1000 actions |
| Pool size (mainnet) | $50 USDC initial; revisit after 7 days of healthy data |
| Sybil cap | Max 5 rebates per wallet per 24h (Torque-side config) |
| Active window | Continuous; refill when pool drops below 20% |

**Network strategy:**
- **Devnet first (shadow week 1)** — shake out the integration, prove the loop, no real money at risk
- **Mainnet after demo verified (week 2 or post-shadow)** — small pool, monitor for 7 days before scaling
- Per-network campaign IDs in env: `TORQUE_CAMPAIGN_ID_DEVNET`, `TORQUE_CAMPAIGN_ID_MAINNET`. Sipher routes based on `SIPHER_NETWORK`.

**Campaign discovery (startup):**
- On boot, sipher fetches campaign metadata via `TorqueMCPClient.getCampaign(id)`
- Caches for 5 minutes (mirrors the existing `TorqueReader` cache TTL in sip-app for consistency)
- Failure to fetch ≠ broken sipher. Tools still work; events still emit. Just no rebates land. Logged as warning.

**Env vars (added to sipher's existing config):**
```
TORQUE_API_KEY=               # Per-environment, stored in ~/Documents/secret/sipher-vps-secrets.env
TORQUE_MCP_URL=               # MCP server endpoint (provided via Torque hackathon TG group)
TORQUE_CAMPAIGN_ID_DEVNET=
TORQUE_CAMPAIGN_ID_MAINNET=   # Set after mainnet pool funded
TORQUE_GROWTH_ENABLED=true    # Master kill-switch
```

`TORQUE_GROWTH_ENABLED=false` is the panic button: integration disables cleanly, sipher's tools work as before, no events fire. Useful if Torque API has an outage or we discover a privacy regression mid-campaign.

**Reward pool funding:**
- Devnet: shared `solana-devnet.json` keypair (already in `~/Documents/secret/`)
- Mainnet: **fresh dedicated rebate wallet** (not Treasury) — cleaner blast radius. Compromise of rebate wallet doesn't touch treasury. Wallet generation + secure storage tracked in PR-D acceptance.

**Admin surface:**
- New REST endpoint: `GET /admin/torque/status` — returns campaign info, pool balance, events emitted (last 24h), error log
- Authenticated via existing sipher admin JWT flow (cipher-admin wallet)
- No new auth surface — reuses Phase 1 admin work

---

## Testing

Three layers, mirroring sipher's existing test discipline. Patterns locked in PR-1/PR-2/PR-3 of the recent SENTINEL audit work apply: `toStrictEqual` + ISO-8601 regex for timestamps, service-error propagation tested for every async call, `it.each` for empty/whitespace validation, `ToolSchemaLike` helper for Pi AI tool schema casts.

**Unit tests** (`packages/agent/tests/integrations/torque/`)
- `mcp-client.test.ts` — wire-format tests via vitest mock fetch. Verify request shape, payload encoding, error envelope handling, retry/backoff behavior.
- `growth-hook.test.ts` — verify event payload constructed correctly per tool, emission only on success, never on failure, idempotency key = `tx_signature`, omits `amount_lamports` for `send` but includes for `swap`, kill-switch (`TORQUE_GROWTH_ENABLED=false`) silently no-ops.
- `rebate-destination.test.ts` — given user has SNS record → derives stealth address; given user has legacy hex meta → derives stealth address; given neither → returns null + logs warning.

**Integration tests** (real Torque devnet API)
- `torque-emit-roundtrip.test.ts` — fire a real `custom_event` against Torque devnet, poll for ingestion, assert it appears in campaign attribution.
- Skip predicate (mirrors `sns-stealth/tests/integration.test.ts` pattern shipped today): require explicit `TORQUE_TEST_CAMPAIGN_ID` + `TORQUE_API_KEY` env. No defaults — opt-in only. Skips cleanly for contributors / CI.

**E2E test** (full sipher flow)
- `torque-rebate-e2e.test.ts` — invoke `sipher.send` end-to-end on devnet: confirm Solana TX → assert event lands at Torque → poll rebate destination wallet → assert lamport balance increased.
- Devnet only. Same skip predicate as integration.
- Deferred to last week of shadow build (after MCP client + hook are solid).

**CI integration:**
- All three layers run via `pnpm --filter @sipher/agent test:run` (current sipher test command)
- Mainnet credentials NEVER in CI — only devnet + skipped tests
- Coverage tracked alongside existing 1,495+ agent tests

**Out of scope for testing:**
- Torque's own campaign engine (their problem, not ours)
- Sipher's existing fund-moving tools (already covered by their own test suites)
- UI flows (sipher app/ has no Torque-facing UI in this scope)

---

## Demo asset + Friction Log

**Demo asset (90-second screen capture, recorded at end of shadow week 2):**

Single take, no voiceover edits:

1. **Setup shot (5s)** — sipher chat UI, devnet wallet connected, current SOL balance shown. Caption overlay: "Torque rebate pool: 5 SOL"
2. **Action (15s)** — type `send 0.1 SOL privately to therector.sol`. SENTINEL preflight passes. TX confirms on-chain. Solscan tab opens showing the shielded transfer.
3. **Attribution (20s)** — flip to Torque dashboard tab, refresh. New event appears: `sipher.private_send_completed`, attributed to user wallet. Caption: "Custom event emitted via Torque MCP"
4. **Rebate (30s)** — flip back to a fresh wallet view, derived stealth address. Within ~5s, lamport balance increases by 0.005 SOL. Solscan link to the rebate TX. Caption: "Rebate auto-claimed at fresh stealth address — no doxxing"
5. **Closing card (20s)** — text card: "Sipher × Torque MCP. Privacy-native growth loops on Solana. github.com/sip-protocol/sipher"

Posted to X tagged `@torqueprotocol`, `@SuperteamFun`, hashtag `#FrontierHackathon`. Thread with 1-2 follow-up posts: friction-log highlights + technical writeup link.

**Friction Log (`docs/integrations/torque/FRICTION-LOG.md`):**

Live document updated daily during the 2-week build. Sections:

- **What broke** — concrete API errors, MCP server endpoint surprises, SDK ↔ MCP semantic mismatches, doc contradictions
- **What was confusing** — onboarding gaps, missing examples, unclear which primitive maps to which use case
- **What we'd improve** — concrete suggestions tagged by priority (would-block-adoption / nice-to-have)
- **What worked well** — concrete praise where deserved (avoids "all complaints, no signal" tone)
- **Telegram interactions log** — Q&A with `@smicktrq` during build, with timestamps. Signals real engagement.

Bounty wording mandates three buckets ("what broke, what was confusing, how we'd improve"); we ship all three plus the trust-builders.

**README addition (`packages/agent/src/integrations/torque/README.md`):**
- 1-paragraph "what this is"
- Env var setup (5 lines)
- 60-second integration test command
- Privacy posture disclosure (the wallet-attribution leak surfaced in the architecture section)
- Link to FRICTION-LOG

---

## PR breakdown (preview — full plan in writing-plans output)

The implementation plan (next skill) will detail:

- **PR-A** — `packages/agent/src/integrations/torque/types.ts` + `mcp-client.ts` + unit tests (foundation, ~2 days)
- **PR-B** — `growth-hook.ts` + `rebate-destination.ts` + unit tests (middleware, ~2 days)
- **PR-C** — Wire growth hook into `send` / `swap` / `claim` / `drip` / `splitSend` tools + per-tool tests (integration into existing tools, ~2 days)
- **PR-D** — Devnet campaign setup + integration test + E2E test + admin endpoint + README + initial Friction Log entries (~3 days)
- **PR-E (optional)** — Mainnet rollout: campaign creation, dedicated rebate wallet, monitoring playbook (~2 days, gated on PR-D acceptance)

Each PR follows the established sipher pattern: TDD where feasible, `pnpm typecheck` clean, `pnpm test:run` green, signed commits, conventional commit messages, `--merge --delete-branch`, no AI attribution.

---

## Acceptance — done when

- [ ] All 5 PRs merged (PR-E optional pending mainnet decision)
- [ ] Devnet campaign live with ≥10 real `custom_events` ingested
- [ ] At least 1 rebate distribution TX confirmed on devnet
- [ ] FRICTION-LOG.md committed with ≥10 dated entries
- [ ] README.md committed with privacy posture clearly disclosed
- [ ] 90-second demo video recorded, posted to X tagging `@torqueprotocol`
- [ ] Test coverage for `integrations/torque/` ≥ 90% statements
- [ ] No regressions in existing sipher test suite (1,495+ → 1,495+ + new tests)
- [ ] `TORQUE_GROWTH_ENABLED=false` cleanly disables the integration (verified manually)

---

## Open questions deferred to implementation

These don't block design approval but need answers during PR-A:
- Does Torque MCP server use Anthropic's stdio MCP transport or an HTTP-based MCP variant? (TG group answer)
- What auth flow does the Torque MCP server use? (API key in header? OAuth? wallet-signature?)
- Are there per-event-type rate limits on the Torque side?
- Is there a sandbox campaign ID we can use for testing without affecting our real campaign?

Friction Log captures the answers as they arrive.
