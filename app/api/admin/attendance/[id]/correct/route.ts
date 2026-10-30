import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import { computeWorkMinutes } from "@/lib/attendance/timezone";
import { getRequestIp } from "@/lib/network/ip";
import { attendanceCorrectSchema } from "@/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
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
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!old) return apiError("ATTENDANCE_NOT_FOUND", 404);

    const checkIn = parsed.data.check_in_time ?? old.check_in_time;
    const checkOut = parsed.data.check_out_time ?? old.check_out_time;
    const total =
      checkIn && checkOut ? computeWorkMinutes(checkIn, checkOut) : null;

    const { data: attendance, error } = await supabase
      .from("attendance")
      .update({
        check_in_time: checkIn,
        check_out_time: checkOut,
        total_work_minutes: total,
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
      },
      newData: {
        check_in_time: checkIn,
        check_out_time: checkOut,
      },
      reason: parsed.data.reason,
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ attendance });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
