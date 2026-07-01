/**
 * Docker Manager — manages Redroid Android containers via the Docker socket.
 *
 * Redroid runs Android inside a Docker container with full ADB access.
 * Each emulator gets its own container named `svn-phone-<emulatorId>`.
 *
 * Requirements on the host (see deploy/README.md):
 *   modprobe binder_linux
 *   modprobe ashmem_linux   (kernels < 5.18 only)
 *   docker pull redroid/redroid:13.0.0-latest
 */

import Docker from "dockerode";
import { logger } from "./logger.js";
import type { LaunchConfig } from "@workspace/db";

const SOCKET_PATH = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
const DATA_BASE_PATH = process.env.EMULATOR_DATA_PATH ?? "/data/emulators";

// Map Android version → best available Redroid image tag
const REDROID_IMAGE_MAP: Record<string, string> = {
  "15.0": "redroid/redroid:15.0.0-latest",
  "14.0": "redroid/redroid:14.0.0-latest",
  "13.0": "redroid/redroid:13.0.0-latest",
  "12.0": "redroid/redroid:12.0.0-latest",
  "11.0": "redroid/redroid:11.0.0-latest",
};

function getRedroidImage(androidVersion: string): string {
  return REDROID_IMAGE_MAP[androidVersion] ?? "redroid/redroid:14.0.0-latest";
}

export type StartResult = {
  containerId: string;
  adbPort: number;
};

export async function startRedroidContainer(opts: {
  emulatorId: string;
  androidVersion: string;
  hardware: {
    ramMb: number;
    cpuCores: number;
    screenWidth: number;
    screenHeight: number;
    screenDpi: number;
    hasGpu: boolean;
    hasCamera: boolean;
  };
  adbPort: number;
  romFilePath?: string;
  launchConfig?: LaunchConfig | null;
}): Promise<StartResult> {
  const docker = new Docker({ socketPath: SOCKET_PATH });
  const { emulatorId, androidVersion, hardware, adbPort, romFilePath, launchConfig } = opts;

  const image = getRedroidImage(androidVersion);
  const containerName = `svn-phone-${emulatorId}`;

  await removeContainerIfExists(docker, containerName);

  const env: string[] = [
    `androidboot.redroid_width=${hardware.screenWidth}`,
    `androidboot.redroid_height=${hardware.screenHeight}`,
    `androidboot.redroid_dpi=${hardware.screenDpi}`,
    `androidboot.redroid_fps=60`,
    `androidboot.hardware=goldfish`,
  ];

  if (hardware.hasCamera) {
    env.push("androidboot.redroid_camera_back=emulated");
    env.push("androidboot.redroid_camera_front=emulated");
  }

  // ── Apply launch config ───────────────────────────────────────────────────
  if (launchConfig) {
    if (launchConfig.enableRoot) {
      env.push("androidboot.redroid_root=1");
      logger.info({ emulatorId }, "Root access enabled via launchConfig");
    }

    if (launchConfig.enableSELinuxPermissive) {
      env.push("androidboot.selinux=permissive");
      logger.info({ emulatorId }, "SELinux set to permissive via launchConfig");
    }

    // Build prop overrides — Redroid accepts them as androidboot.* env vars for
    // certain props; for system-level overrides they are written to /data/property/
    // via a container entrypoint hook (if the Redroid image supports it).
    // We pass them as REDROID_PROP_* env vars for runtime pickup by the init script.
    for (const { key, value } of launchConfig.buildPropOverrides) {
      env.push(`REDROID_PROP_${key.replace(/\./g, "_")}=${value}`);
      // Also try the androidboot.* variant for recognized props
      env.push(`androidboot.${key}=${value}`);
    }

    // Arbitrary extra environment variables
    for (const { key, value } of launchConfig.extraEnvVars) {
      env.push(`${key}=${value}`);
    }
  }

  const binds: string[] = [
    `${DATA_BASE_PATH}/${emulatorId}:/data`,
  ];

  if (romFilePath) {
    binds.push(`${romFilePath}:/system.img:ro`);
  }

  const container = await docker.createContainer({
    name: containerName,
    Image: image,
    Env: env,
    HostConfig: {
      Privileged: true,
      Binds: binds,
      Memory: hardware.ramMb * 1024 * 1024,
      NanoCpus: hardware.cpuCores * 1e9,
      PortBindings: {
        "5555/tcp": [{ HostPort: String(adbPort) }],
      },
    },
    ExposedPorts: {
      "5555/tcp": {},
    },
  });

  await container.start();

  logger.info(
    { emulatorId, containerId: container.id, image, adbPort },
    "Redroid container started"
  );

  return { containerId: container.id, adbPort };
}

export async function stopRedroidContainer(containerId: string): Promise<void> {
  const docker = new Docker({ socketPath: SOCKET_PATH });

  try {
    const container = docker.getContainer(containerId);
    await container.stop({ t: 10 });
    await container.remove({ force: true });
    logger.info({ containerId }, "Redroid container stopped and removed");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No such container") || msg.includes("is not running")) {
      logger.warn({ containerId }, "Container already stopped/removed");
      return;
    }
    throw err;
  }
}

export async function getContainerStatus(
  containerId: string
): Promise<"running" | "stopped" | "unknown"> {
  const docker = new Docker({ socketPath: SOCKET_PATH });
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Running ? "running" : "stopped";
  } catch {
    return "unknown";
  }
}

async function removeContainerIfExists(
  docker: Docker,
  name: string
): Promise<void> {
  try {
    const container = docker.getContainer(name);
    await container.remove({ force: true });
  } catch {
    // Doesn't exist — fine
  }
}
