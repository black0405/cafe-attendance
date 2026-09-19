import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public: kiosk screen lists staff so an employee can tap their name.
export async function GET() {
  const users = await prisma.user.findMany({
    where: { archived: false, is_admin: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      credentials: { select: { id: true } },
      records: {
        where: { clockOut: null },
        select: { clockIn: true, lunchStart: true, lunchEnd: true },
        take: 1,
      },
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: u.name || u.phone || `Staff #${u.id}`,
      enrolled: u.credentials.length > 0,
      clockedInAt: u.records[0]?.clockIn ?? null,
      onLunchSince:
        u.records[0]?.lunchStart && !u.records[0]?.lunchEnd
          ? u.records[0].lunchStart
          : null,
      lunchTaken: Boolean(u.records[0]?.lunchEnd),
    }))
  );
}
