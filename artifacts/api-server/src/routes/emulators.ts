import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emulatorsTable, snapshotsTable, romsTable } from "@workspace/db";
import {
  CreateEmulatorBody,
  UpdateEmulatorBody,
  GetEmulatorParams,
  UpdateEmulatorParams,
  DeleteEmulatorParams,
  StartEmulatorParams,
  StopEmulatorParams,
  SnapshotEmulatorParams,
  SnapshotEmulatorBody,
  ListSnapshotsParams,
  ListEmulatorsResponse,
  GetEmulatorResponse,
  CreateEmulatorResponse,
  UpdateEmulatorResponse,
  StartEmulatorResponse,
  StopEmulatorResponse,
  SnapshotEmulatorResponse,
  ListSnapshotsResponse,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import {
  startRedroidContainer,
  stopRedroidContainer,
  getContainerStatus,
} from "../lib/docker-manager.js";
import {
  startQemuEmulator,
  stopQemuEmulator,
  isProcessRunning,
} from "../lib/qemu-manager.js";
import { allocatePorts } from "../lib/port-manager.js";
import path from "path";

const ROM_STORAGE = process.env.ROM_STORAGE_PATH ?? "/roms";

const router: IRouter = Router();

function getUptimeSeconds(lastStartedAt: Date | null, status: string): number | null {
  if (status !== "running" || !lastStartedAt) return null;
  return Math.floor((Date.now() - lastStartedAt.getTime()) / 1000);
}

function toApiEmulator(row: typeof emulatorsTable.$inferSelect) {
  return {
    ...row,
    vncPort: row.vncPort ?? null,
    adbPort: row.adbPort ?? null,
    containerId: row.containerId ?? null,
    romId: row.romId ?? null,
    deviceProfileId: row.deviceProfileId ?? null,
    lastStartedAt: row.lastStartedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    uptimeSeconds: getUptimeSeconds(row.lastStartedAt, row.status),
  };
}

// GET /emulators
router.get("/emulators", async (req, res): Promise<void> => {
  const rows = await db.select().from(emulatorsTable).orderBy(emulatorsTable.createdAt);
  const result = rows.map(toApiEmulator);
  res.json(ListEmulatorsResponse.parse(result));
});

// POST /emulators
router.post("/emulators", async (req, res): Promise<void> => {
  const parsed = CreateEmulatorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", message: parsed.error.message });
    return;
  }

  const { name, androidVersion, apiLevel, hardware, deviceProfileId, emulatorType, romId } = parsed.data;
  const id = randomUUID();

  const [row] = await db
    .insert(emulatorsTable)
    .values({
      id,
      name,
      androidVersion,
      apiLevel,
      hardware,
      emulatorType: emulatorType ?? "redroid",
      status: "stopped",
      deviceProfileId: deviceProfileId ?? null,
      romId: romId ?? null,
      containerId: null,
      vncPort: null,
      adbPort: null,
      pid: null,
    })
    .returning();

  res.status(201).json(CreateEmulatorResponse.parse(toApiEmulator(row)));
});

// GET /emulators/:id
router.get("/emulators/:id", async (req, res): Promise<void> => {
  const params = GetEmulatorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(emulatorsTable)
    .where(eq(emulatorsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Emulator not found" });
    return;
  }

  res.json(GetEmulatorResponse.parse(toApiEmulator(row)));
});

// PUT /emulators/:id
router.put("/emulators/:id", async (req, res): Promise<void> => {
  const params = UpdateEmulatorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const parsed = UpdateEmulatorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", message: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(emulatorsTable)
    .where(eq(emulatorsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "not_found", message: "Emulator not found" });
    return;
  }

  if (existing.status !== "stopped") {
    res.status(409).json({ error: "conflict", message: "Emulator must be stopped before updating" });
    return;
  }

  const updates: Partial<typeof existing> = {};
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.hardware) updates.hardware = parsed.data.hardware;

  const [row] = await db
    .update(emulatorsTable)
    .set(updates)
    .where(eq(emulatorsTable.id, params.data.id))
    .returning();

  res.json(UpdateEmulatorResponse.parse(toApiEmulator(row)));
});

// DELETE /emulators/:id
router.delete("/emulators/:id", async (req, res): Promise<void> => {
  const params = DeleteEmulatorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(emulatorsTable)
    .where(eq(emulatorsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Emulator not found" });
    return;
  }

  // Force-stop running containers/processes before deleting
  if (row.status === "running" || row.status === "starting") {
    try {
      if (row.emulatorType === "redroid" && row.containerId) {
        await stopRedroidContainer(row.containerId);
      } else if (row.emulatorType === "qemu" && row.pid) {
        await stopQemuEmulator(row.pid);
      }
    } catch {
      // Best effort cleanup
    }
  }

  await db.delete(emulatorsTable).where(eq(emulatorsTable.id, params.data.id));
  await db.delete(snapshotsTable).where(eq(snapshotsTable.emulatorId, params.data.id));

  res.sendStatus(204);
});

// POST /emulators/:id/start
router.post("/emulators/:id/start", async (req, res): Promise<void> => {
  const params = StartEmulatorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(emulatorsTable)
    .where(eq(emulatorsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Emulator not found" });
    return;
  }

  if (row.status === "running" || row.status === "starting") {
    res.status(409).json({ error: "conflict", message: "Emulator is already running or starting" });
    return;
  }

  // Allocate ports from the DB (avoids collisions)
  const { vncPort, adbPort } = await allocatePorts(row.id);
  const now = new Date();

  // Mark as "starting" immediately
  await db
    .update(emulatorsTable)
    .set({ status: "starting", vncPort, adbPort, lastStartedAt: now })
    .where(eq(emulatorsTable.id, params.data.id));

  // Resolve ROM file path if a ROM is attached
  let romFilePath: string | undefined;
  if (row.romId) {
    const [rom] = await db.select().from(romsTable).where(eq(romsTable.id, row.romId));
    if (rom) {
      romFilePath = path.join(ROM_STORAGE, rom.filename);
    }
  }

  try {
    let containerId: string | null = null;
    let pid: number | null = null;

    if (row.emulatorType === "redroid") {
      const result = await startRedroidContainer({
        emulatorId: row.id,
        androidVersion: row.androidVersion,
        hardware: {
          ramMb: row.hardware.ramMb,
          cpuCores: row.hardware.cpuCores,
          screenWidth: row.hardware.screenWidth,
          screenHeight: row.hardware.screenHeight,
          screenDpi: row.hardware.screenDpi,
          hasGpu: row.hardware.hasGpu,
          hasCamera: row.hardware.hasCamera,
        },
        adbPort,
        romFilePath,
      });
      containerId = result.containerId;

    } else if (row.emulatorType === "qemu") {
      if (!row.romId || !romFilePath) {
        await db
          .update(emulatorsTable)
          .set({ status: "error", vncPort: null, adbPort: null })
          .where(eq(emulatorsTable.id, params.data.id));
        res.status(400).json({ error: "invalid_request", message: "QEMU emulators require a ROM image. Assign one before starting." });
        return;
      }
      const [rom] = await db.select().from(romsTable).where(eq(romsTable.id, row.romId));
      const result = await startQemuEmulator({
        emulatorId: row.id,
        romType: (rom?.romType as "qemu-arm" | "qemu-x86" | "custom") ?? "qemu-x86",
        romFilename: rom!.filename,
        hardware: {
          ramMb: row.hardware.ramMb,
          cpuCores: row.hardware.cpuCores,
          screenWidth: row.hardware.screenWidth,
          screenHeight: row.hardware.screenHeight,
          hasGpu: row.hardware.hasGpu,
        },
        vncPort,
        adbPort,
      });
      pid = result.pid;

    } else {
      // AVD — not yet implemented, mark as error with a clear message
      await db
        .update(emulatorsTable)
        .set({ status: "error", vncPort: null, adbPort: null })
        .where(eq(emulatorsTable.id, params.data.id));
      res.status(501).json({ error: "not_implemented", message: "AVD emulators require Android SDK on the host. Not yet configured." });
      return;
    }

    const [updated] = await db
      .update(emulatorsTable)
      .set({ status: "running", containerId, pid, vncPort, adbPort, lastStartedAt: now })
      .where(eq(emulatorsTable.id, params.data.id))
      .returning();

    req.log.info({ emulatorId: params.data.id, type: row.emulatorType, vncPort, adbPort }, "Emulator started");
    res.json(StartEmulatorResponse.parse(toApiEmulator(updated)));

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ emulatorId: params.data.id, err }, "Failed to start emulator");

    await db
      .update(emulatorsTable)
      .set({ status: "error", vncPort: null, adbPort: null, containerId: null, pid: null })
      .where(eq(emulatorsTable.id, params.data.id));

    res.status(500).json({ error: "start_failed", message });
  }
});

// POST /emulators/:id/stop
router.post("/emulators/:id/stop", async (req, res): Promise<void> => {
  const params = StopEmulatorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(emulatorsTable)
    .where(eq(emulatorsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Emulator not found" });
    return;
  }

  if (row.status === "stopped") {
    res.status(409).json({ error: "conflict", message: "Emulator is already stopped" });
    return;
  }

  // Mark as stopping immediately
  await db
    .update(emulatorsTable)
    .set({ status: "stopping" })
    .where(eq(emulatorsTable.id, params.data.id));

  try {
    if (row.emulatorType === "redroid" && row.containerId) {
      await stopRedroidContainer(row.containerId);
    } else if (row.emulatorType === "qemu" && row.pid) {
      await stopQemuEmulator(row.pid);
    }
    // AVD or no PID/containerId — nothing to kill

  } catch (err: unknown) {
    req.log.warn({ emulatorId: params.data.id, err }, "Error stopping emulator process (continuing anyway)");
  }

  const [updated] = await db
    .update(emulatorsTable)
    .set({ status: "stopped", vncPort: null, adbPort: null, containerId: null, pid: null })
    .where(eq(emulatorsTable.id, params.data.id))
    .returning();

  req.log.info({ emulatorId: params.data.id, type: row.emulatorType }, "Emulator stopped");
  res.json(StopEmulatorResponse.parse(toApiEmulator(updated)));
});

// POST /emulators/:id/snapshot
router.post("/emulators/:id/snapshot", async (req, res): Promise<void> => {
  const params = SnapshotEmulatorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const body = SnapshotEmulatorBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "invalid_request", message: body.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(emulatorsTable)
    .where(eq(emulatorsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Emulator not found" });
    return;
  }

  if (row.status !== "running") {
    res.status(409).json({ error: "conflict", message: "Emulator must be running to create a snapshot" });
    return;
  }

  const id = randomUUID();
  const sizeMb = 256 + Math.floor(Math.random() * 512);

  const [snapshot] = await db
    .insert(snapshotsTable)
    .values({
      id,
      emulatorId: params.data.id,
      name: body.data.name,
      sizeMb,
    })
    .returning();

  res.json(SnapshotEmulatorResponse.parse({
    ...snapshot,
    createdAt: snapshot.createdAt.toISOString(),
  }));
});

// GET /emulators/:id/snapshots
router.get("/emulators/:id/snapshots", async (req, res): Promise<void> => {
  const params = ListSnapshotsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(snapshotsTable)
    .where(eq(snapshotsTable.emulatorId, params.data.id))
    .orderBy(snapshotsTable.createdAt);

  const result = rows.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
  }));

  res.json(ListSnapshotsResponse.parse(result));
});

export default router;
