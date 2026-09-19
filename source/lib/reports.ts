import nodemailer from "nodemailer";
import ExcelJS from "exceljs";
import { prisma } from "./prisma";
import { workedHours } from "./punch";

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

// exceljs writes JS Dates as UTC; shift by the local offset so Excel shows local time.
const xl = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000);

export async function buildWorkbook(range: Range): Promise<Buffer> {
  const { from, to } = range;
  const records = await prisma.attendanceRecord.findMany({
    where: { clockIn: { gte: from, lt: to } },
    include: { user: { select: { name: true, phone: true, email: true } } },
    orderBy: [{ clockIn: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Cafe Attendance";

  const shifts = wb.addWorksheet("Shifts", { views: [{ state: "frozen", ySplit: 1 }] });
  shifts.columns = [
    { header: "Date", key: "date", width: 12, style: { numFmt: "yyyy-mm-dd" } },
    { header: "Name", key: "name", width: 22 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 26 },
    { header: "Clock In", key: "in", width: 10, style: { numFmt: "hh:mm" } },
    { header: "Lunch Start", key: "ls", width: 12, style: { numFmt: "hh:mm" } },
    { header: "Lunch End", key: "le", width: 12, style: { numFmt: "hh:mm" } },
    { header: "Clock Out", key: "out", width: 10, style: { numFmt: "hh:mm" } },
    { header: "Hours", key: "hours", width: 8, style: { numFmt: "0.00" } },
  ];

  const totals = new Map<string, { shifts: number; hours: number }>();
  for (const r of records) {
    const who = r.user.name || r.user.phone || r.user.email || "";
    const worked = workedHours(r);
    const t = totals.get(who) || { shifts: 0, hours: 0 };
    t.shifts += 1;
    if (worked !== null) t.hours += worked;
    totals.set(who, t);
    shifts.addRow({
      date: xl(r.clockIn),
      name: who,
      phone: r.user.phone || "",
      email: r.user.email || "",
      in: xl(r.clockIn),
      ls: r.lunchStart ? xl(r.lunchStart) : "",
      le: r.lunchEnd ? xl(r.lunchEnd) : "",
      out: r.clockOut ? xl(r.clockOut) : "(open)",
      hours: worked === null ? "" : Number(worked.toFixed(2)),
    });
  }
  shifts.getRow(1).font = { bold: true };
  shifts.autoFilter = { from: "A1", to: "I1" };

  const sum = wb.addWorksheet("Totals", { views: [{ state: "frozen", ySplit: 1 }] });
  sum.columns = [
    { header: "Name", key: "name", width: 22 },
    { header: "Shifts", key: "shifts", width: 8 },
    { header: "Hours", key: "hours", width: 10, style: { numFmt: "0.00" } },
  ];
  for (const [name, t] of Array.from(totals.entries()).sort()) {
    sum.addRow({ name, shifts: t.shifts, hours: Number(t.hours.toFixed(2)) });
  }
  sum.getRow(1).font = { bold: true };
  const last = sum.rowCount + 1;
  sum.getCell(`A${last}`).value = "Total";
  sum.getCell(`A${last}`).font = { bold: true };
  sum.getCell(`B${last}`).value = { formula: `SUM(B2:B${last - 1})` };
  sum.getCell(`C${last}`).value = { formula: `SUM(C2:C${last - 1})` };
  sum.getCell(`C${last}`).numFmt = "0.00";
  sum.getCell(`C${last}`).font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
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
  const xlsx = await buildWorkbook(range);
  await transport.sendMail({
    from: s.smtp_user,
    to: s.report_to,
    subject: `Attendance report ${range.label}`,
    text: `Attendance for ${iso(range.from)} to ${iso(new Date(range.to.getTime() - 1))} attached.`,
    attachments: [{ filename: `attendance-${range.label}.xlsx`, content: xlsx }],
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
