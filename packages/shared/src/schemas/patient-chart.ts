import { z } from "zod";

// Patient Charts (Amit msg 3051, spec Manoj msg 3054). Numbers travel
// as JS numbers here; the router stringifies for the numeric columns.

export const chartMetricSchema = z.enum(["bp", "sugar", "weight", "custom"]);
export type ChartMetric = z.infer<typeof chartMetricSchema>;

export const sugarTypeSchema = z.enum(["fasting", "postprandial", "random"]);
export type SugarType = z.infer<typeof sugarTypeSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

export const upsertChartDefinitionSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Chart name is required")
      .max(80, "Chart name must be 80 characters or fewer"),
    unit: z.string().trim().max(30).nullable().optional(),
    normalMin: z.number().finite().nullable().optional(),
    normalMax: z.number().finite().nullable().optional(),
  })
  .refine(
    (v) =>
      v.normalMin == null || v.normalMax == null || v.normalMin <= v.normalMax,
    { message: "Normal min must be below normal max", path: ["normalMax"] },
  );
export type UpsertChartDefinition = z.infer<typeof upsertChartDefinitionSchema>;

export const addChartReadingSchema = z
  .object({
    patientId: z.string().uuid(),
    metric: chartMetricSchema,
    definitionId: z.string().uuid().optional(),
    readingDate: isoDate,
    value: z.number().finite().min(0).max(100000),
    value2: z.number().finite().min(0).max(100000).optional(),
    sugarType: sugarTypeSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.metric === "custom" && !v.definitionId) {
      ctx.addIssue({
        code: "custom",
        message: "Pick a chart",
        path: ["definitionId"],
      });
    }
    if (v.metric === "bp") {
      if (v.value2 == null) {
        ctx.addIssue({
          code: "custom",
          message: "Enter both BP values",
          path: ["value2"],
        });
      }
      if (v.value < 40 || v.value > 300) {
        ctx.addIssue({
          code: "custom",
          message: "Systolic must be 40–300",
          path: ["value"],
        });
      }
      if (v.value2 != null && (v.value2 < 20 || v.value2 > 200)) {
        ctx.addIssue({
          code: "custom",
          message: "Diastolic must be 20–200",
          path: ["value2"],
        });
      }
    }
    if (v.metric === "sugar" && !v.sugarType) {
      ctx.addIssue({
        code: "custom",
        message: "Pick a sugar type",
        path: ["sugarType"],
      });
    }
  });
export type AddChartReading = z.infer<typeof addChartReadingSchema>;
