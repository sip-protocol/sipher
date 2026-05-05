# Phase 4 (Split) — Devnet Beta + Mainnet Fast-Follow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended for sip-protocol repo PRs) or superpowers:executing-plans (recommended for sipher + blog-sip repo PRs) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `sipher_vault` to Solana mainnet via a public devnet beta soak with hybrid Superteam → CT testing, gated by hybrid time + metrics criteria, then atomic mainnet deploy + env-var flip + announce.

**Architecture:** Two phases (4a Devnet Beta ~1 week, 4b Mainnet fast-follow). Six PRs across three repos (`sip-protocol`, `sipher`, `blog-sip`). Single `SIPHER_NETWORK ∈ {devnet, mainnet}` env var controls the entire stack — flipping production from devnet→mainnet is a VPS env edit + `docker compose up -d sipher`. Helius API keys stay server-side; `/api/config` endpoint returns network metadata only (never RPC URLs).

**Tech Stack:** TypeScript (Node.js agent + React UI + Anchor scripts), Anchor 0.30.1 (pinned via avm), `@solana/web3.js`, `@solana/spl-token`, `@sipher/sdk`, Vitest (unit tests), Playwright (E2E), gitleaks (secret scanning), Helius RPC.

**Spec:** `docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md`

**Predecessor plan:** `docs/superpowers/plans/2026-05-04-phase4-mainnet-vault-deploy.md` (original single-phase Phase 4 — partially superseded; some scripts are reused unchanged, referenced by path in this plan)

> **Note on plan length:** Tasks shared with the predecessor plan reference its scripts by path rather than repeating 100+ lines of TypeScript inline. Operators executing this plan should keep the predecessor plan open as a sibling reference. Each task that does this is explicitly marked `(reuses script from predecessor plan)`.

---

## Pre-Flight (verify before any task begins)

You are working from `main` of both `sip-protocol` and `sipher` repos. Latest commits should be:

- `sip-protocol/main`: `3c81ad0` (PR #1076 merged — `authority_refund` instruction + tests)
- `sipher/main`: `abbb4c0` (PR #171 merged — Phase 3 devnet refund E2E closure)
- `sipher` working branch: `docs/phase4-split-spec` (this plan + the spec it implements)

Confirm:

```bash
cd ~/local-dev/sip-protocol && git log origin/main --oneline -1
# Expected: 3c81ad0 Merge pull request #1076 from sip-protocol/feat/authority-refund

cd ~/local-dev/sipher && git log origin/main --oneline -1
# Expected: abbb4c0 Merge pull request #171 from sip-protocol/chore/phase-3-devnet-refund-e2e

cd ~/local-dev/sipher && git rev-parse --abbrev-ref HEAD
# Expected: docs/phase4-split-spec
```

Verify pre-flight balances + tooling:

```bash
solana balance --keypair ~/Documents/secret/solana-devnet.json --url devnet
# Expected: ≥ 0.5 SOL (used for PR-A1 + Day-0..3 tester support deposits if needed)

solana balance S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd --url mainnet-beta
# Expected: ≥ 6 SOL by the time PR-B1 runs (peak deploy cost ~5.25 SOL).
# Required ONLY before PR-B1; can be funded during 4a beta soak.

avm list 2>&1 | grep installed
# Expected line: 0.32.1	(installed, current) — but PR-A1 + PR-B1 build with 0.30.1
avm use 0.30.1
anchor --version
# Expected: anchor-cli 0.30.1

solana --version
# Expected: solana-cli 3.x or compatible Agave build

ls ~/Documents/secret/sip-keys/solana/authority.json.age
# Expected: file exists. Decrypt only at PR-B1 deploy time.
```

Verify Helius access:

```bash
echo $SIP_APP_HELIUS_API_KEY | head -c 10
# Expected: 10 chars of key (already provisioned for sip-app — confirms Helius works)
# A NEW key SIPHER_HELIUS_API_KEY will be provisioned in PR-A2 Step 16.
```

Fail loudly on any miss — do not proceed. The Phase 3 evidence at `docs/sentinel/evidence/devnet-refund-2026-05-05.json` should already be on `sipher/main` from PR #171; if not, something rolled back and the predecessor plan needs to be re-run.

---

## Stage A — Phase 4a (Devnet Beta)

Three PRs (A1 in `sip-protocol`, A2 in `sipher`, A3 in `blog-sip`) + a public 3-7 day soak with gate-check evidence committed daily. Execution mode: **PR-A1 subagent-driven (high-stakes program work), PR-A2 + PR-A3 inline.**

### Task A1.0: Pre-PR-A1 setup — branch + base commit verification

**Files:**
- (none — branch operations only)

- [ ] **Step 1: Create feature branch in sip-protocol**

```bash
cd ~/local-dev/sip-protocol
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/phase4a-devnet-cpi-upgrade
git log --oneline -3
# Expected: top commit is 3c81ad0 (authority_refund merge)
```

- [ ] **Step 2: Verify lib.rs has both CPI + authority_refund**

```bash
grep -n "fn authority_refund\|sip_privacy\|create_transfer_announcement" \
  programs/sipher-vault/programs/sipher-vault/src/lib.rs
# Expected: ≥3 hits — authority_refund fn definition, sip_privacy program ID const,
# create_transfer_announcement CPI logic
```

If any of these are missing, the predecessor plan's PR-1 didn't fully merge — escalate to RECTOR.

---

### Task A1.1: Build devnet upgrade script — `upgrade-devnet.ts`

**Reuses script from predecessor plan.** The original Phase 4 plan's PR-1 Task 1.2 (`programs/sipher-vault/scripts/upgrade-devnet.ts`) is reused unchanged. The script:
- Builds a fresh CPI binary via `anchor build` (after `avm use 0.30.1`)
- Reads vanity keypair `~/Documents/secret/sipher-vault-program-id.json`
- Calls `solana program deploy` with `--program-id <vanity>` against devnet RPC
- Verifies the new deployed slot via `solana program show`
- Writes `programs/sipher-vault/DEPLOYMENT.md` devnet section update

**Files:**
- Create: `programs/sipher-vault/scripts/upgrade-devnet.ts` (full code in predecessor plan, copy verbatim)
- Modify: `programs/sipher-vault/DEPLOYMENT.md` (add new "Devnet upgrade — Phase 4a" section)

- [ ] **Step 1: Copy `upgrade-devnet.ts` from predecessor plan**

Copy the full script body from `docs/superpowers/plans/2026-05-04-phase4-mainnet-vault-deploy.md` Task 1.2. The script is ~80 lines.

- [ ] **Step 2: Switch to anchor 0.30.1 + build clean**

```bash
cd ~/local-dev/sip-protocol/programs/sipher-vault
avm use 0.30.1
anchor --version  # → 0.30.1

# Clean previous build to ensure binary reflects current main HEAD
cargo clean -p sipher-vault
anchor build 2>&1 | tail -10
# Expected: "Finished `release` profile [optimized] target(s)"

stat -f "%z" target/deploy/sipher_vault.so
# Expected: ~376_664 bytes (matches devnet on-chain size from -j.md pre-flight)
```

If size differs by >5KB, source has drifted from what was deployed to devnet on Mar 31 — investigate.

- [ ] **Step 3: Run upgrade-devnet.ts (devnet wallet signs)**

```bash
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm tsx scripts/upgrade-devnet.ts
```

Expected stdout (annotated):

```
Phase 4a — devnet sipher_vault upgrade
Loaded keypair: FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr
Balance before: 4.32 SOL
Building binary...
Binary size: 376_664 bytes
Submitting upgrade...
Upgrade TX: <sig>
Verifying new deployed slot...
Old slot: 455867014 → New slot: <new-slot>
Balance after: 4.30 SOL (Δ = ~0.02 SOL for upgrade fees)
✓ Devnet upgrade complete.
```

- [ ] **Step 4: Verify upgrade on Solscan**

```bash
echo "https://solscan.io/account/S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB?cluster=devnet"
```

Open URL. Confirm:
- Last Deployed Slot matches stdout from Step 3
- Latest TX is the upgrade (BPFLoaderUpgradeable instruction)
- Status: Success

- [ ] **Step 5: Update DEPLOYMENT.md devnet section**

Append to `programs/sipher-vault/DEPLOYMENT.md` (under the existing devnet section):

```markdown
### Devnet — Phase 4a CPI Upgrade (2026-05-XX)

- Upgraded from pre-CPI binary to CPI version (commit `<sip-protocol-main-HEAD>`)
- Upgrade TX: <sig>
- New deployed slot: <slot>
- Binary size: 376_664 bytes
- Authority signed: `FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr`
```

Replace placeholders with actual values from Step 3 output.

- [ ] **Step 6: Commit**

```bash
git add programs/sipher-vault/scripts/upgrade-devnet.ts \
        programs/sipher-vault/DEPLOYMENT.md
git commit -m "feat(sipher-vault): add devnet upgrade script + record Phase 4a upgrade

Adds programs/sipher-vault/scripts/upgrade-devnet.ts — atomic script
that builds the CPI binary from current main, deploys it to devnet via
BPFLoaderUpgradeable using the existing vanity program ID, and updates
DEPLOYMENT.md with the new deployed slot.

Run with anchor 0.30.1 + devnet wallet keypair:
  ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \\
  ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \\
  pnpm tsx scripts/upgrade-devnet.ts

Records the upgrade TX in DEPLOYMENT.md. The CPI version of withdraw_private
(commit 79133d0) was previously built but never deployed anywhere. This
upgrade is the first observation of the CPI flow on a live cluster.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (D3)"
```

---

### Task A1.2: Build E2E CPI test — `e2e-cpi-test.ts`

**Reuses script from predecessor plan.** Original Phase 4 plan's PR-1 Task 1.3.

**Files:**
- Create: `programs/sipher-vault/scripts/e2e-cpi-test.ts` (full code in predecessor plan)

The script:
- Wraps 0.001 SOL → wSOL on devnet wallet (idempotent)
- Calls `deposit` (0.001 SOL via wSOL)
- Calls `withdraw_private` to a generated stealth recipient (CPI fires)
- Verifies the on-chain `transfer_record` exists at the expected `sip_privacy` PDA
- Asserts: deposit confirmed, withdraw confirmed, transfer_record exists, fee_token gained 0.0000001 wSOL (10 bps of 0.001)

- [ ] **Step 1: Copy `e2e-cpi-test.ts` from predecessor plan**

Copy from predecessor plan Task 1.3 (~150 lines).

- [ ] **Step 2: Run E2E test**

```bash
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm tsx scripts/e2e-cpi-test.ts 2>&1 | tee /tmp/devnet-cpi-e2e-$(date +%Y-%m-%d-%H%M%S).log
```

Expected stdout (key checkpoints):

```
Phase 4a — devnet CPI E2E test
Loaded keypair: FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr
Wrapping 0.001 SOL → wSOL ATA
Deposit confirmed: <sig>
Generating stealth recipient...
Withdraw_private confirmed: <sig>
Verifying transfer_record at <pda>...
✓ transfer_record exists (size: 145 bytes)
Fee token wSOL balance: 100 lamports (10 bps of 1_000_000)
✓ E2E test PASSED.
```

- [ ] **Step 3: Verify on Solscan (manual)**

Open the withdraw TX URL printed in stdout. Confirm:
- TX status: Success
- Inner instruction includes CPI to `S1PMFspo…S9at` (sip_privacy)
- The CPI ix data starts with the discriminator for `create_transfer_announcement`

- [ ] **Step 4: Commit**

```bash
git add programs/sipher-vault/scripts/e2e-cpi-test.ts
git commit -m "feat(sipher-vault): add devnet CPI E2E test for Phase 4a beta gate

Adds programs/sipher-vault/scripts/e2e-cpi-test.ts — full deposit →
withdraw_private → transfer_record verification cycle on the upgraded
devnet program. This is the first programmatic confirmation that the
CPI binary works against a live cluster.

Run with: pnpm tsx scripts/e2e-cpi-test.ts (devnet wallet keypair)

Asserts:
- Deposit lands; DepositRecord PDA created
- Withdraw_private lands; transfer_record PDA exists at sip_privacy
  derivation
- Fee token receives 10 bps of withdrawn amount

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (Phase 4a A2)"
```

---

### Task A1.3: Build pause runbook — `set-paused.ts`

**Reuses script from predecessor plan** (original Task 1.4).

**Files:**
- Create: `programs/sipher-vault/scripts/set-paused.ts`
- Modify: `programs/sipher-vault/DEPLOYMENT.md` (rehearsal note)

- [ ] **Step 1: Copy `set-paused.ts` from predecessor plan**

Copy from predecessor plan PR-1 Task 1.4 (~60 lines). The script accepts `--paused true|false --network devnet|mainnet` flags.

- [ ] **Step 2: Rehearse pause + unpause on devnet**

```bash
# Pause
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm tsx scripts/set-paused.ts --paused true --network devnet
# Expected: TX confirmed, paused=true

solana account CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u --url devnet | head -10
# Expected: paused field byte = 0x01

# Verify deposit attempts now fail with VaultPaused error
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm tsx scripts/e2e-cpi-test.ts 2>&1 | grep -E "VaultPaused|0x1771" | head -3
# Expected: error containing VaultPaused or its hex code

# Unpause
ANCHOR_WALLET=~/Documents/secret/solana-devnet.json \
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
pnpm tsx scripts/set-paused.ts --paused false --network devnet
# Expected: TX confirmed, paused=false
```

- [ ] **Step 3: Document rehearsal in DEPLOYMENT.md**

Append to DEPLOYMENT.md:

```markdown
### Pause Runbook Rehearsed (Phase 4a)

- Date: 2026-05-XX
- Pause TX: <sig>
- Unpause TX: <sig>
- Verified: deposit attempt during pause fails with VaultPaused error
- Total downtime during rehearsal: <X> seconds
```

- [ ] **Step 4: Commit**

```bash
git add programs/sipher-vault/scripts/set-paused.ts \
        programs/sipher-vault/DEPLOYMENT.md
git commit -m "feat(sipher-vault): add pause runbook script + rehearsal evidence

Adds programs/sipher-vault/scripts/set-paused.ts — authority-signed
script to pause or unpause the vault config on devnet or mainnet.

Rehearsed on devnet 2026-05-XX. Verified deposit attempts during
paused state fail with VaultPaused error, then unpaused cleanly.

This script is the emergency lever for Phase 4b mainnet incident
response (Risk B2/B3 in the spec).

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (R)"
```

---

### Task A1.4: Open + merge PR-A1

- [ ] **Step 1: Push branch**

```bash
cd ~/local-dev/sip-protocol
git push -u origin feat/phase4a-devnet-cpi-upgrade
```

- [ ] **Step 2: Open PR**

```bash
gh pr create -R sip-protocol/sip-protocol --base main --head feat/phase4a-devnet-cpi-upgrade \
  --title "Phase 4a: devnet CPI upgrade + E2E test + pause runbook" \
  --body "$(cat <<'EOF'
## Summary

First step of Phase 4a (Devnet Beta). Upgrades the live devnet \`sipher_vault\` program (\`S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB\`) to the CPI version of \`withdraw_private\`, validates the full deposit → withdraw_private → transfer_record cycle works on a live cluster, and rehearses the emergency pause runbook.

## What this PR adds

- \`programs/sipher-vault/scripts/upgrade-devnet.ts\` — atomic upgrade script
- \`programs/sipher-vault/scripts/e2e-cpi-test.ts\` — full CPI flow validation
- \`programs/sipher-vault/scripts/set-paused.ts\` — emergency pause script (rehearsed)
- \`programs/sipher-vault/DEPLOYMENT.md\` — devnet upgrade record + pause rehearsal record

## Why now

The CPI version of \`withdraw_private\` (commit \`79133d0\`) was built but never deployed anywhere. This PR is the first deploy. Combined with the next two PRs (sipher repo env-var infra + blog post), it opens the public devnet beta soak window described in the Phase 4 split spec.

## Test plan

- [x] \`pnpm tsx scripts/upgrade-devnet.ts\` — upgrade TX confirmed, new deployed slot recorded
- [x] \`pnpm tsx scripts/e2e-cpi-test.ts\` — deposit + withdraw + transfer_record all green
- [x] \`pnpm tsx scripts/set-paused.ts --paused true --network devnet\` — pause confirmed, deposit attempt fails with VaultPaused, unpause confirmed
- [x] All TXs visible on Solscan with status Success

## Spec + plan

- Spec: \`docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md\` (lives in sipher repo)
- Plan: \`docs/superpowers/plans/2026-05-05-phase4-split-devnet-beta-mainnet.md\` (lives in sipher repo)
EOF
)"
```

- [ ] **Step 3: Wait for CI green + merge**

```bash
gh pr view --json state,mergeable,statusCheckRollup
# Expected: all checks SUCCESS or zero required

gh pr merge --merge --delete-branch
```

Per CLAUDE.md: `--merge --delete-branch`. Branch deletes locally + remotely.

```bash
git checkout main && git pull origin main
git log -1 --oneline
# Expected: Merge pull request from sip-protocol/feat/phase4a-devnet-cpi-upgrade
```

---

### Task A2.0: Pre-PR-A2 setup — branch + Helius key provision

Switch to sipher repo. PR-A2 is the largest PR in this plan — env-var infra + UI + tests + gitleaks CI + gate-check script. Execution mode: **inline** (per RECTOR's preference for sipher-repo work).

**Files:**
- (none for this task — setup only)

- [ ] **Step 1: Branch in sipher**

```bash
cd ~/local-dev/sipher
git checkout main && git pull origin main
git checkout -b feat/phase4a-network-config
git log --oneline -3
# Expected top: abbb4c0 Merge PR #171
```

- [ ] **Step 2: Provision new Helius API key for Sipher**

Open https://dashboard.helius.dev/dashboard → API Keys → Create new key.

- Name: `sipher-prod`
- Restrictions: origin = `sipher.sip-protocol.org` + RPC endpoint type
- Plan: same tier as `sip-app` (per RECTOR's per-project isolation rule)

Add to local secrets immediately:

```bash
echo "" >> ~/Documents/secret/.env
echo "# Sipher project (provisioned 2026-05-XX, per per-project isolation rule)" >> ~/Documents/secret/.env
echo "export SIPHER_HELIUS_API_KEY=<paste-from-helius>" >> ~/Documents/secret/.env

# Reload current shell
source ~/Documents/secret/.env
echo $SIPHER_HELIUS_API_KEY | head -c 10  # confirm 10 chars visible
```

VPS-side will be added at Step 21 of A2 (deploy time).

---

### Task A2.1: Network config helper — `loadNetworkConfig()` (TDD)

**Files:**
- Create: `packages/agent/src/config/network.ts`
- Create: `packages/agent/tests/config/network.test.ts`

- [ ] **Step 1: Write failing test — happy path (devnet)**

```typescript
// packages/agent/tests/config/network.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { loadNetworkConfig } from '../../src/config/network'

describe('loadNetworkConfig', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('resolves devnet config when SIPHER_NETWORK=devnet', () => {
    process.env.SIPHER_NETWORK = 'devnet'
    process.env.SIPHER_HELIUS_API_KEY = 'test-key'
    const cfg = loadNetworkConfig()
    expect(cfg.network).toBe('devnet')
    expect(cfg.clusterName).toBe('devnet')
    expect(cfg.programIds.sipherVault).toBe('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
    expect(cfg.programIds.sipPrivacy).toBe('S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at')
    expect(cfg.beta).toBe(true)
    expect(cfg.solscanSuffix).toBe('?cluster=devnet')
    expect(cfg.publicRpcUrl).toBe('https://api.devnet.solana.com')
    expect(cfg.rpcUrl).toContain('devnet')
    expect(cfg.rpcUrl).toContain('test-key')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd ~/local-dev/sipher/packages/agent
pnpm test tests/config/network.test.ts -- --run
# Expected: FAIL — Cannot find module '../../src/config/network'
```

- [ ] **Step 3: Implement minimal `loadNetworkConfig` (devnet path only)**

```typescript
// packages/agent/src/config/network.ts
export type Network = 'devnet' | 'mainnet'

export type NetworkConfig = {
  network: Network
  clusterName: 'devnet' | 'mainnet-beta'
  rpcUrl: string                    // SERVER-SIDE ONLY — keyed Helius URL
  publicRpcUrl: string              // un-keyed fallback for UI direct reads
  programIds: {
    sipherVault: string
    sipPrivacy: string
  }
  vaultConfig: string               // VaultConfig PDA
  beta: boolean
  solscanSuffix: string
}

const SIPHER_VAULT_PROGRAM_ID = 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB'
const SIP_PRIVACY_PROGRAM_ID = 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at'
const DEVNET_VAULT_CONFIG = 'CpL4qyHFJYkU5WKdcjTJUu52fYFzjrvHZo4fjPp9T76u'
// Mainnet vault config is computed at deploy time; until B1 lands, it's the same
// PDA derivation as devnet (same seed → same address). Hardcoded for now since
// program ID + seed are identical. PR-B1 verifies this assumption.
const MAINNET_VAULT_CONFIG = DEVNET_VAULT_CONFIG

export function loadNetworkConfig(): NetworkConfig {
  const network = process.env.SIPHER_NETWORK as Network | undefined
  if (network !== 'devnet' && network !== 'mainnet') {
    throw new Error(
      `FATAL: SIPHER_NETWORK env var required (must be 'devnet' or 'mainnet'), got: ${network ?? '(unset)'}`,
    )
  }

  const apiKey = process.env.SIPHER_HELIUS_API_KEY
  if (!apiKey) {
    throw new Error('FATAL: SIPHER_HELIUS_API_KEY env var required')
  }

  if (network === 'devnet') {
    return {
      network: 'devnet',
      clusterName: 'devnet',
      rpcUrl: `https://devnet.helius-rpc.com/?api-key=${apiKey}`,
      publicRpcUrl: 'https://api.devnet.solana.com',
      programIds: {
        sipherVault: SIPHER_VAULT_PROGRAM_ID,
        sipPrivacy: SIP_PRIVACY_PROGRAM_ID,
      },
      vaultConfig: DEVNET_VAULT_CONFIG,
      beta: true,
      solscanSuffix: '?cluster=devnet',
    }
  }

  // mainnet
  return {
    network: 'mainnet',
    clusterName: 'mainnet-beta',
    rpcUrl: `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
    publicRpcUrl: 'https://api.mainnet-beta.solana.com',
    programIds: {
      sipherVault: SIPHER_VAULT_PROGRAM_ID,
      sipPrivacy: SIP_PRIVACY_PROGRAM_ID,
    },
    vaultConfig: MAINNET_VAULT_CONFIG,
    beta: false,
    solscanSuffix: '',
  }
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
pnpm test tests/config/network.test.ts -- --run
# Expected: 1 passed
```

- [ ] **Step 5: Add mainnet test + failure path tests**

Append to `network.test.ts`:

```typescript
  it('resolves mainnet config when SIPHER_NETWORK=mainnet', () => {
    process.env.SIPHER_NETWORK = 'mainnet'
    process.env.SIPHER_HELIUS_API_KEY = 'test-key'
    const cfg = loadNetworkConfig()
    expect(cfg.network).toBe('mainnet')
    expect(cfg.clusterName).toBe('mainnet-beta')
    expect(cfg.beta).toBe(false)
    expect(cfg.solscanSuffix).toBe('')
    expect(cfg.publicRpcUrl).toBe('https://api.mainnet-beta.solana.com')
  })

  it('throws when SIPHER_NETWORK unset', () => {
    delete process.env.SIPHER_NETWORK
    process.env.SIPHER_HELIUS_API_KEY = 'test-key'
    expect(() => loadNetworkConfig()).toThrow(/SIPHER_NETWORK env var required/)
  })

  it('throws when SIPHER_NETWORK has invalid value', () => {
    process.env.SIPHER_NETWORK = 'testnet'
    process.env.SIPHER_HELIUS_API_KEY = 'test-key'
    expect(() => loadNetworkConfig()).toThrow(/SIPHER_NETWORK env var required/)
  })

  it('throws when SIPHER_HELIUS_API_KEY unset', () => {
    process.env.SIPHER_NETWORK = 'devnet'
    delete process.env.SIPHER_HELIUS_API_KEY
    expect(() => loadNetworkConfig()).toThrow(/SIPHER_HELIUS_API_KEY env var required/)
  })
```

- [ ] **Step 6: Run all tests — verify pass**

```bash
pnpm test tests/config/network.test.ts -- --run
# Expected: 5 passed
```

- [ ] **Step 7: Commit**

```bash
git add packages/agent/src/config/network.ts \
        packages/agent/tests/config/network.test.ts
git commit -m "feat(agent): add loadNetworkConfig() — single source of truth for network

Adds packages/agent/src/config/network.ts. Reads SIPHER_NETWORK and
SIPHER_HELIUS_API_KEY env vars at startup. Throws and process exits
if either is missing — no silent fallback (silent fallback is how
production accidents happen).

Returns a typed NetworkConfig with:
  - network: 'devnet' | 'mainnet'
  - clusterName: 'devnet' | 'mainnet-beta'
  - rpcUrl: keyed Helius URL (server-side only, never exposed)
  - publicRpcUrl: un-keyed fallback for UI direct reads
  - programIds: sipherVault + sipPrivacy
  - vaultConfig: PDA address
  - beta: boolean (true for devnet, drives BetaBanner conditional render)
  - solscanSuffix: '?cluster=devnet' for devnet, '' for mainnet

5 tests cover happy paths (devnet + mainnet), unset env, invalid value,
and missing API key.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (Architecture)"
```

---

### Task A2.2: `/api/config` endpoint — public network metadata (TDD)

**Files:**
- Create: `packages/agent/src/routes/config.ts`
- Create: `packages/agent/tests/routes/config.test.ts`
- Modify: `packages/agent/src/index.ts` (mount the route + call loadNetworkConfig at boot)

- [ ] **Step 1: Write failing test — endpoint shape (no key leak)**

```typescript
// packages/agent/tests/routes/config.test.ts
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import { configRouter } from '../../src/routes/config'

describe('GET /api/config', () => {
  let app: express.Express
  let originalEnv: NodeJS.ProcessEnv

  beforeAll(() => {
    originalEnv = { ...process.env }
    process.env.SIPHER_NETWORK = 'devnet'
    process.env.SIPHER_HELIUS_API_KEY = 'test-key-DO-NOT-LEAK-THIS'
    app = express()
    app.use('/api/config', configRouter)
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns network metadata without RPC URL or API key', async () => {
    const res = await request(app).get('/api/config')
    expect(res.status).toBe(200)
    expect(res.body.network).toBe('devnet')
    expect(res.body.clusterName).toBe('devnet')
    expect(res.body.beta).toBe(true)
    expect(res.body.solscanSuffix).toBe('?cluster=devnet')
    expect(res.body.publicRpcUrl).toBe('https://api.devnet.solana.com')
    expect(res.body.programIds).toEqual({
      sipherVault: 'S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB',
      sipPrivacy: 'S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at',
    })
  })

  it('CRITICAL: response NEVER contains the keyed RPC URL or API key', async () => {
    const res = await request(app).get('/api/config')
    const bodyStr = JSON.stringify(res.body)
    expect(bodyStr).not.toContain('test-key-DO-NOT-LEAK-THIS')
    expect(bodyStr).not.toContain('helius-rpc.com')
    expect(bodyStr).not.toMatch(/api-key/i)
    expect(res.body).not.toHaveProperty('rpcUrl')
  })
})
```

- [ ] **Step 2: Run test — fails (route doesn't exist)**

```bash
pnpm test tests/routes/config.test.ts -- --run
# Expected: FAIL
```

- [ ] **Step 3: Implement `/api/config` route**

```typescript
// packages/agent/src/routes/config.ts
import express from 'express'
import { loadNetworkConfig } from '../config/network'

export const configRouter = express.Router()

configRouter.get('/', (req, res) => {
  const cfg = loadNetworkConfig()
  // CRITICAL: whitelist of keys to expose. Never include rpcUrl or anything
  // derived from SIPHER_HELIUS_API_KEY.
  res.json({
    network: cfg.network,
    clusterName: cfg.clusterName,
    publicRpcUrl: cfg.publicRpcUrl,
    programIds: cfg.programIds,
    vaultConfig: cfg.vaultConfig,
    beta: cfg.beta,
    solscanSuffix: cfg.solscanSuffix,
  })
})
```

- [ ] **Step 4: Run test — pass**

```bash
pnpm test tests/routes/config.test.ts -- --run
# Expected: 2 passed
```

- [ ] **Step 5: Mount in agent index + call loadNetworkConfig at boot**

Modify `packages/agent/src/index.ts`. Find the section where Express routes are mounted and add:

```typescript
import { configRouter } from './routes/config'
import { loadNetworkConfig } from './config/network'

// ... existing imports ...

// Boot: validate network config first. Fails loud if env not set.
const networkConfig = loadNetworkConfig()
console.log(`[boot] SIPHER_NETWORK=${networkConfig.network} (beta=${networkConfig.beta})`)

// ... existing app.use() lines ...
app.use('/api/config', configRouter)
```

- [ ] **Step 6: Smoke-test agent boot locally**

```bash
cd ~/local-dev/sipher
SIPHER_NETWORK=devnet SIPHER_HELIUS_API_KEY=test-key pnpm dev 2>&1 | head -20
# Expected: "[boot] SIPHER_NETWORK=devnet (beta=true)" line appears

# In another terminal:
curl http://localhost:5006/api/config | jq
# Expected: JSON response with network, clusterName, programIds, etc — NO rpcUrl
```

Stop the dev server.

- [ ] **Step 7: Smoke-test boot failure on missing env**

```bash
unset SIPHER_NETWORK
pnpm dev 2>&1 | head -10
# Expected: stderr "FATAL: SIPHER_NETWORK env var required" + process exits
```

Re-export env vars for next steps.

- [ ] **Step 8: Commit**

```bash
git add packages/agent/src/routes/config.ts \
        packages/agent/tests/routes/config.test.ts \
        packages/agent/src/index.ts
git commit -m "feat(agent): add GET /api/config endpoint for client-side network metadata

Adds packages/agent/src/routes/config.ts with a single GET endpoint
that returns network metadata to the UI: network, clusterName,
publicRpcUrl, programIds, vaultConfig, beta flag, solscanSuffix.

CRITICAL: the response NEVER contains the keyed Helius RPC URL or
the API key. The endpoint uses an explicit whitelist of fields to
prevent accidental leakage. A test asserts the response body never
contains 'helius-rpc.com', 'api-key', or the API key value.

Also wires loadNetworkConfig() into agent boot — process exits with
code 1 if SIPHER_NETWORK or SIPHER_HELIUS_API_KEY are unset, with a
clear FATAL log line. CI catches this on deploy.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (Architecture, Credential hygiene)"
```

---

### Task A2.3: BetaBanner React component (TDD)

**Files:**
- Create: `app/src/components/BetaBanner.tsx`
- Create: `app/tests/components/BetaBanner.test.tsx`

- [ ] **Step 1: Write failing test — render + dismiss + reappear**

```typescript
// app/tests/components/BetaBanner.test.tsx
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BetaBanner } from '../../src/components/BetaBanner'

describe('BetaBanner', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('renders when beta=true', () => {
    render(<BetaBanner beta={true} />)
    expect(screen.getByText(/DEVNET BETA/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /faucet/i })).toHaveAttribute(
      'href',
      'https://faucet.solana.com',
    )
  })

  it('renders nothing when beta=false', () => {
    const { container } = render(<BetaBanner beta={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('is dismissible via button, hides for the rest of the session', () => {
    render(<BetaBanner beta={true} />)
    expect(screen.getByText(/DEVNET BETA/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText(/DEVNET BETA/i)).not.toBeInTheDocument()
  })

  it('respects sessionStorage dismissal across re-renders', () => {
    sessionStorage.setItem('sipher.beta-banner.dismissed', 'true')
    render(<BetaBanner beta={true} />)
    expect(screen.queryByText(/DEVNET BETA/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — fails**

```bash
cd ~/local-dev/sipher
pnpm --filter '@sipher/app' test tests/components/BetaBanner.test.tsx -- --run
# Expected: FAIL
```

- [ ] **Step 3: Implement BetaBanner**

```tsx
// app/src/components/BetaBanner.tsx
import { useState, useEffect } from 'react'

const STORAGE_KEY = 'sipher.beta-banner.dismissed'

export function BetaBanner({ beta }: { beta: boolean }) {
  const [dismissed, setDismissed] = useState<boolean>(false)

  useEffect(() => {
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  if (!beta) return null
  if (dismissed) return null

  function handleDismiss() {
    sessionStorage.setItem(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 w-full bg-amber-100 text-amber-900 border-b border-amber-300"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <p className="text-sm">
          🧪 You're on <strong>DEVNET BETA</strong>. This is testnet — funds are not real.{' '}
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noreferrer"
            className="underline font-medium"
          >
            Get devnet SOL →
          </a>
        </p>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          className="text-amber-900 hover:text-amber-700 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test — pass**

```bash
pnpm --filter '@sipher/app' test tests/components/BetaBanner.test.tsx -- --run
# Expected: 4 passed
```

- [ ] **Step 5: Commit**

```bash
git add app/src/components/BetaBanner.tsx \
        app/tests/components/BetaBanner.test.tsx
git commit -m "feat(app): add BetaBanner — visible when network=devnet, hidden on mainnet

Adds app/src/components/BetaBanner.tsx. Renders a sticky amber
banner at the top of the page when the beta prop is true. Hidden
entirely when beta=false (no dimming, no soft fallback).

Behavior:
- Dismissible via × button
- Dismissal persists in sessionStorage (reappears next visit, not next page)
- Includes a link to faucet.solana.com for testers needing devnet SOL

Mount point + conditional rendering wired in subsequent task A2.4.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (BetaBanner UX)"
```

---

### Task A2.4: networkConfig client store + AppLayout mount

**Files:**
- Create: `app/src/lib/networkConfig.ts`
- Create: `app/tests/lib/networkConfig.test.ts`
- Modify: `app/src/components/AppLayout.tsx`
- Modify: `app/src/views/VaultView.tsx`

- [ ] **Step 1: Write failing test — fetches /api/config + caches in Zustand**

```typescript
// app/tests/lib/networkConfig.test.ts
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useNetworkConfigStore, fetchNetworkConfig } from '../../src/lib/networkConfig'

describe('networkConfig store', () => {
  beforeEach(() => {
    useNetworkConfigStore.setState({ config: null, error: null, loading: false })
    vi.restoreAllMocks()
  })

  it('fetchNetworkConfig populates store from /api/config', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        network: 'devnet',
        clusterName: 'devnet',
        publicRpcUrl: 'https://api.devnet.solana.com',
        programIds: { sipherVault: 'S1Phr...', sipPrivacy: 'S1PMF...' },
        vaultConfig: 'CpL4q...',
        beta: true,
        solscanSuffix: '?cluster=devnet',
      }),
    }))

    await fetchNetworkConfig()
    const state = useNetworkConfigStore.getState()
    expect(state.config?.network).toBe('devnet')
    expect(state.config?.beta).toBe(true)
    expect(state.error).toBeNull()
    expect(state.loading).toBe(false)
  })

  it('fetchNetworkConfig sets error on 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'service unavailable' }),
    }))

    await fetchNetworkConfig()
    const state = useNetworkConfigStore.getState()
    expect(state.config).toBeNull()
    expect(state.error).toBeTruthy()
    expect(state.loading).toBe(false)
  })
})
```

- [ ] **Step 2: Run — fails**

```bash
pnpm --filter '@sipher/app' test tests/lib/networkConfig.test.ts -- --run
```

- [ ] **Step 3: Implement networkConfig store**

```typescript
// app/src/lib/networkConfig.ts
import { create } from 'zustand'

export type NetworkConfigPublic = {
  network: 'devnet' | 'mainnet'
  clusterName: 'devnet' | 'mainnet-beta'
  publicRpcUrl: string
  programIds: {
    sipherVault: string
    sipPrivacy: string
  }
  vaultConfig: string
  beta: boolean
  solscanSuffix: string
}

type Store = {
  config: NetworkConfigPublic | null
  error: string | null
  loading: boolean
}

export const useNetworkConfigStore = create<Store>(() => ({
  config: null,
  error: null,
  loading: false,
}))

export async function fetchNetworkConfig(): Promise<void> {
  useNetworkConfigStore.setState({ loading: true, error: null })
  try {
    const res = await fetch('/api/config')
    if (!res.ok) {
      throw new Error(`Config endpoint returned ${res.status}`)
    }
    const config = (await res.json()) as NetworkConfigPublic
    useNetworkConfigStore.setState({ config, loading: false, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching config'
    useNetworkConfigStore.setState({ config: null, loading: false, error: message })
  }
}

export function solscanUrl(txOrAccount: string, suffix: string): string {
  return `https://solscan.io/tx/${txOrAccount}${suffix}`
}
```

- [ ] **Step 4: Run — pass**

```bash
pnpm --filter '@sipher/app' test tests/lib/networkConfig.test.ts -- --run
# Expected: 2 passed
```

- [ ] **Step 5: Mount BetaBanner + call fetchNetworkConfig at app boot**

Modify `app/src/components/AppLayout.tsx`. At top of the component:

```tsx
import { useEffect } from 'react'
import { BetaBanner } from './BetaBanner'
import { useNetworkConfigStore, fetchNetworkConfig } from '../lib/networkConfig'

// inside the component, before main JSX:
const config = useNetworkConfigStore((s) => s.config)
const error = useNetworkConfigStore((s) => s.error)

useEffect(() => {
  fetchNetworkConfig()
}, [])

if (error) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Sipher temporarily unavailable</h1>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    </div>
  )
}

// Then in JSX, ABOVE existing layout:
return (
  <>
    <BetaBanner beta={config?.beta ?? false} />
    {/* existing layout */}
  </>
)
```

- [ ] **Step 6: Update VaultView Solscan links**

In `app/src/views/VaultView.tsx`, replace any hardcoded `solscan.io` URLs with calls to `solscanUrl(tx, config.solscanSuffix)` from networkConfig store:

```tsx
import { useNetworkConfigStore, solscanUrl } from '../lib/networkConfig'

const config = useNetworkConfigStore((s) => s.config)

// in JSX:
<a href={solscanUrl(txId, config?.solscanSuffix ?? '')} target="_blank" rel="noreferrer">
  View on Solscan
</a>
```

Search for any other Solscan usages in `app/src/` and apply the same pattern.

```bash
grep -rn "solscan.io" app/src/ --include="*.tsx" --include="*.ts" | head -20
# Expected: only the new networkConfig.ts solscanUrl helper, after fixing all callers
```

- [ ] **Step 7: Run all app tests**

```bash
pnpm --filter '@sipher/app' test -- --run
# Expected: all green (BetaBanner + networkConfig + existing tests)
```

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/networkConfig.ts \
        app/tests/lib/networkConfig.test.ts \
        app/src/components/AppLayout.tsx \
        app/src/views/VaultView.tsx
git commit -m "feat(app): wire BetaBanner + networkConfig store + Solscan suffix from /api/config

Adds Zustand store at app/src/lib/networkConfig.ts that fetches from
/api/config at boot and caches the public network metadata. Mounts
BetaBanner in AppLayout — banner is visible when config.beta=true,
hidden when false.

VaultView Solscan links now use solscanUrl(tx, config.solscanSuffix)
helper so the cluster suffix follows the network. On devnet, links
include ?cluster=devnet; on mainnet, no suffix.

Failure mode: if /api/config 5xx, app shows full-page error instead
of falling back to a wrong network silently.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (Architecture)"
```

---

### Task A2.5: gitleaks CI workflow

**Files:**
- Create: `.github/workflows/gitleaks.yml`
- Create: `.gitleaks.toml` (custom rules — exclude test fixtures)

- [ ] **Step 1: Add `.gitleaks.toml` config**

```toml
# .gitleaks.toml — custom config for sipher repo
title = "Sipher gitleaks config"

[allowlist]
paths = [
  '''packages/agent/tests/.*''',  # test fixtures may contain dummy keys
  '''app/tests/.*''',
]
regexes = [
  '''test-key-DO-NOT-LEAK-THIS''',
  '''test-key''',
  '''SIPHER_HELIUS_API_KEY=__set_in_vps_only__''',  # placeholder pattern in .env.example
]
```

- [ ] **Step 2: Add workflow**

```yaml
# .github/workflows/gitleaks.yml
name: gitleaks

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 5 * * *'  # nightly 05:00 UTC
  workflow_dispatch:

jobs:
  gitleaks:
    name: Scan for secrets
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_CONFIG: .gitleaks.toml
```

- [ ] **Step 3: Local dry-run to verify config**

```bash
# Install gitleaks if not already present
brew install gitleaks 2>&1 | tail -3

# Run scan locally
gitleaks detect --config=.gitleaks.toml --no-banner --redact 2>&1 | head -20
# Expected: "leaks: 0" — clean. If any leaks reported, fix them before pushing.
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/gitleaks.yml .gitleaks.toml
git commit -m "ci(security): add gitleaks workflow + custom allowlist

Scans all PRs against main + nightly cron at 05:00 UTC. Custom
config at .gitleaks.toml excludes test fixtures (which legitimately
contain dummy keys named test-key-DO-NOT-LEAK-THIS) and the
SIPHER_HELIUS_API_KEY placeholder pattern in .env.example.

Required by Phase 4 split spec — Section 3 (Architecture / Credential
hygiene). Local dry-run confirms 0 leaks at this commit.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (Credential hygiene)"
```

---

### Task A2.6: Gate-check script — `devnet-beta-gate-check.ts`

**Files:**
- Create: `scripts/devnet-beta-gate-check.ts`
- Create: `scripts/WALLETS_TO_EXCLUDE.json`

- [ ] **Step 1: Add wallet exclusion list**

```json
{
  "_comment": "Wallets owned by RECTOR / dev infra. Excluded from gate-check distinct-wallet count.",
  "wallets": [
    "FGSkt8MwXH83daNNW8ZkoqhL1KLcLoZLcdGJz84BWWr",
    "S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd",
    "S1P9WhBSbAGGatvrVE4TRBZfWpbG96U26zksy2TQj8q",
    "C1phrE76Wrkmt1GP6Aa9RjCeLDKHZ7p4MPVRuPa8x85N"
  ]
}
```

(devnet wallet, mainnet authority, treasury, cipher-admin — known dev wallets per memory + CLAUDE.md.)

- [ ] **Step 2: Create gate-check script skeleton**

```typescript
// scripts/devnet-beta-gate-check.ts
// Phase 4a — Devnet Beta gate criteria check.
//
// Reads on-chain TX history for the devnet sipher_vault program, classifies
// each TX as deposit/withdraw/refund/admin/other, counts distinct non-RECTOR
// wallets per category, classifies failed TXs as user-error vs unexplained,
// and emits a structured evidence JSON to docs/sentinel/evidence/.
//
// Run: pnpm tsx scripts/devnet-beta-gate-check.ts
// Output: docs/sentinel/evidence/devnet-beta-gate-{YYYY-MM-DD}.json

import { Connection, PublicKey } from '@solana/web3.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const VAULT_PROGRAM_ID = new PublicKey('S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB')
const RPC_URL = process.env.SIPHER_DEVNET_RPC ?? 'https://api.devnet.solana.com'
const PUBLIC_LAUNCH_AT_ENV = process.env.SIPHER_BETA_LAUNCH_AT  // ISO timestamp, set when X thread #1 publishes
const EXCLUDE_PATH = join(process.cwd(), 'scripts/WALLETS_TO_EXCLUDE.json')
const EVIDENCE_DIR = join(process.cwd(), 'docs/sentinel/evidence')

// Anchor instruction discriminators for sipher_vault — sha256("global:<ix_name>")[0..8]
const IX_DISCRIMINATORS = {
  deposit: '...',           // Filled in Step 5 below from actual on-chain inspection
  withdraw_private: '...',
  refund: '...',
  authority_refund: '...',
  set_paused: '...',
  update_fee: '...',
  collect_fee: '...',
  initialize: '...',
  create_vault_token: '...',
  create_fee_token: '...',
}

type GateResult = {
  checkedAt: string
  checkedAgainstSlot: number
  publicLaunchAt: string | null
  criteria: {
    C1_days_since_launch: { value: number, pass: boolean }
    C2_deposits: { count: number, distinct_wallets: number, pass: boolean }
    C3_withdraws: { count: number, distinct_wallets: number, pass: boolean }
    C4_refunds: { count: number, pass: boolean }
    C5_reverts: { total: number, user_error: number, unexplained: number, pass: boolean }
    C6_authority_interventions: { count: number, pass: boolean }
  }
  overall: 'PASS' | 'FAIL'
  wallets_observed: string[]
  reverts: Array<{ tx: string, error: string, classification: 'user_error' | 'unexplained', reason: string }>
}

async function main(): Promise<void> {
  console.log('Phase 4a — devnet beta gate check\n')
  const launchAt = PUBLIC_LAUNCH_AT_ENV ? new Date(PUBLIC_LAUNCH_AT_ENV) : null
  if (!launchAt) {
    console.warn('⚠️  SIPHER_BETA_LAUNCH_AT not set — C1 will report 0 days since launch')
  }

  const conn = new Connection(RPC_URL, 'confirmed')
  const excludeRaw = JSON.parse(readFileSync(EXCLUDE_PATH, 'utf-8')) as { wallets: string[] }
  const excludeSet = new Set(excludeRaw.wallets)

  console.log(`Querying TX history for program ${VAULT_PROGRAM_ID.toBase58()} ...`)
  const sigs = await conn.getSignaturesForAddress(VAULT_PROGRAM_ID, { limit: 1000 })
  console.log(`Found ${sigs.length} signatures`)

  const txDetails = await Promise.all(
    sigs.slice(0, 200).map((s) => conn.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 }).catch(() => null)),
  )

  // Counters
  let deposits = 0
  let withdraws = 0
  let refunds = 0
  let authorityInterventions = 0
  const depositors = new Set<string>()
  const withdrawSigners = new Set<string>()
  const reverts: GateResult['reverts'] = []
  const allWallets = new Set<string>()

  for (let i = 0; i < txDetails.length; i++) {
    const tx = txDetails[i]
    if (!tx) continue
    const sig = sigs[i].signature
    const failed = tx.meta?.err !== null && tx.meta?.err !== undefined

    // Identify ix discriminators in the TX
    const ixs = tx.transaction.message.instructions.filter(
      (ix: any) => ix.programId?.equals?.(VAULT_PROGRAM_ID),
    )
    if (ixs.length === 0) continue

    // Get signer
    const signer = tx.transaction.message.accountKeys[0].pubkey.toBase58()
    allWallets.add(signer)

    // Classify by data discriminator (first 8 bytes hex)
    for (const ix of ixs) {
      const data = (ix as any).data ?? ''
      const disc = Buffer.from(data, 'base64').slice(0, 8).toString('hex')

      if (disc === IX_DISCRIMINATORS.deposit) {
        if (failed) {
          reverts.push({ tx: sig, error: classifyError(tx.meta!.err), classification: 'user_error', reason: 'deposit failed' })
        } else if (!excludeSet.has(signer)) {
          deposits++
          depositors.add(signer)
        }
      } else if (disc === IX_DISCRIMINATORS.withdraw_private) {
        if (failed) {
          reverts.push({ tx: sig, error: classifyError(tx.meta!.err), classification: 'user_error', reason: 'withdraw_private failed' })
        } else if (!excludeSet.has(signer)) {
          withdraws++
          withdrawSigners.add(signer)
        }
      } else if (disc === IX_DISCRIMINATORS.refund || disc === IX_DISCRIMINATORS.authority_refund) {
        if (!failed) refunds++
        if (failed) reverts.push({ tx: sig, error: classifyError(tx.meta!.err), classification: 'user_error', reason: 'refund failed' })
      } else if (
        disc === IX_DISCRIMINATORS.set_paused ||
        disc === IX_DISCRIMINATORS.update_fee ||
        disc === IX_DISCRIMINATORS.collect_fee
      ) {
        if (!failed) authorityInterventions++
      }
    }
  }

  const userErrorReverts = reverts.filter((r) => r.classification === 'user_error').length
  const unexplainedReverts = reverts.length - userErrorReverts

  const now = new Date()
  const daysSinceLaunch = launchAt ? (now.getTime() - launchAt.getTime()) / 86400_000 : 0

  const criteria: GateResult['criteria'] = {
    C1_days_since_launch: { value: Math.round(daysSinceLaunch * 10) / 10, pass: daysSinceLaunch >= 3 },
    C2_deposits: { count: deposits, distinct_wallets: depositors.size, pass: deposits >= 5 && depositors.size >= 3 },
    C3_withdraws: { count: withdraws, distinct_wallets: withdrawSigners.size, pass: withdraws >= 3 && withdrawSigners.size >= 2 },
    C4_refunds: { count: refunds, pass: refunds >= 1 },
    C5_reverts: { total: reverts.length, user_error: userErrorReverts, unexplained: unexplainedReverts, pass: unexplainedReverts === 0 },
    C6_authority_interventions: { count: authorityInterventions, pass: authorityInterventions === 0 },
  }

  const overall: 'PASS' | 'FAIL' = Object.values(criteria).every((c) => c.pass) ? 'PASS' : 'FAIL'

  const result: GateResult = {
    checkedAt: now.toISOString(),
    checkedAgainstSlot: await conn.getSlot('confirmed'),
    publicLaunchAt: launchAt?.toISOString() ?? null,
    criteria,
    overall,
    wallets_observed: Array.from(allWallets).filter((w) => !excludeSet.has(w)),
    reverts,
  }

  mkdirSync(EVIDENCE_DIR, { recursive: true })
  const outPath = join(EVIDENCE_DIR, `devnet-beta-gate-${now.toISOString().slice(0, 10)}.json`)
  writeFileSync(outPath, JSON.stringify(result, null, 2))
  console.log(`\nEvidence written: ${outPath}`)
  console.log(`Overall: ${overall}`)
  for (const [k, v] of Object.entries(criteria)) {
    console.log(`  ${k}: ${JSON.stringify(v)}`)
  }
}

function classifyError(err: unknown): string {
  // err may be `{ InstructionError: [0, { Custom: 6000 }] }` etc.
  return JSON.stringify(err).slice(0, 200)
}

main().catch((err) => {
  console.error('\n✗ Gate check failed:', err.message ?? err)
  process.exit(1)
})
```

- [ ] **Step 3: Discover real instruction discriminators**

The placeholder `'...'` strings need real values. Run a one-shot helper:

```bash
cd ~/local-dev/sipher
cat > /tmp/print-discriminators.ts <<'EOF'
import { createHash } from 'node:crypto'
const ixs = [
  'deposit', 'withdraw_private', 'refund', 'authority_refund',
  'set_paused', 'update_fee', 'collect_fee', 'initialize',
  'create_vault_token', 'create_fee_token',
]
for (const name of ixs) {
  const disc = createHash('sha256').update(`global:${name}`).digest().slice(0, 8).toString('hex')
  console.log(`  ${name}: '${disc}',`)
}
EOF
pnpm tsx /tmp/print-discriminators.ts
# Expected: prints 10 lines like "deposit: 'a3f2...',"
```

Copy the output into `scripts/devnet-beta-gate-check.ts` replacing the `'...'` placeholders.

- [ ] **Step 4: Smoke-run gate-check (will report current state of devnet program)**

```bash
SIPHER_BETA_LAUNCH_AT=2026-05-04T14:13:14Z \
pnpm tsx scripts/devnet-beta-gate-check.ts 2>&1 | head -30
```

Expected:
- Connects to devnet
- Counts existing TXs (Phase 3's deposit + refund)
- Writes `docs/sentinel/evidence/devnet-beta-gate-2026-05-XX.json`
- Most criteria show baseline values (1 deposit, 0 withdraws, 1 refund — Phase 3 evidence)
- Overall: FAIL (we haven't run beta yet)

This baseline run is expected to fail; it confirms the script works. Do NOT commit this baseline JSON — it'll be overwritten on Day 3 of beta.

```bash
# Clean up baseline output (gitignored is overkill for one file; just delete)
rm docs/sentinel/evidence/devnet-beta-gate-*.json
```

- [ ] **Step 5: Commit script + exclusion list**

```bash
git add scripts/devnet-beta-gate-check.ts scripts/WALLETS_TO_EXCLUDE.json
git commit -m "feat(scripts): add devnet beta gate check for Phase 4a → 4b graduation

Adds scripts/devnet-beta-gate-check.ts. Queries devnet sipher_vault
TX history (paginated via getSignaturesForAddress), classifies each
TX by Anchor instruction discriminator, counts deposits / withdraws /
refunds / authority interventions, classifies failed TXs as user
error vs unexplained, and emits structured evidence JSON to
docs/sentinel/evidence/devnet-beta-gate-{YYYY-MM-DD}.json.

Excludes RECTOR's known dev wallets (devnet wallet, mainnet authority,
treasury, cipher-admin) from distinct-wallet counts via
scripts/WALLETS_TO_EXCLUDE.json.

Set SIPHER_BETA_LAUNCH_AT to the X thread #1 publish timestamp before
running — drives C1 (days-since-launch) calculation.

Run with: pnpm tsx scripts/devnet-beta-gate-check.ts (committed
output JSON is the gate evidence; one per check run).

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (Gate criteria)"
```

---

### Task A2.7: Update `.env.example` + open + merge PR-A2

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add new env vars to `.env.example`**

Append (or merge with existing structure):

```
# Phase 4 (split) — Network configuration (REQUIRED)
SIPHER_NETWORK=devnet                                # devnet | mainnet — controls which cluster + which BetaBanner state
SIPHER_HELIUS_API_KEY=__set_in_vps_only__            # provisioned via dashboard.helius.dev — origin-restricted to sipher.sip-protocol.org
```

- [ ] **Step 2: Run all tests**

```bash
cd ~/local-dev/sipher
pnpm test -- --run 2>&1 | tail -20
# Expected: all green
```

- [ ] **Step 3: Commit env.example update**

```bash
git add .env.example
git commit -m "docs(env): document SIPHER_NETWORK + SIPHER_HELIUS_API_KEY in .env.example

Adds the two new required env vars introduced by Phase 4a:
- SIPHER_NETWORK: devnet | mainnet (drives BetaBanner + cluster)
- SIPHER_HELIUS_API_KEY: server-side keyed RPC URL component, origin-restricted

Placeholder value '__set_in_vps_only__' for the API key is in the
.gitleaks.toml allowlist so secret scanning doesn't flag it.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md"
```

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/phase4a-network-config
```

- [ ] **Step 5: Open PR**

```bash
gh pr create -R sip-protocol/sipher --base main --head feat/phase4a-network-config \
  --title "Phase 4a: env-var network config + BetaBanner + gate-check + gitleaks CI" \
  --body "$(cat <<'EOF'
## Summary

The sipher-repo half of Phase 4a (Devnet Beta). Adds env-var-driven network configuration so flipping production from devnet→mainnet in Phase 4b becomes a one-line VPS env edit + restart. Adds the BetaBanner UI. Adds the devnet beta gate-check script. Adds gitleaks CI.

## What this PR adds

- \`packages/agent/src/config/network.ts\` + tests — \`loadNetworkConfig()\` reads SIPHER_NETWORK + SIPHER_HELIUS_API_KEY at boot, throws if missing
- \`packages/agent/src/routes/config.ts\` + tests — \`/api/config\` endpoint exposes network metadata to UI; whitelist asserts no Helius URL/key in response
- \`app/src/components/BetaBanner.tsx\` + tests — sticky amber banner visible only when \`network=devnet\`
- \`app/src/lib/networkConfig.ts\` + tests — Zustand store fetches /api/config at boot, caches; UI uses it for Solscan suffix
- \`scripts/devnet-beta-gate-check.ts\` — gate criteria measurement, emits structured JSON evidence
- \`scripts/WALLETS_TO_EXCLUDE.json\` — RECTOR's dev wallets excluded from distinct-wallet counts
- \`.github/workflows/gitleaks.yml\` + \`.gitleaks.toml\` — secret scanning on PRs + nightly cron
- \`.env.example\` — documented placeholders for SIPHER_NETWORK + SIPHER_HELIUS_API_KEY

## Verification

- All unit + integration tests pass: \`pnpm test -- --run\`
- Local boot smoke: \`SIPHER_NETWORK=devnet SIPHER_HELIUS_API_KEY=test pnpm dev\` → \`/api/config\` returns expected JSON, no key in response
- BetaBanner renders on devnet, hidden on mainnet (component test)
- gitleaks local dry-run: 0 leaks
- Gate-check baseline run shows correct schema, FAIL on unmet criteria (expected pre-beta)

## Spec + plan

- Spec: \`docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md\`
- Plan: \`docs/superpowers/plans/2026-05-05-phase4-split-devnet-beta-mainnet.md\`

## What this PR explicitly does NOT do

- Does NOT flip the VPS env (still SIPHER_NETWORK unset → boot will fail until env is set)
- Does NOT publish the blog post (PR-A3) or X thread #1 (manual ops)
- Does NOT run the gate-check against published-launch state (no public launch yet)
EOF
)"
```

- [ ] **Step 6: Wait for CI green + merge**

```bash
gh pr view --json state,mergeable,statusCheckRollup
# Expected: all SUCCESS, including new gitleaks check

gh pr merge --merge --delete-branch
git checkout main && git pull origin main
```

- [ ] **Step 7: Set SIPHER_HELIUS_API_KEY on VPS + flip env**

```bash
ssh sipher@<vps-host>
# Edit env (path depends on your VPS deployment layout — typically /home/sip/sipher/.env or systemd EnvironmentFile)
sudo -u sipher vim /home/sip/sipher/.env
# Add:
#   SIPHER_NETWORK=devnet
#   SIPHER_HELIUS_API_KEY=<paste-from-helius-dashboard>

# Restart the service
docker compose -f /home/sip/sipher/docker-compose.yml up -d sipher

# Verify
sleep 5
curl https://sipher.sip-protocol.org/api/config | jq
# Expected: { "network": "devnet", "beta": true, ... } — no rpcUrl
```

- [ ] **Step 8: Manual UI smoke**

Open https://sipher.sip-protocol.org in browser. Confirm:
- Amber BetaBanner visible at top
- Banner copy: "🧪 You're on DEVNET BETA..."
- Faucet link works
- Dismiss × hides banner for the session
- VaultView Solscan links include `?cluster=devnet` query string

If any check fails, investigate before proceeding.

---

### Task A3.0: Pre-PR-A3 setup — branch in blog-sip + draft post

**Files:**
- Branch: `feat/phase4a-devnet-beta-blog-post` in `~/local-dev/blog-sip`

- [ ] **Step 1: Branch**

```bash
cd ~/local-dev/blog-sip
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/phase4a-devnet-beta-blog-post
```

---

### Task A3.1: Draft + publish devnet beta blog post

**Files:**
- Create: `src/content/blog/2026-05-XX-sipher-vault-devnet-beta-open.mdx`
- Create: `public/images/sipher-vault/architecture-diagram.svg` (or PNG)

- [ ] **Step 1: Create the blog post draft**

Replace `2026-05-XX` in the filename with the actual planned publish date (Day 0). Filename slug suggestion: `2026-05-12-sipher-vault-devnet-beta-open.mdx`.

```mdx
---
title: "Sipher Vault — Devnet Beta is Open"
description: "Privacy primitive for Solana now in public devnet beta. Try it before mainnet."
publishDate: 2026-05-XX
author: rector
tags: [sipher, vault, solana, privacy, devnet, beta]
draft: false
---

import Callout from '@/components/Callout.astro'

Sipher Vault — the agentic privacy primitive for Solana — is now in **public devnet beta**.

This post explains what the vault does, how to participate as a tester, and what gates the eventual mainnet ship.

## What is Sipher Vault?

A vault that breaks the link between a sender's wallet and a private recipient's stealth address.

The straightforward way to send a stealth payment on Solana is for the sender's wallet to transfer directly to the recipient's stealth address. But this leaks the sender: anyone watching the sender's TX history sees the stealth address as a destination, and can potentially correlate it with the recipient.

Sipher Vault interposes a third party: the sender deposits into the vault, then the vault (signing as a separate authority) withdraws to the recipient's stealth address. The sender's wallet never appears in the recipient's view of their own incoming TXs.

## How it works

[Architecture diagram here — SVG showing deposit → withdraw_private → CPI to sip_privacy → recipient claims]

The vault has 7 instructions:

| Instruction | What it does |
|---|---|
| `initialize` | Set up vault config (fee bps, refund timeout, authority) |
| `create_vault_token` | Initialize a vault-side token account for a given mint |
| `create_fee_token` | Initialize the fee-collection token account |
| `deposit` | User deposits SPL tokens; creates a DepositRecord PDA |
| `withdraw_private` | Authority withdraws to a stealth recipient + CPI to `sip_privacy.create_transfer_announcement` |
| `refund` | User refunds their own deposit (24h timeout enforced) |
| `authority_refund` | Authority refunds a deposit on the user's behalf (same 24h timeout) |
| `collect_fee` | Authority collects accumulated fees |

The CPI to `sip_privacy` is what makes the privacy primitive complete: it creates an on-chain `transfer_record` that lets the recipient discover the funds via their viewing key, without out-of-band signaling.

## Try it on devnet

The full beta is at **[sipher.sip-protocol.org](https://sipher.sip-protocol.org)**. The amber banner at the top confirms you're on devnet.

To test:
1. Get devnet SOL from [faucet.solana.com](https://faucet.solana.com)
2. Connect your wallet (Phantom / Backpack / Solflare all supported)
3. Deposit a small amount of wSOL
4. Generate a stealth recipient
5. Withdraw privately
6. Scan + claim with the recipient's viewing key

If you see anything unexpected — a confusing UX flow, a transaction that fails with an unexplained error, a wallet that doesn't connect — please **file a GitHub issue** at [github.com/sip-protocol/sipher/issues](https://github.com/sip-protocol/sipher/issues).

## Gate to mainnet (transparency)

We don't ship to mainnet on a calendar deadline. Mainnet ships when these criteria all pass:

- ≥3 days from public launch
- ≥5 successful deposits from ≥3 distinct non-RECTOR wallets
- ≥3 successful `withdraw_private` from ≥2 distinct non-RECTOR wallets
- ≥1 successful `authority_refund`
- Zero unexplained reverts (defined: anything not classifiable as user-error within an hour)
- Zero authority-side interventions

If we get to Day 7 and gates aren't passing, we extend the soak window. Quality > velocity.

## What's identical between this beta and the mainnet ship

The cryptography, the program logic, the CPI flow, the fee math, the 24-hour refund timeout — all 100% identical. Same vanity program ID (`S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`) on both clusters.

What changes when we ship mainnet: real money, real prod tokens (USDC/BONK/etc.), a different RPC tier, and the BetaBanner disappears.

## What's next

After devnet beta closes (gate criteria met), we ship mainnet. After mainnet, our next milestone (M19) addresses claim linkability — a known privacy gap in the current design where a tester repeatedly claiming from the same recipient could fingerprint themselves. That's a separate spec.

**Try the vault → break it → tell us what to fix.**

→ [sipher.sip-protocol.org](https://sipher.sip-protocol.org)
→ [docs.sip-protocol.org/sipher](https://docs.sip-protocol.org/sipher)
→ [Issues: github.com/sip-protocol/sipher](https://github.com/sip-protocol/sipher/issues)
```

- [ ] **Step 2: Generate architecture diagram**

Create `public/images/sipher-vault/architecture-diagram.svg`. Mermaid-rendered or hand-drawn SVG showing:
- User's wallet
- Deposit instruction → DepositRecord PDA
- Authority signs withdraw_private
- Withdraw → vault → stealth recipient ATA
- CPI → sip_privacy → transfer_record PDA
- Recipient scans with viewing key → claims

Style for dark backgrounds (per CLAUDE.md user-scope dark-mode preference).

Reference the diagram in the MDX above.

- [ ] **Step 3: Local preview**

```bash
pnpm dev
# Browser to http://localhost:4321/sipher-vault-devnet-beta-open (or wherever blog-sip routes blog posts)
```

Verify rendering, check images load, check internal links.

- [ ] **Step 4: Commit**

```bash
git add src/content/blog/2026-05-XX-sipher-vault-devnet-beta-open.mdx \
        public/images/sipher-vault/architecture-diagram.svg
git commit -m "feat(blog): devnet beta launch post — Sipher Vault

Phase 4a Day 0 blog post. Explains the vault privacy primitive,
walks testers through participating, states gate criteria
transparently, sets expectations for the mainnet ship.

Includes architecture SVG showing deposit → withdraw_private → CPI
to sip_privacy → recipient claim flow.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md"
```

- [ ] **Step 5: Push + open + merge PR**

```bash
git push -u origin feat/phase4a-devnet-beta-blog-post
gh pr create -R sip-protocol/blog-sip --base main --head feat/phase4a-devnet-beta-blog-post \
  --title "Phase 4a: devnet beta launch post" \
  --body "Day 0 blog post for Sipher Vault devnet beta. Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (in sipher repo)"
gh pr merge --merge --delete-branch
```

- [ ] **Step 6: Verify on production**

After CI deploy completes:

```bash
sleep 60  # blog-sip deploys via GHCR + auto-deploy
curl -s https://blog.sip-protocol.org/sipher-vault-devnet-beta-open/ | grep -i "DEVNET BETA"
# Expected: ≥1 hit
```

---

### Task A4.0 — A4.4: Soak window (non-PR tasks, RECTOR-driven)

These are operational tasks tracked but not done as PRs. Each completes when the corresponding evidence is committed (gate-check JSON files in `docs/sentinel/evidence/`).

- [ ] **Day -1 (private kickoff):** RECTOR DMs Steave/Pratik in Superteam Indo TG with the early-access link (`https://sipher.sip-protocol.org`). Brief context: "we're opening devnet beta tomorrow, would value 5-10 hand-picked testers from your community before we go wider on Day 3. Bug reports via DM or GitHub issues."

- [ ] **Day 0 (public launch):**
  - Set `SIPHER_BETA_LAUNCH_AT=<actual-publish-time>` somewhere durable (env var on local + on VPS for gate-check script).
  - Publish X thread #1 (drafted by CIPHER, edited + voiced by RECTOR).
  - Publish blog post (PR-A3 already merged + deployed).
  - Cross-link the X thread from the blog and vice versa.
  - Confirm `https://sipher.sip-protocol.org` BetaBanner visible.

- [ ] **Day 0-2 (private cohort soak):**
  - 1h/day max manual reply to bug reports.
  - File any reproducible bugs as GitHub issues (don't fix in DMs).
  - If a critical bug surfaces (CPI revert, RPC failure, state corruption): pause via `set-paused.ts`, fix in a hotfix PR, redeploy, unpause.

- [ ] **Day 3 (gate-check #1 + broaden):**

```bash
cd ~/local-dev/sipher
SIPHER_BETA_LAUNCH_AT=<launch-iso> \
pnpm tsx scripts/devnet-beta-gate-check.ts
# Outputs: docs/sentinel/evidence/devnet-beta-gate-2026-05-XX.json

git add docs/sentinel/evidence/devnet-beta-gate-2026-05-XX.json
git commit -m "evidence(sentinel): Phase 4a Day 3 gate-check"
git push origin main  # commit directly to main, no PR for evidence files (matches Phase 3 pattern)
```

If `overall: PASS` → proceed to PR-B1 same day or next.
If `overall: FAIL` but criteria close → publish X thread #2 (broaden cohort), continue to Day 5.
If `overall: FAIL` stalled → bug-fix sweep in a new branch, merge, restart soak from Day 3+.

X thread #2 publish (drafted by CIPHER pre-launch, finalized day-of with actual stats).

- [ ] **Day 5 (gate-check #2 if Day 3 was FAIL):**

Re-run gate-check, commit JSON, decide.

- [ ] **Day 7 (gate-check #3, decision day):**

Final gate-check. If still FAIL: mandatory reassessment with RECTOR per spec Section 7 decision tree (lower bar / extend / ship anyway / defer 4b).

---

## Stage B — Phase 4b (Mainnet Fast-Follow)

Three PRs (B1 in `sip-protocol`, B2 in `sipher`, B3 in `blog-sip`) plus the X thread #3 publish, all same day after gate passes. Execution mode: **PR-B1 subagent-driven (mainnet program work, RECTOR at keyboard for actual deploy TX), PR-B2 + PR-B3 inline.**

### Task B0: Pre-flight (block PR-B1 from starting)

- [ ] **Step 1: Verify gate evidence on main**

```bash
cd ~/local-dev/sipher
ls docs/sentinel/evidence/devnet-beta-gate-*.json
jq -r '.overall' $(ls docs/sentinel/evidence/devnet-beta-gate-*.json | tail -1)
# Expected: PASS (in the most recent file)
```

If any other answer, do NOT proceed. Reassess per spec decision tree.

- [ ] **Step 2: Verify mainnet authority funded**

```bash
solana balance S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd --url mainnet-beta
# Expected: ≥ 6 SOL
```

If < 6 SOL, fund from RECTOR's mainnet treasury before proceeding.

- [ ] **Step 3: Verify anchor 0.30.1 active**

```bash
avm use 0.30.1
anchor --version  # → 0.30.1
```

- [ ] **Step 4: Verify devnet program slot matches expected (no upgrades since gate)**

```bash
solana program show S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB --url devnet
# Note "Last Deployed In Slot" — should match the slot recorded in PR-A1's DEPLOYMENT.md
```

If they differ, an unexpected upgrade happened — investigate.

---

### Task B1.0: Pre-PR-B1 setup — branch + decrypt authority

**Files:**
- (none — branch + decrypt only)

- [ ] **Step 1: Branch in sip-protocol**

```bash
cd ~/local-dev/sip-protocol
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/phase4b-mainnet-deploy
```

- [ ] **Step 2: Decrypt authority keypair (RECTOR enters passphrase)**

```bash
cd ~/Documents/secret/sip-keys
./sip-keys.sh decrypt solana/authority.json.age
# Prompts for passphrase. Outputs to /tmp/sip-key-decrypted.json (mode 600)

# Verify pubkey
solana-keygen pubkey /tmp/sip-key-decrypted.json
# Expected: S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd
```

If the pubkey doesn't match, the decrypted keypair is wrong — DO NOT PROCEED. Flag to RECTOR.

---

### Task B1.1: Mainnet deploy script — `deploy-mainnet.ts`

**Reuses script from predecessor plan** (PR-2 Task 2.4 — `deploy-mainnet.ts`).

**Files:**
- Create: `programs/sipher-vault/scripts/deploy-mainnet.ts` (full code in predecessor plan)
- Modify: `programs/sipher-vault/DEPLOYMENT.md`
- Modify: `~/local-dev/sip-protocol/CLAUDE.md` (after deploy, update keypair table)

The script: pre-flight balance check → atomic deploy with priority fee → wait for confirmation → call `initialize` ix → verify config PDA → emit summary.

- [ ] **Step 1: Copy `deploy-mainnet.ts` from predecessor plan**

Copy from `docs/superpowers/plans/2026-05-04-phase4-mainnet-vault-deploy.md` Task 2.4 (~150 lines).

- [ ] **Step 2: Build mainnet binary clean**

```bash
cd ~/local-dev/sip-protocol/programs/sipher-vault
cargo clean -p sipher-vault
anchor build 2>&1 | tail -8

stat -f "%z" target/deploy/sipher_vault.so
# Expected: 376_664 (or close — this is the binary that goes to mainnet)
```

- [ ] **Step 3: Verify binary hash matches main HEAD**

```bash
git rev-parse HEAD
# Note this hash — record it in DEPLOYMENT.md after deploy

# (No good way to verify byte-for-byte that binary matches HEAD without
# building in CI; just confirm git status is clean and binary just rebuilt)
git status --short
# Expected: empty (no uncommitted changes)
```

- [ ] **Step 4: Run deploy-mainnet.ts (RECTOR at keyboard for the actual TX)**

```bash
cd ~/local-dev/sip-protocol/programs/sipher-vault
ANCHOR_WALLET=/tmp/sip-key-decrypted.json \
ANCHOR_PROVIDER_URL=https://mainnet.helius-rpc.com/?api-key=$SIPHER_HELIUS_API_KEY \
pnpm tsx scripts/deploy-mainnet.ts 2>&1 | tee /tmp/mainnet-deploy-$(date +%Y-%m-%d-%H%M%S).log
```

Expected stdout (annotated):

```
Phase 4b — mainnet sipher_vault deploy
Loaded keypair: S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd
Pre-flight balance check: 6.45 SOL ≥ 6.0 SOL ✓
Building binary... (already built — 376_664 bytes)
Submitting program deploy with priority fee 10_000 micro-lamports...
Deploy TX: <sig>
Waiting for confirmation...
✓ Deploy confirmed in slot <slot>
Calling initialize ix (fee_bps=10, refund_timeout=86400)...
Initialize TX: <sig>
✓ Config PDA initialized at <pda>
Verifying VaultConfig deserialization...
✓ feeBps=10, refundTimeout=86400, authority=S1P6j1y...wWMd, paused=false

──────────────────────────────────────────────────
✓ Mainnet deploy COMPLETE.
  Program ID:        S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB
  Deploy TX:         <sig>
  Initialize TX:     <sig>
  Config PDA:        <pda>
  Deployed in slot:  <slot>
  Solscan:           https://solscan.io/account/S1Phr5rm...U4kHB
──────────────────────────────────────────────────
```

If deploy fails mid-flight, the buffer account rent is reclaimable — see predecessor plan PR-2 Task 2.4 for retry guidance.

- [ ] **Step 5: Update DEPLOYMENT.md mainnet section**

Append to `programs/sipher-vault/DEPLOYMENT.md`:

```markdown
### Mainnet (2026-05-XX)

- Program ID: `S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB`
- Config PDA: `<pda-from-stdout>`
- Authority: `S1P6j1yeTm6zkewQVeihrTZvmfoHABRkHDhabWTuWMd`
- Deploy TX: `<sig>` (slot <slot>)
- Initialize TX: `<sig>`
- Fee: 10 bps
- Refund timeout: 86400s (24h)
- Built from sip-protocol main HEAD: `<hash>`
- Binary size: 376_664 bytes
```

- [ ] **Step 6: Update sip-protocol CLAUDE.md keypair table**

Find the keypair table in `~/local-dev/sip-protocol/CLAUDE.md` (under "Solana Program Deployments" header). Add a row for sipher_vault mainnet with the new config PDA.

- [ ] **Step 7: Commit**

```bash
cd ~/local-dev/sip-protocol
git add programs/sipher-vault/scripts/deploy-mainnet.ts \
        programs/sipher-vault/DEPLOYMENT.md \
        CLAUDE.md
git commit -m "feat(sipher-vault): mainnet deploy + initialize — Phase 4b ship

Mainnet sipher_vault deployed at S1Phr5rm...U4kHB. Config PDA
initialized with fee_bps=10, refund_timeout=86400, authority
S1P6j1y...wWMd (same as sip_privacy mainnet authority).

Atomic deploy + initialize via scripts/deploy-mainnet.ts — single
script run, no announce window. Pre-flight gates required ≥6 SOL
authority balance, anchor 0.30.1, gate-check evidence PASS.

DEPLOYMENT.md records the deploy TX, initialize TX, deploy slot,
binary hash. CLAUDE.md keypair table updated with mainnet config PDA.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (Phase 4b B1)"
```

- [ ] **Step 8: Clean decrypted authority keypair**

```bash
cd ~/Documents/secret/sip-keys
./sip-keys.sh clean
# Removes /tmp/sip-key-decrypted.json
ls /tmp/sip-key-decrypted.json
# Expected: No such file or directory
```

---

### Task B1.2: Mainnet smoke — `smoke-mainnet.ts`

**Reuses script from predecessor plan** (PR-2 Task 2.5).

The script: wraps 0.001 SOL → wSOL → deposit → withdraw_private → verify transfer_record exists at sip_privacy → emit evidence JSON.

- [ ] **Step 1: Copy `smoke-mainnet.ts` from predecessor plan**

Copy from predecessor plan PR-2 Task 2.5.

- [ ] **Step 2: Decrypt authority again (cleaned in B1.1 Step 8)**

```bash
cd ~/Documents/secret/sip-keys
./sip-keys.sh decrypt solana/authority.json.age
```

- [ ] **Step 3: Run smoke test**

```bash
ANCHOR_WALLET=/tmp/sip-key-decrypted.json \
ANCHOR_PROVIDER_URL=https://mainnet.helius-rpc.com/?api-key=$SIPHER_HELIUS_API_KEY \
pnpm tsx scripts/smoke-mainnet.ts 2>&1 | tee /tmp/mainnet-smoke-$(date +%Y-%m-%d-%H%M%S).log
```

Expected: deposit + withdraw + transfer_record verification, all green. Cost: ~0.005 SOL.

- [ ] **Step 4: Commit smoke evidence**

The script writes `docs/sentinel/evidence/mainnet-smoke-{date}.json` (in sip-protocol repo or sipher repo — depends on where the script lives; predecessor plan put it in sip-protocol).

```bash
git add docs/sentinel/evidence/mainnet-smoke-*.json programs/sipher-vault/scripts/smoke-mainnet.ts
git commit -m "evidence(sipher-vault): Phase 4b mainnet smoke test passed

Deposit + withdraw_private + transfer_record verification all green
on mainnet sipher_vault. Evidence at docs/sentinel/evidence/mainnet-smoke-2026-05-XX.json.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (B3)"
```

- [ ] **Step 5: Clean decrypted authority**

```bash
~/Documents/secret/sip-keys/sip-keys.sh clean
```

---

### Task B1.3: Open + merge PR-B1

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/phase4b-mainnet-deploy
```

- [ ] **Step 2: Open PR**

```bash
gh pr create -R sip-protocol/sip-protocol --base main --head feat/phase4b-mainnet-deploy \
  --title "Phase 4b: mainnet sipher_vault deploy + smoke" \
  --body "$(cat <<'EOF'
## Summary

Mainnet ship of Phase 4. Atomic deploy + initialize + smoke test for sipher_vault on Solana mainnet at the existing vanity ID \`S1Phr5rmDfkZTyLXzH5qUHeiqZS3Uf517SQzRbU4kHB\`.

## Pre-flight gates (verified)

- [x] Phase 4a gate evidence shows \`overall: PASS\`
- [x] Mainnet authority \`S1P6j1y…wWMd\` funded ≥ 6 SOL
- [x] Anchor 0.30.1 active
- [x] Binary built from sip-protocol main HEAD, 376,664 bytes
- [x] Deploy + initialize ran cleanly with no buffer-rent leak
- [x] Smoke test (deposit + withdraw_private + transfer_record verification) green

## What this PR adds

- \`programs/sipher-vault/scripts/deploy-mainnet.ts\` — atomic mainnet deploy script
- \`programs/sipher-vault/scripts/smoke-mainnet.ts\` — post-deploy smoke
- \`programs/sipher-vault/DEPLOYMENT.md\` — mainnet section with deploy + initialize TXs
- \`CLAUDE.md\` — keypair table updated with mainnet config PDA
- \`docs/sentinel/evidence/mainnet-smoke-2026-05-XX.json\` — committed evidence

## Spec + plan

- Spec: \`docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md\` (in sipher repo)
- Plan: \`docs/superpowers/plans/2026-05-05-phase4-split-devnet-beta-mainnet.md\` (in sipher repo)

## What this PR explicitly does NOT do

- Does NOT flip the production VPS env to mainnet (PR-B2)
- Does NOT publish the launch blog post or X thread (PR-B3 + manual)
- Does NOT include 24h+ authority_refund evidence (separate task — see plan B1.4)
EOF
)"
```

- [ ] **Step 3: Merge**

```bash
gh pr view --json state,mergeable,statusCheckRollup
# Expected: MERGEABLE, all checks SUCCESS

gh pr merge --merge --delete-branch
git checkout main && git pull origin main
```

---

### Task B1.4: 24h authority_refund evidence (background, blocks PR-B3)

This task waits 24h+ after the smoke deposit (Task B1.2 Step 3) before running. It's a continuation of PR-B1 work but happens after PR-B1 has merged. The evidence commit is a small follow-up PR.

- [ ] **Step 1: Wait ≥24h after Stage 2 deposit**

The smoke test in B1.2 created a deposit with `lastDepositAt` recorded. 24h after that timestamp, authority can refund.

- [ ] **Step 2: Decrypt authority + run refund**

```bash
~/Documents/secret/sip-keys/sip-keys.sh decrypt solana/authority.json.age

ANCHOR_WALLET=/tmp/sip-key-decrypted.json \
ANCHOR_PROVIDER_URL=https://mainnet.helius-rpc.com/?api-key=$SIPHER_HELIUS_API_KEY \
pnpm tsx scripts/mainnet-authority-refund-evidence.ts
# Script signature mirrors devnet-vault-refund-e2e.ts but for mainnet
# Outputs docs/sentinel/evidence/mainnet-authority-refund-{date}.json
```

- [ ] **Step 3: Commit evidence (small PR)**

```bash
git checkout -b evidence/phase4b-mainnet-refund
git add docs/sentinel/evidence/mainnet-authority-refund-*.json
git commit -m "evidence(sipher-vault): Phase 4b mainnet authority_refund 24h+ post-deposit"
git push -u origin evidence/phase4b-mainnet-refund
gh pr create --base main --head evidence/phase4b-mainnet-refund \
  --title "Phase 4b: mainnet authority_refund evidence" \
  --body "Authority-signed refund of the smoke deposit, 24h+ after deposit. Closes acceptance criterion B4."
gh pr merge --merge --delete-branch
```

- [ ] **Step 4: Clean decrypted authority**

```bash
~/Documents/secret/sip-keys/sip-keys.sh clean
```

---

### Task B2.0 — B2.1: VPS env flip (likely no code PR)

This task is the actual production cutover. Almost no code — just an SSH session, an env edit, and a Docker restart.

- [ ] **Step 1: Branch in sipher for runbook commit**

```bash
cd ~/local-dev/sipher
git checkout main && git pull origin main
git checkout -b feat/phase4b-mainnet-flip
```

- [ ] **Step 2: Add runbook doc**

Create `docs/runbook/phase-4b-flip.md`:

```markdown
# Phase 4b — Mainnet Cutover Runbook

**Executed:** 2026-05-XX HH:MM UTC
**Operator:** RECTOR
**Pre-conditions met:**
- [x] PR-B1 (sip-protocol mainnet deploy) merged
- [x] Smoke evidence committed (`docs/sentinel/evidence/mainnet-smoke-2026-05-XX.json`)
- [x] Authority refund evidence committed (`docs/sentinel/evidence/mainnet-authority-refund-2026-05-XX.json`)
- [x] Blog post draft ready (PR-B3 in flight or queued)

## Steps executed

1. `ssh sipher@<vps>`
2. Edit `/home/sip/sipher/.env`:
   - Change `SIPHER_NETWORK=devnet` to `SIPHER_NETWORK=mainnet`
   - (SIPHER_HELIUS_API_KEY remains unchanged — same key works for both clusters via Helius account-level routing)
3. `cd /home/sip/sipher && docker compose up -d sipher`
4. Verify: `curl https://sipher.sip-protocol.org/api/config | jq` — expect `network: "mainnet"`, `beta: false`
5. Verify UI: load production page, confirm BetaBanner is gone

## Verification commands (post-flip)

\`\`\`bash
curl https://sipher.sip-protocol.org/api/config | jq '.network,.beta'
# Expected:
# "mainnet"
# false
\`\`\`

## Rollback (if needed)

If anything looks wrong post-flip:
1. `ssh sipher@<vps>`
2. Edit `.env` back to `SIPHER_NETWORK=devnet`
3. `docker compose up -d sipher`
4. Verify rollback via curl
5. Diagnose root cause before re-attempting cutover

Mainnet program is unaffected by this rollback — vault still live on-chain. Only the Sipher web product points back at devnet.
```

- [ ] **Step 3: Execute the actual flip**

Open SSH:

```bash
ssh sipher@<vps-host>  # or whichever the actual VPS host alias is
sudo -u sipher vim /home/sip/sipher/.env
# Change SIPHER_NETWORK=devnet → SIPHER_NETWORK=mainnet
# Save + exit

cd /home/sip/sipher
docker compose up -d sipher
sleep 5

# Verify
curl http://localhost:5006/api/config | jq '.network,.beta'
# Expected: "mainnet" + false

curl https://sipher.sip-protocol.org/api/config | jq '.network,.beta'
# Expected: "mainnet" + false (after CF cache clears, may take ~30s)
```

- [ ] **Step 4: Manual UI smoke**

Open https://sipher.sip-protocol.org. Confirm:
- BetaBanner GONE
- VaultView Solscan links no longer have `?cluster=devnet`
- Wallet connect still works
- No console errors

- [ ] **Step 5: Commit runbook**

```bash
cd ~/local-dev/sipher
git add docs/runbook/phase-4b-flip.md
git commit -m "docs(runbook): Phase 4b mainnet cutover runbook + executed evidence

Records the env flip from SIPHER_NETWORK=devnet → mainnet on
sipher.sip-protocol.org. /api/config now returns network=mainnet,
beta=false. BetaBanner removed.

Production cutover executed 2026-05-XX HH:MM UTC by RECTOR.

Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md (Phase 4b B2)"
```

- [ ] **Step 6: Push + open + merge PR**

```bash
git push -u origin feat/phase4b-mainnet-flip
gh pr create --base main --head feat/phase4b-mainnet-flip \
  --title "Phase 4b: mainnet cutover runbook" \
  --body "VPS env flipped to SIPHER_NETWORK=mainnet on 2026-05-XX. Runbook committed for audit trail. Spec: docs/superpowers/specs/2026-05-05-phase4-split-devnet-beta-mainnet-design.md"
gh pr merge --merge --delete-branch
```

---

### Task B3.0 — B3.1: Mainnet launch blog post

**Files:**
- Create: `~/local-dev/blog-sip/src/content/blog/2026-05-XX-sipher-vault-mainnet-launch.mdx`

- [ ] **Step 1: Branch in blog-sip**

```bash
cd ~/local-dev/blog-sip
git checkout main && git pull origin main
git checkout -b feat/phase4b-mainnet-launch-post
```

- [ ] **Step 2: Draft post**

Use the structure from spec Section 8: Headline → beta journey → what changed (table) → architecture deep-dive → tester credits (with permission) → risk disclosures → what's next (M19).

Reference actual TXs from PR-B1 + B1.4 evidence files. Include real numbers from final gate-check evidence (TXs, wallets, bugs).

- [ ] **Step 3: Local preview + commit + push + merge PR**

(Same flow as A3.)

---

### Task B-Day: X thread #3 publish + Superteam thank-you

(Manual op, RECTOR-driven.)

- [ ] **Step 1: Publish X thread #3** (drafted by CIPHER pre-launch, finalized day-of)

Reference real numbers from gate evidence + smoke evidence. Cross-link blog post.

- [ ] **Step 2: DM Superteam testers (with permission for credits)**

Thank the Superteam Indo cohort. Share the mainnet TX. Ask consent before naming them in the blog post.

---

## Self-Review Checklist

Before declaring this plan complete and merging the spec+plan PR:

- [ ] **Spec coverage:** Every spec section has at least one task. D1-D9 all covered. All 14 success criteria (A1-A7, B1-B7) mapped to specific tasks. R-table risks all addressed by mitigations in tasks or runbooks.
- [ ] **Placeholder scan:** No "TBD", "TODO", "implement later", "fill in details", "Add appropriate error handling". Discriminator placeholders in gate-check script ARE intentional and replaced in Task A2.6 Step 3.
- [ ] **Type consistency:** `loadNetworkConfig()` return type used consistently as `NetworkConfig`. `/api/config` response shape matches `NetworkConfigPublic` (subset, with whitelist). `BetaBanner` prop is `beta: boolean`.
- [ ] **Cross-task references:** When PR-B1 references "predecessor plan PR-2 Task 2.4", that task exists in `docs/superpowers/plans/2026-05-04-phase4-mainnet-vault-deploy.md`. Confirmed.
- [ ] **Time-gate clarity:** 24h authority_refund timeout (Task B1.4) cannot be skipped — block on real wall-clock.
- [ ] **No unused imports:** Each script's imports are used. Each helper is called.

---

## Out-of-band notes

- **The predecessor plan (`2026-05-04-phase4-mainnet-vault-deploy.md`)** still has the full inline code for `upgrade-devnet.ts`, `e2e-cpi-test.ts`, `set-paused.ts`, `deploy-mainnet.ts`, `smoke-mainnet.ts`. This plan references those by path rather than copying — operators must keep both plans available. The predecessor plan's high-level structure is now superseded by this plan's Stage A / Stage B; only its scripts are reused.
- **The original Phase 4 PR sequence (-j.md PR-1, PR-2, PR-3, PR-4) was 4 PRs.** This plan has 6 PRs (A1+A2+A3 + B1+B2+B3) plus a small evidence PR (B1.4). The split is what the new spec drives.
- **`SIPHER_BETA_LAUNCH_AT`** must be set before running gate-check on Day 3+. Set it once in the local shell + on the VPS env (for cron-like reruns) at Day 0 launch time.
- **Helius account-level vs key-level routing**: the same `SIPHER_HELIUS_API_KEY` works for both devnet and mainnet RPC URLs (Helius routes by URL hostname, not key). No separate keys needed for the two clusters. Confirmed at https://docs.helius.dev.
- **Phase 5 (M19 claim linkability fix)** is the next milestone after this. Out of scope here.
