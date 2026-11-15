import type { UserRole } from "@/types";

/** Full admin or read-only admin viewer — can open the admin area. */
export function isAdminStaff(role: UserRole | string | null | undefined): boolean {
  return role === "ADMIN" || role === "ADMIN_VIEWER";
}

/** Full admin only — can create/edit/delete. */
export function canWriteAdmin(role: UserRole | string | null | undefined): boolean {
  return role === "ADMIN";
}

export function adminHomePath(role: UserRole | string | null | undefined): string {
  return isAdminStaff(role) ? "/admin/dashboard" : "/dashboard";
}

/**
 * ADMIN_VIEWER may only use dashboard, employees, attendance, and reports.
 * Full ADMIN may use the entire admin area.
 */
export function canAccessAdminPath(
  role: UserRole | string | null | undefined,
  pathname: string
): boolean {
  if (role === "ADMIN") return true;
  if (role !== "ADMIN_VIEWER") return false;

  const allowed = [
    "/admin/dashboard",
    "/admin/employees",
    "/admin/attendance",
    "/admin/reports",
  ];
  return allowed.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
