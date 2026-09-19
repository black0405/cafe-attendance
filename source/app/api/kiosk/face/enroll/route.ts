import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { toBytes, matchFace } from "@/lib/face";

export const dynamic = "force-dynamic";

// Admin: { userId, descriptor } -> stores one face sample (take 2-3 per person).
export async function POST(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { userId, descriptor } = await request.json();
    const bytes = toBytes(descriptor);

    // Refuse a face that already matches a different person.
    const clash = await matchFace(descriptor);
    if (clash && clash.userId !== Number(userId)) {
      return NextResponse.json(
        { error: `This face already matches ${clash.name}` },
        { status: 409 }
      );
    }

    await prisma.faceDescriptor.create({
      data: { userId: Number(userId), descriptor: bytes },
    });
    const count = await prisma.faceDescriptor.count({ where: { userId: Number(userId) } });
    return NextResponse.json({ success: true, samples: count });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Face enrollment failed" },
      { status: 400 }
    );
  }
}

// Admin: remove all face samples for a user.
export async function DELETE(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = Number(new URL(request.url).searchParams.get("userId"));
  await prisma.faceDescriptor.deleteMany({ where: { userId } });
  return NextResponse.json({ success: true });
}
