# Sipher Deployment Guide

Production deployment reference for Sipher on the SIP Protocol VPS.

## Overview

Sipher runs as a Docker container (`sipher` + `sipher-redis`) behind nginx at [sipher.sip-protocol.org](https://sipher.sip-protocol.org). Deployment is GitOps: GitHub Actions builds on push to `main`, publishes to GHCR, then SSHes into the VPS and recreates the container.

## VPS Layout

| Path | Purpose |
|------|---------|
| `/home/sip/sipher/docker-compose.yml` | Service definitions (`api` + `redis`) |
| `/home/sip/sipher/.env` | Secrets and environment vars |
| `sipher-data` Docker volume | SQLite databases (audit, sessions, SENTINEL) |
| `redis-data` Docker volume | Redis append-only persistence |

SSH access: `ssh sip` (the `sipher` container runs under the `sip` user, there is no dedicated `sipher` user).

## Environment Variables

### Required for Production

| Variable | Purpose | Generator |
|----------|---------|-----------|
| `JWT_SECRET` | Signs Command Center auth JWT tokens. Min 16 chars. Code throws if unset. | `openssl rand -hex 32` |
| `SIPHER_ADMIN_PASSWORD` | Command Center UI admin login password. Empty = login disabled (fail-closed). | `openssl rand -base64 24` |
| `ADMIN_API_KEY` | Admin API key for `/api/admin/*` endpoints. Empty = endpoints return 503. | `openssl rand -hex 32` |
| `API_KEYS` | Comma-separated public API keys | Generate per client |
| `SOLANA_RPC_URL` | Primary Solana RPC endpoint | Provider dashboard |
| `SIPHER_OPENROUTER_API_KEY` | LLM provider key (OpenRouter) | openrouter.ai dashboard |
| `OPENROUTER_API_KEY` | Fallback for non-Sipher agents | openrouter.ai dashboard |

### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `SOLANA_RPC_URL_FALLBACK` | (empty) | Fallback RPC on primary failure |
| `SIPHER_HELIUS_API_KEY` | (empty) | Dedicated Helius key (when `RPC_PROVIDER=helius`) |
| `RPC_PROVIDER` | `generic` | `helius` / `quicknode` / `triton` / `generic` |
| `SIPHER_MODEL` | `anthropic/claude-sonnet-4-6` | Default SIPHER LLM model |
| `SOLANA_NETWORK` | `mainnet-beta` | `mainnet-beta` / `devnet` |
| `CORS_ORIGINS` | SIP domains | Comma-separated allowlist |
| `RATE_LIMIT_MAX` | `100` | Requests per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `JUPITER_API_URL` | `https://lite-api.jup.ag` | Jupiter DEX endpoint |
| `JITO_BLOCK_ENGINE_URL` | (empty) | Jito bundle relay (empty = mock mode) |
| `AUTHORIZED_WALLETS` | (empty) | Comma-separated admin wallet pubkeys |
| `HERALD_MONTHLY_BUDGET` | `150` | HERALD X agent USD budget cap |

### SENTINEL Security Agent

SENTINEL is an LLM-backed security analyst that performs preflight risk assessment before fund-moving actions. See [SENTINEL design spec](superpowers/specs/2026-04-15-sentinel-formalization-design.md) for full architecture.

| Variable | Default | Purpose |
|----------|---------|---------|
| `SENTINEL_MODE` | `yolo` | `yolo` (autonomous) / `advisory` (recommend only) / `off` (rule-based only, LLM disabled) |
| `SENTINEL_AUTHORITY_KEYPAIR` | (empty) | Path to vault authority keypair JSON. Required for auto-refunds. |
| `SENTINEL_AUTO_REFUND_THRESHOLD` | `1` | SOL amount ≤ this → immediate refund; > → circuit breaker pause |
| `SENTINEL_CANCEL_WINDOW_MS` | `30000` | Circuit breaker wait time before execution fires |
| `SENTINEL_RATE_LIMIT_FUND_PER_HOUR` | `5` | Per-wallet fund action limit |
| `SENTINEL_RATE_LIMIT_BLACKLIST_PER_HOUR` | `20` | Global blacklist add rate limit |
| `SENTINEL_MODEL` | `anthropic/claude-sonnet-4.6` | SENTINEL LLM (cheaper: `anthropic/claude-haiku-4.5`) |
| `SENTINEL_DAILY_BUDGET_USD` | `10` | Daily budget cap — emits warning on exceed |
| `SENTINEL_BLOCK_ON_ERROR` | `false` | Fail-open (default) or fail-closed on LLM preflight errors |
| `SENTINEL_PREFLIGHT_SCOPE` | `fund-actions` | `fund-actions` / `critical-only` / `never` |
| `SENTINEL_PREFLIGHT_SKIP_AMOUNT` | `0.1` | SOL amount below which β rules skip LLM for known recipients |
| `SENTINEL_BLACKLIST_AUTONOMY` | `true` | If `false`, LLM emits alert instead of writing blacklist |
| `SENTINEL_SCAN_INTERVAL` | `60000` | Idle poll interval (ms) for blockchain monitor |
| `SENTINEL_ACTIVE_SCAN_INTERVAL` | `15000` | Active poll interval when wallets present |
| `SENTINEL_THREAT_CHECK` | `true` | Enable on-chain threat detector |
| `SENTINEL_LARGE_TRANSFER_THRESHOLD` | `10` | SOL threshold for large-transfer event |

**Mode transition path (always rollout in this order):**

1. **`off`** — Development. No LLM reasoning, rule-based only.
2. **`advisory`** — Initial production rollout. LLM recommends but does not act. Fund actions still execute through normal flow. Observe decisions via `/api/sentinel/decisions`.
3. **`yolo`** — Full autonomy. LLM can refund / blacklist / cancel / alert without human approval. Circuit breaker gates large fund moves above `SENTINEL_AUTO_REFUND_THRESHOLD`.

Deploy new SENTINEL features in `advisory` for at least one week before promoting to `yolo`.

## Secrets Management

**Local storage:** `~/Documents/secret/sipher-vps-secrets.env` (iCloud encrypted, per CLAUDE.md convention). Mode `600`.

**VPS location:** `/home/sip/sipher/.env`. Owned by `sip` user.

**Generation:**

```bash
openssl rand -hex 32      # 64 hex chars (JWT_SECRET, ADMIN_API_KEY)
openssl rand -base64 24   # ~32 URL-safe chars (SIPHER_ADMIN_PASSWORD)
```

**Initial setup / rotation:**

```bash
# 1. Generate locally
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_API_KEY=$(openssl rand -hex 32)
SIPHER_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)

# 2. Store in iCloud-encrypted dir
cat > ~/Documents/secret/sipher-vps-secrets.env <<EOF
JWT_SECRET=$JWT_SECRET
ADMIN_API_KEY=$ADMIN_API_KEY
SIPHER_ADMIN_PASSWORD=$SIPHER_ADMIN_PASSWORD
EOF
chmod 600 ~/Documents/secret/sipher-vps-secrets.env

# 3. Back up VPS .env before editing
ssh sip 'cp ~/sipher/.env ~/sipher/.env.bak-$(date -u +%Y%m%dT%H%MZ)'

# 4. Push to VPS (append to .env)
{
  echo ""
  echo "# Auth secrets (rotated $(date -u +%Y-%m-%dT%HZ))"
  grep -E "^(JWT_SECRET|ADMIN_API_KEY|SIPHER_ADMIN_PASSWORD)=" ~/Documents/secret/sipher-vps-secrets.env
} | ssh sip 'cat >> ~/sipher/.env'

# 5. Recreate only the api service (env changes require recreate, not restart).
#    Using `api` (not bare `up -d`) avoids bouncing redis unnecessarily.
ssh sip 'cd ~/sipher && docker compose up -d api'

# 6. Verify — should show no "variable not set" warnings
ssh sip 'docker logs sipher --tail 30 | grep -iE "sentinel|listening|error"'
```

**What rotation invalidates:**
- **JWT sessions** — old tokens signed with the previous `JWT_SECRET` fail verification. Users re-login.
- **In-memory admin sessions** — the `adminTokens` Map in `packages/agent/src/routes/admin.ts` is process-local; `docker compose up -d api` recreates the container and clears it regardless of whether `SIPHER_ADMIN_PASSWORD` changed.
- **API keys** — `ADMIN_API_KEY` rotation requires updating any client that uses the `X-API-Key` header.

## Deployment Flow

```
git push origin main
  → GitHub Actions (.github/workflows/deploy.yml — "Test, Build & Deploy")
  → Test job: typecheck + pnpm test -- --run
  → Build job: build Docker image, push to ghcr.io/sip-protocol/sipher:latest
  → Deploy job: SSH to VPS, docker compose pull + up -d + /api/health probe
```

> The deploy step **does not sync `docker-compose.yml` or `.env`** to the VPS — it only pulls the new image and calls `docker compose up -d` against the VPS-local files. Changes to compose or env must be applied on the VPS manually.

## Rollback

**Roll back to previous image:**

```bash
ssh sip
cd ~/sipher

# Option A: pin a specific SHA tag temporarily
IMAGE_TAG=<previous-sha> docker compose up -d api

# Option B: restore config backups (when a compose or env edit broke things)
cp docker-compose.yml.bak docker-compose.yml
cp .env.bak .env
docker compose up -d api
```

Always back up both `docker-compose.yml` and `.env` before editing — `docker compose up -d` recreates the container from the current on-disk files, so an edit gone wrong can't self-heal.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Compose warning "variable not set" on `up` | `.env` missing a `${VAR}` referenced in compose | Add to `.env`, run `docker compose up -d api` |
| `/api/admin/*` returns 503 `ADMIN_DISABLED` | `ADMIN_API_KEY` empty | Generate + set it |
| JWT login throws 500 "JWT_SECRET must be set and at least 16 chars" | Secret missing or too short | Generate with `openssl rand -hex 32` |
| `SENTINEL_AUTHORITY_KEYPAIR env not set` warning at startup | Keypair path not configured | Set when moving to `yolo` mode; cosmetic in `advisory` |
| Admin password login returns 401 with correct password | `SIPHER_ADMIN_PASSWORD` empty on server | Check `.env`, recreate container |
| Container recreate doesn't apply env changes | Used `restart` instead of `up -d` | Use `docker compose up -d api` (env only reloads on recreate) |

## Related Docs

- [`README.md`](../README.md) — Project overview, endpoint catalog
- [`CLAUDE.md`](../CLAUDE.md) — Architecture, SENTINEL details, active status
- [`SECURITY.md`](../SECURITY.md) — Threat model
- [`HARDENING.md`](../HARDENING.md) — Security audit checklist
- [`docs/superpowers/specs/2026-04-15-sentinel-formalization-design.md`](superpowers/specs/2026-04-15-sentinel-formalization-design.md) — SENTINEL design spec
- [`docs/superpowers/plans/2026-04-15-sentinel-formalization.md`](superpowers/plans/2026-04-15-sentinel-formalization.md) — Implementation plan
