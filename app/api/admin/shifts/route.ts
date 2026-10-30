import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import { getRequestIp } from "@/lib/network/ip";
import { shiftSchema } from "@/validations";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("shifts")
      .select("*")
      .order("start_time");
    if (error) throw error;
    return NextResponse.json({ shifts: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const parsed = shiftSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", 400, parsed.error.issues[0]?.message);
    }

    const supabase = await createClient();
    const { data: shift, error } = await supabase
      .from("shifts")
      .insert(parsed.data)
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      adminId: admin.id,
      action: "SHIFT_CREATED",
      entityType: "shifts",
      entityId: shift.id,
      newData: shift,
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ shift }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
