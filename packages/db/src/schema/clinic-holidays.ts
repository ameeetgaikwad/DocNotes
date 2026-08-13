import {
  pgTable,
  uuid,
  text,
  varchar,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

// Clinic holidays / closed dates (Manoj msg 2595). A simple log of
// dates the clinic was/is closed. Hard delete per Manoj msg 2597 —
// this is not medical data and there's no regret cost to a permanent
// removal.
export const clinicHolidays = pgTable(
  "clinic_holidays",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    holidayDate: date("holiday_date").notNull(),
    // Constrained to the four options Manoj listed. Storing as
    // varchar (not a pg enum) so future additions are a client-side
    // change only, no migration required.
    reason: varchar("reason", { length: 32 }).notNull(),
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
    index("clinic_holidays_provider_idx").on(table.providerId),
    index("clinic_holidays_date_idx").on(table.holidayDate),
  ],
);

export type ClinicHoliday = typeof clinicHolidays.$inferSelect;
export type NewClinicHoliday = typeof clinicHolidays.$inferInsert;
