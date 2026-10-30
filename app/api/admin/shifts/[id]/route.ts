import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/auth/audit";
import { apiError } from "@/lib/attendance/errors";
import { getRequestIp } from "@/lib/network/ip";
import { shiftSchema } from "@/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = shiftSchema.partial().safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", 400, parsed.error.issues[0]?.message);
    }

    const supabase = await createClient();
    const { data: old } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    const { data: shift, error } = await supabase
      .from("shifts")
      .update(parsed.data)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    await writeAuditLog({
      adminId: admin.id,
      action: "SHIFT_UPDATED",
      entityType: "shifts",
      entityId: id,
      oldData: old,
      newData: shift,
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json({ shift });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
    if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
