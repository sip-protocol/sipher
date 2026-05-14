# Torque MCP Preflight

`scripts/torque-preflight.sh` is the single-command verification step RECTOR runs
between (a) renaming the production VPS env vars to the canonical Torque names
and (b) recording the Frontier Hackathon "Build with Torque MCP" demo video.

The script is **read-only** against Torque dashboard state, idempotent, and safe
to re-run as many times as you want. The only outbound POST it makes is a
synthetic event with an intentionally-unregistered slug, which is rejected by
Torque's schema validator — that rejection is the success signal.

## Invocation

```bash
# Default: colored summary, human-readable
scripts/torque-preflight.sh

# Dump full HTTP response bodies for debugging
scripts/torque-preflight.sh --verbose

# Machine-readable JSON (for CI gating later)
scripts/torque-preflight.sh --json

# Disable color (CI logs, pipes, etc.)
NO_COLOR=1 scripts/torque-preflight.sh
```

Exit codes: `0` = READY, `1` = NOT READY, `2` = script misuse / missing dep.

## The seven checks

| # | Check | What it proves | What FAIL means |
|---|-------|----------------|-----------------|
| 1 | VPS health | `GET /api/health` returns 200 | sipher container is down or DNS broken. SSH the `sip` user and run `docker compose ps && docker compose logs --tail 200 sipher`. |
| 2 | Torque integration enabled | `GET /admin/api/torque/status` returns `enabled: true` | VPS env vars not loaded. Set `TORQUE_GROWTH_ENABLED=true`, `TORQUE_API_TOKEN=<token>`, `TORQUE_INGESTER_URL=https://ingest.torque.so` and **restart** the sipher container. Remove any stale `TORQUE_API_KEY`, `TORQUE_MCP_URL`, or `TORQUE_CAMPAIGN_ID_*`. |
| 3 | Ingester reachable from VPS | Same endpoint, `ingesterReachable: true` | The VPS cannot reach `https://ingest.torque.so`. Either the token is invalid (reason=`auth`), egress is blocked (reason=`network`), or Torque is down. |
| 4 | Network correctness | `network: devnet` (hybrid mode) or `network: mainnet-beta` (full mainnet) | Unexpected value. Check `SIPHER_NETWORK` on the VPS. Event ingestion is network-agnostic (payload has no network field), so devnet events still attribute to the mainnet pool's REBATE Incentive — hybrid mode is the canonical setup. |
| 5 | Local env vars sanity | No stale `TORQUE_CAMPAIGN_ID_*` / `TORQUE_API_KEY` / `TORQUE_MCP_URL` in your shell or repo `.env` | Cosmetic only. Torque has no Campaign primitive (see [FRICTION-LOG.md](./FRICTION-LOG.md) entry from 2026-05-12). Remove the keys to avoid future confusion. **The VPS is what matters for the demo, not your laptop.** This emits WARN, never FAIL. |
| 6 | Ingester auth verified (synthetic event) | A `POST` to `https://ingest.torque.so/events` with `eventName=sipher_preflight_test` is rejected with HTTP 400 | Either the network is broken (`HTTP 000`), the token is rejected (`401`/`403`), or Torque silently accepted an unregistered slug (rare — would emit WARN, not FAIL). |
| 7 | Frontend reachable | `GET /` returns 200 with the sipher SPA bundle (not the nginx default page) | Reverse proxy may be up but no upstream serving. Check `docker compose ps` and `/etc/nginx/sites-enabled/sipher.conf` on the VPS. |

## Why check 6 expects a 400

The Torque ingest contract is:

```
POST https://ingest.torque.so/events
Headers: x-api-key: $TORQUE_API_TOKEN
Body:    { userPubkey, timestamp (ms-epoch), eventName, data }
```

The `eventName` field must match a Custom Event slug pre-registered in the
Torque project. Our project (`cmp2as15d05pnk01hiyuf7208`) has five real slugs
plus whatever variants we've added since. The slug `sipher_preflight_test` is
deliberately NOT registered, so the server validates the request body, finds
the slug doesn't match any known Custom Event, and returns HTTP 400 with a
validation message.

That 400 simultaneously proves three things:

1. The host `ingest.torque.so` is reachable from your machine.
2. The `x-api-key` header authenticated successfully (otherwise we'd see 401/403).
3. The request reached Torque's schema validator (otherwise we'd see a 5xx).

Per `packages/agent/src/integrations/torque/mcp-client.ts`, the `TorqueMCPClient`
treats a 400 from the ingester as `validation` / `event_undefined` — not an
auth or network failure. The preflight script mirrors that classification.

## Token handling and the operator-scoped secrets

The script is forbidden from reading
`~/Documents/secret/sipher-vps-secrets.env` (operator-scoped, iCloud encrypted).
Two tokens it may need are sourced as follows:

- **`SIPHER_ADMIN_TOKEN`** (optional, currently unused) — the `/admin/api/torque/status`
  endpoint is public per the comment in `packages/agent/src/routes/admin.ts`
  ("no sensitive data returned"). If the endpoint is later moved behind auth,
  set `SIPHER_ADMIN_TOKEN` in your shell env (or drop a token at
  `~/Documents/secret/sipher-admin-token`) and the script will pass it as a
  Bearer header. The script never echoes the token value.
- **`TORQUE_API_TOKEN`** (optional but recommended) — only used in Check 6,
  the synthetic event probe. Without it, Check 6 is skipped with a WARN.
  Check 3 (ingester reachable **from the VPS**) is the higher-signal version
  of this check anyway, so a skipped Check 6 doesn't block the demo.

## Interpreting common output

### Everything green

```
[OK]   VPS health
[OK]   Torque integration enabled (network: devnet ingester: https://ingest.torque.so)
[OK]   Ingester reachable from VPS
[OK]   Network correctness: devnet (hybrid mode — events on devnet, pool on mainnet)
[OK]   Local env vars sanity
[OK]   Ingester auth verified
[OK]   Frontend reachable

Verdict: READY FOR DEMO
```

You're done. Next step: trigger a real `send` or `swap` from the sipher chat,
sign the transaction in your wallet, and verify the event lands in the Torque
dashboard custom_event stream.

### Check 2 returns non-JSON

If `/admin/api/torque/status` returns HTML (the SPA index page), the request
is being caught by the SPA fallback BEFORE the admin router. Either:

- The deployed build pre-dates PR #269 (canonical-ingest rewrite). Force a
  fresh deploy: `docker compose pull && docker compose up -d`.
- Or the express route ordering changed and the catch-all is registered before
  `/admin`. Inspect `packages/agent/src/index.ts` around the `app.use('/admin', adminRouter)` line.

### Check 4 reports `network: devnet`

This is the canonical hybrid-mode setup: events emit on devnet (cheap, safe
for testing), pool is funded on mainnet (real money for rebate distribution).
Event ingestion at `ingest.torque.so` is **network-agnostic** — the payload
has no network field — so devnet events still attribute to the mainnet pool's
REBATE Incentive. Check passes OK.

To flip to full mainnet (everything on mainnet, events + pool), set
`SIPHER_NETWORK=mainnet` on the VPS and restart.

### Check 6 returns 200 instead of 400

Torque accepted our `sipher_preflight_test` slug. That means either someone
registered it in the dashboard (rename the slug in the script) or Torque
relaxed schema validation. Script emits WARN, not FAIL, because reachability
+ auth are still proven.

## Frontier Hackathon timeline

Judges score on **2026-05-27**. As of 2026-05-15 we have 12 days. Suggested
cadence:

1. **Now** — RECTOR renames VPS env vars manually
2. **Now + 5 min** — run `scripts/torque-preflight.sh`, iterate until all green
3. **+1 day** — record demo video on a green preflight run
4. **+1 day** — submit demo + pinned reply on @sipprotocol announcement tweet
