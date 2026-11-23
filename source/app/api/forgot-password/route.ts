import { NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { hashPassword, loginWhere } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Forgot password: proves the person has access to the laptop itself.
// "request" writes a 6-digit code to a file in the data folder; "reset" takes
// that code plus a new password. The code lives in memory only, expires after
// 15 minutes and dies after 5 wrong tries.

const DATA_DIR = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "CafeAttendance")
  : process.cwd();
const CODE_FILE = path.join(DATA_DIR, "password-reset-code.txt");
const TTL_MS = 15 * 60 * 1000;
const MAX_TRIES = 5;

type Pending = { code: string; expires: number; tries: number };
const g = globalThis as unknown as { resetCode?: Pending };

function clear() {
  g.resetCode = undefined;
  fs.rmSync(CODE_FILE, { force: true });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (body.action === "request") {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    g.resetCode = { code, expires: Date.now() + TTL_MS, tries: 0 };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      CODE_FILE,
      `Cafe Attendance password reset code: ${code}\r\n` +
        `Valid for 15 minutes. Delete this file if you did not ask for it.\r\n`
    );
    return NextResponse.json({ success: true, file: CODE_FILE });
  }

  if (body.action === "reset") {
    const pending = g.resetCode;
    if (!pending || Date.now() > pending.expires) {
      clear();
      return NextResponse.json(
        { error: "No valid code. Request a new one." },
        { status: 400 }
      );
    }
    const code = String(body.code ?? "").trim();
    const ok =
      code.length === pending.code.length &&
      crypto.timingSafeEqual(Buffer.from(code), Buffer.from(pending.code));
    if (!ok) {
      if (++pending.tries >= MAX_TRIES) clear();
      return NextResponse.json({ error: "Wrong code" }, { status: 400 });
    }

    const password = String(body.password ?? "");
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    const admin = await prisma.user.findFirst({
      where: { ...loginWhere(String(body.email ?? "").trim()), is_admin: true },
    });
    if (!admin) {
      return NextResponse.json(
        { error: "No admin with that email or phone" },
        { status: 404 }
      );
    }

    await prisma.user.update({
      where: { id: admin.id },
      data: { password: await hashPassword(password) },
    });
    clear();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
