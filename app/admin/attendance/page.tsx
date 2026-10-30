import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { getTodayInTimezone } from "@/lib/attendance/timezone";
import { AppNav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { DateFilter } from "@/components/ui/date-filters";
import { AttendanceCorrectForm } from "@/components/admin/attendance-correct-form";
import { formatMinutes, formatTime } from "@/lib/utils";
import type { OfficeSettings } from "@/types";

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const supabase = await createClient();
  const { data: office } = await supabase
    .from("office_settings")
    .select("timezone")
    .limit(1)
    .maybeSingle();
  const timezone = (office as OfficeSettings | null)?.timezone ?? "Asia/Karachi";
  const date = params.date ?? getTodayInTimezone(timezone);

  const { data: records } = await supabase
    .from("attendance")
    .select("*, employees(name, employee_id)")
    .eq("attendance_date", date)
    .order("check_in_time", { ascending: true });

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Attendance</h1>
          <DateFilter defaultValue={date} />
        </div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">In</th>
                  <th className="px-4 py-2">Out</th>
                  <th className="px-4 py-2">Hours</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(records ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No attendance for this date.
                    </td>
                  </tr>
                )}
                {(records ?? []).map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.employees?.name}</p>
                      <p className="text-xs text-slate-400">
                        {r.employees?.employee_id}
                      </p>
                    </td>
                    <td className="px-4 py-3">{formatTime(r.check_in_time)}</td>
                    <td className="px-4 py-3">{formatTime(r.check_out_time)}</td>
                    <td className="px-4 py-3">
                      {formatMinutes(r.total_work_minutes)}
                    </td>
                    <td className="px-4 py-3">{r.status}</td>
                    <td className="px-4 py-3">
                      <AttendanceCorrectForm
                        attendanceId={r.id}
                        checkIn={r.check_in_time}
                        checkOut={r.check_out_time}
                      />
                    </td>
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
