import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";
import { getTodayInTimezone, isLate } from "@/lib/attendance/timezone";
import { validateAttendanceLocation } from "@/lib/attendance/validate";
import { getRequestIp } from "@/lib/network/ip";
import { gpsSchema } from "@/validations";
import type { OfficeSettings, Shift } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const employee = await getCurrentEmployee();
    if (!employee) return apiError("UNAUTHORIZED", 401);
    if (employee.status !== "ACTIVE") return apiError("EMPLOYEE_INACTIVE", 403);

    const body = await request.json().catch(() => ({}));
    const parsed = gpsSchema.safeParse(body);
    const gps = parsed.success ? parsed.data : null;

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

    // Office Wi‑Fi required; GPS optional when allow_wifi_only_punch is on
    const validation = validateAttendanceLocation(gps, settings, requestIp);
    if (!validation.ok) {
      const status =
        validation.code === "OFFICE_NETWORK_REQUIRED" ||
        validation.code === "OUTSIDE_OFFICE"
          ? 403
          : 400;
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
      .select("id, check_in_time")
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (existing?.check_in_time) {
      return apiError("ALREADY_CHECKED_IN", 409);
    }

    const now = new Date().toISOString();
    const shift = employee.shifts as Shift | null | undefined;
    const late = shift
      ? isLate(
          now,
          shift.start_time,
          shift.grace_minutes ?? 15,
          settings.timezone
        )
      : false;

    const payload = {
      employee_id: employee.id,
      attendance_date: today,
      check_in_time: now,
      check_in_latitude: validation.storeGps && gps ? gps.latitude : null,
      check_in_longitude: validation.storeGps && gps ? gps.longitude : null,
      check_in_accuracy: validation.storeGps && gps ? gps.accuracy : null,
      check_in_distance_meters: validation.distanceMeters,
      check_in_ip: validation.requestIp,
      is_late: late,
      status: "OPEN",
    };

    let attendance;
    if (existing) {
      const { data, error } = await supabase
        .from("attendance")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      attendance = data;
    } else {
      const { data, error } = await supabase
        .from("attendance")
        .insert(payload)
        .select("*")
        .single();
      if (error) {
        if (error.code === "23505") return apiError("ALREADY_CHECKED_IN", 409);
        throw error;
      }
      attendance = data;
    }

    const distanceLabel =
      validation.distanceMeters != null
        ? ` Distance: ${validation.distanceMeters}m.`
        : validation.wifiOnly
          ? " Verified via office Wi‑Fi (laptop GPS not required)."
          : "";

    return NextResponse.json({
      message: late
        ? `Checked in late.${distanceLabel}`
        : `Check-in successful.${distanceLabel}`,
      attendance,
      distanceMeters: validation.distanceMeters,
      isLate: late,
      networkOk: true,
      locationOk: true,
      wifiOnly: validation.wifiOnly,
    });
  } catch (err) {
    console.error("check-in error", err);
    return apiError("SERVER_ERROR", 500);
  }
}
