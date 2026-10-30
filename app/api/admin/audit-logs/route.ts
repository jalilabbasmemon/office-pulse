import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";

export async function GET() {
  try {
    await requireAdmin();
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
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
