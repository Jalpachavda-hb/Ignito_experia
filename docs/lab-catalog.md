# Lab catalog: levels, topics and lab metadata

Audience: backend and frontend developers.

[`catalog/labs.json`](../catalog/labs.json) is the **single source of truth** for what each lab is: its level
(Foundation / Intermediate / Advanced), topics, what it does **not** cover, prerequisites, duration, how the UI opens
it, and which infrastructure it uses. CI runs [`catalog/validate.py`](../catalog/validate.py) on every push. It fails
if the catalog is malformed or if a container lab has no matching Terraform task definition.

Presentation fields (logo, rating, review count, semester, credits) stay in the backend's own config and are joined
on `id`.

## 1. Levels

| `level` | Badge label | Meaning |
|---|---|---|
| `foundation` | Foundation | First hands-on contact with the subject. Guided tasks, core commands and concepts |
| `intermediate` | Intermediate | Multi-step tasks, real tooling, troubleshooting |
| `advanced` | Advanced | Open-ended, multi-component or production-style scenarios |

`levels.<key>.order` (1–3) is for sorting. Labels and descriptions are in the file, so the UI doesn't hard-code them.

No lab is `advanced` today. The level describes **what the environment can support**, and none currently runs
multi-machine or production-style scenarios. When advanced labs are added (e.g. VM-based RHCSA, Kali with vulnerable
networks, multi-service AWS), they get their own catalog entries.

## 2. Labs at a glance

| id | Level | Kind | Notes |
|---|---|---|---|
| python-lab | Foundation | container | |
| java-lab | Intermediate | container | |
| linux-lab | Foundation | container | |
| mysql-lab | Intermediate | container | **Replaces `dbms-lab`** |
| postgres-lab | Intermediate | container | New |
| oracle-lab | Intermediate | container | New; slow start |
| data-science-lab | Intermediate | container | **Was "Advanced"** |
| big-data-lab | Intermediate | container | **Was "Advanced"; no Spark** |
| testing-lab | Intermediate | container | Extra tool: noVNC desktop |
| agile-lab | Foundation | container | |
| software-eng-lab | Intermediate | container | |
| mobile-app-lab | Intermediate | container | **Android/Java, not Flutter/React Native** |
| android-emulator-lab | Intermediate | container | New |
| dotnet-lab | Intermediate | container | |
| redhat-lab | Foundation | container | New; "RHCSA Part 1" |
| kali-lab | Foundation | container | New; restricted network |
| aws-ec2-lab | Foundation | aws-console | New; real AWS console |
| aws-s3-lab | Foundation | aws-console | New; real AWS console |
| aws-iam-lab | Foundation | aws-console | New; real AWS console |

### Corrections to the current backend config (`config/labs.js`)

These are mismatches between what the labs claim and what the environments actually contain:

| Lab | Current | Correct | Why |
|---|---|---|---|
| `dbms-lab` | `taskDefinition: vlab-dev-dbms-task` | `mysql-lab` / `postgres-lab` / `oracle-lab` | That task definition is not created by the infrastructure, so starting it fails |
| `data-science-lab` | `complexity: "Advanced"` | Intermediate | One notebook, pandas/scikit-learn, small CPU, no deep learning or big data |
| `big-data-lab` | "Advanced", "Hadoop, **Spark**" | Intermediate, no Spark | Single-node HDFS + Java libraries; Spark is not installed |
| `mobile-app-lab` | "React Native or Flutter" | Native Android (Java) | Image has Android SDK + Gradle + Java only |

## 3. Field reference

| Field | Type | Used by | Meaning |
|---|---|---|---|
| `id` | string | both | Stable lab ID (matches the backend's existing IDs) |
| `labType` | string | backend | Value for `LAB_TYPE` / `labType`; for containers it equals the Terraform lab type |
| `kind` | `container` \| `aws-console` | both | Container lab (ECS) or real AWS console lab ([aws-console-labs.md](aws-console-labs.md)) |
| `title`, `category` | string | frontend | Display |
| `level` | `foundation` \| `intermediate` \| `advanced` | both | Badge + filtering |
| `levelNote` | string | frontend | One-line explanation shown in the tooltip / details |
| `topics` | string[] | frontend | "What you'll practise" list |
| `notCovered` | string[] | frontend | "Not included in this lab" list (sets expectations) |
| `prerequisites` | lab id[] | frontend | "Recommended before" links |
| `nextLabs` | lab id[] | frontend | "Continue with" links |
| `durationMinutes` | int | both | Session length / time-limit default |
| `ui.type` | `ide` \| `web` \| `jupyter` \| `aws-console` | both | How the main tool opens |
| `ui.port`, `ui.path` | | backend | Builds the tool URL (for `aws-console`, `path` is the console destination) |
| `extraTools[]` | `{type, port, path}` | both | Additional tools (e.g. `vnc` on 6080 for testing-lab) |
| `infra.taskDefinitionFamily` | string | backend | ECS task definition family for `RunTask` |
| `infra.securityGroup` | `default` \| `kali` | backend | Which Terraform output SG to use (`lab_task_security_group_ids[labType]`) |
| `infra.healthPort` | int | backend | Port the ECS health check probes |
| `infra.warmPool` | `yes` \| `class-hours` \| `no` | backend | Warm-pool policy ([lab-startup-optimization.md](lab-startup-optimization.md)) |
| `infra.consoleRole` | string | backend | AWS console labs: sandbox role to assume |
| `sessionEnv` | string[] | backend | Environment variables the backend **must** pass on `RunTask` |
| `status` | `ready` \| `new` \| `beta` \| `retired` | both | `new` → "New" ribbon; `retired` → hide from catalog |

## 4. Backend instructions

1. **Load the catalog** at build/deploy time (copy `catalog/labs.json` into the app bundle, or read it from the
   lab-files S3 bucket). Join it with the presentation fields in `config/labs.js` on `id`.
2. **Replace `complexity` with `level`.** Keep `complexity` in the API response for one release for old clients,
   derived from `level`: `foundation → "Beginner"`, `intermediate → "Intermediate"`, `advanced → "Advanced"`.
3. `GET /labs` returns, per lab: `id, title, category, level, levelLabel, levelNote, topics, notCovered,
   prerequisites, nextLabs, durationMinutes, kind, status` + the existing presentation fields. Support filters
   `?level=foundation` and `?kind=aws-console`. Return the `levels` map too (labels, order, descriptions).
4. **Starting a lab:**
   - `kind = container`: `RunTask` with `infra.taskDefinitionFamily`, the security group for `infra.securityGroup`, and
     **every variable in `sessionEnv`** (generate `SESSION_TOKEN`, `JUPYTER_TOKEN`, `VNC_PASSWORD` per session; see
     [lab-access-security.md](lab-access-security.md)).
   - `kind = aws-console`: use the AWS console flow with `infra.consoleRole` ([aws-console-labs.md](aws-console-labs.md)).
5. Apply the corrections in section 2 (dbms-lab, data science, big data, mobile).
6. Never trust `level` or other catalog values sent by the client; always read them from the catalog.

## 5. Frontend instructions

1. **Level badge** on every lab card and on the lab page header, from `levelLabel`:

   | Level | Suggested style |
   |---|---|
   | Foundation | Green / "1 bar" icon |
   | Intermediate | Amber / "2 bars" icon |
   | Advanced | Red or purple / "3 bars" icon |

   Use text **and** colour/icon (not colour alone) for accessibility. Tooltip = `levelNote`.
2. **Filters and sorting** on the catalog page: level (multi-select), category, kind ("Cloud console" vs "Hands-on
   environment"). Sort by `levels[level].order`, then title.
3. **Lab details page** sections:
   - "What you'll practise" → `topics`
   - "Not included" → `notCovered` (collapsed by default)
   - "Recommended before" → `prerequisites` (links); show a soft warning, not a block, if the student hasn't done them
   - "Continue with" → `nextLabs`
   - Duration → `durationMinutes`
4. **Ribbons:** `status = new` → "New"; `beta` → "Beta"; hide `retired`.
5. **Opening the lab** depends on `ui.type`:
   - `ide` / `web`: existing flow
   - `jupyter`: iframe the URL the backend returns (it contains `?token=`)
   - `aws-console`: new-tab flow from [aws-console-labs.md §6.4](aws-console-labs.md)
   - `extraTools` with `type = vnc`: second tab/panel "Browser desktop" with the backend-provided URL
6. Don't hard-code level names, topics or durations in the UI; everything comes from `GET /labs`.

## 6. Changing the catalog

1. Edit `catalog/labs.json`.
2. Run `python3 catalog/validate.py` (CI runs it too).
3. A new **container** lab also needs: an image under `lab-images/<labType>/`, the type in `terraform/variables.tf`
   `lab_types`, and the build entry in `.github/workflows/deploy.yml`. The validator fails until the Terraform type exists.
4. Tell the backend team: they redeploy to pick up the new catalog.
