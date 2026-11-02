import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;

    if (id === admin.id) {
      return apiError(
        "VALIDATION_ERROR",
        400,
        "You cannot delete your own admin account."
      );
    }

    const supabase = await createClient();
    const { data: old } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!old) return apiError("VALIDATION_ERROR", 404, "Employee not found");

    let service;
    try {
      service = createServiceClient();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Service client missing";
      return apiError(
        "SERVER_ERROR",
        500,
        `${msg}. Set SUPABASE_SECRET_KEY as a Cloudflare Secret, then redeploy.`
      );
    }

    // Remove dependent rows first (attendance FK has no cascade).
    const { error: attendanceError } = await service
      .from("attendance")
      .delete()
      .eq("employee_id", id);
    if (attendanceError) {
      return apiError("VALIDATION_ERROR", 400, attendanceError.message);
    }

    // Keep audit history; clear FK if this person was the acting admin.
    await service
      .from("audit_logs")
      .update({ admin_id: null })
      .eq("admin_id", id);

    const { error: employeeError } = await service
      .from("employees")
      .delete()
      .eq("id", id);
    if (employeeError) {
      return apiError("VALIDATION_ERROR", 400, employeeError.message);
    }

    const { error: authError } = await service.auth.admin.deleteUser(
      old.auth_user_id
    );
    if (authError) {
      console.error("Auth user delete failed after employee row removed", authError);
    }

    await writeAuditLog({
      adminId: admin.id,
      action: "EMPLOYEE_DELETED",
      entityType: "employees",
      entityId: id,
      oldData: {
        employee_id: old.employee_id,
        name: old.name,
        role: old.role,
        status: old.status,
      },
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
