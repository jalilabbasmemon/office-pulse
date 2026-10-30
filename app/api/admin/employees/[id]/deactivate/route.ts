import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import { getRequestIp } from "@/lib/network/ip";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: old } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!old) return apiError("VALIDATION_ERROR", 404, "Employee not found");

    const { data: employee, error } = await supabase
      .from("employees")
      .update({ status: "INACTIVE" })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;

    await writeAuditLog({
      adminId: admin.id,
      action: "EMPLOYEE_DEACTIVATED",
      entityType: "employees",
      entityId: id,
      oldData: { status: old.status },
      newData: { status: "INACTIVE" },
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ employee });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
