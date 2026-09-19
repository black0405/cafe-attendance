import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildWorkbook, rangeFor, sendReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

// GET ?range=week|month&offset=0|-1  -> Excel download
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const p = new URL(request.url).searchParams;
  const range = rangeFor(p.get("range") || "week", Number(p.get("offset") || 0));
  const xlsx = await buildWorkbook(range);
  return new NextResponse(xlsx, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-${range.label}.xlsx"`,
    },
  });
}

// POST { range, offset } -> email the report now (also used as "send test")
export async function POST(request: Request) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const range = rangeFor(body.range || "week", Number(body.offset ?? -1));
    await sendReport(range);
    return NextResponse.json({ success: true, label: range.label });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Send failed" },
      { status: 400 }
    );
  }
}
