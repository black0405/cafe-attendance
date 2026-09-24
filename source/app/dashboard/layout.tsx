"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, ScanFace, Users, FileText } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

const TABS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/users", label: "Staff", icon: Users },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/kiosk", label: "Kiosk", icon: ScanFace },
];

// Admin shell: sticky frosted nav with pill tabs, one content width for every page.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (!user?.is_admin) throw new Error("not admin");
      setName(user.name || user.email);
    } catch {
      router.push("/");
    }
  }, [router]);

  const active = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href) || (href === "/dashboard/users" && pathname === "/dashboard/new-user");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50/70 via-background to-background">
      <nav className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="hidden sm:inline">Cafe Attendance</span>
          </Link>
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  active(href) ? "bg-primary text-primary-foreground shadow-sm" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {name && <span className="hidden md:inline text-sm text-gray-500">{name}</span>}
            <LogoutButton />
          </div>
        </div>
      </nav>
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      <footer className="py-6 text-center text-xs text-gray-400">Cafe Attendance</footer>
    </div>
  );
}
