import {
  pgTable,
  uuid,
  text,
  date,
  smallint,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { patients } from "./patients.js";
import { users } from "./users.js";

export const patientVisits = pgTable(
  "patient_visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    visitDate: date("visit_date").notNull(),
    bpSystolic: smallint("bp_systolic"),
    bpDiastolic: smallint("bp_diastolic"),
    heartRate: smallint("heart_rate"),
    bslFasting: numeric("bsl_fasting", { precision: 5, scale: 1 }),
    bslPostprandial: numeric("bsl_postprandial", { precision: 5, scale: 1 }),
    bslRandom: numeric("bsl_random", { precision: 5, scale: 1 }),
    temperatureCelsius: numeric("temperature_celsius", {
      precision: 4,
      scale: 1,
    }),
    weightKg: numeric("weight_kg", { precision: 5, scale: 1 }),
    heightCm: numeric("height_cm", { precision: 5, scale: 1 }),
    clinicalNotes: text("clinical_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("patient_visits_patient_date_uniq").on(
      table.patientId,
      table.visitDate,
    ),
    index("patient_visits_provider_idx").on(table.providerId),
    index("patient_visits_patient_idx").on(table.patientId),
  ],
);
