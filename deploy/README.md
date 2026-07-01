# Cloud Phone Manager — Self-Hosted Deployment

One command, on a fresh Linux server with Docker: `./setup.sh`.

## Deploy

```bash
git clone https://github.com/SeVin-DEV/svn-phone.git
cd svn-phone/deploy
./setup.sh
```

The script is interactive and safe to re-run. It will:

1. Install Docker (if missing) and verify the Compose plugin
2. Load the `binder_linux` kernel module Redroid needs (and persist it across reboots)
3. Generate `deploy/.env` with strong random secrets (skipped if one already exists)
4. Build the images, start Postgres, run the DB migration, then start the API + web containers
5. Wait for everything to report healthy and print clear diagnostics if something didn't come up
6. Ask how you want to expose your domain — Cloudflare Tunnel, Caddy, or skip and wire up your own ingress — and configure it for you

When it finishes, the app is reachable locally at `http://127.0.0.1:3080` and (if you configured ingress) at your domain over HTTPS.

## Manual setup

If you'd rather not run the script:

```bash
cp .env.example .env
nano .env                     # fill SESSION_SECRET and POSTGRES_PASSWORD
docker compose build
docker compose up -d postgres
docker compose run --rm migrate
docker compose up -d api web
```

The app listens on `127.0.0.1:3080` — it does **not** bind to the public interface. Point a reverse proxy or tunnel at that address; see `caddy-tunnel.md` for the exact commands `setup.sh` runs for each option.

## Update after a git pull

```bash
cd svn-phone/deploy
git pull
docker compose up -d --build
```

Migrations don't run automatically on update — run `docker compose run --rm migrate` first if the DB schema changed.

## Data locations (named volumes)

| Volume | Contents |
|--------|----------|
| `rom_data` | ROM image files uploaded via the UI |
| `emulator_data` | Per-emulator user data, ADB keys |
| `postgres_data` | Database |

All volumes persist across `docker compose down` and rebuilds. To fully wipe: `docker compose down -v`.

## Redroid prerequisites

Each Redroid container runs Android in a Docker container. Your host kernel needs:

- `binder_linux` module loaded (`setup.sh` does this for you; manually: `modprobe binder_linux`)
- Docker socket accessible (mounted automatically by compose)
- Privileged containers allowed (compose sets this)

## QEMU prerequisites

QEMU emulators run directly as processes inside the API container. Compose mounts `/dev/kvm` for hardware acceleration.

- Check your host supports virtualization: `apt install cpu-checker && kvm-ok`
- Without KVM (e.g. ARM ROMs on an x86 host), QEMU falls back to software emulation (TCG) — it works, just slower.

## Troubleshooting

- `docker compose ps` — see which containers are up/healthy
- `docker compose logs -f api` / `web` / `migrate` — tail logs for a specific service
- App loads but shows the stock Nginx page → the web image didn't get built with the latest fix; rebuild with `docker compose up -d --build web`
- `docker compose run --rm migrate` fails → check `DATABASE_URL` in `.env` and that `postgres` is healthy (`docker compose ps postgres`)
- Domain shows a Cloudflare error / connection refused → check `systemctl status cloudflared` (or `caddy`) on the host, and that it's forwarding to `127.0.0.1:3080`, not `:80`
