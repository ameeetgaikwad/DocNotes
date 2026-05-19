import { sql, eq, gte, lte, and } from "drizzle-orm";
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

    const userId = ctx.session.userId;

    const [patientCount, todayAppointments, weekRecords] = await Promise.all([
      // Total active patients owned by this doctor
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(patients)
        .where(
          and(eq(patients.isActive, true), eq(patients.createdBy, userId)),
        ),

      // Today's appointments count for this doctor
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(appointments)
        .where(
          and(
            eq(appointments.providerId, userId),
            gte(appointments.scheduledAt, todayStart),
            lte(appointments.scheduledAt, todayEnd),
          ),
        ),

      // Medical records this doctor created this week
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(medicalRecords)
        .where(
          and(
            eq(medicalRecords.createdBy, userId),
            gte(medicalRecords.createdAt, weekStart),
          ),
        ),
    ]);

    return {
      totalPatients: Number(patientCount[0]?.count ?? 0),
      todayAppointments: Number(todayAppointments[0]?.count ?? 0),
      recordsThisWeek: Number(weekRecords[0]?.count ?? 0),
    };
  }),
});
