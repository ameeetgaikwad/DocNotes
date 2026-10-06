import {
  pgTable,
  uuid,
  text,
  varchar,
  date,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { patients } from "./patients.js";

// Patient Charts (Amit msg 3051, spec answers Manoj msg 3054).
// BP / Sugar / Weight charts read straight from patient_visits; these
// tables only hold what the doctor adds inside Charts. One-way sync:
// nothing here ever writes back to patient_visits. Soft delete per
// Manoj msg 3054.

// Doctor-wide custom chart types (e.g. "Creatinine", mg/dL). Creating
// one makes it available on every patient of that doctor.
export const chartDefinitions = pgTable(
  "chart_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 80 }).notNull(),
    unit: varchar("unit", { length: 30 }),
    // Optional normal-range band shown on the chart.
    normalMin: numeric("normal_min", { precision: 10, scale: 2 }),
    normalMax: numeric("normal_max", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("chart_definitions_provider_idx").on(table.providerId)],
);

// Readings added directly in Charts. `metric` is one of the built-in
// charts ("bp" | "sugar" | "weight") or "custom" with definitionId set.
// BP uses value = systolic, value2 = diastolic. Sugar sets sugarType.
export const chartReadings = pgTable(
  "chart_readings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    metric: varchar("metric", { length: 16 }).notNull(),
    definitionId: uuid("definition_id").references(() => chartDefinitions.id),
    readingDate: date("reading_date").notNull(),
    value: numeric("value", { precision: 10, scale: 2 }).notNull(),
    value2: numeric("value2", { precision: 10, scale: 2 }),
    sugarType: varchar("sugar_type", { length: 16 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("chart_readings_patient_idx").on(table.patientId, table.metric),
    index("chart_readings_definition_idx").on(table.definitionId),
  ],
);

export type ChartDefinition = typeof chartDefinitions.$inferSelect;
export type ChartReading = typeof chartReadings.$inferSelect;
