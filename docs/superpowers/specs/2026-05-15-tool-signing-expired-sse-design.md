# `tool_signing_expired` SSE Event — Design

**Date:** 2026-05-15
**Session:** frontier_sip_13
**Status:** Proposed — awaiting RECTOR review
**Predecessor:**
  - PR #271 (sipher#262) shipped the signing callback flow but did not address proactive expiry — see [[project_torque-mcp-integration-shipped]] PR-E section
  - `packages/agent/src/sentinel/pending-signing.ts:23` — 5-minute promise-gate TTL fires `rejecter(new Error('operation timed out'))`
**Scope:** Emit a `tool_signing_expired` SSE event so the frontend `SignTxCard` greys out and disables interaction when the promise-gate TTL hits. Cleanup-only — the existing reject path stays as the authoritative state transition.
**Out of scope:** Per-user persistent expiry log; reconnection recovery for clients that were disconnected when expiry fired (separate follow-up); server-side rebroadcast on reconnect.
**Estimated work-time:** 1-1.5 days, 1 PR.

---

## Why this build

**The current silent failure.** `createPendingSigning` arms a 5-minute timeout. If the user doesn't click Sign within that window, `setTimeout` fires and rejects the awaiting promise. The tool execution returns an error; the agent stream emits a `message_complete` referencing the error; the stream ends.

The frontend `SignTxCard` is NEVER notified that its underlying flagId has been reaped. Three failure modes follow:

1. Card stays in the visible "pending sign" state indefinitely. If the user later clicks Sign, the `/api/tool-signing/:flagId/confirm` POST returns 404 (or `INVALID` envelope per #158). No clean UX.
2. The chat thread shows a confusing assistant turn ("transaction failed: operation timed out") next to an unmarked, still-clickable card.
3. If the user reloads the page within the same session, the persisted card re-renders — still mid-state, still confusing.

**What this fix delivers.** A first-class `tool_signing_expired` SSE event. Server emits it the instant the timeout fires (BEFORE rejecting the tool promise), so the active SSE connection forwards it to the client. The frontend transitions the SignTxCard message to an `expired` state — visually greyed out, buttons disabled, label changed to "Expired", with a tap target that lets the user dismiss it.

---

## Architecture

### Event shape (SSE wire format)

```json
{
  "type": "tool_signing_expired",
  "flagId": "<uuid>",
  "reason": "timeout"
}
```

`reason` is reserved for future kinds — `"timeout"` is the only value emitted today. Allowing the field future-proofs the client switch (`"server_shutdown"`, `"explicit_reject"`, etc. could come later).

### Server-side flow

```
createPendingSigning
   │
   ├─ stores entry in pending Map
   ├─ arms setTimeout
   ▼
[5 minutes pass with no resolve/reject]
   │
   ▼
timeout fires
   │
   ├─ emit `tool_signing_expired` event via externalQueue (NEW)
   ├─ remove entry from pending Map
   └─ rejecter(new Error('operation timed out'))
```

Today the timeout only does steps 2 and 3. This spec inserts step 1.

### Where to emit

The Pi stream bridge uses an `externalQueue` mechanism (`packages/agent/src/pi/stream-bridge.ts:118-122`) that lets non-Pi event sources inject events into the SSE generator. `chatStream` already uses this pattern for `sentinel_pause`. We reuse it for `tool_signing_expired`.

**Coordination requirement:** the `createPendingSigning` caller (inside chatStream's tool-signing wrapper) must capture an emitter reference at creation time and bind it into the pending entry, OR a module-level event emitter must be exposed from chatStream that pending-signing.ts can call. Cleanest fit: pass an `onExpire(flagId)` callback at create time:

```ts
export interface CreatePendingSigningParams {
  sessionId: string
  toolName: 'send' | 'swap'
  wallet: string
  serializedTx: string
  network: 'mainnet-beta' | 'devnet'
  toolInput: unknown
  /** Called once when the TTL fires, BEFORE the promise is rejected. */
  onExpire?: (flagId: string) => void
}
```

Inside the chatStream tool-signing wrapper, `onExpire` pushes `{ type: 'tool_signing_expired', flagId }` onto the externalQueue and wakes the generator.

### Client-side flow

`ChatSidebar.tsx` (the SSE consumer) gains a new case in the event switch:

```ts
} else if (event.type === 'tool_signing_expired') {
  // Find the matching tool_signing_required message and mark expired
  setMessages((msgs) =>
    msgs.map((m) =>
      m.role === 'system' && m.kind === 'tool_signing_required' && m.signing?.flagId === event.flagId
        ? { ...m, expired: true }
        : m,
    ),
  )
}
```

The message store gains an `expired?: boolean` flag. `SignTxCard` reads it and renders accordingly:

| State | Visual | Buttons |
|---|---|---|
| Active | Full opacity, neon highlights | Sign / Reject enabled |
| Expired | `opacity-50`, neutral border | Both disabled; label "Expired — request again" |
| Resolved | Already supported today | — |

The SignTxCard exposes a `dismiss` action that removes the message from the store when the user taps it. This lets users clear stale cards without server interaction.

### Why client-side instead of server-emitted "system" message

We could emit a synthetic assistant message like "This transaction request expired." But that's:
1. Lossy — the SignTxCard context is lost
2. Inconsistent — a card-shaped state needs a card-shaped transition, not a text afterthought

Keeping the expiry as a state mutation on the SAME message preserves the card and lets the UX style it appropriately.

---

## Implementation

1. **Extend `CreatePendingSigningParams`** in `packages/agent/src/sentinel/pending-signing.ts` with optional `onExpire?: (flagId: string) => void`.

2. **Invoke `onExpire` inside the timeout handler** BEFORE calling `rejecter`. Wrap in try/catch — emission failure must not block the reject path:
   ```ts
   const timeoutHandle = setTimeout(() => {
     if (pending.has(flagId)) {
       pending.delete(flagId)
       try {
         params.onExpire?.(flagId)
       } catch (err) {
         console.warn(`[signing] onExpire callback threw (suppressed): ${err}`)
       }
       rejecter(new Error('operation timed out'))
     }
   }, TIMEOUT_MS)
   ```

3. **Bind `onExpire` from chatStream** at the call site that constructs the pending entry. The callback pushes onto externalQueue and calls the bridge's `wake()`. Reuse the same pattern as the existing `sentinel_pause` injection.

4. **Add `'tool_signing_expired'` to `ResponseChunk.type` union** in `packages/agent/src/core/types.ts`. Add a corresponding optional field if needed; for this event, the only payload is `flagId` and `reason`, so:
   ```ts
   /** Populated only when type === 'tool_signing_expired' */
   expired?: { flagId: string; reason: 'timeout' }
   ```

5. **Add a `case 'tool_signing_expired'` branch** to both switches:
   - `AgentCore.streamMessage` (relays from Pi/sipher event into ResponseChunk)
   - `chunkToSSE` in `adapters/web.ts` (translates to wire format)

   This depends on the [[2026-05-15-assert-never-exhaustiveness-design]] spec landing first OR concurrent — if assertNever is in place, both switches break the build until updated, surfacing the requirement.

6. **Frontend store update** in `app/src/stores/app.ts`. Add `expired?: boolean` to the message type. Default `false`.

7. **Frontend ChatSidebar handler** in `app/src/components/ChatSidebar.tsx` — handle the new event type.

8. **Frontend SignTxCard rendering** in `app/src/components/SignTxCard.tsx`:
   - Accept `expired` prop
   - Branch styling: disabled buttons, `opacity-50`, label change
   - Add `onDismiss` callback so user can remove the stale card

9. **Persistence** — if SignTxCard state persists in Zustand+localStorage across reload, ensure `expired` is part of the persisted shape. (Spec assumes Zustand persistence; verify during implementation.)

---

## Test plan

### Server tests (`packages/agent/tests/sentinel/pending-signing.test.ts`)

- [ ] `createPendingSigning` with `onExpire` callback fires it once when timeout hits, BEFORE rejecter is called
- [ ] `onExpire` is NOT called if `resolvePendingSigning` or `rejectPendingSigning` runs first
- [ ] `onExpire` throwing does NOT prevent rejecter from being called
- [ ] Use `_setTimeoutMsForTests(50)` + `await new Promise(r => setTimeout(r, 100))` pattern

### Integration tests (`packages/agent/tests/agent-tool-signing.test.ts` or similar)

- [ ] Full path: chatStream gets to tool-signing wrapper, TTL fires, SSE consumer receives `tool_signing_expired` event with matching flagId, then `error` event with `operation timed out`

### Frontend tests (`app/src/components/__tests__/ChatSidebar.test.tsx`)

- [ ] Receiving a `tool_signing_expired` event marks the matching signing message as `expired: true`
- [ ] An event with an unknown flagId is a silent no-op
- [ ] An event arriving AFTER the user already signed (race) does not regress state — match by `expired === false` precondition (defensive; the server shouldn't emit this race in practice since resolve clears the timeout)

### Frontend tests (`app/src/components/__tests__/SignTxCard.test.tsx`)

- [ ] `expired={true}` renders disabled buttons, `opacity-50` class, "Expired" label
- [ ] `expired={true}` calling `onDismiss` removes the message
- [ ] Default `expired={false}` keeps existing behavior

### E2E (optional, deferred)

Playwright test: trigger tool_signing_required → wait 5s (with TIMEOUT_MS overridden via test build flag, or use 5-min real wait in nightly only) → assert card greys out without manual action.

---

## Risks

**Client-disconnected case.** If the SSE connection is closed when expiry fires (user closed tab, network drop), the event is lost. The server still cleans up. Mitigation: on reconnect, the client could query `GET /api/tool-signing/pending` (NEW endpoint, out of scope) and reconcile. For now, dismissable expired-rendering at least makes the stale-card case recoverable manually.

**Race with manual signing.** If the user clicks Sign at T=4:59 and the network is slow, the server might receive the confirm POST AFTER the timeout fires. Mitigation: today's `resolvePendingSigning` returns `false` for missing entries — the route returns 404. Adding a "expired_just_now" branch is out of scope; existing 404 + frontend's expired state cover the case.

**Switch fan-out.** Touching `ResponseChunk.type`, `streamMessage` switch, and `chunkToSSE` switch is exactly the cross-file plumbing-drop trap [[2026-05-15-assert-never-exhaustiveness-design]] warns about. **Recommendation:** land assertNever first (or in the same PR) so this spec's wiring fails at typecheck if a branch is missed.

**Test fakes for setTimeout.** vitest fake timers can desync with `Date.now()` if not configured carefully. Recommend `vi.useFakeTimers({ shouldAdvanceTime: true })` or the `_setTimeoutMsForTests` lever which is already present.

**Persistence shape changes.** If Zustand persistence already shipped the message shape without `expired`, adding the field must default safely on reload (Zustand `version` bump or `migrate` function). Verify during implementation.

---

## Migration / rollout

- Single PR landing server + client changes together. Server emitting an event no client handles is harmless (browser logs unknown SSE event and continues). Client handling an event no server emits is dormant code. So the lockstep deploy is for clarity, not safety.
- No data migration. The pending Map is in-memory.
- Roll forward — no flag, no feature toggle.

---

## Follow-ups (out of scope)

- `GET /api/tool-signing/pending` endpoint for reconnection recovery.
- Server-side signature verification before resolving the signing flag — see [[2026-05-15-server-side-sig-verification-design]] which depends on the same pending-signing.ts surface.
- Configurable per-tool TTL (today's 5-min applies to all signing flags).
