"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

const post = async (body: object) => {
  const res = await fetch("/api/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
};

// Reset the admin password with a code the server writes to a file on this laptop.
export default function ForgotPage() {
  const router = useRouter();
  const [file, setFile] = useState("");
  const [form, setForm] = useState({ email: "", code: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const requestCode = () =>
    run(async () => setFile((await post({ action: "request" })).file));

  const reset = (e: FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Passwords do not match");
    run(async () => {
      await post({ action: "reset", ...form });
      toast.success("Password changed. Sign in with the new one.");
      router.replace("/");
    });
  };

  return (
    <AuthShell>
      <Card className="shadow-xl border-green-100">
        <CardHeader className="space-y-1">
          <div className="mx-auto mb-2 grid place-items-center h-14 w-14 rounded-full bg-accent text-primary">
            <KeyRound className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold text-center">Forgot password</CardTitle>
          <CardDescription className="text-center">
            {file
              ? "Open the file below on this laptop and type the code it contains."
              : "We'll put a reset code in a file on this laptop."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <div className="space-y-4">
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <Button className="w-full" onClick={requestCode} disabled={loading}>
                {loading ? "Creating code..." : "Get reset code"}
              </Button>
            </div>
          ) : (
            <form onSubmit={reset} className="space-y-4">
              <p className="rounded-md bg-muted p-3 text-xs break-all font-mono">{file}</p>
              <div className="space-y-2">
                <Label htmlFor="email">Admin email or phone</Label>
                <Input id="email" required value={form.email} onChange={set("email")} autoComplete="username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Reset code</Label>
                <Input id="code" required inputMode="numeric" maxLength={6} value={form.code} onChange={set("code")} autoComplete="one-time-code" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" required minLength={8} value={form.password} onChange={set("password")} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input id="confirm" type="password" required minLength={8} value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
              </div>
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Set new password"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={requestCode} disabled={loading}>
                Send a new code
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm">
            <Link href="/" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
