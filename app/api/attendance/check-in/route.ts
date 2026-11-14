import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";
import { getTodayInTimezone, isLate } from "@/lib/attendance/timezone";
import { validateAttendanceLocation } from "@/lib/attendance/validate";
import { getRequestIp } from "@/lib/network/ip";
import { gpsSchema } from "@/validations";
import type { OfficeLocation, OfficeSettings, Shift } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const employee = await getCurrentEmployee();
    if (!employee) return apiError("UNAUTHORIZED", 401);
    if (employee.status !== "ACTIVE") return apiError("EMPLOYEE_INACTIVE", 403);
    if (employee.must_change_password) {
      return apiError(
        "FORBIDDEN",
        403,
        "You must change your temporary password before continuing."
      );
    }

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
      check_in_location_name: validation.locationName,
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

    const where =
      validation.locationName != null
        ? ` at ${validation.locationName}`
        : "";
    const distanceLabel =
      validation.distanceMeters != null
        ? ` Distance: ${validation.distanceMeters}m.`
        : validation.wifiOnly
          ? " Verified via office Wi‑Fi (GPS not required)."
          : "";

    return NextResponse.json({
      message: late
        ? `Checked in late${where}.${distanceLabel}`
        : `Check-in successful${where}.${distanceLabel}`,
      attendance,
      distanceMeters: validation.distanceMeters,
      locationName: validation.locationName,
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
