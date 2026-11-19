# Lab access security: who can use a running lab, and how we lock it down

Audience: backend, frontend and infra developers.

## 1. The problem in plain words

Every container lab is a small computer (ECS Fargate task) with a **public IP address**. The lab's security group
lets **anyone on the internet** reach these ports:

| Port | What listens | What someone can do with it |
|---|---|---|
| 8080 | `lab_server.py`: `POST /execute`, `/api/run`, `/api/save` | **Run any code** inside the lab and write files |
| 8888 | Jupyter (data-science lab) | **Run any code**, open a terminal, read/change the student's notebooks |
| 6080 | noVNC desktop (testing lab) | **Watch and control** the student's Chrome desktop |

Public IPs in AWS are scanned by bots within minutes of being assigned. Whoever finds an open port can use it. What
protected each port before this change:

| Port | Protection before | Result |
|---|---|---|
| 8080 | `X-Session-Token` checked **only if** the task was started with `SESSION_TOKEN`. Without it, the check was skipped | Fails **open**: any start path that forgets the token (a bug, a manual `RunTask`, a future warm pool) exposes code execution to the internet |
| 8888 | **None**: Jupyter started with an empty token and password | **Open today**: every running data-science lab |
| 6080 | **None**: VNC started with `-nopw` | **Open today**: every running testing lab |

Why this matters:
- **Crypto-mining / abuse** on our AWS bill and our IP reputation (AWS may suspend the account for abuse from our IPs).
- **Attacks launched from our IPs** against third parties, which makes us responsible.
- **Students' privacy**: someone else can read, change or delete a student's work (and answers).
- **Cheating**: one student can open another student's lab.
- **Credentials inside the task**: the ECS task role credentials are reachable from code running in the task.

What the backend already does well: it generates a random 128-bit `SESSION_TOKEN` per session, passes it on
`RunTask`, and sends `X-Session-Token` on every `/execute` and `/api/save` call from the server side. So port 8080 is
protected **as long as nothing forgets the token**, but ports 8888 and 6080 are not protected at all.

## 2. What is fixed in this repo (fail closed)

| Component | New behaviour | File |
|---|---|---|
| `lab_server.py` (8080) | **No `SESSION_TOKEN` → refuses all code execution** (`503 Lab is not configured with a session token`). Warm-pool tasks refuse until claimed (`409`). Token compared in constant time. | `lab-images/common/lab_server.py` |
| Jupyter (8888) | Uses `JUPYTER_TOKEN` from the task environment. **Not set → locked with a random token nobody knows.** | `lab-images/datascience/entrypoint.sh` |
| noVNC (6080) | Uses `VNC_PASSWORD` from the task environment. **Not set → locked with a random password.** | `lab-images/testing/entrypoint.sh` |
| Migration switch | Terraform `lab_allow_unauthenticated_types` (default `["datascience", "testing"]`) keeps Jupyter/noVNC open **only** for those lab types until the backend sends the new secrets. It never re-opens port 8080. | `terraform/variables.tf`, `terraform/ecs.tf` |
| Local development | `LAB_SERVER_ALLOW_UNAUTHENTICATED=true` re-opens 8080 for local testing. **Never set in AWS.** | `lab_server.py` |

Tested locally against the real server: no token → 503; correct token → 200; wrong token → 401; the Jupyter/noVNC
migration flag does not open 8080.

## 3. Backend changes (app repo)

### 3.1 Required now

1. **Keep sending `SESSION_TOKEN`** on every `RunTask` (already done in `startEcsTask`). Every new start path
   (warm pool, retries, admin tools) must do the same.
2. **Data-science lab**: on `RunTask`, add environment `JUPYTER_TOKEN = <random, 32+ bytes, per session>`
   (a separate secret from `SESSION_TOKEN` is better, since this one ends up in the browser).
   Build the Jupyter URL as:
   ```
   http://<publicIp>:8888/notebooks/lab.ipynb?token=<JUPYTER_TOKEN>
   ```
   Jupyter exchanges the token for a cookie on first load, so the iframe keeps working.
3. **Testing lab**: on `RunTask`, add environment `VNC_PASSWORD = <8 random alphanumeric characters, per session>`
   (VNC only uses the first 8). Build the desktop URL as:
   ```
   http://<publicIp>:6080/vnc.html?autoconnect=1&resize=scale&password=<VNC_PASSWORD>
   ```
4. Store `jupyterToken` / `vncPassword` with the session (like `sessionToken`). Return the full tool URL **only** to the
   session's owner (authenticated `GET /sessions/{id}`). Never log these values.
5. **Remove the hard-coded Jupyter fallback** in `services/labTools.js`:
   ```js
   return runtime.type === "jupyter" ? "http://13.235.48.30:8888/lab" : ...
   ```
   When a task has no public IP yet, every data-science student is sent to the **same** fixed server, and that server
   has no token. Students see and change each other's work. Return a "still starting" state instead.
6. **Remove the debug `console.log`s** in `buildMainToolUrl` (they log IPs and session IDs for every request).
7. **Fix `dbms-lab`**: it points to task definition `vlab-dev-dbms-task`, which the infrastructure does not create.
   Use `mysql-lab` / `postgres-lab` / `oracle-lab` from the catalog (see [lab-catalog.md](lab-catalog.md)).

### 3.2 After the backend is deployed

8. Infra: set `lab_allow_unauthenticated_types = []` in Terraform and apply. Jupyter and noVNC are then locked unless
   the backend passed the secret.
9. Verify: start a data-science lab and open `http://<ip>:8888/` **without** the token; you must get a login page.
   Open `http://<ip>:6080/vnc.html` without the password; it must ask for one. `curl -X POST http://<ip>:8080/execute`
   without the header must return `401`.

### 3.3 Recommended next (bigger changes)

The fixes above stop anonymous access. Two weaknesses remain, and fixing them needs a proxy:

| Remaining weakness | Why | Fix |
|---|---|---|
| Plain HTTP over the internet | Tokens and student code travel unencrypted between browser/backend and the lab. HTTPS pages also block `http://` iframes (mixed content) | Put labs behind HTTPS |
| Lab ports open to `0.0.0.0/0` | Bots can still find the lab, and can try to guess the 8-character VNC password | Only the proxy may reach the labs |

Target design: a **reverse proxy with TLS** (e.g. an ALB with HTTPS + listener rules per session, or a small proxy
service on the backend side) at `https://labs.<your-domain>/s/<sessionId>/...`. The proxy checks the student's login
and session ownership, then forwards to the task's **private IP**. Then:
- set `lab_browser_ingress_cidr_blocks = []` and put the proxy's security group in `lab_control_plane_security_group_ids`;
- the backend calls `lab_server` on the **private IP** (it is already stored as `taskPrivateIp`);
- tasks no longer need public IPs if the VPC gets NAT or VPC endpoints for ECR/S3/logs (cost trade-off).

## 4. Frontend changes

1. Use the tool URLs exactly as returned by the backend (they now carry `?token=` / `password=`). Don't build lab URLs
   in the browser from an IP.
2. Never put the token or URL into localStorage, analytics, error reports or logs. Keep it in memory for the open page.
3. If the Jupyter iframe shows a login page or the noVNC page asks for a password, treat it as "session secret
   missing". Show "Reconnect" (re-fetch the session) rather than asking the student for a password.
4. When HTTPS proxying is introduced (3.3), switch iframes to the `https://labs.<domain>/...` URLs. No other change.

## 5. Checklist

- [ ] Backend sends `SESSION_TOKEN` on every RunTask path (incl. warm pool: `WARM_POOL_CLAIM_SECRET` + `/claim`)
- [ ] Backend sends `JUPYTER_TOKEN` (data science) and `VNC_PASSWORD` (testing); URLs include them
- [ ] Hard-coded Jupyter IP fallback removed
- [ ] Debug logging of IPs/session IDs removed
- [ ] `dbms-lab` replaced
- [ ] `lab_allow_unauthenticated_types = []` applied
- [ ] Manual verification (3.2 step 9) done
- [ ] HTTPS proxy planned (3.3)
