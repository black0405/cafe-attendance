import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { workedHours } from "@/lib/punch";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Everything the admin dashboard shows, in one request.
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = startOfDay(now);
  const weekAgo = new Date(today.getTime() - 6 * DAY);
  const monday = new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY);
  const since = monday < weekAgo ? monday : weekAgo;

  const [staffCount, open, records] = await Promise.all([
    prisma.user.count({ where: { archived: false, is_admin: false } }),
    prisma.attendanceRecord.findMany({
      where: { clockOut: null },
      orderBy: { clockIn: "asc" },
      include: { user: { select: { name: true, phone: true } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { clockIn: { gte: since } },
      orderBy: { clockIn: "desc" },
      include: { user: { select: { name: true, phone: true } } },
    }),
  ]);

  const nameOf = (u: { name: string | null; phone: string | null }) => u.name || u.phone || "Staff";

  // Open shifts count up to now so today's hours are live.
  const hoursThisWeek = records
    .filter((r) => r.clockIn >= monday)
    .reduce((sum, r) => sum + (workedHours({ ...r, clockOut: r.clockOut ?? now }) ?? 0), 0);

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekAgo.getTime() + i * DAY);
    const next = new Date(day.getTime() + DAY);
    return {
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      shifts: records.filter((r) => r.clockIn >= day && r.clockIn < next).length,
    };
  });

  return NextResponse.json({
    staffCount,
    shiftsToday: records.filter((r) => r.clockIn >= today).length,
    hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
    inNow: open.map((r) => ({
      id: r.id,
      name: nameOf(r.user),
      since: r.clockIn,
      onLunch: Boolean(r.lunchStart && !r.lunchEnd),
    })),
    week,
    recent: records.slice(0, 8).map((r) => ({
      id: r.id,
      name: nameOf(r.user),
      clockIn: r.clockIn,
      clockOut: r.clockOut,
    })),
  });
}
