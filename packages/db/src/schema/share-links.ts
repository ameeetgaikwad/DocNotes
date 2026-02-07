import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceType: varchar("resource_type", { length: 50 }).notNull(),
    resourceId: uuid("resource_id").notNull(),
    token: varchar("token", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    accessCount: integer("access_count").notNull().default(0),
    maxAccesses: integer("max_accesses"),
    isRevoked: boolean("is_revoked").notNull().default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("share_links_token_idx").on(table.token),
    index("share_links_resource_idx").on(table.resourceType, table.resourceId),
    index("share_links_expires_at_idx").on(table.expiresAt),
  ],
);
