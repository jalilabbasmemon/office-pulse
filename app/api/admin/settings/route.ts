import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import { getRequestIp } from "@/lib/network/ip";
import { officeSettingsSchema } from "@/validations";

export async function GET() {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("office_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const parsed = officeSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", 400, parsed.error.issues[0]?.message);
    }

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("office_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    let settings;
    if (existing) {
      const { data, error } = await supabase
        .from("office_settings")
        .update({
          ...parsed.data,
          address: parsed.data.address ?? null,
          office_public_ip: parsed.data.office_public_ip ?? null,
          allowed_office_ips: parsed.data.allowed_office_ips ?? [],
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      settings = data;
    } else {
      const { data, error } = await supabase
        .from("office_settings")
        .insert({
          ...parsed.data,
          address: parsed.data.address ?? null,
          office_public_ip: parsed.data.office_public_ip ?? null,
          allowed_office_ips: parsed.data.allowed_office_ips ?? [],
        })
        .select("*")
        .single();
      if (error) throw error;
      settings = data;
    }

    await writeAuditLog({
      adminId: admin.id,
      action: "OFFICE_SETTINGS_UPDATED",
      entityType: "office_settings",
      entityId: settings.id,
      oldData: existing,
      newData: settings,
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
