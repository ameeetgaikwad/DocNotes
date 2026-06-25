import { z } from "zod";
import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  users,
  doctorProfiles,
  patients,
  dailyRegisterEntries,
} from "@docnotes/db";
import { adminProcedure, router } from "../trpc.js";

const intervalSchema = z.enum(["24h", "7d", "30d", "90d", "all"]);
type Interval = z.infer<typeof intervalSchema>;

// Map a window keyword to (startDate, bucketUnit). For ≤30d windows we
// bucket by day; 90d by week; "all" by month. Keeps the bucket count
// reasonable so the line chart stays readable on any horizon.
function intervalToBuckets(interval: Interval): {
  startDateClause: ReturnType<typeof sql>;
  bucket: "day" | "week" | "month";
} {
  switch (interval) {
    case "24h":
      return {
        startDateClause: sql`now() - interval '24 hours'`,
        bucket: "day",
      };
    case "7d":
      return {
        startDateClause: sql`now() - interval '7 days'`,
        bucket: "day",
      };
    case "30d":
      return {
        startDateClause: sql`now() - interval '30 days'`,
        bucket: "day",
      };
    case "90d":
      return {
        startDateClause: sql`now() - interval '90 days'`,
        bucket: "week",
      };
    case "all":
      return {
        startDateClause: sql`'1970-01-01'::timestamp`,
        bucket: "month",
      };
  }
}

const doctorListSortSchema = z.enum([
  "lastActive",
  "signupAt",
  "patientCount",
  "revenue",
  "clinic",
]);

export const adminRouter = router({
  // Server-side admin check. The admin web shell hits this on first
  // load — UNAUTHORIZED bounces them to sign-in, FORBIDDEN renders the
  // "not authorized" screen. adminProcedure already enforces role.
  me: adminProcedure.query(({ ctx }) => {
    return { userId: ctx.session.userId, role: ctx.session.role };
  }),

  overview: adminProcedure.query(async ({ ctx }) => {
    const [totals] = await ctx.db
      .select({
        totalDoctors: sql<number>`(select count(*) from ${users})`,
        signups30d: sql<number>`(select count(*) from ${users} where ${users.createdAt} > now() - interval '30 days')`,
        totalPatients: sql<number>`(select count(*) from ${patients} where ${patients.isActive} = true)`,
        // Revenue: paid in full + paid portion of due/split entries.
        totalRevenue: sql<string>`(select coalesce(sum(case when ${dailyRegisterEntries.paymentStatus} = 'paid' then ${dailyRegisterEntries.feeAmount} else ${dailyRegisterEntries.paidAmount} end), 0) from ${dailyRegisterEntries})`,
      })
      .from(sql`(select 1) as _dummy`);
    return {
      totalDoctors: Number(totals?.totalDoctors ?? 0),
      signups30d: Number(totals?.signups30d ?? 0),
      totalPatients: Number(totals?.totalPatients ?? 0),
      totalRevenue: Number(totals?.totalRevenue ?? 0),
    };
  }),

  signupsSeries: adminProcedure
    .input(z.object({ interval: intervalSchema }))
    .query(async ({ ctx, input }) => {
      const { startDateClause, bucket } = intervalToBuckets(input.interval);
      const rows = await ctx.db
        .select({
          bucket: sql<string>`to_char(date_trunc(${bucket}, ${users.createdAt}), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)`,
        })
        .from(users)
        .where(sql`${users.createdAt} >= ${startDateClause}`)
        .groupBy(sql`date_trunc(${bucket}, ${users.createdAt})`)
        .orderBy(asc(sql`date_trunc(${bucket}, ${users.createdAt})`));
      return rows.map((r) => ({
        bucket: r.bucket,
        count: Number(r.count),
      }));
    }),

  registerSeries: adminProcedure
    .input(z.object({ interval: intervalSchema }))
    .query(async ({ ctx, input }) => {
      const { startDateClause, bucket } = intervalToBuckets(input.interval);
      const rows = await ctx.db
        .select({
          bucket: sql<string>`to_char(date_trunc(${bucket}, ${dailyRegisterEntries.visitDate}::timestamp), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)`,
        })
        .from(dailyRegisterEntries)
        .where(
          sql`${dailyRegisterEntries.visitDate}::timestamp >= ${startDateClause}`,
        )
        .groupBy(
          sql`date_trunc(${bucket}, ${dailyRegisterEntries.visitDate}::timestamp)`,
        )
        .orderBy(
          asc(
            sql`date_trunc(${bucket}, ${dailyRegisterEntries.visitDate}::timestamp)`,
          ),
        );
      return rows.map((r) => ({
        bucket: r.bucket,
        count: Number(r.count),
      }));
    }),

  doctorList: adminProcedure
    .input(
      z.object({
        query: z.string().trim().min(1).optional(),
        sort: doctorListSortSchema.default("lastActive"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.query;
      const rows = await ctx.db
        .select({
          userId: users.id,
          fullName: doctorProfiles.fullName,
          clinicName: doctorProfiles.clinicName,
          email: doctorProfiles.email,
          signupAt: users.createdAt,
          patientCount: sql<number>`(select count(*) from ${patients} where ${patients.createdBy} = ${users.id})`,
          totalRevenue: sql<string>`(select coalesce(sum(case when ${dailyRegisterEntries.paymentStatus} = 'paid' then ${dailyRegisterEntries.feeAmount} else ${dailyRegisterEntries.paidAmount} end), 0) from ${dailyRegisterEntries} where ${dailyRegisterEntries.providerId} = ${users.id})`,
          lastActive: sql<Date | null>`(select max(${dailyRegisterEntries.createdAt}) from ${dailyRegisterEntries} where ${dailyRegisterEntries.providerId} = ${users.id})`,
        })
        .from(users)
        .leftJoin(doctorProfiles, eq(doctorProfiles.userId, users.id))
        .where(
          q
            ? sql`(lower(coalesce(${doctorProfiles.fullName}, '')) like ${"%" + q.toLowerCase() + "%"} or lower(coalesce(${doctorProfiles.clinicName}, '')) like ${"%" + q.toLowerCase() + "%"} or lower(coalesce(${doctorProfiles.email}, '')) like ${"%" + q.toLowerCase() + "%"})`
            : undefined,
        );

      const list = rows.map((r) => ({
        userId: r.userId,
        fullName: r.fullName ?? null,
        clinicName: r.clinicName ?? null,
        email: r.email ?? null,
        signupAt: r.signupAt,
        lastActive: r.lastActive ?? null,
        patientCount: Number(r.patientCount ?? 0),
        totalRevenue: Number(r.totalRevenue ?? 0),
      }));

      list.sort((a, b) => {
        switch (input.sort) {
          case "lastActive":
            return (
              (b.lastActive?.getTime() ?? 0) - (a.lastActive?.getTime() ?? 0)
            );
          case "signupAt":
            return b.signupAt.getTime() - a.signupAt.getTime();
          case "patientCount":
            return b.patientCount - a.patientCount;
          case "revenue":
            return b.totalRevenue - a.totalRevenue;
          case "clinic":
            return (a.clinicName ?? "").localeCompare(b.clinicName ?? "");
        }
      });
      return list;
    }),

  doctorDetail: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [base] = await ctx.db
        .select({
          userId: users.id,
          fullName: doctorProfiles.fullName,
          clinicName: doctorProfiles.clinicName,
          email: doctorProfiles.email,
          signupAt: users.createdAt,
        })
        .from(users)
        .leftJoin(doctorProfiles, eq(doctorProfiles.userId, users.id))
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!base) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Doctor not found" });
      }

      const [patientStats] = await ctx.db
        .select({ count: count() })
        .from(patients)
        .where(eq(patients.createdBy, input.userId));

      const [entryStats] = await ctx.db
        .select({
          count: count(),
          revenue: sql<string>`coalesce(sum(case when ${dailyRegisterEntries.paymentStatus} = 'paid' then ${dailyRegisterEntries.feeAmount} else ${dailyRegisterEntries.paidAmount} end), 0)`,
          outstanding: sql<string>`coalesce(sum(case when ${dailyRegisterEntries.paymentStatus} in ('due', 'split') then greatest(${dailyRegisterEntries.feeAmount} - ${dailyRegisterEntries.paidAmount}, 0) else 0 end), 0)`,
          lastActive: sql<Date | null>`max(${dailyRegisterEntries.createdAt})`,
        })
        .from(dailyRegisterEntries)
        .where(eq(dailyRegisterEntries.providerId, input.userId));

      return {
        ...base,
        patientCount: Number(patientStats?.count ?? 0),
        registerEntryCount: Number(entryStats?.count ?? 0),
        totalRevenue: Number(entryStats?.revenue ?? 0),
        outstandingDues: Number(entryStats?.outstanding ?? 0),
        lastActive: entryStats?.lastActive ?? null,
      };
    }),

  doctorActivitySeries: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        interval: intervalSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { startDateClause, bucket } = intervalToBuckets(input.interval);
      const rows = await ctx.db
        .select({
          bucket: sql<string>`to_char(date_trunc(${bucket}, ${dailyRegisterEntries.visitDate}::timestamp), 'YYYY-MM-DD')`,
          count: sql<number>`count(*)`,
        })
        .from(dailyRegisterEntries)
        .where(
          and(
            eq(dailyRegisterEntries.providerId, input.userId),
            sql`${dailyRegisterEntries.visitDate}::timestamp >= ${startDateClause}`,
          ),
        )
        .groupBy(
          sql`date_trunc(${bucket}, ${dailyRegisterEntries.visitDate}::timestamp)`,
        )
        .orderBy(
          asc(
            sql`date_trunc(${bucket}, ${dailyRegisterEntries.visitDate}::timestamp)`,
          ),
        );
      return rows.map((r) => ({
        bucket: r.bucket,
        count: Number(r.count),
      }));
    }),

  doctorTopServices: adminProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          serviceType: dailyRegisterEntries.serviceType,
          count: count(),
        })
        .from(dailyRegisterEntries)
        .where(
          and(
            eq(dailyRegisterEntries.providerId, input.userId),
            sql`${dailyRegisterEntries.serviceType} is not null`,
          ),
        )
        .groupBy(dailyRegisterEntries.serviceType)
        .orderBy(desc(count()))
        .limit(8);
      return rows.map((r) => ({
        serviceType: r.serviceType ?? "—",
        count: Number(r.count),
      }));
    }),
});
