import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, loginWhere, normalizePhone } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const email = request.headers.get("x-user-email");
    console.log("Received email header:", email);

    if (!email) {
      console.log("No email found in header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminUser = await prisma.user.findFirst({
      where: loginWhere(email || ""),
      select: { is_admin: true },
    });

    console.log("Admin check result:", adminUser);

    if (!adminUser?.is_admin) {
      console.log("User is not admin:", email);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        is_admin: true,
        ptp: true,
        ptp_verified: true,
      },
    });

    console.log("Fetched users count:", users.length);

    return NextResponse.json({
      success: true,
      users: users.map((user) => ({
        id: user.id.toString(),
        email: user.email,
        phone: user.phone,
        name: user.name,
        is_admin: user.is_admin,
        ptp: user.ptp,
        ptp_verified: user.ptp_verified,
      })),
    });
  } catch (error) {
    console.error("Error in GET /api/admin/users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const email = request.headers.get("x-user-email");
    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminUser = await prisma.user.findFirst({
      where: loginWhere(email || ""),
      select: { is_admin: true },
    });

    if (!adminUser?.is_admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const phone = normalizePhone(body.phone);
    const newUserEmail = body.email ? String(body.email).trim() : null;
    const { password, name, is_admin } = body;

    if (phone.length < 6) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    if (is_admin && !password) {
      return NextResponse.json({ error: "Admins need a password" }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ phone }, ...(newUserEmail ? [{ email: newUserEmail }] : [])],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Phone or email already exists" },
        { status: 400 }
      );
    }

    const ptp = Math.floor(1000 + Math.random() * 9000).toString();

    const newUser = await prisma.user.create({
      data: {
        email: newUserEmail,
        phone,
        // Staff sign in with the PTP; their stored password is random and never used.
        password: await hashPassword(password || crypto.randomUUID()),
        name,
        is_admin,
        ptp,
      },
      select: {
        email: true,
        name: true,
        is_admin: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User created successfully",
      user: newUser,
      ptp,
    });
  } catch (error: any) {
    console.error("Error creating user:", error);

    if (error.code === "P2002") {
      // Prisma unique constraint violation code
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
