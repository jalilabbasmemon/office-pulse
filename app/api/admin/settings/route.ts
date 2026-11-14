import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireAdminAccess } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import { getRequestIp } from "@/lib/network/ip";
import { officeSettingsSchema } from "@/validations";

function dbMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = String((err as { message?: string }).message ?? "");
    if (msg) return msg;
  }
  if (err instanceof Error && err.message) return err.message;
  return "Server error";
}

function needsLocationsMigration(message: string): boolean {
  return /office_locations|does not exist|schema cache|Could not find the table/i.test(
    message
  );
}

function needsWifiColumnMigration(message: string): boolean {
  return /allow_wifi_only_punch/i.test(message);
}

export async function GET() {
  try {
    await requireAdminAccess();
    const supabase = await createClient();
    const { data: settings, error } = await supabase
      .from("office_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    const { data: locations, error: locError } = await supabase
      .from("office_locations")
      .select("*")
      .order("sort_order", { ascending: true });

    if (locError) {
      const msg = dbMessage(locError);
      if (needsLocationsMigration(msg)) {
        return NextResponse.json({
          settings,
          locations: [],
          warning:
            "Run supabase/migration_office_locations.sql in Supabase SQL Editor, then reload.",
        });
      }
      throw locError;
    }

    return NextResponse.json({
      settings,
      locations: locations ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500, dbMessage(err));
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
    const settingsPayload: Record<string, unknown> = {
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
      let { data, error } = await supabase
        .from("office_settings")
        .update(settingsPayload)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error && needsWifiColumnMigration(dbMessage(error))) {
        delete settingsPayload.allow_wifi_only_punch;
        const retry = await supabase
          .from("office_settings")
          .update(settingsPayload)
          .eq("id", existing.id)
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        const msg = dbMessage(error);
        if (needsWifiColumnMigration(msg) || needsLocationsMigration(msg)) {
          return apiError(
            "VALIDATION_ERROR",
            400,
            "Database migration required. Run supabase/migration_office_locations.sql in Supabase SQL Editor, then save again."
          );
        }
        throw error;
      }
      settings = data;
    } else {
      let { data, error } = await supabase
        .from("office_settings")
        .insert(settingsPayload)
        .select("*")
        .single();

      if (error && needsWifiColumnMigration(dbMessage(error))) {
        delete settingsPayload.allow_wifi_only_punch;
        const retry = await supabase
          .from("office_settings")
          .insert(settingsPayload)
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      settings = data;
    }

    const { data: oldLocations, error: oldLocError } = await supabase
      .from("office_locations")
      .select("*")
      .order("sort_order", { ascending: true });

    if (oldLocError) {
      const msg = dbMessage(oldLocError);
      if (needsLocationsMigration(msg)) {
        return apiError(
          "VALIDATION_ERROR",
          400,
          "office_locations table is missing. Run supabase/migration_office_locations.sql in Supabase SQL Editor, then save again."
        );
      }
      throw oldLocError;
    }

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
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          // ID from client no longer exists — insert instead
          const inserted = await supabase
            .from("office_locations")
            .insert(row)
            .select("*")
            .single();
          if (inserted.error) throw inserted.error;
          savedLocations.push(inserted.data);
        } else {
          savedLocations.push(data);
        }
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

    try {
      await writeAuditLog({
        adminId: admin.id,
        action: "OFFICE_SETTINGS_UPDATED",
        entityType: "office_settings",
        entityId: settings.id,
        oldData: { settings: existing, locations: oldLocations },
        newData: { settings, locations: savedLocations },
        ipAddress: getRequestIp(request),
      });
    } catch (auditErr) {
      // Don't block save if audit insert fails
      console.error("audit log failed", auditErr);
    }

    return NextResponse.json({ settings, locations: savedLocations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    const detail = dbMessage(err);
    if (needsLocationsMigration(detail) || needsWifiColumnMigration(detail)) {
      return apiError(
        "VALIDATION_ERROR",
        400,
        "Database migration required. Run supabase/migration_office_locations.sql in Supabase SQL Editor, then save again."
      );
    }
    return apiError("SERVER_ERROR", 500, detail);
  }
}
