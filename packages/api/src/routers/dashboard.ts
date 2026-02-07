import { sql, eq, gte, lte, and, asc } from "drizzle-orm";
import { patients, appointments, medicalRecords } from "@docnotes/db";
import { protectedProcedure, router } from "../trpc.js";

export const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();

    // Today boundaries
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Week start (Monday)
    const weekStart = new Date(now);
    weekStart.setDate(
      now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1),
    );
    weekStart.setHours(0, 0, 0, 0);

    const [patientCount, todayAppointments, weekRecords, todaySchedule] =
      await Promise.all([
        // Total active patients
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(patients)
          .where(eq(patients.isActive, true)),

        // Today's appointments count
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(appointments)
          .where(
            and(
              gte(appointments.scheduledAt, todayStart),
              lte(appointments.scheduledAt, todayEnd),
            ),
          ),

        // Medical records created this week
        ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(medicalRecords)
          .where(gte(medicalRecords.createdAt, weekStart)),

        // Today's appointments list (for schedule panel)
        ctx.db
          .select()
          .from(appointments)
          .where(
            and(
              gte(appointments.scheduledAt, todayStart),
              lte(appointments.scheduledAt, todayEnd),
            ),
          )
          .orderBy(asc(appointments.scheduledAt))
          .limit(10),
      ]);

    return {
      totalPatients: Number(patientCount[0]?.count ?? 0),
      todayAppointments: Number(todayAppointments[0]?.count ?? 0),
      recordsThisWeek: Number(weekRecords[0]?.count ?? 0),
      todaySchedule,
    };
  }),
});
