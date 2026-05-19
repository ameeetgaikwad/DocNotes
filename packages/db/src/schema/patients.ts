import {
  pgTable,
  uuid,
  varchar,
  date,
  text,
  boolean,
  timestamp,
  jsonb,
  smallint,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    middleName: varchar("middle_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }).notNull(),
    dateOfBirth: date("date_of_birth"),
    dobDay: smallint("dob_day"),
    dobMonth: smallint("dob_month"),
    dobYear: smallint("dob_year"),
    gender: varchar("gender", { length: 20 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),
    bloodType: varchar("blood_type", { length: 5 }),
    allergies: jsonb("allergies").notNull().default([]),
    allergyNotes: text("allergy_notes"),
    activeConditions: jsonb("active_conditions").notNull().default([]),
    conditionNotes: text("condition_notes"),
    dietNotes: text("diet_notes"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    marked: boolean("marked").notNull().default(false),
    createdBy: text("created_by")
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
    index("patients_name_idx").on(table.lastName, table.firstName),
    index("patients_dob_idx").on(table.dateOfBirth),
    index("patients_created_by_idx").on(table.createdBy),
  ],
);
