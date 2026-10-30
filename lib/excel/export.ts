import * as XLSX from "xlsx";
import type { Attendance, Employee } from "@/types";
import { formatMinutes, formatTime } from "@/lib/utils";

type Row = Attendance & { employees?: Employee | null };

export function buildMonthlyAttendanceWorkbook(
  rows: Row[],
  monthLabel: string
): ArrayBuffer {
  const daily = rows.map((r) => ({
    Date: r.attendance_date,
    "Employee ID": r.employees?.employee_id ?? "",
    Name: r.employees?.name ?? "",
    "Check In": formatTime(r.check_in_time),
    "Check Out": formatTime(r.check_out_time),
    Hours: formatMinutes(r.total_work_minutes),
    Status: r.status,
    "Check-in Distance (m)": r.check_in_distance_meters ?? "",
    "Check-in IP": r.check_in_ip ?? "",
  }));

  const byEmployee = new Map<
    string,
    { name: string; employeeId: string; present: number; minutes: number }
  >();

  for (const r of rows) {
    const key = r.employee_id;
    const existing = byEmployee.get(key) ?? {
      name: r.employees?.name ?? "",
      employeeId: r.employees?.employee_id ?? "",
      present: 0,
      minutes: 0,
    };
    if (r.check_in_time) existing.present += 1;
    existing.minutes += r.total_work_minutes ?? 0;
    byEmployee.set(key, existing);
  }

  const summary = Array.from(byEmployee.values()).map((e) => ({
    "Employee ID": e.employeeId,
    Name: e.name,
    "Days Present": e.present,
    "Total Hours": formatMinutes(e.minutes),
  }));

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(daily);
  const ws2 = XLSX.utils.json_to_sheet(summary);
  const ws3 = XLSX.utils.aoa_to_sheet([
    ["Report"],
    [monthLabel],
    ["Generated"],
    [new Date().toISOString()],
    ["Records"],
    [rows.length],
  ]);

  XLSX.utils.book_append_sheet(wb, ws1, "Daily Attendance");
  XLSX.utils.book_append_sheet(wb, ws2, "Monthly Summary");
  XLSX.utils.book_append_sheet(wb, ws3, "Meta");

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
