import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppNav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { MonthFilter } from "@/components/ui/date-filters";
import { formatMinutes, formatShortDate, formatTime } from "@/lib/utils";

export default async function AttendanceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");

  const params = await searchParams;
  const month = params.month ?? new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const start = `${year}-${String(mon).padStart(2, "0")}-01`;
  const endDate = new Date(year, mon, 0).getDate();
  const end = `${year}-${String(mon).padStart(2, "0")}-${endDate}`;

  const supabase = await createClient();
  const { data: records } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employee.id)
    .gte("attendance_date", start)
    .lte("attendance_date", end)
    .order("attendance_date", { ascending: false });

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">My Attendance</h1>
          <MonthFilter defaultValue={month} />
        </div>

        <Card className="overflow-hidden p-0">
          <div className="hidden grid-cols-4 gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <span>Date</span>
            <span>In</span>
            <span>Out</span>
            <span>Hours</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {(records ?? []).length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                No records for this month.
              </li>
            )}
            {(records ?? []).map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-2 gap-2 px-4 py-3 text-sm sm:grid-cols-4"
              >
                <span className="font-medium text-slate-900">
                  {formatShortDate(r.attendance_date)}
                </span>
                <span>{formatTime(r.check_in_time)}</span>
                <span>{formatTime(r.check_out_time)}</span>
                <span>{formatMinutes(r.total_work_minutes)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </div>
  );
}
