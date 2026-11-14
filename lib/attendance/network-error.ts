import type { ApiErrorCode } from "@/types";

export function networkValidationMessage(
  code: ApiErrorCode,
  requestIp: string,
  allowedIps?: string[]
): string | undefined {
  if (code === "OFFICE_NOT_CONFIGURED") {
    return "Office public IP is not set. Ask an admin to open Settings → Use my current IP → Save.";
  }
  if (code === "OFFICE_NETWORK_REQUIRED") {
    const expected =
      allowedIps && allowedIps.length > 0 ? allowedIps.join(", ") : "not set";
    return `Office network not detected. Your public IP is ${requestIp || "unknown"}, but office allows: ${expected}. Switch to office Wi‑Fi. On iPhone Safari, turn off iCloud Private Relay / Limit IP Address Tracking for this site, then try again.`;
  }
  if (code === "GPS_ACCURACY_TOO_LOW") {
    return undefined; // default message is fine; UI also shows numbers
  }
  return undefined;
}
