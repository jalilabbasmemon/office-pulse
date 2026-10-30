import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";
import {
  computeWorkMinutes,
  getTodayInTimezone,
  isEarlyLeave,
} from "@/lib/attendance/timezone";
import { validateAttendanceLocation } from "@/lib/attendance/validate";
import { getRequestIp } from "@/lib/network/ip";
import { gpsSchema } from "@/validations";
import type { OfficeSettings, Shift } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const employee = await getCurrentEmployee();
    if (!employee) return apiError("UNAUTHORIZED", 401);
    if (employee.status !== "ACTIVE") return apiError("EMPLOYEE_INACTIVE", 403);

    const body = await request.json();
    const parsed = gpsSchema.safeParse(body);
    if (!parsed.success) return apiError("GPS_REQUIRED", 400);

    const supabase = await createClient();
    const { data: office, error: officeError } = await supabase
      .from("office_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (officeError || !office) return apiError("OFFICE_NOT_CONFIGURED", 400);
    const settings = office as OfficeSettings;
    const today = getTodayInTimezone(settings.timezone);
    const requestIp = getRequestIp(request);

    // Same Wi‑Fi (public IP) + GPS validation as check-in
    const validation = validateAttendanceLocation(
      parsed.data,
      settings,
      requestIp
    );
    if (!validation.ok) {
      const status =
        validation.code === "OFFICE_NETWORK_REQUIRED" ||
        validation.code === "OUTSIDE_OFFICE"
          ? 403
          : 400;
      return apiError(validation.code, status);
    }

    const { data: existing } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (!existing?.check_in_time) return apiError("NOT_CHECKED_IN", 400);
    if (existing.check_out_time) return apiError("ALREADY_CHECKED_OUT", 409);

    const now = new Date().toISOString();
    const total = computeWorkMinutes(existing.check_in_time, now);
    const shift = employee.shifts as Shift | null | undefined;
    const early = shift
      ? isEarlyLeave(now, shift.end_time, settings.timezone)
      : false;

    const { data: attendance, error } = await supabase
      .from("attendance")
      .update({
        check_out_time: now,
        check_out_latitude: parsed.data.latitude,
        check_out_longitude: parsed.data.longitude,
        check_out_accuracy: parsed.data.accuracy,
        check_out_distance_meters: validation.distanceMeters,
        check_out_ip: requestIp,
        total_work_minutes: total,
        is_early_leave: early,
        status: "CLOSED",
      })
      .eq("id", existing.id)
      .is("check_out_time", null)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!attendance) return apiError("ALREADY_CHECKED_OUT", 409);

    return NextResponse.json({
      message: early
        ? `Checked out early. Worked ${Math.floor(total / 60)}h ${total % 60}m.`
        : `Check-out successful. Worked ${Math.floor(total / 60)}h ${total % 60}m.`,
      attendance,
      distanceMeters: validation.distanceMeters,
      isEarlyLeave: early,
      networkOk: true,
      locationOk: true,
    });
  } catch (err) {
    console.error("check-out error", err);
    return apiError("SERVER_ERROR", 500);
  }
}
