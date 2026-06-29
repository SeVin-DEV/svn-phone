import { pgTable, text, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import type { HardwareSpec } from "./emulators";

export const deviceProfilesTable = pgTable("device_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  manufacturer: text("manufacturer").notNull(),
  model: text("model").notNull(),
  isBuiltIn: boolean("is_built_in").notNull().default(false),
  hardware: jsonb("hardware").notNull().$type<HardwareSpec>(),
});

export const insertDeviceProfileSchema = createInsertSchema(deviceProfilesTable);
export type InsertDeviceProfile = z.infer<typeof insertDeviceProfileSchema>;
export type DeviceProfile = typeof deviceProfilesTable.$inferSelect;
