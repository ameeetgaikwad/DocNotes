import {
  pgTable,
  uuid,
  text,
  varchar,
  numeric,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const clinicExpenseCategories = pgTable(
  "clinic_expense_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("clinic_expense_categories_provider_name_uq").on(
      table.providerId,
      table.name,
    ),
  ],
);

export const clinicExpenses = pgTable(
  "clinic_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: text("provider_id")
      .notNull()
      .references(() => users.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    categoryName: varchar("category_name", { length: 100 }).notNull(),
    expenseDate: date("expense_date").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentMethod: text("payment_method"),
    staffName: text("staff_name"),
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
    index("clinic_expenses_provider_idx").on(table.providerId),
    index("clinic_expenses_provider_date_idx").on(
      table.providerId,
      table.expenseDate,
    ),
  ],
);

export type ClinicExpenseCategory = typeof clinicExpenseCategories.$inferSelect;
export type NewClinicExpenseCategory =
  typeof clinicExpenseCategories.$inferInsert;
export type ClinicExpense = typeof clinicExpenses.$inferSelect;
export type NewClinicExpense = typeof clinicExpenses.$inferInsert;
