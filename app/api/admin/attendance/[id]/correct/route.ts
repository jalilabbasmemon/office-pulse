import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { sessionErrorResponse } from "@/lib/auth/session-errors";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import {
  computeWorkMinutes,
  isEarlyLeave,
  isLate,
} from "@/lib/attendance/timezone";
import { getRequestIp } from "@/lib/network/ip";
import { attendanceCorrectSchema } from "@/validations";
import type { OfficeSettings, Shift } from "@/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    // ADMIN only — ADMIN_VIEWER hits requireAdmin() and is rejected.
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = attendanceCorrectSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", 400, parsed.error.issues[0]?.message);
    }

    const supabase = await createClient();
    const { data: old } = await supabase
      .from("attendance")
      .select("*, employees(*, shifts(*))")
      .eq("id", id)
      .maybeSingle();

    if (!old) return apiError("ATTENDANCE_NOT_FOUND", 404);

    const checkIn = parsed.data.check_in_time ?? old.check_in_time;
    const checkOut = parsed.data.check_out_time ?? old.check_out_time;
    const total =
      checkIn && checkOut ? computeWorkMinutes(checkIn, checkOut) : null;

    const { data: office } = await supabase
      .from("office_settings")
      .select("timezone")
      .limit(1)
      .maybeSingle();
    const timezone =
      (office as Pick<OfficeSettings, "timezone"> | null)?.timezone ??
      "Asia/Karachi";

    const shift = (old.employees as { shifts?: Shift | null } | null)?.shifts;
    const late =
      checkIn && shift
        ? isLate(checkIn, shift.start_time, shift.grace_minutes, timezone)
        : false;
    const early =
      checkOut && shift
        ? isEarlyLeave(checkOut, shift.end_time, timezone)
        : false;

    // Privileged write after ADMIN gate (SEC-F-001). JWT admin policy also exists.
    const writer = createServiceClient();
    const { data: attendance, error } = await writer
      .from("attendance")
      .update({
        check_in_time: checkIn,
        check_out_time: checkOut,
        total_work_minutes: total,
        is_late: Boolean(checkIn) && late,
        is_early_leave: Boolean(checkOut) && early,
        status: "CORRECTED",
      })
      .eq("id", id)
      .select("*, employees(*)")
      .single();

    if (error) throw error;

    await writeAuditLog({
      adminId: admin.id,
      action: "ATTENDANCE_EDITED",
      entityType: "attendance",
      entityId: id,
      oldData: {
        check_in_time: old.check_in_time,
        check_out_time: old.check_out_time,
        is_late: old.is_late,
        is_early_leave: old.is_early_leave,
        status: old.status,
      },
      newData: {
        check_in_time: checkIn,
        check_out_time: checkOut,
        is_late: Boolean(checkIn) && late,
        is_early_leave: Boolean(checkOut) && early,
        status: "CORRECTED",
      },
      reason: parsed.data.reason,
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ attendance });
  } catch (err) {
    const mapped = sessionErrorResponse(err);
    if (mapped) return mapped;
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
