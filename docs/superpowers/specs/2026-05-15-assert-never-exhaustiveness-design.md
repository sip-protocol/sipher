# assertNever Exhaustiveness Guards — Design

**Date:** 2026-05-15
**Session:** frontier_sip_13
**Status:** Proposed — awaiting RECTOR review
**Predecessor:**
  - Lesson 2 from PR-E (#269) holistic review — "Cross-file SSE plumbing drops" recorded in [[project_torque-mcp-integration-shipped]]
  - PR #271 (sipher#262) signing callback boundary plumbing drop in `f62b308` (ResponseChunk → streamMessage switch → chunkToSSE switch needed coordinated update)
**Scope:** Add `assertNever` default cases to the two discriminated-union switches that translate streaming events between layers: `AgentCore.streamMessage` and `chunkToSSE` in `adapters/web.ts`.
**Out of scope:** Wholesale refactor of `ResponseChunk` into a tagged discriminated union (separate type-hygiene PR), Pi SDK internal event additions (upstream), HERALD X adapter (no SSE).
**Estimated work-time:** 0.5 day, 1 PR.

---

## Why this build

**The bug pattern.** Sipher's SSE pipeline has three coordination points:

```
chatStream (Pi event → SSEEvent + sipher-internal events)
   │
   ▼  switch (event.type)  ← agent-core.ts:156-209
   │
ResponseChunk yielded
   │
   ▼  switch (chunk.type)  ← adapters/web.ts:27-64
   │
SSE wire event
```

Adding a new variant to `ResponseChunk` requires updating three places in lockstep. If any one is missed, the variant is silently dropped — the SSE client never sees it, the server thinks it sent it, and debugging starts with "why isn't the frontend reacting?"

**Concrete prior incident.** PR #271 (sipher#262, the signing callback) added the `tool_signing_required` ResponseChunk variant. Initial implementation extended `ResponseChunk.type` but missed the chunkToSSE branch — caught at holistic review in commit `f62b308` (`extended ResponseChunk + AgentCore.streamMessage switch + chunkToSSE switch + 1 new web-adapter test`). Three coordinated edits across three files, with no compile-time signal when one is missed.

**What `assertNever` buys us.** When a switch contains `default: return assertNever(value)` where `value` is narrowed to `never` after exhausting the union, TypeScript fails to compile if a new variant is added without a case branch. The boundary plumbing drop becomes a typecheck error, not a runtime silence.

---

## Architecture

### The helper

```ts
// packages/agent/src/core/assert-never.ts

/**
 * Compile-time exhaustiveness check for discriminated-union switches.
 *
 * Place at the `default` branch of a switch over a string-literal union.
 * If the union grows and a case is added without updating the switch,
 * `value` is no longer narrowed to `never`, and this function fails to
 * typecheck — surfacing the missing case at build time.
 *
 * At runtime, throws — the type system should make this unreachable, so
 * a thrown error indicates a real bug (cast bypassed type system, or
 * runtime data didn't match the declared union).
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminant: ${String(value)}`)
}
```

### Where it goes

**Point A: `chunkToSSE` in `packages/agent/src/adapters/web.ts:27-64`**

Today:
```ts
function chunkToSSE(chunk: ResponseChunk): Record<string, unknown> {
  switch (chunk.type) {
    case 'text': ...
    case 'tool_start': ...
    case 'tool_end': ...
    case 'sentinel_pause': ...
    case 'tool_signing_required': ...
    case 'error': ...
    case 'done': ...
  }
}
```

After:
```ts
function chunkToSSE(chunk: ResponseChunk): Record<string, unknown> {
  switch (chunk.type) {
    case 'text': ...
    case 'tool_start': ...
    case 'tool_end': ...
    case 'sentinel_pause': ...
    case 'tool_signing_required': ...
    case 'error': ...
    case 'done': ...
    default:
      return assertNever(chunk.type)
  }
}
```

Note: function return is `Record<string, unknown>`, so `assertNever` (which returns `never`) is structurally compatible with the return type. No signature change needed.

**Point B: `AgentCore.streamMessage` in `packages/agent/src/core/agent-core.ts:156-209`**

The switch iterates over `chatStream`'s yielded events. Today the event type is implicitly the union of `SSEEvent` (from `pi/stream-bridge.ts:25`) plus sipher-internal events injected via `externalQueue` (sentinel_pause, tool_signing_required).

`chatStream`'s return type today is not a single named union — the event variants live in agent.ts. **Prerequisite for assertNever here:** declare a named `ChatStreamEvent` union in `packages/agent/src/agent.ts` that explicitly enumerates every event variant chatStream can yield:

```ts
// In agent.ts (or a new types module imported by both agent.ts and agent-core.ts)
export type ChatStreamEvent =
  | SSEContentDelta
  | SSEToolUse
  | SSEToolResult
  | SSEMessageComplete
  | SSEError
  | SSESentinelPause            // sipher-internal
  | SSEToolSigningRequired      // sipher-internal
```

Then narrow `event` to `ChatStreamEvent` inside the switch:

```ts
for await (const event of chatStream(...) as AsyncIterable<ChatStreamEvent>) {
  switch (event.type) {
    case 'content_block_delta': ...
    ...
    default:
      return assertNever(event)  // narrowed to never if all cases handled
  }
}
```

Note: `assertNever(event)` (not `event.type`) — we want the variant *shape* exhausted, not just the discriminator string. If a future case adds a new field but reuses an existing `type` literal, we don't want to silently accept it.

### Why two patterns

| Switch | Discriminant target | Rationale |
|---|---|---|
| `chunkToSSE` | `assertNever(chunk.type)` | ResponseChunk is a non-discriminated interface with a string-union `type` field; only the type string narrows |
| `streamMessage` | `assertNever(event)` | ChatStreamEvent is a proper tagged union; we want full-variant exhaustion |

Both are correct uses of the pattern. The streamMessage version is stricter and preferred whenever the target type permits it.

---

## Implementation

1. **Create helper** at `packages/agent/src/core/assert-never.ts` with the function above. Add a unit test in `packages/agent/tests/core/assert-never.test.ts` confirming the runtime throw (the typecheck behavior is verified by tsc itself; the test exists to lock the runtime branch in coverage).

2. **Wire `chunkToSSE`** — add the default branch. Import `assertNever` from `../core/assert-never.js`.

3. **Declare `ChatStreamEvent` union** in `packages/agent/src/agent.ts` (or a new `agent-events.ts` if cleaner). Export it. Today's `SSEEvent` from stream-bridge stays as the Pi-side union; `ChatStreamEvent = SSEEvent | SSESentinelPause | SSEToolSigningRequired`.

4. **Type-annotate `event`** inside `streamMessage`'s `for await` so `event` narrows on `event.type`. Add the default branch with `assertNever(event)`.

5. **Add a "missing case" compile-time test.** Two approaches:
   - Type-only test via `expect-type` / `tsd` — assert a stripped union triggers the type error
   - Or: comment block with a code sample showing what fails to compile (cheaper, looser)

   Recommend approach 1 — there's already a vitest+tsd pattern used elsewhere in the repo (TBD: confirm during implementation).

---

## Test plan

- [ ] **Unit test (runtime):** `assertNever('x' as never)` throws with a message containing `'x'`.
- [ ] **Compile-time test (chunkToSSE):** delete a case from `chunkToSSE`, run `pnpm typecheck`, confirm error pinpoints the missing branch. (Done during implementation, restored before commit; not a permanent test.)
- [ ] **Compile-time test (streamMessage):** same drill.
- [ ] **Existing tests still pass:** `pnpm --filter @sipher/agent test` — no regression.
- [ ] **Optional permanent type-only test:** `packages/agent/tests/core/assert-never.types.test.ts` using `expectTypeOf` from vitest to assert exhaustiveness of `ChatStreamEvent` against the switch.

---

## Risks

**False negatives if a variant is cast.** `assertNever` only catches missing branches in the original switch. If someone introduces a new variant by casting an existing union member (e.g. `chunk as ResponseChunk` after mutating `type`), the cast bypasses the type system. Mitigation: don't cast; if a cast is necessary, prefer a `// FIXME` comment and a follow-up to broaden the union.

**ChatStreamEvent drift from chatStream actual emissions.** If chatStream gets a new event variant but `ChatStreamEvent` isn't updated, the bridge code typechecks but emits something unrepresented at runtime. Mitigation: keep `ChatStreamEvent` declared next to `chatStream` (same file) so the locality forces the update.

**Imports and ESM path quirks.** This repo uses `.js` import suffixes in TS source (NodeNext resolution). New helper file must follow the convention. (`import { assertNever } from '../core/assert-never.js'`).

**Test-only `as never` cast surface.** Existing tests use `as never` for vi.mock implementations. `assertNever` shouldn't trigger from those paths in practice; if it does, the cast is masking a real type-flow issue worth fixing.

---

## Migration / rollout

Single PR, single deploy. No data migration, no config change. Tests prove no behavior change. CI typecheck must pass. Roll forward — no kill-switch needed.

---

## Follow-ups (out of scope for this spec)

- Convert `ResponseChunk` to a proper tagged discriminated union (one variant per `type`, with type-specific fields required not optional). Would tighten `chunkToSSE` further but is a larger refactor touching all yield sites.
- Apply the same pattern to other switches in the codebase. Audit: `grep -rn "switch (.*\.type)" packages/agent/src` — should be reviewed in a follow-up.
- Lint rule `@typescript-eslint/switch-exhaustiveness-check` — equivalent guard at lint level; consider enabling if the helper pattern proves heavy.
