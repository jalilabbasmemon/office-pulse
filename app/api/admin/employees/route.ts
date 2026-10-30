import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import { getRequestIp } from "@/lib/network/ip";
import {
  generateTempPassword,
  nextEmployeeId,
} from "@/lib/employees/generate";
import { employeeCreateSchema } from "@/validations";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("employees")
      .select("*, shifts(*)")
      .order("employee_id");
    if (error) throw error;
    return NextResponse.json({ employees: data });
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
    const parsed = employeeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", 400, parsed.error.issues[0]?.message);
    }

    const supabase = await createClient();
    const role = parsed.data.role ?? "EMPLOYEE";

    let employeeId = parsed.data.employee_id?.toUpperCase();
    if (!employeeId) {
      const { data: existing } = await supabase
        .from("employees")
        .select("employee_id");
      employeeId = nextEmployeeId(
        (existing ?? []).map((e) => e.employee_id),
        role
      );
    }

    const tempPassword = parsed.data.password || generateTempPassword();

    const service = createServiceClient();
    const { data: authData, error: authError } =
      await service.auth.admin.createUser({
        email: parsed.data.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: parsed.data.name,
          employee_id: employeeId,
          must_change_password: true,
        },
      });

    if (authError || !authData.user) {
      return apiError(
        "VALIDATION_ERROR",
        400,
        authError?.message ?? "Could not create auth user"
      );
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .insert({
        employee_id: employeeId,
        auth_user_id: authData.user.id,
        name: parsed.data.name,
        mobile: parsed.data.mobile,
        designation: parsed.data.designation,
        shift_id: parsed.data.shift_id ?? null,
        role,
        status: "ACTIVE",
        must_change_password: true,
      })
      .select("*, shifts(*)")
      .single();

    if (error) {
      await service.auth.admin.deleteUser(authData.user.id);
      return apiError("VALIDATION_ERROR", 400, error.message);
    }

    await writeAuditLog({
      adminId: admin.id,
      action: "EMPLOYEE_CREATED",
      entityType: "employees",
      entityId: employee.id,
      newData: {
        employee_id: employee.employee_id,
        name: employee.name,
        role: employee.role,
      },
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json(
      {
        employee,
        credentials: {
          employee_id: employeeId,
          email: parsed.data.email,
          temporary_password: tempPassword,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
