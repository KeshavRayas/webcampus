# WebCampus Deployment Guide

Deployment target: a **college server** with a static IP, running Docker + Docker Compose.
Images are built in CI and pushed to **GitHub Container Registry (GHCR)**; the server pulls and runs them.

## Branch model

```
feature branches (academic, admission, ...)
        │  PR (lint + types + build + e2e must pass)
        ▼
      dev ── integration branch; accepts direct pushes; PRs to dev run the full checks
        │  PR (full checks must pass + 1 review)
        ▼
     main ── production; LOCKED (PR-only); merge to main triggers build+push+deploy
```

- **`main`** — production branch. Cannot be pushed to directly. Only updated via PR (protected: requires passing `checks` job + 1 approving review).
- **`dev`** — integration branch. Feature branches PR into it. Also accepts direct pushes (each push re-runs `checks`).
- **Feature branches** — work happens here (e.g. `academic`, `admission`, `coeffix-…`). PR → `dev`.

Once a PR is merged to `main`, the pipeline runs the full `checks` job **again**, then builds + pushes images to GHCR and deploys to the server. If any check fails, nothing deploys.

## Pipeline (`.github/workflows/ci-cd.yaml`)

### Job 1 — `checks` (runs on PR → main/dev, push → main/dev)

1. `bun install` (dummy DB env vars so postinstall `prisma generate` succeeds)
2. `bun run lint`
3. `bun run check-types`
4. `bun run build` (turbo → API tsup bundle + web Next build, with `NEXT_PUBLIC_*` set)
5. **Docker build** both images (`apps/api/Dockerfile`, `apps/web/Dockerfile`) to verify the exact production artifacts
6. **Playwright E2E** — boots the full docker stack + app and runs `packages/playwright-web` tests

If anything fails → PR is blocked; the deploy job never starts.

### Job 2 — `deploy` (only on push/merge to `main`, after `checks` passes)

1. Build API + web images and **push to GHCR**:
   - `ghcr.io/keshavrayas/webcampus/api:{latest, sha-<commit>}`
   - `ghcr.io/keshavrayas/webcampus/web:{latest, sha-<commit>}`
2. SSH into the server:
   - `git checkout main && git pull`
   - `docker login ghcr.io` (PAT)
   - `docker compose -f compose.prod.yaml pull`
   - `docker compose -f compose.prod.yaml up -d` — the one-shot `migrate` service runs `prisma migrate deploy` (unpooled URL) first; `api`/`web` start only after it completes successfully.

## Architecture (from `compose.prod.yaml`)

| Service     | Image                                      | Notes                                                        |
| ----------- | ------------------------------------------ | ------------------------------------------------------------ |
| `db`        | `postgres:15-alpine`                       | named volume `postgres_data`; healthcheck `pg_isready`       |
| `minio`     | `minio/minio:RELEASE.2025-09-07T16-13-09Z` | named volume `minio_data`; healthcheck `/minio/health/ready` |
| `pgbouncer` | `edoburu/pgbouncer:v1.25.2-p0`             | pools `db:5432` → `6432`; credentials from `.env`            |
| `redis`     | `redis:7-alpine`                           | 1GB / `allkeys-lru` / AOF; named volume `redis_data`         |
| `migrate`   | `ghcr.io/.../api`                          | one-shot `prisma migrate deploy`, `restart: "no"`            |
| `api`       | `ghcr.io/.../api`                          | Express on Bun, port `8080`, `env_file: .env`                |
| `web`       | `ghcr.io/.../web`                          | Next.js (`next start`), port `3000`, `env_file: .env`        |

All data lives in **named volumes** (Docker-managed, outside the repo tree). `NEXT_PUBLIC_*` values are baked into the web image at build time; everything else comes from the server's root `.env` at runtime.

---

## One-time setup — YOU must do these

### A. GitHub (repo: `KeshavRayas/webcampus`)

**1. Create the `dev` branch**

```bash
git fetch origin
git branch dev origin/main
git push origin dev
```

**2. Add repository secrets** (Settings → Secrets and variables → Actions → New repository secret)

| Secret                     | Value                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `SERVER_HOST`              | college server IP (e.g. `203.0.113.10`)                                                                  |
| `SERVER_USER`              | SSH user (e.g. `deploy`)                                                                                 |
| `SERVER_SSH_KEY`           | private SSH key (see Server setup, step 3)                                                               |
| `SERVER_PORT`              | SSH port, usually `22`                                                                                   |
| `GHCR_TOKEN`               | PAT with `repo` + `read:packages` scopes — the server uses it to pull images **and** `git pull` the repo |
| `NEXT_PUBLIC_API_BASE_URL` | `http://<SERVER_IP>:8080`                                                                                |
| `NEXT_PUBLIC_FRONTEND_URL` | `http://<SERVER_IP>:3000`                                                                                |

**3. Create the GHCR/repo PAT** (for `GHCR_TOKEN` above)

- GitHub → avatar → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
- Scopes: `repo` (so the server can `git pull`) + `read:packages` (so the server can pull images) — CI push uses the automatic `GITHUB_TOKEN`
- Copy the token into the `GHCR_TOKEN` secret.

**4. Protect `main`** (Settings → Branches → Add branch protection rule)

- Branch name pattern: `main`
- ✅ Require a pull request before merging → Require approvals: **1**
- ✅ Require status checks to pass before merging → add **`checks`** (the job name) → Require branches to be up to date
- ❌ Leave "Allow force pushes" / "Allow deletions" **unchecked**

### B. College server (first time only)

**1. Install Docker + Compose plugin**

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
docker compose version   # must be v2
```

**2. Clone the repo** (as the deploy user)

```bash
sudo adduser deploy && sudo usermod -aG docker deploy
su - deploy
# HTTPS clone + store the PAT so `git pull` works non-interactively:
git clone https://github.com/KeshavRayas/webcampus.git
cd webcampus
echo "https://<PAT>:@github.com" >> ~/.git-credentials
git config --global credential.helper store
git checkout main
```

(You can reuse the same PAT you put in the `GHCR_TOKEN` secret — it has `repo` scope.)

**3. Create the `.env`** — the single source of truth (copy the committed template and fill real secrets + the server IP):

```bash
cp .env.example .env
nano .env
```

Production values that must differ from the template:

- `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD` — strong random values
- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
- `GMAIL_APP_PASSWORD`, `SENDER_EMAIL`
- `ADMIN_USER_PASSWORD`, `ADMISSION_USER_PASSWORD`
- `DATABASE_URL` → `postgresql://postgres:<pw>@pgbouncer:6432/webcampus?connection_limit=20&pgbouncer=true`
- `DATABASE_UNPOOLED_URL` → `postgresql://postgres:<pw>@db:5432/webcampus`
- `REDIS_URL` → `redis://redis:6379`
- `MINIO_ENDPOINT` → `http://<SERVER_IP>:9000`
- `PUPPETEER_EXECUTABLE_PATH` → `/usr/bin/chromium`
- `NEXT_PUBLIC_API_BASE_URL` → `http://<SERVER_IP>:8080`
- `NEXT_PUBLIC_FRONTEND_URL` → `http://<SERVER_IP>:3000`
- `IMAGE_TAG` → `latest` (change to a `sha-…` tag to roll back)

`.env` is git-ignored — `git pull`/`git checkout` will never overwrite it.

**4. Allow GitHub Actions to SSH in**

- Create a keypair locally once, store the **private** key as the `SERVER_SSH_KEY` secret, and add the **public** key to the server:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/webcampus_deploy
# private key → GitHub secret SERVER_SSH_KEY
cat ~/.ssh/webcampus_deploy.pub
# on the server:
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "<public key>" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
```

**5. Pre-pull images once** (so the first deploy is fast) — or just let the pipeline do it.

---

## Daily workflow — complete flow from branch to deploy

### Step 1 — You make changes (local)

```bash
git checkout main && git pull
git checkout -b admission-feature      # feature branch off main
# ... code ...
git add . && git commit -m "..."
git push -u origin admission-feature   # push branch to GitHub
```

Nothing runs yet — GitHub only acts when you open a PR or push to `dev`/`main`.

### Step 2 — Open a PR → `dev`

```
GitHub UI: create PR  admission-feature → dev
```

The **`checks`** job auto-starts on the PR and blocks merge until green:

1. `bun install` (with dummy DB env so postinstall `prisma generate` succeeds)
2. Boot the docker stack (`cp .env.example .env` + `docker compose up -d --wait`)
3. `bun run lint`
4. `bun run check-types`
5. `bun run build` (turbo: API tsup bundle + web Next build)
6. `docker build` the API + web images (verifies the exact production artifacts)
7. **E2E**: `db:push` → `bootstrap` → `seed:ci` (creates `dept.cs`/`faculty.cs` **only in this throwaway CI stack**) → `bun run e2e:test` (28 Playwright specs)

If any step fails → PR blocked: fix + push, checks re-run. When green, merge the PR into `dev`. _(Pushing directly to `dev` also triggers `checks`; `deploy` never runs on `dev`.)_

### Step 3 — Integration on `dev`

Each merge/push to `dev` re-runs `checks` — this is your integration safety net. Nothing deploys from `dev`.

### Step 4 — Open a PR → `main`

```
GitHub UI: create PR  dev → main
```

- `checks` runs again on the PR.
- `main` is **protected**: needs the `checks` status + **1 approving review**. It cannot be pushed to directly.
- Merge only when both pass.

### Step 5 — Merge to `main` → `deploy` job

Merging pushes a commit to `main`, which triggers:

1. `checks` runs **again** on the push (full gate, E2E included).
2. `deploy` runs **only if `checks` passed**:
   - `docker login ghcr.io` (via the automatic `GITHUB_TOKEN`)
   - Build + push **API** → `ghcr.io/keshavrayas/webcampus/api:{latest, sha-<sha>}`
   - Build + push **Web** → `ghcr.io/keshavrayas/webcampus/web:{latest, sha-<sha>}` (`NEXT_PUBLIC_*` passed as build args from secrets)
   - SSH into the server:

     ```bash
     cd ~/webcampus
     git fetch && git checkout main && git pull
     echo "$GHCR_TOKEN" | docker login ghcr.io --password-stdin
     docker compose -f compose.prod.yaml pull
     docker compose -f compose.prod.yaml up -d
     ```

   - `docker compose up -d` resolves the dependency chain: **`db` healthy → `pgbouncer`/`redis`/`minio` healthy → `migrate` (one-shot `prisma migrate deploy` via the unpooled URL) → `api` healthy → `web`**.
   - **No seeding runs here** — migrations only. Admin/department/faculty accounts are whatever exists in the server DB (created manually via `bun run bootstrap` or the admin UI).

### Step 6 — Live

The new version is up. The previous image is still tagged `sha-<previous>`, so you can roll back any time.

### Rollback

```bash
cd ~/webcampus
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-abc1234/' .env   # previous sha tag
docker compose -f compose.prod.yaml up -d
```

The `checks` job name is what you add to the `main` branch protection rule — the deploy never runs unless it's green.

## Manual operations on the server

```bash
cd ~/webcampus
docker compose -f compose.prod.yaml ps          # status
docker compose -f compose.prod.yaml logs -f api  # API logs
docker compose -f compose.prod.yaml logs -f web  # web logs
docker compose -f compose.prod.yaml up -d --no-deps migrate  # re-run migrations
```

## Backups (step 7 placeholder)

Named volumes live under `/var/lib/docker/volumes/`. Backup recipes (pg_dump + MinIO/Redis snapshots) will be added in step 7.

## Known constraints / notes

- The API runtime is **Bun** (workspace packages are TypeScript source); images run on `oven/bun`.
- Chromium is installed in the API image for Puppeteer hall-ticket PDFs; the BMSCE logo is copied to `/app/bmsce.svg` and referenced via `BMSCE_LOGO_PATH`.
- `NEXT_PUBLIC_*` are baked at build time — changing them requires a rebuild (a new merge to `main`).
- Images are intentionally not optimized for size (full `node_modules`, `next start`) for monorepo reliability.
