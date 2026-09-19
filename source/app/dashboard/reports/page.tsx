"use client";

import { useEffect, useState } from "react";
import { Download, Mail } from "lucide-react";
import { toast } from "sonner";

function adminHeaders(): Record<string, string> {
  const u = JSON.parse(localStorage.getItem("user") || "{}");
  return { "x-user-email": u.email || "", "x-user-ptp": u.ptp || "" };
}

const DOWNLOADS = [
  { label: "This week", range: "week", offset: 0 },
  { label: "Last week", range: "week", offset: -1 },
  { label: "This month", range: "month", offset: 0 },
  { label: "Last month", range: "month", offset: -1 },
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
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        placeholder={hint}
      />
    </label>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <section>
        <h1 className="text-2xl font-bold mb-3 flex items-center gap-2">
          <Download className="h-6 w-6" /> Download report
        </h1>
        <p className="text-sm text-gray-600 mb-3">
          Excel file. Sheet 1: one row per shift. Sheet 2: shifts and total hours per person.
        </p>
        <div className="flex flex-wrap gap-2">
          {DOWNLOADS.map((d) => (
            <button
              key={d.label}
              onClick={() => download(d.range, d.offset)}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-3 flex items-center gap-2">
          <Mail className="h-6 w-6" /> Weekly email
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          Every Monday after 8:00 the previous week&apos;s Excel file is emailed, as long
          as the app is running on the laptop. For Gmail use smtp.gmail.com, port
          587, and an App Password (not your normal password).
        </p>
        {s && (
          <form onSubmit={save} className="space-y-3 bg-white border rounded-lg p-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={s.report_weekly === "1"}
                onChange={(e) => setS({ ...s, report_weekly: e.target.checked ? "1" : "0" })}
              />
              Send weekly report automatically
            </label>
            {field("report_to", "Send to (admin email)", "email", "you@example.com")}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">{field("smtp_host", "SMTP host", "text", "smtp.gmail.com")}</div>
              {field("smtp_port", "Port", "number", "587")}
            </div>
            {field("smtp_user", "SMTP username (sender email)", "email")}
            {field(
              "smtp_pass",
              s.smtp_pass_set ? "SMTP password (leave blank to keep)" : "SMTP password",
              "password"
            )}
            {s.report_last_weekly && (
              <p className="text-xs text-gray-500">Last sent: {s.report_last_weekly}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={sendTest}
                disabled={busy}
                className="px-4 py-2 rounded-md border text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Send last week now (test)
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
