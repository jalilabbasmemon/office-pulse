import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";
import { nextEmployeeId } from "@/lib/employees/generate";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const roleParam = request.nextUrl.searchParams.get("role");
    const role =
      roleParam === "ADMIN"
        ? "ADMIN"
        : roleParam === "ADMIN_VIEWER"
          ? "ADMIN_VIEWER"
          : "EMPLOYEE";

    const supabase = await createClient();
    const { data, error } = await supabase.from("employees").select("employee_id");
    if (error) throw error;

    const employee_id = nextEmployeeId(
      (data ?? []).map((e) => e.employee_id),
      role
    );
    return NextResponse.json({ employee_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    if (message === "EMPLOYEE_INACTIVE") return apiError("EMPLOYEE_INACTIVE", 403);
    if (message === "MUST_CHANGE_PASSWORD") return apiError("FORBIDDEN", 403, "You must change your temporary password before continuing.");
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
