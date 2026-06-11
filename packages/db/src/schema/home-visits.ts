import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const homeVisits = pgTable(
  "home_visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    patientName: varchar("patient_name", { length: 200 }).notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("home_visits_provider_idx").on(table.providerId),
    index("home_visits_provider_scheduled_idx").on(
      table.providerId,
      table.scheduledAt,
    ),
  ],
);

export type HomeVisit = typeof homeVisits.$inferSelect;
export type NewHomeVisit = typeof homeVisits.$inferInsert;
