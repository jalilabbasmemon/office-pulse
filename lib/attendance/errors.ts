import { NextResponse } from "next/server";
import type { ApiError, ApiErrorCode } from "@/types";

const MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: "Please log in to continue.",
  FORBIDDEN: "You do not have permission to perform this action.",
  EMPLOYEE_INACTIVE:
    "Your account is inactive. Please contact your administrator.",
  ALREADY_CHECKED_IN: "You have already checked in today.",
  ALREADY_CHECKED_OUT: "You have already checked out today.",
  NOT_CHECKED_IN:
    "You cannot check out because you have not checked in today.",
  OFFICE_NETWORK_REQUIRED:
    "Office network not detected. Connect to office Wi‑Fi, or use GPS at an office location.",
  GPS_REQUIRED:
    "You are not on office Wi‑Fi, so location is required. Allow location and stand at an office / branch.",
  GPS_ACCURACY_TOO_LOW:
    "GPS accuracy is too low. Please move to an open area and try again.",
  OUTSIDE_OFFICE:
    "You are outside every configured office location. Move inside a branch radius, or connect to office Wi‑Fi.",
  ATTENDANCE_NOT_FOUND: "Attendance record not found.",
  INVALID_ATTENDANCE_STATE: "This attendance action is not allowed right now.",
  OFFICE_NOT_CONFIGURED:
    "No office locations are configured. Ask an admin to add HQ / branch pins in Settings.",
  VALIDATION_ERROR: "Invalid request data.",
  SERVER_ERROR: "Something went wrong. Please try again.",
};

export function apiError(
  code: ApiErrorCode,
  status: number,
  message?: string
): NextResponse<ApiError> {
  return NextResponse.json(
    { code, message: message ?? MESSAGES[code] },
    { status }
  );
}

export { MESSAGES as ERROR_MESSAGES };
