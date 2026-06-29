import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const romsTable = pgTable("roms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  romType: text("rom_type").notNull(), // redroid-gsi | qemu-arm | qemu-x86 | custom
  filename: text("filename").notNull(),
  sizeMb: integer("size_mb").notNull().default(0),
  androidVersion: text("android_version").notNull(),
  deviceName: text("device_name"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRomSchema = createInsertSchema(romsTable).omit({ createdAt: true });
export type InsertRom = z.infer<typeof insertRomSchema>;
export type Rom = typeof romsTable.$inferSelect;
