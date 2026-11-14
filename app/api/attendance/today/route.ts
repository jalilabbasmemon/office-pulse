import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";
import { getTodayInTimezone } from "@/lib/attendance/timezone";
import type { OfficeSettings } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const employee = await getCurrentEmployee();
    if (!employee) return apiError("UNAUTHORIZED", 401);

    const supabase = await createClient();
    const [{ data: office }, { data: locations }] = await Promise.all([
      supabase.from("office_settings").select("*").limit(1).maybeSingle(),
      supabase
        .from("office_locations")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    const timezone = (office as OfficeSettings | null)?.timezone ?? "Asia/Karachi";
    const today = getTodayInTimezone(timezone);

    const { data: attendance } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    const officeWithLocations = office
      ? { ...(office as OfficeSettings), locations: locations ?? [] }
      : null;

    return NextResponse.json(
      { attendance, office: officeWithLocations, locations: locations ?? [], employee, today },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("today error", err);
    return apiError("SERVER_ERROR", 500);
  }
}
