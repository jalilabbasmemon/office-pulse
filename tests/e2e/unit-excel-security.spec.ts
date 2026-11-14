import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { asExcelText } from "../../lib/excel/sanitize";
import { buildMonthlyAttendanceWorkbook } from "../../lib/excel/export";
import type { Attendance, Employee } from "../../types";

test.describe("SEC-F-003 Excel formula injection @P0", () => {
  test("asExcelText prefixes formula markers", () => {
    expect(asExcelText("=1+1")).toBe("'=1+1");
    expect(asExcelText("+cmd")).toBe("'+cmd");
    expect(asExcelText("-2+2")).toBe("'-2+2");
    expect(asExcelText("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(asExcelText("\t=1+1")).toBe("'\t=1+1");
    expect(asExcelText("  =HYPERLINK(\"http://x\")")).toMatch(/^'/);
    expect(asExcelText("Normal Name")).toBe("Normal Name");
  });

  test("exported workbook stores dangerous names as text", async () => {
    const row = {
      id: "att-1",
      employee_id: "emp-1",
      attendance_date: "2026-11-14",
      check_in_time: "2026-11-14T04:00:00.000Z",
      check_in_latitude: null,
      check_in_longitude: null,
      check_in_accuracy: null,
      check_in_distance_meters: null,
      check_in_ip: "=1+1",
      check_out_time: null,
      check_out_latitude: null,
      check_out_longitude: null,
      check_out_accuracy: null,
      check_out_distance_meters: null,
      check_out_ip: null,
      total_work_minutes: 60,
      is_late: false,
      is_early_leave: false,
      status: "OPEN",
      created_at: "",
      updated_at: "",
      employees: {
        id: "emp-1",
        employee_id: "QAEMP01",
        auth_user_id: "x",
        name: "=HYPERLINK(\"http://evil\",\"Click\")",
        mobile: "0300",
        designation: "+cmd|/C calc",
        shift_id: null,
        role: "EMPLOYEE",
        status: "ACTIVE",
        created_at: "",
        updated_at: "",
        shifts: null,
      } as Employee,
    } as Attendance & { employees: Employee };

    const buffer = await buildMonthlyAttendanceWorkbook(
      [row],
      "2026-11",
      "Asia/Karachi"
    );
    expect(buffer.byteLength).toBeGreaterThan(64);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const daily = wb.getWorksheet("Daily Attendance");
    expect(daily).toBeTruthy();
    const nameCell = daily!.getRow(2).getCell(4); // Name column
    const nameVal = String(nameCell.value ?? "");
    expect(nameVal.startsWith("'") || nameVal.startsWith("=") === false).toBe(
      true
    );
    // Must not be a formula cell type
    expect(nameCell.type).not.toBe(ExcelJS.ValueType.Formula);
    expect(String(nameCell.value)).toContain("HYPERLINK");
    expect(String(nameCell.value).startsWith("'")).toBe(true);

    const designation = String(daily!.getRow(2).getCell(5).value ?? "");
    expect(designation.startsWith("'")).toBe(true);
  });
});
