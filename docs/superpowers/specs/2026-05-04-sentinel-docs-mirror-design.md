# SENTINEL Docs Public Mirror — Design Spec

**Date:** 2026-05-04
**Status:** Approved scope, ready for implementation plan
**Issue:** [sip-protocol/sipher#159](https://github.com/sip-protocol/sipher/issues/159) — Mirror SENTINEL surface docs to `docs.sip-protocol.org`
**Predecessor spec:** `docs/superpowers/specs/2026-04-27-sentinel-surface-docs-design.md` (created `docs/sentinel/*.md`; filed this work as follow-up #3)
**Related repos:** `sip-protocol/sipher` (source of truth) + `sip-protocol/docs-sip` (Astro Starlight, public site)

## Summary

Publish the five SENTINEL surface docs (`README.md`, `rest-api.md`, `tools.md`, `config.md`, `audit-log.md`) — currently only readable inside the sipher repo — to the public documentation site at `docs.sip-protocol.org/sipher/sentinel/*`. Two paired PRs:

- **PR 1 (docs-sip):** add 5 MDX mirror pages, sidebar nesting, and a sync-rule cheat-sheet in `CLAUDE.md`.
- **PR 2 (sipher):** add a "Public mirror" banner to each of the 5 source MDs, and a mirror-policy section in `CLAUDE.md`.

Sync strategy is **manual + discipline**: each future PR touching `docs/sentinel/*.md` must also update the corresponding `.mdx` in docs-sip. CI automation explicitly deferred (YAGNI for low-priority discoverability work; revisit if drift becomes a real problem).

Mirror fidelity is **minimal conversion**: 1:1 content with six mechanical transforms (frontmatter, H1 strip, GH→Starlight admonitions, internal cross-link rewrite, source-code link rewrite, "Last synced" date). No Starlight component beautification beyond what's needed to render correctly.

## Context

The 2026-04-27 spec created the SENTINEL surface docs (`docs/sentinel/{README,rest-api,tools,config,audit-log}.md`, ~1,252 lines total) as the canonical integrator-facing reference. That work landed in PR #138 and remains the single source of truth.

Public discoverability was filed as follow-up #3 in that spec — a low-priority "nice to have" because the canonical reference is already in-repo. Issue #159 elevates it to actionable scope.

`docs.sip-protocol.org` (repo: `sip-protocol/docs-sip`, framework: Astro 5 + Starlight, deployment: Docker + GHCR) currently has zero Sipher content. The sidebar is structured around the SIP protocol layer (Getting Started, Cookbook, Specifications, Security, etc.) — Sipher is a separate product within the ecosystem, not a peer of "Threat Model" or "NEAR Intents". This is the first Sipher content to enter the public site.

The 2026-05-04 routes-cleanup PRs (#167 + #168, issues #158 + #157) stabilized the SENTINEL REST surface — error envelope contract is locked, dual-cancel route ambiguity is resolved. The mirror is being built against a stable API surface, reducing immediate drift risk.

## Goals

1. Publish all 5 SENTINEL docs as MDX pages on `docs.sip-protocol.org` under a `Sipher / SENTINEL` sidebar nesting.
2. Establish a documented, single-page sync rule (cheat-sheet in `docs-sip/CLAUDE.md`) that any future contributor can follow in <5 minutes.
3. Bidirectional cross-links: source MDs point readers at the public mirror; mirror pages flag the source as canonical and stamp a "Last synced" date.
4. Zero behavior changes. Pure docs work in both repos.
5. Ship as two paired PRs, ordered (docs-sip first, sipher second) so the mirror banner has a working URL on day one.

## Non-goals

- **CI mirror automation** — explicitly deferred. Considered three sync strategies (manual, CI workflow, git submodule); chose manual because (a) 5 small files, (b) low-priority discoverability, (c) team has demonstrated `CLAUDE.md`-driven discipline on prior multi-file changes. Revisit if drift becomes observable.
- **Starlight component beautification** — no `<CardGrid>`, no `<Tabs>`, no custom component imports beyond the one `<Aside>` for the source-of-truth banner. Tables and code fences render fine without re-skinning.
- **Mirroring non-SENTINEL Sipher surface** — Sipher has 58 REST endpoints, 22 agent tools, 9 HERALD tools, and a Pi SDK integration that may eventually deserve public docs. Out of scope; sidebar is structured to leave room (`Sipher` parent with `SENTINEL` as one subgroup).
- **TypeDoc / OpenAPI generation** — already deferred in the parent spec.
- **Mirroring deeper CLAUDE.md or design specs** to public site — only the integrator-facing surface docs.
- **Backporting "Last verified" dates** to anything beyond the 5 mirrored files.

## Architecture

### File layout

**docs-sip side (new):**

```
src/content/docs/sipher/
└── sentinel/
    ├── overview.mdx       ← from sipher/docs/sentinel/README.md (87 lines source)
    ├── rest-api.mdx       ← from sipher/docs/sentinel/rest-api.md (442 lines source)
    ├── tools.mdx          ← from sipher/docs/sentinel/tools.md (465 lines source)
    ├── config.mdx         ← from sipher/docs/sentinel/config.md (72 lines source)
    └── audit-log.mdx      ← from sipher/docs/sentinel/audit-log.md (186 lines source)
```

`README.md` becomes `overview.mdx` because Starlight URL slugs use file basename — `/sipher/sentinel/overview/` reads better than `/sipher/sentinel/readme/`.

**sipher side:** existing file structure untouched. Each of the 5 source MDs gets a 2-line cross-link banner prepended above its existing H1 (described below).

### Sidebar nesting (`astro.config.mjs`)

A new top-level `Sipher` section is appended after the existing `SDK API` block:

```js
{
  label: 'Sipher',
  collapsed: true,
  items: [
    {
      label: 'SENTINEL',
      collapsed: false,
      items: [
        { label: 'Overview', slug: 'sipher/sentinel/overview' },
        { label: 'REST API', slug: 'sipher/sentinel/rest-api' },
        { label: 'Agent Tools', slug: 'sipher/sentinel/tools' },
        { label: 'Configuration', slug: 'sipher/sentinel/config' },
        { label: 'Audit Log', slug: 'sipher/sentinel/audit-log' },
      ],
    },
  ],
},
```

**Information-architecture rationale:** SENTINEL is a subsystem of Sipher, not a peer of `Threat Model` or `NEAR Intents`. Nesting under `Sipher` reflects that and leaves explicit room for future Sipher subgroups (REST API, HERALD, agent tools) without sidebar refactor.

`Sipher` is `collapsed: true` because the section starts with one subgroup and shouldn't dominate visually. `SENTINEL` itself is `collapsed: false` so the 5 child pages are immediately visible once a reader expands `Sipher`.

### Per-page conversion rules

Each `.md` → `.mdx` conversion applies exactly these six transforms:

1. **Prepend frontmatter:**
   ```yaml
   ---
   title: <human title>
   description: <one-line summary, ~140 chars>
   ---
   ```
   Title is the H1 of the source. Description is the first prose paragraph trimmed to ~140 characters.

2. **Strip the source's leading `# H1`.** Specifically: the file's first H1 line outside any code fence (in practice always the first content line after the new mirror banner is removed). Starlight renders the title from frontmatter; leaving the body H1 produces double-titling. Note that several files contain `# …` lines inside ` ```bash ` code fences (shell comments) — those are NOT H1s and must NOT be stripped.

3. **GitHub admonitions → Starlight directives.** Mapping:
   - `> [!WARNING]` + body → `:::caution` + body + `:::`
   - `> [!NOTE]` + body → `:::note` + body + `:::`
   - `> [!IMPORTANT]` + body → `:::tip` + body + `:::`
   - `> [!CAUTION]` + body → `:::danger` + body + `:::`

   Source files today use only `[!NOTE]` (verified via grep on `docs/sentinel/*.md`; the dual-cancel `[!WARNING]` blocks were deleted in PR #168). The other three mappings are documented for future syncs.

4. **Internal cross-links rewrite.** Regex: `\.\/(\w+)\.md` → `/sipher/sentinel/$1/`. Examples:
   - `[REST API](./rest-api.md#post-apisentinelassess)` → `[REST API](/sipher/sentinel/rest-api/#post-apisentinelassess)`
   - `[tools](./tools.md)` → `[tools](/sipher/sentinel/tools/)`

   Anchor fragments (the `#…` part) carry over unchanged — Starlight uses the same GitHub auto-slug rule.

5. **Source-code link rewrite.** Source MDs reference repo paths like `` `packages/agent/src/sentinel/config.ts:40` ``. On the public site these should resolve, so:
   ```diff
   -`packages/agent/src/sentinel/config.ts:40`
   +[`packages/agent/src/sentinel/config.ts:40`](https://github.com/sip-protocol/sipher/blob/main/packages/agent/src/sentinel/config.ts#L40)
   ```
   Mechanical: every backtick-wrapped repo-relative path becomes a hyperlink to that path on `main` at GitHub, with `:N` line suffix becoming `#LN` URL fragment.

6. **`Last verified: YYYY-MM-DD` footer becomes `Last synced: 2026-05-04`** in the source-of-truth `<Aside>` (described in next section). The MD's footer line is removed from the MDX body since the Aside carries the date.

**Mermaid blocks, tables, code fences, prose, and headings (H2 onward) are untouched.**

## Cross-link & banner shape

### Sipher side (top of each `docs/sentinel/*.md`)

A 2-line blockquote prepended above the existing H1:

```md
> 📖 **Public mirror:** [docs.sip-protocol.org/sipher/sentinel/rest-api](https://docs.sip-protocol.org/sipher/sentinel/rest-api/)
> This file is the source of truth. Public mirror is hand-synced — see [docs-sip/CLAUDE.md](https://github.com/sip-protocol/docs-sip/blob/main/CLAUDE.md#sentinel-mirror).

# SENTINEL REST API
```

Each of the 5 files gets the URL slug matching its own page (`overview`, `rest-api`, `tools`, `config`, `audit-log`).

GitHub blockquote with emoji + bold renders cleanly in `gh repo view`, IDE preview, and on github.com. Survives all three readers.

### docs-sip side (top of each `*.mdx`, just under frontmatter)

```mdx
---
title: SENTINEL REST API
description: ...
---

import { Aside } from '@astrojs/starlight/components'

<Aside type="note" title="Source of truth">
This page mirrors [`docs/sentinel/rest-api.md`](https://github.com/sip-protocol/sipher/blob/main/docs/sentinel/rest-api.md) in the [sipher repo](https://github.com/sip-protocol/sipher). For the latest, always check the source. Last synced: **YYYY-MM-DD**.
</Aside>
```

`<Aside>` is Starlight's first-class component (better visual treatment than `:::note`, accepts a `title=` prop that directives don't). The `import` line is one extra line per file — acceptable cost.

**Date convention:** `YYYY-MM-DD` is the date the `.mdx` file was last edited to match the source. For the first sync, set this to the date PR 1 (docs-sip) merges to main. On subsequent syncs, update to the merge date of that paired PR.

### "Last synced" semantics

- **Source side (sipher):** no date; sipher MD is "today's truth" by definition.
- **Mirror side (docs-sip):** `Last synced: YYYY-MM-DD` baked into the `<Aside>`. Updated on every paired PR.

If sipher's MD is edited but docs-sip's MDX is not, the date in the mirror banner reveals the gap. This is the entire drift-detection mechanism — no automation, just date-stamped honesty.

## CLAUDE.md updates

### sipher's `CLAUDE.md` — short pointer section

Add a new section under Quick Reference (or wherever the doc-related rules live), titled **`SENTINEL Docs Mirror Policy`**:

```md
### SENTINEL Docs Mirror Policy

`docs/sentinel/*.md` is the source of truth. A public mirror lives at `docs.sip-protocol.org/sipher/sentinel/*` (Astro Starlight, repo: `sip-protocol/docs-sip`).

**Sync rule:** Any PR that edits `docs/sentinel/*.md` MUST also update the corresponding `.mdx` in `docs-sip/src/content/docs/sipher/sentinel/`, in the same logical change (paired PRs, or a single multi-repo branch). Update the "Last synced: YYYY-MM-DD" date in both files. See [docs-sip/CLAUDE.md](https://github.com/sip-protocol/docs-sip/blob/main/CLAUDE.md#sentinel-mirror) for the six transform rules.
```

The cheat-sheet itself does NOT live in sipher's CLAUDE.md — it lives in docs-sip's CLAUDE.md (where the transform actually executes). Single source of truth even for the sync policy.

### docs-sip's `CLAUDE.md` — full cheat-sheet section

Add a new section, titled **`SENTINEL Mirror`**, with the full 6-rule transform reference:

```md
### SENTINEL Mirror

Source of truth: `sip-protocol/sipher` repo at `docs/sentinel/*.md`. Files in `src/content/docs/sipher/sentinel/*.mdx` are hand-synced mirrors.

**When the source changes, apply these six transforms:**

1. Prepend `--- title / description ---` frontmatter
2. Strip the source's leading `# H1`
3. GH admonitions → Starlight directives:
   - `> [!WARNING]` → `:::caution`
   - `> [!NOTE]` → `:::note`
   - `> [!IMPORTANT]` → `:::tip`
   - `> [!CAUTION]` → `:::danger`
4. Internal cross-links: `./xxx.md` → `/sipher/sentinel/xxx/`
5. Source-code refs: `` `packages/agent/src/...` `` → absolute `https://github.com/sip-protocol/sipher/blob/main/...` URL with `#LN` line suffix
6. Update banner's `Last synced: YYYY-MM-DD`

After sync, run `pnpm build` and verify Starlight compiles cleanly.

Spec for original mirror: [`sipher/docs/superpowers/specs/2026-05-04-sentinel-docs-mirror-design.md`](https://github.com/sip-protocol/sipher/blob/main/docs/superpowers/specs/2026-05-04-sentinel-docs-mirror-design.md).
```

## PR strategy

### Two PRs, ordered

**PR 1 (docs-sip first):** ship the public mirror so the sipher banner has a working URL on day one.
**PR 2 (sipher second):** add the cross-link banner pointing at the now-live docs-sip page + CLAUDE.md mirror policy.

PR 2 is parked if PR 1 lags or gets blocked — sipher banners pointing at a 404 are worse than no banner.

### Branches

- docs-sip: `docs/sentinel-mirror`
- sipher: `docs/sentinel-mirror-policy`

### PR 1 contents (docs-sip repo)

| File | Action |
|---|---|
| `src/content/docs/sipher/sentinel/overview.mdx` | new (from sipher `README.md` + 6 transforms) |
| `src/content/docs/sipher/sentinel/rest-api.mdx` | new (from sipher `rest-api.md` + 6 transforms) |
| `src/content/docs/sipher/sentinel/tools.mdx` | new (from sipher `tools.md` + 6 transforms) |
| `src/content/docs/sipher/sentinel/config.mdx` | new (from sipher `config.md` + 6 transforms) |
| `src/content/docs/sipher/sentinel/audit-log.mdx` | new (from sipher `audit-log.md` + 6 transforms) |
| `astro.config.mjs` | append `Sipher` / `SENTINEL` sidebar block |
| `CLAUDE.md` | add `SENTINEL Mirror` section with 6-rule cheat-sheet |

PR title: `docs(sentinel): mirror sipher SENTINEL surface docs to public site`

### PR 2 contents (sipher repo)

| File | Action |
|---|---|
| `docs/sentinel/README.md` | prepend mirror banner |
| `docs/sentinel/rest-api.md` | prepend mirror banner |
| `docs/sentinel/tools.md` | prepend mirror banner |
| `docs/sentinel/config.md` | prepend mirror banner |
| `docs/sentinel/audit-log.md` | prepend mirror banner |
| `CLAUDE.md` | add `SENTINEL Docs Mirror Policy` section |

PR title: `docs(sentinel): add public-mirror banner + mirror policy`

### Spec & plan location

Both spec and implementation plan live in **sipher repo** (canonical):

- Spec: `docs/superpowers/specs/2026-05-04-sentinel-docs-mirror-design.md` (this file)
- Plan: `docs/superpowers/plans/2026-05-04-sentinel-docs-mirror.md`

docs-sip's `CLAUDE.md` references back to the sipher spec for context.

## Verification

### docs-sip PR

- `pnpm install && pnpm build` — Starlight compiles cleanly (the actual gate; Starlight throws on broken slugs, malformed frontmatter, broken `<Aside>` imports, malformed Mermaid)
- `pnpm dev` — manually load `/sipher/sentinel/rest-api/` (longest, with curl examples + tables) and `/sipher/sentinel/audit-log/` (has `CREATE TABLE` blocks). Verify rendering of:
  - Banner `<Aside>` with title and "Last synced" date
  - GH→Starlight directive conversions render as actual styled callouts
  - Internal cross-links resolve to correct `/sipher/sentinel/<slug>/` URLs
  - Source-code links open the correct GitHub blob page
  - Tables and code fences render
  - Mermaid diagrams render (the README/Overview has a decision-flow diagram)
- Sidebar visible: `Sipher` (collapsed) → expand → `SENTINEL` (open by default) → 5 child pages

### sipher PR

- `pnpm typecheck` — sanity gate (no source code touched)
- Test counts unchanged: agent **1300/104**, app **46/12** (doc-only diff)
- `git diff --stat origin/main..` — verify only `docs/sentinel/*.md` (5 files) and `CLAUDE.md` modified, no source files
- Manual: open one MD in GitHub web view after push to confirm the blockquote banner renders cleanly

## Subagent-driven-development pattern

Mirrors the pattern locked in #157 / #158 / Phase 5 PRs:

- **Mechanical conversion (5 files × 6 transforms):** dispatch as parallel haiku tasks, one implementer per `.md` → `.mdx`. Each task receives the source MD + the cheat-sheet + frontmatter title/description guidance. Output: one `.mdx` file.
- **Sidebar config + CLAUDE.md updates:** sequential, low-risk, single haiku task each.
- **Per-task review:** spec-compliance review + code-quality review, both required, gate task close.
- **Whole-branch review per PR** before push: anchor parity check (do internal cross-link `#anchors` match Starlight's auto-slug for the new H2/H3 headings?), banner consistency, sidebar entries match files on disk.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Drift after first sync | `Last synced` date in `<Aside>` + CLAUDE.md mandate; reviewer-checkable via grep on PR diff |
| Starlight chokes on something subtle (Mermaid syntax, MDX-incompatible HTML in source MD) | `pnpm build` fails loudly; fix in same PR |
| Sipher banner ships before docs-sip PR merges → 404s for readers | PR ordering enforced (docs-sip first); PR 2 description explicitly notes the dependency |
| `<Aside>` import collides with future MDX components | Single-component import is low-risk; if future imports needed, move to a shared layout |
| Starlight's GitHub auto-slug rule diverges from GitHub's for an exotic heading | Whole-branch review includes anchor-parity grep; fix any diverging anchor in same PR |
| Internal contributor unfamiliar with MDX/Starlight syntax | Cheat-sheet in `docs-sip/CLAUDE.md` is the primary onboarding doc; spec is the secondary |

## Rollback

Both PRs are pure docs. Single revert per PR. No DB migrations, no env changes, no behavior code touched, no build-pipeline changes. Trivially reversible. If both shipped and the mirror needs to be unwound:

1. Revert PR 2 (sipher) — banners go away.
2. Revert PR 1 (docs-sip) — mirror pages and sidebar entry go away.

After both reverts, the world is exactly as it was on `main` of either repo before this work.

## Out of scope (deferred)

- **CI mirror automation** — file as separate issue if drift becomes observable after 2-3 manual syncs.
- **Mirroring Sipher's non-SENTINEL docs** (REST surface, HERALD, agent tools) — sidebar already structured to accommodate; separate issues per surface.
- **TypeDoc / OpenAPI generation from JSDoc** — already deferred in parent spec.
- **Custom Starlight components** beyond the one `<Aside>` — out of scope for first sync; revisit if a specific page demands it.
- **Phase 6** Chrome MCP QA against live VPS — separate phase, closes the SENTINEL audit.
- **SENTINEL Phase 3** devnet refund E2E test for `performVaultRefund` — long-deferred, unrelated.
- **SENTINEL Phase 4** mainnet `sipher_vault` deploy — long-deferred, unrelated.

## Success criteria

- [ ] All 5 SENTINEL docs published as MDX at `docs.sip-protocol.org/sipher/sentinel/{overview,rest-api,tools,config,audit-log}`
- [ ] Sidebar shows `Sipher` (collapsed) → `SENTINEL` (open) → 5 child pages
- [ ] Each MDX has frontmatter (title + description), `<Aside>` source-of-truth banner with "Last synced: `<YYYY-MM-DD>`" (date PR 1 merges)
- [ ] All 6 transforms applied per file (frontmatter, H1 strip, admonitions, internal cross-links, source-code links, sync-date footer)
- [ ] `pnpm build` passes in docs-sip on the PR branch
- [ ] All internal cross-links resolve (no 404s in `pnpm dev` walk-through)
- [ ] All 5 sipher source MDs have the public-mirror banner prepended above their existing H1
- [ ] sipher `CLAUDE.md` has new `SENTINEL Docs Mirror Policy` section
- [ ] docs-sip `CLAUDE.md` has new `SENTINEL Mirror` section with 6-rule cheat-sheet
- [ ] sipher `pnpm typecheck` passes; agent test count 1300/104, app 46/12 (unchanged)
- [ ] PR 1 (docs-sip) merged before PR 2 (sipher) is opened
- [ ] Both PRs use lowercase type-prefix titles (`docs(sentinel): …`); no AI attribution; no Co-Authored-By footers
