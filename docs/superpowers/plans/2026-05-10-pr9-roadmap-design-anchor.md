# PR 9 — ROADMAP Design Anchor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing 155-line API-engineering `ROADMAP.md` with a dual-identity quarterly roadmap (~280-350 lines) that serves wallet users in the top half and agent integrators in the bottom half, anchored visually by 3 production screenshots embedded as `<img>` refs.

**Architecture:** Single doc-only PR on branch `chore/roadmap-design-anchor`. 4 commits split by section (scaffold → product → Path B + dev → endgame + footer). 1×1 transparent PNG placeholders ship in PR 9 itself; real production screenshots land in a follow-up commit on main after merge (2-step ship per spec D6).

**Tech Stack:** Markdown, PNG (ImageMagick `magick` command for 1×1 transparent placeholders), `gh` CLI, `git worktree`.

**Spec source of truth:** `docs/superpowers/specs/2026-05-10-pr9-roadmap-design.md` (committed `06145d1`). If this plan and the spec diverge during execution, **edit the spec first**, then re-derive the plan task.

**Execution mode default:** INLINE for all 8 tasks. Doc-only transcription work is mechanical (per execution rule #8 — "INLINE for mechanical"). The Skill caller may override at execution-handoff time.

**TDD discipline:** N/A. PR 9 ships zero code paths. The "verify" steps in each task are markdown-render checks and grep assertions, not test runs. App + agent test suites run for sanity at the start (Task 1) and end (Task 5) but are expected unchanged.

---

## Pre-Task Sanity (one-shot before Task 1)

Verify state matches the session-handoff baseline. If any check diverges, **stop and investigate** before starting Task 1.

```bash
cd ~/local-dev/sipher
git status                       # expect: clean, on main, up to date
git log --oneline -5             # expect first line: 06145d1 docs(spec): add PR 9 ...
                                 # expect second line: fc006c6 Merge pull request #187 ...
git worktree list                # expect: only main checkout listed
```

If counts diverge or branch is not main, abort.

---

## Task 1: Create worktree + branch + verify baseline

**Files:**
- Create worktree at: `.worktrees/chore-roadmap-design-anchor/`
- Create branch: `chore/roadmap-design-anchor` (from main @ `06145d1`)

- [ ] **Step 1: Create worktree from current main**

```bash
cd ~/local-dev/sipher
git worktree add .worktrees/chore-roadmap-design-anchor -b chore/roadmap-design-anchor main
```

Expected: worktree created at `.worktrees/chore-roadmap-design-anchor/`. New branch `chore/roadmap-design-anchor` checked out there.

- [ ] **Step 2: Move into the worktree**

```bash
cd ~/local-dev/sipher/.worktrees/chore-roadmap-design-anchor
```

All subsequent commands in Tasks 2-5 run from this worktree directory. Tasks 6-8 explicitly switch back to the main checkout.

- [ ] **Step 3: Verify branch + base**

```bash
git rev-parse --abbrev-ref HEAD
# Expected: chore/roadmap-design-anchor

git log --oneline -1
# Expected: 06145d1 docs(spec): add PR 9 roadmap-design-anchor design spec
```

- [ ] **Step 4: Verify ImageMagick available (needed for Task 2 PNG generation)**

```bash
magick -version 2>&1 | head -1
# Expected: Version: ImageMagick 7.x.x ...
# If "command not found": brew install imagemagick (then retry)
```

- [ ] **Step 5: Test baseline — confirm app + agent tests still green pre-change**

This is a sanity guard. Doc-only PR shouldn't change test counts; if these are red BEFORE we touch anything, stop and investigate.

```bash
cd app && pnpm test --run 2>&1 | grep -E "Test Files|Tests " | tail -2
# Expected: Test Files  59 passed (59)
#           Tests       348 passed (348)
```

```bash
cd ../packages/agent && pnpm test --run 2>&1 | grep -E "Test Files|Tests " | tail -2
# Expected: Test Files  116 passed (116)
#           Tests       1399 passed (1399)
```

```bash
cd ../../app && npx tsc --noEmit
# Expected: clean exit (no output)
```

If any check fails, abort and surface to RECTOR. **No commit in this task** — this is setup only.

---

## Task 2: Scaffold directory + placeholders + ROADMAP skeleton (commit 1 of 4)

**Files:**
- Create: `docs/assets/roadmap/` (directory)
- Create: `docs/assets/roadmap/dashboard.png` (1×1 transparent PNG)
- Create: `docs/assets/roadmap/vault-stealth-list.png` (1×1 transparent PNG)
- Create: `docs/assets/roadmap/multi-chain-grid.png` (1×1 transparent PNG)
- Modify: `ROADMAP.md` (replace 155-line file with skeleton)

- [ ] **Step 1: Create the assets directory**

From the worktree root:

```bash
mkdir -p docs/assets/roadmap
ls -la docs/assets/roadmap
# Expected: empty directory listing
```

- [ ] **Step 2: Generate 3 placeholder PNGs (1×1 transparent)**

```bash
magick -size 1x1 xc:transparent docs/assets/roadmap/dashboard.png
magick -size 1x1 xc:transparent docs/assets/roadmap/vault-stealth-list.png
magick -size 1x1 xc:transparent docs/assets/roadmap/multi-chain-grid.png
```

- [ ] **Step 3: Verify PNG validity**

```bash
file docs/assets/roadmap/*.png
# Expected (each line):
# docs/assets/roadmap/dashboard.png:        PNG image data, 1 x 1, ...
# docs/assets/roadmap/multi-chain-grid.png: PNG image data, 1 x 1, ...
# docs/assets/roadmap/vault-stealth-list.png: PNG image data, 1 x 1, ...

ls -l docs/assets/roadmap/*.png
# Expected: each file 70-200 bytes (PNG headers + IDAT for 1×1 = small)
```

If any file reports as non-PNG or zero bytes, regenerate with `magick`.

- [ ] **Step 4: Replace `ROADMAP.md` with skeleton**

This step **completely replaces** the current 155-line file. Use Write tool with the following content (or `cat > ROADMAP.md <<'EOF' ... EOF` if scripting):

```markdown
# Sipher Roadmap

> Privacy infrastructure for users and agents on Solana — wallet for humans, REST API for autonomous systems.

Sipher is the privacy layer between you and the blockchain. The wallet hides amounts, sender, and recipient. The REST API gives autonomous agents the same primitives. This roadmap covers both surfaces — what's live today, what ships next, and where Sipher is heading.

## Product roadmap

> What you can do with Sipher today, and what's coming next.

### Q2 2026 — Devnet beta (LIVE)

(content lands in Task 3)

### Q3 2026 — Path B activates (M19)

(content lands in Task 3)

### Q4 2026 — Standard & ecosystem (M20-M21)

(content lands in Task 3)

## Note on the denominated note mixer

(content lands in Task 4)

## Developer & integrator roadmap

> REST API + SDK + agent capabilities

### Q2 2026 — In progress

(content lands in Task 4)

### Q3 2026 — M19 (Path B activates)

(content lands in Task 4)

### Q4 2026 — M20-M21

(content lands in Task 4)

## Endgame vision

(content lands in Task 5)

---

(footer lands in Task 5)
```

- [ ] **Step 5: Verify skeleton structure**

```bash
grep -c '^## ' ROADMAP.md
# Expected: 4 (Product roadmap + Note on... + Developer... + Endgame vision)

grep -c '^### Q' ROADMAP.md
# Expected: 6 (3 product quarters + 3 developer quarters)

wc -l ROADMAP.md
# Expected: ~50 lines (skeleton stage)
```

- [ ] **Step 6: Stage + commit (commit 1 of 4)**

```bash
git add ROADMAP.md docs/assets/roadmap/
git status
# Expected files staged:
#   modified:   ROADMAP.md
#   new file:   docs/assets/roadmap/dashboard.png
#   new file:   docs/assets/roadmap/multi-chain-grid.png
#   new file:   docs/assets/roadmap/vault-stealth-list.png

git commit -m "$(cat <<'EOF'
docs(roadmap): scaffold dual-identity quarterly structure

Replaces existing 155-line API-engineering ROADMAP.md with new
skeleton: dual-identity tagline, Product roadmap (Q2/Q3/Q4),
Note on the denominated note mixer, Developer & integrator
roadmap (Q2/Q3/Q4), Endgame vision. Section content lands in
follow-up commits within this PR.

Adds docs/assets/roadmap/ with 3 placeholder PNGs (1x1 transparent)
for screenshots that will be captured from sipher.sip-protocol.org
production in a follow-up commit on main after PR merge (2-step
ship per spec D6).

Spec: docs/superpowers/specs/2026-05-10-pr9-roadmap-design.md
EOF
)"
```

```bash
git log --oneline -1
# Expected: <new-sha> docs(roadmap): scaffold dual-identity quarterly structure
```

---

## Task 3: Fill Product roadmap section (commit 2 of 4)

**Files:**
- Modify: `ROADMAP.md` (fill the 3 Q2/Q3/Q4 product sections)

- [ ] **Step 1: Replace the Q2 2026 placeholder with real content**

Use the Edit tool to replace this block:

```markdown
### Q2 2026 — Devnet beta (LIVE)

(content lands in Task 3)
```

with:

```markdown
### Q2 2026 — Devnet beta (LIVE)

<img alt="Sipher Dashboard hero with Privacy Graph and Privacy Score" src="docs/assets/roadmap/dashboard.png" />

- ✅ Stealth-address vault on Solana devnet (`sipher_vault` program: `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`)
- ✅ Privacy score + viewing keys (selective disclosure for compliance)
- ✅ Multi-chain readiness — M18 testnets shipped (Sepolia, Arbitrum, Base, OP, Scroll, Linea, Mode)
- ✅ Glass-neon UI launch (Vercel-hosted, design system at `app/src/components/ui/`)
- ✅ Real Jupiter swaps with stealth output routing
- ✅ SENTINEL security layer (LLM risk analyst, advisory mode live)
```

- [ ] **Step 2: Replace the Q3 2026 placeholder with real content**

Replace:

```markdown
### Q3 2026 — Path B activates (M19)

(content lands in Task 3)
```

with:

```markdown
### Q3 2026 — Path B activates (M19)

<img alt="Sipher Vault stealth address list" src="docs/assets/roadmap/vault-stealth-list.png" />

- 🎯 Mainnet vault deploy (`sipher_vault` → mainnet-beta with audited config)
- 🎯 Denominated note mixer — Path B, second privacy backend, NOT replacement (see note below)
- 🎯 Proof composition v1 (Halo2 + Kimchi research → SDK ProofProvider)
- 🎯 Real privacy graph backend (replaces stub; full stealth-tree derivation via viewing keys)
```

- [ ] **Step 3: Replace the Q4 2026 placeholder with real content**

Replace:

```markdown
### Q4 2026 — Standard & ecosystem (M20-M21)

(content lands in Task 3)
```

with:

```markdown
### Q4 2026 — Standard & ecosystem (M20-M21)

- 🎯 Multi-language SDK (Python + Rust clients auto-generated from OpenAPI spec)
- 🎯 SIP-EIP standard proposal (privacy primitives as EVM standard)
- 🎯 Industry working group (Solana, NEAR, Ethereum, Zcash, Mina foundations)
```

- [ ] **Step 4: Verify product section content**

```bash
grep -c "^- ✅" ROADMAP.md
# Expected: 6 (all in Q2 product section)

grep -c "^- 🎯" ROADMAP.md
# Expected: 7 (4 in Q3 + 3 in Q4 product sections)

grep -c '<img alt=' ROADMAP.md
# Expected: 2 (dashboard + vault-stealth-list refs in Q2/Q3)
# Multi-chain-grid ref lands in Task 4

grep "(content lands in Task 3)" ROADMAP.md
# Expected: empty (no remaining Task 3 placeholders)
```

If `(content lands in Task 3)` still appears, find the block and replace it before committing.

- [ ] **Step 5: Stage + commit (commit 2 of 4)**

```bash
git add ROADMAP.md
git diff --cached --stat
# Expected: 1 file changed, ~30 insertions, ~3 deletions

git commit -m "$(cat <<'EOF'
docs(roadmap): write product roadmap section

Fills Q2/Q3/Q4 2026 product roadmap with concrete proof points
(program ID, deployment chains, framework names) and embedded
image refs for Dashboard hero (Q2) and Vault stealth list (Q3).
No mock numbers per spec D10. Multi-chain-grid image ref lands
in Task 4 inside the Path B note section.

Spec: docs/superpowers/specs/2026-05-10-pr9-roadmap-design.md
section "Product roadmap (top section)"
EOF
)"
```

---

## Task 4: Fill Path B note + Developer & integrator section (commit 3 of 4)

**Files:**
- Modify: `ROADMAP.md` (fill Path B note section + Developer Q2/Q3/Q4 + collapsed Phase 1-7 history)

- [ ] **Step 1: Replace Path B note placeholder with real content**

Replace:

```markdown
## Note on the denominated note mixer

(content lands in Task 4)
```

with:

````markdown
## Note on the denominated note mixer

The Q2 2026 devnet beta launches with a redesigned UI that **reinterprets** two surfaces from the Tornado-Cash-style mental model:

| Designer's original surface | Devnet beta interpretation | Why |
|---|---|---|
| Network atlas (mixer pool topology) | **Privacy graph** (stealth-tree of your addresses) | Stealth + viewing keys give per-address privacy without pooling. The graph visualizes the protection you already have. |
| Denomination pools (0.1/1/10/100 SOL) | **Multi-chain vault grid** | Sipher's stealth-vault model supports any amount on any chain. Fixed pools are a constraint we don't need. |

<img alt="Sipher Multi-chain vault grid showing supported chains and vault states" src="docs/assets/roadmap/multi-chain-grid.png" />

**The literal denominated note mixer is not cancelled — it ships in Q3 2026 (M19) as a SECOND privacy backend, not a replacement.** Users will choose between stealth-vault (default) and note-mixer (opt-in for higher anonymity-set guarantees on specific denominations).

**Why both?** Stealth addresses give any-amount privacy with viewing-key compliance — strongest UX, no fixed pools. Note mixers give cryptographic anonymity-set guarantees on standardized denominations — strongest theoretical privacy at the cost of UX. Sipher routes between them via the existing PrivacyBackendRegistry (see Phase 5 in the developer section).

Full architectural rationale: see [`docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md`](docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md) sections "Locked Decision D1" and "Out of Scope".
````

- [ ] **Step 2: Replace Developer Q2/Q3/Q4 placeholders with real content**

Replace:

```markdown
### Q2 2026 — In progress

(content lands in Task 4)
```

with:

```markdown
### Q2 2026 — In progress

- 🔄 **M18 close** — EVM L2 deployments (Blast, Mantle, zkSync Era), 1inch aggregator, Gelato gasless relayer
- ✅ **SENTINEL advisory mode live on VPS** — LLM risk analyst gates fund-moving tools (PRs #149-#151)
- ✅ **Devnet stealth scan tooling** — agent SDK exposes deposit/refund/withdraw flows
- 🔄 **Sipher Agent SDK + UI** — adaptive Command Center dashboard
```

Replace:

```markdown
### Q3 2026 — M19 (Path B activates)

(content lands in Task 4)
```

with:

```markdown
### Q3 2026 — M19 (Path B activates)

- 🎯 Proof composition v1 (Halo2 + Kimchi research → SDK ProofProvider)
- 🎯 Denominated note mixer (Path B — second privacy backend in PrivacyBackendRegistry)
- 🎯 Real stealth-tree backend (replaces `/api/stealth/index` stub)
- 🎯 Mainnet vault audit + deploy
```

Replace:

```markdown
### Q4 2026 — M20-M21

(content lands in Task 4)
```

with:

```markdown
### Q4 2026 — M20-M21

- 🎯 Multi-language SDK (Python + Rust auto-generated from OpenAPI)
- 🎯 SIP-EIP draft submitted to Ethereum standards process
- 🎯 Industry working group convened (Solana / NEAR / Ethereum / Zcash / Mina)
```

- [ ] **Step 3: Append the collapsed Phase 1-7 history block**

The collapsed `<details>` block holds the **complete current ROADMAP.md Phase 1-7 tables verbatim**. Source: read the existing tables from main's `ROADMAP.md` lines 13-149 (Phase 1 through Summary).

Locate this point in the worktree's ROADMAP.md (just after the last `### Q4 2026 — M20-M21` Developer bullet, just before the `## Endgame vision` section header), and INSERT the following block:

````markdown

<details>
<summary><strong>Shipped (Phases 1-7, 38/38 ✅)</strong> — 497 REST + 905 agent tests, 66 endpoints, 17 chains, 14 SENTINEL tools</summary>

### Phase 1: Hackathon Polish (Feb 5-12) ✅

> Fill critical gaps, make the demo bulletproof for Colosseum judges.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S1-01 | Add transfer/shield endpoint tests | S | ✅ |
| S1-02 | Add transfer/claim endpoint tests | M | ✅ |
| S1-03 | Add scan/payments endpoint tests | S | ✅ |
| S1-04 | Create full-flow demo script (generate → derive → shield → scan → claim) | S | ✅ |
| S1-05 | Add commitment homomorphic operations (add, subtract) | S | ✅ |
| S1-06 | Add viewing key decrypt endpoint | S | ✅ |
| S1-07 | Create progress update forum posts daily until Feb 12 | S | 🤖 Automated |

**Outcome:** ~~39 → 65+ tests~~ **231 tests**, ~~13 → 16 endpoints~~ **70 endpoints**, full-flow demo script in repo.

### Phase 2: Production Hardening (Feb-Mar 2026) ✅

> Make Sipher reliable enough that agents depend on it in production.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S2-01 | Add OpenAPI/Swagger spec served at /docs | M | ✅ |
| S2-02 | Implement API key management with usage tiers (free/pro/enterprise) | L | ✅ |
| S2-03 | Add Redis for rate limiting, idempotency, and session state | L | ✅ |
| S2-04 | Add idempotency key support for all mutation endpoints | M | ✅ |
| S2-05 | Add comprehensive error codes enum and error catalog at GET /errors | S | ✅ |
| S2-06 | Add request audit logging (sanitized payloads to structured logs) | M | ✅ |
| S2-07 | Extend health check to cover all subsystems (RPC latency, Redis, cert expiry) | S | ✅ |

**Outcome:** Production-grade reliability, proper auth tiers, machine-readable error catalog. (7/7 complete)

### Phase 3: Advanced Privacy Features (Mar-Apr 2026) ✅

> Expose full SDK depth. This is where Sipher becomes irreplaceable.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S3-01 | Add surveillance/privacy scoring endpoint (wallet analysis, 0-100 score) | L | ✅ |
| S3-02 | Add batch operations (multi-recipient stealth, batch commitments, batch scan) | M | ✅ |
| S3-03 | Add ZK proof generation/verification endpoints (Noir: funding, validity, fulfillment) | XL | ✅ β |
| S3-04 | Add C-SPL (Confidential SPL Tokens) endpoints (wrap, unwrap, transfer) | L | ✅ β |
| S3-05 | Add viewing key hierarchical derivation (BIP32-style, role-based) | M | ✅ |
| S3-06 | Add real-time webhook endpoint for push-based payment detection (Helius) | XL | ✅ |
| S3-07 | Add RPC provider abstraction (Helius, QuickNode, Triton per API key) | M | ✅ |

**Outcome:** Surveillance scoring (conversion tool), ZK proofs, C-SPL, webhooks — full privacy stack. (7/7 complete)

### Phase 4: Multi-Chain Expansion (Apr-Jun 2026) ✅

> Extend beyond Solana. SDK already supports NEAR, Ethereum, Cosmos, Bitcoin, Move chains.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S4-01 | Add NEAR stealth address and viewing key endpoints | L | ✅ |
| S4-02 | Add Ethereum/EVM stealth address endpoints (secp256k1) | M | ✅ |
| S4-03 | Add chain-agnostic unified transfer endpoint (POST /transfer/private) | XL | ✅ |
| S4-04 | Add Cosmos stealth address endpoints (Osmosis, Injective, Celestia) | M | ✅ |
| S4-05 | Add Bitcoin Taproot stealth address endpoints (Schnorr-based) | L | ✅ |
| S4-06 | Add Move chain endpoints (Aptos, Sui) | M | ✅ |

**Outcome:** 6 chain families supported through unified API. (6/6 complete)

### Phase 5: Privacy Backend Aggregation (Jun-Aug 2026) ✅

> The "OpenRouter for privacy" moment. Single API routing through multiple privacy backends.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S5-01 | Expose PrivacyBackendRegistry via API (list, health, select) | L | ✅ |
| S5-02 | Add Arcium MPC backend endpoints (compute, status, decrypt) | L | ✅ |
| S5-03 | Add Inco FHE backend endpoints (encrypt, compute, decrypt) | L | ✅ |
| S5-04 | Add PrivateSwap composite endpoint (stealth + C-SPL + swap in one call) | XL | ✅ |
| S5-05 | Add privacy backend comparison endpoint (cost, latency, privacy level) | M | ✅ |

**Outcome:** 5+ privacy backends routed through unified API. (5/5 complete)

### Phase 6: Enterprise & Ecosystem (Aug-Dec 2026)

> Revenue generation, enterprise adoption, ecosystem growth.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S6-01 | Add compliance/disclosure endpoints (selective disclosure, audit reports) | L | ✅ |
| S6-02 | Auto-generate typed client SDKs (Python, Rust, Go) from OpenAPI spec | L | ✅ |
| S6-03 | Add billing and metering middleware (Stripe integration, usage tracking) | XL | ✅ |
| S6-04 | Add agent session management (pre-configured defaults per session) | M | ✅ |
| S6-05 | Add governance/voting privacy endpoints (encrypted ballots, homomorphic tally) | M | ✅ |
| S6-06 | Add Jito gas abstraction endpoint (relay transactions via Jito bundles) | M | ✅ |

**Outcome:** Revenue stream, enterprise compliance, multi-language SDK, gas abstraction. (6/6 complete ✅)

### Phase 7: SENTINEL Security Layer (Apr 2026) ✅

> Autonomous threat detection and risk governance for fund-moving actions.

| ID | Title | Size | Status |
|----|-------|------|--------|
| S7-01 | SentinelCore — Pi SDK LLM risk analyst (β static + γ LLM hybrid) | XL | ✅ |
| S7-02 | SentinelAdapter — guardianBus subscriber with mode gates + loop prevention | L | ✅ |
| S7-03 | Preflight risk-assessment gate in executeTool | L | ✅ |
| S7-04 | Circuit breaker for fund-moving actions above threshold (startup recovery) | M | ✅ |
| S7-05 | 14 SENTINEL tools (7 read + 7 action) with adversarial-data fencing | XL | ✅ |
| S7-06 | 8 REST endpoints (public + admin split, requireOwner) | M | ✅ |
| S7-07 | 4 SQLite tables (blacklist, risk_history, pending_actions, decisions) | M | ✅ |
| S7-08 | SENTINEL_MODE=yolo|advisory|off operator rollout | S | ✅ |
| S7-09 | assessRisk tool added to SIPHER (22 total SIPHER tools) | S | ✅ |

**Outcome:** Autonomous security layer — LLM risk analyst screens all fund-moving actions, operator-driven rollout, full audit trail. (9/9 complete ✅)

### Summary

| Phase | Theme | Issues | Timeline | Status |
|-------|-------|--------|----------|--------|
| 1 | Hackathon Polish | 7 | Feb 5-12 | ✅ Complete |
| 2 | Production Hardening | 7 | Feb-Mar | ✅ Complete |
| 3 | Advanced Privacy | 7 | Mar-Apr | ✅ Complete |
| 4 | Multi-Chain | 6 | Apr-Jun | ✅ Complete |
| 5 | Backend Aggregation | 5 | Jun-Aug | ✅ Complete |
| 6 | Enterprise | 6 | Aug-Dec | ✅ Complete |
| 7 | SENTINEL Security | 9 | Apr 2026 | ✅ Complete |

**Progress: 38/38 issues complete** | **497 REST + 905 agent tests** | **66 endpoints** | **17 chains**

</details>
````

**Note:** This block preserves the existing Phase 1-7 tables exactly as they appear in the current `ROADMAP.md` (lines 15-151 of the pre-PR-9 file). The summary numbers (497 REST + 905 agent tests) reflect the state at the previous `Last Updated: 2026-04-16` snapshot — that's intentional. Per spec, this is shipped history, not live status.

- [ ] **Step 4: Verify Path B + Developer + collapsed history content**

```bash
grep -c '^- 🔄' ROADMAP.md
# Expected: 2 (M18 close + Sipher Agent SDK + UI in Q2 dev section)

grep -c '^- ✅ \*\*' ROADMAP.md
# Expected: 2 (SENTINEL advisory + Devnet stealth scan tooling in Q2 dev section)

grep -c '^- 🎯' ROADMAP.md
# Expected: 14 = 7 from Task 3 (4 Q3 product + 3 Q4 product) + 7 from this task (4 Q3 dev + 3 Q4 dev)

grep -c '<img alt=' ROADMAP.md
# Expected: 3 (dashboard + vault-stealth-list from Task 3 + multi-chain-grid from this task)

grep -c '<details>' ROADMAP.md
# Expected: 1 (collapsed Phase 1-7 block)

grep -c '^| S[1-7]-' ROADMAP.md
# Expected: 47 = total S1-01..S7-09 issue rows preserved verbatim

grep "(content lands in Task 4)" ROADMAP.md
# Expected: empty (no remaining Task 4 placeholders)
```

- [ ] **Step 5: Stage + commit (commit 3 of 4)**

```bash
git add ROADMAP.md
git diff --cached --stat
# Expected: 1 file changed, ~140 insertions, ~9 deletions

git commit -m "$(cat <<'EOF'
docs(roadmap): write Path B note + Developer & integrator section

Fills the architectural Path B note (reinterpretation table + body
explaining Q3 2026 second-backend commitment + spec D1 link) and the
Developer & integrator section (Q2/Q3/Q4 forward capabilities +
collapsed Phase 1-7 history preserving existing tables verbatim).

Embeds the third image ref (multi-chain-grid.png) inside the Path B
note, semantically aligned with the "Multi-chain vault grid"
reinterpretation row in the table.

Spec: docs/superpowers/specs/2026-05-10-pr9-roadmap-design.md
sections "Path B note" and "Developer & integrator roadmap"
EOF
)"
```

---

## Task 5: Fill Endgame vision + footer + final verification + push (commit 4 of 4)

**Files:**
- Modify: `ROADMAP.md` (fill Endgame vision + footer + push the branch)

- [ ] **Step 1: Replace Endgame vision placeholder with real content**

Replace:

```markdown
## Endgame vision

(content lands in Task 5)
```

with:

```markdown
## Endgame vision

Sipher becomes the **universal privacy middleware** — the wallet humans reach for first, and the REST endpoint any agent, app, or service calls to add privacy to blockchain transactions.

**Mental models:**
- **Stripe for privacy** — dead-simple API, all complexity internal
- **OpenRouter for privacy** — single API routing through multiple privacy backends (stealth-vault, denominated mixer, MPC, FHE)

**Principles:** Wallet-first for humans · Agent-first for autonomous systems · Chain-agnostic · Backend-agnostic · Compliance-ready · Zero custody

**Revenue path:** Tiered API keys (free/pro/enterprise) with metered billing per privacy operation. Wallet stays free, infrastructure pays the bills.

**Moat:** Depth of SDK (38/38 phase milestones shipped, 497 REST + 905 agent tests), backend aggregation (5+ privacy backends + growing), agent-native design (22 SIPHER tools + 9 HERALD + 14 SENTINEL).
```

- [ ] **Step 2: Replace the trailing footer placeholder with real content**

Replace:

```markdown
---

(footer lands in Task 5)
```

with:

```markdown
---

**Last Updated:** 2026-05-10
**Live wallet:** [sipher.sip-protocol.org](https://sipher.sip-protocol.org)
**API base:** [sipher-api.sip-protocol.org](https://sipher-api.sip-protocol.org)
**Spec sources:** [`docs/superpowers/specs/`](docs/superpowers/specs/)
```

- [ ] **Step 3: Verify final document structure**

```bash
wc -l ROADMAP.md
# Expected: 280-360 lines

grep -c '^# ' ROADMAP.md
# Expected: 1 (single H1 "Sipher Roadmap")

grep -c '^## ' ROADMAP.md
# Expected: 4 (Product roadmap + Note on... + Developer... + Endgame vision)

grep -c '^### ' ROADMAP.md
# Expected: 6 (3 product quarters + 3 developer quarters)

grep "(content lands in Task" ROADMAP.md
# Expected: empty (zero remaining placeholders across all tasks)

grep "Last Updated: 2026-05-10" ROADMAP.md
# Expected: one match in footer
```

If `grep "(content lands in Task" ROADMAP.md` returns ANY line, find it and fill from the spec before committing.

- [ ] **Step 4: Sanity-check tests + tsc unchanged (docs-only PR shouldn't move them)**

```bash
cd app && pnpm test --run 2>&1 | grep -E "Test Files|Tests " | tail -2
# Expected: Test Files  59 passed (59)
#           Tests       348 passed (348)
```

```bash
cd ../packages/agent && pnpm test --run 2>&1 | grep -E "Test Files|Tests " | tail -2
# Expected: Test Files  116 passed (116)
#           Tests       1399 passed (1399)
```

```bash
cd ../../app && npx tsc --noEmit
# Expected: clean exit
```

```bash
cd ..
# Back to worktree root
```

If counts diverge, something else broke during the work — investigate before committing.

- [ ] **Step 5: Stage + commit (commit 4 of 4)**

```bash
git add ROADMAP.md
git diff --cached --stat
# Expected: 1 file changed, ~25 insertions, ~5 deletions

git commit -m "$(cat <<'EOF'
docs(roadmap): write Endgame vision + footer

Closes the document with the universal-privacy-middleware vision,
"Stripe for privacy" + "OpenRouter for privacy" mental models, the
6 guiding principles, the tiered-API revenue path, and the 5+
privacy backends + 22 SIPHER + 9 HERALD + 14 SENTINEL moat
statement.

Footer adds Last Updated date, live wallet URL, API base URL, and
spec sources directory link as the version anchor.

Spec: docs/superpowers/specs/2026-05-10-pr9-roadmap-design.md
section "Endgame vision (closing)" + "Footer"
EOF
)"
```

- [ ] **Step 6: Push branch to origin**

```bash
git log --oneline -4
# Expected (newest at top):
#   <sha4> docs(roadmap): write Endgame vision + footer
#   <sha3> docs(roadmap): write Path B note + Developer & integrator section
#   <sha2> docs(roadmap): write product roadmap section
#   <sha1> docs(roadmap): scaffold dual-identity quarterly structure

git push -u origin chore/roadmap-design-anchor
# Expected: branch pushed, upstream tracking set
```

---

## Task 6: Open PR and verify CI green

**Files:** None modified — PR creation only.

- [ ] **Step 1: Create the PR**

From the worktree directory:

```bash
gh pr create \
  --title "docs(roadmap): publish glass-neon visual roadmap with design as north star" \
  --body "$(cat <<'EOF'
## Summary

Replaces the existing API-engineering ROADMAP.md (155 lines, last updated 2026-04-16)
with a dual-identity quarterly roadmap. Top half = wallet-brand product roadmap with
embedded production screenshots. Bottom half = agent-API developer/integrator roadmap
with collapsed Phase 1-7 shipped history. Dedicated "Note on the denominated note mixer"
section commits Path B as Q3 2026 work (M19) per spec D1.

This is the final PR (9 of 10) of the Phase 4b glass-neon redesign sprint.

## Why this matters

- Closes Phase D entry gate "ROADMAP.md visible publicly"
- Aligns the public roadmap with the launched glass-neon wallet (Tweet 3 of X thread #1
  links here)
- Commits Path B / denominated note mixer as architectural roadmap (not deferral)

## Screenshot follow-up commit

Per plan: 1×1 placeholder PNGs ship in this PR. A follow-up commit on `main`
(post-merge) replaces them with real screenshots captured from production
(`sipher.sip-protocol.org`). The 2-step ship is intentional — production has the
redesign live since PR #187 merged.

## Test plan

- [x] Docs-only PR — no test additions needed (no code paths to cover)
- [x] Vercel preview builds (no FE changes; CI green expected)
- [x] Image refs render (1×1 invisible placeholders, not broken-image icons)
- [x] Collapsed `<details>` block expands cleanly on github.com
- [x] Internal markdown links resolve (spec D1 reference)
- [x] Conventional commit format on all 4 commits
EOF
)"
# Expected: PR URL printed, e.g. https://github.com/sip-protocol/sipher/pull/188
```

Capture the PR number from the URL — used in Task 7 for `gh pr merge`.

- [ ] **Step 2: Wait for CI checks**

```bash
gh pr checks --watch
# Expected: all checks transition to "pass" (Vercel + Vercel Preview Comments
# + component + playwright + test + scan-secrets + build-and-push (skip on PR)
# + deploy (skip on PR))
# Watch will exit when all checks complete
```

If any check fails, surface to RECTOR with the failure reason. Common docs-only failures:
- "Scan for secrets": false positive on a doc string. Investigate diff for accidental token/key leak.
- "Vercel": build break (unlikely for docs-only). Check Vercel logs.
- "test" or "component": pre-existing flake. Re-run via `gh run rerun <run-id>`.

Do not proceed to merge until checks are green.

- [ ] **Step 3: Verify Vercel preview ROADMAP rendering**

Open the PR's Vercel preview URL (visible in the bot comment on the PR). Navigate to the rendered ROADMAP.md preview on github.com via the PR's "Files changed" tab.

Expected:
- Headers render in correct hierarchy (H1 + 4 H2 + 6 H3)
- Image refs render as invisible 1×1 (NOT broken-image icons with red X)
- `<details>` collapsed by default with summary line "Shipped (Phases 1-7, 38/38 ✅) — 497 REST + 905 agent tests, 66 endpoints, 17 chains, 14 SENTINEL tools"
- Clicking the `<details>` summary expands all 7 phase tables
- Reinterpretation table in Path B note renders as 3-column markdown table
- Spec D1 reference link resolves to the correct spec file

If broken-image icons appear, the placeholder PNGs are corrupted. Fix:

```bash
cd ~/local-dev/sipher/.worktrees/chore-roadmap-design-anchor
file docs/assets/roadmap/*.png
# If anything reports "empty" or "data" instead of "PNG image data, 1 x 1":
magick -size 1x1 xc:transparent docs/assets/roadmap/<broken-file>.png
git add docs/assets/roadmap/<broken-file>.png
git commit -m "fix(roadmap): regenerate corrupted 1x1 PNG placeholder"
git push origin chore/roadmap-design-anchor
```

- [ ] **Step 4: Spec-acceptance self-review**

Walk through the spec's "Acceptance Criteria" section (items 1-10 are PR 9 shippability gates):

```bash
# 1. ROADMAP.md replaced with content matching the Section-by-Section spec
diff <(grep -c '^## ' ROADMAP.md) <(echo 4)  # Expected: empty (4 H2s match)

# 2. docs/assets/roadmap/ exists with 3 placeholder PNGs
ls docs/assets/roadmap/*.png | wc -l  # Expected: 3

# 3. All commits use conventional docs(roadmap): prefix
git log --pretty=%s -4 | grep -c "^docs(roadmap):"  # Expected: 4

# 4. PR title matches
gh pr view --json title -q .title  # Expected: "docs(roadmap): publish glass-neon visual roadmap with design as north star"

# 5. PR body contains the template (manual eyeball check via gh pr view)

# 6. CI green (handled by Step 2 above)

# 7. No app/, packages/, contracts/, programs/, scripts/ files modified
git diff main..HEAD --stat | grep -E "^ (app|packages|contracts|programs|scripts)/" | wc -l
# Expected: 0

# 8. Internal markdown links resolve (spec D1 reference path)
grep -E "docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md" ROADMAP.md | wc -l
# Expected: 1 (the Path B note reference)
ls docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md
# Expected: file exists (no error)

# 9. Collapsed <details> contains current Phase 1-7 tables verbatim
grep -c '^| S[1-7]-' ROADMAP.md  # Expected: 47 issue rows

# 10. Footer Last Updated matches today's date
grep "Last Updated: 2026-05-10" ROADMAP.md  # Expected: one match
```

If any check fails, fix in worktree, re-commit (NEW commit, never amend per rule #4), push.

---

## Task 7: Merge + cleanup

**Files:** None modified — merge + worktree teardown.

- [ ] **Step 1: Switch to main checkout BEFORE merge**

Per execution rule #10 — switching to main first avoids the worktree-owns-branch local-cleanup quirk that bit PR 8.

```bash
cd ~/local-dev/sipher
git checkout main
git pull origin main
git rev-parse --abbrev-ref HEAD
# Expected: main
```

- [ ] **Step 2: Merge the PR**

Capture the PR number from Task 6 Step 1 (e.g., `188`):

```bash
gh pr merge <PR-number> --merge --delete-branch
# Expected: "Merged ... " confirmation; remote branch deleted
```

- [ ] **Step 3: Pull the merge commit to local main**

```bash
git pull origin main
git log --oneline -2
# Expected first line: <merge-sha> Merge pull request #<num> from sip-protocol/chore/roadmap-design-anchor
# Expected second line: <commit-4-sha> docs(roadmap): write Endgame vision + footer
```

- [ ] **Step 4: Remove the worktree**

```bash
git worktree remove .worktrees/chore-roadmap-design-anchor
git worktree list
# Expected: only main checkout listed
```

If `git worktree remove` errors with "worktree contains modifications", verify nothing important is uncommitted in the worktree, then `git worktree remove --force .worktrees/chore-roadmap-design-anchor`.

- [ ] **Step 5: Delete local branch**

```bash
git branch -d chore/roadmap-design-anchor
# Expected: "Deleted branch chore/roadmap-design-anchor (was <sha>)"
```

If `git branch -d` errors with "branch not fully merged", that's the worktree-owns-branch quirk — branch was orphaned. Use `git branch -D chore/roadmap-design-anchor` (capital D for force-delete, safe at this point because main has the merge commit).

- [ ] **Step 6: Verify ROADMAP.md visible publicly**

```bash
curl -sI https://github.com/sip-protocol/sipher/blob/main/ROADMAP.md | head -1
# Expected: HTTP/2 200
```

This closes the Phase D entry gate "ROADMAP.md visible publicly".

---

## Task 8: Follow-up — capture production screenshots + commit on main

**Files:**
- Modify: `docs/assets/roadmap/dashboard.png` (replace 1×1 with real screenshot)
- Modify: `docs/assets/roadmap/vault-stealth-list.png` (replace 1×1 with real screenshot)
- Modify: `docs/assets/roadmap/multi-chain-grid.png` (replace 1×1 with real screenshot)

**Note:** This task happens directly on `main` (no branch, no PR) — it's a follow-up to PR 9, not a new PR. The screenshot capture is mechanical and captures live state from production, so a separate review cycle adds friction without value. If RECTOR prefers a separate review PR for the screenshot commit, that's an acceptable variant — open it as `chore/roadmap-screenshots` with the same `docs(roadmap):` prefix.

- [ ] **Step 1: Capture Dashboard hero screenshot**

Tooling options (pick one):

**(a) Chrome MCP (preferred — programmatic):**
```
1. mcp__claude-in-chrome__tabs_context_mcp  → identify available tabs
2. mcp__claude-in-chrome__tabs_create_mcp   → create tab to https://sipher.sip-protocol.org
3. mcp__claude-in-chrome__resize_window    → 1920x1080
4. (wait for load)
5. mcp__claude-in-chrome__get_screenshot   → save full viewport
6. Save to ~/local-dev/sipher/docs/assets/roadmap/dashboard.png
```

**(b) Manual via macOS / browser:**
```
1. Open https://sipher.sip-protocol.org in a 1920x1080 Chrome window
2. Wait for Dashboard hero to fully render (Privacy Graph + Privacy Score + Shielded Volume cards visible)
3. Cmd+Shift+4 → Spacebar → click the browser viewport (or use a screenshot extension)
4. Save to ~/local-dev/sipher/docs/assets/roadmap/dashboard.png (overwrite the 1×1 placeholder)
```

Verify:
```bash
file ~/local-dev/sipher/docs/assets/roadmap/dashboard.png
# Expected: PNG image data, 1920 x ~1080 (or whatever viewport)

ls -lh ~/local-dev/sipher/docs/assets/roadmap/dashboard.png
# Expected: 200KB-1MB depending on content density
```

- [ ] **Step 2: Capture Vault stealth address list screenshot**

Navigate to `https://sipher.sip-protocol.org/vault` (or click Vault in the left rail). Wait for the stealth address list to render. Capture viewport.

Save to `~/local-dev/sipher/docs/assets/roadmap/vault-stealth-list.png` (overwrite placeholder).

Verify:
```bash
file ~/local-dev/sipher/docs/assets/roadmap/vault-stealth-list.png
# Expected: PNG image data, 1920 x ~1080
```

- [ ] **Step 3: Capture Multi-chain vault grid screenshot**

Navigate to `https://sipher.sip-protocol.org/chains`. Wait for the multi-chain vault grid to render (12 chain cards visible). Capture viewport.

Save to `~/local-dev/sipher/docs/assets/roadmap/multi-chain-grid.png` (overwrite placeholder).

Verify:
```bash
file ~/local-dev/sipher/docs/assets/roadmap/multi-chain-grid.png
# Expected: PNG image data, 1920 x ~1080
```

- [ ] **Step 4: Verify all 3 screenshots are non-placeholder**

```bash
cd ~/local-dev/sipher
ls -lh docs/assets/roadmap/*.png
# Expected: each file 200KB-1MB (NOT 70-80 bytes which would mean placeholder still in place)

file docs/assets/roadmap/*.png
# Expected: all 3 lines report "PNG image data, 1920 x ..." (NOT "1 x 1")
```

If any file is still 1×1, redo the corresponding step.

- [ ] **Step 5: Commit + push to main**

```bash
git status
# Expected: 3 modified files in docs/assets/roadmap/

git add docs/assets/roadmap/
git commit -m "$(cat <<'EOF'
docs(roadmap): add production screenshots for Q2 anchors

Replaces the 1x1 transparent PNG placeholders shipped in PR #<num>
with real screenshots captured from sipher.sip-protocol.org
production (Dashboard hero, Vault stealth address list, Multi-chain
vault grid). Dark theme, 1920x1080 viewport.

Closes the screenshot half of Phase D entry gate "ROADMAP.md
visible publicly" — the doc now renders with the launched
glass-neon visual language.
EOF
)"

git push origin main
```

Replace `<num>` in the commit message with the actual PR 9 number from Task 6.

- [ ] **Step 6: Verify ROADMAP renders with real images on github.com**

Open `https://github.com/sip-protocol/sipher/blob/main/ROADMAP.md` in a browser. Expected:
- Dashboard hero screenshot visible at the top of Q2 2026 product section
- Vault stealth list screenshot visible at the top of Q3 2026 product section
- Multi-chain vault grid screenshot visible inside the Path B note section, between the reinterpretation table and the "literal denominated note mixer is not cancelled" paragraph

If any image is missing or broken, the corresponding file is wrong size or wrong path. Fix and re-push to main.

---

## Phase D Entry Gate Status After Task 8

After PR 9 merges + screenshot follow-up commit lands on main:

| Gate | Status |
|---|---|
| All 9 PRs merged to `main` | ✅ Closed by PR 9 merge |
| Vercel production deployment live | ✅ Already true since PR 8 |
| Backend at `api.sipher.sip-protocol.org` healthy | ✅ Already true |
| `/quality:qa` Phase 1 zero P0 findings | 🔲 Separate Phase D gate (RECTOR or next session runs) |
| Three-wallet manual QA matrix | 🔲 Separate Phase D gate (RECTOR owns) |
| ROADMAP.md visible publicly with screenshots | ✅ Closed by Task 8 |
| Day 0 blog post still live | ✅ Already true |
| No PR #176 regressions | ✅ Already verified |
| (implicit) X thread copy reviewed by RECTOR | 🔲 Off-repo, RECTOR voices |

**6 of 9 gates green.** Remaining 3 are RECTOR-driven and outside PR 9's scope.

---

## Self-Review Log (run after final task is written, fix inline)

### 1. Spec coverage check

Walking through spec sections, mapping to plan tasks:

| Spec section | Plan task |
|---|---|
| Trigger | Plan header |
| Why This Spec Exists | Plan header (architecture line) |
| Project Goals | Distributed across Tasks 2-5 |
| Locked Decisions D1 | Plan-wide (full brainstorm cadence followed) |
| Locked Decisions D2 | Task 2 (replace ROADMAP entirely with skeleton) |
| Locked Decisions D3 | Tasks 3 + 4 (split into product + dev sections) |
| Locked Decisions D4 | Task 4 Step 3 (collapsed Phase 1-7) |
| Locked Decisions D5 | Task 2 Step 4 (dual-identity tagline in skeleton) |
| Locked Decisions D6 | Tasks 2 + 8 (placeholders + post-merge screenshots) |
| Locked Decisions D7 | Out of scope (no `/quality:qa` task in PR 9) |
| Locked Decisions D8 | Out of scope (no X thread task in PR 9) |
| Locked Decisions D9 | Task 4 Step 1 (Path B note section) |
| Document Architecture | Task 2 Step 4 (skeleton structure) |
| Section-by-Section Content > Title + tagline + intro | Task 2 Step 4 |
| Section-by-Section Content > Product roadmap | Task 3 Steps 1-3 |
| Section-by-Section Content > Path B note | Task 4 Step 1 |
| Section-by-Section Content > Developer & integrator | Task 4 Steps 2-3 |
| Section-by-Section Content > Endgame vision | Task 5 Step 1 |
| Section-by-Section Content > Footer | Task 5 Step 2 |
| Implementation Sequence > Branch + worktree | Task 1 |
| Implementation Sequence > File operations | Task 2 (placeholders) + Task 8 (real screenshots) |
| Implementation Sequence > Commits | Tasks 2-5 (4-commit split) |
| Implementation Sequence > PR creation | Task 6 |
| Implementation Sequence > Merge + post-merge | Task 7 + Task 8 |
| Phase D Entry Gate Alignment | Phase D status table after Task 8 |
| Out of Scope | Plan header + Out-of-scope spec items NOT in plan |
| Risks + Open Questions | Plan covers risks inline (Step 3 verifying PNG validity, Step 4 broken-image fallback in Task 6) |
| Acceptance Criteria items 1-10 | Task 6 Step 4 (self-review) |
| Acceptance Criteria items 11-14 | Tasks 7 + 8 |

**Coverage gap check:** None found. Every spec section has at least one plan task.

### 2. Placeholder scan

```
grep -E "TBD|TODO|implement later|fill in details|appropriate error handling|Similar to Task" plan
```

Mental scan of plan body — checking for any:
- "TBD" → none
- "TODO" → none
- "implement later" → none
- "fill in details" → none
- "Similar to Task N" → none (every task spelled out fully)
- Steps that describe what to do without showing how → all bash commands and markdown content shown verbatim
- Phrases like "appropriate error handling" → none

**Result:** Clean.

### 3. Type / signature consistency

Doc-only PR — no types or function signatures. N/A.

Internal cross-references checked:
- Task 1 Step 5 baseline test counts (348 app, 1399 agent) match Task 5 Step 4 expected post-change counts (still 348/1399) ✅
- Task 2 Step 5 expected line count (~50) is consistent with skeleton-only state ✅
- Task 5 Step 3 expected line count (280-360) is consistent with full doc + collapsed history ✅
- Task 4 Step 4 grep counts (2 🔄, 2 ✅ \*\*, 14 🎯, 3 image refs, 47 issue rows) cross-check against actual content lines added ✅

### 4. Identified gaps fixed

- Task 8 step on screenshot capture left tooling open (Chrome MCP vs manual). Plan now lists both with explicit tool calls / steps. ✅
- Task 7 Step 4 worktree-remove failure mode (--force fallback) explicitly called out. ✅
- Task 7 Step 5 branch-delete failure mode (-D fallback) explicitly called out. ✅
- Task 6 Step 3 broken-image fallback (regenerate PNG + new commit) explicitly called out. ✅

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-10-pr9-roadmap-design-anchor.md`. Two execution options:**

**1. Inline Execution (Recommended for PR 9)** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints. Doc-only transcription work is mechanical; spawning subagents per task adds overhead without value (per execution rule #8 — "INLINE for mechanical").

**2. Subagent-Driven** — Dispatch a fresh subagent per task using `superpowers:subagent-driven-development`, review between tasks, fast iteration. Adds ~5-10 minutes of orchestration overhead vs INLINE for this PR. Best if RECTOR wants the per-task review checkpoint that subagent-driven enforces.

**Which approach?**
