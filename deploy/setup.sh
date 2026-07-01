#!/usr/bin/env bash
# ── Cloud Phone Manager — one-run interactive deploy ─────────────────────────
#
# Run this from a clean checkout on your Linux server (Debian 12 tested):
#
#   cd svn-phone/deploy
#   ./setup.sh
#
# It will:
#   1. Check/install Docker + the Compose plugin
#   2. Check/load the kernel modules Redroid needs (binder_linux)
#   3. Generate deploy/.env with strong secrets (or reuse an existing one)
#   4. Build and start Postgres, run the DB migration, start the API + web
#   5. Wait for every service to report healthy, with clear diagnostics if not
#   6. Optionally wire up your domain via Cloudflare Tunnel or Caddy
#
# Safe to re-run — it skips steps that are already done and only touches what
# changed.
set -euo pipefail

# ── helpers ───────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

c_reset='\033[0m'; c_bold='\033[1m'; c_green='\033[32m'; c_yellow='\033[33m'; c_red='\033[31m'; c_blue='\033[34m'
step()  { echo -e "\n${c_bold}${c_blue}▶ $*${c_reset}"; }
ok()    { echo -e "  ${c_green}✓${c_reset} $*"; }
warn()  { echo -e "  ${c_yellow}!${c_reset} $*"; }
fail()  { echo -e "  ${c_red}✗ $*${c_reset}"; exit 1; }
ask()   { # ask "prompt" "default" -> echoes answer
  local prompt="$1" default="${2:-}" answer
  if [ -n "$default" ]; then
    read -r -p "  $prompt [$default]: " answer || true
    echo "${answer:-$default}"
  else
    read -r -p "  $prompt: " answer || true
    echo "$answer"
  fi
}
confirm() { # confirm "prompt" -> 0/1, defaults to yes
  local prompt="$1" answer
  read -r -p "  $prompt [Y/n]: " answer || true
  [[ -z "$answer" || "$answer" =~ ^[Yy] ]]
}

if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
  command -v sudo >/dev/null 2>&1 || fail "This script needs root or sudo. Re-run as root."
else
  SUDO=""
fi

echo -e "${c_bold}Cloud Phone Manager — deploy setup${c_reset}"
echo "  Working directory: $SCRIPT_DIR"

# ── 1. Docker ─────────────────────────────────────────────────────────────
step "Checking Docker"
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker not found."
  if confirm "Install Docker now via get.docker.com?"; then
    curl -fsSL https://get.docker.com | $SUDO sh
    ok "Docker installed"
  else
    fail "Docker is required. Install it and re-run this script."
  fi
else
  ok "Docker present: $(docker --version)"
fi

if ! docker compose version >/dev/null 2>&1; then
  fail "The 'docker compose' plugin is missing (docker-compose v1 standalone is not supported). Reinstall Docker via get.docker.com."
fi
ok "Compose plugin present: $(docker compose version --short 2>/dev/null || echo present)"

if ! $SUDO docker ps >/dev/null 2>&1; then
  fail "Cannot talk to the Docker daemon. Is it running? (systemctl start docker)"
fi
ok "Docker daemon reachable"

# ── 2. Kernel modules for Redroid ───────────────────────────────────────────
step "Checking Redroid kernel prerequisites"
if lsmod | grep -q '^binder_linux'; then
  ok "binder_linux already loaded"
else
  warn "binder_linux not loaded — required for Redroid (Android-in-Docker) emulators."
  if confirm "Load binder_linux now and persist it across reboots?"; then
    $SUDO modprobe binder_linux 2>/dev/null || warn "modprobe binder_linux failed — your kernel may need CONFIG_ANDROID_BINDER_IPC or a custom kernel. Redroid emulators won't work until this is resolved; QEMU/AVD emulators are unaffected."
    if lsmod | grep -q '^binder_linux'; then
      grep -qxF 'binder_linux' /etc/modules 2>/dev/null || echo 'binder_linux' | $SUDO tee -a /etc/modules >/dev/null
      ok "binder_linux loaded and persisted in /etc/modules"
    fi
  else
    warn "Skipping — Redroid emulators will fail to start until this module is loaded."
  fi
fi

if command -v kvm-ok >/dev/null 2>&1; then
  kvm-ok >/dev/null 2>&1 && ok "KVM acceleration available" || warn "KVM not available — QEMU emulators will fall back to slower software emulation (TCG)."
else
  warn "cpu-checker not installed — skipping KVM check (QEMU will still work, just possibly without hardware acceleration). Install with: apt install cpu-checker"
fi

# ── 3. .env ──────────────────────────────────────────────────────────────
step "Configuring secrets (deploy/.env)"
if [ -f .env ]; then
  ok "Reusing existing deploy/.env"
else
  SESSION_SECRET="$(openssl rand -hex 32)"
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  cat > .env <<EOF
SESSION_SECRET=$SESSION_SECRET
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF
  chmod 600 .env
  ok "Generated deploy/.env with random secrets (chmod 600)"
fi

# ── 4. Build + start ────────────────────────────────────────────────────
step "Building images (this can take a few minutes on first run)"
$SUDO docker compose build

step "Starting Postgres and waiting for it to be healthy"
$SUDO docker compose up -d postgres
tries=0
until $SUDO docker compose ps postgres --format json 2>/dev/null | grep -q '"Health":"healthy"'; do
  tries=$((tries + 1))
  if [ "$tries" -gt 30 ]; then
    fail "Postgres never became healthy. Check: docker compose logs postgres"
  fi
  sleep 2
done
ok "Postgres healthy"

step "Running database migration"
if ! $SUDO docker compose run --rm migrate; then
  fail "Migration failed. Check the output above — common causes: DATABASE_URL wrong, or the schema has a conflicting change. Re-run with: docker compose run --rm migrate"
fi
ok "Database schema up to date"

step "Starting API + web"
$SUDO docker compose up -d api web

step "Waiting for the API to respond"
tries=0
until curl -fsS "http://127.0.0.1:3080/api/healthz" >/dev/null 2>&1 || curl -fsS "http://127.0.0.1:3080/" >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -gt 30 ]; then
    warn "The app isn't responding on 127.0.0.1:3080 yet."
    warn "Check logs with: docker compose logs -f api web"
    break
  fi
  sleep 2
done
if curl -fsS "http://127.0.0.1:3080/" >/dev/null 2>&1; then
  ok "App responding on http://127.0.0.1:3080"
fi

$SUDO docker compose ps

# ── 5. Ingress (domain + TLS) ───────────────────────────────────────────
step "Domain + HTTPS setup"
echo "  The app is running locally on 127.0.0.1:3080. To reach it from the"
echo "  internet on your domain, pick how this host should be exposed:"
echo "    1) Cloudflare Tunnel — no open ports needed, works behind NAT"
echo "    2) Caddy reverse proxy — needs 80/443 open, auto TLS via Let's Encrypt"
echo "    3) Skip — I'll handle ingress myself"
choice="$(ask "Choice (1/2/3)" "1")"

case "$choice" in
  1)
    DOMAIN="$(ask "Domain (e.g. phone.svn-dev.online)" "phone.svn-dev.online")"
    if ! command -v cloudflared >/dev/null 2>&1; then
      warn "cloudflared not found (this is exactly what causes Cloudflare Error 1033 — the tunnel daemon is missing on the host)."
      if confirm "Install cloudflared now?"; then
        ARCH="$(dpkg --print-architecture 2>/dev/null || uname -m)"
        case "$ARCH" in
          amd64|x86_64) CF_ARCH=amd64 ;;
          arm64|aarch64) CF_ARCH=arm64 ;;
          *) CF_ARCH=amd64 ;;
        esac
        curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}.deb" -o /tmp/cloudflared.deb
        $SUDO dpkg -i /tmp/cloudflared.deb
        ok "cloudflared installed"
      else
        warn "Skipping cloudflared install — re-run this script later once it's installed."
      fi
    else
      ok "cloudflared already installed"
    fi
    if command -v cloudflared >/dev/null 2>&1; then
      if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
        echo "  Opening browser auth for Cloudflare — follow the printed link if it doesn't open automatically."
        cloudflared tunnel login || warn "Tunnel login did not complete — you can re-run 'cloudflared tunnel login' manually."
      fi
      TUNNEL_NAME="$(ask "Tunnel name" "svn-phone")"
      if ! cloudflared tunnel list 2>/dev/null | grep -q " ${TUNNEL_NAME} "; then
        cloudflared tunnel create "$TUNNEL_NAME" || warn "Tunnel create failed — it may already exist."
      fi
      TUNNEL_ID="$(cloudflared tunnel list 2>/dev/null | awk -v n="$TUNNEL_NAME" '$2==n {print $1}' | head -n1)"
      if [ -n "$TUNNEL_ID" ]; then
        $SUDO mkdir -p /etc/cloudflared
        CRED_FILE="$(find "$HOME/.cloudflared" -iname "${TUNNEL_ID}.json" 2>/dev/null | head -n1)"
        cat <<EOF | $SUDO tee /etc/cloudflared/config.yml >/dev/null
tunnel: ${TUNNEL_ID}
credentials-file: ${CRED_FILE}
ingress:
  - hostname: ${DOMAIN}
    service: http://127.0.0.1:3080
  - service: http_status:404
EOF
        cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" || warn "DNS route failed — the record may already exist, or check it manually in the Cloudflare dashboard."
        $SUDO cloudflared service install 2>/dev/null || true
        $SUDO systemctl enable --now cloudflared 2>/dev/null || warn "Could not start the cloudflared service — start it manually with: systemctl start cloudflared"
        ok "Cloudflare Tunnel configured for https://${DOMAIN}"
      else
        warn "Could not resolve the tunnel ID — finish tunnel setup manually (see deploy/caddy-tunnel.md)."
      fi
    fi
    ;;
  2)
    DOMAIN="$(ask "Domain (e.g. phone.svn-dev.online)" "phone.svn-dev.online")"
    if ! command -v caddy >/dev/null 2>&1; then
      if confirm "Install Caddy now?"; then
        $SUDO apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | $SUDO gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
        $SUDO apt-get update && $SUDO apt-get install -y caddy
        ok "Caddy installed"
      else
        fail "Caddy is required for this option. Install it and re-run."
      fi
    fi
    echo "${DOMAIN} {
    reverse_proxy 127.0.0.1:3080
}" | $SUDO tee /etc/caddy/Caddyfile >/dev/null
    $SUDO systemctl reload caddy || $SUDO systemctl restart caddy
    ok "Caddy configured for https://${DOMAIN} (cert issues automatically on first request)"
    ;;
  *)
    warn "Skipping ingress setup — point your own reverse proxy/tunnel at 127.0.0.1:3080."
    ;;
esac

step "Done"
echo -e "  ${c_green}The app is live locally at http://127.0.0.1:3080${c_reset}"
echo "  Useful commands:"
echo "    docker compose ps"
echo "    docker compose logs -f api"
echo "    docker compose logs -f web"
echo "    docker compose up -d --build   # after a git pull"
