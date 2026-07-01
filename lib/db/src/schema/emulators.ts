import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type HardwareSpec = {
  ramMb: number;
  cpuCores: number;
  storageGb: number;
  screenWidth: number;
  screenHeight: number;
  screenDpi: number;
  hasGpu: boolean;
  hasCamera: boolean;
};

export type LaunchConfig = {
  enableRoot: boolean;
  enableSELinuxPermissive: boolean;
  buildPropOverrides: Array<{ key: string; value: string }>;
  extraEnvVars: Array<{ key: string; value: string }>;
};

export const emulatorsTable = pgTable("emulators", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  emulatorType: text("emulator_type").notNull().default("redroid"), // redroid | qemu | avd
  deviceProfileId: text("device_profile_id"),
  romId: text("rom_id"),
  containerId: text("container_id"),   // Redroid Docker container ID
  androidVersion: text("android_version").notNull(),
  apiLevel: integer("api_level").notNull(),
  status: text("status").notNull().default("stopped"),
  hardware: jsonb("hardware").notNull().$type<HardwareSpec>(),
  launchConfig: jsonb("launch_config").$type<LaunchConfig>(),  // pre-launch modifications
  vncPort: integer("vnc_port"),         // QEMU VNC port
  adbPort: integer("adb_port"),         // ADB port (all types)
  pid: integer("pid"),                  // QEMU process PID
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastStartedAt: timestamp("last_started_at"),
});

export const insertEmulatorSchema = createInsertSchema(emulatorsTable).omit({
  createdAt: true,
  lastStartedAt: true,
});

export type InsertEmulator = z.infer<typeof insertEmulatorSchema>;
export type Emulator = typeof emulatorsTable.$inferSelect;
