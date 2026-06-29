/**
 * QEMU Manager — launches Android ROM images via QEMU full-system emulation.
 *
 * Use this for:
 *   - Actual device ROM dumps (ARM64 builds)
 *   - Custom ROMs (LineageOS, CalyxOS ARM builds)
 *   - x86/x86_64 Android GSIs (faster on x86 servers)
 *
 * Requirements on host / in the API container:
 *   qemu-system-aarch64  (for qemu-arm type ROMs)
 *   qemu-system-x86_64   (for qemu-x86 type ROMs)
 *
 * Both are installed in the Dockerfile.api automatically.
 */

import { spawn } from "child_process";
import { logger } from "./logger.js";

const ROM_STORAGE = process.env.ROM_STORAGE_PATH ?? "/roms";

export type QemuStartResult = {
  pid: number;
  vncPort: number;
  adbPort: number;
};

export async function startQemuEmulator(opts: {
  emulatorId: string;
  romType: "qemu-arm" | "qemu-x86" | "custom";
  romFilename: string;
  hardware: {
    ramMb: number;
    cpuCores: number;
    screenWidth: number;
    screenHeight: number;
    hasGpu: boolean;
  };
  vncPort: number;
  adbPort: number;
}): Promise<QemuStartResult> {
  const { romType, romFilename, hardware, vncPort, adbPort, emulatorId } = opts;

  const romPath = `${ROM_STORAGE}/${romFilename}`;
  const vncDisplay = vncPort - 5900; // QEMU uses display offset (0 = :5900)

  const isArm = romType === "qemu-arm";
  const binary = isArm ? "qemu-system-aarch64" : "qemu-system-x86_64";

  const baseArgs: string[] = [
    // Machine type
    ...(isArm
      ? ["-M", "virt", "-cpu", "cortex-a57", "-bios", "/usr/share/qemu/QEMU_EFI.fd"]
      : ["-M", "pc", "-cpu", "host", "-enable-kvm"]),

    // Resources
    "-m", String(hardware.ramMb),
    "-smp", String(hardware.cpuCores),

    // ROM / system image
    "-drive", `file=${romPath},format=raw,if=virtio`,

    // Display via VNC (headless — noVNC connects to this)
    "-vnc", `:${vncDisplay}`,
    "-device", isArm ? "virtio-gpu" : "vmware-svga",

    // ADB networking — forward host adbPort → guest 5555
    "-netdev", `user,id=net0,hostfwd=tcp::${adbPort}-:5555`,
    "-device", "virtio-net-pci,netdev=net0",

    // No interactive console
    "-nographic",
    "-serial", "none",
    "-monitor", "none",
  ];

  logger.info({ emulatorId, binary, vncPort, adbPort }, "Launching QEMU");

  const proc = spawn(binary, baseArgs, {
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });

  proc.unref(); // Don't block Node.js exit

  if (!proc.pid) {
    throw new Error(`Failed to spawn ${binary} — is it installed?`);
  }

  logger.info({ emulatorId, pid: proc.pid, vncPort, adbPort }, "QEMU process started");

  return { pid: proc.pid, vncPort, adbPort };
}

export async function stopQemuEmulator(pid: number): Promise<void> {
  try {
    process.kill(pid, "SIGTERM");
    logger.info({ pid }, "QEMU process SIGTERM sent");

    // Give it 5 seconds to exit gracefully, then SIGKILL
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // Already gone
        }
        resolve();
      }, 5000);
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ESRCH")) {
      // Process already exited — fine
      logger.warn({ pid }, "QEMU process already exited");
      return;
    }
    throw err;
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
