/**
 * ROM Library Routes
 *
 * Handles uploading, listing, and deleting ROM image files.
 * Files are stored on the /roms Docker volume (persisted across restarts).
 *
 * Supported ROM types:
 *   redroid-gsi  — Generic System Image for Redroid containers
 *   qemu-arm     — ARM64 ROM dump or custom ROM (QEMU aarch64)
 *   qemu-x86     — x86/x86_64 ROM or GSI (QEMU x86_64, faster on x86 host)
 *   custom       — Unknown / other format
 */

import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { db, romsTable, emulatorsTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const ROM_STORAGE = process.env.ROM_STORAGE_PATH ?? "/roms";

// Ensure ROM storage directory exists on startup
fs.mkdir(ROM_STORAGE, { recursive: true }).catch(() => {});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ROM_STORAGE),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 * 1024 }, // 8 GB max
  fileFilter: (_req, file, cb) => {
    const allowed = [".img", ".zip", ".raw", ".bin", ".iso", ".gz", ".xz"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(", ")}`));
    }
  },
});

const router: IRouter = Router();

// GET /roms — list all ROMs
router.get("/roms", async (_req, res): Promise<void> => {
  const rows = await db.select().from(romsTable).orderBy(romsTable.createdAt);
  const result = rows.map(toApiRom);
  res.json(result);
});

// POST /roms — upload a ROM
router.post("/roms", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "invalid_request", message: "No file uploaded" });
    return;
  }

  const { name, romType, androidVersion, deviceName, description } = req.body as Record<string, string>;

  if (!name || !romType || !androidVersion) {
    // Clean up the uploaded file if validation fails
    await fs.unlink(req.file.path).catch(() => {});
    res.status(400).json({
      error: "invalid_request",
      message: "Required fields: name, romType, androidVersion",
    });
    return;
  }

  const validRomTypes = ["redroid-gsi", "qemu-arm", "qemu-x86", "custom"];
  if (!validRomTypes.includes(romType)) {
    await fs.unlink(req.file.path).catch(() => {});
    res.status(400).json({
      error: "invalid_request",
      message: `Invalid romType. Must be one of: ${validRomTypes.join(", ")}`,
    });
    return;
  }

  const sizeMb = Math.round(req.file.size / (1024 * 1024));
  const id = randomUUID();

  const [row] = await db.insert(romsTable).values({
    id,
    name,
    romType,
    filename: req.file.filename,
    sizeMb,
    androidVersion,
    deviceName: deviceName || null,
    description: description || null,
  }).returning();

  logger.info({ romId: id, filename: req.file.filename, sizeMb }, "ROM uploaded");
  res.status(201).json(toApiRom(row));
});

// DELETE /roms/:id
router.delete("/roms/:id", async (req, res): Promise<void> => {
  const { id } = req.params;

  const [row] = await db.select().from(romsTable).where(eq(romsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "not_found", message: "ROM not found" });
    return;
  }

  // Check if any emulator is currently using this ROM
  const usingEmulators = await db
    .select({ id: emulatorsTable.id, name: emulatorsTable.name })
    .from(emulatorsTable)
    .where(eq(emulatorsTable.romId, id));

  if (usingEmulators.length > 0) {
    const names = usingEmulators.map((e) => e.name).join(", ");
    res.status(409).json({
      error: "conflict",
      message: `ROM is in use by emulator(s): ${names}. Stop and delete them first.`,
    });
    return;
  }

  // Delete the file
  const filePath = path.join(ROM_STORAGE, row.filename);
  await fs.unlink(filePath).catch((err) => {
    logger.warn({ filePath, err }, "Could not delete ROM file (already missing?)");
  });

  await db.delete(romsTable).where(eq(romsTable.id, id));

  logger.info({ romId: id, filename: row.filename }, "ROM deleted");
  res.sendStatus(204);
});

function toApiRom(row: typeof romsTable.$inferSelect) {
  return {
    ...row,
    deviceName: row.deviceName ?? null,
    description: row.description ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export default router;
