import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";
import { nextEmployeeId } from "@/lib/employees/generate";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const roleParam = request.nextUrl.searchParams.get("role");
    const role = roleParam === "ADMIN" ? "ADMIN" : "EMPLOYEE";

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
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
