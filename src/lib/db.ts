import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import {
  customType,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export { count, desc, eq, sql } from "drizzle-orm";

const readEnv = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    if (typeof process !== "undefined" && process.env?.[key])
      return process.env[key];
    const fromImport = (import.meta.env as Record<string, string | undefined>)[
      key
    ];
    if (fromImport) return fromImport;
  }
  return undefined;
};

const url = readEnv("TURSO_DATABASE_URL", "ASTRO_DB_REMOTE_URL");
const authToken = readEnv("TURSO_AUTH_TOKEN", "ASTRO_DB_APP_TOKEN");

if (!url) {
  throw new Error(
    "Missing database URL. Set TURSO_DATABASE_URL (or ASTRO_DB_REMOTE_URL).",
  );
}

const isoDate = customType<{ data: Date; driverData: string }>({
  dataType: () => "text",
  toDriver: (value) => value.toISOString(),
  fromDriver: (value) => new Date(/Z$/.test(value) ? value : `${value}Z`),
});

export const Guestbook = sqliteTable("Guestbook", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  message: text("message").notNull(),
  website: text("website"),
  parentId: integer("parentId"),
  heartCount: integer("heartCount"),
  createdAt: isoDate("createdAt").notNull(),
});

export const db = drizzle(createClient({ url, authToken }));
