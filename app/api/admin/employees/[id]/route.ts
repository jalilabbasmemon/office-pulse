import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import { getRequestIp } from "@/lib/network/ip";
import { employeeUpdateSchema } from "@/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = employeeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", 400, parsed.error.issues[0]?.message);
    }

    const supabase = await createClient();
    const { data: old } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!old) return apiError("VALIDATION_ERROR", 404, "Employee not found");

    const { data: employee, error } = await supabase
      .from("employees")
      .update(parsed.data)
      .eq("id", id)
      .select("*, shifts(*)")
      .single();

    if (error) return apiError("VALIDATION_ERROR", 400, error.message);

    await writeAuditLog({
      adminId: admin.id,
      action: "EMPLOYEE_UPDATED",
      entityType: "employees",
      entityId: id,
      oldData: old,
      newData: employee,
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
