"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserTable } from "@/components/UserTable";
import { toast } from "sonner";

interface User {
  id: number;
  name: string;
  email: string | null;
  phone?: string | null;
  is_admin: boolean;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const user = JSON.parse(userData);
      if (!user.is_admin) {
        router.push("/dashboard");
        return;
      }
      setCurrentUser({
        id: user.id || 0,
        name: user.name || "",
        email: user.email,
        phone: user.phone ?? null,
        is_admin: true,
      });
      fetchUsers();
    } else {
      router.push("/");
    }
  }, [router]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const userData = localStorage.getItem("user");
      if (!userData) throw new Error("No user data found");

      const user = JSON.parse(userData);
      const response = await fetch("/api/admin/users", {
        headers: {
          "Content-Type": "application/json",
          "x-user-email": user.email,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError("Failed to load users");
      console.error("Error fetching users:", err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserEmail = () => {
    const userData = localStorage.getItem("user");
    if (!userData) return "";
    return JSON.parse(userData).email;
  };

  if (!currentUser?.is_admin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Staff</h1>
          <p className="text-gray-500 mt-1">
            Add staff, share their PTP code, and enrol their face on the kiosk.
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/new-user")} className="rounded-full shadow-sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Add staff
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-xl">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <UserTable users={users} onUserUpdate={fetchUsers} currentUserEmail={getCurrentUserEmail()} />
      )}
    </div>
  );
}
