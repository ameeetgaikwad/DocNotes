import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { patients } from "./patients.js";
import { medicalRecords } from "./medical-records.js";
import { users } from "./users.js";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    medicalRecordId: uuid("medical_record_id").references(
      () => medicalRecords.id,
    ),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    s3Key: varchar("s3_key", { length: 1024 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("uploading"),
    notes: text("notes"),
    uploadedBy: uuid("uploaded_by")
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
    index("documents_patient_idx").on(table.patientId),
    index("documents_medical_record_idx").on(table.medicalRecordId),
    index("documents_category_idx").on(table.category),
    index("documents_s3_key_idx").on(table.s3Key),
  ],
);
