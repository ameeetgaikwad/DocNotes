import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { patientVisits } from "./patient-visits.js";

export const prescriptionLines = pgTable(
  "prescription_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    visitId: uuid("visit_id")
      .notNull()
      .references(() => patientVisits.id, { onDelete: "cascade" }),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    position: integer("position").notNull().default(0),
    medicineName: varchar("medicine_name", { length: 200 }).notNull(),
    tabletsCount: integer("tablets_count"),
    dosage: varchar("dosage", { length: 100 }),
    frequency: varchar("frequency", { length: 100 }),
    duration: varchar("duration", { length: 50 }),
    instructions: text("instructions"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("prescription_lines_visit_idx").on(table.visitId),
    index("prescription_lines_provider_idx").on(table.providerId),
  ],
);

export type PrescriptionLine = typeof prescriptionLines.$inferSelect;
export type NewPrescriptionLine = typeof prescriptionLines.$inferInsert;
