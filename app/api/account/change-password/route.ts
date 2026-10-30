import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/auth/session";
import { apiError } from "@/lib/attendance/errors";
import { changePasswordSchema } from "@/validations";

export async function POST(request: NextRequest) {
  try {
    const employee = await getCurrentEmployee();
    if (!employee) return apiError("UNAUTHORIZED", 401);

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", 400, parsed.error.issues[0]?.message);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return apiError("UNAUTHORIZED", 401);

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.current_password,
    });
    if (reauthError) {
      return apiError("VALIDATION_ERROR", 400, "Current password is incorrect.");
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.new_password,
    });
    if (updateError) {
      return apiError("VALIDATION_ERROR", 400, updateError.message);
    }

    // Clear flag with service role (employees cannot update own row under RLS)
    const service = createServiceClient();
    await service
      .from("employees")
      .update({ must_change_password: false })
      .eq("id", employee.id)
      .eq("auth_user_id", user.id);

    return NextResponse.json({
      message: "Password updated.",
      role: employee.role,
    });
  } catch (err) {
    console.error(err);
    return apiError("SERVER_ERROR", 500);
  }
}
