import { NextResponse } from "next/server";
import { matchFace, DESCRIPTOR_LENGTH } from "@/lib/face";
import { applyPunch } from "@/lib/punch";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public (kiosk): { userId, descriptor: number[128], ptp, action } -> punch.
// Two checks: the server re-matches the face itself, and the person types their
// PTP. A punch only lands when both belong to the staff member the kiosk showed.
export async function POST(request: Request) {
  try {
    const { userId, descriptor, ptp, action } = await request.json();
    if (!Array.isArray(descriptor) || descriptor.length !== DESCRIPTOR_LENGTH) {
      return NextResponse.json({ error: "Look at the camera to clock in" }, { status: 400 });
    }
    const match = await matchFace(descriptor);
    if (!match || match.userId !== Number(userId)) {
      return NextResponse.json({ error: "Face not recognised, try again" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: match.userId }, select: { ptp: true } });
    if (!user?.ptp || String(ptp ?? "") !== user.ptp) {
      return NextResponse.json({ error: "Wrong PTP" }, { status: 401 });
    }

    const now = new Date();
    const result = await applyPunch(match.userId, action === "lunch" ? "lunch" : "punch", now);
    return NextResponse.json({ action: result, timestamp: now });
  } catch (error) {
    console.error("Punch error:", error);
    const msg = error instanceof Error ? error.message : "Punch failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
