import { NextResponse } from "next/server";
import { matchFace, DESCRIPTOR_LENGTH } from "@/lib/face";

export const dynamic = "force-dynamic";

// Public (kiosk): { descriptor: number[128] } -> { userId, name } or 404.
// Identification only; /api/kiosk/punch re-matches the face before recording.
export async function POST(request: Request) {
  const { descriptor } = await request.json().catch(() => ({}));
  if (!Array.isArray(descriptor) || descriptor.length !== DESCRIPTOR_LENGTH) {
    return NextResponse.json({ error: "Invalid descriptor" }, { status: 400 });
  }
  const match = await matchFace(descriptor);
  if (!match) {
    return NextResponse.json({ error: "Face not recognised" }, { status: 404 });
  }
  return NextResponse.json(match);
}
