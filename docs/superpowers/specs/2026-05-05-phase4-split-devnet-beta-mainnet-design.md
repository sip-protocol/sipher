# Phase 4 (Split) — Devnet Beta + Mainnet Fast-Follow Design Spec

**Status:** Approved 2026-05-05 (supersedes `2026-05-04-phase4-mainnet-vault-deploy-design.md`)
**Author:** RECTOR + CIPHER (brainstorm session)
**Predecessor:** `docs/superpowers/specs/2026-05-04-phase4-mainnet-vault-deploy-design.md` (original single-phase Phase 4)

---

## Supersedes Note

The original Phase 4 spec collapsed devnet CPI deploy + mainnet deploy + integration + announcement into one ~4-day push (Stage 1-4 in 24-48h sequence). This revised spec splits it into two phases:

- **Phase 4a — Devnet Beta** (~1 week): public devnet beta with hand-picked + open testers, gated graduation to mainnet
- **Phase 4b — Mainnet** (~1 day, after gate passes): atomic mainnet deploy + env flip + announcement

The split is motivated by a single observation: the CPI version of `withdraw_private` (commit `79133d0`) has never been deployed anywhere. The original plan's "deploy to devnet then mainnet within 24h" leaves no realistic window to observe the CPI flow under public traffic. The split trades ~1 week of wall clock for audit-grade evidence that the full flow works under real-tester usage before real money is on the line.

All other locked decisions from the original spec (D1 full production scope, D2 full public announce, D4 10bps/24h config, D5 reuse `S1P6j1y…wWMd` mainnet authority) carry forward unchanged. Only D3 (sequencing) is revised: was "devnet → mainnet in 24h"; now "devnet beta soak → mainnet on gate pass".

---

## Project Goals

After Phase 4 completes (4a + 4b together):

1. **Mainnet program live** — `sipher_vault` deployed at the `S1Phr5rm…U4kHB` vanity ID with the CPI version of `withdraw_private`, having survived a public devnet beta first.
2. **Public devnet beta closed** — committed evidence of ≥3 days of public usage by ≥3 distinct non-RECTOR wallets, gate criteria all passed.
3. **Production environment switchable via env var** — `SIPHER_NETWORK ∈ {devnet, mainnet}` flips the entire `sipher.sip-protocol.org` deployment in one VPS env edit + restart.
4. **Two blog posts shipped** — devnet beta announce + mainnet launch, both on `blog.sip-protocol.org`.
5. **Three X threads shipped** — devnet beta open (Day 0), mid-beta status (Day 3), mainnet launch (Day 7+).
6. **Zero credential leaks** — Helius API keys + authority keypairs never enter git history; `gitleaks` CI clean throughout.

---

## Locked Decisions

### D1 — Scope: full production (deploy + agent + UI + announce)

Same as original spec D1. Not just deploy — the full integration + UI + agent surface, all flipped from devnet to mainnet at gate-pass time.

### D2 — Posture: full public launch + announce

Same as original spec D2. Mainnet ship is fully public, announced on X + blog. Risk of unaudited code on mainnet with real funds explicitly accepted; mitigations encoded in Section 9 (Risk register).

### D3 — Sequencing: devnet beta soak → gate-pass → mainnet (REVISED)

**Was:** devnet upgrade → E2E test → mainnet deploy in same 24-48h window.
**Now:** devnet upgrade + public beta → ≥3-day soak with public testers → gate criteria pass → mainnet deploy + env flip + announce.

### D4 — Config: 10 bps fee, 86400s refund timeout

Same as original spec D4. Both networks. No re-debate.

### D5 — Authority: `S1P6j1y…wWMd` for mainnet, `FGSkt8M…WWr` for devnet

Same as original spec D5 (mainnet authority). Devnet authority is the existing devnet wallet (already configured on devnet vault). No transfer-of-authority required.

### D6 — Audience for 4a: public devnet beta (NEW)

Open public beta on devnet. Hybrid sourcing (Superteam Indo Day -1, public CT Day 3+). Mainnet announce becomes the v1.0 moment with beta TX evidence as social proof.

### D7 — Gate mechanism: hybrid time + metrics (NEW)

Phase 4a → 4b graduation gated by:
- ≥3 days from public devnet launch (wall-clock)
- ≥5 successful deposits from ≥3 distinct non-RECTOR wallets
- ≥3 successful `withdraw_private` from ≥2 distinct non-RECTOR wallets
- ≥1 successful `authority_refund` (Phase 3 evidence already counts)
- Zero unexplained reverts (definition: anything not classifiable as user-error within 1h of seeing the failed TX)
- Zero authority-side interventions (no manual `set_paused`, `update_fee`, or cleanup TXs from authority)

Failure mode if gate not hit by Day 7: bug-fix sweep PRs, then reassessment (extend / lower bar / ship anyway / defer 4b).

### D8 — Network mechanism: env-var driven `SIPHER_NETWORK` (NEW)

Single env var `SIPHER_NETWORK ∈ {devnet, mainnet}` controls the entire stack. Server reads at boot, propagates to SDK calls. UI fetches via `/api/config` endpoint (no Vite-baked env vars). Phase 4b is a one-line VPS env edit + `docker compose up -d sipher`.

### D9 — Announce strategy: 3 X threads + 2 blog posts (NEW)

- Day -1 (private): Superteam Indo DM kickoff
- Day 0: X thread #1 (devnet beta open) + Blog post #1 (architecture + tester walkthrough)
- Day 3: X thread #2 (mid-beta status, broaden cohort)
- Day ~7 (gate-pass): X thread #3 (mainnet live) + Blog post #2 (beta-to-mainnet journey)

All content drafted by CIPHER, edited + voiced + shipped under RECTOR's name. No AI attribution per CLAUDE.md.

---

## Architecture

### Repo boundaries

| Repo | What it owns |
|---|---|
| `sip-protocol/sip-protocol` | Anchor program (`programs/sipher-vault`), CPI binary, `e2e-cpi-test.ts`, devnet/mainnet deploy scripts, gate-check script |
| `sip-protocol/sipher` | Agent + SDK + Command Center UI; env-var config layer; `/api/config` endpoint; BetaBanner component |
| `sip-protocol/blog-sip` | Two new blog posts (Day 0 + Day 7+) |

### Network → values mapping (resolved server-side at agent startup)

| Property | `devnet` | `mainnet` |
|---|---|---|
| RPC URL | Helius devnet (keyed) | Helius mainnet (keyed) |
| Solana cluster name | `devnet` | `mainnet-beta` |
| `sipher_vault` program ID | `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` | `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB` |
| `VaultConfig` PDA | `CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u` | computed at deploy (same seed → deterministic) |
| Authority pubkey | `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr` | `S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd` |
| Authority keypair path (server) | `/path/on/vps/devnet.json` | `/path/on/vps/authority.json` (decrypted from age) |
| `sip_privacy` CPI target | `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` | `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` |
| Solscan cluster suffix | `?cluster=devnet` | (no suffix) |
| Public RPC fallback (un-keyed, for UI direct reads) | `https://api.devnet.solana.com` | `https://api.mainnet-beta.solana.com` |

### Three layers reading config

1. **Agent (Node.js, `packages/agent/src/`)** — `loadNetworkConfig()` helper called once at startup. Returns typed `NetworkConfig`. Throws and process exits with code 1 if `SIPHER_NETWORK` unset (no silent fallback).

2. **SDK (`@sipher/sdk`)** — stays network-agnostic. Accepts RPC URL + program ID as parameters. No env reads inside SDK code (preserves portability for non-server consumers).

3. **UI (React, `app/`)** — fetches network config from `/api/config`. Caches in Zustand. Renders `<BetaBanner />` conditionally when `network === 'devnet'`. All Solscan links use the cluster suffix from config.

### Why API endpoint (not Vite env vars) for the UI

Vite env vars are baked at build time. Flipping VPS env from devnet→mainnet would still serve the old build until next rebuild — defeats the "5-minute config flip" goal. API endpoint keeps the UI reflecting current server truth; mainnet flip = restart agent → next page load on mainnet.

### `<BetaBanner />` UX

- Top-of-page sticky banner; amber background, dark text
- Copy: `🧪 You're on DEVNET BETA. This is testnet — funds are not real. [Get devnet SOL →](https://faucet.solana.com)`
- Dismissible per session (localStorage), reappears next visit
- Hidden entirely when `network === 'mainnet'`

### Credential hygiene

- New project-isolated key: `SIPHER_HELIUS_API_KEY` (per RECTOR's per-project isolation rule, since `general_use` was killed 2026-04-08)
- Stored in `~/Documents/secret/.env` (local) + VPS systemd env (server). Never in git. `.env.example` ships placeholder `SIPHER_HELIUS_API_KEY=__set_in_vps_only__`
- Origin restriction in Helius dashboard: lock to `sipher.sip-protocol.org`
- `gitleaks` CI step runs on all PRs throughout 4a + 4b. **Note:** sipher CI currently has no secret-scanning workflow; PR-A2 adds `.github/workflows/gitleaks.yml` as a deliverable, configured to scan diffs on every PR + nightly on `main`.
- `/api/config` endpoint whitelist: returns `{ network, clusterName, programIds, vaultConfig, beta, publicRpcUrl, solscanSuffix }`. **Never returns the keyed RPC URL.**
- Authority keypair (mainnet, age-encrypted) decrypted to `/tmp/sip-key-decrypted.json` only at deploy time, cleaned via `sip-keys.sh clean` after

### File-level changes (4a, sipher repo)

```
sipher/
├── packages/agent/src/config/network.ts       ← new — loadNetworkConfig() + NetworkConfig type
├── packages/agent/src/index.ts                ← call loadNetworkConfig() at boot, propagate
├── packages/agent/src/routes/config.ts        ← new — GET /api/config endpoint
├── app/src/components/BetaBanner.tsx          ← new component
├── app/src/components/AppLayout.tsx           ← mount BetaBanner conditionally
├── app/src/lib/networkConfig.ts               ← new — fetches /api/config, Zustand cache
├── app/src/views/VaultView.tsx                ← uses networkConfig for solscan links
└── .env.example                               ← add SIPHER_NETWORK, SIPHER_HELIUS_API_KEY placeholders
```

---

## Phase 4a Scope — Devnet Beta

### PR-A1 — `sip-protocol` repo: devnet CPI program upgrade + E2E

**Output:** Devnet `sipher_vault` program (S1Phr…U4kHB) upgraded to CPI binary; `e2e-cpi-test.ts` passes; pause runbook rehearsed.

Carries forward unchanged from original Phase 4 Stage 1. Files: `programs/sipher-vault/scripts/upgrade-devnet.ts`, `programs/sipher-vault/scripts/e2e-cpi-test.ts`, `programs/sipher-vault/scripts/set-paused.ts`. Tests: existing 17-test Anchor suite continues to pass.

### PR-A2 — `sipher` repo: env-var infra + BetaBanner + agent/UI/SDK wiring

**Output:** All three layers (agent, SDK, UI) read `SIPHER_NETWORK` (transitively); `<BetaBanner />` renders when `network === 'devnet'`; `/api/config` endpoint returns network metadata (no keys); `gitleaks` CI workflow added (`.github/workflows/gitleaks.yml`); deployed to VPS with `SIPHER_NETWORK=devnet`.

**Files** (see Architecture / File-level changes section).

**Tests:**
- Unit: `loadNetworkConfig()` happy paths (devnet, mainnet) + failure path (env unset → throws)
- Unit: `/api/config` endpoint returns expected shape, never includes Helius URL
- Component: `BetaBanner` renders on `network=devnet`, hidden on `network=mainnet`, dismissible, reappears
- Integration: full-stack test where agent boots with `SIPHER_NETWORK=devnet`, UI fetches config, banner renders

**Verification post-deploy:** `curl https://sipher.sip-protocol.org/api/config` returns `{ "network": "devnet", "beta": true, ... }`; manual UI load shows banner.

### PR-A3 — `blog-sip` repo: devnet beta blog post

**Output:** Published post at `blog.sip-protocol.org/sipher-vault-devnet-beta-open` (or similar slug).

**Sections:** What is Sipher Vault → Why a vault for privacy → Architecture (Mermaid diagram) → 7 instructions table → Tester walkthrough → Gate criteria (transparency) → Cross-link to Phase 3 evidence + sip_privacy mainnet.

**Length:** ~1500 words, 4-6 minute read. SEO/LLMO tagged.

### Day -1 to Day 7 — Beta soak + monitoring

| Day | Action |
|---|---|
| -1 | RECTOR DMs Steave/Pratik (Superteam Indo TG) with early-access link |
| 0 | X thread #1 published; Blog post #1 published; VPS already on `SIPHER_NETWORK=devnet` |
| 1-2 | Superteam testers run flows. Bugs triaged via DM/GitHub issues. ~1h/day support max |
| 3 | First gate-check run: `pnpm tsx scripts/devnet-beta-gate-check.ts`. Commit evidence. X thread #2 published. |
| 5 | Second gate-check run; commit evidence |
| 7 | Final gate-check run. If PASS → proceed to 4b. If FAIL → bug-fix sweep + reassessment |

### `scripts/devnet-beta-gate-check.ts`

**Output:** `docs/sentinel/evidence/devnet-beta-gate-{YYYY-MM-DD}.json` with structured criteria results.

**Reads:**
- All `DepositRecord` PDAs on devnet vault program (paginated)
- All TX signatures touching the program (filter for vault ixs)
- Hardcoded `WALLETS_TO_EXCLUDE.json` (RECTOR's known dev wallets)

**Classifies failed TXs:** user-error vs unexplained, with reasons. Definition of unexplained: anything not classifiable as user-error within 1 hour of human review.

**Output schema:**

```json
{
  "checkedAt": "2026-05-08T14:00:00Z",
  "checkedAgainstSlot": 12345678,
  "criteria": {
    "C1_days_since_launch": { "value": 3.4, "pass": true },
    "C2_deposits": { "count": 7, "distinct_wallets": 4, "pass": true },
    "C3_withdraws": { "count": 4, "distinct_wallets": 3, "pass": true },
    "C4_refunds": { "count": 1, "pass": true },
    "C5_reverts": { "total": 2, "user_error": 2, "unexplained": 0, "pass": true },
    "C6_authority_interventions": { "count": 0, "pass": true }
  },
  "overall": "PASS",
  "wallets_observed": ["..."],
  "reverts": [
    { "tx": "...", "error": "RefundNotExpired", "classification": "user_error", "reason": "tester ran refund 22h after deposit" }
  ]
}
```

---

## Phase 4b Scope — Mainnet (Fast-Follow)

### PR-B1 — `sip-protocol` repo: mainnet deploy + initialize + smoke

**Output:** Mainnet `sipher_vault` deployed at `S1Phr5rm…U4kHB`; `VaultConfig` initialized (10 bps, 86400s, authority `S1P6j1y…wWMd`); ≥1 successful deposit + withdraw_private smoke TX captured.

**Atomic deploy:** `programs/sipher-vault/scripts/deploy-mainnet.ts` — deploys binary, waits for confirmation, calls `initialize` ix, runs smoke deposit + withdraw_private all in one script run. No announce window between.

**Authority keypair workflow:** decrypt via `~/Documents/secret/sip-keys/sip-keys.sh decrypt solana/authority.json.age` to `/tmp/sip-key-decrypted.json` immediately before deploy script run. Set `ANCHOR_WALLET=/tmp/sip-key-decrypted.json`. Run `sip-keys.sh clean` immediately after.

**Pre-flight gates** (deploy script aborts if any fails):
- Mainnet authority balance ≥ 6 SOL (peak deploy cost ~5.25 SOL + buffer)
- `anchor --version` resolves to 0.30.1 (via `avm use 0.30.1`)
- Phase 4a gate-check evidence file shows `overall: PASS`
- Local binary hash matches `sip-protocol` `main` HEAD's `sipher_vault.so` build (no stale build)

**Smoke evidence:** `docs/sentinel/evidence/mainnet-smoke-{YYYY-MM-DD}.json` with deposit + withdraw_private TX IDs, balances pre/post, Solscan links.

### PR-B2 — `sipher` repo (or VPS env config commit): flip to mainnet

**Output:** `sipher.sip-protocol.org` running with `SIPHER_NETWORK=mainnet`. BetaBanner hidden. `/api/config` returns mainnet metadata.

**Path A** (likely): VPS env edit + `docker compose up -d sipher`. No code PR — just a small `docs/runbook/phase-4b-flip.md` commit documenting the flip + the actual TX of restart.

**Path B** (if config not yet env-driven on VPS at flip time): Single-line PR updating `~/app/docker-compose.yml`'s service env var. Merge → `docker compose up -d sipher` on VPS.

**24h Stage 2-equivalent wait:** Per success criteria B4, an `authority_refund` evidence TX captured 24h+ after Stage 2 deposit. Plan task explicitly waits this window before declaring 4b done.

### PR-B3 — `blog-sip` repo: mainnet launch blog post

**Output:** Published post at `blog.sip-protocol.org/sipher-vault-mainnet-launch` (or similar slug).

**Sections:** Headline (mainnet live, key TX) → Beta-to-mainnet journey (gate criteria, evidence) → What changed between beta and mainnet (table from Section 2 of this spec) → Architecture deep-dive → Tester credits (with permission) → Risk disclosures (unaudited, monitoring) → What's next (M19 roadmap snippet).

**Length:** ~2000 words. Cross-links to: SENTINEL audit closure, Phase 3 evidence, mainnet Solscan TXs.

### Day-of (mainnet) launch

PR-B1, PR-B2, PR-B3 all merged + deployed same day. X thread #3 published with beta TX evidence quoted.

---

## Gate Criteria + Monitoring

(Gate definition repeated here for spec completeness — also covered in D7.)

### Criteria

| ID | Criterion | Source of truth |
|---|---|---|
| C1 | ≥3 days from public devnet launch | Wall-clock timestamp diff |
| C2 | ≥5 deposits from ≥3 distinct non-RECTOR wallets | `DepositRecord` PDAs filtered |
| C3 | ≥3 `withdraw_private` from ≥2 distinct non-RECTOR wallets | TX history filtered by ix discriminator |
| C4 | ≥1 `authority_refund` | Same |
| C5 | Zero unexplained reverts | Manual classification within 1h per failed TX |
| C6 | Zero authority-side interventions | Authority-signed TXs filtered for admin ixs |

### "Unexplained revert" definition

Failed TX whose error variant is NOT in the user-error allowlist:
- `RefundNotExpired`, `InsufficientBalance`, `InvalidSigner`, `AccountAlreadyInitialized`, `Unauthorized`, `RefundTimeoutNotElapsed` — user error, NOT unexplained
- Arithmetic overflow, account-not-found when SDK said it would exist, CPI fail with no clear root cause, AnchorError variants we didn't anticipate — UNEXPLAINED, fail gate

If a failed TX can't be classified within 1 hour of human review, it counts as unexplained.

### Reverts triage workflow

Helius webhook configured to post failed TXs against vault program → private channel (TG bot or email). Each failed TX eyeballed within ~1 hour. Classified. Unexplained → gate at risk → investigate immediately.

### Decision protocol

| Day | Result | Action |
|---|---|---|
| 3 | PASS | Proceed to 4b same/next day |
| 3 | FAIL but criteria close | Continue beta to Day 5, recheck |
| 5 | FAIL stalled | Bug-fix sweep PRs (A4+) |
| 7 | FAIL | Mandatory reassessment with RECTOR. Options: (a) lower bar, (b) extend to Day 10, (c) ship mainnet anyway accepting risk, (d) defer 4b entirely |

C1 (days-since-launch) does NOT reset on bug-fix PRs. A buggy day still counts as a day.

---

## Announce Strategy

### Channels

X (primary, reach) + Blog (canonical, citable). Telegram/Discord deferred (not active per memory; T3 grant deliverables).

### Threads + posts

- **Day -1, private**: RECTOR DMs Steave/Pratik (Superteam Indo TG) — early-access link
- **Day 0, public**: X thread #1 + Blog post #1
- **Day 3, public**: X thread #2 (mid-beta status)
- **Day ~7, public**: X thread #3 + Blog post #2 (mainnet launch)

### Drafting workflow

CIPHER drafts all 3 X threads + 2 blog posts during 4a (well before publish dates). RECTOR edits/voices/cuts. Ships under RECTOR's name. No "Generated with Claude Code" footers per CLAUDE.md.

### Tester sourcing flow

- Day -1: Superteam Indo private cohort (5-10 testers via DM)
- Day 0-2: Private cohort runs flows; bugs in private DMs / private GitHub issues
- Day 3+: X thread #2 broadens to public CT
- Day 7+: X thread #3 = mainnet launch with beta cohort credits (with permission)

---

## Risk Register + Rollback

### Risks (P=probability, I=impact)

| ID | Risk | P | I | Mitigation |
|---|---|---|---|---|
| A1 | Devnet RPC reset wipes mid-beta evidence | Low | Med | Daily commit of gate-check evidence files; git history survives any reset |
| A2 | Beta tester support burden eats focus | Med | Med | 1h/day max manual reply; bugs to GitHub issues not DMs; expectations set in X thread #1 |
| A3 | Tester cohort fizzles before gate hits | Med | Med | Day 3 X thread broadens to CT; Day 5 fallback: drop bar OR run synthetic tests labeled in evidence |
| A4 | CPI binary bug surfaces in beta | Low | High | Fix in `sip-protocol` PR → upgrade devnet program (`BPFLoaderUpgradeable`) → continue beta. Cost: ~0.01 SOL |
| A5 | Public confusion ("is this real money?") despite banner | Med | Low | Banner non-dismissable on first session; Solscan links use `?cluster=devnet`; FAQ in blog post |
| A6 | `/api/config` leaks Helius API key | Low | High | Whitelist of allowed keys in endpoint; code review gate; `gitleaks` CI step |
| B1 | Mainnet deploy fails (rent/buffer/network) | Low | High | Atomic deploy script; if fails, buffer rent reclaimable via `solana program close`; retry with priority fee bumps |
| B2 | CPI bug in mainnet not caught by beta | Low | Med | This is what beta protects against; if it slips, pause via `set_paused`, redeploy upgrade with fix; 24h refund timeout means depositors self-refundable |
| B3 | Mainnet adversarial pressure (MEV/sandwich) reveals new failures | Med | Med | Not addressable pre-launch; monitor 48h post-launch via Helius webhooks; pause if anything unexplained |
| B4 | Authority keypair compromise (mainnet) | Low | Critical | No `set_authority` ix in current vault; compromise → pause + fork program at new vanity. Out-of-scope to fix this phase, flag for M19 multisig migration |
| B5 | Helius mainnet rate limit on launch day spike | Low | Med | Sipher VPS env has Helius mainnet API key with appropriate tier; worst case temporary fallback to public RPC |
| X1 | Beta evidence too thin for mainnet credibility | Med | Low | Gate criteria conservative; if barely passed, X thread #3 emphasizes evidence quality > quantity |

### Rollback paths

- **4a beta — bug surfaces:** Fix in PR → upgrade devnet program → publish "v1.1 beta" tweet → continue beta. C1 timer does not reset.
- **4a beta — gate not hit by Day 7:** Per Section 7 decision tree → reassess with RECTOR.
- **4b mainnet — deploy fails:** Atomic script aborts; buffer rent reclaimable; retry from scratch. No public announce until B3 conditions met.
- **4b mainnet — bug post-deploy, pre-announce:** Pause via `set_paused = true`. Fix → redeploy upgrade. Reschedule announce.
- **4b mainnet — bug post-announce:** Pause + post X follow-up tweet. Transparency > damage control. 24h refund timeout means user funds aren't trapped.
- **Credential leak (Helius API key):** Rotate in Helius dashboard (5 min) → update VPS env → `docker compose up -d sipher`. Old key dies. No user-visible impact.
- **Credential leak (authority keypair):** EMERGENCY — pause vault → forensic audit of recent TXs → if no malicious TXs, manual fund custody transfer if possible → fork program at new vanity. High-impact, out-of-scope to engineer this phase, but documented.

### Pause runbook

```bash
# Authority signs set_paused=true
ANCHOR_WALLET=<authority-keypair> \
ANCHOR_PROVIDER_URL=<helius-url> \
pnpm tsx scripts/set-paused.ts --paused true --network <devnet|mainnet>

# Verify on-chain
solana account <vault-config-pda> --url <network> | head -10  # paused field = true
```

Post-pause: announce via X within 1 hour; status updates every 4h until resolved.

---

## Success Criteria

### Phase 4a — DONE when ALL pass

| # | Criterion | Verification |
|---|---|---|
| A1 | Devnet program upgraded to CPI binary | `solana program show S1Phr5rm…U4kHB --url devnet` shows new deployed slot |
| A2 | E2E CPI test passes on devnet | `pnpm tsx scripts/e2e-cpi-test.ts --url devnet` exits 0 |
| A3 | Env-var config infra deployed | `curl https://sipher.sip-protocol.org/api/config` returns `{ "network": "devnet", "beta": true, ... }`, no RPC URL leaked |
| A4 | BetaBanner visible on production | Manual: amber banner with "DEVNET BETA" copy renders |
| A5 | Day 0 launched | X thread #1 + Blog post #1 both live, mutual cross-link |
| A6 | Gate criteria all pass | Latest `docs/sentinel/evidence/devnet-beta-gate-{date}.json` shows `overall: PASS` |
| A7 | Zero credential leaks | `gitleaks` CI green throughout 4a |

### Phase 4b — DONE when ALL pass

| # | Criterion | Verification |
|---|---|---|
| B1 | Mainnet program deployed at vanity | `solana program show S1Phr5rm…U4kHB --url mainnet-beta` returns success, ProgramData ~2.62 SOL rent |
| B2 | Mainnet `VaultConfig` initialized | Deserialized account shows `feeBps: 10`, `refundTimeout: 86400`, `authority: S1P6j1y…wWMd`, `paused: false` |
| B3 | Mainnet smoke TX | `docs/sentinel/evidence/mainnet-smoke-{date}.json` with ≥1 deposit + withdraw_private cycle |
| B4 | Mainnet `authority_refund` TX | Same evidence file (or sibling) shows authority_refund 24h+ after a Stage 2 deposit |
| B5 | Production flipped to mainnet | `curl https://sipher.sip-protocol.org/api/config` returns `{ "network": "mainnet", "beta": false, ... }` |
| B6 | BetaBanner removed | Manual: production load shows no banner |
| B7 | Day-of launch published | X thread #3 + Blog post #2 both live, beta TX evidence quoted in both |

### Phase 4 (overall) — DONE when 4a + 4b all 14 criteria pass.

---

## Out-of-Scope (carry-forward from -j.md, unchanged)

- TVL caps, token allowlist, multisig migration
- Mobile (`sip-mobile`) integration
- External audit (deferred to Solana Audit Subsidy V track)
- M19 push (claim linkability fix — separate strategic conversation)
- T3 Superteam grant work tracked elsewhere (this spec doubles as evidence for it though)
- SENTINEL on-chain monitoring of mainnet vault as a real-time dashboard
- Set-authority ix to handle keypair compromise (B4 mitigation deferred to a future spec)

---

## References

- Predecessor spec: `docs/superpowers/specs/2026-05-04-phase4-mainnet-vault-deploy-design.md`
- Phase 3 evidence: `docs/sentinel/evidence/devnet-refund-2026-05-05.json`
- sipher_vault source: `~/local-dev/sip-protocol/programs/sipher-vault/programs/sipher-vault/src/lib.rs`
- Mainnet `sip_privacy`: `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at` (deployed 2026-03-07)
- CLAUDE.md (project): `~/local-dev/sip-protocol/CLAUDE.md`
- CLAUDE.md (user): `~/.claude/CLAUDE.md`
