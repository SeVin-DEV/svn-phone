# Exposing the web UI on your domain (phone.svn-dev.online)

> `./setup.sh` now does all of this for you interactively (installs
> cloudflared/Caddy, creates the tunnel or Caddyfile, points it at
> `127.0.0.1:3080`). This file is the manual reference if you want to do it
> yourself or understand what the script is doing.

Two easy options — pick whichever matches your setup.

---

## Option A — Caddy reverse proxy (recommended for Linveo)

Caddy handles TLS automatically via Let's Encrypt. Install it once, it renews certs forever.

```bash
# 1. Install Caddy on your Linveo server
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy

# 2. /etc/caddy/Caddyfile
phone.svn-dev.online {
    reverse_proxy 127.0.0.1:3080
}

# 3. Reload
systemctl reload caddy
```

That's it — Caddy automatically gets and renews the TLS cert for `phone.svn-dev.online`.

---

## Option B — Cloudflare Tunnel (no open ports needed)

If your server is behind NAT or you don't want any inbound ports open, use a Cloudflare Tunnel.

```bash
# 1. Install cloudflared
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | tee /etc/apt/sources.list.d/cloudflared.list
apt update && apt install cloudflared

# 2. Authenticate (opens browser)
cloudflared tunnel login

# 3. Create tunnel
cloudflared tunnel create svn-phone

# 4. /etc/cloudflared/config.yml
tunnel: <TUNNEL_ID_FROM_STEP_3>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: phone.svn-dev.online
    service: http://127.0.0.1:3080
  - service: http_status:404

# 5. Route DNS + run as service
cloudflared tunnel route dns svn-phone phone.svn-dev.online
cloudflared service install
systemctl start cloudflared
```

---

## ROM uploads over HTTPS

Both options pass through to nginx which allows 8 GB uploads. No extra config needed.

## Checking the service

```bash
# View logs
docker compose logs -f api
docker compose logs -f web

# Restart after an update
git pull
docker compose up -d --build
```
