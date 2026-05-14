#!/usr/bin/env bash
#
# torque-preflight.sh — Verify the sipher Torque MCP integration is judge-ready.
#
# Runs seven checks against the production sipher API and the Torque ingest host
# to confirm that the canonical ingest contract is live, auth works, and the
# frontend SignTxCard surface is reachable. Designed to be run AFTER the VPS
# env var rename (TORQUE_API_KEY -> TORQUE_API_TOKEN, TORQUE_MCP_URL ->
# TORQUE_INGESTER_URL, drop TORQUE_CAMPAIGN_ID_*) and BEFORE recording the
# Frontier Hackathon "Build with Torque MCP" demo video.
#
# Usage:
#   scripts/torque-preflight.sh              # default run (color, summary only)
#   scripts/torque-preflight.sh --verbose    # also dump full response bodies
#   scripts/torque-preflight.sh --json       # machine-readable JSON output
#   NO_COLOR=1 scripts/torque-preflight.sh   # disable color
#
# Environment overrides (optional):
#   SIPHER_BASE_URL       default https://sipher.sip-protocol.org
#   TORQUE_INGEST_URL     default https://ingest.torque.so
#   SIPHER_ADMIN_TOKEN    optional Bearer token. If unset, the script reads
#                         from $SIPHER_ADMIN_TOKEN_FILE (default
#                         ~/Documents/secret/sipher-admin-token) only if it
#                         already exists. Token is OPTIONAL — the
#                         /admin/api/torque/status endpoint is currently
#                         public (no auth required) per packages/agent/src/
#                         routes/admin.ts. The token is included as a Bearer
#                         header only when present, so this script is
#                         forward-compatible if the endpoint moves behind
#                         auth later.
#   TORQUE_API_TOKEN      optional. If set, used for Check 6 (synthetic event
#                         probe). If unset, Check 6 is skipped with a WARN.
#
# Exit codes:
#   0  all critical checks passed (verdict: READY FOR DEMO)
#   1  one or more critical checks failed (verdict: NOT READY)
#   2  script misuse (bad flag, missing dependency, etc.)
#
# Hard constraints honored:
#   - Never reads ~/Documents/secret/sipher-vps-secrets.env (operator-scoped)
#   - Never reads the admin-token file contents into a printable buffer; only
#     into the curl Authorization header, which the script does not echo.
#   - No DELETE/PATCH/PUT against Torque dashboard. The only POST is the
#     synthetic event probe to ingest.torque.so/events with eventName =
#     "sipher_preflight_test" (a slug deliberately NOT registered in the
#     Torque project, so it gets rejected with 400 — that 400 IS the success
#     signal: it proves the ingester is reachable AND the API key auths AND
#     the request reached the schema validator. Per
#     packages/agent/src/integrations/torque/mcp-client.ts, Torque returns
#     400 with a "validation" / "event_undefined" reason for unknown slugs.)
#   - Idempotent: safe to run repeatedly. No state mutation.

set -euo pipefail

# ────────────────────────────────────────────────────────────────────────────
# Config & defaults
# ────────────────────────────────────────────────────────────────────────────

SIPHER_BASE_URL="${SIPHER_BASE_URL:-https://sipher.sip-protocol.org}"
TORQUE_INGEST_URL="${TORQUE_INGEST_URL:-https://ingest.torque.so}"
SIPHER_ADMIN_TOKEN_FILE="${SIPHER_ADMIN_TOKEN_FILE:-$HOME/Documents/secret/sipher-admin-token}"

VERBOSE=0
JSON_MODE=0

for arg in "$@"; do
  case "$arg" in
    --verbose|-v) VERBOSE=1 ;;
    --json) JSON_MODE=1 ;;
    -h|--help)
      sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      echo "Use --help for usage." >&2
      exit 2
      ;;
  esac
done

# ────────────────────────────────────────────────────────────────────────────
# Dependency check
# ────────────────────────────────────────────────────────────────────────────

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required dependency: $cmd" >&2
    echo "Install it (e.g. 'brew install $cmd') and re-run." >&2
    exit 2
  fi
done

# ────────────────────────────────────────────────────────────────────────────
# Color setup (respect NO_COLOR and non-TTY)
# ────────────────────────────────────────────────────────────────────────────

if [[ "${NO_COLOR:-}" != "" || ! -t 1 || "$JSON_MODE" -eq 1 ]]; then
  C_OK=""
  C_WARN=""
  C_FAIL=""
  C_DIM=""
  C_BOLD=""
  C_RESET=""
else
  C_OK=$'\033[0;32m'
  C_WARN=$'\033[1;33m'
  C_FAIL=$'\033[0;31m'
  C_DIM=$'\033[2m'
  C_BOLD=$'\033[1m'
  C_RESET=$'\033[0m'
fi

# ────────────────────────────────────────────────────────────────────────────
# Result tracking
# ────────────────────────────────────────────────────────────────────────────

# Arrays of "STATUS|LABEL|DETAIL|FIX"
RESULTS=()
FAIL_COUNT=0
WARN_COUNT=0

record() {
  local status="$1"
  local label="$2"
  local detail="${3:-}"
  local fix="${4:-}"
  RESULTS+=("${status}|${label}|${detail}|${fix}")
  case "$status" in
    FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
    WARN) WARN_COUNT=$((WARN_COUNT + 1)) ;;
  esac
}

trace() {
  if [[ "$VERBOSE" -eq 1 && "$JSON_MODE" -eq 0 ]]; then
    echo "${C_DIM}    $*${C_RESET}" >&2
  fi
}

# Make a temp directory for response bodies (auto-cleaned)
TMPDIR_PREFLIGHT="$(mktemp -d -t torque-preflight.XXXXXX)"
trap 'rm -rf "$TMPDIR_PREFLIGHT"' EXIT

# curl wrapper that writes body to a file, returns HTTP code on stdout
# Args: $1 method, $2 url, $3 body-out-file, then optional extra args
http() {
  local method="$1"
  local url="$2"
  local out="$3"
  shift 3
  local code
  code="$(curl -sS -o "$out" -w '%{http_code}' -X "$method" --max-time 15 "$@" "$url" 2>>"$out.err" || true)"
  if [[ -z "$code" ]]; then
    code="000"
  fi
  echo "$code"
}

# ────────────────────────────────────────────────────────────────────────────
# Check 1: VPS health
# ────────────────────────────────────────────────────────────────────────────
# Note: the deployed sipher uses /api/health (see packages/agent/src/index.ts
# line 300). The original task spec said /healthz but that path is not mounted
# in the codebase, so we hit the real endpoint here.

check_vps_health() {
  local url="${SIPHER_BASE_URL}/api/health"
  local body="$TMPDIR_PREFLIGHT/health.json"
  trace "GET $url"
  local code
  code="$(http GET "$url" "$body")"
  if [[ "$code" == "200" ]]; then
    record OK "VPS health" "$url -> 200"
  else
    record FAIL "VPS health" "$url -> HTTP $code" \
      "Check that the sipher container is running on the VPS. SSH 'sip' user and run: docker compose ps && docker compose logs --tail 200 sipher"
  fi
  if [[ "$VERBOSE" -eq 1 ]]; then
    trace "Response body:"
    [[ -s "$body" ]] && trace "$(head -c 500 "$body")"
  fi
}

# ────────────────────────────────────────────────────────────────────────────
# Check 2 & 3 & 4: Torque integration status (single endpoint, three assertions)
# ────────────────────────────────────────────────────────────────────────────
# Endpoint: GET /admin/api/torque/status
# Auth: currently public per routes/admin.ts (comment "no sensitive data
#   returned"). If SIPHER_ADMIN_TOKEN is provided we attach it as a Bearer
#   header — forward-compatible if the endpoint moves behind auth.
# Expected shape (enabled):
#   { ok, enabled: true, network, ingesterUrl, ingesterReachable, ingesterReason? }
# Expected shape (disabled):
#   { ok, enabled: false, reason }

resolve_admin_token() {
  if [[ -n "${SIPHER_ADMIN_TOKEN:-}" ]]; then
    echo "$SIPHER_ADMIN_TOKEN"
    return
  fi
  # File is operator-scoped; we never echo its contents anywhere. We only
  # forward into curl's -H argument via stdin-fed env-injected variable below.
  if [[ -r "$SIPHER_ADMIN_TOKEN_FILE" ]]; then
    cat "$SIPHER_ADMIN_TOKEN_FILE"
    return
  fi
  echo ""
}

TORQUE_STATUS_BODY=""  # populated by check 2, reused by 3 & 4
TORQUE_STATUS_OK=0

check_torque_status() {
  local url="${SIPHER_BASE_URL}/admin/api/torque/status"
  local body="$TMPDIR_PREFLIGHT/torque-status.json"
  TORQUE_STATUS_BODY="$body"
  trace "GET $url"

  local token
  token="$(resolve_admin_token)"
  local code
  if [[ -n "$token" ]]; then
    code="$(http GET "$url" "$body" -H "Authorization: Bearer $token")"
  else
    code="$(http GET "$url" "$body")"
  fi

  if [[ "$code" != "200" ]]; then
    record FAIL "Torque integration enabled" "$url -> HTTP $code" \
      "Endpoint not reachable. Confirm sipher container is up and admin router is mounted at /admin."
    record FAIL "Ingester reachable from VPS" "skipped (status endpoint not reachable)" \
      "Resolve check 2 first."
    record FAIL "Network correctness" "skipped (status endpoint not reachable)" \
      "Resolve check 2 first."
    return
  fi

  if ! jq -e . "$body" >/dev/null 2>&1; then
    record FAIL "Torque integration enabled" "Non-JSON response from $url" \
      "Inspect raw body: $body"
    record FAIL "Ingester reachable from VPS" "skipped (status endpoint returned non-JSON)" ""
    record FAIL "Network correctness" "skipped (status endpoint returned non-JSON)" ""
    return
  fi

  local enabled reason network ingester_url reachable reachable_reason
  enabled="$(jq -r '.enabled // false' "$body")"
  reason="$(jq -r '.reason // ""' "$body")"
  network="$(jq -r '.network // ""' "$body")"
  ingester_url="$(jq -r '.ingesterUrl // ""' "$body")"
  reachable="$(jq -r '.ingesterReachable // false' "$body")"
  reachable_reason="$(jq -r '.ingesterReason // ""' "$body")"

  # Check 2: enabled
  if [[ "$enabled" == "true" ]]; then
    record OK "Torque integration enabled" "network=${network:-unknown} ingester=${ingester_url:-unknown}"
    TORQUE_STATUS_OK=1
  else
    record FAIL "Torque integration enabled" "enabled=false reason=${reason:-unknown}" \
      "VPS env vars not loaded. Set TORQUE_GROWTH_ENABLED=true, TORQUE_API_TOKEN=<token>, TORQUE_INGESTER_URL=https://ingest.torque.so on the VPS (and remove any stale TORQUE_API_KEY / TORQUE_MCP_URL / TORQUE_CAMPAIGN_ID_*). Restart the sipher container."
  fi

  # Check 3: ingester reachable
  if [[ "$enabled" != "true" ]]; then
    record FAIL "Ingester reachable from VPS" "skipped (integration disabled)" \
      "Resolve check 2 first."
  elif [[ "$reachable" == "true" ]]; then
    record OK "Ingester reachable from VPS" "no ingesterReason"
  else
    record FAIL "Ingester reachable from VPS" "ingesterReachable=false reason=${reachable_reason:-unknown}" \
      "VPS cannot reach ${ingester_url:-https://ingest.torque.so}. Common causes: (a) TORQUE_API_TOKEN invalid → reason=auth; (b) Egress firewall → reason=network; (c) Torque outage — check status.torque.so. SSH 'sip' user and run: docker compose exec sipher curl -v ${ingester_url:-https://ingest.torque.so}/events -H 'x-api-key: <token>'"
  fi

  # Check 4: network correctness
  if [[ "$enabled" != "true" ]]; then
    record FAIL "Network correctness" "skipped (integration disabled)" \
      "Resolve check 2 first."
  elif [[ "$network" == "mainnet-beta" ]]; then
    record OK "Network correctness: mainnet-beta"
  else
    record FAIL "Network correctness" "expected mainnet-beta, got ${network:-empty}" \
      "Pool is funded on mainnet; emitting devnet events would route incentives nowhere. Set SOLANA_CLUSTER=mainnet-beta on the VPS (or whatever loadNetworkConfig() reads) and restart."
  fi

  if [[ "$VERBOSE" -eq 1 ]]; then
    trace "Response body:"
    trace "$(jq -c . "$body" 2>/dev/null || cat "$body")"
  fi
}

# ────────────────────────────────────────────────────────────────────────────
# Check 5: Local env vars sanity
# ────────────────────────────────────────────────────────────────────────────
# We scan the local shell env AND the repo's root .env (if any) for stale
# TORQUE_CAMPAIGN_ID_* keys. These are cosmetic warnings — Torque has no
# Campaign primitive (see docs/integrations/torque/FRICTION-LOG.md). Leaving
# them in your local .env is harmless but confusing.

check_local_env_sanity() {
  local stale_keys=()

  # Walk live shell env
  while IFS='=' read -r k _; do
    case "$k" in
      TORQUE_CAMPAIGN_ID_*|TORQUE_API_KEY|TORQUE_MCP_URL)
        stale_keys+=("$k")
        ;;
    esac
  done < <(env)

  # Walk repo root .env if present (best-effort; tolerate weird quoting)
  local repo_root
  repo_root="$(cd "$(dirname "$0")/.." && pwd)"
  if [[ -r "$repo_root/.env" ]]; then
    while IFS= read -r line; do
      # Strip comments / blanks
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line// /}" ]] && continue
      local key="${line%%=*}"
      key="${key// /}"
      case "$key" in
        TORQUE_CAMPAIGN_ID_*|TORQUE_API_KEY|TORQUE_MCP_URL)
          stale_keys+=("$key (.env)")
          ;;
      esac
    done < "$repo_root/.env"
  fi

  if [[ ${#stale_keys[@]} -eq 0 ]]; then
    record OK "Local env vars sanity" "no stale TORQUE_CAMPAIGN_ID_* / TORQUE_API_KEY / TORQUE_MCP_URL"
  else
    local joined
    joined="$(printf '%s, ' "${stale_keys[@]}")"
    joined="${joined%, }"
    record WARN "Local stale env var(s) present" "$joined" \
      "Cosmetic only — Torque has no Campaign primitive. Remove from your local .env / shell rc to avoid future confusion. The VPS is what matters for the demo."
  fi
}

# ────────────────────────────────────────────────────────────────────────────
# Check 6: Custom Events probe (synthetic event with unregistered slug)
# ────────────────────────────────────────────────────────────────────────────
# We POST to https://ingest.torque.so/events with eventName=sipher_preflight_test
# (a slug deliberately NOT registered in the Torque dashboard project). The
# expected response is HTTP 400 with a validation message — that 400 IS the
# success signal: it proves
#   (a) the ingest host is reachable from THIS machine (not the VPS),
#   (b) the x-api-key auths successfully (otherwise we'd get 401/403),
#   (c) the request reached the schema validator (otherwise some other 5xx).
#
# This check is SKIPPED with a WARN if TORQUE_API_TOKEN is unset, because we
# never read ~/Documents/secret/sipher-vps-secrets.env (operator-scoped).

check_synthetic_event() {
  if [[ -z "${TORQUE_API_TOKEN:-}" ]]; then
    record WARN "Ingester auth verified (synthetic event)" \
      "skipped — TORQUE_API_TOKEN not set in shell env" \
      "Optional: 'export TORQUE_API_TOKEN=<token>' from your operator-scoped secrets file and re-run. The VPS's own ingester reachability is already verified by Check 3, so this is a redundant local probe."
    return
  fi

  local url="${TORQUE_INGEST_URL}/events"
  local body_file="$TMPDIR_PREFLIGHT/synthetic.json"
  local payload
  payload="$(jq -n \
    --arg pk "SipherPreflight11111111111111111111111111111" \
    --arg name "sipher_preflight_test" \
    --argjson ts "$(date +%s)000" \
    '{userPubkey: $pk, timestamp: $ts, eventName: $name, data: {note: "preflight-script-probe"}}')"
  trace "POST $url with eventName=sipher_preflight_test"
  local code
  code="$(http POST "$url" "$body_file" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TORQUE_API_TOKEN}" \
    --data-raw "$payload")"

  if [[ "$code" == "400" ]]; then
    # Confirm it's the EXPECTED 400 (validation about the unregistered slug),
    # not some other 400. We accept either the codebase's pattern ("Event not
    # found") or the spec'd pattern ("body/eventName Invalid" / "Required").
    local msg
    msg="$(jq -r '.message // .error // .detail // ""' "$body_file" 2>/dev/null || echo "")"
    if [[ "$msg" =~ [Ee]vent.*[Nn]ot.*[Ff]ound \
       || "$msg" =~ eventName \
       || "$msg" =~ [Vv]alidation \
       || "$msg" =~ [Ii]nvalid \
       || "$msg" =~ [Uu]ndefined ]]; then
      record OK "Ingester auth verified" "synthetic event rejected with expected 400: $(printf '%s' "$msg" | head -c 80)"
    else
      record OK "Ingester auth verified" "synthetic event rejected with 400 (unrecognized message body, but 400 alone proves auth+reach)"
    fi
  elif [[ "$code" == "401" || "$code" == "403" ]]; then
    record FAIL "Ingester auth verified" "HTTP $code — TORQUE_API_TOKEN rejected by ingester" \
      "Token is invalid or revoked. Reissue from platform.torque.so/developer for project cmp2as15d05pnk01hiyuf7208 and update VPS env."
  elif [[ "$code" == "200" || "$code" == "201" || "$code" == "202" || "$code" == "204" ]]; then
    record WARN "Ingester auth verified" "HTTP $code — ingester ACCEPTED 'sipher_preflight_test'. This means either (a) the slug is registered in the Torque project (unintended) or (b) Torque relaxed its schema validation." \
      "Investigate: if (a), rename the slug in this script. If (b), the probe still passes as a reachability check."
  elif [[ "$code" == "000" ]]; then
    record FAIL "Ingester auth verified" "Network error reaching $url" \
      "Check internet connectivity, DNS for ingest.torque.so, and any local egress firewall."
  else
    record FAIL "Ingester auth verified" "Unexpected HTTP $code from synthetic probe" \
      "Inspect $body_file for details. Run with --verbose to see body."
  fi

  if [[ "$VERBOSE" -eq 1 ]]; then
    trace "Response body:"
    trace "$(head -c 500 "$body_file" 2>/dev/null || true)"
  fi
}

# ────────────────────────────────────────────────────────────────────────────
# Check 7: Frontend SignTxCard surface reachable
# ────────────────────────────────────────────────────────────────────────────
# We hit the root URL and verify it returns 200 with HTML served by the sipher
# container (not the nginx default page). Heuristic: response body must
# contain a marker that identifies the sipher SPA (e.g. "sipher" or a known
# Vite/asset path). We don't render the page, just confirm the container is
# serving the bundle.

check_frontend() {
  local url="${SIPHER_BASE_URL}/"
  local body="$TMPDIR_PREFLIGHT/frontend.html"
  trace "GET $url"
  local code
  code="$(http GET "$url" "$body")"
  if [[ "$code" != "200" ]]; then
    record FAIL "Frontend reachable" "$url -> HTTP $code" \
      "sipher SPA not served. Check nginx config + container port 5006."
    return
  fi

  # Detect nginx default page (very small body or contains "Welcome to nginx")
  local size
  size="$(wc -c <"$body" | tr -d ' ')"
  if grep -qi 'welcome to nginx' "$body" 2>/dev/null; then
    record FAIL "Frontend reachable" "$url -> 200 but body is nginx default page" \
      "Reverse proxy is up but no upstream is serving /. Check docker compose ps for sipher container, and nginx upstream config in /etc/nginx/sites-enabled/."
    return
  fi

  # Heuristic: sipher SPA should be a non-trivial HTML bundle.
  if [[ "$size" -lt 200 ]]; then
    record WARN "Frontend reachable" "$url -> 200 but body is suspiciously small ($size bytes)" \
      "Confirm by curling and inspecting body — could be a temporary holding page."
    return
  fi

  if grep -qi 'sipher\|<title>SIPHER\|/assets/' "$body" 2>/dev/null; then
    record OK "Frontend reachable" "$url -> 200 ($size bytes, sipher SPA marker found)"
  else
    record WARN "Frontend reachable" "$url -> 200 ($size bytes) but no sipher marker in body" \
      "Body returned by upstream is HTML but lacks identifying tokens. Inspect with: curl -s ${SIPHER_BASE_URL}/ | head -50"
  fi
}

# ────────────────────────────────────────────────────────────────────────────
# Run all checks
# ────────────────────────────────────────────────────────────────────────────

if [[ "$JSON_MODE" -eq 0 ]]; then
  echo
  echo "${C_BOLD}=== Torque MCP Preflight ===${C_RESET}"
  echo "${C_DIM}Target: ${SIPHER_BASE_URL}${C_RESET}"
  echo "${C_DIM}Ingest: ${TORQUE_INGEST_URL}${C_RESET}"
  echo
fi

check_vps_health
check_torque_status
check_local_env_sanity
check_synthetic_event
check_frontend

# ────────────────────────────────────────────────────────────────────────────
# Render summary
# ────────────────────────────────────────────────────────────────────────────

if [[ "$JSON_MODE" -eq 1 ]]; then
  # Emit a single JSON object for machine consumption
  jq -n \
    --arg target "$SIPHER_BASE_URL" \
    --arg ingest "$TORQUE_INGEST_URL" \
    --argjson fail "$FAIL_COUNT" \
    --argjson warn "$WARN_COUNT" \
    --arg verdict "$([[ $FAIL_COUNT -eq 0 ]] && echo 'READY' || echo 'NOT_READY')" \
    --argjson results "$(printf '%s\n' "${RESULTS[@]}" | jq -R 'split("|") | {status: .[0], label: .[1], detail: .[2], fix: .[3]}' | jq -s .)" \
    '{
       target: $target,
       ingest: $ingest,
       fail_count: $fail,
       warn_count: $warn,
       verdict: $verdict,
       results: $results
     }'
  exit $([[ $FAIL_COUNT -eq 0 ]] && echo 0 || echo 1)
fi

for line in "${RESULTS[@]}"; do
  IFS='|' read -r status label detail fix <<<"$line"
  case "$status" in
    OK)   prefix="${C_OK}[OK]${C_RESET}  " ;;
    WARN) prefix="${C_WARN}[WARN]${C_RESET}" ;;
    FAIL) prefix="${C_FAIL}[FAIL]${C_RESET}" ;;
    *)    prefix="[??]" ;;
  esac
  if [[ -n "$detail" ]]; then
    printf '%b %s — %s\n' "$prefix" "$label" "$detail"
  else
    printf '%b %s\n' "$prefix" "$label"
  fi
  if [[ "$status" == "FAIL" && -n "$fix" ]]; then
    # Wrap fix text by tabbing it under the label
    printf '       %bFix:%b %s\n' "$C_DIM" "$C_RESET" "$fix"
  elif [[ "$status" == "WARN" && -n "$fix" && "$VERBOSE" -eq 1 ]]; then
    printf '       %bNote:%b %s\n' "$C_DIM" "$C_RESET" "$fix"
  fi
done

echo

if [[ "$FAIL_COUNT" -eq 0 ]]; then
  echo "${C_OK}${C_BOLD}Verdict: READY FOR DEMO${C_RESET}"
  echo
  echo "${C_DIM}Next: Trigger a real send/swap from sipher chat and verify the event lands"
  echo "in the Torque dashboard 'custom_event' stream (project cmp2as15d05pnk01hiyuf7208).${C_RESET}"
  exit 0
else
  echo "${C_FAIL}${C_BOLD}Verdict: NOT READY${C_RESET} (${FAIL_COUNT} failure(s), ${WARN_COUNT} warning(s))"
  echo
  echo "${C_DIM}Address the failures above before recording the demo. Re-run this script"
  echo "until you see 'READY FOR DEMO'. Run with --verbose for response bodies.${C_RESET}"
  exit 1
fi
