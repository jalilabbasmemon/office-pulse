import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";

export async function GET() {
  try {
    await requireAdminAccess();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*, employees:admin_id(name, employee_id)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ logs: data });
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
