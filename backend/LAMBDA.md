# VLab Backend — Lambda + API Gateway

This backend is structured so each route handler can be copied into AWS Lambda with minimal changes.

## Architecture

```
handlers/          ← Business logic (JWT + DynamoDB + ECS)
router.js          ← Route table (matches API Gateway paths)
lambda.js          ← Single Lambda entry: lambda.handler
index.js           ← Local Express dev server (same handlers)
```

## API routes (match `vlab/terraform/api_gateway.tf`)

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| GET | `/health` | health | No |
| POST | `/auth/login` | authLogin | No |
| GET | `/labs` | labsList | JWT |
| GET | `/labs/{labId}` | labsGet | JWT |
| POST | `/lab-sessions` | sessionsStart | JWT |
| GET | `/lab-sessions/{sessionId}` | sessionsGet | JWT |
| POST | `/lab-sessions/{sessionId}/stop` | sessionsStop | JWT |
| POST | `/runs` | runsCreate | JWT |
| GET | `/runs/{runId}` | runsGet | JWT |
| POST | `/save` | filesSave | JWT |
| GET | `/files` | filesList | JWT |

Legacy frontend routes also work under `/api` prefix locally: `POST /api/run`, `GET /api/files`, etc.

## AWS deployment (implemented in `vlab/terraform`)

1. `use_node_api_gateway = true` (default) — routes HTTP API to Node Lambda
2. `jwt_authorizer` Lambda validates `Authorization: Bearer <token>`
3. `POST /auth/login` — public route (no authorizer)
4. Lambda env: `CONTAINER_HOST_MODE=private`, DynamoDB tables, `JWT_SECRET`
5. ECS: port **8080** (IDE labs), **8080** (datascience/Jupyter)

### Apply Terraform

```bash
bash vlab/scripts/package-node-lambdas.sh
cd vlab/terraform
terraform init
terraform apply -var="jwt_secret=YOUR_SECRET"
```

Set frontend `VITE_API_BASE_URL` to API Gateway URL (no `/api` suffix):

```
https://xxxx.execute-api.ap-south-1.amazonaws.com
```

## Deploy options

### Option A — One Node Lambda (router)

```bash
# handler in AWS
backend/lambda.handler
```

Set env vars from Terraform outputs. Use `CONTAINER_HOST_MODE=private` in VPC.

### Option B — Per-route Lambdas (like existing Python)

Copy handler logic from `handlers/*.js` into separate deploy packages, or re-export:

```js
// e.g. vlab/lambda-node/start_lab.js
import { createHandler } from '../../backend/lib/apigw.js';
import { sessionsStartHandler } from '../../backend/handlers/sessions.js';
export const handler = createHandler(sessionsStartHandler, { auth: true });
```

## Container ports (`config/labs.js`)

| Runtime | Port | Usage |
|---------|------|--------|
| IDE (python, java, linux, dbms) | **8080** | `lab_server.py` — run/save code |
| Jupyter (data-science-lab) | **8080** | JupyterLab UI + notebook |

## JWT flow

1. `POST /auth/login` → `{ token, user }`
2. All protected routes: `Authorization: Bearer <token>`
3. `POST /lab-sessions` uses `sub` from JWT as `userId` (do not trust body `userId`)

## DynamoDB tables

Same as Terraform: `vlab-sessions`, `vlab-runs`, `lab-submissions`, `lab-results`.
