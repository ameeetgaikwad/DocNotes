import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

// Personal insight / observation notes (Manoj msg 2595). Free-form
// clinical observations, reading takeaways, disease insights — kept
// separate from any patient record. Per-doctor. Soft delete per Manoj
// msg 2597 so a valuable observation isn't lost to an accidental tap.
export const insightNotes = pgTable(
  "insight_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    // Optional per Manoj's spec. Doctors may just type a body without
    // giving the note a name.
    title: varchar("title", { length: 200 }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    // Soft delete: hidden from the list but recoverable if we ever
    // add a "Recently Deleted" view for insight notes down the road.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("insight_notes_provider_idx").on(table.providerId),
    // Ordering + list scans always sort by updatedAt DESC.
    index("insight_notes_updated_at_idx").on(table.updatedAt),
  ],
);

export type InsightNote = typeof insightNotes.$inferSelect;
export type NewInsightNote = typeof insightNotes.$inferInsert;
