# 90s Demo Shot-List — SIP Protocol × Torque MCP

**Target runtime:** 88s | **Voice-over word budget:** ~220 words @ ~150 wpm
**Audience:** Frontier Hackathon "Build with Torque MCP" judges (scoring 2026-05-27)
**Recording mode:** Single-screen capture + VO. One take feasible.

---

## Pre-Staging Checklist

Do every item BEFORE pressing record. Total prep time: ~5 min.

### Hardware

- [ ] External mic on, levels checked (target -12 dB peaks). Phone DND on. Slack/Discord muted.
- [ ] Screen recording at 1920x1080. Mouse cursor enabled. Click highlights ON.
- [ ] Close everything except Chrome.

### Chrome window (single window, two tabs only — left-to-right)

1. **Tab 1:** `https://sipher.sip-protocol.org` — already signed in as `cipher-admin` (`C1phrE76...x85N`). Chat sidebar open, history cleared (use the "New chat" action or refresh after clear). Verify the chat input placeholder reads `Message SIPHER...`.
2. **Tab 2:** `https://platform.torque.so/project/cmp2as15d05pnk01hiyuf7208/home` — Sipher project home. Navigate to the **Custom Events** view (filtered to the project). Confirm the live event stream is visible. Most recent event should be from an earlier test fire — do NOT clear it; we want the stream populated so the new event lands visibly at the top.

### Wallet (Backpack extension)

- [ ] Backpack unlocked. Active account: `cipher-admin` (`C1phrE76...x85N`).
- [ ] Network: **Devnet** (we are NOT moving real money in this demo).
- [ ] Devnet SOL balance ≥ 0.05 SOL. Verify in Backpack header.
- [ ] Auto-lock timer set to ≥ 10 min so the popup doesn't time out mid-demo.

### Sipher chat state

- [ ] Open chat sidebar. Clear all messages (refresh tab if needed; do NOT click any tool buttons that would emit an event).
- [ ] Verify SIPHER header pill is green (status: online).

### Pre-stage the recipient address

Use a stable devnet stealth address you control. Copy it to clipboard before recording:

```
<PASTE_DEVNET_STEALTH_ADDRESS_HERE_BEFORE_RECORDING>
```

(Use any throwaway devnet address you can later reclaim from. Same address every take = easier post-edit.)

### Browser zoom

- [ ] Tab 1 (Sipher): zoom 110% so the SignTxCard reads cleanly at 1080p.
- [ ] Tab 2 (Torque): zoom 100%.

### Final dry run

- [ ] Run the demo end-to-end ONCE without recording. Confirm: (a) chat renders SignTxCard within 3s of sending the prompt; (b) Backpack popup opens on click; (c) sig lands on Solscan within 5s; (d) Torque dashboard event appears within 10s of broadcast.
- [ ] Note actual timings — adjust pause lengths in scenes 5-7 if your VPS round-trip is slower than expected.

---

## Things That Could Go Wrong — Abort Criteria

If ANY of these happen mid-recording, STOP, fix, and re-record from scene 1.

| Symptom | Abort threshold | Fix |
|---|---|---|
| Chat returns `awaiting_signature` text but no SignTxCard renders | > 5s | Hard refresh, verify JWT not expired |
| Backpack popup doesn't open on "Sign with Wallet" click | > 3s | Check extension is unlocked + on devnet |
| `tool_signing_required` SSE event drops (chat just shows spinner forever) | > 8s | Restart agent process via admin tab; re-record |
| Torque event doesn't land in dashboard | > 30s | Skip scene 7; mention in voice-over that confirmation can take up to a minute and show the local server log instead. Better: re-record. |
| Wrong wallet popup (not `cipher-admin`) | Instant | Switch account in Backpack header, restart take |
| Solscan link 404s on signature | > 5s on retry | Network propagation lag — pause 3s, retry. If still 404, re-record. |

**Do NOT improvise around a failure.** Judges watch many demos; smooth wins.

---

## Shot List (10 scenes, 88s total)

---

### Scene 1 — 8s — Opening hook

**On screen:** Sipher landing tab (`sipher.sip-protocol.org`), chat sidebar empty, SIPHER header visible top-left.
**Cursor:** Idle, off-screen.
**Click/type:** Nothing. Static frame.
**Expected result:** Clean glass-neon UI, "Ask SIPHER about privacy..." placeholder (or "Message SIPHER..." if logged in).
**Voice-over:** "This is Sipher — chat-driven private payments on Solana, with built-in rebates from Torque. Send, swap, claim — privacy by default, and you get paid for using it."
**Recording notes:** Hold the static shot for the full 8s. Don't fidget the cursor. Let the UI do the work.

---

### Scene 2 — 6s — The chat prompt

**On screen:** Same Sipher tab. Cursor moves to chat input.
**Click/type:** Click the chat input. Type slowly enough that viewers can read:
```
send 0.01 SOL to <DEVNET_STEALTH_ADDRESS>
```
**Expected result:** Text appears in the input. Submit button enables.
**Voice-over:** "I ask Sipher to send a tenth of a SOL — privately — to a fresh stealth address."
**Recording notes:** Type at ~3 chars/sec. Pause briefly after typing so viewers can read the address. Don't press Enter yet — the voice-over carries into scene 3.

---

### Scene 3 — 10s — SignTxCard renders

**On screen:** Press Enter. Chat shows the user message, then the SIPHER response streams in, then the SignTxCard renders inline in the chat.
**Click/type:** Press Enter. Then nothing — let the card render.
**Expected result:** SignTxCard appears with title (e.g. "Private send"), primary detail line, fee + amount breakdown, "Sign with Wallet" button.
**Voice-over:** "Sipher builds the transaction server-side, then renders a sign card in the chat. The amount, recipient, and fee are right there — nothing hidden from me."
**Recording notes:** If the card takes longer than 3s to render, your VPS is slow today — abort. If your laptop is on battery, plug in.

---

### Scene 4 — 8s — Sign with wallet

**On screen:** SignTxCard visible. Cursor moves to "Sign with Wallet" button, clicks. Backpack popup appears.
**Click/type:** Click "Sign with Wallet". When popup opens, click "Approve" inside Backpack.
**Expected result:** Backpack popup renders the tx breakdown. After approve, popup closes. Card status changes to "Finalizing..." then "Signed".
**Voice-over:** "I sign with Backpack. The transaction goes out, and Sipher's growth hook fires a Torque custom event with the signature."
**Recording notes:** Backpack popup position is OS-dependent — rehearse so you don't have to chase it. If popup opens off-screen, drag it into the recording frame DURING the dry run, then leave it there.

---

### Scene 5 — 6s — Solscan confirmation

**On screen:** Chat shows the SIPHER response with the signature as a clickable link. Click it. New tab opens Solscan.
**Click/type:** Click the signature link.
**Expected result:** Solscan shows "Success" status, the transaction landed.
**Voice-over:** "On-chain in two seconds. Real signature, real transfer."
**Recording notes:** Use Cmd+click to open in new tab so the Sipher tab stays in scene 6 reach. Solscan can be slow to render — if it does, zoom in on just the "Success" badge with a screen-zoom shortcut.

---

### Scene 6 — 4s — Privacy beat

**On screen:** Back to Sipher tab. Cursor hovers over the SignTxCard's recipient field (showing the stealth address).
**Click/type:** Hover only, no click.
**Expected result:** Stealth address is visible — long base58 string, distinct from the sender.
**Voice-over:** "That recipient is a one-time stealth address. SIP Protocol generates a fresh one per transfer, derived from the recipient's viewing key — no linkability, full compliance."
**Recording notes:** Zoom in on just the address with a soft on-screen zoom (e.g. Keynote's magnifier or Cmd+Scroll). Critical privacy beat — judges expect to see this.

---

### Scene 7 — 12s — Torque dashboard

**On screen:** Switch to tab 2 (Torque platform). Custom Events view shows the live stream. New event lands at top: `sipher_private_send_completed` with the signature visible.
**Click/type:** Switch tabs (Cmd+2 or click). Wait for the event to appear at the top. Optional: click into the event row to expand the payload.
**Expected result:** Event row with `eventName: sipher_private_send_completed`, `userPubkey: C1phrE76...`, `data.tx_signature: <same sig as Solscan>`, `data.network: devnet`, `data.rebate_destination: <stealth>`.
**Voice-over:** "Torque ingests the event — same signature, same wallet. Cross-system attribution, no extra plumbing."
**Recording notes:** This is THE money shot for the judges. If the event hasn't landed within 8s, scroll the stream once to refresh. If still not visible, abort the take. Optional: pre-create one event during dry run so you have a fallback row to point at if the live one stalls.

---

### Scene 8 — 8s — Rebate attribution

**On screen:** Same Torque tab. Navigate to the Incentive (rebate) detail view — show the eligible-wallets List or the incentive recipe summary (epoch, rate, sybil cap).
**Click/type:** Click the Incentives section in left nav, then click into the active Custom Event Rebate incentive.
**Expected result:** Recipe shows: daily epoch, 0.005 SOL per qualifying event, 5/wallet/24h sybil cap. Pool 0.5 SOL on mainnet visible somewhere on screen.
**Voice-over:** "On mainnet, that event qualifies for a half-SOL rebate pool — five-cent rebate per private send, capped to stop sybil abuse. Real SOL, attributed automatically."
**Recording notes:** If the Incentive detail page is slow, fall back to showing the recipe in the project home dashboard. Don't dwell — 8s is tight.

---

### Scene 9 — 6s — Mainnet vs devnet caveat

**On screen:** Quick cut back to Sipher tab. Settings or network indicator visible briefly.
**Click/type:** Nothing — just the visual reset.
**Expected result:** Network badge says "Devnet" (the demo was on devnet; rebate pool is mainnet).
**Voice-over:** "Demo's on devnet. Mainnet pool is funded today — every user who chats a private send earns SOL."
**Recording notes:** Pure cutaway. Don't over-explain the hybrid model — voice-over does it.

---

### Scene 10 — 10s — Closing CTA

**On screen:** Sipher tab. Visible in frame (top-right or footer): `sipher.sip-protocol.org` URL AND `@sipprotocol` handle. Optional: tile of the 5 custom event slugs in a static end card.
**Click/type:** Nothing. Static end frame.
**Expected result:** Clean closing shot, no UI movement.
**Voice-over:** "SIP Protocol — the privacy layer for Web3. Sipher is live at sipher.sip-protocol.org. Follow @sipprotocol on X. Built for Frontier with Torque MCP."
**Recording notes:** Hold the final frame for 2s of silence after the VO ends. Don't fade — hard cut.

---

## Scene Budget Sanity Check

| Scene | Duration |
|---|---:|
| 1 — Opening hook | 8s |
| 2 — Chat prompt | 6s |
| 3 — SignTxCard renders | 10s |
| 4 — Sign with wallet | 8s |
| 5 — Solscan | 6s |
| 6 — Privacy beat | 4s |
| 7 — Torque dashboard | 12s |
| 8 — Rebate attribution | 8s |
| 9 — Mainnet/devnet caveat | 6s |
| 10 — Closing CTA | 10s |
| **Total** | **88s** |

Buffer: 2s of slack you can absorb into scenes 3 or 7 if SignTxCard or dashboard ingestion runs slow.

---

## Voice-Over Master Script

Read this aloud ONCE before recording to set rhythm. Target: ~220 words in 78s of actual speech (10s of static visuals = no VO).

> This is Sipher — chat-driven private payments on Solana, with built-in rebates from Torque. Send, swap, claim — privacy by default, and you get paid for using it.
>
> I ask Sipher to send a tenth of a SOL — privately — to a fresh stealth address.
>
> Sipher builds the transaction server-side, then renders a sign card in the chat. The amount, recipient, and fee are right there — nothing hidden from me.
>
> I sign with Backpack. The transaction goes out, and Sipher's growth hook fires a Torque custom event with the signature.
>
> On-chain in two seconds. Real signature, real transfer.
>
> That recipient is a one-time stealth address. SIP Protocol generates a fresh one per transfer, derived from the recipient's viewing key — no linkability, full compliance.
>
> Torque ingests the event — same signature, same wallet. Cross-system attribution, no extra plumbing.
>
> On mainnet, that event qualifies for a half-SOL rebate pool — five-cent rebate per private send, capped to stop sybil abuse. Real SOL, attributed automatically.
>
> Demo's on devnet. Mainnet pool is funded today — every user who chats a private send earns SOL.
>
> SIP Protocol — the privacy layer for Web3. Sipher is live at sipher.sip-protocol.org. Follow @sipprotocol on X. Built for Frontier with Torque MCP.

**Word count: 222.** **Pacing target:** Conversational, not rushed. If you fall behind, trim the privacy beat (scene 6) phrase "derived from the recipient's viewing key" — keeps the meaning, saves 1.5s.

---

## Post-Production Notes

- **Cut a 5s teaser** from scenes 3+7 for the X announcement reply — SignTxCard render + Torque event land.
- **Caption track:** Generate from the master script above. Verify the wallet pubkey in scene 7 doesn't show full address — slice to `C1phrE76...x85N` if the recorder captured it fully.
- **No background music** for the judge cut. A clean recording with clear VO outranks any soundtrack.
- **Export:** 1080p, H.264, 8 Mbps target bitrate. Keep under 50MB so it embeds anywhere.
