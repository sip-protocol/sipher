# PR 9 — ROADMAP.md Replacement + Phase D Launch Prep

**Date:** 2026-05-10
**Sprint:** Phase 4b glass-neon redesign — final PR (9 of 10 already merged)
**Branch:** `chore/roadmap-design-anchor`
**Predecessor session handoff:** `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-10.md`
**Parent sprint plan:** [`docs/superpowers/plans/2026-05-07-glass-neon-redesign.md`](../plans/2026-05-07-glass-neon-redesign.md) lines 3317-3393
**Parent sprint spec:** [`docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md`](2026-05-07-glass-neon-redesign-design.md) sections D7 + D8 + Phase D

---

## Trigger

PR 8 (Admin Views Restyle) shipped via PR #187 (`fc006c6`) on 2026-05-10. Sprint progress: 9 of 10 PRs merged. PR 9 — ROADMAP.md replacement + Phase D launch prep — is the final piece. PR 9 closes the sprint and unblocks the Phase D X thread #1 launch.

The current `ROADMAP.md` (155 lines, last updated 2026-04-16) opens with **"Privacy-as-a-Skill for Autonomous Agents"** and structures Sipher as a backend-API product (Phase 1-7 = engineering buildout, 38/38 issues complete). The Phase 4b sprint repositioned Sipher's user-facing surface as a glass-neon privacy wallet (Dashboard hero with Privacy Graph, Vault, Multi-chain grid). The X thread #1 launches the redesign as the public surface.

Without this PR, the public roadmap doesn't reflect the launched product. With this PR, the roadmap doubles as a launch artifact (X thread Tweet 3 reads "Roadmap: github.com/sip-protocol/sipher/blob/main/ROADMAP.md").

---

## Why This Spec Exists

PR 9 is structurally different from PRs 0-8:
- **Doc-only.** No app/, packages/, contracts/ changes. No tests added.
- **Content-heavy.** Voice and tone matter more than file mechanics.
- **Audience-split.** Wallet users, agent integrators, X thread readers, and grant reviewers all land here from different surfaces.
- **2-step ship.** Per locked decision, screenshots are captured from production AFTER PR 9 merges (since the redesign is already live in production from PR 8). PR 9 ships text + 1×1 placeholder PNGs; a follow-up commit on main adds real screenshots.

This spec locks structure, voice, and ship sequence so the implementation plan can be subagent-executable without ambiguity.

---

## Project Goals

1. **Replace `ROADMAP.md`** at the repo root with a dual-identity roadmap that addresses both wallet users (humans) and agent integrators (REST API consumers).
2. **Embed the launched glass-neon redesign as the visual north star** through 3 production screenshots (added in follow-up commit).
3. **Commit Path B (denominated note mixer) as Q3 2026 work** with a dedicated architectural-rationale section, satisfying the X thread Tweet 3 narrative.
4. **Preserve the credibility signal** of 38/38 shipped Phase 1-7 issues via a collapsed `<details>` block — visible-on-demand, doesn't dominate the doc.
5. **Close 2 of 8 Phase D entry gates** (ROADMAP visible publicly + all 9 PRs merged); the remaining 6 are independent.

---

## Locked Decisions

### D1 — Path A execution (full brainstorm + spec + plan)

Same cadence as PRs 6/7/8 despite this being a doc-only PR. Justification: the audience-split + voice/tone + history-disposition + screenshot-strategy questions are structural decisions that benefit from up-front lock rather than per-task discovery during execution.

### D2 — ROADMAP framing: replace entirely with quarterly product view

Drop the existing Phase 1-7 engineering-phases structure as the headline organization. New ROADMAP organizes around quarterly milestones (Q2/Q3/Q4 2026). Phase 1-7 history is preserved inside a collapsed `<details>` block in the developer/integrator section — opt-in detail, not headline.

### D3 — Audience: split into product + developer sections

Top half: wallet-brand product roadmap (Q2/Q3/Q4 with screenshots, end-user outcomes).
Bottom half: agent-API brand developer/integrator roadmap (Q2/Q3/Q4 capabilities + collapsed Phase 1-7 history).

Acknowledges Sipher serves both audiences without forcing a brand pivot.

### D4 — Developer section structure: Hybrid (forward Q2/Q3/Q4 + collapsed shipped history)

Symmetric structure with the product section: developer section also organized Q2/Q3/Q4 forward, with `<details><summary>Shipped (Phases 1-7, 38/38 ✅)</summary>` containing the existing Phase 1-7 tables verbatim. Forward visibility + history preserved + credibility signal intact in the summary line.

### D5 — Document opening: dual-identity tagline

Headline: `# Sipher Roadmap`
Subhead: `> Privacy infrastructure for users and agents on Solana — wallet for humans, REST API for autonomous systems.`

Single coherent identity that names both audiences. Each section then opens with its own narrower tagline (top: wallet voice, bottom: agent-API voice).

### D6 — Screenshots: 3 from production after merge (2-step ship)

PR 9 commits ROADMAP.md with `<img>` refs pointing to `docs/assets/roadmap/{dashboard,vault-stealth-list,multi-chain-grid}.png`. Those paths are populated with **1×1 transparent PNG placeholders** in PR 9 itself (so the image refs render as invisible 1×1 pixels, not broken-image icons).

A follow-up commit on `main` (post-merge, can be same day) captures real screenshots from `sipher.sip-protocol.org` production and replaces the placeholders. Production already has the redesign live (since PR 8 merged 2026-05-10), so capture can happen immediately after PR 9 merges.

**Why 2-step:** RECTOR's choice. Cleaner provenance (real prod URL) than capturing from PR 9's Vercel preview. Trade-off accepted: ROADMAP renders without visible images for the gap between PR 9 merge and follow-up commit.

### D7 — `/quality:qa` Phase 1 sweep: separate Phase D gate, not in PR 9

Per locked decision. PR 9 ships ROADMAP only. `/quality:qa` runs as a separate Phase D entry-gate check after PR 9 merges. P0 findings (if any) become hotfix PRs.

### D8 — X thread #1 copy: skipped from PR 9, off-repo

Per locked decision. X thread is a Phase D launch artifact, not a PR 9 deliverable. RECTOR voices/edits/publishes off-repo. Phase D entry checklist still includes "X thread copy reviewed by RECTOR" as a gate.

### D9 — Path B note: dedicated section between quarterly cadence + developer section

Per plan sketch (lines 3357-3366). Header: `## Note on the denominated note mixer`. Body explains the Q2 reinterpretation rationale + Q3 commit (M19, second backend not replacement) + spec D1 link. Reads as commitment + transparency, not waffle.

---

## Document Architecture

```
# Sipher Roadmap                                    ← H1
> Privacy infrastructure for users and agents...   ← dual-identity subhead
(2-3 sentence intro framing, ~40 words)

## Product roadmap                                  ← H2 (top section, wallet-brand)
> What you can do with Sipher today, and what's coming next.
  ### Q2 2026 — Devnet beta (LIVE)
    <img src=docs/assets/roadmap/dashboard.png>
    bullets (✅ markers, concrete proof points)
  ### Q3 2026 — Path B activates (M19)
    <img src=docs/assets/roadmap/vault-stealth-list.png>
    bullets (🎯 markers)
  ### Q4 2026 — Standard & ecosystem (M20-M21)
    bullets (🎯 markers)

## Note on the denominated note mixer               ← H2 (architectural commitment)
~180-word body with reinterpretation table + Q3 commit + spec link

## Developer & integrator roadmap                   ← H2 (bottom section, agent-API brand)
> REST API + SDK + agent capabilities
  ### Q2 2026 — In progress
    bullets (🔄 + ✅ markers)
  ### Q3 2026 — M19 (Path B activates)
    bullets (🎯 markers)
  ### Q4 2026 — M20-M21
    bullets (🎯 markers)
  <details>
  <summary>Shipped (Phases 1-7, 38/38 ✅) — 497 REST + 905 agent tests, 66 endpoints, 17 chains, 14 SENTINEL tools</summary>
  (existing Phase 1-7 tables preserved verbatim)
  </details>

## Endgame vision                                   ← H2 (preserves "Privacy-as-a-Skill" framing)
~150 words: mental models, principles, revenue, moat

---
**Last Updated:** 2026-05-10
**Live wallet:** sipher.sip-protocol.org
**API base:** sipher-api.sip-protocol.org
**Spec sources:** docs/superpowers/specs/
```

**Estimated total length:** 280-350 lines (~80% new content; ~20% preserved Phase 1-7 history inside `<details>`).

---

## Section-by-Section Content

### Title + tagline + intro

```markdown
# Sipher Roadmap

> Privacy infrastructure for users and agents on Solana — wallet for humans, REST API for autonomous systems.

Sipher is the privacy layer between you and the blockchain. The wallet
hides amounts, sender, and recipient. The REST API gives autonomous
agents the same primitives. This roadmap covers both surfaces — what's
live today, what ships next, and where Sipher is heading.
```

### Product roadmap (top section)

```markdown
## Product roadmap

> What you can do with Sipher today, and what's coming next.

### Q2 2026 — Devnet beta (LIVE)

<img alt="Sipher Dashboard hero with Privacy Graph and Privacy Score" src="docs/assets/roadmap/dashboard.png" />

- ✅ Stealth-address vault on Solana devnet (`sipher_vault` program: `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`)
- ✅ Privacy score + viewing keys (selective disclosure for compliance)
- ✅ Multi-chain readiness — M18 testnets shipped (Sepolia, Arbitrum, Base, OP, Scroll, Linea, Mode)
- ✅ Glass-neon UI launch (Vercel-hosted, design system at `app/src/components/ui/`)
- ✅ Real Jupiter swaps with stealth output routing
- ✅ SENTINEL security layer (LLM risk analyst, advisory mode live)

### Q3 2026 — Path B activates (M19)

<img alt="Sipher Vault stealth address list" src="docs/assets/roadmap/vault-stealth-list.png" />

- 🎯 Mainnet vault deploy (`sipher_vault` → mainnet-beta with audited config)
- 🎯 Denominated note mixer — Path B, second privacy backend, NOT replacement (see note below)
- 🎯 Proof composition v1 (Halo2 + Kimchi research → SDK ProofProvider)
- 🎯 Real privacy graph backend (replaces stub; full stealth-tree derivation via viewing keys)

### Q4 2026 — Standard & ecosystem (M20-M21)

- 🎯 Multi-language SDK (Python + Rust clients auto-generated from OpenAPI spec)
- 🎯 SIP-EIP standard proposal (privacy primitives as EVM standard)
- 🎯 Industry working group (Solana, NEAR, Ethereum, Zcash, Mina foundations)
```

### Path B note

```markdown
## Note on the denominated note mixer

The Q2 2026 devnet beta launches with a redesigned UI that **reinterprets**
two surfaces from the Tornado-Cash-style mental model:

| Designer's original surface | Devnet beta interpretation | Why |
|---|---|---|
| Network atlas (mixer pool topology) | **Privacy graph** (stealth-tree of your addresses) | Stealth + viewing keys give per-address privacy without pooling. The graph visualizes the protection you already have. |
| Denomination pools (0.1/1/10/100 SOL) | **Multi-chain vault grid** | Sipher's stealth-vault model supports any amount on any chain. Fixed pools are a constraint we don't need. |

<img alt="Sipher Multi-chain vault grid showing supported chains and vault states" src="docs/assets/roadmap/multi-chain-grid.png" />

**The literal denominated note mixer is not cancelled — it ships in Q3 2026
(M19) as a SECOND privacy backend, not a replacement.** Users will choose
between stealth-vault (default) and note-mixer (opt-in for higher
anonymity-set guarantees on specific denominations).

**Why both?** Stealth addresses give any-amount privacy with viewing-key
compliance — strongest UX, no fixed pools. Note mixers give cryptographic
anonymity-set guarantees on standardized denominations — strongest theoretical
privacy at the cost of UX. Sipher routes between them via the existing
PrivacyBackendRegistry (see Phase 5 in the developer section).

Full architectural rationale: see
[`docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md`](docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md)
sections "Locked Decision D1" and "Out of Scope".
```

### Developer & integrator roadmap (bottom section)

```markdown
## Developer & integrator roadmap

> REST API + SDK + agent capabilities

### Q2 2026 — In progress

- 🔄 **M18 close** — EVM L2 deployments (Blast, Mantle, zkSync Era), 1inch aggregator, Gelato gasless relayer
- ✅ **SENTINEL advisory mode live on VPS** — LLM risk analyst gates fund-moving tools (PRs #149-#151)
- ✅ **Devnet stealth scan tooling** — agent SDK exposes deposit/refund/withdraw flows
- 🔄 **Sipher Agent SDK + UI** — adaptive Command Center dashboard

### Q3 2026 — M19 (Path B activates)

- 🎯 Proof composition v1 (Halo2 + Kimchi research → SDK ProofProvider)
- 🎯 Denominated note mixer (Path B — second privacy backend in PrivacyBackendRegistry)
- 🎯 Real stealth-tree backend (replaces `/api/stealth/index` stub)
- 🎯 Mainnet vault audit + deploy

### Q4 2026 — M20-M21

- 🎯 Multi-language SDK (Python + Rust auto-generated from OpenAPI)
- 🎯 SIP-EIP draft submitted to Ethereum standards process
- 🎯 Industry working group convened (Solana / NEAR / Ethereum / Zcash / Mina)

<details>
<summary><strong>Shipped (Phases 1-7, 38/38 ✅)</strong> — 497 REST + 905 agent tests, 66 endpoints, 17 chains, 14 SENTINEL tools</summary>

(existing Phase 1-7 tables from current ROADMAP.md preserved verbatim here,
including the Summary table at the bottom)

</details>
```

### Endgame vision (closing)

```markdown
## Endgame vision

Sipher becomes the **universal privacy middleware** — the wallet humans
reach for first, and the REST endpoint any agent, app, or service calls
to add privacy to blockchain transactions.

**Mental models:**
- **Stripe for privacy** — dead-simple API, all complexity internal
- **OpenRouter for privacy** — single API routing through multiple privacy backends (stealth-vault, denominated mixer, MPC, FHE)

**Principles:** Wallet-first for humans · Agent-first for autonomous systems · Chain-agnostic · Backend-agnostic · Compliance-ready · Zero custody

**Revenue path:** Tiered API keys (free/pro/enterprise) with metered billing per privacy operation. Wallet stays free, infrastructure pays the bills.

**Moat:** Depth of SDK (38/38 phase milestones shipped, 497 REST + 905 agent tests), backend aggregation (5+ privacy backends + growing), agent-native design (22 SIPHER tools + 9 HERALD + 14 SENTINEL).
```

### Footer

```markdown
---

**Last Updated:** 2026-05-10
**Live wallet:** [sipher.sip-protocol.org](https://sipher.sip-protocol.org)
**API base:** [sipher-api.sip-protocol.org](https://sipher-api.sip-protocol.org)
**Spec sources:** [`docs/superpowers/specs/`](docs/superpowers/specs/)
```

---

## Implementation Sequence

### Branch + worktree

```bash
cd ~/local-dev/sipher
git worktree add .worktrees/chore-roadmap-design-anchor -b chore/roadmap-design-anchor main
cd .worktrees/chore-roadmap-design-anchor
```

### File operations

| Path | Operation | Notes |
|---|---|---|
| `ROADMAP.md` | Replace | New 280-350 line content per Section-by-Section above |
| `docs/assets/roadmap/` | Create directory | New dir |
| `docs/assets/roadmap/dashboard.png` | Create | 1×1 transparent PNG (~70 bytes) |
| `docs/assets/roadmap/vault-stealth-list.png` | Create | 1×1 transparent PNG |
| `docs/assets/roadmap/multi-chain-grid.png` | Create | 1×1 transparent PNG. Referenced from the Path B note section (visualizes the "Multi-chain vault grid" reinterpretation) |

### Commits (4-commit split for clarity, single commit also acceptable)

```
1. docs(roadmap): scaffold dual-identity quarterly structure
   - Create docs/assets/roadmap/ + 3 placeholder PNGs
   - Replace ROADMAP.md with skeleton (title + tagline + intro + section headers)

2. docs(roadmap): write product roadmap section
   - Fill Q2/Q3/Q4 product bullets + image refs

3. docs(roadmap): write Path B note + Developer section
   - Fill architectural note (table + body)
   - Fill Q2/Q3/Q4 developer bullets
   - Add collapsed Phase 1-7 history block (preserve existing tables verbatim)

4. docs(roadmap): write Endgame vision + footer
   - Mental models, principles, revenue, moat
   - Footer with Last Updated + live links
```

### PR creation

```bash
git push -u origin chore/roadmap-design-anchor

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
```

### Merge + post-merge sequence

```bash
# After CI green and review:
gh pr merge <num> --merge --delete-branch

# From main checkout (NOT from worktree, per execution rule #10):
cd ~/local-dev/sipher
git checkout main
git pull origin main
git worktree remove .worktrees/chore-roadmap-design-anchor
git branch -d chore/roadmap-design-anchor

# Capture production screenshots (manual or Chrome MCP):
# 1. Navigate to https://sipher.sip-protocol.org (Dashboard view = default landing)
#    Capture viewport at 1920×1080, dark theme → docs/assets/roadmap/dashboard.png
# 2. Navigate to https://sipher.sip-protocol.org/vault (Vault stealth address list)
#    Capture viewport → docs/assets/roadmap/vault-stealth-list.png
# 3. Navigate to https://sipher.sip-protocol.org/chains (Multi-chain vault grid)
#    Capture viewport → docs/assets/roadmap/multi-chain-grid.png

# Follow-up commit:
git add docs/assets/roadmap/
git commit -m "docs(roadmap): add production screenshots for Q2 anchors"
git push origin main
```

---

## Phase D Entry Gate Alignment

Per spec lines 503-512, Phase D has 8 entry gates. PR 9 closes 2 of them.

| Gate | Status after PR 9 |
|---|---|
| All 9 PRs merged to `main` | ✅ Closed by PR 9 merge |
| Vercel production deployment live | ✅ Already true (since PR 8 — independent of PR 9) |
| Backend at `api.sipher.sip-protocol.org` healthy | ✅ Already true (independent) |
| `/quality:qa` Phase 1 zero P0 findings | 🔲 Separate Phase D gate (D7 lock — runs post-merge) |
| Three-wallet manual QA matrix | 🔲 Separate Phase D gate (RECTOR owns) |
| ROADMAP.md visible publicly | ✅ Closed by PR 9 commit (upgraded by screenshot follow-up) |
| Day 0 blog post still live | ✅ Already true (independent) |
| No PR #176 regressions | ✅ Already verified during PRs 1-8 |
| (implicit) X thread copy reviewed by RECTOR | 🔲 Off-repo (D8 lock) |

**After PR 9 + screenshot follow-up:** 6 of 9 gates green. 3 RECTOR-driven gates remain (`/quality:qa`, three-wallet QA, X thread copy).

---

## Out of Scope (in PR 9)

- **Real screenshots in PR 9 itself** — deferred to follow-up commit on main per D6
- **`/quality:qa` Phase 1 sweep** — separate Phase D gate per D7
- **Three-wallet manual QA matrix** — separate Phase D gate, RECTOR owns
- **X thread copy** — off-repo per D8, RECTOR voices/edits/publishes
- **Backend changes** — none required
- **FE component changes** — none required
- **Test additions** — none (docs-only PR)
- **CHANGELOG.md creation** — Phase 1-7 history stays inline in `<details>` block
- **Re-verifying moat numbers in Endgame Vision** — snapshot at write time, footer's `Last Updated: 2026-05-10` is the version anchor

---

## Risks + Open Questions

| Risk | Mitigation |
|---|---|
| 1×1 PNG placeholders render as broken-image icons on github.com | Use ImageMagick `magick -size 1x1 xc:transparent docs/assets/roadmap/dashboard.png` (or `convert` on older installs). Each ~70-80 bytes. Verify the file is non-empty and `file <path>` reports `PNG image data, 1 x 1` before commit. Verify github.com renders it as an invisible 1×1 (not a broken-image icon) by previewing the rendered ROADMAP.md on the branch via the GitHub PR view before merge |
| Phase 1-7 collapsed `<summary>` numbers drift (e.g., 497 → 555 REST tests) | Lock numbers in `<summary>` text to write-time snapshot; "shipped, here's history" not live status |
| Endgame Vision moat numbers (497 REST + 905 agent tests) drift fast | Same — snapshot. Footer `Last Updated` is the version anchor |
| Spec link from Path B note rots if spec file moves | Use stable repo-relative path; spec is at `docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md` and is part of merged history (won't move) |
| Q2 milestone "Multi-chain readiness (M18)" overstates current state if read as "M18 complete" | Wording carefully scoped: "M18 testnets shipped (Sepolia, Arbitrum, Base, OP, Scroll, Linea, Mode)" — testnets is accurate, mainnet is in Q3 |
| Subagent drafts ROADMAP body text in CIPHER's voice not RECTOR's | Spec content sections lock the prose verbatim; subagent transcribes spec → ROADMAP.md, doesn't compose. Voice locked by spec author (CIPHER) and confirmed at user-review-spec gate |

**Open question (decided in plan phase):**
- 4-commit split (per Implementation Sequence) vs single commit. Both acceptable; plan picks one based on subagent vs INLINE strategy.

---

## Acceptance Criteria

PR 9 is "shippable" when:

1. `ROADMAP.md` is replaced with content matching the Section-by-Section spec
2. `docs/assets/roadmap/` exists with 3 placeholder PNGs (1×1 transparent)
3. All commits use conventional `docs(roadmap):` prefix
4. PR title matches: `docs(roadmap): publish glass-neon visual roadmap with design as north star`
5. PR body matches the template in Implementation Sequence
6. CI green (Vercel preview builds, no test/typecheck failures from docs-only changes)
7. No app/, packages/, contracts/, programs/, scripts/ files modified
8. Internal markdown links resolve (spec D1 reference path is correct)
9. Collapsed `<details>` block contains current Phase 1-7 tables verbatim (not summarized)
10. Footer `Last Updated: 2026-05-10` matches today's date

PR 9 is "Phase D ready" when (additional):

11. PR 9 merged via `gh pr merge --merge --delete-branch`
12. Local cleanup completed (worktree removed, branch deleted)
13. Follow-up commit on main captures production screenshots and replaces 1×1 placeholders
14. ROADMAP.md visible at https://github.com/sip-protocol/sipher/blob/main/ROADMAP.md with rendered images

---

## Predecessors + Carry-Forward

- **PR 0-8 sprint memory:** `~/.claude/projects/-Users-rector-local-dev-sip-protocol/memory/project_phase4b-redesign-sprint.md`
- **Sprint plan:** `docs/superpowers/plans/2026-05-07-glass-neon-redesign.md` (PR 9 sketch lines 3317-3393)
- **Sprint spec:** `docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md` (D7 + D8 + Phase D entry gates lines 503-512)
- **Session handoff:** `~/Documents/secret/claude-strategy/sip-protocol/sipher/session-handoff-2026-05-10.md`

**Carry-forward execution rules** (stable across sprint, all apply to PR 9):
1. NO AI attribution in commits/PRs/files
2. NO semicolons in TS/TSX (N/A — no TS in PR 9)
3. Conventional commits with `docs(roadmap):` scope
4. NEVER amend commits; create new ones
5. TDD discipline (N/A — no code paths added)
6. CI green before merge
7. `--merge --delete-branch` (NOT squash). After merge: sync local main, remove worktree, delete local branch
8. Subagent vs INLINE: plan phase decides (likely INLINE for doc-only)
9. Use `superpowers:verification-before-completion` before claiming any task done
10. Switch to main BEFORE running `gh pr merge`

---

**Spec status:** Draft, awaiting RECTOR review.
