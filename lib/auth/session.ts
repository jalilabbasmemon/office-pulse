import { createClient } from "@/lib/supabase/server";
import { canWriteAdmin, isAdminStaff } from "@/lib/auth/roles";
import type { Employee } from "@/types";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getCurrentEmployee(): Promise<Employee | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("*, shifts(*)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Employee;
}

export async function requireEmployee(): Promise<Employee> {
  const employee = await getCurrentEmployee();
  if (!employee) {
    throw new Error("UNAUTHORIZED");
  }
  return employee;
}

/** Full admin only — mutations (create/edit/delete/correct/settings). */
export async function requireAdmin(): Promise<Employee> {
  const employee = await requireEmployee();
  if (!canWriteAdmin(employee.role)) {
    throw new Error("FORBIDDEN");
  }
  if (employee.status !== "ACTIVE") {
    throw new Error("EMPLOYEE_INACTIVE");
  }
  return employee;
}

/** Admin or Admin Viewer — read-only admin APIs and pages. */
export async function requireAdminAccess(): Promise<Employee> {
  const employee = await requireEmployee();
  if (!isAdminStaff(employee.role)) {
    throw new Error("FORBIDDEN");
  }
  if (employee.status !== "ACTIVE") {
    throw new Error("EMPLOYEE_INACTIVE");
  }
  return employee;
}
