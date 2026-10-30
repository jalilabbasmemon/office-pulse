import type { GpsPayload, OfficeSettings } from "@/types";
import type { ApiErrorCode } from "@/types";
import { calculateDistanceMeters } from "@/lib/location/haversine";
import {
  getAllowedOfficeIps,
  hasOfficeIpConfigured,
  isOfficeNetwork,
  normalizeIp,
} from "@/lib/network/ip";

export type ValidationSuccess = {
  ok: true;
  distanceMeters: number;
  requestIp: string;
};

export type ValidationFailure = {
  ok: false;
  code: ApiErrorCode;
  requestIp: string;
  allowedIps?: string[];
};

export function validateAttendanceLocation(
  gps: GpsPayload | null | undefined,
  office: OfficeSettings,
  requestIp: string
): ValidationSuccess | ValidationFailure {
  const normalizedRequestIp = normalizeIp(requestIp);

  if (!hasOfficeIpConfigured(office.office_public_ip, office.allowed_office_ips)) {
    return {
      ok: false,
      code: "OFFICE_NOT_CONFIGURED",
      requestIp: normalizedRequestIp,
      allowedIps: [],
    };
  }

  if (
    !isOfficeNetwork(
      normalizedRequestIp,
      office.office_public_ip,
      office.allowed_office_ips
    )
  ) {
    return {
      ok: false,
      code: "OFFICE_NETWORK_REQUIRED",
      requestIp: normalizedRequestIp,
      allowedIps: getAllowedOfficeIps(
        office.office_public_ip,
        office.allowed_office_ips
      ),
    };
  }

  if (
    gps == null ||
    typeof gps.latitude !== "number" ||
    typeof gps.longitude !== "number" ||
    Number.isNaN(gps.latitude) ||
    Number.isNaN(gps.longitude)
  ) {
    return { ok: false, code: "GPS_REQUIRED", requestIp: normalizedRequestIp };
  }

  if (
    typeof gps.accuracy !== "number" ||
    Number.isNaN(gps.accuracy) ||
    gps.accuracy > office.max_gps_accuracy_meters
  ) {
    return {
      ok: false,
      code: "GPS_ACCURACY_TOO_LOW",
      requestIp: normalizedRequestIp,
    };
  }

  const distanceMeters = calculateDistanceMeters(
    gps.latitude,
    gps.longitude,
    office.latitude,
    office.longitude
  );

  if (distanceMeters > office.allowed_radius_meters) {
    return {
      ok: false,
      code: "OUTSIDE_OFFICE",
      requestIp: normalizedRequestIp,
    };
  }

  return {
    ok: true,
    distanceMeters,
    requestIp: normalizedRequestIp,
  };
}
