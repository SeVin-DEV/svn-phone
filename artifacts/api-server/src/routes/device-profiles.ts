import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, deviceProfilesTable } from "@workspace/db";
import {
  CreateDeviceProfileBody,
  DeleteDeviceProfileParams,
  ListDeviceProfilesResponse,
  CreateDeviceProfileResponse,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

function toApiProfile(row: typeof deviceProfilesTable.$inferSelect) {
  return row;
}

// GET /device-profiles
router.get("/device-profiles", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(deviceProfilesTable)
    .orderBy(deviceProfilesTable.name);
  res.json(ListDeviceProfilesResponse.parse(rows.map(toApiProfile)));
});

// POST /device-profiles
router.post("/device-profiles", async (req, res): Promise<void> => {
  const parsed = CreateDeviceProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", message: parsed.error.message });
    return;
  }

  const id = randomUUID();
  const [row] = await db
    .insert(deviceProfilesTable)
    .values({
      id,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer,
      model: parsed.data.model,
      isBuiltIn: false,
      hardware: parsed.data.hardware,
    })
    .returning();

  res.status(201).json(CreateDeviceProfileResponse.parse(toApiProfile(row)));
});

// DELETE /device-profiles/:id
router.delete("/device-profiles/:id", async (req, res): Promise<void> => {
  const params = DeleteDeviceProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "invalid_params", message: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(deviceProfilesTable)
    .where(eq(deviceProfilesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "not_found", message: "Device profile not found" });
    return;
  }

  if (row.isBuiltIn) {
    res.status(403).json({ error: "forbidden", message: "Cannot delete built-in device profiles" });
    return;
  }

  await db.delete(deviceProfilesTable).where(eq(deviceProfilesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
