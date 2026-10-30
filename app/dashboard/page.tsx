import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { redirectIfMustChangePassword } from "@/lib/auth/password-gate";
import { getTodayInTimezone } from "@/lib/attendance/timezone";
import { AppNav } from "@/components/nav";
import { AttendanceCard } from "@/components/attendance/attendance-card";
import type { OfficeSettings } from "@/types";

export default async function DashboardPage() {
  const employee = await getCurrentEmployee();
  if (!employee) redirect("/login");
  if (employee.status !== "ACTIVE") redirect("/login");
  redirectIfMustChangePassword(employee);

  const supabase = await createClient();
  const { data: office } = await supabase
    .from("office_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  const timezone = (office as OfficeSettings | null)?.timezone ?? "Asia/Karachi";
  const today = getTodayInTimezone(timezone);

  const { data: attendance } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("attendance_date", today)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav role={employee.role} name={employee.name} />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <AttendanceCard
          employee={employee}
          today={attendance}
          office={(office as OfficeSettings | null) ?? null}
        />
      </main>
    </div>
  );
}
