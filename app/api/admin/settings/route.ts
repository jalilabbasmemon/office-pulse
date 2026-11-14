import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireAdminAccess } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import { getRequestIp } from "@/lib/network/ip";
import { officeSettingsSchema } from "@/validations";

export async function GET() {
  try {
    await requireAdminAccess();
    const supabase = await createClient();
    const [{ data: settings, error }, { data: locations }] = await Promise.all([
      supabase.from("office_settings").select("*").limit(1).maybeSingle(),
      supabase
        .from("office_locations")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);
    if (error) throw error;
    return NextResponse.json({
      settings,
      locations: locations ?? [],
    });
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

    const primary = parsed.data.locations[0];
    const settingsPayload = {
      office_name: parsed.data.office_name,
      address: parsed.data.address ?? primary.address ?? null,
      latitude: primary.latitude,
      longitude: primary.longitude,
      allowed_radius_meters: primary.allowed_radius_meters,
      office_public_ip: parsed.data.office_public_ip ?? null,
      allowed_office_ips: parsed.data.allowed_office_ips ?? [],
      max_gps_accuracy_meters: parsed.data.max_gps_accuracy_meters,
      allow_wifi_only_punch: parsed.data.allow_wifi_only_punch,
      timezone: parsed.data.timezone,
    };

    let settings;
    if (existing) {
      const { data, error } = await supabase
        .from("office_settings")
        .update(settingsPayload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      settings = data;
    } else {
      const { data, error } = await supabase
        .from("office_settings")
        .insert(settingsPayload)
        .select("*")
        .single();
      if (error) throw error;
      settings = data;
    }

    const { data: oldLocations } = await supabase
      .from("office_locations")
      .select("*")
      .order("sort_order", { ascending: true });

    const keepIds = parsed.data.locations
      .map((l) => l.id)
      .filter((id): id is string => Boolean(id));

    if ((oldLocations ?? []).length > 0) {
      const toDelete = (oldLocations ?? [])
        .map((l) => l.id as string)
        .filter((id) => !keepIds.includes(id));
      if (toDelete.length > 0) {
        const { error: delError } = await supabase
          .from("office_locations")
          .delete()
          .in("id", toDelete);
        if (delError) throw delError;
      }
    }

    const savedLocations = [];
    for (let i = 0; i < parsed.data.locations.length; i++) {
      const loc = parsed.data.locations[i];
      const row = {
        name: loc.name,
        address: loc.address ?? null,
        latitude: loc.latitude,
        longitude: loc.longitude,
        allowed_radius_meters: loc.allowed_radius_meters,
        is_active: loc.is_active,
        sort_order: loc.sort_order ?? i,
      };
      if (loc.id) {
        const { data, error } = await supabase
          .from("office_locations")
          .update(row)
          .eq("id", loc.id)
          .select("*")
          .single();
        if (error) throw error;
        savedLocations.push(data);
      } else {
        const { data, error } = await supabase
          .from("office_locations")
          .insert(row)
          .select("*")
          .single();
        if (error) throw error;
        savedLocations.push(data);
      }
    }

    await writeAuditLog({
      adminId: admin.id,
      action: "OFFICE_SETTINGS_UPDATED",
      entityType: "office_settings",
      entityId: settings.id,
      oldData: { settings: existing, locations: oldLocations },
      newData: { settings, locations: savedLocations },
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ settings, locations: savedLocations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
