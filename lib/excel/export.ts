import * as XLSX from "xlsx";
import type { Attendance, Employee, Shift } from "@/types";
import { formatMinutes, formatShortDate, formatTime } from "@/lib/utils";

type Row = Attendance & {
  employees?: (Employee & { shifts?: Shift | null }) | null;
};

function punctualityLabel(r: Row): string {
  if (!r.check_in_time) return "Absent";
  return r.is_late ? "Late" : "On Time";
}

function leaveLabel(r: Row): string {
  if (!r.check_in_time) return "--";
  if (!r.check_out_time) return "Missing checkout";
  return r.is_early_leave ? "Early Leave" : "On Time";
}

function attendanceFlags(r: Row): string {
  const flags: string[] = [];
  if (!r.check_in_time) flags.push("ABSENT");
  else {
    flags.push(r.is_late ? "LATE" : "ON_TIME");
    if (r.check_out_time) {
      flags.push(r.is_early_leave ? "EARLY_LEAVE" : "FULL_DAY");
    } else {
      flags.push("NO_CHECKOUT");
    }
  }
  return flags.join(" | ");
}

export function buildMonthlyAttendanceWorkbook(
  rows: Row[],
  monthLabel: string,
  timeZone = "Asia/Karachi"
): ArrayBuffer {
  const sorted = [...rows].sort((a, b) => {
    const byDate = a.attendance_date.localeCompare(b.attendance_date);
    if (byDate !== 0) return byDate;
    return (a.employees?.name ?? "").localeCompare(b.employees?.name ?? "");
  });

  const daily = sorted.map((r) => {
    const shift = r.employees?.shifts;
    return {
      Date: r.attendance_date,
      "Date (display)": formatShortDate(r.attendance_date, timeZone),
      "Employee ID": r.employees?.employee_id ?? "",
      Name: r.employees?.name ?? "",
      Designation: r.employees?.designation ?? "",
      Shift: shift?.name ?? "",
      "Shift Start": shift?.start_time?.slice(0, 5) ?? "",
      "Shift End": shift?.end_time?.slice(0, 5) ?? "",
      "Grace (min)": shift?.grace_minutes ?? "",
      "Check In": formatTime(r.check_in_time, timeZone),
      "Check Out": formatTime(r.check_out_time, timeZone),
      Hours: formatMinutes(r.total_work_minutes),
      "Work Minutes": r.total_work_minutes ?? "",
      Punctuality: punctualityLabel(r),
      "Late?": !r.check_in_time ? "--" : r.is_late ? "Yes" : "No",
      "Early Leave?": !r.check_out_time ? "--" : r.is_early_leave ? "Yes" : "No",
      "Leave Status": leaveLabel(r),
      Flags: attendanceFlags(r),
      "Record Status": r.status,
      "Check-in Distance (m)": r.check_in_distance_meters ?? "",
      "Check-in Accuracy (m)": r.check_in_accuracy ?? "",
      "Check-in IP": r.check_in_ip ?? "",
      "Check-out Distance (m)": r.check_out_distance_meters ?? "",
      "Check-out Accuracy (m)": r.check_out_accuracy ?? "",
      "Check-out IP": r.check_out_ip ?? "",
    };
  });

  type Agg = {
    name: string;
    employeeId: string;
    designation: string;
    shift: string;
    present: number;
    onTime: number;
    late: number;
    earlyLeave: number;
    missingCheckout: number;
    minutes: number;
  };

  const byEmployee = new Map<string, Agg>();

  for (const r of sorted) {
    const key = r.employee_id;
    const existing = byEmployee.get(key) ?? {
      name: r.employees?.name ?? "",
      employeeId: r.employees?.employee_id ?? "",
      designation: r.employees?.designation ?? "",
      shift: r.employees?.shifts?.name ?? "",
      present: 0,
      onTime: 0,
      late: 0,
      earlyLeave: 0,
      missingCheckout: 0,
      minutes: 0,
    };

    if (r.check_in_time) {
      existing.present += 1;
      if (r.is_late) existing.late += 1;
      else existing.onTime += 1;

      if (!r.check_out_time) existing.missingCheckout += 1;
      else if (r.is_early_leave) existing.earlyLeave += 1;
    }

    existing.minutes += r.total_work_minutes ?? 0;
    byEmployee.set(key, existing);
  }

  const summary = Array.from(byEmployee.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({
      "Employee ID": e.employeeId,
      Name: e.name,
      Designation: e.designation,
      Shift: e.shift,
      "Days Present": e.present,
      "On Time Days": e.onTime,
      "Late Days": e.late,
      "Early Leave Days": e.earlyLeave,
      "Missing Checkout": e.missingCheckout,
      "Total Hours": formatMinutes(e.minutes),
      "Total Minutes": e.minutes,
      "Late %":
        e.present > 0 ? `${Math.round((e.late / e.present) * 100)}%` : "0%",
    }));

  const totals = {
    Records: sorted.length,
    Present: sorted.filter((r) => r.check_in_time).length,
    "On Time": sorted.filter((r) => r.check_in_time && !r.is_late).length,
    Late: sorted.filter((r) => r.is_late).length,
    "Early Leave": sorted.filter((r) => r.is_early_leave).length,
    "Missing Checkout": sorted.filter(
      (r) => r.check_in_time && !r.check_out_time
    ).length,
  };

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(daily);
  const ws2 = XLSX.utils.json_to_sheet(summary);
  const ws3 = XLSX.utils.aoa_to_sheet([
    ["OfficePulse Monthly Attendance Report"],
    [],
    ["Month", monthLabel],
    ["Timezone", timeZone],
    ["Generated (UTC)", new Date().toISOString()],
    [],
    ["Totals"],
    ...Object.entries(totals),
    [],
    ["Legend"],
    ["Punctuality", "On Time = checked in within shift start + grace"],
    ["Late", "Checked in after shift start + grace minutes"],
    ["Early Leave", "Checked out before shift end time"],
    ["Flags", "Combined LATE / ON_TIME / EARLY_LEAVE / FULL_DAY markers"],
  ]);

  // Reasonable column widths for readability
  ws1["!cols"] = Object.keys(daily[0] ?? { A: 1 }).map((key) => ({
    wch: Math.min(Math.max(String(key).length + 2, 12), 28),
  }));
  ws2["!cols"] = Object.keys(summary[0] ?? { A: 1 }).map((key) => ({
    wch: Math.min(Math.max(String(key).length + 2, 12), 22),
  }));

  XLSX.utils.book_append_sheet(wb, ws1, "Daily Attendance");
  XLSX.utils.book_append_sheet(wb, ws2, "Monthly Summary");
  XLSX.utils.book_append_sheet(wb, ws3, "Meta");

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
