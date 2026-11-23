# 031 — Production deployment readiness: Ignito Experia (`https://ignitoexperia.com`)

| | |
|---|---|
| Date | 2026-11-23 |
| Branch inspected | `jalpa` (working tree with uncommitted changes from audit 027) |
| Compared against | `main` (the only branch CI deploys) |
| Scope | Read-only audit. Nothing was deployed. No SQL was run. No secrets, DNS, nginx or GitHub settings were changed. |
| Secret values | Not printed anywhere in this document. Only variable **names** and whether they are present. |

## 0. Verdict

**NO-GO, for now.** The application code is in much better shape than before audit 027, and its unit and integration tests pass. But four things currently stand between it and a safe production release:

1. **The work is not on the branch that deploys.** CI deploys only `main`. The fixes exist only as uncommitted changes on `jalpa`, and `main` is 6 commits ahead of `jalpa`. 8 of the changed files were also changed on `main`, so the work has to be committed, merged, conflict-resolved and re-tested before it can ship (§1.1).
2. **LMS SSO will refuse every login until the LMS team provides the signing details.** This is intentional: tokens are now verified. Without the LMS issuer/secret configured, SSO fails safely with a 503 or 401 (§2).
3. **The backend changes the database schema on every start.** This includes dropping columns from `Users`. Live already runs this code (it is on `main`), but every deploy restarts the backend. A verified backup and a check of the live schema are required first (§1.2).
4. **CORS allows any website to make credentialed calls to the API** (§6.1). This is not caused by the 027 changes, but it should be fixed before go-live.

Once these four are cleared, and the configuration in §3–§5 is in place, a **staged go-live** is reasonable. The prerequisites are listed in order in §9.

---

## 1. Release blockers found in the repository

### 1.1 Branch state: the fixes are not deployable yet

| Fact | Evidence |
|---|---|
| CI deploys only `main` | `.github/workflows/ci.yml`: `on: push: branches: [main]`, and the deploy step runs `git reset --hard origin/main` |
| `main` is ahead of `jalpa` | `git rev-list --count jalpa..main` = **6**, `main..jalpa` = **0** |
| All 027 work is uncommitted on `jalpa` | `git status` shows about 50 modified or new files |
| Files changed on both sides (merge conflicts likely) | `backend/handlers/razorpayPayment.js`, `backend/handlers/sessions.js`, `backend/handlers/studentTokens.js`, `backend/lib/redisClient.js`, `backend/services/labService.js`, `backend/services/lms/LmsSemesterService.js`, `vlab_admin/src/Utils/razorpayHandler.ts`, `vlab_admin/src/pages/student/my-labs/index.tsx` |

The 6 commits on `main` that `jalpa` does not have:

```
0eb3cf9 fix(tokens): reconcile purchased lab tokens across wallet, summary, and session start
faa8c19 fix(dashboard): add missing labService for use-lab-heartbeat
7fce0ac Merge branch 'jalpa' from origin into main
b848e6e chore: update route tree
1189bc1 feat: introduce canonical lab key utility for consistent lab identification ...
1402b7e feat: add practical available programs endpoint and enhance LMS context handling ...
```

Notes for the merge:
- `faa8c19` fixes the owner-admin build break by **adding** the missing `labService`. Audit 027 fixed the same break by **deleting** the unused `use-lab-heartbeat.ts`. Choose one approach; don't keep both.
- `1189bc1` adds its own canonical lab key utility. Audit 027 also has `canonicalLabKey` (in `StudentLabAccessService` and `LabTokenCheckoutService`). These must produce the same keys, or wallets will not match labs.
- `0eb3cf9` changes token reconciliation in `sessions.js` and `studentTokens.js`, the same code paths as the 027 lab-start access fix.
- After merging, re-run `npm test`, `npm run test:integration`, `vlab_admin` `tsc` and build, and the owner-admin build.

### 1.2 Startup schema changes (DDL) on every backend restart

`backend/lib/mysql.js` → `verifyDbConnection()` runs on every start (`index.js`). It:
- runs `CREATE DATABASE IF NOT EXISTS`, plus many `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE … ADD/MODIFY` statements;
- runs **`tightenUsersTable()`**, which executes `ALTER TABLE Users DROP COLUMN …` for every column in `USERS_COLUMNS_TO_DROP` that still exists;
- modifies `Users.AuthType` to `ENUM('LMS','DIRECT','LMS_AND_DIRECT')`, which fails or truncates under strict mode if any row holds another value;
- drops the foreign key `FK_LabSession_UserId`.

The owner backend (`ignito_Experia_Main_Dashboard/Backend/config/db.js`) does the same kind of thing: `DROP PROCEDURE`, `ALTER TABLE labs ADD COLUMN`, and seed `INSERT INTO owner_users`.

This code is **already on `main`**, so live has very likely already applied it, and a re-run then finds nothing left to drop. That is unconfirmed. The deploy runs `pm2 restart` on every push to `main`.

**Required before the next deploy:**
1. Take a full logical backup of both `ignito_experia` and `ignito_experia_owner` on the live server, and test that it restores.
2. On live, run read-only `SHOW CREATE TABLE \`Users\`` and compare it with `USERS_COLUMNS_TO_DROP`. If any of those columns still exist **and hold data**, the next restart will delete that data.
3. Long-term (separate approval): move startup DDL into reviewed, numbered migrations, and put the destructive parts behind an explicit opt-in flag.

What audit 027 already fixed here: `GET /api/health/database`, which CI calls on every deploy, no longer runs DDL. It now runs `SELECT 1`. On `main` it still runs the DDL path until the merge.

---

## 2. LMS SSO readiness

### 2.1 How tokens are verified now (actual code)

File: `backend/lib/lmsSsoVerifier.js`, called from `SsoService.verifyLmsToken`.

| Token `alg` header | Verified with | Required configuration |
|---|---|---|
| `HS256` / `HS384` / `HS512` | Shared secret | `LMS_JWT_SECRET` |
| `RS*` / `ES*` / `PS*` | Public keys fetched from `{issuer}.well-known/jwks.json`, chosen by `kid`; JWKS cached 10 minutes (last good set kept if the issuer is briefly down) | `LMS_SSO_ISSUERS` (comma-separated, exact `iss` values), **or** `LMS_AUTH0_DOMAIN` (issuer becomes `https://{domain}/`) |
| `none` or anything else | Refused (401) | — |

Optional settings:
- `LMS_SSO_AUDIENCE` (comma-separated). If set, the token `aud` must match. If unset, **`aud` is not checked**.
- `LMS_SSO_CLOCK_TOLERANCE_SECONDS` (default 60).
- `exp` and `nbf` are always enforced by `jsonwebtoken`. For RS/ES/PS tokens, `iss` must be in the trusted list.

Emergency switch: `LMS_SSO_VERIFICATION=legacy-insecure` restores the old decode-without-verify behaviour and logs an error on every use. **Must not be set in production** except as a short, deliberate rollback.

### 2.2 Claims the application reads from the token

| Purpose | Claim names accepted (first non-empty wins) |
|---|---|
| Student id | `studentId`, `studentID`, `StudentId`, `student_id`, `lmsStudentId` |
| Admission id | `studentDegreeAdmissionId`, `admissionId` |
| Email | `email` (preferred), else `preferred_username` |
| Subject / replay | `sub`; replay id = `jti` or `nonce`, else `sub` + `iat` |

Identity rules (from 027):
- If the token carries a student or admission id, a different id in the request body returns 401.
- If ids come **only** from the body, the LMS profile email must match the token `email` when both exist.
- A token with no ids and no email is the weakest case: it relies on body ids and logs a warning. **Ask the LMS team to always include the student id in the token.**

### 2.3 Safe failure — verified

| Situation | Result | Verified by |
|---|---|---|
| No `LMS_JWT_SECRET`, HS token | 401 "signature cannot be verified" | unit `lms-sso-verifier.test.mjs` |
| No issuer configured, RS token | 503 `LMS_SSO_NOT_CONFIGURED` | unit |
| Issuer not trusted | 401 | unit |
| JWKS unreachable, nothing cached | 503 `LMS_SSO_UNAVAILABLE` | unit |
| Wrong secret / forged token | 401, nothing written to `SSOReplayStore` | integration `session-start-sso.test.mjs` |
| Body id contradicts token id | 401 | integration |
| Expired token | 401 | unit |

### 2.4 What must come from the LMS team (do not guess these)

1. **Signing algorithm**: HS256 (shared secret) or RS256/ES256 (key pair / Auth0).
2. If HS: the **shared secret**, delivered over a secure channel and stored only in `backend/.env` as `LMS_JWT_SECRET`.
3. If RS/ES: the **exact `iss` value** (with or without the trailing slash) and confirmation that `{iss}.well-known/jwks.json` is publicly reachable from the EC2 server.
4. The **`aud` value** they put in SSO tokens, so `LMS_SSO_AUDIENCE` can be enforced.
5. **Claim names** for student id, admission id and email (§2.2), plus a sample **decoded** token (header + payload, no signature) from their test environment.
6. **Token lifetime**, and whether `jti` is unique per token (affects §6.3).
7. A **test student account** and written permission to use it against the live LMS.
8. For the LMS data API (separate from SSO): `LMS_M2M_CLIENT_ID`, `LMS_M2M_CLIENT_SECRET` and the Auth0 token endpoint and audience. These are **absent from the local `backend/.env`**, so profile and course fetches cannot be confirmed locally.

---

## 3. Production environment checklist (`backend/.env` on the server)

"Local" = what the local development `backend/.env` contains (names only). The production file is on the server and was **not** inspected.

| Variable | Required | Purpose / effect if missing | Local |
|---|---|---|---|
| `NODE_ENV` | yes, `production` | Enables the rate limiter, secure cookies and JWT fallback protection | set |
| `JWT_SECRET` | **yes** | If unset or `change-me-in-production` in production, a **random per-process** secret is used. Logins then break on every restart, and differ between processes if pm2 runs in cluster mode. Use ≥ 48 random bytes. | set |
| `JWT_EXPIRES_IN` | optional | Default `24h` | set |
| `BASE_DOMAIN` | **yes** | `ignitoexperia.com`. Drives the tenant subdomain, cookie domain and portal URLs. Code default is the same value. | **absent** |
| `LEGACY_BASE_DOMAINS` | optional | Default `experia.ignitolearn.com`; old domain keeps resolving tenants | absent |
| `API_PUBLIC_URL` | **yes** | `https://ignitoexperia.com/api`. Used for Jupyter/terminal proxy links; default is `localhost`, which breaks labs | set |
| `FRONTEND_URL` | **yes** | `https://ignitoexperia.com`. Used in emails and redirects; default is `localhost:5173` | set |
| `CORS_ORIGIN` | **yes** | **Only used by socket.io** today (see §6.1). Set it to the exact origins, not `*`. | set |
| `LMS_JWT_SECRET` **or** `LMS_SSO_ISSUERS` / `LMS_AUTH0_DOMAIN` | **yes for SSO** | See §2. Without them, SSO is refused. | **absent** |
| `LMS_SSO_AUDIENCE` | recommended | Enforces `aud` | absent |
| `LMS_SSO_VERIFICATION` | **must be unset** | — | absent |
| `LMS_API_BASE_URL`, `LMS_TOKEN_ENDPOINT`, `LMS_API_AUDIENCE`, `LMS_*_ENDPOINT` | yes | LMS data API | set |
| `LMS_M2M_CLIENT_ID`, `LMS_M2M_CLIENT_SECRET` | **yes** | Without them every LMS call fails with `LMS_M2M_CLIENT_SECRET_MISSING`. Profile then falls back to cache only. | **absent** |
| `REDIS_LMS_PROFILE_TTL` | keep | Existing value preserved (default 600 s) | set |
| `REDIS_URL` **or** `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | strongly recommended | Without Redis, the code falls back to in-process memory (retries every `REDIS_RETRY_AFTER_MS`, default 30 s). It works, but caches are per process and lost on restart. | **absent** |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | **yes** | **Live** keys in production, **test** keys on any test server | set |
| `RAZORPAY_WEBHOOK_SECRET` | **yes** | Without it the webhook returns 503 and tokens arrive only through the browser `/verify` call | **absent** |
| `INTERNAL_SERVICE_TOKEN` | **yes** | Code default is a hard-coded, public string. Anyone who reads the repository can call internal endpoints if this is not set. | **absent** |
| `OWNER_API_URL`, `OWNER_API_TIMEOUT_MS` | yes | Main backend → owner backend calls | absent |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | **yes** | `DB_NAME=ignito_experia`. The lab catalog is read from `ignito_experia_owner` on the same server, so the DB user needs SELECT there. Use a non-root user with a password. | `DB_PASSWORD` **empty** (local) |
| `AWS_REGION`, `ECS_CLUSTER`, `ECS_PRIVATE_SUBNETS` / `ECS_PUBLIC_SUBNETS`, `ECS_SECURITY_GROUPS`, `ECS_CONTAINER_NAME` | **yes for labs** | If `ECS_CLUSTER` is empty, labs start as **mock** sessions | set |
| `SESSIONS_TABLE_NAME` (+ `RUNS_`, `SUBMISSIONS_`, `RESULTS_TABLE_NAME`) | yes | DynamoDB session store; if empty, in-memory sessions are lost on restart | set |
| `TEST_CASES_BUCKET`, `LAB_BOOTSTRAP_PRESIGN_TTL_SECONDS` | yes | Lab bootstrap files | set |
| AWS credentials | yes | Prefer an **EC2 instance role** over `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in `.env` | keys in `.env` |
| `DISABLE_SSM`, `FORCE_CONTAINER_EXECUTION` | check | Must be the production values. `DISABLE_SSM=true` disables terminal/exec into containers. | set |
| `PERF_LOG`, `PERF_LOG_SLOW_MS` | optional | New request-timing logs (027) | absent |
| `LAB_ACCESS_CACHE_TTL_SECONDS`, `FILES_LIST_TIMEOUT_MS` | optional | Defaults 60 s / 20000 ms | absent |
| `SMTP_*` | yes | Email | set |

**Owner backend** (`ignito_Experia_Main_Dashboard/Backend/.env`):
- `PORT` (4000), `API_PREFIX` (`/api`), `NODE_ENV`, `DB_*` with `DB_NAME=ignito_experia_owner`, and its own `JWT_SECRET` (must not be the default).
- Add `BASE_DOMAIN=ignitoexperia.com`, used by `handlers/universities.js` and `handlers/upload.js`.

---

## 4. GitHub Actions

File: `.github/workflows/ci.yml`.

- **How `APP_URL` is used:** `APP_URL="${{ secrets.APP_URL }}"`, then `${APP_URL:-https://ignitoexperia.com}`. The secret, **if set, overrides** the new default. It drives:
  - the vlab_admin build: `VITE_API_BASE_URL="$APP_URL/api"`;
  - the owner-admin build: `VITE_API_URL="$APP_URL/owner-api"`;
  - the `Host:` header used by the post-deploy HTTP checks.
- **Risk:** if `APP_URL` still holds the old domain (`https://experia.ignitolearn.com`), both frontends are built with the old API URL baked in. The 027 runtime fallback only applies when the env URL is empty or localhost.
- **Required action (manual, in GitHub → Settings → Secrets and variables → Actions):**
  - Set `APP_URL` = `https://ignitoexperia.com` (no trailing slash), **or** delete it so the default applies.
  - Check `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` and `DEPLOY_PATH` are still correct.
  - Not changed by this audit.
- The CI build jobs (not deploy) use hard-coded values `VITE_API_URL: /owner-api` and `VITE_API_BASE_URL: https://ignitoexperia.com/api`. These were already updated in 027.
- **CI gaps:**
  - No job runs the backend tests (`npm test`). Recommended: add `npm test` to `backend-main`. The integration tests need MySQL and should stay manual or use a service container.
  - Lint is `continue-on-error`.
  - The deploy has no rollback step and no pre-deploy backup.
- Post-deploy checks call `/api/health/database`. After the merge this is `SELECT 1` and safe; before the merge it runs DDL (§1.2).

---

## 5. Razorpay

### 5.1 Endpoints (API prefix `/api`)

| Route | Auth | Role |
|---|---|---|
| `POST /api/payments/razorpay/create-order` | student JWT | Server-priced order (`round(tokens × BaseTokenPrice / 60)`), body `{items:[{labId,tokens}]}` |
| `POST /api/payments/razorpay/verify` | student JWT | Checkout signature + settlement |
| `POST /api/token-orders` / `POST /api/token-orders/:orderId/verify-payment` | student JWT | Older order flow, same settlement service |
| **`POST /api/token-orders/webhook`** | Razorpay HMAC | **Webhook URL: `https://ignitoexperia.com/api/token-orders/webhook`** |

### 5.2 Webhook behaviour (verified in code and tests)

- **Events handled:** `payment.captured`, `order.paid`. Any other event gets 200 `{status:"ok"}` and is ignored.
- **Signature:** HMAC-SHA256 of the **raw request bytes** with `RAZORPAY_WEBHOOK_SECRET`, compared with `x-razorpay-signature`. `index.js` keeps `req.rawBody` for this route only. Bad signature → 401; secret unset → 503.
- **Never trusts the webhook body alone:** settlement re-fetches the payment from Razorpay. It must belong to the same order, have status `captured` or `authorized`, and match the order amount in paise.
- **Duplicates:** the order row is read with `SELECT … FOR UPDATE` inside a transaction. If its status is already credited (`TOKEN_CREDITED`/`PAID`, whichever the live ENUM has) or `CreditedAt` is set, the call returns `alreadyProcessed` and credits nothing. A webhook plus a browser `/verify` for the same order credit tokens **once**; this is covered by an integration test.
- **Order from another environment** (404) → 200 `ignored`, so Razorpay stops retrying. **Settlement error** → 500, so Razorpay retries.
- **A failed verification marks the order FAILED but does not block a later successful settlement.** A delayed `payment.captured` still credits.
- **Wallet allocation:** one `student_lab_token_wallets` row per StudentId + TenantId + canonical LabId, plus a `PURCHASE` row in `student_lab_token_transactions` per item. Cached lab access is invalidated after settlement.

### 5.3 Razorpay dashboard configuration (manual)

1. **Webhooks → Add:**
   - URL `https://ignitoexperia.com/api/token-orders/webhook`;
   - a strong secret, copied to `RAZORPAY_WEBHOOK_SECRET` on the server;
   - events **`payment.captured`** and **`order.paid`**.
   - Do this separately in **Test mode** (on a test server) and **Live mode** (production); each mode has its own secret.
2. **Payment capture → Automatic.** Settlement accepts `authorized` payments. If auto-capture is off, tokens would be credited for payments that Razorpay later auto-refunds.
3. Use **Live** API keys only in production, and confirm the account's business website is `ignitoexperia.com`.

### 5.4 Not yet verified against Razorpay itself

All payment tests ran against a **fake Razorpay** (an axios adapter). Nothing has been run against Razorpay Test mode end to end: real checkout → `/verify` → webhook → wallet.

---

## 6. Security items still open (not changed in 027 or this audit)

### 6.1 CORS reflects every origin with credentials — fix before go-live

`backend/index.js`:

```js
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));
```

Any website can send credentialed requests to the API and read the responses. The `refreshToken` cookie is `SameSite=None; Secure` over HTTPS, so a malicious page can call `/auth/refresh` with the student's cookie.

`CORS_ORIGIN` is only applied to socket.io.

**Recommended fix (needs approval):** allow `https://ignitoexperia.com`, `https://*.ignitoexperia.com` (each tenant subdomain), the legacy domain during migration, and localhost only outside production.

### 6.2 `INTERNAL_SERVICE_TOKEN` has a public default

The token falls back to a hard-coded string in `config/env.js`. Set it on the server, and preferably make startup fail in production when it is missing.

### 6.3 SSO replay is not enforced

`SSOReplayStore` uses `INSERT … ON DUPLICATE KEY UPDATE`, so a reused token is recorded, not refused. Within the token lifetime, an intercepted SSO token can be replayed. Fixing this needs the LMS team to confirm `jti` uniqueness (§2.4 item 6).

### 6.4 Other open items

- **Rate limiter:** `max: 50000` requests per 15 minutes per IP is effectively off. Add tighter limits on `/auth/*` and `/sso/*`.
- **Default owner password:** the owner backend seeds `owner_users` with a default password (`password123`). Confirm the live owner account password was changed.

---

## 7. Domain, nginx and SSL requirements

No nginx configuration is stored in this repository; it lives only on the EC2 server. These are requirements, not changes.

| Item | Requirement |
|---|---|
| DNS | `A` (or `ALIAS`) `ignitoexperia.com` → EC2 public IP; **wildcard** `A` `*.ignitoexperia.com` → same IP. Keep `experia.ignitolearn.com` + `*.experia.ignitolearn.com` during migration. |
| TLS | One certificate covering `ignitoexperia.com` **and** `*.ignitoexperia.com`. Wildcards need a **DNS-01** challenge (certbot DNS plugin for the DNS provider, or manual TXT records, which do not auto-renew). Confirm auto-renewal works. |
| HTTP → HTTPS | 301 from port 80 to 443 for every name. Add HSTS once stable. |
| `server_name` | `ignitoexperia.com *.ignitoexperia.com` (+ legacy names during migration) |
| `/` | static `vlab_admin/dist`, SPA fallback `try_files $uri /index.html` |
| `/owner/` | static owner-admin `dist` (built with `--base=/owner/`), SPA fallback to `/owner/index.html` |
| `/api/` | `proxy_pass http://127.0.0.1:8080` (path kept, `/api` prefix) |
| `/owner-api/` | proxy to the owner backend **with the prefix rewritten**: `/owner-api/x` → `http://127.0.0.1:4000/api/x`. Owner `API_PREFIX` is `/api`; the frontend calls `/owner-api`. |
| WebSockets | `/socket.io/`, the terminal and Jupyter proxy routes need `proxy_http_version 1.1`, `Upgrade`/`Connection` headers and long `proxy_read_timeout` |
| Headers | `X-Forwarded-For`, `X-Forwarded-Proto`, and **`Host` passed through unchanged**. The backend reads the subdomain from `Host` to find the tenant. |
| Body size | `client_max_body_size` ≥ 25m (Express limit is 25 MB) |
| Webhook | `/api/token-orders/webhook` must not be rewritten or body-buffered in a way that changes the bytes; HMAC is over the raw body |

**Tenant routing (code, verified by unit tests):**
- `ignitoexperia.com` → platform (no tenant);
- `{slug}.ignitoexperia.com` → tenant `{slug}`;
- `api`, `owner`, `www` and other reserved labels are never tenants;
- the legacy domain works the same way;
- the cookie domain is `.ignitoexperia.com`, so login is shared across subdomains.

---

## 8. Testing status

### 8.1 Verified (on this machine, 2026-11-23)

| What | Result |
|---|---|
| Backend unit tests (`npm test`) | **55 / 55 pass**, re-run for this audit |
| Backend integration tests (`npm run test:integration`), isolated schemas `vlab_access_test` / `vlab_session_test` on local MariaDB 10.4 | 21 / 21 pass (audit 027 run) |
| `vlab_admin` TypeScript (`tsc`) | 0 errors (027) |
| `vlab_admin` and owner-admin production builds | succeed; bundles contain `https://ignitoexperia.com/api` (027) |
| Covered by tests | SSO signature/issuer/expiry/identity binding; server-side pricing; settle once (verify + webhook); webhook HMAC; ownership 403; no free tokens at lab start; billing only after READY; file listing timeout/retry; tenant from token not header; domain/slug parsing; async password hashing |

### 8.2 Not tested — needs something external

| Item | Needs |
|---|---|
| Real SSO login from the LMS | LMS signing details (§2.4) + test student + LMS team authorisation |
| LMS profile / courses / programmes against the live API | `LMS_M2M_*` credentials + test student + authorisation |
| Real lab start / READY timing / billing on Fargate | AWS ECS access (no cluster locally; labs run as mock sessions) |
| Terminal / Jupyter through nginx with WebSockets | Production or staging server access |
| Checkout → verify → webhook → wallet with real Razorpay | Razorpay **Test mode** keys + webhook secret on a non-production server |
| Behaviour on live MySQL 8.4 (case-sensitive names, strict mode) | A staging copy of the live schema. Local is MariaDB 10.4, non-strict and case-insensitive. Code was written for both, but not run on 8.4. |
| Startup DDL against the live schema | Live schema dump (read-only) — §1.2 |
| SQL 027 indexes | **Approval**. File `backend/database/027_proposed_lab_access_payment_indexes.sql` is **not applied**. The app works without it, but payment lookup and lab access do full table scans as the data grows. |
| Merged `main` + `jalpa` | The merge itself (§1.1), then the full test suite again |

No performance number in the 027 report or here comes from ECS or production. All of them are local measurements.

---

## 9. Path to go-live (in order)

1. **Approve and commit** the 027 work on `jalpa`; **merge `main` into `jalpa`**, resolve the 8 conflicts (§1.1), re-run all tests and both builds.
2. **Fix CORS** (§6.1) and set `INTERNAL_SERVICE_TOKEN` (§6.2). Small code changes; need approval.
3. **Back up** both live databases; verify the live `Users` columns against `USERS_COLUMNS_TO_DROP` (§1.2).
4. **Get the LMS SSO contract** (§2.4) and set the variables in §3 on the server.
5. **DNS + wildcard TLS + nginx** per §7. Check with `curl -I https://ignitoexperia.com`, `https://{slug}.ignitoexperia.com` and `/owner/`.
6. **GitHub secret `APP_URL`** → `https://ignitoexperia.com`, or delete it (§4).
7. **Razorpay webhook** in Test mode first, then Live (§5.3).
8. (Optional, after approval) apply **SQL 027** part A in a quiet window.
9. Merge to `main` → CI deploys. Then smoke-test:
   - direct login;
   - SSO login with the LMS test student;
   - My Labs lists university + purchased labs;
   - buy the smallest token pack and confirm the wallet updates once;
   - start a lab, reach READY, confirm billing starts only after READY;
   - stop the lab.
10. Keep `LMS_SSO_VERIFICATION` **unset**. Keep the legacy domain for a transition period, then remove it from DNS and `LEGACY_BASE_DOMAINS`.

## 10. Go / no-go

| Area | Status |
|---|---|
| Application code (on `jalpa`) | Ready after merge + re-test |
| Branch / release process | **Blocked**: uncommitted, behind `main`, conflicts expected |
| Database safety on restart | **Blocked** until a backup is taken and the live `Users` schema is checked |
| LMS SSO | **Blocked** on LMS team configuration (fails safely meanwhile) |
| CORS | **Should fix** before go-live |
| Razorpay | Code verified with a fake; **needs** webhook secret + dashboard config + a Test-mode run |
| Domain / TLS / nginx | Requirements defined; **unverified** (no server access) |
| ECS labs | **Unverified** (no ECS access) |
| SQL 027 | Optional; awaiting approval |

**Recommendation: NO-GO today; GO once §9 steps 1–7 are done and the step 9 smoke test passes.** The highest-risk single step is the first deploy after the merge, because it restarts both backends with startup DDL. Do not do it without step 3.
