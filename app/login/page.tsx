"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Login failed.");
        return;
      }

      const { data: employee } = await supabase
        .from("employees")
        .select("role, status, must_change_password")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!employee || employee.status !== "ACTIVE") {
        await supabase.auth.signOut();
        setError("Your account is inactive. Contact your administrator.");
        return;
      }

      if (employee.must_change_password) {
        router.push("/change-password?forced=1");
        router.refresh();
        return;
      }

      router.push(employee.role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
      router.refresh();
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#ecfdf5,_#f8fafc_55%)] px-4">
      <Card className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/brand/logo.png"
            alt="OfficePulse"
            width={96}
            height={96}
            priority
            className="h-24 w-24 rounded-full object-cover shadow-sm ring-2 ring-teal-100"
          />
          <p className="mt-3 text-sm font-bold tracking-tight text-teal-800">
            OfficePulse
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Check in and out from the office network.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
