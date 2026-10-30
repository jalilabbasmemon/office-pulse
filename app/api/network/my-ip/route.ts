import { NextRequest, NextResponse } from "next/server";
import { getRequestIp } from "@/lib/network/ip";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/attendance/errors";

/** Returns the public IP the server sees for this request. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("UNAUTHORIZED", 401);

    const ip = getRequestIp(request);
    return NextResponse.json({
      ip,
      tip: "Connect to office Wi‑Fi, then save this IP as Office public IP in Settings.",
    });
  } catch (err) {
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
