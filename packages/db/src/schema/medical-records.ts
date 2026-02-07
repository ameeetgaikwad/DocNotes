import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { patients } from "./patients.js";
import { users } from "./users.js";

export const medicalRecords = pgTable(
  "medical_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    content: jsonb("content"),
    vitals: jsonb("vitals"),
    diagnoses: jsonb("diagnoses").notNull().default([]),
    version: integer("version").notNull().default(1),
    parentId: uuid("parent_id"),
    attachments: jsonb("attachments").notNull().default([]),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("medical_records_patient_idx").on(table.patientId),
    index("medical_records_type_idx").on(table.type),
    index("medical_records_created_by_idx").on(table.createdBy),
    index("medical_records_parent_idx").on(table.parentId),
    index("medical_records_created_at_idx").on(table.createdAt),
  ],
);
