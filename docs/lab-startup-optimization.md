# Lab start-time optimization: images, backend and frontend

Audience: backend, frontend and infra developers working on the lab platform.

Goal: a student clicks **Start lab** and gets a working lab as fast as possible, for every lab type:
container labs on ECS Fargate (python, java, linux, mysql, postgres, oracle, android, android-emulator, bigdata,
datascience, dotnet, softwareengeering, testing, redhat, kali) and AWS console labs (aws-ec2, aws-s3, aws-iam).

---

## 1. Where the time goes (container labs)

A cold Fargate lab goes through these stages after `ecs:RunTask`:

| Stage | What happens | What controls it |
|---|---|---|
| Provisioning | Fargate finds capacity, attaches a network interface (ENI) | AWS; not tunable (≈ 10–30 s) |
| **Image pull** | Downloads and unpacks the **whole** image | **Image size + compression**: usually the biggest part |
| Container start | Entrypoint runs (DB start, HDFS start, Xvfb, …) | What the entrypoint does at boot |
| Session bootstrap | Download starter files from S3 (android, dotnet, datascience) | Archive size |
| Ready | lab_server / Jupyter accepts connections | Health check (`HEALTHY`) |

**Fargate does not cache images between tasks.** Every task pulls the full image, even if another task with the same
image or base just ran. That means:
- **Image size matters on every single start.**
- Sharing base images speeds up **CI builds and ECR storage**, but **not** Fargate start time.
- The only way to remove provisioning + pull + boot from what the student sees is a **warm pool** (section 3.1).

### Measure before and after

ECS records the timestamps for every task:

```bash
aws ecs describe-tasks --cluster vlab-dev-cluster --tasks <taskArn> \
  --query 'tasks[0].{created:createdAt,pullStart:pullStartedAt,pullStop:pullStoppedAt,started:startedAt,health:healthStatus}'
```

- `pullStoppedAt - pullStartedAt` = image pull time
- `startedAt - createdAt` = everything before your code runs
- Then time until `healthStatus = HEALTHY` = your boot time

Image sizes:

```bash
aws ecr describe-images --repository-name vlab-dev-<lab> --image-ids imageTag=latest \
  --query 'imageDetails[0].imageSizeInBytes'
```

Track these per lab type (e.g. in a dashboard). Set a size budget per image and fail review if a change blows it.

---

## 2. Already done in this repo (images + infra)

| Optimization | Where | Effect |
|---|---|---|
| **zstd-compressed image layers** | `.github/workflows/deploy.yml` (`IMAGE_OUTPUT`, `docker buildx`) | Faster decompression during pull than gzip, especially for big images |
| **Shared base images** | `lab-images/base/{linux,python,java}` | linux → linux, testing, android(-emulator), mysql, postgres, **dotnet** (moved onto it); python → python, datascience; java → java, bigdata, softwareengeering. `python3` is now in the linux base instead of every child. Faster CI, less ECR storage |
| Standalone images (cannot share) | oracle (Oracle Linux), redhat (Rocky 9), kali (Kali rolling) | Different Linux distributions; kept as small as possible |
| Work moved from boot to build | mysql/postgres pre-initialized; HDFS pre-formatted; dotnet NuGet/first-run warm-up; Oracle `faststart` image | Shorter container start |
| Small images | `--no-install-recommends`, apt lists removed, curated Kali tool list (heavy tools opt-in via `KALI_EXTRA_PACKAGES`) | Smaller pull |
| **Container health checks** | `terraform/ecs.tf` (`healthCheck`, per-lab `startPeriod`) | Backend can wait for `HEALTHY` instead of sleeping a fixed time |
| **Threaded lab_server** | `lab-images/common/lab_server.py` | A long `/execute` no longer blocks `/health` (would otherwise fail health checks) |
| **Warm-pool claim endpoint** | `lab_server.py` `POST /claim` | Enables section 3.1 |

Rules for anyone editing Dockerfiles:
- Put rarely-changing layers first and `COPY lab_server.py` last (keeps CI cache hits).
- Never download tools or run `apt-get` in an entrypoint; do it at build time.
- Pre-initialize anything deterministic (databases, indexes, caches) at build time.
- Remove caches in the same `RUN` that creates them (`rm -rf /var/lib/apt/lists/*`, `pip --no-cache-dir`, `dnf clean all`).
- Large optional tools → build args, not defaults.

---

## 3. Backend (app repo)

### 3.1 Warm pool: the biggest win (container labs)

Keep a few tasks per popular lab type **already running and healthy**, not yet assigned to anyone. When a student
starts a lab, hand them one: the wait drops from "cold start" to about one HTTP call.

**How a warm task is started**

```
ecs.run_task(
  taskDefinition = <task def for labType>,
  launchType / capacityProviderStrategy = FARGATE,
  networkConfiguration = { subnets: public_subnet_ids, securityGroups: [lab_task_security_group_ids[labType]],
                           assignPublicIp: ENABLED },
  overrides.containerOverrides[0].environment = [
     { LAB_TYPE: <labType> },
     { WARM_POOL_CLAIM_SECRET: <random 32+ bytes, unique per task> },   # NOT SESSION_TOKEN
  ],
  tags = [{ key: "vlab:warm", value: "true" }, { key: "vlab:labType", value: <labType> }])
```

Store it in a table (e.g. `vlab-warm-tasks`: `taskArn` PK, `labType`, `status` = `STARTING|WARM|CLAIMED`,
`privateIp/publicIp`, `claimSecret`, `createdAt`; GSI on `labType+status`). Mark `WARM` when ECS reports
`healthStatus = HEALTHY` (use the EventBridge "ECS Task State Change" event rather than polling).

While unclaimed, `lab_server` **refuses all code execution** (`409 Lab task is not claimed yet`).

**How a student gets one**

```
1. Query WARM tasks for labType; conditional update one to CLAIMED (status = WARM) → atomic.
   None available → fall back to a cold RunTask with SESSION_TOKEN (old path) and show the longer progress UI.
2. POST http://<task-ip>:8080/claim
     headers: X-Claim-Secret: <claimSecret>
     body:    { "sessionToken": "<new random token>", "sessionId": "<id>",
                "bootstrap": { "url": "<presigned S3 url>", "preset": "dotnet", ... } }   # optional, same as LAB_BOOTSTRAP_* env
   200 → bound; the token now protects /execute and /api/save exactly like SESSION_TOKEN.
   409 → already claimed (race) → try the next warm task.
3. Return the session to the frontend immediately; start a replacement warm task asynchronously.
```

The claim secret and session token are **server-side only**: never send the claim secret to the browser.

**Sizing**
- Per lab type: `minWarm` (e.g. 2 for python/java/linux during class hours, 0 at night) and `maxWarm`.
- Scale on schedule: before a class starts, an EventBridge schedule raises `minWarm` for that course's lab.
- Recycle warm tasks older than e.g. 4 h (keeps images current after deploys).
- Warm tasks cost money while idle (Fargate per-second billing for their vCPU/memory). Warm only the popular labs, only
  in class hours. Heavy labs (oracle, android-emulator) are where students wait longest: warm 1 during their classes.

**Which labs can use claim**: every lab served by `lab_server.py` (all except datascience). **datascience** runs Jupyter
with no token, so a warm datascience task cannot be bound to one student; add Jupyter token support before warming it.
Labs whose entrypoint bootstraps from env at boot (android, dotnet) should pass `bootstrap` in the `/claim` body
instead.

> Security: `lab_server` now fails closed. A task started without `SESSION_TOKEN` and without
> `WARM_POOL_CLAIM_SECRET` refuses all code execution. Jupyter and noVNC need `JUPYTER_TOKEN` / `VNC_PASSWORD`.
> See [lab-access-security.md](lab-access-security.md).

### 3.2 Cold-start path (when no warm task is free)

- Use the pre-registered task definitions (`ecs_task_definition_arns` output). Never register a task definition per session.
- Cache config (task def ARNs, subnets, security groups) in the Lambda, not fetched per request.
- Call `RunTask` immediately on the start request and return `202 { status: "STARTING", sessionId }`. Don't hold the
  HTTP request open for the whole boot.
- Readiness = ECS `healthStatus = HEALTHY` (health checks exist now). Get it from the EventBridge
  `ECS Task State Change` event or `DescribeTasks` every 2–3 s. Don't use fixed sleeps.
- Expose a stage to the frontend: `QUEUED → PROVISIONING → PULLING → STARTING → READY` (map from ECS `lastStatus`:
  `PROVISIONING`, `PENDING` + `pullStartedAt`, `RUNNING` + not healthy, `RUNNING` + `HEALTHY`).
- Give slow labs more CPU: more vCPU speeds image unpacking and boot (oracle, android, bigdata already have overrides
  in `terraform/variables.tf`).
- Keep bootstrap archives small and in `ap-south-1`; use presigned URLs (S3 gateway endpoint is already in the VPC).
- Pass the right security group per lab: `lab_task_security_group_ids[labType]` (**kali** has its own restricted group).
- Only set `enableExecuteCommand` for labs that use the ECS Exec terminal.

### 3.3 Session reuse

- One active session per student per lab: if the student reloads or comes back, return the **existing** session
  (`byStudent` index on `vlab-sessions`) instead of starting another task.
- Idle timeout: stop tasks after N minutes without activity (frontend heartbeat), with a warning first.

### 3.4 Scale limits to plan for (200+ students)

- Fargate **vCPU quota** per region and **RunTask** API rate limits: check Service Quotas and request increases before
  a big class. Spread warm-pool refills (don't start 100 tasks in the same second; retry with backoff on throttling).
- Subnet IP space: each task uses one IP. Two `/24` public subnets give about 500 tasks in total.

### 3.5 AWS console labs (aws-ec2 / aws-s3 / aws-iam)

No containers, so the start is mostly DynamoDB + STS:
- Keep `MIN_FREE_ACCOUNTS` high enough that a free account is always ready: cleanup takes 5–15 min per account, so
  size the buffer for the class size, not 1.
- The start call only leases an account and creates the schedule (fast). Generate the console link **on click**
  (≈ 1 s: AssumeRole + federation call).
- Pre-raise `MIN_FREE_ACCOUNTS` before scheduled classes, the same way as warm pools.

---

## 4. Frontend

### 4.1 Make the wait shorter

- **Start on intent:** call the start API as soon as the student clicks **Start lab**, then load everything else in parallel.
- **Load UI assets while the lab boots:** editor (Monaco/CodeMirror), terminal (xterm.js) and lab instructions are
  code-split and prefetched on the lab page; render instructions immediately so the student can read while waiting.
- **Reconnect, don't restart:** keep `sessionId` in `sessionStorage`; on reload call `GET /sessions/{id}` and reattach.
  Never start a second session because of a page refresh.

### 4.2 Make the wait feel shorter

- Show the real stage from the backend (`Starting machine → Downloading tools → Starting services → Ready`), not a
  generic spinner.
- Show an expected time per lab type (from backend config, updated from real measurements). Warm-pool hits should show
  "Ready" almost instantly; don't show the long progress UI unless the backend says the start is cold.
- Poll status every 2 s while starting, every 30 s after ready; pause polling when the tab is hidden
  (`document.visibilityState`). Prefer SSE/WebSocket if the backend supports it.
- On failure, offer **Retry** (which reuses or replaces the session server-side), not a dead end.

### 4.3 While the lab runs

- Heartbeat every 60 s while the tab is visible (lets the backend stop idle tasks safely).
- Warn before idle-stop and before time-limit expiry.
- **End lab** button that really ends the session (frees capacity for others).

### 4.4 AWS console labs

- Open the console with the pattern in [aws-console-labs.md §6.4](aws-console-labs.md): blank tab synchronously on
  click, then navigate when the sign-in URL arrives (avoids pop-up blockers, no stale links).

### 4.5 Measure from the student's side

Send `labType`, `warm: true|false`, `clickToReadyMs`, `stageDurations` to analytics for every start. This is the number
that matters; compare it with the ECS timestamps from section 1 to see where time goes.

---

## 5. Per-lab cheat sheet

| Lab | Base image | Heavy parts | Warm pool? | Notes |
|---|---|---|---|---|
| python | base-python | none | Yes (popular) | Smallest; good first candidate |
| java, softwareengeering, agilemethodology | base-java | JDK | Yes | agilemethodology reuses the java image |
| linux | base-linux | none | Yes | |
| testing | base-linux | Chrome, JDK 24, Selenium, noVNC | During classes | Xvfb/VNC start in entrypoint |
| mysql, postgres | base-linux | DB server | During classes | DB pre-initialized at build |
| oracle | gvenzl/oracle-xe slim-faststart | Oracle XE | During classes, 1 | Slowest boot (`startPeriod` 300 s), 4 GB RAM |
| dotnet | base-linux (now) | .NET SDK | During classes | Pass bootstrap via `/claim` when warm |
| bigdata | base-java | Hadoop, Maven libs | During classes | HDFS pre-formatted; HDFS start in entrypoint |
| datascience | base-python | Jupyter, sklearn | Not yet | Needs Jupyter token support before warm pool |
| android | base-linux | Android SDK | During classes | Large image; bootstrap via `/claim` |
| android-emulator | base-linux | SDK + system image | During classes, 1 | Largest image; consider whether every student needs the emulator |
| redhat | Rocky Linux 9 | none | Optional | Standalone distro |
| kali | Kali rolling | curated tools | Optional | Restricted-egress security group; keep `KALI_EXTRA_PACKAGES` empty for speed |
| aws-ec2/s3/iam | none (no container) | account cleanup | Account pool buffer | See section 3.5 |
