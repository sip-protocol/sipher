# Glass-Neon Redesign + Vercel FE Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the glass-neon visual language across the live Sipher app, deployed on Vercel with backend on VPS, in 9 sequenced PRs ahead of Phase D X thread #1 launch.

**Architecture:** Frontend (`app/`) deploys to Vercel via `vercel.json` at repo root. Backend stays on VPS at `api.sipher.sip-protocol.org`. Tokens land verbatim in `app/src/styles/tokens.css`; a Tailwind 4 `@theme` block bridges them to utility classes. Five `app/src/components/ui/` primitives (`Card`, `Pill`, `HashCell`, `MetricBar`, `Sheet`) plus four feature components (`Gauge`, `TickerBar`, `NodeGraph`, dashboard extractions) form the design system. Existing components are restyled in place. Tornado-Cash-flavored design slots (Network atlas, Denomination pools, Anonymity set) are reinterpreted into thesis-aligned features (Privacy graph, Multi-chain vault grid, Shielded volume) — see spec D3.

**Tech Stack:** Vite 6 + React 19 + TypeScript 5.7 + Tailwind 4 + Zustand 5 + Vitest 3 (FE) · Express 5 + supertest + better-sqlite3 + Vitest 3 (BE) · Playwright 1.59 (e2e) · pnpm 10 + Turborepo · Vercel (FE host) · VPS Docker (BE host) · Cloudflare DNS.

**Spec:** [`docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md`](../specs/2026-05-07-glass-neon-redesign-design.md) — binding for every decision in this plan.

---

## Pre-flight (do once before PR 0)

- [ ] **0.1 — Confirm clean main + worktree workspace**

```bash
cd ~/local-dev/sipher
git checkout main && git pull origin main
git status   # expect: nothing to commit, working tree clean
git log --oneline -3   # expect: d10cf45 fix(docker): pin pnpm@10... at HEAD
```

- [ ] **0.2 — Confirm spec file is committed**

```bash
git log --oneline --all -- docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md | head -3
# expect: 33d2e39 docs(spec): glass-neon redesign + vercel FE migration design spec
```

- [ ] **0.3 — Confirm token sheet is on disk**

```bash
ls -la ~/Downloads/sipher-redesign-tokens.css
wc -l ~/Downloads/sipher-redesign-tokens.css
# expect: 301 lines, ~17KB
```

- [ ] **0.4 — Use git worktree for the sprint**

```bash
cd ~/local-dev/sipher
mkdir -p .worktrees
# Each PR gets its own worktree under .worktrees/<branch-name>
# We create them per-PR below — this is just confirmation .worktrees/ exists
ls -la .worktrees/
```

- [ ] **0.5 — Read the spec end-to-end**

Open `docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md`. Read every section. Pay special attention to:
- D3 (binding reinterpretation table)
- D8 (admin views NOT in main nav)
- D10 (no mock data leakage)
- Component Inventory (file paths)
- PR Sequence (acceptance criteria per PR)

The plan below is the HOW. The spec is the WHAT and WHY.

---

## PR 0 — Vercel FE Migration (zero visual change)

**Branch:** `feat/vercel-fe-split`
**Worktree:** `.worktrees/feat-vercel-fe-split/`
**Goal:** Move `app/` to Vercel without changing UX or visuals. All PR #176 surfaces still work.
**Acceptance:** `https://sipher.sip-protocol.org` resolves to Vercel (FE), `https://api.sipher.sip-protocol.org` resolves to VPS (backend), Phantom one-popup + JWT 24h + `/refresh` + fail-closed `/pay/:id/confirm` all green.

**Risk profile:** HIGH. DNS + CORS + auth wiring touches production. Each task below has rollback notes.

### PR 0 / Task 1: Create worktree + branch

- [ ] **Step 1: Create worktree**

```bash
cd ~/local-dev/sipher
git worktree add -b feat/vercel-fe-split .worktrees/feat-vercel-fe-split main
cd .worktrees/feat-vercel-fe-split
git status  # expect: On branch feat/vercel-fe-split
```

- [ ] **Step 2: Verify clean state in worktree**

```bash
ls -la docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md
# expect: file exists (came from main)
```

### PR 0 / Task 2: Add `vercel.json` at repo root

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd app && pnpm install --frozen-lockfile && pnpm build",
  "installCommand": "echo 'install handled in buildCommand'",
  "outputDirectory": "app/dist",
  "framework": null,
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

Why each block:
- `buildCommand` cd's into `app/` because that's where the Vite project lives; backend dirs are ignored
- `outputDirectory` points at Vite's default `dist/`
- `framework: null` because we're not using a Vercel preset (we're a Vite app inside a monorepo)
- `rewrites` send all routes to `index.html` for client-side routing (React Router pattern)
- Security headers match what nginx serves today

- [ ] **Step 2: Create `.vercelignore`**

```
# Vercel only deploys app/. Everything else stays on VPS.
packages/
contracts/
programs/
docs/
e2e/
scripts/
sdks/
src/
*.log
*.sqlite
data/
node_modules/

# Allow lockfile + workspace config so pnpm can resolve in build
!pnpm-lock.yaml
!pnpm-workspace.yaml
!package.json
!app/
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json .vercelignore
git commit -m "feat(vercel): add vercel.json + .vercelignore for app/ deployment

Configures Vercel to deploy only the app/ directory as a Vite
SPA. Uses pnpm install in app/ via buildCommand since app/ has its
own package.json with workspace references. Backend dirs explicitly
ignored. Security headers match nginx production config."
```

### PR 0 / Task 3: Update `app/.env.example` with new API URL

- [ ] **Step 1: Read current `.env.example`**

```bash
cat app/.env.example
```

- [ ] **Step 2: Add `VITE_API_URL` for production**

Edit `app/.env.example`. If a `VITE_API_URL` already exists, leave the local-dev one and ADD a comment:

```bash
# Local development (default if unset)
# VITE_API_URL=http://localhost:3000

# Production: set in Vercel project env vars, not here
# VITE_API_URL=https://api.sipher.sip-protocol.org
```

- [ ] **Step 3: Commit**

```bash
git add app/.env.example
git commit -m "docs(env): document VITE_API_URL split between local + Vercel prod"
```

### PR 0 / Task 4: Remove static-file serve from agent backend

The agent currently serves `app/dist/*` from the same Express process (`packages/agent/src/index.ts:222`). Once Vercel takes over FE serving, this becomes dead code that can mask CORS/origin bugs. Remove it.

- [ ] **Step 1: Read current `index.ts:215-225`**

```bash
sed -n '215,225p' packages/agent/src/index.ts
# expect:
# // Serve web chat UI (static files from app/dist)
# // In production: packages/agent/dist/ -> ../../../app/dist
# // Resolved via __dirname so it works regardless of cwd
# const webRoot = path.resolve(__dirname, '../../../app/dist')
# app.use(express.static(webRoot))
```

- [ ] **Step 2: Remove the static-file serve block**

Edit `packages/agent/src/index.ts`. Replace lines 218-222 with:

```ts
// FE is served by Vercel at sipher.sip-protocol.org. Backend
// is API-only at api.sipher.sip-protocol.org. CORS_ORIGINS env
// gates which Vercel preview/prod origins can call us.
```

- [ ] **Step 3: Verify the import is no longer used**

```bash
grep -n "express.static\|webRoot" packages/agent/src/index.ts
# expect: no output
```

- [ ] **Step 4: Run agent tests to verify nothing broke**

```bash
cd packages/agent && pnpm test -- --run 2>&1 | tail -20
# expect: 1337+ tests passing
```

- [ ] **Step 5: Commit**

```bash
cd ../..
git add packages/agent/src/index.ts
git commit -m "feat(agent): remove static FE serve, FE moves to Vercel

Backend becomes API-only. sipher.sip-protocol.org now resolves to
Vercel; backend is reachable at api.sipher.sip-protocol.org. CORS
configuration in next commit."
```

### PR 0 / Task 5: Tighten `CORS_ORIGINS` for cross-origin Vercel previews

- [ ] **Step 1: Find current CORS config**

```bash
grep -n "CORS_ORIGINS\|cors(" packages/agent/src/index.ts | head -10
```

- [ ] **Step 2: Locate the cors() call**

It's likely around line 130-150. Read context:

```bash
sed -n '125,160p' packages/agent/src/index.ts
```

- [ ] **Step 3: Update CORS to support Vercel preview pattern**

The current pattern is `CORS_ORIGINS=https://sipher.sip-protocol.org` (comma-separated list). We need to support `https://*-sipher.vercel.app` (wildcarded preview deployments). Express `cors` middleware supports a function origin checker.

Find the `cors(...)` call in `packages/agent/src/index.ts` and replace with:

```ts
import cors from 'cors'

const corsOriginsEnv = process.env.CORS_ORIGINS ?? 'http://localhost:5173'
const allowedOrigins = corsOriginsEnv.split(',').map((s) => s.trim()).filter(Boolean)
const previewPattern = /^https:\/\/[a-z0-9-]+-sipher\.vercel\.app$/

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)  // SSR / curl
      if (allowedOrigins.includes(origin)) return cb(null, true)
      if (previewPattern.test(origin)) return cb(null, true)
      return cb(new Error(`Origin ${origin} not allowed by CORS`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)
```

- [ ] **Step 4: Write a test for the CORS allowlist**

Create `packages/agent/tests/cors-origins.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'

describe('CORS origin allowlist', () => {
  let app: any

  beforeEach(async () => {
    process.env.CORS_ORIGINS = 'https://sipher.sip-protocol.org'
    process.env.JWT_SECRET = 'test-secret-at-least-16-chars'
    process.env.SIPHER_NETWORK = 'devnet'
    process.env.SIPHER_HELIUS_API_KEY = 'test-key'
    const mod = await import('../src/index.js')
    app = mod.app  // requires named export — see step 5 if not exported
  })

  afterEach(() => {
    delete process.env.CORS_ORIGINS
  })

  it('accepts the production origin', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'https://sipher.sip-protocol.org')
      .set('Access-Control-Request-Method', 'GET')
    expect(res.headers['access-control-allow-origin']).toBe('https://sipher.sip-protocol.org')
  })

  it('accepts a Vercel preview origin', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'https://feat-redesign-tokens-sipher.vercel.app')
      .set('Access-Control-Request-Method', 'GET')
    expect(res.headers['access-control-allow-origin']).toBe('https://feat-redesign-tokens-sipher.vercel.app')
  })

  it('rejects an unrelated origin', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'GET')
    expect(res.status).toBe(500)  // cors error handler returns 500 for rejected origin
  })

  it('rejects a Vercel preview from a different project', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'https://something-else.vercel.app')
      .set('Access-Control-Request-Method', 'GET')
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 5: Run the test, watch fail**

```bash
cd packages/agent && pnpm test -- cors-origins --run 2>&1 | tail -20
# expect: FAIL with "Cannot find name 'app'" or similar
```

- [ ] **Step 6: Export `app` from `index.ts` so tests can import it**

If `app` isn't already exported, add:

```ts
// At the bottom of index.ts, after server starts
export { app }
```

- [ ] **Step 7: Re-run test, watch pass**

```bash
pnpm test -- cors-origins --run 2>&1 | tail -10
# expect: 4 passing
```

- [ ] **Step 8: Update `docker-compose.yml` `CORS_ORIGINS`**

```bash
cd ../..
grep CORS_ORIGINS docker-compose.yml
```

Edit `docker-compose.yml`. Find the sipher service env block. Update:

```yaml
- CORS_ORIGINS=https://sipher.sip-protocol.org
```

(The Vercel preview pattern is matched by code, not env — keep the env list to production only.)

- [ ] **Step 9: Commit**

```bash
git add packages/agent/src/index.ts packages/agent/tests/cors-origins.test.ts docker-compose.yml
git commit -m "feat(agent): support cross-origin Vercel previews in CORS

Adds wildcard match for *-sipher.vercel.app preview deployments
alongside the explicit allowlist. 4 new integration tests assert the
positive + negative paths. Production CORS_ORIGINS in docker-compose
narrows to the canonical sipher.sip-protocol.org origin only;
preview support lives in code so any new branch auto-clears CORS."
```

### PR 0 / Task 6: Configure Vercel project (RECTOR runs this manually)

> **Note:** This task requires Vercel CLI auth. RECTOR runs the commands; CIPHER cannot complete this task autonomously.

- [ ] **Step 1: Install Vercel CLI (RECTOR, if not already)**

```bash
npm i -g vercel
vercel --version
# expect: Vercel CLI 35+ or similar
```

- [ ] **Step 2: Authenticate (RECTOR)**

```bash
vercel login
# Follow browser prompt
```

- [ ] **Step 3: Link project from sipher repo root (RECTOR)**

```bash
cd ~/local-dev/sipher/.worktrees/feat-vercel-fe-split
vercel link
# Prompts:
#   Set up "~/local-dev/sipher/.worktrees/..."? Y
#   Which scope? sip-protocol
#   Link to existing project? N
#   What's your project's name? sipher
#   In which directory is your code located? ./
```

- [ ] **Step 4: Set production env vars (RECTOR)**

```bash
vercel env add VITE_API_URL production
# When prompted, paste: https://api.sipher.sip-protocol.org

vercel env add VITE_API_URL preview
# Paste: https://api.sipher.sip-protocol.org

vercel env add VITE_API_URL development
# Paste: http://localhost:3000
```

- [ ] **Step 5: Verify project link is committed (NOT pushed) to .gitignore**

```bash
cat .gitignore | grep .vercel
# expect: .vercel/
# (`vercel link` creates .vercel/project.json — stays local)
```

If `.vercel/` isn't in `.gitignore`, add it:

```bash
echo ".vercel/" >> .gitignore
```

- [ ] **Step 6: Run preview deploy (RECTOR)**

```bash
vercel
# Outputs a preview URL like https://sipher-abc123-sip-protocol.vercel.app
```

- [ ] **Step 7: Smoke test the preview URL (RECTOR + CIPHER)**

```bash
# Replace <PREVIEW_URL> with what vercel output
curl -s -o /dev/null -w "HTTP %{http_code}\n" <PREVIEW_URL>
# expect: HTTP 200
```

Open the preview URL in browser. Verify:
- Page loads (BetaBanner visible)
- Wallet connect modal opens
- Network=devnet shown in header

(Cross-origin auth flow tested in Task 8 once DNS is cut.)

- [ ] **Step 8: Commit any .gitignore change**

```bash
git add .gitignore
git commit -m "chore: add .vercel/ to .gitignore"
```

### PR 0 / Task 7: DNS migration (RECTOR + Cloudflare API)

> **Risk:** This is the load-bearing destructive step. Once `sipher.sip-protocol.org` cuts from VPS to Vercel, rollback requires DNS revert (TTL 60s if we set it correctly).

- [ ] **Step 1: Check current DNS (Cloudflare)**

```bash
# RECTOR runs from a terminal with CLOUDFLARE_API_TOKEN set
curl -X GET "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records?name=sipher.sip-protocol.org" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | python3 -m json.tool
# expect: A record pointing at VPS IP 151.245.137.75, proxied=true
```

- [ ] **Step 2: Lower TTL to 60s on the existing record (rollback safety)**

```bash
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records/<RECORD_ID>" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"ttl":60}'
```

Wait 5 minutes for TTL to propagate.

- [ ] **Step 3: Add NEW DNS record `api.sipher.sip-protocol.org` → VPS**

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type":"A",
    "name":"api.sipher",
    "content":"151.245.137.75",
    "proxied":true,
    "ttl":300
  }'
```

- [ ] **Step 4: Verify api.sipher resolves**

```bash
# Wait 60s after step 3 for proxy to set up
dig api.sipher.sip-protocol.org +short
# expect: Cloudflare IPs (104.x or 172.x)

curl -s https://api.sipher.sip-protocol.org/api/health
# expect: {"status":"ok","agent":"sipher",...}
```

- [ ] **Step 5: Update VPS nginx to serve `api.sipher.sip-protocol.org`**

SSH into VPS:

```bash
ssh sip
sudo nano /etc/nginx/sites-enabled/sipher.conf
# Change `server_name sipher.sip-protocol.org;` to:
# server_name sipher.sip-protocol.org api.sipher.sip-protocol.org;
# (we'll cut sipher.sip-protocol.org from the server_name in step 7)
sudo nginx -t && sudo systemctl reload nginx
```

- [ ] **Step 6: Test API origin via curl with Origin header**

```bash
# From a non-VPS machine
curl -s -X POST -H "Content-Type: application/json" \
  -H "Origin: https://sipher.sip-protocol.org" \
  -d '{"wallet":"FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr"}' \
  https://api.sipher.sip-protocol.org/api/auth/nonce | head -c 200
# expect: {"nonce":"...","message":"..."} OR rate limit response
```

If response includes `Access-Control-Allow-Origin: https://sipher.sip-protocol.org`, CORS is correct.

- [ ] **Step 7: Cut `sipher.sip-protocol.org` over to Vercel**

```bash
# Promote the Vercel preview to production (RECTOR)
cd ~/local-dev/sipher/.worktrees/feat-vercel-fe-split
vercel --prod
# Vercel deploys + updates the alias

# Add custom domain in Vercel dashboard:
# - Open https://vercel.com/sip-protocol/sipher/settings/domains
# - Add: sipher.sip-protocol.org
# - Vercel will give a CNAME target like cname.vercel-dns.com
```

- [ ] **Step 8: Update Cloudflare A record → CNAME to Vercel**

```bash
# Delete the A record pointing at VPS
curl -X DELETE "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records/<RECORD_ID>" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# Add CNAME pointing at Vercel
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type":"CNAME",
    "name":"sipher",
    "content":"cname.vercel-dns.com",
    "proxied":false,
    "ttl":60
  }'
# IMPORTANT: proxied=false. Vercel handles SSL via their own certs;
# Cloudflare proxy would break Vercel's CNAME flattening.
```

- [ ] **Step 9: Wait for SSL provisioning + verify**

```bash
# Wait 2-5 minutes for Vercel to issue SSL cert
sleep 180
curl -I https://sipher.sip-protocol.org
# expect: HTTP/2 200 with x-vercel-cache header (from Vercel edge)
```

- [ ] **Step 10: Remove `sipher.sip-protocol.org` from VPS nginx**

```bash
ssh sip
sudo nano /etc/nginx/sites-enabled/sipher.conf
# Change back to: server_name api.sipher.sip-protocol.org;
sudo nginx -t && sudo systemctl reload nginx
```

- [ ] **Step 11: No commit yet — DNS is config, not code**

DNS state is in Cloudflare; not in repo. The `vercel.json` + `.vercelignore` already committed (Task 2) is the repo-side artifact.

### PR 0 / Task 8: Cross-origin auth smoke test (CRITICAL)

After DNS cuts, verify all PR #176 surfaces work cross-origin.

- [ ] **Step 1: Open `https://sipher.sip-protocol.org` in fresh incognito browser**

Verify:
- Page loads from Vercel (check via DevTools Network tab → response from Vercel edge)
- DevTools Network → no CORS errors on any request
- BetaBanner visible
- Wallet connect modal opens

- [ ] **Step 2: Connect Phantom wallet, sign in**

Verify:
- ONE popup combining wallet connect + SIWS sign-in (B7.5 from PR #176 working)
- After signing: JWT in localStorage
- Header shows wallet address truncated
- Chat input enables

- [ ] **Step 3: Test JWT refresh**

```bash
# In DevTools console (page open at sipher.sip-protocol.org):
const auth = JSON.parse(localStorage.getItem('sipher-auth')).state
console.log('expiresAt:', new Date(auth.expiresAt * 1000))

# Manually trigger refresh:
fetch('https://api.sipher.sip-protocol.org/api/auth/refresh', {
  method: 'POST',
  headers: { Authorization: `Bearer ${auth.token}` },
}).then(r => r.json()).then(j => console.log(j))
# expect: {token:"...new...", expiresIn:"24h"}
```

- [ ] **Step 4: Test pay/confirm flow**

Open `/pay/test-link-id` with a known-bad link ID:

```bash
curl -s https://api.sipher.sip-protocol.org/pay/nonexistent/confirm
# expect: 404 or NOT_FOUND envelope (not silent valid:true)
```

- [ ] **Step 5: Test SENTINEL admin (if AUTHORIZED_WALLETS includes connected wallet)**

Navigate to /squad. Verify:
- Page loads (admin gated)
- Squad view renders
- Live network test shows endpoints respond

- [ ] **Step 6: Document tested-against matrix in PR description**

When you open the PR (Task 10), include:

```markdown
## Tested against
| Wallet | Connect | SIWS one-popup | JWT refresh | Disconnect | Status |
|---|---|---|---|---|---|
| Phantom | ✓ | ✓ | ✓ | ✓ | OK |
| Solflare | ✓ | ✓ | ✓ | ✓ | OK |
| Jupiter | ✓ | (signMessage fallback) | ✓ | ✓ | OK |
```

### PR 0 / Task 9: Update Phase 4a env doc

The Phase 4a env doc references the old single-origin VPS setup. Update it.

- [ ] **Step 1: Find the env doc**

```bash
grep -rn "sipher.sip-protocol.org" docs/ | head -5
```

- [ ] **Step 2: Update any doc that documents the env split**

Replace single-origin references with the new split where applicable. Common file: `docs/sentinel/config.md` or similar.

- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs(sentinel): document Vercel FE / VPS BE origin split

After PR 0, sipher.sip-protocol.org is Vercel; backend is at
api.sipher.sip-protocol.org. Updated env docs accordingly."
```

### PR 0 / Task 10: Run full test suite + open PR

- [ ] **Step 1: Full test sweep**

```bash
cd ~/local-dev/sipher/.worktrees/feat-vercel-fe-split
pnpm install
pnpm test -- --run 2>&1 | tail -10
# expect: 555+ tests passing (root)

cd packages/agent && pnpm test -- --run 2>&1 | tail -10
# expect: 1340+ tests passing (4 new CORS tests added)

cd ..
pnpm exec tsc --noEmit
# expect: clean

cd ../..
pnpm lint
# expect: clean

pnpm build
# expect: clean
```

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/vercel-fe-split
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --repo sip-protocol/sipher --base main \
  --title "feat: split FE to Vercel, backend stays on VPS" \
  --body "$(cat <<'EOF'
## Summary
- Adds `vercel.json` + `.vercelignore` to deploy `app/` to Vercel
- Removes static-file serve from agent backend (`packages/agent/src/index.ts`)
- Tightens CORS: explicit production origin + wildcard pattern for Vercel previews
- 4 new CORS allowlist tests
- Backend now reachable at `api.sipher.sip-protocol.org`; FE at `sipher.sip-protocol.org`

## Why
PR 0 of the glass-neon redesign sprint. Splits FE deployment so each subsequent visual PR auto-deploys a Vercel preview URL, unblocking per-PR review. Spec: `docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md`.

## Test plan
- [x] `pnpm test` (root) — 555+ tests passing
- [x] `pnpm test` (agent) — 1340+ tests passing (4 new CORS tests)
- [x] `pnpm typecheck` — clean
- [x] `pnpm lint` — clean
- [x] `pnpm build` — clean
- [x] Cross-origin auth: Phantom + Solflare + Jupiter manually tested (matrix below)
- [x] DNS cut + SSL provisioned for both origins

## Tested against
| Wallet | Connect | SIWS one-popup | JWT refresh | Disconnect | Status |
|---|---|---|---|---|---|
| Phantom | ✓ | ✓ | ✓ | ✓ | OK |
| Solflare | ✓ | ✓ | ✓ | ✓ | OK |
| Jupiter | ✓ | (signMessage fallback) | ✓ | ✓ | OK |

## Rollback
- DNS: revert CNAME → A record at VPS via Cloudflare API (TTL 60s)
- Code: revert this PR; redeploy old image on VPS
EOF
)"
```

- [ ] **Step 4: Wait for CI**

```bash
sleep 8
gh pr checks $(gh pr view --repo sip-protocol/sipher --json number --jq '.number') --repo sip-protocol/sipher
```

- [ ] **Step 5: After CI green + RECTOR review, merge**

```bash
gh pr merge <PR-NUMBER> --merge --delete-branch --repo sip-protocol/sipher

# Sync local main
cd ~/local-dev/sipher
git checkout main && git pull origin main

# Clean up worktree
git worktree remove .worktrees/feat-vercel-fe-split
git branch -d feat/vercel-fe-split
```

---

## PR 1 — Theme Tokens + UI Primitives (foundation)

**Branch:** `feat/redesign-tokens`
**Worktree:** `.worktrees/feat-redesign-tokens/`
**Goal:** Drop in tokens.css, configure Tailwind 4 @theme, ship 5 primitive components. Zero visual change to existing screens.
**Acceptance:** Vercel preview shows existing UI unchanged (visual regression-free), 5 primitives covered by Vitest tests, build size delta < 30KB gzipped.

### PR 1 / Task 1: Worktree + branch

- [ ] **Step 1: Create worktree from main**

```bash
cd ~/local-dev/sipher
git worktree add -b feat/redesign-tokens .worktrees/feat-redesign-tokens main
cd .worktrees/feat-redesign-tokens
pnpm install
```

### PR 1 / Task 2: Move token sheet into repo

- [ ] **Step 1: Copy from Downloads**

```bash
cp ~/Downloads/sipher-redesign-tokens.css app/src/styles/tokens.css
wc -l app/src/styles/tokens.css
# expect: 301 lines
```

- [ ] **Step 2: Verify checksum (sanity check)**

```bash
shasum -a 256 app/src/styles/tokens.css
# Note the hash; future iterations should produce a different hash
```

- [ ] **Step 3: Commit**

```bash
git add app/src/styles/tokens.css
git commit -m "feat(redesign): drop in designer's token sheet (verbatim, 301 lines)

Source: Claude Designer chat extraction (claude.ai/design/p/019dfc33...).
14 sections: bg layers, glass surfaces, hairlines, text hierarchy,
brand accents, status colors, agent identity, privacy grade, gradients,
typography, spacing, border radius, blur, shadows, glow recipes,
animations, layout. Zero modifications — drop-in updateable artifact
per spec D4."
```

### PR 1 / Task 3: Write `theme.css` (Tailwind 4 @theme bridge)

- [ ] **Step 1: Read existing `app/src/styles/theme.css`**

```bash
cat app/src/styles/theme.css 2>&1 | head -40
# might be empty or have a minimal Tailwind import — note its current state
```

- [ ] **Step 2: Replace with the bridged token block**

Write `app/src/styles/theme.css`:

```css
@import 'tailwindcss';
@import './tokens.css';
@import './glass.css';
@import './animations.css';

@theme {
  /* Color — backgrounds */
  --color-bg: var(--color-bg);
  --color-bg-1: var(--color-bg-1);
  --color-bg-2: var(--color-bg-2);
  --color-bg-3: var(--color-bg-3);
  --color-bg-4: var(--color-bg-4);

  /* Color — surfaces */
  --color-glass-1: var(--color-glass-1);
  --color-glass-2: var(--color-glass-2);
  --color-glass-3: var(--color-glass-3);
  --color-glass-strong: var(--color-glass-strong);

  /* Color — hairlines */
  --color-line: var(--color-line);
  --color-line-2: var(--color-line-2);
  --color-line-strong: var(--color-line-strong);
  --color-line-accent: var(--color-line-accent);

  /* Color — text */
  --color-text: var(--color-text);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-muted: var(--color-text-muted);
  --color-text-dim: var(--color-text-dim);
  --color-text-inverse: var(--color-text-inverse);

  /* Color — brand */
  --color-accent: var(--color-accent);
  --color-accent-hi: var(--color-accent-hi);
  --color-accent-lo: var(--color-accent-lo);
  --color-accent-soft: var(--color-accent-soft);
  --color-accent-glow: var(--color-accent-glow);
  --color-cyan: var(--color-cyan);
  --color-cyan-hi: var(--color-cyan-hi);
  --color-cyan-lo: var(--color-cyan-lo);
  --color-cyan-soft: var(--color-cyan-soft);
  --color-cyan-glow: var(--color-cyan-glow);

  /* Color — status */
  --color-success: var(--color-success);
  --color-success-soft: var(--color-success-soft);
  --color-warning: var(--color-warning);
  --color-warning-soft: var(--color-warning-soft);
  --color-danger: var(--color-danger);
  --color-danger-soft: var(--color-danger-soft);
  --color-info: var(--color-info);
  --color-info-soft: var(--color-info-soft);

  /* Color — agent identity */
  --color-sipher: var(--color-sipher);
  --color-herald: var(--color-herald);
  --color-sentinel: var(--color-sentinel);
  --color-courier: var(--color-courier);

  /* Typography */
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-display: var(--font-display);
  --text-2xs: var(--text-2xs);
  --text-xs: var(--text-xs);
  --text-sm: var(--text-sm);
  --text-base: var(--text-base);
  --text-md: var(--text-md);
  --text-lg: var(--text-lg);
  --text-xl: var(--text-xl);
  --text-2xl: var(--text-2xl);
  --text-3xl: var(--text-3xl);
  --text-4xl: var(--text-4xl);
  --text-5xl: var(--text-5xl);
  --text-6xl: var(--text-6xl);
  --tracking-tight: var(--tracking-tight);
  --tracking-normal: var(--tracking-normal);
  --tracking-wide: var(--tracking-wide);
  --tracking-wider: var(--tracking-wider);
  --tracking-widest: var(--tracking-widest);
  --tracking-mega: var(--tracking-mega);
  --leading-none: var(--leading-none);
  --leading-tight: var(--leading-tight);
  --leading-snug: var(--leading-snug);
  --leading-normal: var(--leading-normal);
  --leading-relaxed: var(--leading-relaxed);

  /* Radius */
  --radius-xs: var(--radius-xs);
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
  --radius-2xl: var(--radius-2xl);
  --radius-3xl: var(--radius-3xl);
  --radius-pill: var(--radius-pill);
  --radius-full: var(--radius-full);

  /* Shadow + glow */
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
  --shadow-glow-accent-sm: var(--glow-accent-sm);
  --shadow-glow-accent-md: var(--glow-accent-md);
  --shadow-glow-accent-lg: var(--glow-accent-lg);
  --shadow-glow-cyan-md: var(--glow-cyan-md);
  --shadow-glow-success: var(--glow-success);
  --shadow-glow-warning: var(--glow-warning);
  --shadow-glow-danger: var(--glow-danger);
  --shadow-glow-focus-ring: var(--glow-focus-ring);
  --shadow-glow-focus-ring-cyan: var(--glow-focus-ring-cyan);

  /* Animation */
  --ease-spring: var(--ease-spring);
  --ease-out-expo: var(--ease-out-expo);
  --ease-out-back: var(--ease-out-back);
}

/* Base resets */
:root {
  color-scheme: dark;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
}

body {
  background: var(--color-bg);
  background-image: var(--gradient-bloom);
  background-attachment: fixed;
  min-height: 100vh;
}

*:focus-visible {
  outline: none;
  box-shadow: var(--glow-focus-ring);
  border-radius: var(--radius-sm);
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

### PR 1 / Task 4: Write `glass.css`

- [ ] **Step 1: Create `app/src/styles/glass.css`**

```css
.glass-1 {
  background: var(--color-glass-1);
  backdrop-filter: var(--backdrop-glass);
  -webkit-backdrop-filter: var(--backdrop-glass);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
}

.glass-2 {
  background: var(--color-glass-2);
  backdrop-filter: var(--backdrop-glass-dense);
  -webkit-backdrop-filter: var(--backdrop-glass-dense);
  border: 1px solid var(--color-line-2);
  border-radius: var(--radius-lg);
}

.glass-strong {
  background: var(--color-glass-strong);
  backdrop-filter: var(--backdrop-glass-modal);
  -webkit-backdrop-filter: var(--backdrop-glass-modal);
  border: 1px solid var(--color-line-strong);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
}

.glass-sheen {
  position: relative;
}

.glass-sheen::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--gradient-card-sheen);
  border-radius: inherit;
  pointer-events: none;
  z-index: 0;
}

.glass-sheen > * {
  position: relative;
  z-index: 1;
}
```

### PR 1 / Task 5: Write `animations.css`

- [ ] **Step 1: Create `app/src/styles/animations.css`**

```css
@keyframes pulse-bloom {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes gauge-fill {
  0% { stroke-dashoffset: 100%; }
  100% { stroke-dashoffset: var(--target-offset); }
}

@keyframes drawer-slide-in {
  0% { transform: translateX(100%); }
  100% { transform: translateX(0); }
}

.animate-pulse-bloom {
  animation: pulse-bloom var(--duration-pulse) var(--ease-in-out) infinite;
}

.animate-shimmer {
  animation: shimmer var(--duration-bloom) var(--ease-linear) infinite;
}
```

### PR 1 / Task 6: Update `app/src/main.tsx` imports

- [ ] **Step 1: Read current main.tsx**

```bash
cat app/src/main.tsx | head -20
```

- [ ] **Step 2: Ensure theme.css is imported (and only theme.css — it cascades)**

Edit imports at top:

```ts
import './styles/theme.css'
// (theme.css imports tokens.css + glass.css + animations.css internally)
```

Remove any other CSS imports that are now redundant.

- [ ] **Step 3: Commit**

```bash
git add app/src/styles/theme.css app/src/styles/glass.css app/src/styles/animations.css app/src/main.tsx
git commit -m "feat(redesign): wire Tailwind 4 @theme block + glass/animations utilities

Bridges designer tokens → Tailwind utilities. Existing components
keep their class names; new utilities (bg-bg, text-text-muted,
shadow-glow-accent-lg, glass-1/-2/-strong, etc.) become available."
```

### PR 1 / Task 7: Build `Card` primitive (TDD)

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/__tests__/Card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card><span>hello</span></Card>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('applies glass-1 class by default', () => {
    const { container } = render(<Card>x</Card>)
    expect(container.firstChild).toHaveClass('glass-1')
  })

  it('applies glass-2 class when variant=elevated', () => {
    const { container } = render(<Card variant="elevated">x</Card>)
    expect(container.firstChild).toHaveClass('glass-2')
    expect(container.firstChild).not.toHaveClass('glass-1')
  })

  it('applies glass-strong class when variant=strong', () => {
    const { container } = render(<Card variant="strong">x</Card>)
    expect(container.firstChild).toHaveClass('glass-strong')
  })

  it('adds glass-sheen class when sheen=true', () => {
    const { container } = render(<Card sheen>x</Card>)
    expect(container.firstChild).toHaveClass('glass-sheen')
  })

  it('forwards className', () => {
    const { container } = render(<Card className="extra">x</Card>)
    expect(container.firstChild).toHaveClass('glass-1')
    expect(container.firstChild).toHaveClass('extra')
  })
})
```

- [ ] **Step 2: Run test, watch fail**

```bash
cd app && pnpm test -- Card --run 2>&1 | tail -10
# expect: FAIL with "Cannot find module '../Card'"
```

- [ ] **Step 3: Implement `Card`**

Create `app/src/components/ui/Card.tsx`:

```tsx
import { ReactNode, HTMLAttributes } from 'react'

type CardVariant = 'default' | 'elevated' | 'strong'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: CardVariant
  sheen?: boolean
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: 'glass-1',
  elevated: 'glass-2',
  strong: 'glass-strong',
}

export function Card({ children, variant = 'default', sheen = false, className = '', ...rest }: CardProps) {
  const classes = [VARIANT_CLASS[variant], sheen ? 'glass-sheen' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run test, watch pass**

```bash
pnpm test -- Card --run 2>&1 | tail -10
# expect: 6 passing
```

- [ ] **Step 5: Commit**

```bash
cd ..
git add app/src/components/ui/Card.tsx app/src/components/ui/__tests__/Card.test.tsx
git commit -m "feat(ui): Card primitive with glass-1/2/strong variants + sheen"
```

### PR 1 / Task 8: Build `Pill` primitive (TDD)

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/__tests__/Pill.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pill } from '../Pill'

describe('Pill', () => {
  it('renders label', () => {
    render(<Pill label="ALL" />)
    expect(screen.getByText('ALL')).toBeInTheDocument()
  })

  it('shows active state via aria-pressed=true', () => {
    render(<Pill label="DEPOSIT" active />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows inactive via aria-pressed=false by default', () => {
    render(<Pill label="WITHDRAW" />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onClick when clicked', () => {
    let called = false
    render(<Pill label="X" onClick={() => { called = true }} />)
    fireEvent.click(screen.getByRole('button'))
    expect(called).toBe(true)
  })

  it('applies size=sm class', () => {
    const { container } = render(<Pill label="X" size="sm" />)
    expect(container.firstChild).toHaveClass('text-2xs')
  })

  it('applies size=md (default) class', () => {
    const { container } = render(<Pill label="X" />)
    expect(container.firstChild).toHaveClass('text-xs')
  })
})
```

- [ ] **Step 2: Run, watch fail**

```bash
cd app && pnpm test -- Pill --run 2>&1 | tail -10
```

- [ ] **Step 3: Implement `Pill`**

Create `app/src/components/ui/Pill.tsx`:

```tsx
import { ButtonHTMLAttributes } from 'react'

interface PillProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  label: string
  active?: boolean
  size?: 'sm' | 'md'
}

export function Pill({ label, active = false, size = 'md', className = '', ...rest }: PillProps) {
  const sizeClass = size === 'sm' ? 'text-2xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
  const stateClass = active
    ? 'bg-accent-soft text-text border-line-accent'
    : 'bg-transparent text-text-muted border-line hover:text-text-secondary hover:border-line-2'
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-1.5 border rounded-pill font-medium tracking-wide uppercase transition-colors ${sizeClass} ${stateClass} ${className}`}
      {...rest}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 4: Run, pass**

```bash
pnpm test -- Pill --run 2>&1 | tail -5
# expect: 6 passing
```

- [ ] **Step 5: Commit**

```bash
cd ..
git add app/src/components/ui/Pill.tsx app/src/components/ui/__tests__/Pill.test.tsx
git commit -m "feat(ui): Pill primitive with active state + size variants"
```

### PR 1 / Task 9: Build `HashCell` primitive (TDD)

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/__tests__/HashCell.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HashCell } from '../HashCell'

describe('HashCell', () => {
  it('truncates a long hash to first4...last4 by default', () => {
    render(<HashCell hash="0x1234567890abcdef1234567890abcdef" />)
    expect(screen.getByText('0x12…cdef')).toBeInTheDocument()
  })

  it('respects a custom truncate length', () => {
    render(<HashCell hash="0x1234567890abcdef1234567890abcdef" headChars={6} tailChars={6} />)
    expect(screen.getByText('0x1234…abcdef')).toBeInTheDocument()
  })

  it('shows full hash when shorter than truncate boundary', () => {
    render(<HashCell hash="0x1234" />)
    expect(screen.getByText('0x1234')).toBeInTheDocument()
  })

  it('copies to clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<HashCell hash="0xabcdef" />)
    fireEvent.click(screen.getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('0xabcdef')
  })

  it('exposes the full hash via title attribute', () => {
    render(<HashCell hash="0xabcdef1234567890" />)
    expect(screen.getByRole('button')).toHaveAttribute('title', '0xabcdef1234567890')
  })
})
```

- [ ] **Step 2: Implement after watching fail**

Create `app/src/components/ui/HashCell.tsx`:

```tsx
import { ButtonHTMLAttributes } from 'react'

interface HashCellProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'title'> {
  hash: string
  headChars?: number
  tailChars?: number
}

function truncate(hash: string, head: number, tail: number): string {
  if (hash.length <= head + tail) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

export function HashCell({ hash, headChars = 4, tailChars = 4, className = '', ...rest }: HashCellProps) {
  const display = truncate(hash, headChars, tailChars)
  const handleCopy = () => {
    navigator.clipboard?.writeText(hash).catch(() => { /* clipboard denied — silent */ })
  }
  return (
    <button
      type="button"
      title={hash}
      onClick={handleCopy}
      className={`inline-flex items-center font-mono text-xs text-text-secondary hover:text-text transition-colors ${className}`}
      {...rest}
    >
      {display}
    </button>
  )
}
```

- [ ] **Step 3: Run pass + commit**

```bash
cd app && pnpm test -- HashCell --run 2>&1 | tail -5
cd ..
git add app/src/components/ui/HashCell.tsx app/src/components/ui/__tests__/HashCell.test.tsx
git commit -m "feat(ui): HashCell primitive — mono-truncated hash with copy-on-click"
```

### PR 1 / Task 10: Build `MetricBar` primitive (TDD)

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/__tests__/MetricBar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricBar } from '../MetricBar'

describe('MetricBar', () => {
  it('renders label + value', () => {
    render(<MetricBar label="Anonymity set" value={84} />)
    expect(screen.getByText('Anonymity set')).toBeInTheDocument()
    expect(screen.getByText('84')).toBeInTheDocument()
  })

  it('renders helper text below the bar', () => {
    render(<MetricBar label="Time decay" value={91} helper="Avg dwell 6d 12h" />)
    expect(screen.getByText('Avg dwell 6d 12h')).toBeInTheDocument()
  })

  it('clamps values above 100 to 100% width', () => {
    const { container } = render(<MetricBar label="x" value={150} />)
    const fill = container.querySelector('[data-testid="metric-bar-fill"]') as HTMLElement
    expect(fill.style.width).toBe('100%')
  })

  it('clamps negative values to 0%', () => {
    const { container } = render(<MetricBar label="x" value={-10} />)
    const fill = container.querySelector('[data-testid="metric-bar-fill"]') as HTMLElement
    expect(fill.style.width).toBe('0%')
  })

  it('uses ARIA progressbar role with proper attrs', () => {
    render(<MetricBar label="x" value={50} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-label', 'x')
  })
})
```

- [ ] **Step 2: Implement**

Create `app/src/components/ui/MetricBar.tsx`:

```tsx
interface MetricBarProps {
  label: string
  value: number
  helper?: string
  max?: number
  className?: string
}

export function MetricBar({ label, value, helper, max = 100, className = '' }: MetricBarProps) {
  const clamped = Math.min(Math.max(value, 0), max)
  const pct = (clamped / max) * 100
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-base text-text">{label}</span>
        <span className="text-base font-mono text-text">{value}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-px bg-line rounded-pill overflow-hidden"
      >
        <div
          data-testid="metric-bar-fill"
          className="h-full rounded-pill transition-[width] duration-base ease-out"
          style={{
            width: `${pct}%`,
            background: 'var(--gradient-progress)',
          }}
        />
      </div>
      {helper && <span className="text-2xs text-text-muted">{helper}</span>}
    </div>
  )
}
```

- [ ] **Step 3: Pass + commit**

```bash
cd app && pnpm test -- MetricBar --run 2>&1 | tail -5
cd ..
git add app/src/components/ui/MetricBar.tsx app/src/components/ui/__tests__/MetricBar.test.tsx
git commit -m "feat(ui): MetricBar primitive — labeled progress bar with cyan→violet gradient"
```

### PR 1 / Task 11: Build `Sheet` primitive (TDD)

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/__tests__/Sheet.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sheet } from '../Sheet'

describe('Sheet', () => {
  it('renders children when open', () => {
    render(<Sheet open onClose={() => {}}><span>chat content</span></Sheet>)
    expect(screen.getByText('chat content')).toBeInTheDocument()
  })

  it('does not render children when closed', () => {
    render(<Sheet open={false} onClose={() => {}}><span>chat content</span></Sheet>)
    expect(screen.queryByText('chat content')).not.toBeInTheDocument()
  })

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn()
    render(<Sheet open onClose={onClose}><span>x</span></Sheet>)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn()
    render(<Sheet open onClose={onClose}><span>x</span></Sheet>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('uses dialog role with aria-modal=true', () => {
    render(<Sheet open onClose={() => {}}><span>x</span></Sheet>)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('exposes a label via aria-label', () => {
    render(<Sheet open onClose={() => {}} ariaLabel="Ask SIPHER"><span>x</span></Sheet>)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Ask SIPHER')
  })
})
```

- [ ] **Step 2: Implement**

Create `app/src/components/ui/Sheet.tsx`:

```tsx
import { ReactNode, useEffect } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
}

export function Sheet({ open, onClose, children, ariaLabel = 'Sheet' }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        data-testid="sheet-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-overlay"
        style={{ animation: 'pulse-bloom var(--duration-bloom) ease-in-out infinite' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className="fixed top-0 right-0 h-full w-full max-w-[420px] z-modal glass-strong overflow-y-auto"
        style={{
          animation: 'drawer-slide-in var(--duration-slow) var(--ease-out-expo) both',
        }}
      >
        {children}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Pass + commit**

```bash
cd app && pnpm test -- Sheet --run 2>&1 | tail -5
cd ..
git add app/src/components/ui/Sheet.tsx app/src/components/ui/__tests__/Sheet.test.tsx
git commit -m "feat(ui): Sheet primitive — right slide-over with backdrop + Escape close"
```

### PR 1 / Task 12: Verify build size delta + visual regression

- [ ] **Step 1: Note baseline build size from main**

```bash
cd ~/local-dev/sipher
git checkout main
cd app && pnpm build
du -sh dist/assets/*.js | tail -3
# Note the largest JS chunk size
git checkout feat/redesign-tokens
cd ../.worktrees/feat-redesign-tokens
```

- [ ] **Step 2: Build current branch**

```bash
cd app && pnpm build
du -sh dist/assets/*.js | tail -3
# Compare to baseline; expect delta < 30KB on largest chunk
```

- [ ] **Step 3: Visual regression check on Vercel preview**

Push branch + open PR (next task). Once Vercel preview deploys, manually verify:
- Existing layout is identical to current production
- Existing colors render correctly (tokens are in CSS vars, but old hardcoded colors still present in components)
- No layout shifts

If any visual differences appear, the @theme imports might be conflicting with existing CSS. Audit `app/src/styles/*` files for old `:root` blocks that override the new tokens.

### PR 1 / Task 13: Open PR

- [ ] **Step 1: Push + open**

```bash
cd ~/local-dev/sipher/.worktrees/feat-redesign-tokens
git push -u origin feat/redesign-tokens
gh pr create --repo sip-protocol/sipher --base main \
  --title "feat(redesign): theme tokens + ui/* primitives (foundation)" \
  --body "$(cat <<'EOF'
## Summary
- Drops in designer's 301-line token sheet at `app/src/styles/tokens.css`
- Wires Tailwind 4 `@theme` block at `app/src/styles/theme.css`
- Adds `glass.css` utilities (.glass-1, .glass-2, .glass-strong, .glass-sheen)
- Adds `animations.css` keyframes
- Ships 5 ui/* primitives with Vitest coverage: Card, Pill, HashCell, MetricBar, Sheet

## PR 1 of redesign sprint
Spec: docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md
Plan: docs/superpowers/plans/2026-05-07-glass-neon-redesign.md

## Test plan
- [x] All component tests pass (Card x6, Pill x6, HashCell x5, MetricBar x5, Sheet x6)
- [x] Build clean
- [x] Build size delta < 30KB
- [x] Vercel preview shows existing UI unchanged (no visual regression)
EOF
)"
```

Wait for CI + RECTOR review. Merge with `--merge --delete-branch`.

---

## PR 2 — Shell Restyle (Header + BottomNav + ChatSidebar slide-over)

**Branch:** `feat/redesign-shell` · **Worktree:** `.worktrees/feat-redesign-shell/`
**Goal:** Frame restyled. ChatSidebar collapses to "Ask SIPHER" trigger. Bottom nav restyled.
**Acceptance:** Vercel preview shows new shell; chat input behaviorally identical (just opens via Sheet now); a11y validated.

### PR 2 / Task 1: Worktree + verify deps

- [ ] **Step 1: Create worktree from main (after PR 1 merged)**

```bash
cd ~/local-dev/sipher
git pull origin main   # pull PR 1 merge
git worktree add -b feat/redesign-shell .worktrees/feat-redesign-shell main
cd .worktrees/feat-redesign-shell
pnpm install
```

- [ ] **Step 2: Confirm tokens are present**

```bash
ls app/src/styles/tokens.css   # should exist from PR 1
test -f app/src/components/ui/Sheet.tsx && echo "Sheet primitive available"
```

### PR 2 / Task 2: Restyle `Header.tsx`

- [ ] **Step 1: Read current Header**

```bash
cat app/src/components/Header.tsx | head -80
```

- [ ] **Step 2: Update Header className/styling to use tokens**

Edit `app/src/components/Header.tsx`. Replace any hardcoded colors (e.g., `bg-[#0a0e1a]`, `text-white`) with token utilities (`bg-bg`, `text-text`). Add the eyebrow tracking for the "SIPHER" wordmark:

```tsx
<header className="hidden md:flex h-12 border-b border-line items-center justify-between px-4 bg-bg shrink-0 z-sticky">
  <div className="flex items-center gap-1">
    <span className="font-semibold text-sm text-text mr-4" style={{ letterSpacing: 'var(--tracking-mega)' }}>
      SIPHER
    </span>
    <span className="text-2xs text-text-muted font-mono">v0.4 · DEVNET</span>
    <nav className="flex items-center ml-4">
      {/* existing tabs map - replace classes */}
```

- [ ] **Step 3: Add "Ask SIPHER" trigger button**

In Header, add a button before the wallet area:

```tsx
<button
  type="button"
  onClick={() => setChatSheetOpen(true)}
  className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary border border-line rounded-md hover:border-line-2 hover:text-text transition-colors"
>
  <ChatCircle size={14} />
  Ask SIPHER
</button>
```

`setChatSheetOpen` will come from a new store slice — see Task 3.

- [ ] **Step 4: Snapshot test for the restyled Header**

Update or create `app/src/components/__tests__/Header.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Header from '../Header'

describe('Header (restyled)', () => {
  it('renders SIPHER wordmark with tracking-mega', () => {
    render(<Header />)
    const wordmark = screen.getByText('SIPHER')
    expect(wordmark).toBeInTheDocument()
  })

  it('exposes Ask SIPHER trigger button', () => {
    render(<Header />)
    expect(screen.getByRole('button', { name: /ask sipher/i })).toBeInTheDocument()
  })
})
```

Run: `pnpm test -- Header --run`. If existing Header tests break due to className changes, update them.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/Header.tsx app/src/components/__tests__/Header.test.tsx
git commit -m "feat(redesign): Header restyle with token utilities + Ask SIPHER trigger"
```

### PR 2 / Task 3: Add chat-sheet store slice

- [ ] **Step 1: Edit `app/src/stores/app.ts`**

Add a new field for the chat sheet:

```ts
interface AppState {
  // ... existing fields ...
  chatSheetOpen: boolean
  setChatSheetOpen: (open: boolean) => void
}
```

Add to state initializer:

```ts
chatSheetOpen: false,
setChatSheetOpen: (open: boolean) => set({ chatSheetOpen: open }),
```

`chatSheetOpen` is intentionally NOT persisted — it lives in memory only.

- [ ] **Step 2: Update Zustand `partialize` to exclude it**

The `partialize` should already only persist `{token, isAdmin, expiresAt}` (per PR #176). Confirm:

```bash
grep -A3 partialize app/src/stores/app.ts
# expect: partialize: (s) => ({ token: s.token, isAdmin: s.isAdmin, expiresAt: s.expiresAt })
```

If `chatSheetOpen` accidentally got included, remove it.

- [ ] **Step 3: Test**

Add to `app/src/stores/__tests__/app.test.ts` (or wherever store tests live):

```ts
it('chatSheetOpen toggles via setChatSheetOpen', () => {
  const { setChatSheetOpen, chatSheetOpen } = useAppStore.getState()
  expect(chatSheetOpen).toBe(false)
  setChatSheetOpen(true)
  expect(useAppStore.getState().chatSheetOpen).toBe(true)
})
```

- [ ] **Step 4: Pass + commit**

```bash
pnpm test -- app.test --run 2>&1 | tail -5
git add app/src/stores/app.ts app/src/stores/__tests__/app.test.ts
git commit -m "feat(store): chatSheetOpen state for Ask SIPHER slide-over"
```

### PR 2 / Task 4: Restyle `BottomNav.tsx`

- [ ] **Step 1: Edit `app/src/components/BottomNav.tsx`**

Replace hardcoded color classes with token utilities:

```tsx
<nav className="flex md:hidden border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]">
  {TABS.map((tab) => {
    const Icon = tab.icon
    const active = activeView === tab.id
    return (
      <button
        key={tab.id}
        onClick={() => setActiveView(tab.id)}
        className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
          active ? 'text-text' : 'text-text-muted'
        }`}
      >
        <Icon size={20} weight={active ? 'fill' : 'regular'} />
        <span className="text-2xs font-medium" style={{ letterSpacing: 'var(--tracking-wide)' }}>
          {tab.label}
        </span>
      </button>
    )
  })}
  {/* ... More button ... */}
</nav>
```

- [ ] **Step 2: Update existing tests for new classes**

If `BottomNav.test.tsx` exists and snapshots class names, update.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/BottomNav.tsx app/src/components/__tests__/BottomNav.test.tsx
git commit -m "feat(redesign): BottomNav restyle with token utilities"
```

### PR 2 / Task 5: Convert ChatSidebar to slide-over

- [ ] **Step 1: Move ChatSidebar contents into Sheet**

Edit `app/src/views/App.tsx`. Find where `<ChatSidebar />` is rendered. Replace with:

```tsx
import { Sheet } from '../components/ui/Sheet'
import ChatSidebar from '../components/ChatSidebar'
import { useAppStore } from '../stores/app'

// In the render:
const chatSheetOpen = useAppStore((s) => s.chatSheetOpen)
const setChatSheetOpen = useAppStore((s) => s.setChatSheetOpen)

// ... main canvas wraps ChatSidebar in Sheet:
<Sheet open={chatSheetOpen} onClose={() => setChatSheetOpen(false)} ariaLabel="Ask SIPHER">
  <ChatSidebar />
</Sheet>
```

Remove the persistent right-rail wrapper. Main content area now spans full width.

- [ ] **Step 2: Update `App.tsx` layout grid**

The old layout was `grid-cols-[240px_1fr_360px]` (sidebar + main + chat rail). New is `grid-cols-[240px_1fr]`:

```tsx
<div className="grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-screen">
  {/* sidebar */}
  {/* main canvas */}
</div>
```

- [ ] **Step 3: e2e test for chat-sheet behavior**

Add to `e2e/chat.spec.ts` (or new file):

```ts
test('Ask SIPHER opens slide-over chat', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /ask sipher/i }).click()
  await expect(page.getByRole('dialog', { name: /ask sipher/i })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: /ask sipher/i })).not.toBeVisible()
})
```

- [ ] **Step 4: Visual regression check**

Run dev server, manually verify Dashboard now has full canvas (no chat rail eating 360px).

- [ ] **Step 5: Commit**

```bash
git add app/src/views/App.tsx e2e/chat.spec.ts
git commit -m "feat(redesign): ChatSidebar collapses to Ask SIPHER slide-over

Reclaims ~360px main canvas width per spec D9. Chat opens via Sheet
on Header trigger, closes on backdrop click or Escape. SSE stream,
auth gate, SENTINEL confirm flow all unchanged."
```

### PR 2 / Task 6: Run full test sweep + open PR

- [ ] **Step 1: Tests + build**

```bash
pnpm test -- --run 2>&1 | tail -10
pnpm typecheck
pnpm lint
pnpm build
```

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin feat/redesign-shell
gh pr create --repo sip-protocol/sipher --base main \
  --title "feat(redesign): shell — Header + BottomNav + ChatSidebar slide-over" \
  --body "PR 2 of redesign sprint. Header gains SIPHER wordmark (mega tracking) + Ask SIPHER trigger. BottomNav restyled. ChatSidebar collapses from persistent right rail to Sheet slide-over (spec D9). Reclaims 360px of main canvas width."
```

Wait for CI + review. Merge.

---

## PR 3 — Dashboard Refresh + Privacy Report Deep Dive

**Branch:** `feat/redesign-dashboard` · **Worktree:** `.worktrees/feat-redesign-dashboard/`
**Goal:** Dashboard view fully restyled with new Gauge component, ActivityStreamTable, TickerBar. Privacy report deep-dive page added.

### PR 3 / Task 1: Worktree + setup

```bash
cd ~/local-dev/sipher
git pull origin main
git worktree add -b feat/redesign-dashboard .worktrees/feat-redesign-dashboard main
cd .worktrees/feat-redesign-dashboard
pnpm install
```

### PR 3 / Task 2: Build `Gauge.tsx` (TDD)

- [ ] **Step 1: Write the failing test**

Create `app/src/components/ui/__tests__/Gauge.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Gauge } from '../Gauge'

describe('Gauge', () => {
  it('renders the value as the central display', () => {
    render(<Gauge value={72} max={100} />)
    expect(screen.getByText('72')).toBeInTheDocument()
  })

  it('renders /max suffix', () => {
    render(<Gauge value={72} max={100} />)
    expect(screen.getByText('/100')).toBeInTheDocument()
  })

  it('renders the grade label when provided', () => {
    render(<Gauge value={72} max={100} gradeLabel="GOOD" />)
    expect(screen.getByText('GOOD')).toBeInTheDocument()
  })

  it('uses ARIA progressbar role', () => {
    render(<Gauge value={72} max={100} ariaLabel="Privacy score" />)
    const gauge = screen.getByRole('progressbar')
    expect(gauge).toHaveAttribute('aria-valuenow', '72')
    expect(gauge).toHaveAttribute('aria-valuemax', '100')
    expect(gauge).toHaveAttribute('aria-label', 'Privacy score')
  })

  it('clamps values above max', () => {
    render(<Gauge value={150} max={100} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('clamps negative values to 0', () => {
    render(<Gauge value={-10} max={100} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
```

- [ ] **Step 2: Implement `Gauge`**

Create `app/src/components/ui/Gauge.tsx`:

```tsx
interface GaugeProps {
  value: number
  max: number
  gradeLabel?: string
  size?: number
  strokeWidth?: number
  ariaLabel?: string
}

export function Gauge({ value, max, gradeLabel, size = 200, strokeWidth = 10, ariaLabel = 'Gauge' }: GaugeProps) {
  const clamped = Math.min(Math.max(value, 0), max)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const fillRatio = clamped / max
  const dashOffset = circumference * (1 - fillRatio)

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <defs>
          <linearGradient id="gauge-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-cyan)" />
            <stop offset="100%" stopColor="var(--color-accent)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gauge-stroke)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: 'stroke-dashoffset var(--duration-slower) var(--ease-spring)',
            filter: 'var(--drop-glow-accent)',
          }}
        />
      </svg>
      <div className="flex flex-col items-center z-raised">
        <div className="flex items-baseline">
          <span className="font-mono text-6xl text-text leading-none" style={{ fontWeight: 'var(--weight-regular)' }}>
            {clamped}
          </span>
          <span className="font-mono text-xl text-text-muted leading-none">/{max}</span>
        </div>
        {gradeLabel && (
          <span className="text-2xs text-text-muted mt-2" style={{ letterSpacing: 'var(--tracking-widest)' }}>
            {gradeLabel}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Pass + commit**

```bash
cd app && pnpm test -- Gauge --run 2>&1 | tail -5
cd ..
git add app/src/components/ui/Gauge.tsx app/src/components/ui/__tests__/Gauge.test.tsx
git commit -m "feat(ui): Gauge primitive — circular SVG with conic gradient + drop glow"
```

### PR 3 / Task 3: Build `TickerBar.tsx`

- [ ] **Step 1: Write tests** (mock fetch for Jupiter price + Helius slot)

Create `app/src/components/ui/__tests__/TickerBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TickerBar } from '../TickerBar'

describe('TickerBar', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders SOL price + slot once data loads', async () => {
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('lite-api.jup.ag/price')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { 'So11111111111111111111111111111111111111112': { usdPrice: 189.62 } } }),
        })
      }
      if (url.includes('/api/health')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) })
      }
      return Promise.reject(new Error('unexpected fetch'))
    })

    render(<TickerBar />)
    await waitFor(() => {
      expect(screen.getByText(/SOL/)).toBeInTheDocument()
      expect(screen.getByText(/189\.62/)).toBeInTheDocument()
    })
  })

  it('shows fallback dashes when fetch fails', async () => {
    ;(global.fetch as any).mockRejectedValue(new Error('network'))
    render(<TickerBar />)
    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Implement TickerBar**

Create `app/src/components/ui/TickerBar.tsx`:

```tsx
import { useEffect, useState } from 'react'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const POLL_MS = 5000

interface Tick {
  solUsd: number | null
  slot: number | null
}

export function TickerBar() {
  const [tick, setTick] = useState<Tick>({ solUsd: null, slot: null })

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`)
        if (!res.ok) throw new Error('price fetch failed')
        const json = (await res.json()) as { data: Record<string, { usdPrice: number }> }
        const solUsd = json.data?.[SOL_MINT]?.usdPrice ?? null
        if (!cancelled) setTick((prev) => ({ ...prev, solUsd }))
      } catch {
        if (!cancelled) setTick((prev) => ({ ...prev, solUsd: null }))
      }
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="flex items-center gap-4 text-xs font-mono text-text-secondary">
      <span>SOL <span className="text-text">{tick.solUsd != null ? tick.solUsd.toFixed(2) : '—'}</span></span>
      <span className="text-text-muted">·</span>
      <span>SLOT <span className="text-text">{tick.slot != null ? tick.slot.toLocaleString() : '—'}</span></span>
    </div>
  )
}
```

> Note: SLOT is not yet wired (kept as `—` placeholder). Wire it in PR 5 alongside `/api/chains` if you want; or in this PR via a separate Helius call.

- [ ] **Step 3: Pass + commit**

```bash
cd app && pnpm test -- TickerBar --run 2>&1 | tail -5
cd ..
git add app/src/components/ui/TickerBar.tsx app/src/components/ui/__tests__/TickerBar.test.tsx
git commit -m "feat(ui): TickerBar primitive — Jupiter price-v3 polling with fallback"
```

### PR 3 / Task 4: Extract `PrivacyScoreCard.tsx` from DashboardView

- [ ] **Step 1: Read current DashboardView privacy block**

```bash
sed -n '70,100p' app/src/views/DashboardView.tsx
```

- [ ] **Step 2: Create `PrivacyScoreCard.tsx`**

Create `app/src/components/PrivacyScoreCard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Card } from './ui/Card'
import { Gauge } from './ui/Gauge'
import { MetricBar } from './ui/MetricBar'

interface PrivacyData {
  score: number
  grade: string
  factors: {
    addressReuse: { score: number; detail: string }
    amountPatterns: { score: number; detail: string }
    timingCorrelation: { score: number; detail: string }
    counterpartyExposure: { score: number; detail: string }
  }
  recommendations: string[]
  transactionsAnalyzed: number
}

interface PrivacyScoreCardProps {
  data: PrivacyData | null
  delta?: number
}

export function PrivacyScoreCard({ data, delta }: PrivacyScoreCardProps) {
  return (
    <Card variant="default" sheen className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex items-center justify-center">
          <Gauge
            value={data?.score ?? 0}
            max={100}
            gradeLabel={data?.grade ?? '—'}
            ariaLabel="Privacy score"
          />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xs text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
                PRIVACY SCORE
              </div>
              <div className="text-base mt-1">
                {delta != null && (
                  <span className="text-cyan font-mono">{delta > 0 ? '+' : ''}{delta}</span>
                )}
                <span className="text-text-muted"> vs last week</span>
              </div>
            </div>
            <Link
              to="/privacy-report"
              className="text-xs text-text-secondary border border-line rounded-md px-3 py-1.5 hover:border-line-2 hover:text-text transition-colors"
            >
              View report →
            </Link>
          </div>
          {data && (
            <div className="flex flex-col gap-3">
              <MetricBar
                label="Anonymity set"
                value={data.factors.addressReuse.score}
                helper={data.factors.addressReuse.detail}
              />
              <MetricBar
                label="Time decay"
                value={data.factors.amountPatterns.score}
                helper={data.factors.amountPatterns.detail}
              />
              <MetricBar
                label="Withdraw routing"
                value={data.factors.timingCorrelation.score}
                helper={data.factors.timingCorrelation.detail}
              />
              <MetricBar
                label="Address hygiene"
                value={data.factors.counterpartyExposure.score}
                helper={data.factors.counterpartyExposure.detail}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: Test it**

Create `app/src/components/__tests__/PrivacyScoreCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PrivacyScoreCard } from '../PrivacyScoreCard'

const fakeData = {
  score: 72,
  grade: 'GOOD',
  factors: {
    addressReuse: { score: 84, detail: '1,284 active depositors' },
    amountPatterns: { score: 91, detail: 'Avg dwell 6d 12h' },
    timingCorrelation: { score: 68, detail: '2 of 3 hops randomized' },
    counterpartyExposure: { score: 54, detail: 'Reused source detected' },
  },
  recommendations: [],
  transactionsAnalyzed: 1284,
}

describe('PrivacyScoreCard', () => {
  it('renders score 72 + grade GOOD', () => {
    render(<MemoryRouter><PrivacyScoreCard data={fakeData} delta={4} /></MemoryRouter>)
    expect(screen.getByText('72')).toBeInTheDocument()
    expect(screen.getByText('GOOD')).toBeInTheDocument()
    expect(screen.getByText('+4')).toBeInTheDocument()
  })

  it('shows all 4 metric bars with detail text', () => {
    render(<MemoryRouter><PrivacyScoreCard data={fakeData} /></MemoryRouter>)
    expect(screen.getByText('Anonymity set')).toBeInTheDocument()
    expect(screen.getByText('1,284 active depositors')).toBeInTheDocument()
  })

  it('renders gauge at 0 with em-dash grade when data is null', () => {
    render(<MemoryRouter><PrivacyScoreCard data={null} /></MemoryRouter>)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Pass + commit**

```bash
cd app && pnpm test -- PrivacyScoreCard --run 2>&1 | tail -5
cd ..
git add app/src/components/PrivacyScoreCard.tsx app/src/components/__tests__/PrivacyScoreCard.test.tsx
git commit -m "feat(redesign): extract PrivacyScoreCard from DashboardView"
```

### PR 3 / Task 5: Build `ActivityStreamTable.tsx`

- [ ] **Step 1: Implement (with filter pills)**

Create `app/src/components/ActivityStreamTable.tsx`:

```tsx
import { useState, useMemo } from 'react'
import { Card } from './ui/Card'
import { Pill } from './ui/Pill'
import { HashCell } from './ui/HashCell'

type FilterKey = 'all' | 'deposit' | 'withdraw' | 'relay'

interface ActivityRow {
  id: string
  agent: string
  type: string
  level: string
  timestamp: string
  data: Record<string, unknown>
}

interface ActivityStreamTableProps {
  rows: ActivityRow[]
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'ALL' },
  { key: 'deposit', label: 'DEPOSIT' },
  { key: 'withdraw', label: 'WITHDRAW' },
  { key: 'relay', label: 'RELAY' },
]

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ActivityStreamTable({ rows }: ActivityStreamTableProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter((r) => r.type.toLowerCase().includes(filter))
  }, [rows, filter])

  return (
    <Card variant="default" className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xs text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
          ACTIVITY STREAM · LAST 24H
        </h3>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <Pill
              key={f.key}
              label={f.label}
              size="sm"
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
            />
          ))}
        </div>
      </div>
      <table className="w-full text-xs">
        <thead className="text-2xs text-text-muted" style={{ letterSpacing: 'var(--tracking-wider)' }}>
          <tr>
            <th className="text-left font-medium pb-3">TIME</th>
            <th className="text-left font-medium pb-3">TYPE</th>
            <th className="text-left font-medium pb-3">VIA</th>
            <th className="text-left font-medium pb-3">HASH</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="py-3 font-mono text-text-secondary">{formatTime(row.timestamp)}</td>
              <td className="py-3">
                <Pill label={row.type.toUpperCase()} size="sm" />
              </td>
              <td className="py-3 text-text-secondary">{row.agent}</td>
              <td className="py-3">
                <HashCell hash={(row.data.signature as string) ?? '—'} />
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-text-muted text-sm">
                No activity in the last 24h.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}
```

- [ ] **Step 2: Test**

Create `app/src/components/__tests__/ActivityStreamTable.test.tsx` covering: rows render, filter pills work, empty state, hash truncation. (Standard pattern — see Task 4 for shape.)

- [ ] **Step 3: Pass + commit**

```bash
git add app/src/components/ActivityStreamTable.tsx app/src/components/__tests__/ActivityStreamTable.test.tsx
git commit -m "feat(redesign): ActivityStreamTable with filter pills + hash truncation"
```

### PR 3 / Task 6: Restyle `DashboardView.tsx`

- [ ] **Step 1: Replace existing JSX with new layout**

Edit `app/src/views/DashboardView.tsx`. Replace the metric cards section with:

```tsx
<div className="space-y-6 p-6">
  {/* Hero — Privacy Score, Shielded Volume placeholder */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2">
      <PrivacyScoreCard data={privacyData} delta={4 /* placeholder until backend exposes */} />
    </div>
    <div>
      {/* Shielded Volume placeholder until PR 4 */}
      <Card variant="default" className="p-6 h-full flex flex-col justify-center items-center">
        <span className="text-2xs text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
          SHIELDED VOLUME · 24H
        </span>
        <span className="text-4xl font-mono text-text mt-2">—</span>
        <span className="text-xs text-text-muted mt-1">aggregator endpoint lands in PR 4</span>
      </Card>
    </div>
  </div>

  {/* Activity stream */}
  <ActivityStreamTable rows={history} />
</div>
```

- [ ] **Step 2: Update imports** (Card, PrivacyScoreCard, ActivityStreamTable)

- [ ] **Step 3: Verify dashboard tests still pass**

```bash
cd app && pnpm test -- DashboardView --run 2>&1 | tail -10
```

If the test was checking specific mock-data text that's no longer present, update the test.

- [ ] **Step 4: Commit**

```bash
cd ..
git add app/src/views/DashboardView.tsx
git commit -m "feat(redesign): DashboardView restyle — gauge + activity stream + hero layout"
```

### PR 3 / Task 7: Build `PrivacyReportView.tsx` (deep-dive page)

- [ ] **Step 1: Add route in App.tsx**

```tsx
<Route path="/privacy-report" element={<PrivacyReportView />} />
```

- [ ] **Step 2: Create the view**

Create `app/src/views/PrivacyReportView.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'
import { Card } from '../components/ui/Card'
import { Gauge } from '../components/ui/Gauge'
import { MetricBar } from '../components/ui/MetricBar'

interface PrivacyData {
  score: number
  grade: string
  factors: Record<string, { score: number; detail: string }>
  recommendations: string[]
  transactionsAnalyzed: number
}

export default function PrivacyReportView() {
  const navigate = useNavigate()
  const { token } = useAuthState()
  const [data, setData] = useState<PrivacyData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    apiFetch<{ data: PrivacyData }>('/v1/privacy/score', {
      method: 'POST',
      token,
      body: JSON.stringify({ limit: 500 }),
    })
      .then((j) => setData(j.data))
      .catch((e) => setError(e.message))
  }, [token])

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </button>
      {error && <div className="text-danger">{error}</div>}
      {data && (
        <>
          <Card variant="default" sheen className="p-8">
            <div className="flex flex-col items-center gap-4">
              <Gauge value={data.score} max={100} gradeLabel={data.grade} ariaLabel="Privacy score" />
              <span className="text-base text-text-muted">
                Based on {data.transactionsAnalyzed.toLocaleString()} transactions analyzed
              </span>
            </div>
          </Card>
          <Card variant="default" className="p-6 space-y-4">
            <h2 className="text-xs text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
              FACTOR BREAKDOWN
            </h2>
            {Object.entries(data.factors).map(([key, factor]) => (
              <MetricBar
                key={key}
                label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                value={factor.score}
                helper={factor.detail}
              />
            ))}
          </Card>
          {data.recommendations.length > 0 && (
            <Card variant="default" className="p-6 space-y-3">
              <h2 className="text-xs text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
                RECOMMENDATIONS
              </h2>
              <ul className="space-y-2">
                {data.recommendations.map((r, i) => (
                  <li key={i} className="text-base text-text-secondary">• {r}</li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Test the route** (basic smoke test)

Create `app/src/views/__tests__/PrivacyReportView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyReportView from '../PrivacyReportView'

vi.mock('../../api/client', () => ({
  apiFetch: vi.fn().mockResolvedValue({
    data: {
      score: 72, grade: 'GOOD',
      factors: {
        addressReuse: { score: 84, detail: 'reuse detail' },
      },
      recommendations: ['Use a fresh address'],
      transactionsAnalyzed: 1284,
    },
  }),
}))

vi.mock('../../hooks/useAuthState', () => ({
  useAuthState: () => ({ token: 'abc', isAdmin: false }),
}))

describe('PrivacyReportView', () => {
  it('renders score + recommendations', async () => {
    render(<MemoryRouter><PrivacyReportView /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('72')).toBeInTheDocument())
    expect(screen.getByText(/1,284/)).toBeInTheDocument()
    expect(screen.getByText('Use a fresh address')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Commit**

```bash
git add app/src/views/PrivacyReportView.tsx app/src/views/__tests__/PrivacyReportView.test.tsx app/src/views/App.tsx
git commit -m "feat(redesign): PrivacyReportView deep-dive page (View report → button)"
```

### PR 3 / Task 8: Wire TickerBar into Header

- [ ] **Step 1: Edit Header.tsx**

In Header, replace the placeholder ticker spans (if any from Task 2) with:

```tsx
import { TickerBar } from './ui/TickerBar'
// ...
<TickerBar />
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/Header.tsx
git commit -m "feat(redesign): wire TickerBar into Header (live SOL price)"
```

### PR 3 / Task 9: Open PR

```bash
pnpm test -- --run 2>&1 | tail -5
pnpm typecheck && pnpm lint && pnpm build
git push -u origin feat/redesign-dashboard
gh pr create --repo sip-protocol/sipher --base main \
  --title "feat(redesign): dashboard refresh + privacy report deep dive" \
  --body "PR 3. Gauge primitive, PrivacyScoreCard, ActivityStreamTable, TickerBar, PrivacyReportView route. Dashboard hero + activity stream restyled. View report → opens new deep-dive page reading existing /v1/privacy/score recommendations array."
```

---

## PR 4 — Privacy Graph + Shielded Volume Card

**Branch:** `feat/redesign-privacy-graph` · **Worktree:** `.worktrees/feat-redesign-privacy-graph/`
**Goal:** Replace mocked Network atlas + Anonymity Set with real reinterpreted surfaces. Backend adds `/api/stealth/index` + `/api/chains/aggregate`.

### PR 4 / Task 1: Backend `/api/chains/aggregate` (TDD)

- [ ] **Step 1: Write failing route test**

Create `packages/agent/tests/routes/chains-aggregate.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'

describe('GET /api/chains/aggregate', () => {
  let app: any

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-at-least-16-chars'
    process.env.SIPHER_NETWORK = 'devnet'
    process.env.SIPHER_HELIUS_API_KEY = 'test-key'
    const mod = await import('../../src/index.js')
    app = mod.app
  })

  it('returns sum TVL across chains as { totalTvlSol, chainCount }', async () => {
    const res = await request(app).get('/api/chains/aggregate')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('totalTvlSol')
    expect(typeof res.body.totalTvlSol).toBe('number')
    expect(res.body).toHaveProperty('chainCount')
    expect(res.body.chainCount).toBeGreaterThan(0)
  })

  it('does not require auth (public endpoint)', async () => {
    const res = await request(app).get('/api/chains/aggregate')
    expect(res.status).not.toBe(401)
  })
})
```

- [ ] **Step 2: Implement the route**

Create `packages/agent/src/routes/chains.ts`:

```ts
import { Router, Request, Response } from 'express'
import { loadNetworkConfig } from '../config/network.js'

export const chainsRouter = Router()

interface ChainStatus {
  chainId: string
  network: 'mainnet' | 'devnet' | 'testnet'
  programId: string
  vaultPda: string
  tvlSol: number
  feeBps: number
  status: 'live' | 'pending'
  rpcLatencyMs: number | null
}

const CHAINS: ChainStatus[] = [
  // Solana
  {
    chainId: 'solana-mainnet',
    network: 'mainnet',
    programId: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
    vaultPda: 'BVawZkppFewygA5nxdrLma4ThKx8Th7bW4KTCkcWTZwZ',
    tvlSol: 0,
    feeBps: 50,
    status: 'live',
    rpcLatencyMs: null,
  },
  // EVM L2s — populated from contracts/sip-ethereum/DEPLOYMENT.md addresses
  // Each card surfaces: chain, deployment status, tvl placeholder
  // Real TVL aggregation lands in PR 5; PR 4 just sums what's known
]

chainsRouter.get('/aggregate', (_req: Request, res: Response) => {
  const totalTvlSol = CHAINS.reduce((sum, c) => sum + c.tvlSol, 0)
  res.json({
    totalTvlSol,
    chainCount: CHAINS.length,
    asOf: new Date().toISOString(),
  })
})

chainsRouter.get('/', (_req: Request, res: Response) => {
  res.json({ chains: CHAINS })
})
```

- [ ] **Step 3: Mount in `index.ts`**

```ts
import { chainsRouter } from './routes/chains.js'
// ...
app.use('/api/chains', chainsRouter)
```

- [ ] **Step 4: Run pass + commit**

```bash
cd packages/agent && pnpm test -- chains-aggregate --run 2>&1 | tail -5
cd ../..
git add packages/agent/src/routes/chains.ts packages/agent/src/index.ts packages/agent/tests/routes/chains-aggregate.test.ts
git commit -m "feat(agent): GET /api/chains + /api/chains/aggregate

Public endpoints. Returns per-chain vault deployment status (live or
pending) for FE multi-chain grid + sum TVL aggregation for shielded
volume card. PR 5 will wire real TVL; PR 4 establishes the schema."
```

### PR 4 / Task 2: Backend `/api/stealth/index`

- [ ] **Step 1: Tests + implementation similar to Task 1**

Create `packages/agent/src/routes/stealth-index.ts`:

```ts
import { Router, Request, Response } from 'express'
import { verifyJwt } from './auth.js'

export const stealthIndexRouter = Router()

interface StealthNode {
  index: number
  derivationPath: string
  stealthAddress: string
  parentIndex: number | null
  createdAt: string
}

stealthIndexRouter.get('/', verifyJwt, (req: Request, res: Response) => {
  const wallet = req.wallet
  if (!wallet) {
    res.status(500).json({ error: { code: 'INTERNAL', message: 'JWT did not attach wallet' } })
    return
  }
  // Stub: real implementation derives from SDK viewing-key.ts
  // For now, return root-only structure based on user's wallet
  const tree: StealthNode[] = [
    {
      index: 0,
      derivationPath: 'm/0\'',
      stealthAddress: wallet,
      parentIndex: null,
      createdAt: new Date().toISOString(),
    },
  ]
  res.json({ tree, rootWallet: wallet })
})
```

Mount: `app.use('/api/stealth/index', stealthIndexRouter)` in index.ts (note: no `/index` typo — path is `/api/stealth/index`, but the route under `/api/stealth/index` is `/`).

Actually mount as: `app.use('/api/stealth', stealthIndexRouter)` and the route is `/index`:

```ts
stealthIndexRouter.get('/index', verifyJwt, ...)
```

- [ ] **Step 2: Tests + commit**

```ts
// packages/agent/tests/routes/stealth-index.test.ts
// ... auth + happy path tests
```

### PR 4 / Task 3: Build `NodeGraph.tsx` (react-flow wrapper)

- [ ] **Step 1: Add dependency**

```bash
cd ~/local-dev/sipher/.worktrees/feat-redesign-privacy-graph/app
pnpm add reactflow@latest
```

- [ ] **Step 2: Implement NodeGraph**

Create `app/src/components/ui/NodeGraph.tsx`:

```tsx
import { useMemo } from 'react'
import ReactFlow, { Background, Controls, type Node, type Edge } from 'reactflow'
import 'reactflow/dist/style.css'

export interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  isRoot?: boolean
}

export interface GraphEdge {
  source: string
  target: string
}

interface NodeGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export function NodeGraph({ nodes, edges }: NodeGraphProps) {
  const rfNodes: Node[] = useMemo(
    () => nodes.map((n) => ({
      id: n.id,
      position: { x: n.x, y: n.y },
      data: { label: n.label },
      style: {
        background: n.isRoot ? 'var(--color-cyan)' : 'var(--color-glass-2)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-line-accent)',
        borderRadius: 'var(--radius-pill)',
        padding: '8px 14px',
        fontSize: 11,
        boxShadow: n.isRoot ? 'var(--glow-cyan-md)' : 'var(--glow-accent-sm)',
      },
    })),
    [nodes],
  )
  const rfEdges: Edge[] = useMemo(
    () => edges.map((e, i) => ({
      id: `e${i}`,
      source: e.source,
      target: e.target,
      style: { stroke: 'var(--color-cyan-soft)', strokeWidth: 1.5 },
      animated: true,
    })),
    [edges],
  )

  return (
    <div style={{ width: '100%', height: 400 }}>
      <ReactFlow nodes={rfNodes} edges={rfEdges} fitView>
        <Background color="var(--color-line)" gap={24} />
        <Controls className="bg-bg-2 border border-line rounded-md" />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/pnpm-lock.yaml app/src/components/ui/NodeGraph.tsx
git commit -m "feat(ui): NodeGraph primitive — react-flow wrapper styled with tokens"
```

### PR 4 / Task 4: Build `PrivacyGraph.tsx` consumer

- [ ] **Step 1: Implement**

Create `app/src/components/PrivacyGraph.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Card } from './ui/Card'
import { NodeGraph, type GraphNode, type GraphEdge } from './ui/NodeGraph'
import { apiFetch } from '../api/client'
import { useAuthState } from '../hooks/useAuthState'

interface StealthNode {
  index: number
  derivationPath: string
  stealthAddress: string
  parentIndex: number | null
  createdAt: string
}

export function PrivacyGraph() {
  const { token } = useAuthState()
  const [tree, setTree] = useState<StealthNode[]>([])

  useEffect(() => {
    if (!token) return
    apiFetch<{ tree: StealthNode[]; rootWallet: string }>('/api/stealth/index', { token })
      .then((j) => setTree(j.tree))
      .catch(() => setTree([]))
  }, [token])

  const nodes: GraphNode[] = tree.map((n, i) => ({
    id: String(n.index),
    label: `#${n.index}`,
    x: i * 140,
    y: n.parentIndex == null ? 200 : 100,
    isRoot: n.parentIndex == null,
  }))
  const edges: GraphEdge[] = tree
    .filter((n) => n.parentIndex != null)
    .map((n) => ({ source: String(n.parentIndex), target: String(n.index) }))

  return (
    <Card variant="default" sheen className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xs text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
          PRIVACY GRAPH · STEALTH ADDRESS TREE
        </span>
        <span className="text-xs text-text-muted">{tree.length} addresses</span>
      </div>
      {tree.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center text-text-muted text-sm">
          Connect a wallet to see your privacy graph.
        </div>
      ) : (
        <NodeGraph nodes={nodes} edges={edges} />
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Test + commit** (mocked apiFetch)

### PR 4 / Task 5: Build `ShieldedVolumeCard.tsx`

- [ ] **Step 1: Create**

```tsx
// app/src/components/ShieldedVolumeCard.tsx
import { useEffect, useState } from 'react'
import { Card } from './ui/Card'
import { apiFetch } from '../api/client'

export function ShieldedVolumeCard() {
  const [data, setData] = useState<{ totalTvlSol: number; chainCount: number } | null>(null)

  useEffect(() => {
    apiFetch<{ totalTvlSol: number; chainCount: number; asOf: string }>('/api/chains/aggregate')
      .then(setData)
      .catch(() => setData(null))
  }, [])

  return (
    <Card variant="default" className="p-6 h-full flex flex-col justify-center">
      <span className="text-2xs text-text-muted" style={{ letterSpacing: 'var(--tracking-widest)' }}>
        SHIELDED VOLUME · {data?.chainCount ?? 0} CHAINS
      </span>
      <div className="flex items-baseline gap-2 mt-3">
        <span className="text-4xl font-mono text-text">
          {data ? data.totalTvlSol.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
        </span>
        <span className="text-base text-text-muted">SOL</span>
      </div>
      <span className="text-xs text-text-muted mt-1">aggregated across all SIP vault deployments</span>
    </Card>
  )
}
```

- [ ] **Step 2: Wire into DashboardView (replace the placeholder from PR 3)**

```tsx
import { PrivacyGraph } from '../components/PrivacyGraph'
import { ShieldedVolumeCard } from '../components/ShieldedVolumeCard'
// Replace the temporary placeholder Card with <ShieldedVolumeCard />
// Add <PrivacyGraph /> as a hero block above the score grid
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/PrivacyGraph.tsx app/src/components/ShieldedVolumeCard.tsx app/src/views/DashboardView.tsx
git commit -m "feat(redesign): wire PrivacyGraph hero + ShieldedVolumeCard into Dashboard"
```

### PR 4 / Task 6: Open PR

```bash
pnpm test -- --run && pnpm typecheck && pnpm lint && pnpm build
git push -u origin feat/redesign-privacy-graph
gh pr create --repo sip-protocol/sipher --base main \
  --title "feat(redesign): privacy graph + shielded volume — replace mocked Network atlas + Anonymity Set"
```

---

## PR 5 — Multi-Chain Vault Grid (Chains tab)

**Branch:** `feat/redesign-chains` · **Worktree:** `.worktrees/feat-redesign-chains/`
**Goal:** New `/chains` route with full per-chain vault status table. Dashboard mini-grid.

### PR 5 / Task 1: Extend `/api/chains` with real TVL

- [ ] **Step 1: Update `chains.ts` with TVL queries**

Add Solana TVL via Helius `getBalance` on the vault PDA, EVM TVL via RPC `eth_getBalance` on each L2 contract. Use `Promise.allSettled` so a single chain RPC failure doesn't break the response.

```ts
// packages/agent/src/routes/chains.ts (updated)
async function fetchSolanaVaultTvl(): Promise<number> {
  const cfg = loadNetworkConfig()
  const conn = new Connection(cfg.rpcUrl, 'confirmed')
  const lamports = await conn.getBalance(new PublicKey(VAULT_PDA))
  return lamports / 1e9
}

// ... similar for each EVM L2

chainsRouter.get('/', async (_req, res) => {
  const results = await Promise.allSettled([
    fetchSolanaVaultTvl(),
    // ... EVM L2s
  ])
  const chains = CHAINS.map((c, i) => {
    const r = results[i]
    return { ...c, tvlSol: r.status === 'fulfilled' ? r.value : 0 }
  })
  res.json({ chains })
})
```

- [ ] **Step 2: Test with mocked RPC + commit**

### PR 5 / Task 2: Build `MultiChainVaultGrid.tsx` (Dashboard mini-cards)

- [ ] **Step 1: Implement small grid for Dashboard**

```tsx
// app/src/components/MultiChainVaultGrid.tsx
import { useEffect, useState } from 'react'
import { Card } from './ui/Card'
import { Pill } from './ui/Pill'
import { apiFetch } from '../api/client'

interface Chain {
  chainId: string
  network: string
  tvlSol: number
  feeBps: number
  status: 'live' | 'pending'
}

export function MultiChainVaultGrid() {
  const [chains, setChains] = useState<Chain[]>([])

  useEffect(() => {
    apiFetch<{ chains: Chain[] }>('/api/chains').then((j) => setChains(j.chains))
  }, [])

  return (
    <Card variant="default" className="p-6">
      <span className="text-2xs text-text-muted block mb-4" style={{ letterSpacing: 'var(--tracking-widest)' }}>
        MULTI-CHAIN VAULTS
      </span>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {chains.map((c) => (
          <div key={c.chainId} className="p-3 bg-bg-2 rounded-md border border-line">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-secondary capitalize">{c.chainId.replace('-', ' ')}</span>
              <Pill label={c.status.toUpperCase()} size="sm" active={c.status === 'live'} />
            </div>
            <div className="font-mono text-sm text-text">{c.tvlSol.toFixed(2)} SOL</div>
            <div className="text-2xs text-text-muted">fee {c.feeBps} bps</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Wire into DashboardView**, commit.

### PR 5 / Task 3: Build `ChainsView.tsx` (full /chains route)

- [ ] **Step 1: Implement** — full table with all columns (chain / status / TVL / fee / program ID with HashCell).

- [ ] **Step 2: Add route in App.tsx** at `/chains`. Add nav entry in Header `TABS` array.

- [ ] **Step 3: Test, commit, PR.**

---

## PR 6 — Vault + Deposit + Withdraw Surfaces

**Branch:** `feat/redesign-vault-flows` · **Worktree:** `.worktrees/feat-redesign-vault-flows/`
**Goal:** Stealth-address-list view + amount-driven deposit/withdraw forms.

### PR 6 / Task 1: Extend `/api/vault` to return stealth address list

The current `/api/vault` returns a single `wallet` field. Extend to include the stealth-address tree with derivation indices.

```ts
// In packages/agent/src/routes/vault-api.ts
res.json({
  wallet,
  network,
  balances: { ... },
  stealthAddresses: [
    { index: 0, derivationPath: 'm/0\'', address: derivedAddr0, lastActivityAt: '...', amountSol: 0.5, status: 'shielded' },
    // ...
  ],
})
```

Test with supertest: assert `stealthAddresses` array shape, that each has required fields.

### PR 6 / Task 2: Build `StealthAddressList.tsx`

- [ ] **Step 1: Implement** — replicates designer's "notes" list layout with derivation index, last-activity timestamp ("3d ago"), amount, "Manage" button.

```tsx
// Each row has: derivation index badge, address (HashCell), last-activity time, amount, status pill, Manage menu
```

### PR 6 / Task 3: Restyle `VaultView.tsx` into split-panel

- [ ] **Step 1: New layout**

```tsx
// Left: ShieldedVault panel — total balance + StealthAddressList + Withdraw CTA
// Right: UnshieldedWallet panel — wallet balance + Shield to vault CTA + RoutePreviewCard
```

### PR 6 / Task 4: Build `RoutePreviewCard.tsx`

- [ ] **Step 1: Implement** — 3-step numbered list:
  1. You (wallet hash)
  2. Vault PDA (program ID)
  3. Stealth #k (derived address)

### PR 6 / Task 5: Build `DepositView.tsx` route

- [ ] **Step 1: Form-driven UI** — amount input, asset selector, real-time PrivacyPreviewPanel on the right.

### PR 6 / Task 6: Build `WithdrawView.tsx` route

- [ ] **Step 1: Claim flow** — list of claimable stealth addresses with "Claim" buttons.

### PR 6 / Task 7: Build `PrivacyPreviewPanel.tsx`

- [ ] **Step 1: Implement** — calls `/v1/privacy/score?projected=AMOUNT` and renders the projected-after-deposit metrics.

### PR 6 / Task 8: Extend `/v1/privacy/score` for `?projected=` query

- [ ] **Step 1: Backend** — accepts `projected` query param; if present, computes hypothetical score after a deposit of that amount.

### PR 6 / Task 9: Tests, types, lint, build, PR

---

## PR 7 — Keys + Settings Surfaces

**Branch:** `feat/redesign-keys-settings`
**Goal:** New `/keys` and `/settings` routes.

### PR 7 / Task 1: Backend `/api/viewing-keys` endpoints

- [ ] `GET /api/viewing-keys` — return user's viewing keys (encoded)
- [ ] `POST /api/viewing-keys/rotate` — rotate the active viewing key
- [ ] supertest tests covering auth + happy path

### PR 7 / Task 2: Build `KeysView.tsx`

- [ ] Two cards: ViewKeyCard (left, copy + rotate buttons) + StealthAddressBackup (right, encrypted backup download)

### PR 7 / Task 3: Build `SettingsView.tsx`

- [ ] Admin-gated. Surfaces network, SENTINEL mode, FUND_MOVING_TOOLS list.

### PR 7 / Task 4: Routes, nav, tests, PR

---

## PR 8 — Admin Views Restyle

**Branch:** `feat/redesign-admin`
**Goal:** Apply visual language to Herald + Squad + SENTINEL with identity colors per agent.

### PR 8 / Task 1: HeraldView.tsx restyle

- [ ] Use `--color-herald` (blue) accents on hero CTAs, status pills, charts. Existing budget/queue logic untouched.

### PR 8 / Task 2: SquadView.tsx restyle

- [ ] Use `--color-sentinel` (amber) accents. 4-agent dashboard cards take Card variant=elevated.

### PR 8 / Task 3: SentinelConfirm.tsx restyle

- [ ] Use Sheet primitive for the confirmation modal. Keep all action wiring intact.

### PR 8 / Task 4: Tests, PR

---

## PR 9 — ROADMAP.md + Phase D Launch Prep

**Branch:** `chore/roadmap-design-anchor`
**Goal:** Public roadmap published with design as visual north star.

### PR 9 / Task 1: Rewrite `ROADMAP.md`

- [ ] **Step 1: Open ROADMAP.md, draft new structure**

```markdown
# Sipher Roadmap

> Visual north star: see screenshots embedded per quarter milestone.

## Q2 2026 — Devnet beta (LIVE)
[screenshot of Dashboard]
- ✅ Stealth-address vault (sipher_vault devnet)
- ✅ Privacy score + viewing keys
- ✅ Multi-chain readiness (M18 deployments)
- ✅ Glass-neon UI launch

## Q3 2026 — M19 (Path B activates)
[screenshot of Vault stealth address list]
- 🎯 Mainnet vault deploy
- 🎯 Denominated note mixer (additional privacy backend, not replacement)
- 🎯 Proof composition v1
- 🎯 Privacy graph backend (real stealth tree, not stub)

## Q4 2026 — M20-M21
- 🎯 Multi-language SDK
- 🎯 Standard proposal (SIP-EIP)
- 🎯 Industry working group
```

- [ ] **Step 2: Embed screenshots from Vercel preview**

Take screenshots of the live redesigned site, save to `docs/assets/roadmap/`, embed via markdown.

- [ ] **Step 3: Add explicit Path B section linking to spec**

```markdown
## Note on the denominated note mixer

The `Network atlas` and `Denomination pools` surfaces in our redesign
are reinterpreted as Privacy graph + Multi-chain vault grid for the
devnet beta launch. The literal denominated note mixer ships as
Q3 2026 work — see `docs/superpowers/specs/2026-05-07-glass-neon-redesign-design.md`
section "Locked Decision D1" and "Out of Scope" for the deferral
rationale.
```

### PR 9 / Task 2: Final `/quality:qa` Phase 1 sweep

- [ ] **Step 1: Run quality:qa skill against `https://sipher.sip-protocol.org`**

```bash
# Invoke skill in this conversation, scoped to dev-engineer + end-user QA
/quality:qa
```

- [ ] **Step 2: Address any P0 findings** (file as separate PRs if needed)

### PR 9 / Task 3: X thread #1 draft refresh

- [ ] **Step 1: Update tweet copy with redesign-specific details**

Reference spec Section "X thread #1 narrative". RECTOR voices/edits/publishes.

### PR 9 / Task 4: Open + merge

```bash
git add ROADMAP.md docs/assets/roadmap/
git commit -m "docs(roadmap): publish glass-neon visual roadmap with design as north star"
git push -u origin chore/roadmap-design-anchor
gh pr create ...
```

---

## Phase D Entry Checklist

Before publishing X thread #1, verify EVERY box:

- [ ] All 9 PRs merged to `main` (`gh pr list --state closed --base main` shows PRs 0-9)
- [ ] Vercel production: `curl https://sipher.sip-protocol.org` returns 200 with redesigned HTML
- [ ] Backend healthy: `curl https://api.sipher.sip-protocol.org/api/health` returns `{status:"ok"}`
- [ ] `/quality:qa` Phase 1 zero P0 findings
- [ ] Three-wallet manual QA documented (Phantom + Solflare + Jupiter)
- [ ] ROADMAP.md visible: `curl -I https://github.com/sip-protocol/sipher/blob/main/ROADMAP.md` returns 200
- [ ] No PR #176 regressions: rerun smoke from `2026-05-07-d.md` against new origin
- [ ] No mock data leakage: grep TSX for hardcoded numerical strings
- [ ] X thread copy reviewed by RECTOR
- [ ] Day 0 monitoring set up (Vercel dashboard + VPS docker logs + GitHub issue alerts)

When all green, Phase D launches.

---

## Self-Review Log

This plan was written against the spec dated 2026-05-07. Spec coverage check:

- ✅ D1 (Path A now, B later, C never) — embedded in PR 9 ROADMAP + Out of Scope
- ✅ D2 (Vercel as PR 0) — PR 0 fully detailed
- ✅ D3 (Reinterpretation table) — preserved in PR 4 (Privacy graph), PR 5 (Multi-chain), PR 6 (stealth list)
- ✅ D4 (token sheet split) — PR 1 Task 2-6
- ✅ D5 (ui/* primitives) — PR 1 Tasks 7-11
- ✅ D6 (PR sequence) — table of contents matches
- ✅ D7 (Phase D coupling) — PR 9 + Phase D Entry Checklist
- ✅ D8 (admin views preserved) — PR 8 + spec D8 referenced
- ✅ D9 (Chat as Sheet) — PR 2 Task 5
- ✅ D10 (no mock data) — Phase D entry checklist gate
- ✅ D11 (mobile bottom nav intact) — PR 2 Task 4

Component inventory coverage:
- ✅ All 5 ui/* primitives (Card, Pill, HashCell, MetricBar, Sheet) — PR 1
- ✅ Gauge, NodeGraph, TickerBar — PR 3, 4
- ✅ All 12 feature components — PRs 3-7
- ✅ All 5 view restyles — PRs 2, 6, 8
- ✅ 5 NEW backend endpoints — PRs 4, 5, 6, 7

Backend endpoint coverage:
- ✅ /api/chains, /api/chains/aggregate — PR 4 + extended PR 5
- ✅ /api/stealth/index — PR 4
- ✅ /api/viewing-keys, /rotate — PR 7
- ✅ /v1/privacy/score?projected= extension — PR 6

PRs not touched: AuthSyncProvider, apiFetch, auth.ts, refresh.ts, store.ts, hooks/, networkConfig.ts — preserved per spec.

---

**End of plan.**
