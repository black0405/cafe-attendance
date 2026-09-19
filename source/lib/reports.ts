import nodemailer from "nodemailer";
import { prisma } from "./prisma";

// Settings live in the `settings` key/value table so the admin can edit them
// from the UI without touching env vars on the cafe laptop.
export type Settings = Record<string, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSettings(values: Settings) {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
}

export interface Range {
  from: Date;
  to: Date; // exclusive
  label: string;
}

// Local date, not UTC, so a Monday in India is not labelled Sunday.
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Monday 00:00 to next Monday 00:00, local time. offset -1 = last week.
export function weekRange(offset = 0): Range {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  const to = new Date(d);
  to.setDate(to.getDate() + 7);
  return { from: d, to, label: `week-${iso(d)}` };
}

export function monthRange(offset = 0): Range {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  const to = new Date(d.getFullYear(), d.getMonth() + offset + 1, 1);
  return { from, to, label: `month-${iso(from).slice(0, 7)}` };
}

export function rangeFor(kind: string, offset: number): Range {
  return kind === "month" ? monthRange(offset) : weekRange(offset);
}

const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const hours = (a: Date, b: Date) => ((b.getTime() - a.getTime()) / 36e5).toFixed(2);

export async function buildCsv({ from, to }: Range): Promise<string> {
  const records = await prisma.attendanceRecord.findMany({
    where: { clockIn: { gte: from, lt: to } },
    include: { user: { select: { name: true, phone: true, email: true } } },
    orderBy: [{ clockIn: "asc" }],
  });

  const lines = ["Date,Name,Phone,Email,Clock In,Clock Out,Hours"];
  const totals = new Map<string, number>();
  for (const r of records) {
    const who = r.user.name || r.user.phone || r.user.email || "";
    const out = r.clockOut ? r.clockOut.toLocaleTimeString() : "(open)";
    const h = r.clockOut ? hours(r.clockIn, r.clockOut) : "";
    if (h) totals.set(who, (totals.get(who) || 0) + Number(h));
    lines.push(
      [
        r.clockIn.toLocaleDateString(),
        who,
        r.user.phone,
        r.user.email,
        r.clockIn.toLocaleTimeString(),
        out,
        h,
      ]
        .map(q)
        .join(",")
    );
  }
  lines.push("", "Totals", "Name,Hours");
  for (const [who, h] of Array.from(totals.entries()).sort()) lines.push(`${q(who)},${h.toFixed(2)}`);
  return lines.join("\r\n");
}

export async function sendReport(range: Range) {
  const s = await getSettings();
  if (!s.smtp_host || !s.smtp_user || !s.smtp_pass || !s.report_to) {
    throw new Error("Email settings incomplete (host, user, password, to)");
  }
  const transport = nodemailer.createTransport({
    host: s.smtp_host,
    port: Number(s.smtp_port || 587),
    secure: Number(s.smtp_port) === 465,
    auth: { user: s.smtp_user, pass: s.smtp_pass },
  });
  const csv = await buildCsv(range);
  await transport.sendMail({
    from: s.smtp_user,
    to: s.report_to,
    subject: `Attendance report ${range.label}`,
    text: `Attendance for ${iso(range.from)} to ${iso(new Date(range.to.getTime() - 1))} attached.`,
    attachments: [{ filename: `attendance-${range.label}.csv`, content: csv }],
  });
}

// Every 30 min: once per week, after Monday 08:00, email last week's report.
// Runs inside the Next server, so it only fires while the app is open.
// ponytail: setInterval instead of a cron lib; a missed Monday is caught the next time the app runs.
async function tick() {
  try {
    const s = await getSettings();
    if (s.report_weekly !== "1") return;
    const due = weekRange(0).from;
    due.setHours(8);
    if (new Date() < due) return;
    const last = weekRange(-1);
    if (s.report_last_weekly === last.label) return;
    await sendReport(last);
    await setSettings({ report_last_weekly: last.label });
    console.log("weekly report sent:", last.label);
  } catch (e) {
    console.error("weekly report failed:", e);
  }
}

declare global {
  var reportTimer: NodeJS.Timeout | undefined;
}

export function startReportScheduler() {
  if (global.reportTimer) return;
  global.reportTimer = setInterval(tick, 30 * 60_000);
  setTimeout(tick, 15_000);
}
