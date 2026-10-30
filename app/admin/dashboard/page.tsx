import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { redirectIfMustChangePassword } from "@/lib/auth/password-gate";
import { getTodayInTimezone } from "@/lib/attendance/timezone";
import { AppNav } from "@/components/nav";
import { Card, CardTitle } from "@/components/ui/card";
import { formatTime } from "@/lib/utils";
import type { OfficeSettings } from "@/types";

export default async function AdminDashboardPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "ADMIN") redirect("/dashboard");
  redirectIfMustChangePassword(employee);

  const supabase = await createClient();
  const { data: office } = await supabase
    .from("office_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  const timezone = (office as OfficeSettings | null)?.timezone ?? "Asia/Karachi";
  const today = getTodayInTimezone(timezone);

  const [{ data: activeEmployees }, { data: records }] = await Promise.all([
    supabase.from("employees").select("id").eq("status", "ACTIVE"),
    supabase
      .from("attendance")
      .select("*, employees(name, employee_id, shifts(name))")
      .eq("attendance_date", today)
      .order("check_in_time", { ascending: true }),
  ]);

  const total = activeEmployees?.length ?? 0;
  const present = (records ?? []).filter((r) => r.check_in_time).length;
  const working = (records ?? []).filter(
    (r) => r.check_in_time && !r.check_out_time
  ).length;
  const checkedOut = (records ?? []).filter((r) => r.check_out_time).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Attendance Dashboard
            </h1>
            <p className="text-sm text-slate-500">{today}</p>
          </div>
          <Link
            href="/admin/reports"
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            Monthly reports →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Total Employees" value={total} />
          <Stat label="Present" value={present} />
          <Stat label="Absent" value={Math.max(total - present, 0)} />
          <Stat label="Currently Working" value={working} />
          <Stat label="Checked Out" value={checkedOut} />
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <CardTitle>Today</CardTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">Shift</th>
                  <th className="px-4 py-2">In</th>
                  <th className="px-4 py-2">Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(records ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No check-ins yet today.
                    </td>
                  </tr>
                )}
                {(records ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {r.employees?.name}
                      <span className="ml-2 text-xs text-slate-400">
                        {r.employees?.employee_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.employees?.shifts?.name ?? "--"}
                    </td>
                    <td className="px-4 py-3">{formatTime(r.check_in_time)}</td>
                    <td className="px-4 py-3">{formatTime(r.check_out_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}
