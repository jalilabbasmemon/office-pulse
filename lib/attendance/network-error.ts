import type { ApiErrorCode } from "@/types";

export function networkValidationMessage(
  code: ApiErrorCode,
  requestIp: string,
  allowedIps?: string[]
): string | undefined {
  if (code === "OFFICE_NOT_CONFIGURED") {
    return "No office locations are set. Ask an admin to open Settings and add HQ / branch coordinates.";
  }
  if (code === "GPS_REQUIRED") {
    const expected =
      allowedIps && allowedIps.length > 0 ? allowedIps.join(", ") : "not set";
    return `Not on office Wi‑Fi (your IP: ${requestIp || "unknown"}; office allows: ${expected}). Allow location and stand at a configured office / branch, or connect to office Wi‑Fi to skip GPS.`;
  }
  if (code === "OFFICE_NETWORK_REQUIRED") {
    const expected =
      allowedIps && allowedIps.length > 0 ? allowedIps.join(", ") : "not set";
    return `Office network not detected. Your public IP is ${requestIp || "unknown"}, but office allows: ${expected}. Use office Wi‑Fi, or punch with GPS at a branch.`;
  }
  if (code === "GPS_ACCURACY_TOO_LOW") {
    return undefined;
  }
  return undefined;
}
