"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function EmployeeForm({ shifts, employee }: Props) {
  const router = useRouter();
  const isEdit = Boolean(employee);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(true);

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

  async function deactivate() {
    if (!employee) return;
    if (!confirm("Deactivate this employee?")) return;
    const res = await fetch(`/api/admin/employees/${employee.id}/deactivate`, {
      method: "POST",
    });
    if (res.ok) {
      router.push("/admin/employees");
      router.refresh();
    }
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
          <Button type="button" variant="danger" onClick={deactivate}>
            Deactivate
          </Button>
        )}
      </div>
    </form>
  );
}
