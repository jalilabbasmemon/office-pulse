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
