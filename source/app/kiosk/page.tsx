"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";

interface Staff {
  id: number;
  name: string;
  enrolled: boolean;
  clockedInAt: string | null;
}

type Banner = { kind: "ok" | "err"; text: string } | null;

// Admin buttons appear only while an admin is logged in on this browser.
// Log out after enrolling so staff at the counter cannot enrol or revoke.
function adminHeaders(): Record<string, string> {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return u?.is_admin
      ? { "x-user-email": u.email, "x-user-ptp": u.ptp || "" }
      : {};
  } catch {
    return {};
  }
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function KioskPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [supported, setSupported] = useState(true);

  const load = () =>
    getJson("/api/kiosk/staff")
      .then(setStaff)
      .catch(() => setBanner({ kind: "err", text: "Could not load staff" }));

  useEffect(() => {
    setIsAdmin(Object.keys(adminHeaders()).length > 0);
    setSupported(browserSupportsWebAuthn());
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  const run = async (id: number, fn: () => Promise<string>, fallback: string) => {
    setBusy(id);
    try {
      setBanner({ kind: "ok", text: await fn() });
      load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : fallback });
    } finally {
      setBusy(null);
    }
  };

  const punch = (s: Staff) =>
    run(
      s.id,
      async () => {
        const { options, token } = await getJson(`/api/kiosk/punch?userId=${s.id}`);
        const response = await startAuthentication({ optionsJSON: options });
        const data = await getJson("/api/kiosk/punch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, response }),
        });
        return `${s.name} clocked ${data.action} at ${fmtTime(data.timestamp)}`;
      },
      "Fingerprint not recognised"
    );

  const enroll = (s: Staff) =>
    run(
      s.id,
      async () => {
        const headers = adminHeaders();
        const { options, token } = await getJson(
          `/api/kiosk/enroll?userId=${s.id}`,
          { headers }
        );
        const response = await startRegistration({ optionsJSON: options });
        await getJson("/api/kiosk/enroll", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ token, response, label: navigator.platform }),
        });
        return `${s.name} enrolled on this laptop`;
      },
      "Enrollment failed"
    );

  const revoke = (s: Staff) => {
    if (!window.confirm(`Remove ${s.name}'s fingerprint from this laptop?`)) return;
    run(
      s.id,
      async () => {
        await getJson(`/api/kiosk/enroll?userId=${s.id}`, {
          method: "DELETE",
          headers: adminHeaders(),
        });
        return `${s.name} fingerprint removed`;
      },
      "Revoke failed"
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Fingerprint className="h-8 w-8" /> Clock In / Out
          </h1>
          <div className="text-sm text-gray-500 flex items-center gap-4">
            <span>Tap your name, then touch the fingerprint reader</span>
            <Link href={isAdmin ? "/dashboard" : "/"} className="underline">
              {isAdmin ? "Dashboard" : "Admin login"}
            </Link>
          </div>
        </div>

        {!supported && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-800">
            This browser does not support fingerprint sign-in. Use Chrome or Edge
            with Windows Hello set up.
          </div>
        )}

        {isAdmin && (
          <div className="mb-4 p-3 rounded bg-yellow-100 text-yellow-900 text-sm">
            Admin mode: Enroll / Revoke buttons are visible. Log out from the
            dashboard before leaving the kiosk unattended.
          </div>
        )}

        {banner && (
          <div
            role="status"
            className={`mb-4 p-4 rounded text-lg font-medium ${
              banner.kind === "ok"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {banner.text}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {staff.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border p-4 flex flex-col gap-2 ${
                s.clockedInAt ? "border-green-500 bg-green-50" : "bg-white"
              }`}
            >
              <button
                onClick={() => punch(s)}
                disabled={busy !== null || !s.enrolled || !supported}
                className="text-left disabled:opacity-40"
              >
                <div className="text-lg font-semibold truncate">{s.name}</div>
                <div className="text-sm text-gray-600">
                  {!s.enrolled
                    ? "Not enrolled"
                    : s.clockedInAt
                    ? `In since ${fmtTime(s.clockedInAt)}`
                    : "Out"}
                </div>
                {busy === s.id && (
                  <div className="text-sm text-blue-600 mt-1">
                    Touch the reader…
                  </div>
                )}
              </button>

              {isAdmin && (
                <div className="flex gap-2 text-xs mt-auto pt-2 border-t">
                  <button
                    onClick={() => enroll(s)}
                    disabled={busy !== null || !supported}
                    className="text-blue-600 hover:underline disabled:opacity-40"
                  >
                    {s.enrolled ? "Add device" : "Enroll"}
                  </button>
                  {s.enrolled && (
                    <button
                      onClick={() => revoke(s)}
                      disabled={busy !== null}
                      className="text-red-600 hover:underline disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {staff.length === 0 && (
            <div className="col-span-full text-gray-500">
              No staff yet. Add users from the dashboard.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
