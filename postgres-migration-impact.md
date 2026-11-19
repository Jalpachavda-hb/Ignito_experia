# PostgreSQL + Prisma migration: workflow and breakage

Status: **plan only**. No schema, dependency, or backend code has been changed. Implementation starts only after you approve this file.

This note is based on the current source. Live MySQL and the local MySQL server were **not** queried, so the name-mapping table at the end is not filled in and no environment is marked as matching.

## What this change would do

Two Express apps share MySQL today:

| App | Entry | Database access |
|---|---|---|
| Student / lab API | `backend/index.js` | `backend/lib/mysql.js` (`mysql2` pool). On startup it also creates and alters tables. |
| Owner API | `ignito_Experia_Main_Dashboard/Backend/index.js` | `config/db.js` (`mysql2` pool). On startup it also creates tables and seeds `owner_users` / `runtime_types`. |

Env vars for both: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (default name `ignito_experia`).

There is a **second MySQL database**, `ignito_experia_owner`. The student API reads it directly:

- `backend/repositories/labRepository.js` reads `` `ignito_experia_owner`.`labs` ``, then falls back to `CALL sp_Lab_GetAll` or `Labs`.
- `backend/lib/studentAccess.js` reads `ignito_experia_owner.tenants` when the student `tenants` row is missing.

Owner code writes `labs`, `owner_users`, `runtime_types`, and also `ignito_experia.tenants` (`handlers/universities.js`).

A correct cutover moves **both** databases into one PostgreSQL database (two schemas, for example `public` and `owner`) and switches **both** apps in the same release. One app left on MySQL while the other uses PostgreSQL splits wallets, tenants, and lab catalogs.

Unchanged by this migration: `vlab_admin/`, `ignito_Experia_Main_Dashboard/ignito_experia_admin/`, Redis, DynamoDB session/run/submission tables, ECS, Jupyter/terminal proxy, Razorpay HTTP calls, Socket.IO.

## Naming rule this plan follows

PostgreSQL folds unquoted names to lowercase. A migration that creates unquoted `Users` actually creates `users`. Quoted `"Users"` stays `Users`.

Canonical names will be taken from the verified live MySQL schema, then checked against:

- `backend/lib/mysql.js` (startup DDL)
- `ignito_Experia_Main_Dashboard/Backend/config/db.js`
- latest SQL: `backend/database/016`–`023`, owner `database/schema.sql`

Code today already mixes spellings. These are **source spellings**, not a verified live catalog:

| Spelling in code | Where |
|---|---|
| `Users`, `StudentSessions`, `RefreshTokens`, `AuditLogs`, `SSOReplayStore` | `backend/lib/mysql.js` and most handlers |
| `tenants`, `lab_sessions`, `credit_wallets`, `credit_transactions`, `token_orders` | `backend/lib/mysql.js` and repositories |
| `` `ignito_experia_owner`.`labs` `` and fallback `Labs` | `backend/repositories/labRepository.js` |
| `labs`, `owner_users`, `runtime_types` | owner `config/db.js` |
| `Roles`, `RolePermissions` | `backend/handlers/auth.js` (no matching `CREATE TABLE` in `mysql.js`) |
| `UsedLmsTokens` | `backend/services/SessionCleanupService.js` (cleanup only) |
| `external_identities` | `backend/database/011_tenant_sso_and_identity_schema.sql`, SSO and user delete |

Windows MySQL often stores these as lowercase. Linux/live MySQL often keeps the case used in `CREATE TABLE`. That is why local and live can disagree today. PostgreSQL will not forgive that. Every environment must be built from the same Prisma migration, with quoted identifiers.

Prisma model names can be `User` / `StudentSession`. The table name stays in `@@map("Users")` / `@@map("StudentSessions")`. Column names that differ from the Prisma field use `@map("ExactColumnName")`.

## Workflow (after approval)

1. **Read live MySQL.** `SHOW TABLES` and `information_schema.COLUMNS` on `ignito_experia` and `ignito_experia_owner`. Record exact table and column case. Do not alter those databases.
2. **Read local MySQL the same way.** Diff it against live. Differences are listed in the mapping report. They are not auto-fixed.
3. **Write one Prisma schema** in `backend/prisma/schema.prisma` for both apps. Owner tables go in a PostgreSQL schema such as `owner`, student tables in `public`, still with the live names (`"labs"`, `"Users"`, `"lab_sessions"`).
4. **Generate one migration.** Review the SQL. Every mixed-case name is double-quoted. No second table that differs only by case.
5. **Apply that migration** to an empty local PostgreSQL only. Run the catalog check (exact table case, no lowercase twin, columns, foreign keys, migration history).
6. **Replace `mysql2` call sites** in both backends with Prisma. Keep route paths, JSON bodies, and status codes.
7. **Copy data** from a MySQL backup into PostgreSQL. Compare row counts, tenant ids, wallet balances, token ledgers, and `lab_sessions`. Leave MySQL online and read-only until the check passes.
8. **Point staging env** at PostgreSQL. Exercise the flows in the breakage list below.
9. **Production cutover** only after staging passes, and only with a write freeze. Rollback is switching both apps back to MySQL. That needs your explicit approval, and it discards PostgreSQL writes made after the freeze unless those writes are replayed.

CI (`.github/workflows/ci.yml`) today only runs `npm ci`. It has no database. The catalog check has to be added there or staging can drift from local.

## What breaks if the switch is incomplete

These fail as soon as an app talks to PostgreSQL while its SQL is still MySQL. The frontend is unchanged, so the failure shows up as 500s from the API.

### Student / lab API (`backend/`)

| Flow | Routes | Why it breaks |
|---|---|---|
| Login, register, logout, refresh, `/auth/me` | `/auth/*`, `/student/me` | Queries use `Users`, `StudentSessions`, `RefreshTokens`, `Roles`, `RolePermissions`. `?` placeholders, backticks, and `NOW()` are MySQL. Unquoted `Users` looks up `users` and misses `"Users"`. |
| LMS SSO and tenant resolve | `/auth/sso-login`, `/tenant/resolve` | `SsoService.js` uses `information_schema`, `DATABASE()`, and `ON DUPLICATE KEY UPDATE` on `SSOReplayStore`, `external_identities`, and wallets. `studentAccess.js` also reads `ignito_experia_owner.tenants`. |
| Profile cache | `/student/refresh-profile` | Redis can stay. The MySQL read/write of `Users` still has to move with it, or refresh returns a stale or missing user. |
| Lab catalog | `/labs`, `/admin/labs`, `/sub-labs` | Cross-database `` `ignito_experia_owner`.`labs` `` does not exist on PostgreSQL. Fallback `CALL sp_Lab_GetAll` and table `Labs` disagree with owner table `labs`. |
| Start, stop, extend lab | `/lab-sessions/*` | `lab_sessions` plus wallet updates. `LabSessionRepository.js` uses `NOW()`. A half-migrated wallet can charge MySQL and record the session in PostgreSQL. |
| Token billing workers | processes started in `index.js` | `LabExpiryWorker`, `UsageBillingWorker`, `RuntimeStopWorker`, `SessionExpiryWorker`. They `SELECT ... FOR UPDATE` and decrement `student_lab_token_wallets`. Wrong casing or two databases double-charges or never stops the ECS task. |
| Token purchase and Razorpay confirm | `/token-orders/*`, `/payments/razorpay/*` | `token_orders`, `token_order_items`, wallet credit. Payment can succeed at Razorpay while the ledger insert fails. |
| Credits | `/credits/*`, `/users/:id/credits` | `credit_wallets`, `credit_transactions`, `StudentCreditWallets` (both exist in startup DDL). |
| Course to lab map | `/admin/courses/:courseId/map-lab` | `ON DUPLICATE KEY UPDATE` on `course_lab_mappings`. |
| Admin users, students, sessions, audit, analytics | `/users`, `/admin/students`, `/admin/sessions`, `/admin/audit`, `/admin/analytics/*` | Same MySQL SQL. Audit stats use `CURDATE()` and `DATE()`, which PostgreSQL does not accept in that form. |
| Session cleanup | background | `SessionCleanupService.js` updates `StudentSessions` and deletes `UsedLmsTokens`. That table is not created in `mysql.js`. On PostgreSQL the delete errors unless the table is confirmed and created, or the statement is removed. |
| Health | `/health/database` | Calls `verifyDbConnection()` in `mysql.js`, which runs MySQL DDL (`information_schema`, `ALTER TABLE`, drop unused `Users` columns). Against PostgreSQL this throws on boot. |

### Owner API (`ignito_Experia_Main_Dashboard/Backend/`)

| Flow | Why it breaks |
|---|---|
| Owner login | `owner_users` via `ownerAuthRepository.js`, backticks and `?`. |
| Universities / tenants | `handlers/universities.js` upserts with `ON DUPLICATE KEY UPDATE` and `VALUES()`. It also updates `ignito_experia.tenants` by database name. |
| Lab admin and runtime types | `labs` and `runtime_types` are created in `config/db.js` on boot. Student catalog reads the owner database, so owner and student must use the same PostgreSQL schemas. |
| Reports, revenue, dashboard | Handlers import `mysql2` (`handlers/reports.js`, `revenue.js`, `dashboard.js`). |

### What keeps working during the migration

ECS task start, Jupyter proxy, terminal, file save, Android build, and DynamoDB run/submit paths keep working **only while they do not also write MySQL**. Lab start currently writes `lab_sessions` and a wallet before it talks to ECS, so a failed database write blocks the lab even though ECS itself is unchanged.

Redis keys and TTL stay as they are. Razorpay’s HTTP API stays as it is. The ledger write behind the webhook does not.

## MySQL syntax that must be rewritten

Leaving any of these in a query that runs on PostgreSQL makes that request fail:

- `` `backticks` `` and `?` placeholders (`mysql2`). Prisma uses `$1` only if a raw query remains.
- `ON DUPLICATE KEY UPDATE`, `VALUES(col)`, `INSERT IGNORE` (SSO replay, course-lab map, owner seed, universities).
- `CALL sp_Role_*` and `CALL sp_Lab_GetAll` (`RoleRepository.js`, `labRepository.js`).
- `DATABASE()`, `information_schema` filters written for MySQL (`mysql.js`, `SsoService.js`).
- `CURDATE()`, `DATE(column)` in audit stats.
- Startup `CREATE`/`ALTER`/`DROP COLUMN` in `mysql.js` and owner `db.js`. After Prisma, schema changes come from `prisma migrate` only. Boot must stop editing tables.
- `TINYINT(1)` returned as `0`/`1`. Prisma booleans serialize as `true`/`false`. Screens that expect `0`/`1` need a response check, not a silent change.
- Token and money columns (`INT UNSIGNED`, `DECIMAL(10,2)`, wallet `Version`) must stay integers or decimals. Mapping them to float changes balances.

`backend/lib/mysql.js` also drops a fixed list of `Users` columns on every boot (`EmailVerified`, `Mobile`, `UniversityId`, and others). PostgreSQL must be created from the **post-drop** live shape. Recreating those columns would bring back fields the running API already removed.

## Data and cutover risks

- Copy uses existing ids, then restarts identity sequences. A sequence left at 1 collides with live users and wallets.
- Foreign keys load after parent rows: `tenants` and `Users` before mappings, wallets, orders, and `lab_sessions`.
- Trigger `trg_users_before_delete` (`backend/database/023_cascade_delete_student_data.sql`) does not move with Prisma unless it is recreated. User delete would leave child rows or fail on foreign keys.
- Two writers during copy (apps still on MySQL, copy job writing PostgreSQL) lose any MySQL insert that happens after the copy snapshot.
- Rollback to MySQL after users have purchased tokens on PostgreSQL loses those purchases unless they are copied back first.
- CI, local, staging, and production must use the same `prisma/migrations` folder. A hand-made local database will not match staging.

## Mapping report (not verified)

Do not treat this as proof that environments match. Live and local MySQL were not inspected in this pass.

| Environment/source | Existing name | Canonical PostgreSQL name |
|---|---|---|
| Live MySQL | Not queried | Pending live `information_schema` export |
| Local MySQL | Not queried | Same canonical name, after the live export |
| PostgreSQL | No PostgreSQL database created | Same canonical name |
| Prisma | No `schema.prisma` yet | `@@map` set only after the live export |

Code-declared names to verify against live, not to assume:

`Users`, `RegisteredDevices`, `StudentSessions`, `RefreshTokens`, `AuditLogs`, `AuditLogs_Archive`, `StudentCreditWallets`, `SSOReplayStore`, `tenants`, `user_tenant_mapping`, `course_lab_mappings`, `external_identities`, `credit_wallets`, `credit_transactions`, `lab_sessions`, `lab_token_packages`, `token_orders`, `token_order_items`, `student_lab_token_wallets`, `student_lab_token_transactions`, `lab_token_usage`, `user_lab_workspaces`, `Roles`, `RolePermissions`, `UsedLmsTokens`, owner `labs`, `owner_users`, `runtime_types`.

## Approval needed before any edit

Reply with approval if this workflow is the one to implement. Until then nothing is installed, no migration SQL is generated, and neither MySQL database is modified.

After approval the first implementation step is still read-only: export live and local table/column names, fill the mapping report, and stop again if live and the files disagree.
