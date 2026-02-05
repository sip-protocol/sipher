# Sipher API Hardening — Security & Production Readiness

**Audit Date:** 2026-02-05
**Deadline:** Feb 12 (Colosseum Hackathon)
**Focus:** Critical gaps that could affect judge evaluation or agent safety

---

## Current Status

| Category | Grade | Notes |
|----------|-------|-------|
| Input Validation | A | ✅ Zod on all routes |
| Error Handling | A- | ✅ Sanitized, no stack traces |
| Idempotency | A | ✅ UUID + LRU cache |
| OpenAPI Docs | A | ✅ Complete |
| Graceful Shutdown | A | ✅ Production-grade |
| Audit Logging | B | 🟡 Good, minor gaps |
| Rate Limiting | D | ⚠️ No tiers |
| Security Headers | D | ⚠️ CORS permissive |
| API Key Mgmt | D | 🔴 No rotation |
| Request Timeouts | F | 🔴 Missing |
| Proofs/CSPL | D | 🔴 Mock stubs |

---

## P0 — Critical (Must Fix Before Feb 12)

### [x] H-01: Request Timeouts ✅
**Problem:** Solana RPC calls can hang indefinitely, exhausting resources.
**Solution:** Add per-endpoint timeouts (15-60s depending on operation).
**Effort:** 2-3 hours
**Files:** `src/middleware/timeout.ts` (new), `src/server.ts`
**Completed:** 2026-02-05

### [x] H-02: Dry-Run for Transfer/Claim ✅
**Problem:** `/transfer/claim` executes immediately with no preview.
**Solution:** Add `dryRun: true` flag to simulate without signing.
**Effort:** 4-6 hours
**Files:** `src/routes/transfer.ts`
**Completed:** 2026-02-05

### [ ] H-03: Document Proofs/CSPL as Beta
**Problem:** Endpoints return mock data; agents may think they're real.
**Solution:** Add `x-beta: true` header + update OpenAPI descriptions.
**Effort:** 1 hour
**Files:** `src/routes/proofs.ts`, `src/routes/cspl.ts`, `openapi.yaml`

---

## P1 — High Priority (Should Fix)

### [ ] H-04: Tiered Rate Limiting
**Problem:** All endpoints share 100 req/60s; heavy ops can starve others.
**Solution:** Per-endpoint limits (claim: 2/min, proofs: 3/min, etc).
**Effort:** 4-6 hours
**Files:** `src/middleware/rate-limit.ts`

### [ ] H-05: CORS Hardening
**Problem:** Dev origins (localhost:*) allowed in production.
**Solution:** Strict allowlist for production, reject credentials on broad origins.
**Effort:** 1 hour
**Files:** `src/middleware/cors.ts`

### [ ] H-06: CSP Headers
**Problem:** No Content-Security-Policy; possible XSS via error responses.
**Solution:** Add `default-src 'self'` via helmet config.
**Effort:** 30 min
**Files:** `src/server.ts`

---

## P2 — Medium Priority (Nice to Have)

### [ ] H-07: API Key Rotation/Expiry
**Problem:** Keys live indefinitely; no revocation mechanism.
**Solution:** Add expiry field, rotation endpoint, scoped permissions.
**Effort:** 1-2 days
**Files:** `src/middleware/auth.ts`, `src/routes/keys.ts` (new)

### [ ] H-08: Batch Operation Timeouts
**Problem:** `/stealth/generate/batch` processes 100 items with no timeout.
**Solution:** Per-item timeout or async processing.
**Effort:** 2-3 hours
**Files:** `src/routes/stealth.ts`

### [ ] H-09: Redis for Rate Limiting
**Problem:** In-memory rate limiter doesn't scale across replicas.
**Solution:** Redis-backed rate limiting.
**Effort:** 4-6 hours
**Files:** `src/middleware/rate-limit.ts`, `src/services/redis.ts` (new)

---

## Completed

| ID | Task | Date | Notes |
|----|------|------|-------|
| H-01 | Request Timeouts | 2026-02-05 | Per-endpoint timeouts (5-90s) |
| H-02 | Dry-Run for Claim | 2026-02-05 | `dryRun: true` simulates TX |

---

## Integration Opportunities

### MURKL (GitHub #39)
- **Status:** Active discussion
- **Value:** Real STARK range proofs (balance >= threshold)
- **Action:** Share Pedersen format, propose `/proofs/range/generate` wrapper
- **Impact:** Solves "proofs are mock" problem

### ORDO
- **Status:** Reaching out
- **Value:** Potential integration partner + voter
- **Action:** Point to skill.md, offer support

---

**Last Updated:** 2026-02-05
