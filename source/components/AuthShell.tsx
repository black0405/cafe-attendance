import { ScanFace, Coffee, FileSpreadsheet } from "lucide-react";
import { CafeHero, patternBg } from "@/components/CafeArt";

const FEATURES = [
  { icon: ScanFace, text: "Clock in and out by face at the kiosk" },
  { icon: Coffee, text: "Lunch breaks tracked and deducted" },
  { icon: FileSpreadsheet, text: "Shift reports as Excel workbooks" },
];

// Split screen for login and first-run setup: illustrated brand panel + form.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <aside className="hidden lg:flex flex-col justify-between p-10 text-white bg-gradient-to-br from-green-700 via-green-800 to-[#3f2415] relative overflow-hidden">
        <div className="flex items-center gap-3 text-lg font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-lg shadow" />
          Cafe Attendance
        </div>
        <CafeHero className="w-full max-w-md mx-auto drop-shadow-xl" />
        <div className="space-y-4">
          <h2 className="text-3xl font-bold leading-tight">Every shift, clocked in a tap.</h2>
          <ul className="space-y-2 text-green-50/90">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid place-items-center h-8 w-8 rounded-full bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex items-center justify-center p-4 sm:p-8" style={patternBg}>
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center mb-6 gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-14 w-14 rounded-xl shadow" />
            <span className="text-xl font-semibold">Cafe Attendance</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
