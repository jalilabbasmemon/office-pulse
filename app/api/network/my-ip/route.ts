import { NextRequest, NextResponse } from "next/server";
import {
  getAllowedOfficeIps,
  getRequestIp,
  isOfficeNetwork,
} from "@/lib/network/ip";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/attendance/errors";
import type { OfficeSettings } from "@/types";

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
    const { data: office } = await supabase
      .from("office_settings")
      .select("office_public_ip, allowed_office_ips")
      .limit(1)
      .maybeSingle();

    const settings = office as Pick<
      OfficeSettings,
      "office_public_ip" | "allowed_office_ips"
    > | null;

    const allowed = getAllowedOfficeIps(
      settings?.office_public_ip,
      settings?.allowed_office_ips
    );
    const matched = isOfficeNetwork(
      ip,
      settings?.office_public_ip,
      settings?.allowed_office_ips
    );

    return NextResponse.json(
      {
        ip,
        officeIps: allowed,
        matched,
        tip: matched
          ? "Your public IP matches the office network."
          : "Connect to office Wi‑Fi, or ask admin to update Office public IP in Settings.",
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
