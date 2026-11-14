import ExcelJS from "exceljs";
import type { Attendance, Employee, Shift } from "@/types";
import { formatMinutes, formatShortDate, formatTime } from "@/lib/utils";
import { asExcelCellValue, asExcelText } from "@/lib/excel/sanitize";

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

function addHeaderRow(sheet: ExcelJS.Worksheet, headers: string[]) {
  const row = sheet.addRow(headers.map((h) => asExcelText(h)));
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.numFmt = "@";
  });
}

function addDataRow(sheet: ExcelJS.Worksheet, values: unknown[]) {
  const row = sheet.addRow(values.map((v) => asExcelCellValue(v)));
  row.eachCell((cell) => {
    // Force text for string cells so Excel does not re-interpret formulas
    if (typeof cell.value === "string") {
      cell.numFmt = "@";
    }
  });
}

export async function buildMonthlyAttendanceWorkbook(
  rows: Row[],
  monthLabel: string,
  timeZone = "Asia/Karachi"
): Promise<ArrayBuffer> {
  const sorted = [...rows].sort((a, b) => {
    const byDate = a.attendance_date.localeCompare(b.attendance_date);
    if (byDate !== 0) return byDate;
    return (a.employees?.name ?? "").localeCompare(b.employees?.name ?? "");
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OfficePulse";
  workbook.created = new Date();

  const dailySheet = workbook.addWorksheet("Daily Attendance", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const dailyHeaders = [
    "Date",
    "Date (display)",
    "Employee ID",
    "Name",
    "Designation",
    "Shift",
    "Shift Start",
    "Shift End",
    "Grace (min)",
    "Check In",
    "Check Out",
    "Hours",
    "Work Minutes",
    "Punctuality",
    "Late?",
    "Early Leave?",
    "Leave Status",
    "Flags",
    "Record Status",
    "Check-in Latitude",
    "Check-in Longitude",
    "Check-in Distance (m)",
    "Check-in Accuracy (m)",
    "Check-in IP",
    "Check-in Location",
    "Check-out Latitude",
    "Check-out Longitude",
    "Check-out Distance (m)",
    "Check-out Accuracy (m)",
    "Check-out IP",
    "Check-out Location",
  ];
  addHeaderRow(dailySheet, dailyHeaders);

  for (const r of sorted) {
    const shift = r.employees?.shifts;
    addDataRow(dailySheet, [
      r.attendance_date,
      formatShortDate(r.attendance_date, timeZone),
      r.employees?.employee_id ?? "",
      r.employees?.name ?? "",
      r.employees?.designation ?? "",
      shift?.name ?? "",
      shift?.start_time?.slice(0, 5) ?? "",
      shift?.end_time?.slice(0, 5) ?? "",
      shift?.grace_minutes ?? "",
      formatTime(r.check_in_time, timeZone),
      formatTime(r.check_out_time, timeZone),
      formatMinutes(r.total_work_minutes),
      r.total_work_minutes ?? "",
      punctualityLabel(r),
      !r.check_in_time ? "--" : r.is_late ? "Yes" : "No",
      !r.check_out_time ? "--" : r.is_early_leave ? "Yes" : "No",
      leaveLabel(r),
      attendanceFlags(r),
      r.status,
      r.check_in_latitude ?? "",
      r.check_in_longitude ?? "",
      r.check_in_distance_meters ?? "",
      r.check_in_accuracy ?? "",
      r.check_in_ip ?? "",
      r.check_in_location_name ?? "",
      r.check_out_latitude ?? "",
      r.check_out_longitude ?? "",
      r.check_out_distance_meters ?? "",
      r.check_out_accuracy ?? "",
      r.check_out_ip ?? "",
      r.check_out_location_name ?? "",
    ]);
  }

  dailySheet.columns.forEach((col) => {
    col.width = 16;
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

  const summarySheet = workbook.addWorksheet("Monthly Summary", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  addHeaderRow(summarySheet, [
    "Employee ID",
    "Name",
    "Designation",
    "Shift",
    "Days Present",
    "On Time Days",
    "Late Days",
    "Early Leave Days",
    "Missing Checkout",
    "Total Hours",
    "Total Minutes",
    "Late %",
  ]);

  for (const e of Array.from(byEmployee.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    addDataRow(summarySheet, [
      e.employeeId,
      e.name,
      e.designation,
      e.shift,
      e.present,
      e.onTime,
      e.late,
      e.earlyLeave,
      e.missingCheckout,
      formatMinutes(e.minutes),
      e.minutes,
      e.present > 0 ? `${Math.round((e.late / e.present) * 100)}%` : "0%",
    ]);
  }
  summarySheet.columns.forEach((col) => {
    col.width = 16;
  });

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

  const meta = workbook.addWorksheet("Meta");
  const metaRows: unknown[][] = [
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
  ];
  for (const line of metaRows) {
    addDataRow(meta, line);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
