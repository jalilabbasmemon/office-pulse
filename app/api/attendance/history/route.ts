import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";

export async function GET(request: NextRequest) {
  try {
    const employee = await getCurrentEmployee();
    if (!employee) return apiError("UNAUTHORIZED", 401);

    const month =
      request.nextUrl.searchParams.get("month") ??
      new Date().toISOString().slice(0, 7);

    const [year, mon] = month.split("-").map(Number);
    const start = `${year}-${String(mon).padStart(2, "0")}-01`;
    const endDate = new Date(year, mon, 0).getDate();
    const end = `${year}-${String(mon).padStart(2, "0")}-${endDate}`;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", employee.id)
      .gte("attendance_date", start)
      .lte("attendance_date", end)
      .order("attendance_date", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ records: data ?? [], month });
  } catch (err) {
    console.error("history error", err);
    return apiError("SERVER_ERROR", 500);
  }
}
