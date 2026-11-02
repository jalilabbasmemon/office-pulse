"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { generateTempPassword } from "@/lib/employees/generate";
import type { Employee, Shift } from "@/types";

type Props = {
  shifts: Shift[];
  employee?: Employee;
};

type CreatedCredentials = {
  employee_id: string;
  email: string;
  temporary_password: string;
};

type DialogKind = "deactivate" | "activate" | "delete" | "reset" | null;

export function EmployeeForm({ shifts, employee }: Props) {
  const router = useRouter();
  const isEdit = Boolean(employee);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(true);
  const [dialog, setDialog] = useState<DialogKind>(null);

  const [form, setForm] = useState({
    employee_id: employee?.employee_id ?? "",
    name: employee?.name ?? "",
    mobile: employee?.mobile ?? "",
    designation: employee?.designation ?? "",
    shift_id: employee?.shift_id ?? "",
    role: (employee?.role ?? "EMPLOYEE") as "ADMIN" | "EMPLOYEE",
    email: "",
    password: isEdit ? "" : generateTempPassword(),
  });

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/admin/employees/next-id?role=${form.role}`
      );
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (!cancelled) {
        setForm((prev) => ({ ...prev, employee_id: data.employee_id }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.role, isEdit]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function regeneratePassword() {
    update("password", generateTempPassword());
    setShowPassword(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const url = isEdit
        ? `/api/admin/employees/${employee!.id}`
        : "/api/admin/employees";
      const body = isEdit
        ? {
            name: form.name,
            mobile: form.mobile,
            designation: form.designation,
            shift_id: form.shift_id || null,
            role: form.role,
          }
        : {
            ...form,
            shift_id: form.shift_id || null,
          };

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Save failed");
        return;
      }

      if (!isEdit && data.credentials) {
        setCreated(data.credentials);
        return;
      }

      router.push("/admin/employees");
      router.refresh();
    });
  }

  function runConfirmedAction() {
    if (!employee || !dialog) return;
    const action = dialog;
    setError(null);

    startTransition(async () => {
      if (action === "deactivate") {
        const res = await fetch(
          `/api/admin/employees/${employee.id}/deactivate`,
          { method: "POST" }
        );
        const data = await res.json().catch(() => ({}));
        setDialog(null);
        if (!res.ok) {
          setError(data.message ?? "Deactivate failed");
          return;
        }
        router.push("/admin/employees");
        router.refresh();
        return;
      }

      if (action === "activate") {
        const res = await fetch(
          `/api/admin/employees/${employee.id}/activate`,
          { method: "POST" }
        );
        const data = await res.json().catch(() => ({}));
        setDialog(null);
        if (!res.ok) {
          setError(data.message ?? "Activate failed");
          return;
        }
        router.push("/admin/employees");
        router.refresh();
        return;
      }

      if (action === "delete") {
        const res = await fetch(`/api/admin/employees/${employee.id}`, {
          method: "DELETE",
        });
        const data = await res.json().catch(() => ({}));
        setDialog(null);
        if (!res.ok) {
          setError(data.message ?? "Delete failed");
          return;
        }
        router.push("/admin/employees");
        router.refresh();
        return;
      }

      if (action === "reset") {
        setResetResult(null);
        const res = await fetch(
          `/api/admin/employees/${employee.id}/reset-password`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );
        const data = await res.json().catch(() => ({}));
        setDialog(null);
        if (!res.ok) {
          setError(data.message ?? `Password reset failed (${res.status})`);
          return;
        }
        if (!data.credentials?.temporary_password) {
          setError(data.message ?? "Reset succeeded but no password returned");
          return;
        }
        setResetResult(data.credentials.temporary_password);
      }
    });
  }

  if (created) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          Employee created. Share these login details, then ask them to change
          the password on first login.
        </p>
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p>
            <span className="text-slate-500">Employee ID:</span>{" "}
            <span className="font-mono font-semibold">{created.employee_id}</span>
          </p>
          <p>
            <span className="text-slate-500">Email:</span>{" "}
            <span className="font-mono font-semibold">{created.email}</span>
          </p>
          <p>
            <span className="text-slate-500">Temporary password:</span>{" "}
            <span className="font-mono font-semibold">
              {created.temporary_password}
            </span>
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            router.push("/admin/employees");
            router.refresh();
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        {!isEdit && (
          <div>
            <Label htmlFor="employee_id">Employee ID (auto)</Label>
            <Input
              id="employee_id"
              required
              readOnly
              className="bg-slate-50 font-mono"
              value={form.employee_id}
            />
          </div>
        )}
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            id="mobile"
            required
            value={form.mobile}
            onChange={(e) => update("mobile", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="designation">Designation</Label>
          <Input
            id="designation"
            required
            value={form.designation}
            onChange={(e) => update("designation", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="shift">Shift</Label>
          <select
            id="shift"
            className="flex h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            value={form.shift_id}
            onChange={(e) => update("shift_id", e.target.value)}
          >
            <option value="">Unassigned</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            className="flex h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            value={form.role}
            onChange={(e) =>
              update("role", e.target.value as "ADMIN" | "EMPLOYEE")
            }
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        {!isEdit && (
          <>
            <div>
              <Label htmlFor="email">Login email</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label htmlFor="password" className="mb-0">
                  Temporary password (auto)
                </Label>
                <button
                  type="button"
                  className="text-xs font-medium text-teal-700 hover:underline"
                  onClick={regeneratePassword}
                >
                  Regenerate
                </button>
              </div>
              <div className="flex gap-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  className="font-mono"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Employee must change this password on first login.
              </p>
            </div>
          </>
        )}
        {isEdit && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="font-medium text-slate-900">Forgot password?</p>
              <p className="mt-1 text-xs text-slate-500">
                Generate a temporary password. Share it with the employee so
                they can log in and change it under Password.
              </p>
            </div>
            {resetResult && (
              <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
                Temporary password:{" "}
                <span className="font-mono font-semibold">{resetResult}</span>
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDialog("reset")}
            >
              {pending ? "Working…" : "Reset password"}
            </Button>
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create employee"}
          </Button>
          {isEdit && employee?.status === "ACTIVE" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDialog("deactivate")}
            >
              Deactivate
            </Button>
          )}
          {isEdit && employee?.status === "INACTIVE" && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setDialog("activate")}
            >
              Activate again
            </Button>
          )}
        </div>
        {isEdit && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-900">Danger zone</p>
            <p className="mt-1 text-xs text-red-800/80">
              Permanent delete removes login and attendance records. Prefer
              Deactivate if you only want to block access.
            </p>
            <Button
              type="button"
              variant="danger"
              className="mt-3"
              disabled={pending}
              onClick={() => setDialog("delete")}
            >
              Delete employee
            </Button>
          </div>
        )}
      </form>

      <ConfirmDialog
        open={dialog === "deactivate"}
        title="Deactivate employee?"
        description="They will not be able to log in. Attendance history is kept, and you can activate them again later."
        confirmLabel="Deactivate"
        tone="warning"
        pending={pending}
        onConfirm={runConfirmedAction}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "activate"}
        title="Activate employee?"
        description="They will be able to log in again with their existing password."
        confirmLabel="Activate again"
        pending={pending}
        onConfirm={runConfirmedAction}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "reset"}
        title="Reset password?"
        description="A temporary password will be generated. Share it with the employee — they must change it after login."
        confirmLabel="Reset password"
        pending={pending}
        onConfirm={runConfirmedAction}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Delete employee permanently?"
        description={`This removes ${employee?.name ?? "this employee"} (${employee?.employee_id ?? ""}) login and attendance history. This cannot be undone.`}
        confirmLabel="Delete forever"
        tone="warning"
        pending={pending}
        confirmText="DELETE"
        confirmTextUppercase
        onConfirm={runConfirmedAction}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}
