import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// First-run setup: a fresh install has no users, so the first visitor creates the admin.
// Once any user exists, POST is refused.

export async function GET() {
  return NextResponse.json({ needsSetup: (await prisma.user.count()) === 0 });
}

export async function POST(request: Request) {
  const { name, email, password } = await request.json();
  const cleanEmail = String(email ?? "").trim();
  if (!cleanEmail || !password || String(password).length < 8) {
    return NextResponse.json(
      { error: "Email and a password of at least 8 characters are required" },
      { status: 400 }
    );
  }

  const hashed = await hashPassword(String(password));
  const created = await prisma.$transaction(async (tx) => {
    if ((await tx.user.count()) > 0) return false;
    await tx.user.create({
      data: {
        email: cleanEmail,
        name: String(name ?? "").trim() || "Admin",
        password: hashed,
        is_admin: true,
        ptp_verified: true,
      },
    });
    return true;
  });

  if (!created) {
    return NextResponse.json({ error: "Setup already done" }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
