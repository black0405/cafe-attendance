"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Clock, ShieldAlert, ScanFace, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { CafeHero, patternBg } from "@/components/CafeArt";

interface Staff {
  id: number;
  name: string;
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

  // face state
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceapiRef = useRef<any>(null);
  const [camState, setCamState] = useState<"loading" | "ready" | "off" | "nocam" | "error">("loading");
  const [recognised, setRecognised] = useState<Staff | null>(null);
  const [ptp, setPtp] = useState("");
  const lastSeen = useRef<{ id: number; at: number } | null>(null);
  // Descriptor from the scan that recognised the person; the server re-checks it on punch.
  const recognisedFace = useRef<number[] | null>(null);
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
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  // Recognised panel auto-dismisses 20s after the last keypress.
  useEffect(() => {
    if (!recognised) return;
    const t = setTimeout(() => setRecognised(null), 20_000);
    return () => clearTimeout(t);
  }, [recognised, ptp]);

  // Fresh PTP box for each person.
  useEffect(() => setPtp(""), [recognised?.id]);

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
      return; // unknown face: stay quiet
    }
    const seen = lastSeen.current;
    if (seen && seen.id === match.userId && Date.now() - seen.at < RECOGNISE_COOLDOWN_MS) return;
    lastSeen.current = { id: match.userId, at: Date.now() };
    const s = staffRef.current.find((x) => x.id === match.userId);
    if (s) {
      recognisedFace.current = Array.from(descriptor);
      setRecognised(s);
    }
  };

  const run = async (id: number, fn: () => Promise<string>, fallback: string) => {
    setBusy(id);
    try {
      setBanner({ kind: "ok", text: await fn() });
      load();
      setRecognised(null);
      lastSeen.current = { id, at: Date.now() };
    } catch (e) {
      // Panel stays open so a mistyped PTP can be retried.
      setBanner({ kind: "err", text: e instanceof Error ? e.message : fallback });
    } finally {
      setBusy(null);
      setPtp("");
    }
  };

  // Face + PTP confirm the punch: the server re-matches the face and checks the PTP.
  const punch = (s: Staff, action: Action = "punch") =>
    run(
      s.id,
      async () => {
        const fresh = await detectDescriptor();
        const descriptor = fresh ? Array.from(fresh) : recognisedFace.current;
        if (!descriptor) throw new Error("Look at the camera to clock in");
        const data = await getJson("/api/kiosk/punch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: s.id, descriptor, ptp, action }),
        });
        return `${s.name} ${WORDS[data.action] || data.action} at ${fmtTime(data.timestamp)}`;
      },
      "Face not recognised"
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

  const revokeFace = (s: Staff) => {
    if (!window.confirm(`Remove ${s.name}'s face from this laptop?`)) return;
    run(
      s.id,
      async () => {
        await getJson(`/api/kiosk/face/enroll?userId=${s.id}`, { method: "DELETE", headers: adminHeaders() });
        return `${s.name} face removed`;
      },
      "Revoke failed"
    );
  };

  // Live status for the recognised person (the list refreshes after every punch).
  const me = recognised && (staff.find((x) => x.id === recognised.id) ?? recognised);

  const camText = {
    loading: "Starting camera…",
    ready: "Look at the camera",
    off: "Camera blocked. Allow camera access in the browser to clock in.",
    nocam: "No camera found. A webcam is needed to clock in.",
    error: "Face recognition unavailable. Restart the app.",
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
                Look at the camera, enter your PTP, then tap Clock in or Clock out
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

        {isAdmin && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
            <span>
              <b>Admin mode.</b> Face enrol and remove buttons are showing. Log out from the dashboard before
              leaving the kiosk.
            </span>
          </div>
        )}

        {banner && (
          <div
            role="status"
            className={`mb-4 flex items-center gap-3 rounded-2xl px-5 py-4 text-lg font-medium shadow-sm border ${
              banner.kind === "ok"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {banner.kind === "ok" ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-red-600" />
            )}
            {banner.text}
          </div>
        )}

        <div className="grid md:grid-cols-[320px_1fr] gap-6">
          {/* Camera panel */}
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-[#2a170d] aspect-[4/3] shadow-md ring-4 ring-white">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              {camState !== "ready" && (
                <div className="absolute inset-0 grid place-items-center text-green-200/40">
                  <ScanFace className={`h-20 w-20 ${camState === "loading" ? "animate-pulse" : ""}`} />
                </div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-green-900/80 text-white text-sm px-3 py-2 flex items-center gap-2">
                <Camera className="h-4 w-4" /> {camText}
              </div>
            </div>

            {me && (
              <div className="rounded-2xl border-2 border-emerald-500 bg-white shadow-md p-4 space-y-3">
                <div className="text-lg font-semibold">Hi {me.name}</div>
                <div className="text-sm text-gray-700">
                  {me.onLunchSince
                    ? `On lunch since ${fmtTime(me.onLunchSince)}`
                    : me.clockedInAt
                    ? `Clocked in at ${fmtTime(me.clockedInAt)}`
                    : "Clocked out"}
                </div>
                <label className="block">
                  <span className="text-sm font-medium">Enter your PTP</span>
                  <input
                    autoFocus
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={ptp}
                    onChange={(e) => setPtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="mt-1 w-full rounded-lg border-2 border-green-200 focus:border-green-600 focus:outline-none px-3 py-2 text-center text-2xl tracking-[0.6em] font-mono"
                    placeholder="••••"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => punch(me)}
                    disabled={busy !== null || ptp.length !== 4}
                    className={`px-4 py-3 rounded-lg text-white font-semibold ${
                      me.clockedInAt ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                    } disabled:opacity-50`}
                  >
                    {me.clockedInAt ? "Clock out" : "Clock in"}
                  </button>
                  {/* Always shown so staff know it exists; disabled with the reason when unusable. */}
                  <button
                    onClick={() => punch(me, "lunch")}
                    disabled={busy !== null || ptp.length !== 4 || !me.clockedInAt || me.lunchTaken}
                    className="px-4 py-3 rounded-lg font-semibold border-2 border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:hover:bg-amber-50"
                  >
                    {me.onLunchSince ? "Back from lunch" : me.lunchTaken ? "Lunch taken" : "Lunch"}
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {!me.clockedInAt
                      ? "Clock in first to start lunch."
                      : me.lunchTaken
                      ? "One lunch per shift."
                      : "Keep facing the camera, type your PTP, then tap."}
                  </span>
                  <button onClick={() => setRecognised(null)} className="underline whitespace-nowrap ml-2">
                    Not me
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Staff grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 self-start items-start">
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
                <div className="flex items-center gap-3 min-w-0">
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
                          !s.faceEnrolled ? "bg-gray-300" : s.onLunchSince ? "bg-amber-500" : s.clockedInAt ? "bg-green-500" : "bg-gray-400"
                        }`}
                      />
                      {!s.faceEnrolled
                        ? "Face not enrolled"
                        : s.onLunchSince
                        ? `On lunch since ${fmtTime(s.onLunchSince)}`
                        : s.clockedInAt
                        ? `In since ${fmtTime(s.clockedInAt)}`
                        : "Out"}
                    </span>
                  </span>
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-gray-100">
                    <button
                      onClick={() => enrollFace(s)}
                      disabled={busy !== null || camState !== "ready"}
                      title={camState !== "ready" ? "Camera not ready" : undefined}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium hover:bg-green-100 disabled:opacity-40"
                    >
                      <ScanFace className="h-3.5 w-3.5" />
                      {s.faceEnrolled ? "Add sample" : "Enrol face"}
                    </button>
                    {s.faceEnrolled && (
                      <button
                        onClick={() => revokeFace(s)}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
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
                <div className="text-gray-500">Add staff from the dashboard, then enrol their face here.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
