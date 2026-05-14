import {
  pgTable,
  uuid,
  text,
  varchar,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const doctorProfiles = pgTable(
  "doctor_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    dateOfBirth: date("date_of_birth"),
    qualification: varchar("qualification", { length: 120 }).notNull(),
    specialization: varchar("specialization", { length: 120 }),
    clinicName: varchar("clinic_name", { length: 200 }).notNull(),
    taluka: varchar("taluka", { length: 120 }).notNull(),
    district: varchar("district", { length: 120 }).notNull(),
    state: varchar("state", { length: 120 }).notNull(),
    mobileNumber: varchar("mobile_number", { length: 32 }).notNull(),
    email: varchar("email", { length: 254 }),
    registrationNumber: varchar("registration_number", {
      length: 80,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("doctor_profiles_user_id_uniq").on(table.userId)],
);

export type DoctorProfile = typeof doctorProfiles.$inferSelect;
export type NewDoctorProfile = typeof doctorProfiles.$inferInsert;
