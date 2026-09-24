"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RefreshCw, Trash2, Search, KeyRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface User {
  id: number;
  name: string;
  email: string | null;
  phone?: string | null;
  is_admin: boolean;
  ptp?: string | null;
}

interface UserTableProps {
  users: User[];
  onUserUpdate: () => void;
  currentUserEmail: string;
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

async function adminFetch(url: string, method: string) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "x-user-email": user.email, "x-user-ptp": user.ptp || "" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function Confirm({
  trigger,
  title,
  body,
  action,
  danger,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  body: React.ReactNode;
  action: string;
  danger?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[420px] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={`rounded-full text-white ${danger ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90"}`}
          >
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const iconBtn =
  "grid place-items-center h-9 w-9 rounded-full text-gray-500 transition-colors disabled:opacity-40";

export function UserTable({ users, onUserUpdate, currentUserEmail }: UserTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const q = search.trim().toLowerCase();
  const shown = users
    .filter((u) => !q || [u.name, u.phone, u.email].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.is_admin) - Number(a.is_admin) || (a.name || "").localeCompare(b.name || ""));

  const resetPtp = async (u: User) => {
    setBusy(u.id);
    try {
      const data = await adminFetch(`/api/admin/users/${u.id}/reset-ptp`, "POST");
      toast.success(`New PTP for ${u.name}: ${data.ptp}`, {
        description: "Give them the new code. The old one stops working now.",
        duration: 15000,
      });
      onUserUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset PTP");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (u: User) => {
    try {
      await adminFetch(`/api/admin/users/${u.id}`, "DELETE");
      toast.success(`${u.name} removed`);
      onUserUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-100">
        <label className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            placeholder="Search by name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full bg-gray-50 border border-gray-200 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </label>
        <span className="text-sm text-gray-500">{shown.length} people</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500 bg-gray-50/60">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Kiosk PTP</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((u) => (
              <tr key={u.id} className="hover:bg-green-50/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid place-items-center h-9 w-9 shrink-0 rounded-full text-sm font-bold ${
                        u.is_admin ? "bg-primary text-primary-foreground" : "bg-[#f3e8dc] text-[#7a4420]"
                      }`}
                      aria-hidden
                    >
                      {initials(u.name || "?")}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.name || "Unnamed"}</p>
                      {u.email && <p className="text-xs text-gray-500 truncate">{u.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.is_admin ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {u.is_admin ? "Admin" : "Staff"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 tabular-nums">{u.phone || "—"}</td>
                <td className="px-4 py-3">
                  {u.is_admin ? (
                    <span className="text-gray-400">—</span>
                  ) : u.ptp ? (
                    <button
                      onClick={() => navigator.clipboard?.writeText(u.ptp!).then(() => toast.success("PTP copied"))}
                      title="Copy"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-2.5 py-1 font-mono font-semibold tracking-widest hover:bg-green-100"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      {u.ptp}
                    </button>
                  ) : (
                    <span className="text-gray-400">Not set</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => router.push(`/dashboard/users/edit/${u.id}`)}
                      className={`${iconBtn} hover:bg-gray-100 hover:text-gray-900`}
                      title="Edit"
                      aria-label={`Edit ${u.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!u.is_admin && (
                      <Confirm
                        title={`New PTP for ${u.name}?`}
                        body="Their current code stops working immediately. You'll see the new one after this."
                        action="Reset PTP"
                        onConfirm={() => resetPtp(u)}
                        trigger={
                          <button
                            disabled={busy === u.id}
                            className={`${iconBtn} hover:bg-amber-50 hover:text-amber-700`}
                            title="Reset PTP"
                            aria-label={`Reset PTP for ${u.name}`}
                          >
                            <RefreshCw className={`h-4 w-4 ${busy === u.id ? "animate-spin" : ""}`} />
                          </button>
                        }
                      />
                    )}
                    {u.email !== currentUserEmail && (
                      <Confirm
                        danger
                        title={`Delete ${u.name}?`}
                        body="This cannot be undone. Staff with attendance records can't be deleted, so their hours stay in reports."
                        action="Delete"
                        onConfirm={() => remove(u)}
                        trigger={
                          <button
                            className={`${iconBtn} hover:bg-red-50 hover:text-red-600`}
                            title="Delete"
                            aria-label={`Delete ${u.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        }
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-gray-500">
                  {users.length === 0 ? "No staff yet. Add your first person." : "Nobody matches that search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
