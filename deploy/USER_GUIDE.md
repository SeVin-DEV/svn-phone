# Cloud Phone Manager — Complete User Guide

Everything you need to know, from zero to running Android devices in your browser.

---

## Table of Contents

1. [What this is](#1-what-this-is)
2. [Server prerequisites](#2-server-prerequisites)
3. [First-time deploy](#3-first-time-deploy)
4. [Using the app](#4-using-the-app)
5. [ROM Library — what ROMs are and where to get them](#5-rom-library)
6. [Pre-launch modifications](#6-pre-launch-modifications)
7. [Connecting to devices (ADB & VNC)](#7-connecting-to-devices)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. What this is

**Cloud Phone Manager** lets you spin up virtual Android devices on your Linux server and control them from any browser.

Three emulator types are supported:

| Type | How it works | Best for |
|------|-------------|----------|
| **Redroid** | Runs Android inside a Docker container | Fast boot, everyday use, automation |
| **QEMU x86** | Full PC emulation running an x86 Android ISO | LineageOS, BlissOS, custom ROMs |
| **QEMU ARM** | Full ARM emulation (software, no KVM) | Real device ROM dumps; slower |

---

## 2. Server prerequisites

### 2.1 Docker

```bash
# Install Docker (Debian/Ubuntu)
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Verify
docker run hello-world
```

### 2.2 Kernel modules for Redroid

Redroid needs the Android binder IPC driver in your kernel:

```bash
# Load immediately
modprobe binder_linux

# Load on every boot
echo "binder_linux" | tee -a /etc/modules

# Verify (should print a number, not an error)
ls /dev/binder*
```

> **Debian 12 note:** `binder_linux` is in the default kernel. If `modprobe` fails,
> install the extra modules package:
> ```bash
> apt install linux-modules-extra-$(uname -r)
> modprobe binder_linux
> ```

On kernels older than 5.18, also load ashmem:
```bash
modprobe ashmem_linux
echo "ashmem_linux" | tee -a /etc/modules
```

### 2.3 KVM for QEMU acceleration (x86 hosts only)

Without KVM, QEMU x86 emulators still work but run slower.

```bash
# Check if your CPU supports virtualisation
apt install -y cpu-checker
kvm-ok

# If it says "KVM acceleration can be used", enable it:
modprobe kvm_intel    # Intel CPU
modprobe kvm_amd      # AMD CPU

echo "kvm_intel" | tee -a /etc/modules   # or kvm_amd
```

### 2.4 Android Debug Bridge (ADB)

ADB is the command-line tool for talking to Android devices. Install it on the **machine you browse from** (your laptop, not the server) if you want to run adb commands.

```bash
# Ubuntu/Debian
sudo apt install adb

# macOS (with Homebrew)
brew install android-platform-tools

# Windows — download from:
# https://developer.android.com/tools/releases/platform-tools
# Unzip and add to PATH
```

You do **not** need the full Android SDK on the server. The app handles everything through the Docker socket and QEMU process management.

### 2.5 Pull Redroid base images

Pull the Android versions you plan to use before creating any emulators:

```bash
docker pull redroid/redroid:14.0.0-latest   # Android 14 (recommended)
docker pull redroid/redroid:13.0.0-latest   # Android 13
docker pull redroid/redroid:12.0.0-latest   # Android 12
docker pull redroid/redroid:11.0.0-latest   # Android 11
```

Each image is ~500 MB. User data accumulates separately in `/data/emulators/<id>/`.

---

## 3. First-time deploy

```bash
# 1. Clone the repo
git clone https://github.com/SeVin-DEV/svn-phone.git
cd svn-phone/deploy

# 2. Set your secrets
cp .env.example .env
nano .env
# Fill in:
#   SESSION_SECRET=<output of: openssl rand -hex 32>
#   POSTGRES_PASSWORD=<strong password>

# 3. Launch everything
docker compose up -d --build

# 4. Verify services are healthy
docker compose ps
docker compose logs -f api
```

After a minute or so, the web UI is available at **http://server-ip** (port 80).

Your Cloudflare tunnel routes `phone.svn-dev.online` → port 80 on the server, so
the UI is available at **https://phone.svn-dev.online** with no extra config.

### Updating after a code change

```bash
git pull
docker compose up -d --build
```

### Wiping everything and starting fresh

```bash
docker compose down -v    # removes all containers AND named volumes (data is gone!)
docker compose up -d --build
```

---

## 4. Using the app

### Dashboard

Overview of running emulators and system resources (CPU, RAM, disk).

### Creating an emulator

1. Go to **Emulators → Create Emulator**
2. Choose a backend:
   - **Redroid** — pick an Android version, optionally select a ROM from your library
   - **QEMU** — must select a compatible ROM from the library first
3. Choose a device profile (preset hardware) or configure custom specs
4. Click **Launch Instance**

The emulator appears in the list as **Stopped**. Click it, then click **Start Device** to boot it.

### Starting / stopping

- **Start** — boots the container or QEMU process. Takes 10–60 seconds on first boot.
- **Stop** — gracefully shuts down the container/process and releases the ports.
- Emulators that crash show as **Error** — check server logs with `docker compose logs api`.

### Device profiles

Pre-configured hardware specs (Pixel 7, Galaxy S24, etc.). You can also create custom profiles from the **Profiles** page and reuse them across emulators.

### Snapshots

While an emulator is running, you can save a snapshot of its current state (name it anything). Snapshots let you restore to a clean state quickly.

---

## 5. ROM Library

### What is a ROM?

A ROM (Read-Only Memory image) is the Android operating system packaged as a single file. Different ROM types work with different emulator backends:

| ROM Type | File extension | Use with | Notes |
|----------|---------------|----------|-------|
| **Redroid GSI** | `.img` | Redroid | Generic System Image, replaces the default Redroid system |
| **QEMU x86** | `.img`, `.iso` | QEMU x86 | Full x86 Android ISO (Android-x86 project, BlissOS) |
| **QEMU ARM** | `.img` | QEMU ARM | ARM64 ROM dumps or LineageOS ARM builds |
| **Custom** | any | varies | Catch-all for other formats |

For most users, **Redroid without a custom ROM** (using the official Redroid image) is all you need.

---

### Where to get ROMs

#### Option A — Use Redroid without any ROM (easiest)

Don't upload anything. When you create a Redroid emulator and leave the ROM field blank, it boots the official Redroid image for whatever Android version you chose. This is the fastest path.

#### Option B — Redroid with a custom GSI (advanced)

A GSI (Generic System Image) replaces the Android system partition. Use this to run custom Android builds on Redroid.

**Where to get GSIs:**
- **LineageOS GSI** — https://github.com/phhusson/treble_experimentations/releases  
  Look for files named `system-arm64-ab.img.xz` or `system-x86_64.img.gz`
- **Android AOSP GSI** — https://developer.android.com/topic/generic-system-image  
  Official Google GSIs, requires device with Project Treble support
- **Pixel Experience GSI** — https://get.pixelexperience.org  
  AOSP-based with Pixel UI, look for GSI builds

**Compatibility tip:** For Redroid (which runs on x86), use **x86_64 GSIs** — they run without emulation overhead. ARM GSIs require translation and are slower.

#### Option C — QEMU x86 ISO (runs a full Android OS in a VM)

These are ISO files you boot like a regular operating system in QEMU.

**Best options:**
- **BlissOS** — https://blissos.org/download  
  User-friendly, based on Android 13/14, x86_64, has Google Play
- **Android-x86** — https://www.android-x86.org/download  
  Lightweight, Android 9/11/12, x86/x86_64

Download the `.iso` file, upload it to the ROM library as type "QEMU x86", create a QEMU emulator, and select it as the ROM.

#### Option D — QEMU ARM (real device ROM dumps)

ARM ROMs come from two places:
1. **Factory images** — downloaded from a device manufacturer (Google Pixel: https://developers.google.com/android/images). These are zip files containing `system.img`. Extract the system.img and upload it.
2. **LineageOS ARM builds** — https://download.lineageos.org — pick your device, download the zip, extract `system.img`.

> **ARM on x86 server:** These run fine but are slower (software emulation). Expect 5–15 minutes to boot on first run. Good for automated testing, not great for interactive use.

---

### Uploading a ROM

1. Go to **ROM Library**
2. Click **Upload ROM**
3. Select the file (`.img`, `.zip`, `.iso`, `.gz`, `.xz` — up to 8 GB)
4. Fill in:
   - **Name** — anything descriptive
   - **ROM Type** — Redroid GSI / QEMU x86 / QEMU ARM / Custom
   - **Android Version** — e.g. `14.0`
   - **Device Name** — optional, e.g. "Pixel 7" or "BlissOS 16"
5. Click **Upload ROM**

Large files (1–8 GB) may take several minutes depending on your connection speed to the server.

---

## 6. Pre-launch modifications

The **Pre-launch Config** panel on each emulator's detail page lets you modify the Android environment before it boots. Changes apply every time you start the emulator.

### Enable Root

Gives the Android instance full root (`su`) access. Useful for:
- Installing system APKs
- Modifying protected settings
- Running ADB commands that require root (`adb root`)

**Redroid:** Sets `androidboot.redroid_root=1` — fully supported, no ROM modification needed.  
**QEMU:** Requires a pre-rooted ROM image (e.g. Magisk-patched boot.img).

### SELinux Permissive

Disables SELinux enforcement. Required for some root operations and when modifying system files at runtime.

### Build Prop Overrides

Set any Android system property, for example:

| Key | Example Value | Effect |
|-----|--------------|--------|
| `ro.product.model` | `Pixel 7 Pro` | Makes apps see this device model |
| `ro.product.manufacturer` | `Google` | Device manufacturer |
| `ro.product.brand` | `google` | Brand identifier |
| `ro.build.fingerprint` | `google/panther/...` | Full device fingerprint for Play attestation |
| `ro.debuggable` | `1` | Enable ADB debugging features |

**Use cases:**
- Bypass device checks in apps that reject emulators
- Test app behaviour on specific "devices" without owning them
- Fake a fingerprint for apps that use device fingerprinting for analytics

### Extra Environment Variables

Pass arbitrary variables into the Redroid container. Useful for:
- Configuring custom Redroid init scripts
- Setting app-specific environment variables read by the Android runtime

---

## 7. Connecting to devices

### ADB (Android Debug Bridge)

When an emulator is running, the detail page shows its ADB port. Connect from any machine with ADB installed:

```bash
# From your laptop (over your domain — requires ADB TCP tunnel)
adb connect phone.svn-dev.online:<ADB_PORT>

# From the server itself
adb connect localhost:<ADB_PORT>

# Verify connection
adb devices

# Open a shell
adb shell

# Install an APK
adb install myapp.apk

# Enable root shell (if root is enabled)
adb root
adb shell
```

### Forwarding ADB over the internet

The ADB port runs on your server. To connect from your laptop without being on the same network, use an SSH tunnel:

```bash
# On your laptop — forwards local port 5557 to the server's ADB port 5556
ssh -L 5557:localhost:5556 user@your-linveo-server

# Then in another terminal:
adb connect localhost:5557
```

### VNC (Visual access to the screen)

The VNC port shown on the detail page lets you see and interact with the Android screen:

1. Install a VNC client — **TigerVNC** (Windows/Linux/Mac) or **RealVNC Viewer**
2. Connect to `phone.svn-dev.online:<VNC_PORT>` (or `server-ip:<VNC_PORT>`)
3. Leave the password blank (no auth by default)

> For QEMU emulators only — Redroid emulators use ADB for everything and don't expose a VNC port. Use the screen placeholder in the web UI as a status indicator.

---

## 8. Troubleshooting

### Emulator shows "Error" status

```bash
docker compose logs api --tail=50
```

Common causes:
- **`binder_linux` not loaded** — run `modprobe binder_linux`
- **Redroid image not pulled** — run `docker pull redroid/redroid:14.0.0-latest`
- **Port already in use** — another emulator or service is using that ADB/VNC port
- **Out of RAM** — check System page for RAM usage

### Redroid container exits immediately

```bash
docker logs svn-phone-<EMULATOR_ID>
```

If you see "binder device not found":
```bash
modprobe binder_linux
ls /dev/binder*   # should show /dev/binder
```

### QEMU emulator doesn't boot

- Make sure you uploaded the right ROM type (x86 ISO vs ARM img)
- Check KVM is available: `kvm-ok`
- Increase RAM — QEMU needs at least 2 GB to boot most Android ISOs

### Can't connect via ADB from my laptop

- ADB port is exposed on the server — not tunnelled through Cloudflare (Cloudflare proxies HTTP only, not raw TCP)
- Use SSH port forwarding (see Section 7) or a direct connection to the server IP

### ROM upload fails

- Check disk space: `df -h /`
- The ROM volume is at `/data/docker/volumes/deploy_rom_data/` on the host
- nginx allows up to 8 GB — if your file is larger, split or compress it first

### Web UI shows "Connected to server" but emulators don't appear

The API is running but the DB might not be migrated:
```bash
docker compose logs migrate
docker compose restart api
```
