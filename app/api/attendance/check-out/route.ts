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
import type { OfficeLocation, OfficeSettings, Shift } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const employee = await getCurrentEmployee();
    if (!employee) return apiError("UNAUTHORIZED", 401);
    if (employee.status !== "ACTIVE") return apiError("EMPLOYEE_INACTIVE", 403);

    const body = await request.json().catch(() => ({}));
    const parsed = gpsSchema.safeParse(body);
    const gps = parsed.success ? parsed.data : null;

    const supabase = await createClient();
    const [{ data: office, error: officeError }, { data: locations }] =
      await Promise.all([
        supabase.from("office_settings").select("*").limit(1).maybeSingle(),
        supabase
          .from("office_locations")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]);

    if (officeError || !office) return apiError("OFFICE_NOT_CONFIGURED", 400);
    const settings = office as OfficeSettings;
    const today = getTodayInTimezone(settings.timezone);
    const requestIp = getRequestIp(request);

    const validation = validateAttendanceLocation(
      gps,
      settings,
      (locations as OfficeLocation[]) ?? [],
      requestIp
    );
    if (!validation.ok) {
      const status = validation.code === "OUTSIDE_OFFICE" ? 403 : 400;
      const { networkValidationMessage } = await import(
        "@/lib/attendance/network-error"
      );
      return apiError(
        validation.code,
        status,
        networkValidationMessage(
          validation.code,
          validation.requestIp,
          validation.allowedIps
        )
      );
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
        check_out_latitude: validation.storeGps && gps ? gps.latitude : null,
        check_out_longitude: validation.storeGps && gps ? gps.longitude : null,
        check_out_accuracy: validation.storeGps && gps ? gps.accuracy : null,
        check_out_distance_meters: validation.distanceMeters,
        check_out_ip: validation.requestIp,
        check_out_location_name: validation.locationName,
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

    const where =
      validation.locationName != null
        ? ` at ${validation.locationName}`
        : "";
    const wifiNote = validation.wifiOnly
      ? " Verified via office Wi‑Fi."
      : "";

    return NextResponse.json({
      message: early
        ? `Checked out early${where}. Worked ${Math.floor(total / 60)}h ${total % 60}m.${wifiNote}`
        : `Check-out successful${where}. Worked ${Math.floor(total / 60)}h ${total % 60}m.${wifiNote}`,
      attendance,
      distanceMeters: validation.distanceMeters,
      locationName: validation.locationName,
      isEarlyLeave: early,
      networkOk: true,
      locationOk: true,
      wifiOnly: validation.wifiOnly,
    });
  } catch (err) {
    console.error("check-out error", err);
    return apiError("SERVER_ERROR", 500);
  }
}
