import { apiError } from "@/lib/attendance/errors";

/** Map session helper throws to API responses; return null if not a known auth error. */
export function sessionErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  if (message === "UNAUTHORIZED") return apiError("UNAUTHORIZED", 401);
  if (message === "FORBIDDEN") return apiError("FORBIDDEN", 403);
  if (message === "EMPLOYEE_INACTIVE") return apiError("EMPLOYEE_INACTIVE", 403);
  if (message === "MUST_CHANGE_PASSWORD") {
    return apiError(
      "FORBIDDEN",
      403,
      "You must change your temporary password before continuing."
    );
  }
  return null;
}
