"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  startAuthentication,
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { Camera, Clock } from "lucide-react";
import { CafeHero, patternBg } from "@/components/CafeArt";

interface Staff {
  id: number;
  name: string;
  enrolled: boolean; // fingerprint
  faceEnrolled: boolean;
  clockedInAt: string | null;
  onLunchSince: string | null;
  lunchTaken: boolean;
}

type Banner = { kind: "ok" | "err"; text: string } | null;
type Action = "punch" | "lunch";

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

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const WORDS: Record<string, string> = {
  in: "clocked in",
  out: "clocked out",
  "lunch-start": "started lunch",
  "lunch-end": "back from lunch",
};

// Face must fill at least this share of the frame width, so people walking
// past in the background are ignored.
const MIN_FACE_RATIO = 0.22;
const RECOGNISE_COOLDOWN_MS = 12_000;

export default function KioskPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [supported, setSupported] = useState(true);

  // face state
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceapiRef = useRef<any>(null);
  const [camState, setCamState] = useState<"loading" | "ready" | "off" | "nocam" | "error">("loading");
  const [recognised, setRecognised] = useState<Staff | null>(null);
  const lastSeen = useRef<{ id: number; at: number } | null>(null);
  const staffRef = useRef<Staff[]>([]);
  const busyRef = useRef<number | null>(null);
  const recognisedRef = useRef<Staff | null>(null);
  staffRef.current = staff;
  busyRef.current = busy;
  recognisedRef.current = recognised;

  const load = () =>
    getJson("/api/kiosk/staff")
      .then(setStaff)
      .catch(() => setBanner({ kind: "err", text: "Could not load staff" }));

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getJson("/api/setup")
      .then((d) => d.needsSetup && location.replace("/setup"))
      .catch(() => {});
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

  // Recognised panel auto-dismisses.
  useEffect(() => {
    if (!recognised) return;
    const t = setTimeout(() => setRecognised(null), 10_000);
    return () => clearTimeout(t);
  }, [recognised]);

  // Camera + models + detection loop.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const loop = () => {
      if (stopped) return;
      timer = setTimeout(async () => {
        try {
          if (!busyRef.current && !recognisedRef.current) await scan();
        } finally {
          loop();
        }
      }, 700);
    };

    (async () => {
      try {
        // Browser bundle (tfjs included). The package default is the Node build.
        const faceapi = await import("@vladmandic/face-api/dist/face-api.esm.js");
        faceapiRef.current = faceapi;
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCamState("ready");
        loop();
      } catch (e) {
        console.error("camera/model init failed", e);
        setCamState(
          e instanceof DOMException
            ? e.name === "NotFoundError"
              ? "nocam"
              : "off"
            : "error"
        );
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectDescriptor = async (): Promise<Float32Array | null> => {
    const faceapi = faceapiRef.current;
    const video = videoRef.current;
    if (!faceapi || !video || video.readyState < 2) return null;
    const det = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();
    if (!det) return null;
    if (det.detection.box.width / video.videoWidth < MIN_FACE_RATIO) return null;
    return det.descriptor as Float32Array;
  };

  const scan = async () => {
    const descriptor = await detectDescriptor();
    if (!descriptor) return;
    let match: { userId: number; name: string };
    try {
      match = await getJson("/api/kiosk/face/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor: Array.from(descriptor) }),
      });
    } catch {
      return; // unknown face: stay quiet, they can tap their name
    }
    const seen = lastSeen.current;
    if (seen && seen.id === match.userId && Date.now() - seen.at < RECOGNISE_COOLDOWN_MS) return;
    lastSeen.current = { id: match.userId, at: Date.now() };
    const s = staffRef.current.find((x) => x.id === match.userId);
    if (s) setRecognised(s);
  };

  const run = async (id: number, fn: () => Promise<string>, fallback: string) => {
    setBusy(id);
    try {
      setBanner({ kind: "ok", text: await fn() });
      load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : fallback });
    } finally {
      setBusy(null);
      setRecognised(null);
      lastSeen.current = { id, at: Date.now() };
    }
  };

  // Fingerprint step. Face may have picked the person, but the finger confirms them.
  const punch = (s: Staff, action: Action = "punch") =>
    run(
      s.id,
      async () => {
        const { options, token } = await getJson(`/api/kiosk/punch?userId=${s.id}`);
        const response = await startAuthentication({ optionsJSON: options });
        const data = await getJson("/api/kiosk/punch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, response, action }),
        });
        return `${s.name} ${WORDS[data.action] || data.action} at ${fmtTime(data.timestamp)}`;
      },
      "Fingerprint not recognised"
    );

  const enroll = (s: Staff) =>
    run(
      s.id,
      async () => {
        const headers = adminHeaders();
        const { options, token } = await getJson(`/api/kiosk/enroll?userId=${s.id}`, { headers });
        const response = await startRegistration({ optionsJSON: options });
        await getJson("/api/kiosk/enroll", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ token, response, label: navigator.platform }),
        });
        return `${s.name} fingerprint enrolled on this laptop`;
      },
      "Enrollment failed"
    );

  const enrollFace = (s: Staff) =>
    run(
      s.id,
      async () => {
        const descriptor = await detectDescriptor();
        if (!descriptor) throw new Error("No face in view. Look at the camera, close up.");
        const data = await getJson("/api/kiosk/face/enroll", {
          method: "POST",
          headers: { ...adminHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ userId: s.id, descriptor: Array.from(descriptor) }),
        });
        return `${s.name} face sample ${data.samples} saved (take 2 or 3 from slightly different angles)`;
      },
      "Face enrollment failed"
    );

  const revoke = (s: Staff, what: "finger" | "face") => {
    if (!window.confirm(`Remove ${s.name}'s ${what === "face" ? "face" : "fingerprint"} from this laptop?`)) return;
    run(
      s.id,
      async () => {
        const url = what === "face" ? `/api/kiosk/face/enroll?userId=${s.id}` : `/api/kiosk/enroll?userId=${s.id}`;
        await getJson(url, { method: "DELETE", headers: adminHeaders() });
        return `${s.name} ${what === "face" ? "face" : "fingerprint"} removed`;
      },
      "Revoke failed"
    );
  };

  const camText = {
    loading: "Starting camera…",
    ready: "Look at the camera",
    off: "Camera blocked. Allow camera access in the browser, or tap your name.",
    nocam: "No camera found on this laptop. Tap your name.",
    error: "Face recognition unavailable. Tap your name.",
  }[camState];

  return (
    <div className="min-h-screen bg-background" style={patternBg}>
      <div className="max-w-6xl mx-auto p-6">
        <header className="mb-6 rounded-2xl bg-gradient-to-r from-green-700 via-green-800 to-[#3f2415] text-white shadow-lg px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-14 w-14 rounded-xl shadow ring-2 ring-white/30" />
            <div>
              <h1 className="text-3xl font-bold">Clock In / Out</h1>
              <p className="text-sm text-green-50/80">
                Look at the camera or tap your name, then touch the fingerprint reader
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="text-3xl font-semibold tabular-nums flex items-center gap-2">
                <Clock className="h-6 w-6 text-green-300" />
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="text-xs text-green-50/80">
                {now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
              </div>
            </div>
            <Link
              href={isAdmin ? "/dashboard" : "/"}
              className="rounded-full bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-medium transition-colors"
            >
              {isAdmin ? "Dashboard" : "Admin login"}
            </Link>
          </div>
        </header>

        {!supported && (
          <div className="mb-4 p-3 rounded bg-red-100 text-red-800">
            This browser does not support fingerprint sign-in. Use Chrome or Edge with Windows Hello set up.
          </div>
        )}

        {isAdmin && (
          <div className="mb-4 p-3 rounded bg-yellow-100 text-yellow-900 text-sm">
            Admin mode: Enroll / Revoke buttons are visible. Log out from the dashboard before leaving the kiosk unattended.
          </div>
        )}

        {banner && (
          <div
            role="status"
            className={`mb-4 p-4 rounded text-lg font-medium ${
              banner.kind === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {banner.text}
          </div>
        )}

        <div className="grid md:grid-cols-[320px_1fr] gap-6">
          {/* Camera panel */}
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-[#2a170d] aspect-[4/3] shadow-md ring-4 ring-white">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute bottom-0 inset-x-0 bg-green-900/80 text-white text-sm px-3 py-2 flex items-center gap-2">
                <Camera className="h-4 w-4" /> {camText}
              </div>
            </div>

            {recognised && (
              <div className="rounded-2xl border-2 border-emerald-500 bg-white shadow-md p-4 space-y-3">
                <div className="text-lg font-semibold">Hi {recognised.name}</div>
                <div className="text-sm text-gray-700">
                  {recognised.onLunchSince
                    ? `On lunch since ${fmtTime(recognised.onLunchSince)}`
                    : recognised.clockedInAt
                    ? `Clocked in at ${fmtTime(recognised.clockedInAt)}`
                    : "Clocked out"}
                </div>
                {!recognised.enrolled ? (
                  <div className="text-sm text-red-700">No fingerprint enrolled. Ask the admin.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => punch(recognised)}
                      disabled={busy !== null || !supported}
                      className={`px-4 py-2 rounded-md text-white font-medium ${
                        recognised.clockedInAt ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                      } disabled:opacity-50`}
                    >
                      {recognised.clockedInAt ? "Clock out" : "Clock in"}
                    </button>
                    {recognised.clockedInAt && !recognised.lunchTaken && (
                      <button
                        onClick={() => punch(recognised, "lunch")}
                        disabled={busy !== null || !supported}
                        className="px-4 py-2 rounded-md border border-amber-400 text-amber-800 bg-white hover:bg-amber-100 disabled:opacity-50"
                      >
                        {recognised.onLunchSince ? "Back from lunch" : "Lunch"}
                      </button>
                    )}
                    <button onClick={() => setRecognised(null)} className="px-3 py-2 text-sm text-gray-600 underline">
                      Not me
                    </button>
                  </div>
                )}
                <div className="text-xs text-gray-500">Then touch the fingerprint reader.</div>
              </div>
            )}
          </div>

          {/* Staff grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 self-start">
            {staff.map((s) => (
              <div
                key={s.id}
                className={`rounded-2xl border bg-white p-4 flex flex-col gap-2 shadow-sm transition-shadow hover:shadow-md ${
                  recognised?.id === s.id
                    ? "border-emerald-500 ring-2 ring-emerald-300"
                    : s.onLunchSince
                    ? "border-amber-400 border-l-4"
                    : s.clockedInAt
                    ? "border-green-500 border-l-4"
                    : ""
                }`}
              >
                <button
                  onClick={() => punch(s)}
                  disabled={busy !== null || !s.enrolled || !supported}
                  className="text-left disabled:opacity-40 flex items-center gap-3 min-w-0"
                >
                  <span
                    aria-hidden
                    className={`grid place-items-center h-12 w-12 shrink-0 rounded-full text-lg font-bold ${
                      s.onLunchSince
                        ? "bg-amber-100 text-amber-800"
                        : s.clockedInAt
                        ? "bg-green-600 text-white"
                        : "bg-[#f3e8dc] text-[#7a4420]"
                    }`}
                  >
                    {initials(s.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold truncate">{s.name}</span>
                    <span className="text-sm text-gray-600 flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          !s.enrolled ? "bg-gray-300" : s.onLunchSince ? "bg-amber-500" : s.clockedInAt ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      {!s.enrolled
                        ? "No fingerprint"
                        : s.onLunchSince
                        ? `On lunch since ${fmtTime(s.onLunchSince)}`
                        : s.clockedInAt
                        ? `In since ${fmtTime(s.clockedInAt)}`
                        : "Out"}
                    </span>
                  </span>
                </button>
                {busy === s.id && <div className="text-sm text-emerald-600">Touch the reader…</div>}

                {s.enrolled && s.clockedInAt && !s.lunchTaken && (
                  <button
                    onClick={() => punch(s, "lunch")}
                    disabled={busy !== null || !supported}
                    className="text-sm px-3 py-1 rounded border border-amber-400 text-amber-800 bg-white hover:bg-amber-100 disabled:opacity-40"
                  >
                    {s.onLunchSince ? "Back from lunch" : "Lunch"}
                  </button>
                )}

                {isAdmin && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-auto pt-2 border-t">
                    <button onClick={() => enroll(s)} disabled={busy !== null || !supported} className="text-emerald-600 hover:underline disabled:opacity-40">
                      {s.enrolled ? "Add finger" : "Enroll finger"}
                    </button>
                    {s.enrolled && (
                      <button onClick={() => revoke(s, "finger")} disabled={busy !== null} className="text-red-600 hover:underline disabled:opacity-40">
                        Remove finger
                      </button>
                    )}
                    <button onClick={() => enrollFace(s)} disabled={busy !== null || camState !== "ready"} className="text-emerald-600 hover:underline disabled:opacity-40">
                      {s.faceEnrolled ? "Add face sample" : "Enroll face"}
                    </button>
                    {s.faceEnrolled && (
                      <button onClick={() => revoke(s, "face")} disabled={busy !== null} className="text-red-600 hover:underline disabled:opacity-40">
                        Remove face
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {staff.length === 0 && (
              <div className="col-span-full rounded-2xl bg-white/70 border border-dashed border-green-300 p-8 flex flex-col items-center text-center gap-3">
                <CafeHero className="w-64 max-w-full" />
                <div className="text-lg font-semibold">No staff yet</div>
                <div className="text-gray-500">Add staff from the dashboard, then enrol their fingerprint and face here.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
