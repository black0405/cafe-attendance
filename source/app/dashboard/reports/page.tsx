"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Mail, CalendarDays, CalendarRange, Download } from "lucide-react";
import { toast } from "sonner";

function adminHeaders(): Record<string, string> {
  const u = JSON.parse(localStorage.getItem("user") || "{}");
  return { "x-user-email": u.email || "", "x-user-ptp": u.ptp || "" };
}

const DOWNLOADS = [
  { label: "This week", range: "week", offset: 0, icon: CalendarDays },
  { label: "Last week", range: "week", offset: -1, icon: CalendarDays },
  { label: "This month", range: "month", offset: 0, icon: CalendarRange },
  { label: "Last month", range: "month", offset: -1, icon: CalendarRange },
];

interface Settings {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_pass_set: boolean;
  report_to: string;
  report_weekly: string;
  report_last_weekly: string;
}

export default function ReportsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { headers: adminHeaders() })
      .then((r) => r.json())
      .then(setS)
      .catch(() => toast.error("Could not load settings"));
  }, []);

  const download = async (range: string, offset: number) => {
    const res = await fetch(`/api/admin/report?range=${range}&offset=${offset}`, {
      headers: adminHeaders(),
    });
    if (!res.ok) return toast.error("Download failed");
    const name =
      res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
      "attendance.xlsx";
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { ...adminHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setBusy(false);
    res.ok ? toast.success("Settings saved") : toast.error("Save failed");
    if (res.ok && s.smtp_pass) setS({ ...s, smtp_pass: "", smtp_pass_set: true });
  };

  const sendTest = async () => {
    setBusy(true);
    const res = await fetch("/api/admin/report", {
      method: "POST",
      headers: { ...adminHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ range: "week", offset: -1 }),
    });
    const data = await res.json();
    setBusy(false);
    res.ok
      ? toast.success(`Sent last week's report to ${s?.report_to}`)
      : toast.error(data.error || "Send failed");
  };

  const field = (key: keyof Settings, label: string, type = "text", hint?: string) => (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={String(s?.[key] ?? "")}
        onChange={(e) => s && setS({ ...s, [key]: e.target.value })}
        className="mt-1 block w-full rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white"
        placeholder={hint}
      />
    </label>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-gray-500 mt-1">
          Excel workbooks: one row per shift, plus total hours per person (lunch deducted).
        </p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {DOWNLOADS.map(({ label, range, offset, icon: Icon }) => (
          <button
            key={label}
            onClick={() => download(range, offset)}
            className="group rounded-2xl bg-white border border-gray-100 shadow-sm p-5 text-left transition hover:shadow-md hover:border-green-200"
          >
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-accent text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <p className="font-semibold mt-4">{label}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1 group-hover:text-primary">
              <FileSpreadsheet className="h-4 w-4" /> Download .xlsx
              <Download className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition" />
            </p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl bg-white border border-gray-100 shadow-sm">
        <header className="flex items-start gap-4 p-6 border-b border-gray-100">
          <span className="grid place-items-center h-11 w-11 shrink-0 rounded-xl bg-accent text-primary">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-lg">Weekly email</h2>
            <p className="text-sm text-gray-500 mt-1">
              Every Monday after 8:00, last week&apos;s workbook is emailed while the app is running.
              For Gmail use smtp.gmail.com, port 587 and an App Password.
            </p>
          </div>
        </header>
        {s && (
          <form onSubmit={save} className="p-6 space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3">
              <span className="text-sm font-medium">Send weekly report automatically</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-green-700"
                checked={s.report_weekly === "1"}
                onChange={(e) => setS({ ...s, report_weekly: e.target.checked ? "1" : "0" })}
              />
            </label>
            {field("report_to", "Send to", "email", "you@example.com")}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">{field("smtp_host", "SMTP host", "text", "smtp.gmail.com")}</div>
              {field("smtp_port", "Port", "number", "587")}
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {field("smtp_user", "Sender email", "email")}
              {field(
                "smtp_pass",
                s.smtp_pass_set ? "Password (blank keeps current)" : "Password",
                "password"
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
              >
                Save settings
              </button>
              <button
                type="button"
                onClick={sendTest}
                disabled={busy}
                className="rounded-full border border-gray-200 px-5 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Send last week now
              </button>
              {s.report_last_weekly && (
                <span className="text-xs text-gray-500 ml-auto">Last sent: {s.report_last_weekly}</span>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
