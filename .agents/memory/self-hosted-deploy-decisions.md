---
name: Cloud Phone Manager self-hosted deploy decisions
description: Durable decisions about the deploy/ Docker Compose stack for the Android emulator manager — read before touching deploy/*.
---

## Port ownership: container never binds the public interface directly
The `web` (nginx) container is bound to `127.0.0.1:3080`, never `0.0.0.0:80`. A single
host-level ingress (Cloudflare Tunnel or Caddy, set up by `deploy/setup.sh`) owns the
public 80/443 and forwards to `127.0.0.1:3080`.

**Why:** the original compose file bound the container straight to `0.0.0.0:80`, which
fought with any host-level reverse proxy/Caddy also trying to grab port 80 — this was the
root cause of the "Address already in use" Nginx crash loop the user hit in production.

**How to apply:** never change the `web` service's port mapping back to a `0.0.0.0:*`
bind. If a new ingress method is added, it must forward to `127.0.0.1:3080`.

## Docker images must copy every pnpm-workspace.yaml member's package.json
`Dockerfile.api` and `Dockerfile.web` each COPY individual `package.json` files before
running `pnpm install --frozen-lockfile`, rather than the whole tree (for layer caching).

**Why:** the workspace has a `scripts` package (and any future `lib/*` addition) declared
in `pnpm-workspace.yaml`. If a workspace member's `package.json` isn't copied before
`pnpm install --frozen-lockfile`, pnpm rejects the install because the lockfile references
a package it can't find — this was one of the deploy failures reported by the user.

**How to apply:** whenever a new package is added under `artifacts/*`, `lib/*`, or
`scripts`, add its `package.json` COPY line to both Dockerfiles (both build stages of
`Dockerfile.api`, since the runtime stage re-installs `--prod` separately from the builder
stage).

## DB migrations must run against the builder stage, not the runtime image
`docker-compose.yml`'s `migrate` service builds `Dockerfile.api` with `target: builder`.

**Why:** the runtime stage installs with `pnpm install --frozen-lockfile --prod`, which
prunes `drizzle-kit` (a devDependency of `@workspace/db`). Running migrations against the
production image always failed with a missing binary — this was the actual cause of the
"migrate container crash" / "npx drizzle-kit missing flags" symptoms the user reported
(the fragile inline `node -e` wrapper masked the real error). The migrate command is now
just `pnpm --filter @workspace/db run push`.

## Vite outDir vs. Dockerfile.web COPY path
`artifacts/cloud-phone/vite.config.ts` sets `build.outDir` to `dist/public`, not `dist/`.

**Why:** `Dockerfile.web` was copying `dist/` into the nginx image, which never contained
`index.html` — nginx silently fell back to its stock "Welcome to nginx" page instead of
erroring. This was the cause of the "phantom nginx welcome splash" in production. Always
copy `dist/public/`, and keep this in sync if `vite.config.ts`'s `outDir` ever changes.
