import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const customTodoSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string(),
  text: z.string(),
  dueDate: z.string().nullable(),
  completedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CustomTodo = z.infer<typeof customTodoSchema>;

export const createCustomTodoSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Task description is required")
    .max(500, "Task must be 500 characters or fewer"),
  dueDate: isoDate.nullable().optional(),
});

export type CreateCustomTodo = z.infer<typeof createCustomTodoSchema>;

export const updateCustomTodoSchema = z.object({
  id: z.string().uuid(),
  text: z.string().trim().min(1).max(500).optional(),
  dueDate: isoDate.nullable().optional(),
});

export type UpdateCustomTodo = z.infer<typeof updateCustomTodoSchema>;
