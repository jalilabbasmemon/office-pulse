import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";
import { getTodayInTimezone } from "@/lib/attendance/timezone";
import type { OfficeSettings } from "@/types";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data: office } = await supabase
      .from("office_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const timezone = (office as OfficeSettings | null)?.timezone ?? "Asia/Karachi";
    const today = getTodayInTimezone(timezone);

    const date = request.nextUrl.searchParams.get("date") ?? today;
    const month = request.nextUrl.searchParams.get("month");
    const employeeId = request.nextUrl.searchParams.get("employee_id");
    const status = request.nextUrl.searchParams.get("status");

    let query = supabase
      .from("attendance")
      .select("*, employees(*, shifts(*))")
      .order("attendance_date", { ascending: false });

    if (month) {
      const [year, mon] = month.split("-").map(Number);
      const start = `${year}-${String(mon).padStart(2, "0")}-01`;
      const endDate = new Date(year, mon, 0).getDate();
      const end = `${year}-${String(mon).padStart(2, "0")}-${endDate}`;
      query = query.gte("attendance_date", start).lte("attendance_date", end);
    } else {
      query = query.eq("attendance_date", date);
    }

    if (employeeId) query = query.eq("employee_id", employeeId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    const { data: employees } = await supabase
      .from("employees")
      .select("id, status")
      .eq("status", "ACTIVE");

    const activeCount = employees?.length ?? 0;
    const present = (data ?? []).filter((r) => r.check_in_time).length;
    const working = (data ?? []).filter(
      (r) => r.check_in_time && !r.check_out_time
    ).length;
    const checkedOut = (data ?? []).filter((r) => r.check_out_time).length;

    return NextResponse.json({
      records: data ?? [],
      date,
      month,
      stats: {
        totalEmployees: activeCount,
        present,
        absent: Math.max(activeCount - present, 0),
        currentlyWorking: working,
        checkedOut,
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
