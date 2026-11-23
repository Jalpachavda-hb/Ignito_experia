# 027 — Implementation and audit report

**Audience:** developers and reviewers of Ignito Experia (VLab).
**Date:** 2026-11-23.
**Branch:** `jalpa`. Everything is uncommitted and not deployed.

---

## 1. Scope and safety

| Check | Result |
|---|---|
| Repository and branch | `Ignito_experia`, branch `jalpa` (HEAD `8217b61`). The working tree was clean before starting. |
| Database engine | MySQL only: `ignito_experia` (student) and `ignito_experia_owner` (owner, lab catalog). |
| PostgreSQL work | Not touched: `feat/postgres-prisma`, `stash@{0}` (`00ce0ac…`) and `stash@{1}` (`cb524d6…`) are unchanged. No PostgreSQL connection was opened. |
| Real databases | No write and no DDL against `ignito_experia` or `ignito_experia_owner`. Reads were limited to `SELECT`, `SHOW CREATE TABLE` and `EXPLAIN`. |
| Tests | Isolated schemas `vlab_access_test` and `vlab_session_test`. Tables are copied with `SHOW CREATE TABLE`, the session runs in **strict** SQL mode like live MySQL 8, and a guard refuses any schema not named `vlab_*_test`. |
| Backends started | None. The startup DDL in `lib/mysql.js` was never run. |
| Deploy, push, commit | None. |

---

## 2. Findings and what was done

The first six are the known issues. Each was confirmed in the `jalpa` code and then fixed and tested.

| # | Finding (evidence) | Severity | Status |
|---|---|---|---|
| 1 | **Tenant spoofing.** `lib/jwt.js` took the tenant from the `x-tenant-id` header when the token had none. `handlers/users.js` also accepted the header and `?tenantId=`. `handlers/sessions.js` accepted `body.tenantId`. | High | Fixed. The tenant comes only from signed claims, then the user's own `Users` / `user_tenant_mapping` row (`lib/studentTenant.js`). |
| 2 | **SSO accepted any token.** `SsoService.js` fell back to `"default_lms_secret"`, and when verification failed it decoded the token without checking the signature. Expired tokens were also accepted. | Critical | Fixed (`lib/lmsSsoVerifier.js`). Tokens are accepted only via HS* with `LMS_JWT_SECRET`, or RS*/ES* checked against the trusted issuer's JWKS. Expired, forged and `alg=none` tokens are rejected. |
| 2b | **SSO account takeover.** `studentId` / `studentDegreeAdmissionId` in the request body overrode the token's claims, and the account was matched by the LMS profile email of that id. | Critical | Fixed. Token ids win; contradicting body ids get a 401. The signed (tenant, provider, subject) link is checked before email. |
| 3 | **Settlement always rolled back.** `UPDATE lab_sessions … StudentId = ?` refers to a column that doesn't exist (`ER_BAD_FIELD_ERROR`, reproduced in tests). On strict MySQL 8, `token_orders.Status` writes (`PENDING_PAYMENT`, `TOKEN_CREDITED`) and missing legacy NOT NULL item columns fail too. | Critical | Fixed. Settlement uses `UserId`. `TokenOrderRepository` reads the real ENUM and columns and writes only values the database accepts. |
| 4 | **Billing before READY.** The billing worker promoted STARTING to RUNNING after 40 s without checking readiness. The status poll started billing when ECS reported healthy, before the workspace bootstrap finished. `extendSession` also forced RUNNING. | High | Fixed (`services/sessionReadiness.js`). RUNNING and billing start only when bootstrap is `READY`, through a conditional update. `FAILED` closes the session unbilled and stops the task. |
| 5 | **Blocking password hashing.** `pbkdf2Sync` and `bcrypt.compareSync` ran on every login. `utils/crypto.js` also hashed new passwords with only 1,000 iterations. | Medium | Fixed. Async `crypto.pbkdf2` and `bcrypt.compare`. The stored format is unchanged and all three existing formats still verify. New hashes use 100,000 iterations. |
| 6 | **Razorpay verify trusted the browser.** The browser chose the amount (`create-order`) and the credits (`verify`), so a ₹1 payment could grant any number of tokens. `userEmail` / `tenantId` in the body could credit another account. | Critical | Fixed (`services/LabTokenCheckoutService.js`). The server prices from `labs.BaseTokenPrice`, stores the order, and settles only the caller's own order after signature, capture and amount checks. Crediting happens exactly once. |
| 7 | `POST /credits/purchase` added any number of credits with no payment. | Critical | Closed (403). The frontend doesn't use it; admins still grant credits through `/users/:id/credits`. |
| 8 | The webhook never settled: it passed `gatewayOrderId`, which `settleOrder` ignored, and compared the webhook signature against the checkout secret. | High | Fixed. Raw-body HMAC with `RAZORPAY_WEBHOOK_SECRET`; settlement is idempotent with `/verify`. |
| 9 | Lab start gave any LMS student a token wallet for **any** lab, sized by `practicalCredit` from the request body. | High | Fixed. Course credit is given only for labs the backend confirms as university-assigned, using the mapping's credit. |
| 10 | Lab start created placeholder `Users` rows (fake email/name) when the account wasn't found. | Medium | Fixed. Such requests now get a 401. |
| 11 | `GET /api/health/database` (no auth; CI calls it on every deploy) ran the startup DDL, including `ALTER TABLE Users DROP COLUMN …`. | High | Fixed. It now runs a read-only `SELECT 1`. |
| 12 | **Live domain broke tenant detection.** `slugFromHost("ignitoexperia.com")` returned the slug `"ignitoexperia"`, so the main site was treated as an unknown university. | High (live) | Fixed. Apex-aware parsing with `BASE_DOMAIN` (default `ignitoexperia.com`); the old domain still works. |
| 13 | `JWT_SECRET` fell back to a hard-coded value. | High | Production now uses a random per-process secret if it's unset (no forgery possible; sessions end on restart). Set `JWT_SECRET`. |
| 14 | The owner admin build failed (`tsc -b`) because of an unused stray `src/hooks/use-lab-heartbeat.ts` importing a missing module. It would abort a CI deploy. | High (deploy) | Removed the file; the student app has its own working copy. |

Found but **not changed** (each needs a decision):

- **`INTERNAL_SERVICE_TOKEN` has a hard-coded default** (`config/env.js`). The owner and student backends use it to call each other, so changing it requires both servers' `.env` files to be updated together.
- **`/internal/owner/students` and `/internal/tenants/:id`** are guarded only by that token.
- **`UserService.createUser` defaults the password to `"password123"`** when an admin leaves it empty.
- **The SSO replay store records tokens but never rejects a reused one.**
- **Roles `SUPER_ADMIN` / `ADMIN` are still referenced in `handlers/users.js`**, although VLab only has `TENANT_ADMIN` and `STUDENT`.

---

## 3. Architecture as built

### University-assigned labs

1. The student's LMS programmes come from the LMS profile plus `GetStudentPurchasedProgrammeSemesterList`.
2. Each programme's course catalogue is loaded.
3. The course codes are matched against `course_lab_mappings`, where `tenant_id` is the student's TenantId or `'PLATFORM'`, and `status = 'active'`.
4. The matching labs are read from `ignito_experia_owner.labs`.

Decision: **`PLATFORM` rows count as university-assigned**, because they map a course the student is enrolled in, and the existing code already treated them that way. Only real mapping rows count. The keyword-guessing fallback in `LmsCourseLabService.attach` is **not** used for access.

### Purchased labs

A lab counts as purchased when the student has `student_lab_token_transactions` rows with `TransactionType = 'PURCHASE'`. Balances come from `student_lab_token_wallets`.

### Unified access

`services/StudentLabAccessService.js` serves `GET /api/student/labs/access`. It returns one entry per lab with:

- `accessSource`: `university`, `purchased`, `both` or `granted` (a wallet with no purchase or course, e.g. tokens provisioned at SSO);
- the lab-specific token balance;
- `canLaunch` and `needsTokens`.

Deleted labs never appear. Inactive labs appear only if the student already has access, and are marked not launchable. The same service decides course credit at lab start. Results are cached per student for 60 s and the cache is cleared after a purchase or profile refresh.

### Profile hydration (SSO and direct login)

- **SSO:** `SsoService` calls `lmsProfileCacheService.getOrFetchProfile`.
- **Direct login:** the sign-in form calls `/auth/me`, which calls the same service.

Both use the same Redis key, `lms:profile:{TenantId}:{Provider}:{ExternalStudentId}`, with `REDIS_LMS_PROFILE_TTL`. Setting a password only writes `PasswordHash` and changes `AuthType` from `LMS` to `LMS_AND_DIRECT`; the LMS identity link stays.

### LMS failure handling

A forced refresh no longer deletes the cache first. If the LMS fails, the last valid profile is returned (`cacheStatus: CACHE_FALLBACK`). Nothing is fabricated and nothing is overwritten with empty values.

---

## 4. Performance changes

| Area | Change |
|---|---|
| Login | Password check moved off the event loop (async PBKDF2 / bcrypt). |
| `/auth/me` | LMS profile + purchased programmes run in parallel; semester enrichment + practical list run in parallel; enrichment of several programmes runs in parallel. |
| Redis down | `getRedis()` waits 30 s before retrying instead of a 2 s connect timeout on every cache call. |
| Lab catalog (`/labs`) | 30 s shared cache for the student-independent catalog. Each caller gets a copy, so nothing a caller changes leaks into the cache. |
| Semester labs | One cached catalog read instead of one `labs` query per course. |
| Order history | One items query per page instead of one per order (N+1 removed). |
| SSO login | Course-credit wallets written with one multi-row upsert instead of one per mapping. |
| File list | Concurrent requests per session share one container/SSM call. A 20 s budget (`FILES_LIST_TIMEOUT_MS`): on overrun the request returns the cached tree marked `stale`, or a retryable 503, while the listing finishes in the background. A real failure is an error, never an empty folder. The frontend dedupes requests, times out after 30 s, shows "Loading…/error + Retry" and retries 503/504 with backoff. |
| All routes | Structured timing log `{"type":"api",requestId,method,route,status,ms}` for slow (>1 s, `PERF_LOG_SLOW_MS`) and 5xx responses, or for every request with `PERF_LOG=1`. Adds `X-Request-Id` and `Server-Timing` headers. Logs the route template only: no bodies, tokens or personal data. |

### Measurements

Local Windows machine. Each row says what was measured.

| What | Before | After | How measured |
|---|---|---|---|
| Event loop blocked during 8 concurrent logins | 619–780 ms total (worst stall 80–135 ms) | 189–231 ms total (worst 38–45 ms) | Unit test; old code copied verbatim; 4 runs |
| `/labs` catalog | 102 ms each call (owner API down → DB) | 102 ms cold, **0.13–0.17 ms** warm | Direct call, local MariaDB, 14 labs |
| Order history, 3 orders | 1 + N queries (4) | 2 queries | Query counter in integration test |
| File list of 5,000 entries (handler only) | — | 7.7 ms | Unit test, container mocked |
| Hung runtime on file list | Stays pending (SSM timeout up to 360 s × retries) | Answers in ≤ `FILES_LIST_TIMEOUT_MS` (test: 300 ms → 346 ms) | Unit test |

**Not measured (blockers):** SSO login time, LMS API time, dashboard load, real lab start (click → READY), ECS allocation, runtime connection, file open/save against a real container.

- There is no ECS cluster locally (`ECS_CLUSTER` empty, so sessions are mocked).
- Calling the production LMS needs a real test student and your approval.
- There is no staging environment.

No simulated timing is reported as ECS performance. To measure on live after deploy, set `PERF_LOG=1` for a short window and read the JSON lines, and use the ECS task timestamps described in `docs/lab-startup-optimization.md` §1.

---

## 5. Tests

Run with `cd backend && npm test` (unit) and `npm run test:integration` (needs local MariaDB; creates only `vlab_*_test` schemas).

| Suite | Result |
|---|---|
| Unit (`test/unit`, plus the existing `lib/workspacePath.test.js`) | **55 / 55 passed** |
| Integration (`test/integration`, strict SQL mode) | **21 / 21 passed** |
| `vlab_admin` `tsc --noEmit` | 0 errors |
| `vlab_admin` production build | OK |
| Owner admin production build | OK (after removing the stray hook) |
| ESLint, changed frontend files | No new errors; counts equal to HEAD (those files already had `any` errors) |

What the tests cover:

- **Domain parsing:** new and legacy domains, localhost.
- **Passwords:** all three stored formats still verify; the event loop is no longer blocked.
- **SSO verification:** HS256 accepted; forged, expired, `alg=none`, untrusted-issuer, wrong-key and no-secret tokens rejected; JWKS outage returns 503.
- **Tenant handling:** the header is ignored, resolution order is correct, lookups are cached per request.
- **Lab access merge:** union without duplicates, inactive and deleted labs, lab-specific tokens, `granted` label.
- **Pricing and order status:** cart pricing and validation; ENUM mapping for all three schema variants.
- **LMS cache:** cache hit, miss, expiry, single-flight, failure fallback, and no fabrication when nothing is cached.
- **Readiness:** pending, READY, FAILED (with task stop), and idempotent promotion.
- **Webhook signature check.**
- **File list:** empty, failure → 503, stale cache, hung runtime, dedupe, large list.
- **Integration (strict mode):**
  - the old settlement SQL fails, confirming the root cause;
  - orders are accepted in strict mode;
  - another student can't settle an order; forged signature and wrong amount are rejected;
  - crediting happens exactly once, with the running session's low-token flag reset;
  - the webhook accepts a valid HMAC, rejects a bad one, and handles duplicates;
  - the free-credit route is closed;
  - lab access: union, tenant isolation, no exposure without a source, direct student, purchase visible without re-login;
  - STARTING is never billed; order history has no N+1;
  - lab start can't self-grant tokens, ignores the body tenant, and refuses unknown accounts;
  - SSO rejects mismatched ids and forged tokens.

**Not tested, and why:**

- Real lab runtimes (Android, Java, Python, Linux, Jupyter, Code Server, Terminal, SSM, Monaco on a live container) and real ECS start/stop/retry need an ECS cluster. The ECS and runtime code paths were not changed except the readiness/billing gate.
- The live LMS API (`GetStudentPurchasedProgrammeSemesterList`) needs a real student. The university-course step is stubbed only in tests.
- A real Razorpay payment; the Razorpay HTTP API is answered in-process in tests.

---

## 6. Database

- **No schema change was applied.**
- Proposed, **not applied**: `backend/database/027_proposed_lab_access_payment_indexes.sql`. It adds indexes for `token_orders.RazorpayOrderId`, `student_lab_token_transactions(StudentId, TransactionType, LabId)` and `course_lab_mappings(course_code, status, tenant_id)`, each a full scan today according to `EXPLAIN`. It also contains an optional, commented-out `token_orders.Status` ENUM alignment. Rollback is included. Needs approval.
- Data to check on live: `SELECT Id FROM token_orders WHERE Status = ''`. Local has one such row, written by non-strict MariaDB.

---

## 7. Go-live checklist for `https://ignitoexperia.com`

Server `.env` files and GitHub secrets aren't in the repo; set them before deploying.

| Where | Setting |
|---|---|
| GitHub secret `APP_URL` | `https://ignitoexperia.com`. If the secret still holds the old domain, it overrides the new CI default. |
| `backend/.env` | `BASE_DOMAIN=ignitoexperia.com`; `API_PUBLIC_URL=https://ignitoexperia.com/api`; `FRONTEND_URL=https://ignitoexperia.com`; `CORS_ORIGIN` including the new origin(s). |
| `backend/.env` | `JWT_SECRET` (strong, unique). |
| `backend/.env` | **LMS SSO** (strict by default): `LMS_JWT_SECRET` if the LMS signs HS256, and/or `LMS_SSO_ISSUERS` (default `https://<LMS_AUTH0_DOMAIN>/`) for RS256. Optional `LMS_SSO_AUDIENCE`. **Without a matching setting, SSO sign-in is refused** (401/503). Confirm the token format with the LMS team. `LMS_SSO_VERIFICATION=legacy-insecure` exists only as a logged emergency switch. |
| `backend/.env` | `RAZORPAY_WEBHOOK_SECRET`, and a Razorpay Dashboard webhook pointing at `https://ignitoexperia.com/api/token-orders/webhook` (`payment.captured`). Without it the webhook returns 503 and `/verify` still settles. |
| Both backends | `INTERNAL_SERVICE_TOKEN`, the same value on both. |
| Owner backend `.env` | `BASE_DOMAIN=ignitoexperia.com` (university subdomain links). |
| nginx + TLS | `server_name ignitoexperia.com www.ignitoexperia.com *.ignitoexperia.com`; a wildcard certificate for university subdomains; `/api` → :8080, `/owner-api` → owner backend, `/owner/` → owner admin `dist`. |
| DNS | Apex and `*.ignitoexperia.com` to the EC2 host. |
| Frontend | Nothing needed. Both apps now use same-origin `/api` and `/owner-api` on any non-local host. `VITE_BASE_DOMAIN` is optional. |

---

## 8. Remaining work and blockers

1. Run the real measurements and regression tests on infrastructure with ECS and the LMS (there is no staging environment).
2. Confirm the LMS SSO token contract (issuer, algorithm, claims), so strict verification matches what the LMS sends.
3. Approve, or reject, SQL 027.
4. Decide on the "not changed" items in §2.
5. Lab startup itself: warm pool sizes (`WARM_POOL_ENABLED`, `WARM_POOL_SIZES_JSON`) and image sizes are the main levers (see `docs/lab-startup-optimization.md`). They were left unchanged because they need ECS cost decisions.
6. A full audit of the owner backend's API performance was not done in this pass; only its domain handling changed.
7. `vlab_admin` My Labs still contains the old client-side merge, used only as a fallback when `/student/labs/access` fails. It can be deleted once the endpoint has run on live.
