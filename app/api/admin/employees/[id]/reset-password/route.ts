import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import { getRequestIp } from "@/lib/network/ip";
import { generateTempPassword } from "@/lib/employees/generate";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  password: z.string().min(8).optional(),
});

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const raw = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", 400, parsed.error.issues[0]?.message);
    }

    const supabase = await createClient();
    const { data: employee, error: loadError } = await supabase
      .from("employees")
      .select("id, auth_user_id, employee_id, name, status")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      return apiError("SERVER_ERROR", 500, loadError.message);
    }
    if (!employee) {
      return apiError("VALIDATION_ERROR", 404, "Employee not found");
    }
    if (!employee.auth_user_id) {
      return apiError(
        "VALIDATION_ERROR",
        400,
        "Employee has no linked login account."
      );
    }

    const temporaryPassword =
      parsed.data.password?.trim() || generateTempPassword();

    let service;
    try {
      service = createServiceClient();
    } catch (envErr) {
      const msg = envErr instanceof Error ? envErr.message : "Config error";
      return apiError(
        "SERVER_ERROR",
        500,
        `${msg}. Set SUPABASE_SECRET_KEY (service_role JWT) as a Cloudflare Secret, then redeploy.`
      );
    }

    const { error: authError } = await service.auth.admin.updateUserById(
      employee.auth_user_id,
      { password: temporaryPassword }
    );
    if (authError) {
      return apiError(
        "VALIDATION_ERROR",
        400,
        `Could not reset login password: ${authError.message}`
      );
    }

    const { error: flagError } = await service
      .from("employees")
      .update({ must_change_password: true })
      .eq("id", employee.id);

    if (flagError) {
      // Password was already reset; warn but still return the temp password
      console.error("must_change_password update failed", flagError);
      return NextResponse.json({
        message:
          "Temporary password set, but could not flag must_change_password. Run migration_must_change_password.sql in Supabase. Share the temp password anyway.",
        warning: flagError.message,
        credentials: {
          employee_id: employee.employee_id,
          name: employee.name,
          temporary_password: temporaryPassword,
        },
      });
    }

    try {
      await writeAuditLog({
        adminId: admin.id,
        action: "EMPLOYEE_PASSWORD_RESET",
        entityType: "employees",
        entityId: employee.id,
        newData: {
          employee_id: employee.employee_id,
          must_change_password: true,
        },
        reason: "Admin reset password",
        ipAddress: getRequestIp(request),
      });
    } catch (auditErr) {
      console.error("audit log failed", auditErr);
    }

    return NextResponse.json({
      message:
        "Temporary password set. Share it with the employee; they must change it after login.",
      credentials: {
        employee_id: employee.employee_id,
        name: employee.name,
        temporary_password: temporaryPassword,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error("reset-password error", err);
    return apiError(
      "SERVER_ERROR",
      500,
      message || "Password reset failed. Check Cloudflare SUPABASE_SECRET_KEY."
    );
  }
}
