import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emulatorsTable, snapshotsTable } from "@workspace/db";
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
import os from "os";

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
    lastStartedAt: row.lastStartedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    uptimeSeconds: getUptimeSeconds(row.lastStartedAt, row.status),
    deviceProfileId: row.deviceProfileId ?? undefined,
  };
}

/** Find an available port in a range by simple incrementing strategy */
function pickPort(base: number, offset: number): number {
  return base + offset;
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

  const { name, androidVersion, apiLevel, hardware, deviceProfileId } = parsed.data;
  const id = randomUUID();

  const [row] = await db
    .insert(emulatorsTable)
    .values({
      id,
      name,
      androidVersion,
      apiLevel,
      hardware,
      status: "stopped",
      deviceProfileId: deviceProfileId ?? null,
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

  await db.delete(emulatorsTable).where(eq(emulatorsTable.id, params.data.id));
  // Also clean up snapshots
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

  // Count existing running emulators to assign ports
  const allRows = await db.select().from(emulatorsTable);
  const runningCount = allRows.filter(r => r.status === "running" || r.status === "starting").length;

  const vncPort = 5900 + runningCount + 1;
  const adbPort = 5554 + (runningCount + 1) * 2;

  // In production: launch Android emulator process here:
  // spawn(`${ANDROID_HOME}/emulator/emulator`, ['-avd', row.id, '-no-audio', '-no-window', '-vnc', `:${vncPort}`])
  // For now, mark as "starting" then simulate "running" by setting status immediately.
  // Real integration would update status via a background job watching the process.
  const now = new Date();
  const [updated] = await db
    .update(emulatorsTable)
    .set({
      status: "running",
      vncPort,
      adbPort,
      lastStartedAt: now,
    })
    .where(eq(emulatorsTable.id, params.data.id))
    .returning();

  req.log.info({ emulatorId: params.data.id, vncPort, adbPort }, "Emulator started");
  res.json(StartEmulatorResponse.parse(toApiEmulator(updated)));
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

  // In production: kill the emulator process by row.pid
  const [updated] = await db
    .update(emulatorsTable)
    .set({
      status: "stopped",
      vncPort: null,
      adbPort: null,
      pid: null,
    })
    .where(eq(emulatorsTable.id, params.data.id))
    .returning();

  req.log.info({ emulatorId: params.data.id }, "Emulator stopped");
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
