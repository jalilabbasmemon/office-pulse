import { createClient } from "@/lib/supabase/server";
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

export async function requireAdmin(): Promise<Employee> {
  const employee = await requireEmployee();
  if (employee.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  if (employee.status !== "ACTIVE") {
    throw new Error("EMPLOYEE_INACTIVE");
  }
  return employee;
}
