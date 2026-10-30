import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";
import { buildMonthlyAttendanceWorkbook } from "@/lib/excel/export";
import type { Attendance, Employee, OfficeSettings, Shift } from "@/types";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const month =
      request.nextUrl.searchParams.get("month") ??
      new Date().toISOString().slice(0, 7);

    const [year, mon] = month.split("-").map(Number);
    const start = `${year}-${String(mon).padStart(2, "0")}-01`;
    const endDate = new Date(year, mon, 0).getDate();
    const end = `${year}-${String(mon).padStart(2, "0")}-${endDate}`;

    const supabase = await createClient();
    const [{ data, error }, { data: office }] = await Promise.all([
      supabase
        .from("attendance")
        .select("*, employees(*, shifts(*))")
        .gte("attendance_date", start)
        .lte("attendance_date", end)
        .order("attendance_date", { ascending: true }),
      supabase.from("office_settings").select("timezone").limit(1).maybeSingle(),
    ]);

    if (error) throw error;

    const timezone =
      (office as OfficeSettings | null)?.timezone ?? "Asia/Karachi";

    const buffer = buildMonthlyAttendanceWorkbook(
      (data ?? []) as (Attendance & {
        employees?: (Employee & { shifts?: Shift | null }) | null;
      })[],
      month,
      timezone
    );

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="attendance-${month}.xlsx"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
