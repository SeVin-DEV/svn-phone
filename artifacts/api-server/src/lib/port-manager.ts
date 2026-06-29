/**
 * Port Manager — allocates VNC and ADB ports for emulators.
 *
 * VNC ports:  5900–5999  (100 concurrent QEMU emulators max)
 * ADB ports:  5556–5756  (even numbers, Android convention)
 *
 * Reads currently allocated ports from the DB to avoid conflicts.
 */

import { db, emulatorsTable } from "@workspace/db";
import { ne } from "drizzle-orm";

const VNC_BASE = 5900;
const ADB_BASE = 5556;
const MAX_SLOTS = 100;

export async function allocatePorts(excludeId?: string): Promise<{
  vncPort: number;
  adbPort: number;
}> {
  const query = db.select({
    vncPort: emulatorsTable.vncPort,
    adbPort: emulatorsTable.adbPort,
  }).from(emulatorsTable);

  const rows = excludeId
    ? await query.where(ne(emulatorsTable.id, excludeId))
    : await query;

  const usedVnc = new Set(rows.map((r) => r.vncPort).filter(Boolean));
  const usedAdb = new Set(rows.map((r) => r.adbPort).filter(Boolean));

  let vncPort: number | null = null;
  let adbPort: number | null = null;

  for (let i = 1; i <= MAX_SLOTS; i++) {
    const candidateVnc = VNC_BASE + i;
    const candidateAdb = ADB_BASE + (i - 1) * 2;

    if (!usedVnc.has(candidateVnc) && vncPort === null) {
      vncPort = candidateVnc;
    }
    if (!usedAdb.has(candidateAdb) && adbPort === null) {
      adbPort = candidateAdb;
    }
    if (vncPort !== null && adbPort !== null) break;
  }

  if (vncPort === null || adbPort === null) {
    throw new Error("No available ports — maximum concurrent emulators reached");
  }

  return { vncPort, adbPort };
}
