import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emulatorsTable } from "@workspace/db";
import {
  GetSystemResourcesResponse,
  ListAndroidVersionsResponse,
} from "@workspace/api-zod";
import os from "os";
import { execSync } from "child_process";

const router: IRouter = Router();

function getCpuUsage(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type of Object.values(cpu.times)) {
      total += type;
    }
    idle += cpu.times.idle;
  }
  const used = total - idle;
  return Math.round((used / total) * 100);
}

function getDiskUsageGb(): { total: number; used: number } {
  try {
    const output = execSync("df -BG / 2>/dev/null | tail -1", { encoding: "utf8" });
    const parts = output.trim().split(/\s+/);
    const total = parseInt(parts[1]?.replace("G", "") ?? "100", 10);
    const used = parseInt(parts[2]?.replace("G", "") ?? "20", 10);
    return { total, used };
  } catch {
    return { total: 100, used: 30 };
  }
}

// GET /system/resources
router.get("/system/resources", async (_req, res): Promise<void> => {
  const totalRamMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeRamMb = Math.round(os.freemem() / 1024 / 1024);
  const usedRamMb = totalRamMb - freeRamMb;

  const { total: storageTotalGb, used: storageUsedGb } = getDiskUsageGb();
  const cpuUsagePercent = getCpuUsage();

  const allEmulators = await db.select().from(emulatorsTable);
  const runningEmulators = allEmulators.filter(e => e.status === "running" || e.status === "starting").length;

  // Max concurrent emulators based on available RAM (each needs ~512MB minimum + 256MB overhead)
  const maxEmulators = Math.max(1, Math.floor((totalRamMb - 1024) / 768));

  const result = {
    cpuUsagePercent,
    ramTotalMb: totalRamMb,
    ramUsedMb: usedRamMb,
    storageTotalGb,
    storageUsedGb,
    runningEmulators,
    maxEmulators,
  };

  res.json(GetSystemResourcesResponse.parse(result));
});

// GET /system/android-versions
router.get("/system/android-versions", async (_req, res): Promise<void> => {
  // Realistic Android version list with installed/not-installed status
  // In production: scan $ANDROID_HOME/system-images/ to detect installed ones
  const versions = [
    { version: "15.0", apiLevel: 35, name: "Android 15 (VanillaIceCream)", isInstalled: false, sizeMb: 1800 },
    { version: "14.0", apiLevel: 34, name: "Android 14 (UpsideDownCake)", isInstalled: true, sizeMb: 1650 },
    { version: "13.0", apiLevel: 33, name: "Android 13 (Tiramisu)", isInstalled: true, sizeMb: 1580 },
    { version: "12.0", apiLevel: 32, name: "Android 12L (Sv2)", isInstalled: true, sizeMb: 1490 },
    { version: "12.0", apiLevel: 31, name: "Android 12 (Snow Cone)", isInstalled: false, sizeMb: 1450 },
    { version: "11.0", apiLevel: 30, name: "Android 11 (Red Velvet Cake)", isInstalled: true, sizeMb: 1380 },
    { version: "10.0", apiLevel: 29, name: "Android 10 (Quince Tart)", isInstalled: false, sizeMb: 1290 },
    { version: "9.0", apiLevel: 28, name: "Android 9 (Pie)", isInstalled: false, sizeMb: 1200 },
    { version: "8.1", apiLevel: 27, name: "Android 8.1 (Oreo)", isInstalled: false, sizeMb: 1100 },
    { version: "8.0", apiLevel: 26, name: "Android 8.0 (Oreo)", isInstalled: false, sizeMb: 1050 },
    { version: "7.1", apiLevel: 25, name: "Android 7.1 (Nougat)", isInstalled: false, sizeMb: 950 },
    { version: "6.0", apiLevel: 23, name: "Android 6.0 (Marshmallow)", isInstalled: false, sizeMb: 820 },
  ];

  res.json(ListAndroidVersionsResponse.parse(versions));
});

export default router;
