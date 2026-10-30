import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export default function ChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4">
          <p className="text-sm text-slate-500">Loading…</p>
        </main>
      }
    >
      <ChangePasswordForm />
    </Suspense>
  );
}
