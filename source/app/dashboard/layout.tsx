"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Users, Clock, Fingerprint, FileText } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { toast } from "sonner";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

interface User {
  email: string;
  is_admin: boolean;
  name?: string;
  ptp?: string;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const tab = (href: string) =>
    `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
      pathname === href
        ? "border-primary text-primary"
        : "border-transparent text-gray-500 hover:border-green-300 hover:text-gray-800"
    }`;

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser: User = JSON.parse(userData);
      setUser(parsedUser);
    } else {
      router.push("/");
    }
  }, [router]);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-green-50/60 to-background">
        <nav className="bg-white shadow-sm border-t-4 border-t-primary border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <Link
                    href="/dashboard"
                    className="text-xl font-bold text-gray-800 flex items-center gap-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="" className="h-8 w-8 rounded-md" />
                    Cafe Attendance
                  </Link>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link
                    href="/dashboard"
                    className={tab("/dashboard")}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                  <Link
                    href="/kiosk"
                    className={tab("/kiosk")}
                  >
                    <Fingerprint className="mr-2 h-4 w-4" />
                    Kiosk
                  </Link>
                  {user?.is_admin && (
                    <Link
                      href="/dashboard/users"
                      className={tab("/dashboard/users")}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Users
                    </Link>
                  )}
                  {user?.is_admin && (
                    <Link
                      href="/dashboard/reports"
                      className={tab("/dashboard/reports")}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Reports
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <LogoutButton />
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </div>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Cafe Attendance.
        </div>
      </footer>
    </>
  );
}
