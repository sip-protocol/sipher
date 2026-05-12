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
