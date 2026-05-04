# SENTINEL Docs Public Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror the 5 SENTINEL surface docs from `sip-protocol/sipher` to `docs.sip-protocol.org` (Astro Starlight), with bidirectional cross-links and a hand-sync policy documented in both repos' `CLAUDE.md`.

**Architecture:** Two paired PRs. PR 1 (docs-sip) ships first to give the sipher mirror banner a working URL on day one. PR 2 (sipher) adds public-mirror banners to source MDs + a CLAUDE.md sync policy. Sync is manual + discipline; a 6-rule transform cheat-sheet lives in `docs-sip/CLAUDE.md`. No CI mirror automation, no Starlight component beautification beyond a single `<Aside>`.

**Tech Stack:** Astro 5 + Starlight (docs-sip), Markdown / GitHub Flavored Markdown (sipher), MDX with Starlight directives (`:::caution`, `:::note`) and `<Aside>` component.

**Spec:** `docs/superpowers/specs/2026-05-04-sentinel-docs-mirror-design.md`
**Issue:** [sip-protocol/sipher#159](https://github.com/sip-protocol/sipher/issues/159)

---

## Pre-flight: Repo State at Plan Start

| Repo | Path | Branch | HEAD | Status |
|---|---|---|---|---|
| sipher | `~/local-dev/sipher/` | `docs/sentinel-mirror-policy` | `d886390` (spec commit) | clean |
| docs-sip | `~/local-dev/docs-sip/` | `main` | `3ed496a` | clean |

Both repos already cloned locally. The sipher branch already exists (created with the spec commit). The docs-sip branch is created in Task 1.0.

---

## File Structure

### docs-sip (PR 1 — created files)

| File | Source | Lines (source) | Purpose |
|---|---|---|---|
| `src/content/docs/sipher/sentinel/overview.mdx` | sipher `docs/sentinel/README.md` | 87 | SENTINEL overview, modes, decision flow, quickstart |
| `src/content/docs/sipher/sentinel/rest-api.mdx` | sipher `docs/sentinel/rest-api.md` | 442 | 10 REST endpoints with auth, request/response, curl examples |
| `src/content/docs/sipher/sentinel/tools.mdx` | sipher `docs/sentinel/tools.md` | 465 | 14 SENTINEL tools + `assessRisk` reference |
| `src/content/docs/sipher/sentinel/config.mdx` | sipher `docs/sentinel/config.md` | 72 | 15 environment variables |
| `src/content/docs/sipher/sentinel/audit-log.mdx` | sipher `docs/sentinel/audit-log.md` | 186 | SQLite audit-log schema with verbatim CREATE TABLE |

### docs-sip (PR 1 — modified files)

| File | Modification |
|---|---|
| `astro.config.mjs` | Append `Sipher / SENTINEL` sidebar block after the existing `SDK API` section |
| `CLAUDE.md` | Add `SENTINEL Mirror` section with the 6-rule transform cheat-sheet |

### sipher (PR 2 — modified files)

| File | Modification |
|---|---|
| `docs/sentinel/README.md` | Prepend mirror banner above existing H1 |
| `docs/sentinel/rest-api.md` | Prepend mirror banner above existing H1 |
| `docs/sentinel/tools.md` | Prepend mirror banner above existing H1 |
| `docs/sentinel/config.md` | Prepend mirror banner above existing H1 |
| `docs/sentinel/audit-log.md` | Prepend mirror banner above existing H1 |
| `CLAUDE.md` | Add `SENTINEL Docs Mirror Policy` section under existing rules |

---

## Reference: The 6 Conversion Transforms

Every `.md` → `.mdx` conversion applies exactly these transforms (verbatim from spec §"Per-page conversion rules"):

### Transform 1 — Prepend frontmatter

```yaml
---
title: <human title>
description: <one-line summary, ~140 chars>
---
```

Per-file titles & descriptions are listed in their respective tasks below.

### Transform 2 — Strip leading H1

Remove the source's first `# H1` line outside any code fence. In practice this is line 1 of the source file. Several files contain `# …` lines INSIDE ` ```bash ` code fences (shell comments) — those are NOT H1s and must NOT be stripped.

### Transform 3 — GitHub admonitions → Starlight directives

```diff
-> [!NOTE]
-> Body text here.
+:::note
+Body text here.
+:::
```

Mappings:
- `[!WARNING]` → `:::caution`
- `[!NOTE]` → `:::note`
- `[!IMPORTANT]` → `:::tip`
- `[!CAUTION]` → `:::danger`

Source files today use only `[!NOTE]` (verified at plan-write time). The other three are forward documentation.

The `>` prefix is stripped from each body line; the directive opener and closer occupy their own lines with no leading `>`.

### Transform 4 — Internal cross-links

Regex: `\.\/(\w[\w-]*)\.md` → `/sipher/sentinel/$1/`

```diff
-[REST API](./rest-api.md#post-apisentinelassess)
+[REST API](/sipher/sentinel/rest-api/#post-apisentinelassess)
```

Anchor fragments (`#…`) carry over unchanged. Starlight uses the same GitHub auto-slug rule.

The README.md special case: it links to `../superpowers/specs/...` — these are repo-internal spec files NOT mirrored to docs-sip. Convert to absolute GitHub URLs:

```diff
-[`docs/superpowers/specs/2026-04-15-sentinel-formalization-design.md`](../superpowers/specs/2026-04-15-sentinel-formalization-design.md)
+[`docs/superpowers/specs/2026-04-15-sentinel-formalization-design.md`](https://github.com/sip-protocol/sipher/blob/main/docs/superpowers/specs/2026-04-15-sentinel-formalization-design.md)
```

### Transform 5 — Source-code link rewrite

Backtick-wrapped repo-relative paths become hyperlinks to `main` at GitHub. The `:N` line suffix becomes `#LN` URL fragment. The `:N-M` range suffix becomes `#L<N>-L<M>`.

```diff
-`packages/agent/src/sentinel/config.ts:40`
+[`packages/agent/src/sentinel/config.ts:40`](https://github.com/sip-protocol/sipher/blob/main/packages/agent/src/sentinel/config.ts#L40)

-`packages/agent/src/db.ts:244-245`
+[`packages/agent/src/db.ts:244-245`](https://github.com/sip-protocol/sipher/blob/main/packages/agent/src/db.ts#L244-L245)
```

Apply only to backtick-wrapped repo paths, not to bare prose mentions of paths.

### Transform 6 — Footer handling

The MD source ends with a footer line like `*Last verified: 2026-05-04*`. Remove this line from the MDX body. The "Last synced: `<YYYY-MM-DD>`" date lives in the `<Aside>` source-of-truth banner near the top instead.

---

## Reference: Worked Example

Source (`docs/sentinel/audit-log.md`, lines 180-182):

```md

> [!NOTE]
> `DB_PATH` env var defines the SQLite file location. Defaults: `/app/data/sipher.db` in production, `:memory:` for tests. See `packages/agent/src/db.ts:244-245`.
```

After Transforms 3 + 5:

```md

:::note
`DB_PATH` env var defines the SQLite file location. Defaults: `/app/data/sipher.db` in production, `:memory:` for tests. See [`packages/agent/src/db.ts:244-245`](https://github.com/sip-protocol/sipher/blob/main/packages/agent/src/db.ts#L244-L245).
:::
```

Things to notice:
- `> [!NOTE]` opener became `:::note`
- `>` prefix stripped from body line
- `:::` closer added
- Backtick-wrapped repo path with `:244-245` line range became a GitHub link with `#L244-L245`
- Bare backtick paths that are NOT real repo paths (`/app/data/sipher.db`, `:memory:`) stayed unchanged

---

## Reference: The Source-of-Truth Banner (`<Aside>`)

Used at the top of every MDX file, just under the frontmatter:

```mdx
---
title: ...
description: ...
---

import { Aside } from '@astrojs/starlight/components'

<Aside type="note" title="Source of truth">
This page mirrors [`docs/sentinel/<filename>.md`](https://github.com/sip-protocol/sipher/blob/main/docs/sentinel/<filename>.md) in the [sipher repo](https://github.com/sip-protocol/sipher). For the latest, always check the source. Last synced: **`<YYYY-MM-DD>`**.
</Aside>
```

Replace `<filename>` with the source filename (e.g., `rest-api`). Replace `<YYYY-MM-DD>` with the date PR 1 merges.

---

## Reference: The Sipher Mirror Banner (Markdown blockquote)

Used at the very top of every sipher source MD, above the existing H1:

```md
> 📖 **Public mirror:** [docs.sip-protocol.org/sipher/sentinel/<slug>](https://docs.sip-protocol.org/sipher/sentinel/<slug>/)
> This file is the source of truth. Public mirror is hand-synced — see [docs-sip/CLAUDE.md](https://github.com/sip-protocol/docs-sip/blob/main/CLAUDE.md#sentinel-mirror).

# <existing H1>
```

Replace `<slug>` with `overview` for README.md, otherwise the source file's basename without extension.

---

# PR 1 — docs-sip (mirror site)

Working directory: `~/local-dev/docs-sip/`

---

### Task 1.0: Set up branch and verify clean baseline

**Files:** none modified yet

- [ ] **Step 1: Verify clean state and create branch**

Run:
```bash
cd ~/local-dev/docs-sip
git status --short
# Expected: empty output
git checkout main
git pull origin main
git checkout -b docs/sentinel-mirror
```

- [ ] **Step 2: Verify Starlight builds cleanly on main (baseline)**

Run:
```bash
pnpm install
pnpm build
```

Expected: build completes without error. Captures the "before" baseline so any later build break is known to come from this PR's changes.

If `pnpm` is not available, use `npm install && npm run build` — both work; the repo's `package.json` does not pin pnpm.

- [ ] **Step 3: No commit yet** — Task 1.0 is setup only.

---

### Task 1.1: Convert `README.md` → `overview.mdx`

**Files:**
- Read: `~/local-dev/sipher/docs/sentinel/README.md`
- Create: `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/overview.mdx`

**Frontmatter:**

```yaml
---
title: SENTINEL — External Surface Reference
description: Integrator-facing reference for SENTINEL — Sipher's LLM-backed security analyst. Watches fund-moving actions, flags wallets, logs decisions.
---
```

**Banner (replace `<YYYY-MM-DD>` placeholder for now — Task 1.8 will substitute the merge date before push):**

```mdx
import { Aside } from '@astrojs/starlight/components'

<Aside type="note" title="Source of truth">
This page mirrors [`docs/sentinel/README.md`](https://github.com/sip-protocol/sipher/blob/main/docs/sentinel/README.md) in the [sipher repo](https://github.com/sip-protocol/sipher). For the latest, always check the source. Last synced: **`<YYYY-MM-DD>`**.
</Aside>
```

- [ ] **Step 1: Create destination directory**

```bash
mkdir -p ~/local-dev/docs-sip/src/content/docs/sipher/sentinel
```

- [ ] **Step 2: Read the source file and apply all 6 transforms**

Open `~/local-dev/sipher/docs/sentinel/README.md` and produce the MDX content:
1. Prepend the frontmatter block above
2. Add a blank line
3. Add the `import { Aside } …` line
4. Add a blank line
5. Add the `<Aside>…</Aside>` block above with the placeholder date
6. Add a blank line
7. Skip the source's leading `# SENTINEL — External Surface Reference` H1 (Transform 2)
8. Copy the rest of the body, applying Transforms 3 (admonitions), 4 (internal cross-links), 5 (source-code links)
9. Drop the source's footer line `*Last verified: 2026-04-27*` (Transform 6)

Specific cross-link conversions for this file (per Transform 4):
- `[REST API](./rest-api.md)` → `[REST API](/sipher/sentinel/rest-api/)`
- `[Agent Tools](./tools.md)` → `[Agent Tools](/sipher/sentinel/tools/)`
- `[Configuration](./config.md)` → `[Configuration](/sipher/sentinel/config/)`
- `[Audit Log Schema](./audit-log.md)` → `[Audit Log Schema](/sipher/sentinel/audit-log/)`

Spec-link conversions (per Transform 4 special-case for `../superpowers/...`):
- ``[`docs/superpowers/specs/2026-04-15-sentinel-formalization-design.md`](../superpowers/specs/2026-04-15-sentinel-formalization-design.md)`` → ``[`docs/superpowers/specs/2026-04-15-sentinel-formalization-design.md`](https://github.com/sip-protocol/sipher/blob/main/docs/superpowers/specs/2026-04-15-sentinel-formalization-design.md)``
- Same for the `2026-04-27-sentinel-surface-docs-design.md` link

Source-code links present in this file (per Transform 5):
- `` `packages/agent/src/sentinel/config.ts:30-33` `` → `[…](https://github.com/sip-protocol/sipher/blob/main/packages/agent/src/sentinel/config.ts#L30-L33)`
- `` `packages/agent/src/sentinel/risk-report.ts` `` → `[…](https://github.com/sip-protocol/sipher/blob/main/packages/agent/src/sentinel/risk-report.ts)`
- `` `packages/agent/src/index.ts:270` `` → `[…](https://github.com/sip-protocol/sipher/blob/main/packages/agent/src/index.ts#L270)`

Verify by reading the actual source — do not assume this list is exhaustive.

- [ ] **Step 3: Write the file**

Write the complete MDX content to `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/overview.mdx`.

- [ ] **Step 4: Spot-check rendering with `pnpm dev`**

Skip until Task 1.8. Build verification is centralized at the end so we don't restart the dev server per file.

- [ ] **Step 5: Commit**

```bash
cd ~/local-dev/docs-sip
git add src/content/docs/sipher/sentinel/overview.mdx
git commit -m "docs(sentinel): mirror SENTINEL overview to public site (#159)"
```

---

### Task 1.2: Convert `rest-api.md` → `rest-api.mdx`

**Files:**
- Read: `~/local-dev/sipher/docs/sentinel/rest-api.md`
- Create: `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/rest-api.mdx`

**Frontmatter:**

```yaml
---
title: SENTINEL REST API
description: All 10 SENTINEL endpoints under /api/sentinel — public + admin — with auth, error envelope, request/response shapes, and verified curl examples.
---
```

**Banner:**

```mdx
import { Aside } from '@astrojs/starlight/components'

<Aside type="note" title="Source of truth">
This page mirrors [`docs/sentinel/rest-api.md`](https://github.com/sip-protocol/sipher/blob/main/docs/sentinel/rest-api.md) in the [sipher repo](https://github.com/sip-protocol/sipher). For the latest, always check the source. Last synced: **`<YYYY-MM-DD>`**.
</Aside>
```

- [ ] **Step 1: Apply all 6 transforms**

Same procedure as Task 1.1, with this file's H1 to strip (`# SENTINEL REST API`) and footer to drop (`*Last verified: 2026-05-04 | Source: \`packages/agent/src/routes/sentinel-api.ts\`*`).

This file contains the largest concentration of:
- `[!NOTE]` admonitions (5+ occurrences — verify by grep before writing)
- Internal cross-links to `./audit-log.md` (`docs/sentinel/audit-log.md` is referenced in NOTE bodies — convert per Transform 4)
- Source-code links to `packages/agent/src/sentinel/...` and `packages/agent/src/routes/sentinel-api.ts`

Run grep before writing to enumerate every `> [!NOTE]`, every `./xxx.md`, and every `` `packages/...` `` reference:

```bash
grep -nE "^> \[!" ~/local-dev/sipher/docs/sentinel/rest-api.md
grep -nE "\.\/[a-z-]+\.md" ~/local-dev/sipher/docs/sentinel/rest-api.md
grep -nE "\`packages/[^\`]+\`" ~/local-dev/sipher/docs/sentinel/rest-api.md
```

Apply each transform across all matches.

- [ ] **Step 2: Write the file**

Write to `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/rest-api.mdx`.

- [ ] **Step 3: Commit**

```bash
git add src/content/docs/sipher/sentinel/rest-api.mdx
git commit -m "docs(sentinel): mirror SENTINEL REST API reference to public site (#159)"
```

---

### Task 1.3: Convert `tools.md` → `tools.mdx`

**Files:**
- Read: `~/local-dev/sipher/docs/sentinel/tools.md`
- Create: `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/tools.mdx`

**Frontmatter:**

```yaml
---
title: SENTINEL Agent Tools
description: 14 SENTINEL tools (7 read + 7 action) plus the assessRisk tool — inputs, outputs, side effects, and when each fires.
---
```

**Banner:**

```mdx
import { Aside } from '@astrojs/starlight/components'

<Aside type="note" title="Source of truth">
This page mirrors [`docs/sentinel/tools.md`](https://github.com/sip-protocol/sipher/blob/main/docs/sentinel/tools.md) in the [sipher repo](https://github.com/sip-protocol/sipher). For the latest, always check the source. Last synced: **`<YYYY-MM-DD>`**.
</Aside>
```

- [ ] **Step 1: Apply all 6 transforms**

H1 to strip: `# SENTINEL Agent Tools`. Footer to drop: `*Last verified: 2026-05-03*`.

This is the largest source file (465 lines). Run the same grep sweep as Task 1.2 to enumerate transforms:

```bash
grep -nE "^> \[!" ~/local-dev/sipher/docs/sentinel/tools.md
grep -nE "\.\/[a-z-]+\.md" ~/local-dev/sipher/docs/sentinel/tools.md
grep -nE "\`packages/[^\`]+\`" ~/local-dev/sipher/docs/sentinel/tools.md
```

Each tool entry has a "When fired" section with implementation pointers — apply Transform 5 to those.

- [ ] **Step 2: Write the file**

Write to `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/tools.mdx`.

- [ ] **Step 3: Commit**

```bash
git add src/content/docs/sipher/sentinel/tools.mdx
git commit -m "docs(sentinel): mirror SENTINEL agent-tools reference to public site (#159)"
```

---

### Task 1.4: Convert `config.md` → `config.mdx`

**Files:**
- Read: `~/local-dev/sipher/docs/sentinel/config.md`
- Create: `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/config.mdx`

**Frontmatter:**

```yaml
---
title: SENTINEL Configuration
description: 15 environment variables that tune SENTINEL — modes, scanner intervals, threat detection, autonomy thresholds, rate limits, LLM tuning.
---
```

**Banner:**

```mdx
import { Aside } from '@astrojs/starlight/components'

<Aside type="note" title="Source of truth">
This page mirrors [`docs/sentinel/config.md`](https://github.com/sip-protocol/sipher/blob/main/docs/sentinel/config.md) in the [sipher repo](https://github.com/sip-protocol/sipher). For the latest, always check the source. Last synced: **`<YYYY-MM-DD>`**.
</Aside>
```

- [ ] **Step 1: Apply all 6 transforms**

H1 to strip: `# SENTINEL Configuration`. Footer to drop: `*Last verified: 2026-05-03*`.

This file has 2+ `[!NOTE]` blocks at the top (boolean polarity, allowlist parser warnings) and a large 15-row markdown table. The table is untouched (Transform 6 leaves tables alone).

Run grep sweep:
```bash
grep -nE "^> \[!" ~/local-dev/sipher/docs/sentinel/config.md
grep -nE "\.\/[a-z-]+\.md" ~/local-dev/sipher/docs/sentinel/config.md
grep -nE "\`packages/[^\`]+\`" ~/local-dev/sipher/docs/sentinel/config.md
```

Source-code links inside the table cells — many `packages/agent/src/sentinel/*.ts` references in the rightmost column. Apply Transform 5 to each.

- [ ] **Step 2: Write the file**

Write to `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/config.mdx`.

- [ ] **Step 3: Commit**

```bash
git add src/content/docs/sipher/sentinel/config.mdx
git commit -m "docs(sentinel): mirror SENTINEL config reference to public site (#159)"
```

---

### Task 1.5: Convert `audit-log.md` → `audit-log.mdx`

**Files:**
- Read: `~/local-dev/sipher/docs/sentinel/audit-log.md`
- Create: `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/audit-log.mdx`

**Frontmatter:**

```yaml
---
title: SENTINEL Audit Log
description: SQLite audit-log schema for SENTINEL — four tables (blacklist, risk_history, pending_actions, decisions) with verbatim CREATE TABLE statements.
---
```

**Banner:**

```mdx
import { Aside } from '@astrojs/starlight/components'

<Aside type="note" title="Source of truth">
This page mirrors [`docs/sentinel/audit-log.md`](https://github.com/sip-protocol/sipher/blob/main/docs/sentinel/audit-log.md) in the [sipher repo](https://github.com/sip-protocol/sipher). For the latest, always check the source. Last synced: **`<YYYY-MM-DD>`**.
</Aside>
```

- [ ] **Step 1: Apply all 6 transforms**

H1 to strip: `# SENTINEL Audit Log`. Footer to drop: `*Last verified: 2026-04-27*`.

**Special case for this file:** It contains shell comment lines starting with `# ` INSIDE ` ```bash ` code fences (e.g., `# Latest decisions across all sources`, `# Active blacklist entries`). These are NOT H1s — they are bash comments. Do NOT strip them. Only strip the actual leading `# SENTINEL Audit Log` heading.

Also contains 4 verbatim `CREATE TABLE` statements inside ` ```sql ` fences. These are untouched by Transform 6 (code blocks left alone).

Run grep sweep:
```bash
grep -nE "^> \[!" ~/local-dev/sipher/docs/sentinel/audit-log.md
grep -nE "\.\/[a-z-]+\.md" ~/local-dev/sipher/docs/sentinel/audit-log.md
grep -nE "\`packages/[^\`]+\`" ~/local-dev/sipher/docs/sentinel/audit-log.md
```

The file references `[\`POST /api/sentinel/circuit-breaker/:id/cancel\`](./rest-api.md#post-apisentinelcircuit-breakeridcancel)` — Transform 4 converts the URL path; the anchor fragment stays.

- [ ] **Step 2: Write the file**

Write to `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/audit-log.mdx`.

- [ ] **Step 3: Commit**

```bash
git add src/content/docs/sipher/sentinel/audit-log.mdx
git commit -m "docs(sentinel): mirror SENTINEL audit-log reference to public site (#159)"
```

---

### Task 1.6: Add `Sipher / SENTINEL` block to sidebar

**Files:**
- Modify: `~/local-dev/docs-sip/astro.config.mjs`

The sidebar is currently a flat array of 10 sections (Getting Started, Guides, SDK Cookbook, Concepts, Specifications, Integrations, Security, Resources, API Reference, SDK API). A new `Sipher` section with a nested `SENTINEL` subgroup is appended after `SDK API`.

- [ ] **Step 1: Read the current sidebar config**

```bash
sed -n '30,127p' ~/local-dev/docs-sip/astro.config.mjs
```

Verify the sidebar array currently ends with the `SDK API` block at lines ~120-126:
```js
        {
          label: 'SDK API',
          collapsed: true,
          items: [
            { label: 'Proof Providers', slug: 'sdk-api/proof-providers' },
            { label: 'NEAR Privacy', slug: 'sdk-api/near-privacy' },
          ],
        },
      ],
```

- [ ] **Step 2: Insert the new section**

Insert this block after the `SDK API` object's closing `},` and before the sidebar array's closing `]`:

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

Match the existing 8-space indentation style.

- [ ] **Step 3: Verify by re-reading the file**

```bash
sed -n '120,140p' ~/local-dev/docs-sip/astro.config.mjs
```

Expected: `Sipher` section visible with nested `SENTINEL` subgroup and 5 child items.

- [ ] **Step 4: Commit**

```bash
git add astro.config.mjs
git commit -m "docs(sentinel): add Sipher/SENTINEL sidebar section to docs-sip (#159)"
```

---

### Task 1.7: Add `SENTINEL Mirror` cheat-sheet to `docs-sip/CLAUDE.md`

**Files:**
- Modify: `~/local-dev/docs-sip/CLAUDE.md`

- [ ] **Step 1: Read the current CLAUDE.md to find a good insertion point**

```bash
cat ~/local-dev/docs-sip/CLAUDE.md
```

The file is 127 lines. Insert the new section before the `**Last Updated:**` footer line.

- [ ] **Step 2: Append the section**

Insert the following block before the `**Last Updated:**` footer:

```md
---

## SENTINEL Mirror

Source of truth: `sip-protocol/sipher` repo at `docs/sentinel/*.md`. Files in `src/content/docs/sipher/sentinel/*.mdx` are hand-synced mirrors.

**When the source changes, apply these six transforms:**

1. Prepend `--- title / description ---` frontmatter
2. Strip the source's leading `# H1` (NOT the `# …` lines inside ` ```bash ` code fences — those are shell comments, not H1s)
3. GitHub admonitions → Starlight directives:
   - `> [!WARNING]` → `:::caution`
   - `> [!NOTE]` → `:::note`
   - `> [!IMPORTANT]` → `:::tip`
   - `> [!CAUTION]` → `:::danger`
4. Internal cross-links: `./xxx.md` → `/sipher/sentinel/xxx/` (anchors carry over unchanged)
5. Source-code refs: `` `packages/agent/src/...` `` → absolute `https://github.com/sip-protocol/sipher/blob/main/...` URL with `#LN` line suffix (or `#L<N>-L<M>` for line ranges)
6. Update banner's `Last synced: YYYY-MM-DD` to today's date

After sync, run `pnpm build` and verify Starlight compiles cleanly.

Spec for the original mirror: [`sipher/docs/superpowers/specs/2026-05-04-sentinel-docs-mirror-design.md`](https://github.com/sip-protocol/sipher/blob/main/docs/superpowers/specs/2026-05-04-sentinel-docs-mirror-design.md).
```

- [ ] **Step 3: Verify by re-reading the file**

```bash
tail -30 ~/local-dev/docs-sip/CLAUDE.md
```

Expected: `## SENTINEL Mirror` heading visible with the 6-rule list above the `**Last Updated:**` footer.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(sentinel): document SENTINEL mirror sync policy in docs-sip CLAUDE.md (#159)"
```

---

### Task 1.8: Build verification + dev preview + final date stamp

**Files:**
- Modify (date substitution): all 5 `*.mdx` files in `~/local-dev/docs-sip/src/content/docs/sipher/sentinel/`

The `<YYYY-MM-DD>` placeholder in each MDX banner needs to be replaced with the date PR 1 will merge. Since merge timing is uncertain, set this to **today's date in the implementer's local time** (the date PR 1 is opened). If PR 1 sits open across a date boundary before merge, that's fine — the date represents the sync intent, not the exact merge timestamp.

- [ ] **Step 1: Substitute today's date in all 5 banners**

```bash
TODAY=$(date +%Y-%m-%d)
echo "Substituting Last synced: <YYYY-MM-DD> with $TODAY"
sed -i.bak "s/Last synced: \*\*\`<YYYY-MM-DD>\`\*\*/Last synced: **$TODAY**/g" \
  ~/local-dev/docs-sip/src/content/docs/sipher/sentinel/*.mdx
rm ~/local-dev/docs-sip/src/content/docs/sipher/sentinel/*.mdx.bak
```

- [ ] **Step 2: Verify substitution**

```bash
grep "Last synced:" ~/local-dev/docs-sip/src/content/docs/sipher/sentinel/*.mdx
```

Expected: 5 lines, each showing `Last synced: **2026-XX-XX**` with today's date. Zero lines containing `<YYYY-MM-DD>`.

- [ ] **Step 3: Build verification**

```bash
cd ~/local-dev/docs-sip
pnpm build
```

Expected: build completes without error. Starlight should report all pages built including the 5 new `sipher/sentinel/*` pages.

If build fails:
- **Frontmatter errors:** check that each MDX file's first 4 lines are `---`, `title: ...`, `description: ...`, `---`
- **`<Aside>` import errors:** check the import line is exactly `import { Aside } from '@astrojs/starlight/components'`
- **Slug collisions:** `astro.config.mjs` slug must match the MDX file path (e.g., `sipher/sentinel/overview` matches `src/content/docs/sipher/sentinel/overview.mdx`)
- **Mermaid errors:** Starlight's `rehype-mermaid` is strict about syntax — copy the source's mermaid block verbatim; do not modify

Fix in place, then re-run `pnpm build` until it succeeds. Each fix that requires a content change is a separate commit (e.g., `fix(sentinel): correct frontmatter on overview.mdx (#159)`).

- [ ] **Step 4: Manual dev preview**

```bash
pnpm dev
# wait for "Local: http://localhost:4321/" message
```

In a browser, visit:
- `http://localhost:4321/sipher/sentinel/overview/` — verify `<Aside>` banner renders, sidebar shows `Sipher` → `SENTINEL` → 5 children, mermaid decision-flow diagram renders
- `http://localhost:4321/sipher/sentinel/rest-api/` — verify `:::note` directives render as styled callouts, internal cross-links to other SENTINEL pages work
- `http://localhost:4321/sipher/sentinel/audit-log/` — verify `CREATE TABLE` SQL fences render with syntax highlighting, internal cross-link to `/sipher/sentinel/rest-api/#post-apisentinelcircuit-breakeridcancel` works

Stop the dev server (Ctrl+C) when done.

- [ ] **Step 5: Commit the date substitution**

```bash
cd ~/local-dev/docs-sip
git add src/content/docs/sipher/sentinel/*.mdx
git commit -m "docs(sentinel): set Last synced date on mirror pages (#159)"
```

---

### Task 1.9: Push branch and open PR 1

**Files:** none modified

- [ ] **Step 1: Push the branch**

```bash
cd ~/local-dev/docs-sip
git push -u origin docs/sentinel-mirror
```

- [ ] **Step 2: Open PR 1 with `gh`**

```bash
gh pr create --title "docs(sentinel): mirror sipher SENTINEL surface docs to public site" --body "$(cat <<'EOF'
## Summary

Mirrors the 5 SENTINEL surface docs from `sip-protocol/sipher` (`docs/sentinel/*.md`) to the public docs site at `docs.sip-protocol.org/sipher/sentinel/*`. First Sipher content on the public site.

- New nav: `Sipher` → `SENTINEL` → 5 child pages (Overview, REST API, Agent Tools, Configuration, Audit Log)
- Each page has a `<Aside>` source-of-truth banner pointing back at the canonical sipher MD
- Sync is manual + discipline; cheat-sheet documented in `CLAUDE.md`

Closes part of [sip-protocol/sipher#159](https://github.com/sip-protocol/sipher/issues/159). Paired sipher-side PR (banner + CLAUDE.md mirror policy) opens after this one merges.

Spec: [`docs/superpowers/specs/2026-05-04-sentinel-docs-mirror-design.md`](https://github.com/sip-protocol/sipher/blob/main/docs/superpowers/specs/2026-05-04-sentinel-docs-mirror-design.md) (in sipher repo, canonical).

## Test plan

- [x] `pnpm build` succeeds (Starlight compiles cleanly)
- [x] `pnpm dev` walkthrough: `/sipher/sentinel/overview/`, `/sipher/sentinel/rest-api/`, `/sipher/sentinel/audit-log/`
- [x] `<Aside>` banner renders on every page
- [x] `:::note` directives render as styled callouts
- [x] Internal cross-links resolve (no 404s)
- [x] Mermaid decision-flow renders on Overview
- [x] Sidebar shows `Sipher` (collapsed) → `SENTINEL` (open) → 5 children
EOF
)"
```

- [ ] **Step 3: Wait for CI**

Run:
```bash
gh pr checks --watch
```

Expected: CI green (Astro build + any other configured checks).

- [ ] **Step 4: Stop here for human review and merge**

PR 1 is now open. Hand off to RECTOR for review. Do NOT proceed to PR 2 until PR 1 is merged.

---

# Wait Gate

PR 1 must merge before any work in PR 2 begins. The reason: PR 2 prepends a banner like `> 📖 **Public mirror:** [docs.sip-protocol.org/sipher/sentinel/rest-api](https://docs.sip-protocol.org/sipher/sentinel/rest-api/)` to each sipher MD — that URL must resolve when readers click it.

Once PR 1 is merged AND the docs-sip Docker container has redeployed (typically a few minutes after merge per VPS deploy flow), proceed to Task 2.1.

To verify PR 1 is live:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://docs.sip-protocol.org/sipher/sentinel/overview/
# Expected: 200
```

---

# PR 2 — sipher (source repo)

Working directory: `~/local-dev/sipher/`
Branch: `docs/sentinel-mirror-policy` (already created with the spec commit at `d886390`)

---

### Task 2.1: Add public-mirror banner to `README.md`

**Files:**
- Modify: `~/local-dev/sipher/docs/sentinel/README.md`

- [ ] **Step 1: Verify the file's current head**

```bash
head -3 ~/local-dev/sipher/docs/sentinel/README.md
```

Expected:
```
# SENTINEL — External Surface Reference

SENTINEL is Sipher's LLM-backed security analyst. ...
```

- [ ] **Step 2: Prepend the banner block**

Insert these 3 lines at the very top of the file, above the `# SENTINEL — External Surface Reference` H1:

```md
> 📖 **Public mirror:** [docs.sip-protocol.org/sipher/sentinel/overview](https://docs.sip-protocol.org/sipher/sentinel/overview/)
> This file is the source of truth. Public mirror is hand-synced — see [docs-sip/CLAUDE.md](https://github.com/sip-protocol/docs-sip/blob/main/CLAUDE.md#sentinel-mirror).

```

Result: file starts with `>` blockquote (2 lines) + blank line + `# SENTINEL — External Surface Reference` H1.

- [ ] **Step 3: Verify**

```bash
head -5 ~/local-dev/sipher/docs/sentinel/README.md
```

Expected: 2-line blockquote, blank line, then the H1.

- [ ] **Step 4: Commit**

```bash
cd ~/local-dev/sipher
git add docs/sentinel/README.md
git commit -m "docs(sentinel): add public-mirror banner to README (#159)"
```

---

### Task 2.2: Add public-mirror banner to `rest-api.md`

**Files:**
- Modify: `~/local-dev/sipher/docs/sentinel/rest-api.md`

- [ ] **Step 1: Prepend the banner**

Insert at the top of the file:

```md
> 📖 **Public mirror:** [docs.sip-protocol.org/sipher/sentinel/rest-api](https://docs.sip-protocol.org/sipher/sentinel/rest-api/)
> This file is the source of truth. Public mirror is hand-synced — see [docs-sip/CLAUDE.md](https://github.com/sip-protocol/docs-sip/blob/main/CLAUDE.md#sentinel-mirror).

```

- [ ] **Step 2: Commit**

```bash
git add docs/sentinel/rest-api.md
git commit -m "docs(sentinel): add public-mirror banner to rest-api (#159)"
```

---

### Task 2.3: Add public-mirror banner to `tools.md`

**Files:**
- Modify: `~/local-dev/sipher/docs/sentinel/tools.md`

- [ ] **Step 1: Prepend the banner**

```md
> 📖 **Public mirror:** [docs.sip-protocol.org/sipher/sentinel/tools](https://docs.sip-protocol.org/sipher/sentinel/tools/)
> This file is the source of truth. Public mirror is hand-synced — see [docs-sip/CLAUDE.md](https://github.com/sip-protocol/docs-sip/blob/main/CLAUDE.md#sentinel-mirror).

```

- [ ] **Step 2: Commit**

```bash
git add docs/sentinel/tools.md
git commit -m "docs(sentinel): add public-mirror banner to tools (#159)"
```

---

### Task 2.4: Add public-mirror banner to `config.md`

**Files:**
- Modify: `~/local-dev/sipher/docs/sentinel/config.md`

- [ ] **Step 1: Prepend the banner**

```md
> 📖 **Public mirror:** [docs.sip-protocol.org/sipher/sentinel/config](https://docs.sip-protocol.org/sipher/sentinel/config/)
> This file is the source of truth. Public mirror is hand-synced — see [docs-sip/CLAUDE.md](https://github.com/sip-protocol/docs-sip/blob/main/CLAUDE.md#sentinel-mirror).

```

- [ ] **Step 2: Commit**

```bash
git add docs/sentinel/config.md
git commit -m "docs(sentinel): add public-mirror banner to config (#159)"
```

---

### Task 2.5: Add public-mirror banner to `audit-log.md`

**Files:**
- Modify: `~/local-dev/sipher/docs/sentinel/audit-log.md`

- [ ] **Step 1: Prepend the banner**

```md
> 📖 **Public mirror:** [docs.sip-protocol.org/sipher/sentinel/audit-log](https://docs.sip-protocol.org/sipher/sentinel/audit-log/)
> This file is the source of truth. Public mirror is hand-synced — see [docs-sip/CLAUDE.md](https://github.com/sip-protocol/docs-sip/blob/main/CLAUDE.md#sentinel-mirror).

```

- [ ] **Step 2: Commit**

```bash
git add docs/sentinel/audit-log.md
git commit -m "docs(sentinel): add public-mirror banner to audit-log (#159)"
```

---

### Task 2.6: Add `SENTINEL Docs Mirror Policy` to sipher `CLAUDE.md`

**Files:**
- Modify: `~/local-dev/sipher/CLAUDE.md`

- [ ] **Step 1: Identify insertion point**

```bash
grep -n "^## " ~/local-dev/sipher/CLAUDE.md | head -20
```

Choose a logical location — e.g., after an existing "Documentation" or "Repo Standards" section, or right before the file's footer. The exact placement is judgment; the section is short and topical.

- [ ] **Step 2: Insert the policy section**

Add this block at the chosen location:

```md
---

## SENTINEL Docs Mirror Policy

`docs/sentinel/*.md` is the source of truth. A public mirror lives at `docs.sip-protocol.org/sipher/sentinel/*` (Astro Starlight, repo: `sip-protocol/docs-sip`).

**Sync rule:** Any PR that edits `docs/sentinel/*.md` MUST also update the corresponding `.mdx` in `docs-sip/src/content/docs/sipher/sentinel/`, in the same logical change (paired PRs, or a single multi-repo branch). Update the "Last synced: YYYY-MM-DD" date in both files. See [docs-sip/CLAUDE.md](https://github.com/sip-protocol/docs-sip/blob/main/CLAUDE.md#sentinel-mirror) for the six transform rules.
```

- [ ] **Step 3: Verify**

```bash
grep -A 6 "SENTINEL Docs Mirror Policy" ~/local-dev/sipher/CLAUDE.md
```

Expected: section header + body visible.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(sentinel): document mirror policy in sipher CLAUDE.md (#159)"
```

---

### Task 2.7: Verify sipher unchanged

**Files:** none modified

- [ ] **Step 1: Typecheck**

```bash
cd ~/local-dev/sipher
pnpm typecheck
```

Expected: passes. (No source code touched.)

- [ ] **Step 2: Test count sanity**

```bash
pnpm --filter @sipher/agent test -- --run 2>&1 | tail -5
```

Expected: tests pass with the same counts as on `main` — agent **1300/104** (1300 tests across 104 suites). If counts differ, something unintended changed; revert and investigate.

```bash
pnpm --filter @sipher/app test -- --run 2>&1 | tail -5
```

Expected: app **46/12**.

- [ ] **Step 3: Diff scope check**

```bash
git diff --stat origin/main..HEAD
```

Expected: only `docs/sentinel/*.md` (5 files), `docs/superpowers/specs/2026-05-04-sentinel-docs-mirror-design.md` (1 file), `docs/superpowers/plans/2026-05-04-sentinel-docs-mirror.md` (1 file), and `CLAUDE.md` (1 file) modified. Zero source files. Zero test files.

- [ ] **Step 4: No commit** — verification step only.

---

### Task 2.8: Push branch and open PR 2

**Files:** none modified

- [ ] **Step 1: Push the branch**

```bash
cd ~/local-dev/sipher
git push -u origin docs/sentinel-mirror-policy
```

- [ ] **Step 2: Open PR 2 with `gh`**

```bash
gh pr create --title "docs(sentinel): add public-mirror banner + mirror policy" --body "$(cat <<'EOF'
## Summary

Adds a "Public mirror" banner to each of the 5 `docs/sentinel/*.md` files pointing readers at `docs.sip-protocol.org/sipher/sentinel/*` — the public mirror that landed in the paired docs-sip PR. Also adds a `SENTINEL Docs Mirror Policy` section to `CLAUDE.md` so future contributors update both places when SENTINEL surface docs change.

Closes [sip-protocol/sipher#159](https://github.com/sip-protocol/sipher/issues/159).

Spec: `docs/superpowers/specs/2026-05-04-sentinel-docs-mirror-design.md`
Plan: `docs/superpowers/plans/2026-05-04-sentinel-docs-mirror.md`
Predecessor PR (docs-sip): [sip-protocol/docs-sip#XX](https://github.com/sip-protocol/docs-sip/pull/XX) (replace with actual PR number after merge)

## Test plan

- [x] `pnpm typecheck` passes
- [x] `pnpm --filter @sipher/agent test -- --run` — 1300 tests / 104 suites (unchanged)
- [x] `pnpm --filter @sipher/app test -- --run` — 46 tests / 12 suites (unchanged)
- [x] `git diff --stat origin/main..` shows only docs files modified, zero source files
- [x] Public mirror URLs resolve (e.g., `curl -s -o /dev/null -w "%{http_code}\n" https://docs.sip-protocol.org/sipher/sentinel/overview/` returns `200`)
- [x] Banner blockquote renders cleanly on github.com after push
EOF
)"
```

Replace `#XX` in the body with the actual PR 1 number using `gh pr edit` after creation if needed.

- [ ] **Step 3: Wait for CI**

```bash
gh pr checks --watch
```

Expected: CI green (test, component, playwright workflows).

- [ ] **Step 4: Stop here for human review and merge**

PR 2 is open. Hand off to RECTOR for review.

---

## Final State

After both PRs merge:

- `docs.sip-protocol.org/sipher/sentinel/{overview,rest-api,tools,config,audit-log}` all live
- Sidebar on docs-sip shows `Sipher` (collapsed) → `SENTINEL` (open) → 5 child pages
- Each docs-sip MDX has source-of-truth `<Aside>` banner with "Last synced" date
- Each sipher source MD has public-mirror banner pointing at the live URL
- Both CLAUDE.md files document the manual sync policy
- Spec + plan archived in sipher repo
- Issue #159 closed (auto-closed by PR 2 merge)

**Deferred to follow-up issues if/when needed:**
- CI mirror automation (`docs/sentinel/**` → docs-sip auto-PR)
- Mirroring Sipher's non-SENTINEL surface (REST endpoints, HERALD, agent tools)
- TypeDoc / OpenAPI generation

---

## Self-Review Checklist (filled in during plan-write)

**1. Spec coverage:** every spec section maps to one or more plan tasks:

| Spec section | Plan task(s) |
|---|---|
| Architecture / file layout | File Structure section + Tasks 1.1–1.5 |
| Sidebar nesting | Task 1.6 |
| Per-page conversion rules (6 transforms) | Reference: 6 Transforms section + Tasks 1.1–1.5 |
| Cross-link & banner shape (sipher side) | Tasks 2.1–2.5 |
| Cross-link & banner shape (docs-sip side) | Tasks 1.1–1.5 |
| `Last synced` semantics | Task 1.8 |
| sipher CLAUDE.md mirror policy | Task 2.6 |
| docs-sip CLAUDE.md cheat-sheet | Task 1.7 |
| PR ordering (docs-sip first) | Task 1.9 (open PR 1) → Wait Gate → Task 2.1 (start PR 2) |
| Branch names | Pre-flight section |
| Verification (docs-sip pnpm build + dev preview) | Task 1.8 |
| Verification (sipher typecheck + tests unchanged) | Task 2.7 |

No gaps.

**2. Placeholder scan:** zero `TBD`, zero `TODO`, zero `fill in`, zero `similar to Task N`. The `<YYYY-MM-DD>` placeholder in MDX banners is intentional and substituted in Task 1.8.

**3. Type consistency:** all internal references use the same names — `<Aside>` (capital A), `Sipher` sidebar label (capital S), `SENTINEL` (all caps). Slug paths use the form `sipher/sentinel/<basename>` consistently. Cheat-sheet rule numbering matches between spec and plan (1–6).

**4. Anti-patterns checked:**
- No "implement later"
- No "add appropriate error handling" (verification steps are concrete commands with expected outputs)
- No "write tests for the above" (this is doc work; verification is `pnpm build` + `pnpm typecheck` + test-count parity)
- No referenced types/functions outside the plan's scope
