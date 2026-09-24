"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from "chart.js";
import { Users, UserCheck, CalendarClock, Timer, Coffee, ScanFace, ArrowRight } from "lucide-react";
import { CafeHero } from "@/components/CafeArt";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface Stats {
  staffCount: number;
  shiftsToday: number;
  hoursThisWeek: number;
  inNow: { id: number; name: string; since: string; onLunch: boolean }[];
  week: { label: string; shifts: number }[];
  recent: { id: number; name: string; clockIn: string; clockOut: string | null }[];
}

const time = (d: string) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const day = (d: string) => {
  const date = new Date(d);
  const today = new Date().toDateString() === date.toDateString();
  return today ? "Today" : date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
};
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

function Avatar({ name, tone = "brown" }: { name: string; tone?: "green" | "amber" | "brown" }) {
  const cls = {
    green: "bg-green-600 text-white",
    amber: "bg-amber-100 text-amber-800",
    brown: "bg-[#f3e8dc] text-[#7a4420]",
  }[tone];
  return (
    <span className={`grid place-items-center h-9 w-9 shrink-0 rounded-full text-sm font-bold ${cls}`} aria-hidden>
      {initials(name)}
    </span>
  );
}

function StatTile({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: typeof Users; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-3xl font-bold tracking-tight mt-1">{value}</p>
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
      <span className="grid place-items-center h-11 w-11 rounded-xl bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white border border-gray-100 shadow-sm">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let headers: Record<string, string>;
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      // Only admins sign in; staff use the kiosk.
      if (!user?.is_admin || !localStorage.getItem("deviceToken")) throw new Error("Not an admin session");
      setName(user.name || user.email);
      headers = { "x-user-email": user.email, "x-user-ptp": user.ptp || "" };
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("deviceToken");
      router.replace("/");
      return;
    }

    const load = () =>
      fetch("/api/admin/dashboard-stats", { headers })
        .then((r) => (r.status === 401 ? router.replace("/") : r.json()))
        .then((d) => d && setStats(d))
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [router]);

  if (!name) return null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-gradient-to-r from-green-700 via-green-800 to-[#3f2415] text-white shadow-lg px-6 py-5 flex items-center justify-between gap-4 overflow-hidden">
        <div>
          <p className="text-green-50/80 text-sm">
            {new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Welcome back, {name}</h1>
          <Link
            href="/kiosk"
            className="inline-flex items-center gap-2 mt-4 rounded-full bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-medium transition-colors"
          >
            <ScanFace className="h-4 w-4" /> Open kiosk
          </Link>
        </div>
        <CafeHero className="hidden sm:block h-32 w-auto -my-3" />
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Staff" value={stats?.staffCount ?? "–"} icon={Users} />
        <StatTile
          label="Clocked in now"
          value={stats?.inNow.length ?? "–"}
          icon={UserCheck}
          hint={stats ? `${stats.inNow.filter((p) => p.onLunch).length} on lunch` : undefined}
        />
        <StatTile label="Shifts today" value={stats?.shiftsToday ?? "–"} icon={CalendarClock} />
        <StatTile label="Hours this week" value={stats ? `${stats.hoursThisWeek}h` : "–"} icon={Timer} hint="Lunch deducted" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Panel title="Who's in">
          {stats && stats.inNow.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">Nobody is clocked in.</p>}
          <ul className="divide-y divide-gray-100">
            {stats?.inNow.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={p.name} tone={p.onLunch ? "amber" : "green"} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    Since {time(p.since)}
                    {day(p.since) !== "Today" && `, ${day(p.since)}`}
                  </p>
                </div>
                {p.onLunch && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 text-xs px-2 py-0.5">
                    <Coffee className="h-3 w-3" /> Lunch
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Shifts, last 7 days">
          <div className="h-56">
            {stats && (
              <Bar
                data={{
                  labels: stats.week.map((d) => d.label),
                  datasets: [
                    {
                      data: stats.week.map((d) => d.shifts),
                      backgroundColor: "#22c55e",
                      hoverBackgroundColor: "#15803d",
                      borderRadius: 8,
                      maxBarThickness: 32,
                    },
                  ],
                }}
                options={{
                  maintainAspectRatio: false,
                  plugins: { tooltip: { callbacks: { label: (c) => `${c.parsed.y} shifts` } } },
                  scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#f1f5f9" }, border: { display: false } },
                  },
                }}
              />
            )}
          </div>
        </Panel>

        <Panel
          title="Recent activity"
          action={
            <Link href="/dashboard/reports" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
              Reports <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {stats && stats.recent.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">No shifts yet.</p>}
          <ul className="divide-y divide-gray-100">
            {stats?.recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-gray-500">
                    {day(r.clockIn)}, {time(r.clockIn)} – {r.clockOut ? time(r.clockOut) : "now"}
                  </p>
                </div>
                <span
                  className={`text-xs rounded-full px-2 py-0.5 ${
                    r.clockOut ? "bg-gray-100 text-gray-600" : "bg-green-50 text-green-700"
                  }`}
                >
                  {r.clockOut ? "Done" : "Active"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
