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
    "Office network not detected. Please connect to the office Wi-Fi and try again.",
  GPS_REQUIRED:
    "Location access is required to check in. Please allow location access in your browser settings.",
  GPS_ACCURACY_TOO_LOW:
    "GPS accuracy is too low. Please move to an open area and try again.",
  OUTSIDE_OFFICE:
    "You are outside the office location. Please connect to the office Wi-Fi and make sure you are physically inside the office.",
  ATTENDANCE_NOT_FOUND: "Attendance record not found.",
  INVALID_ATTENDANCE_STATE: "This attendance action is not allowed right now.",
  OFFICE_NOT_CONFIGURED:
    "Office public IP is not configured. Ask an admin to set Office public IP in Settings.",
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
