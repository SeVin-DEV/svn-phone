/**
 * Seeds built-in device profiles on first run.
 * Idempotent — only inserts profiles that don't exist yet.
 */
import { db, deviceProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

const BUILT_IN_PROFILES = [
  {
    id: "builtin-pixel-9-pro",
    name: "Pixel 9 Pro",
    manufacturer: "Google",
    model: "GD1YQ",
    isBuiltIn: true,
    hardware: { ramMb: 12288, cpuCores: 8, storageGb: 128, screenWidth: 1344, screenHeight: 2992, screenDpi: 480, hasGpu: true, hasCamera: true },
  },
  {
    id: "builtin-pixel-7",
    name: "Pixel 7",
    manufacturer: "Google",
    model: "GVU6C",
    isBuiltIn: true,
    hardware: { ramMb: 8192, cpuCores: 8, storageGb: 128, screenWidth: 1080, screenHeight: 2400, screenDpi: 416, hasGpu: true, hasCamera: true },
  },
  {
    id: "builtin-pixel-6a",
    name: "Pixel 6a",
    manufacturer: "Google",
    model: "GX7AS",
    isBuiltIn: true,
    hardware: { ramMb: 6144, cpuCores: 8, storageGb: 64, screenWidth: 1080, screenHeight: 2400, screenDpi: 429, hasGpu: true, hasCamera: true },
  },
  {
    id: "builtin-galaxy-s24",
    name: "Galaxy S24",
    manufacturer: "Samsung",
    model: "SM-S921B",
    isBuiltIn: true,
    hardware: { ramMb: 8192, cpuCores: 8, storageGb: 128, screenWidth: 1080, screenHeight: 2340, screenDpi: 416, hasGpu: true, hasCamera: true },
  },
  {
    id: "builtin-galaxy-s23",
    name: "Galaxy S23",
    manufacturer: "Samsung",
    model: "SM-S911B",
    isBuiltIn: true,
    hardware: { ramMb: 8192, cpuCores: 8, storageGb: 128, screenWidth: 1080, screenHeight: 2340, screenDpi: 393, hasGpu: true, hasCamera: true },
  },
  {
    id: "builtin-oneplus-12",
    name: "OnePlus 12",
    manufacturer: "OnePlus",
    model: "CPH2573",
    isBuiltIn: true,
    hardware: { ramMb: 12288, cpuCores: 8, storageGb: 256, screenWidth: 1440, screenHeight: 3168, screenDpi: 510, hasGpu: true, hasCamera: true },
  },
  {
    id: "builtin-tablet-standard",
    name: "Generic 10\" Tablet",
    manufacturer: "Generic",
    model: "TAB-1080P",
    isBuiltIn: true,
    hardware: { ramMb: 4096, cpuCores: 4, storageGb: 32, screenWidth: 1200, screenHeight: 1920, screenDpi: 224, hasGpu: false, hasCamera: false },
  },
];

export async function seedBuiltInProfiles(): Promise<void> {
  try {
    for (const profile of BUILT_IN_PROFILES) {
      const [existing] = await db
        .select({ id: deviceProfilesTable.id })
        .from(deviceProfilesTable)
        .where(eq(deviceProfilesTable.id, profile.id));

      if (!existing) {
        await db.insert(deviceProfilesTable).values(profile);
        logger.info({ profileId: profile.id, name: profile.name }, "Seeded built-in device profile");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed built-in device profiles");
  }
}
