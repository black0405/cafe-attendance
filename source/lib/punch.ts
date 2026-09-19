import { prisma } from "./prisma";

export type PunchAction = "punch" | "lunch";
export type PunchResult = "in" | "out" | "lunch-start" | "lunch-end";

// Kiosk state machine, one open shift per user, one lunch break per shift.
// "punch": clock in if no open shift, else clock out (ending lunch if still on it).
// "lunch": start lunch, or end it if already started.
export async function applyPunch(
  userId: number,
  action: PunchAction,
  now = new Date()
): Promise<PunchResult> {
  const open = await prisma.attendanceRecord.findFirst({
    where: { userId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });

  if (action === "lunch") {
    if (!open) throw new Error("Clock in first");
    if (!open.lunchStart) {
      await prisma.attendanceRecord.update({
        where: { id: open.id },
        data: { lunchStart: now },
      });
      return "lunch-start";
    }
    if (!open.lunchEnd) {
      await prisma.attendanceRecord.update({
        where: { id: open.id },
        data: { lunchEnd: now },
      });
      return "lunch-end";
    }
    throw new Error("Lunch already taken this shift");
  }

  if (open) {
    await prisma.attendanceRecord.update({
      where: { id: open.id },
      data: {
        clockOut: now,
        // Forgot to end lunch? Clock-out ends it.
        ...(open.lunchStart && !open.lunchEnd ? { lunchEnd: now } : {}),
      },
    });
    return "out";
  }
  await prisma.attendanceRecord.create({ data: { userId, clockIn: now } });
  return "in";
}

// Hours worked minus lunch, as a number. Null while the shift is open.
export function workedHours(r: {
  clockIn: Date;
  clockOut: Date | null;
  lunchStart: Date | null;
  lunchEnd: Date | null;
}): number | null {
  if (!r.clockOut) return null;
  const lunch =
    r.lunchStart && r.lunchEnd ? r.lunchEnd.getTime() - r.lunchStart.getTime() : 0;
  return (r.clockOut.getTime() - r.clockIn.getTime() - lunch) / 36e5;
}
