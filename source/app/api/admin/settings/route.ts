import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings, setSettings } from "@/lib/reports";

export const dynamic = "force-dynamic";

const KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "report_to", "report_weekly"];

export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const s = await getSettings();
  return NextResponse.json({
    ...Object.fromEntries(KEYS.map((k) => [k, s[k] || ""])),
    smtp_pass: "", // never sent back; smtp_pass_set says whether one exists
    smtp_pass_set: Boolean(s.smtp_pass),
    report_last_weekly: s.report_last_weekly || "",
  });
}

export async function PUT(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const values: Record<string, string> = {};
  for (const k of KEYS) {
    if (k === "smtp_pass" && !body[k]) continue; // empty = keep existing
    if (k in body) values[k] = String(body[k] ?? "").trim();
  }
  await setSettings(values);
  return NextResponse.json({ success: true });
}
