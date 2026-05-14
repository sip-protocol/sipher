# Torque MCP Integration — Friction Log

Live build journal during the Torque MCP integration sprint (May 12-26, 2026). Updated daily.

## What broke

_To be filled during build. Capture: concrete API errors, MCP server endpoint surprises, SDK ↔ MCP semantic mismatches, doc contradictions._

## What was confusing

_To be filled. Onboarding gaps, missing examples, unclear which primitive maps to which use case._

## What we'd improve

_To be filled. Concrete suggestions tagged by priority (would-block-adoption / nice-to-have)._

## What worked well

_To be filled. Genuine praise where deserved — keeps the log honest._

## Telegram interactions

_To be filled. Q&A with @smicktrq during build, with timestamps. Signals real engagement._

---

## Day 1 — 2026-05-12

- (Open Telegram group access pending; integration tests are skip-predicated to allow shadow build before TG access is granted.)
- TorqueMCPClient + types shipped in PR-A (sipher#256) against assumed API shape: HTTP+SSE, `x-torque-api-key` header, `POST /campaigns/{id}/events`. Will reconcile against actual API once TG group provides MCP URL.
- Growth-hook middleware shipped in PR-B (sipher#258) — fires `custom_events` post-success with per-event privacy decisions (omit amount for send/claim, include for swap).
- Wired into agent runtime in PR-C (sipher#260) — gated on `TORQUE_GROWTH_ENABLED=true`. SENTINEL preflight runs first; Torque emits after.
- PR-D (this PR) adds the admin endpoint, opt-in integration + e2e test stubs, README, and this seed Friction Log.

---

## Day 2 — 2026-05-13 (canonical contract probe + rewrite)

### What broke

- **2026-05-12 — Spec built on dashboard assumptions, not live contract.** PR-A through PR-D shipped against `server.torque.so/campaigns/{id}/events` with `x-torque-api-key` header and nested `{event, wallet, ts, metadata: {...}}` body. None of those matched reality. The actual contract is `POST ingest.torque.so/events` with `x-api-key` header and flat `{userPubkey, timestamp, eventName, data}` body. The error was assuming Torque's REST surface mirrored a "campaign" mental model when in fact Torque uses Queries + Incentives + Lists, never a Campaign object.
- **2026-05-12 — `TORQUE_CAMPAIGN_ID_*` env vars don't exist in Torque's API.** The Custom Event Provider data source binds events to a project by the `x-api-key` header alone (the API key is project-scoped). No campaign UUID in the URL, no `campaignId` in the body. Wasted ~15 lines of code on a non-existent concept.
- **2026-05-12 — Torque AI wizard hangs.** Three separate attempts to use Torque's "Create with AI" Incentive setup wizard all stalled with "Taking longer than expected..." past 70 seconds. Conclusion: AI dialog is only useful for design discussion, not for actual creation. Direct API or manual form fill required.

### What was confusing

- **2026-05-12 — Three Torque hosts, similar names.** `server.torque.so` (CRUD), `platform.torque.so` (dashboard UI + small internal API), `ingest.torque.so` (events), `ai.torque.so` (AI features). Distinct purposes, similar TLD prefixes — easy to test against the wrong one and get cryptic 404s. The official `@torque-labs/mcp@0.4.7` npm package source code (`dist/index.js`) was the cleanest source for the host map, not the public docs.

### What we'd improve

- **Surface the canonical ingest contract in the public Torque docs.** Right now the only authoritative source is the `@torque-labs/mcp` npm package source. A documented request shape (`{userPubkey, timestamp, eventName, data}`) with server-schema error examples would have saved ~half a day.
- **Document the mainnet-only constraint for pool funding.** The "devnet first" shadow-testing pattern is widespread in Solana dev practice; surfacing that pool funding requires mainnet earlier would have changed our deployment design upfront.

### What worked well

- **`@torque-labs/mcp` npm package as ground truth.** The published MCP server source carries inline help-text like "`userPubkey` and `timestamp` are required top-level properties on every event" — exactly the missing prose from the public docs. Reading the source confirmed the entire contract in 15 minutes.
- **Server schema errors are gold for tests.** Torque returns `400 {"status":"BAD_REQUEST","message":"body/eventName Required, body/data Required"}` — the message names the missing fields. We snapshot these as test fixtures: `event_undefined` reason when 400 message contains "Event not found", `validation` reason otherwise. This kept the test suite anchored to real server behavior.
