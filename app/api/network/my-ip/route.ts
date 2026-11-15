import { NextRequest, NextResponse } from "next/server";
import {
  collectOfficeIpsFromLocations,
  getRequestIp,
  isOfficeNetwork,
  matchLocationByPublicIp,
} from "@/lib/network/ip";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/attendance/errors";
import type { OfficeLocation, OfficeSettings } from "@/types";

export const dynamic = "force-dynamic";

/** Returns the public IP the server sees for this request + match vs office. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("UNAUTHORIZED", 401);

    const ip = getRequestIp(request);
    const [{ data: office }, { data: locations }] = await Promise.all([
      supabase
        .from("office_settings")
        .select("office_public_ip, allowed_office_ips")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("office_locations")
        .select("id, name, is_active, allowed_public_ips")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    const settings = office as Pick<
      OfficeSettings,
      "office_public_ip" | "allowed_office_ips"
    > | null;
    const activeLocations = (locations as OfficeLocation[] | null) ?? [];

    const allowed = collectOfficeIpsFromLocations(
      activeLocations,
      settings?.office_public_ip,
      settings?.allowed_office_ips
    );
    const locationMatch = matchLocationByPublicIp(ip, activeLocations);
    const orgMatched = isOfficeNetwork(
      ip,
      settings?.office_public_ip,
      settings?.allowed_office_ips
    );
    const matched = Boolean(locationMatch) || orgMatched;

    return NextResponse.json(
      {
        ip,
        officeIps: allowed,
        matched,
        locationName: locationMatch?.name ?? null,
        tip: locationMatch
          ? `${locationMatch.name} Wi‑Fi detected — GPS is optional for punch.`
          : matched
            ? "Office Wi‑Fi detected — GPS is optional for punch."
            : "Other network — GPS must match an HQ / branch, or connect to office Wi‑Fi.",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
