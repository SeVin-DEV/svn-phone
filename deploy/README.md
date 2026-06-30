# Cloud Phone Manager — Self-Hosted Deployment

One-command deploy on any Linux server with Docker.

## Prerequisites

On your Linveo server (Debian 12):

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Kernel modules required by Redroid
modprobe binder_linux
modprobe ashmem_linux    # kernels < 5.18 only

# Make binder_linux load on boot
echo "binder_linux" >> /etc/modules

# Pull the Redroid base image you want
docker pull redroid/redroid:14.0.0-latest
docker pull redroid/redroid:13.0.0-latest
```

## Deploy

```bash
# 1. Clone the repo
git clone https://github.com/SeVin-DEV/svn-phone.git
cd svn-phone/deploy

# 2. Set secrets
cp .env.example .env
nano .env   # fill SESSION_SECRET and POSTGRES_PASSWORD

# 3. Launch everything
docker compose up -d

# 4. Check it's healthy
docker compose ps
docker compose logs -f api
```

The web UI is now available at `http://<server-ip>:3080`.

## Expose on your domain

See `caddy-tunnel.md` for Caddy or Cloudflare Tunnel instructions to serve on `phone.svn-dev.online`.

## Data locations (inside named volumes)

| Volume | Contents |
|--------|----------|
| `rom_data` | ROM image files uploaded via the UI |
| `emulator_data` | Per-emulator user data, ADB keys |
| `postgres_data` | Database |

All volumes persist across `docker compose down` and rebuilds. To fully wipe: `docker compose down -v`.

## Update

```bash
git pull
docker compose up -d --build
```

## Redroid prerequisites

Each Redroid container runs Android in a Docker container. Your host kernel needs:

- `binder_linux` module loaded (`modprobe binder_linux`)
- Docker socket accessible (mounted automatically by compose)
- Privileged containers allowed (compose sets this)

## QEMU prerequisites

QEMU emulators run directly as processes inside the API container. The compose file mounts `/dev/kvm` for hardware acceleration. KVM requires:

- The host CPU supports virtualisation (check with `kvm-ok`)
- `apt install cpu-checker && kvm-ok`

For ARM ROMs on an x86 server, KVM won't help — QEMU will use pure software emulation (TCG). It works but is slower. See the ARM emulation note in the app docs.
