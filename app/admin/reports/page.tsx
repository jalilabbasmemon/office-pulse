import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { AppNav } from "@/components/nav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonthFilter } from "@/components/ui/date-filters";
import { formatMinutes, formatShortDate, formatTime } from "@/lib/utils";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const month = params.month ?? new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const start = `${year}-${String(mon).padStart(2, "0")}-01`;
  const endDate = new Date(year, mon, 0).getDate();
  const end = `${year}-${String(mon).padStart(2, "0")}-${endDate}`;

  const supabase = await createClient();
  const { data: records } = await supabase
    .from("attendance")
    .select("*, employees(name, employee_id)")
    .gte("attendance_date", start)
    .lte("attendance_date", end)
    .order("attendance_date", { ascending: false });

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            Monthly reports
          </h1>
          <div className="flex items-center gap-2">
            <MonthFilter defaultValue={month} />
            <a href={`/api/admin/attendance/export?month=${month}`}>
              <Button type="button">Export Excel</Button>
            </a>
          </div>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">In</th>
                  <th className="px-4 py-2">Out</th>
                  <th className="px-4 py-2">Hours</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(records ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      {formatShortDate(r.attendance_date)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {r.employees?.name}
                    </td>
                    <td className="px-4 py-3">{formatTime(r.check_in_time)}</td>
                    <td className="px-4 py-3">{formatTime(r.check_out_time)}</td>
                    <td className="px-4 py-3">
                      {formatMinutes(r.total_work_minutes)}
                    </td>
                    <td className="px-4 py-3">{r.status}</td>
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
