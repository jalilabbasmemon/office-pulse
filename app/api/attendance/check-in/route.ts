import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";
import { getTodayInTimezone } from "@/lib/attendance/timezone";
import { validateAttendanceLocation } from "@/lib/attendance/validate";
import { getRequestIp } from "@/lib/network/ip";
import { gpsSchema } from "@/validations";
import type { OfficeSettings } from "@/types";

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
      .select("id, check_in_time")
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (existing?.check_in_time) {
      return apiError("ALREADY_CHECKED_IN", 409);
    }

    const now = new Date().toISOString();
    const payload = {
      employee_id: employee.id,
      attendance_date: today,
      check_in_time: now,
      check_in_latitude: parsed.data.latitude,
      check_in_longitude: parsed.data.longitude,
      check_in_accuracy: parsed.data.accuracy,
      check_in_distance_meters: validation.distanceMeters,
      check_in_ip: requestIp,
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

    return NextResponse.json({
      message: `Check-in successful. Distance: ${validation.distanceMeters} meters.`,
      attendance,
      distanceMeters: validation.distanceMeters,
    });
  } catch (err) {
    console.error("check-in error", err);
    return apiError("SERVER_ERROR", 500);
  }
}
