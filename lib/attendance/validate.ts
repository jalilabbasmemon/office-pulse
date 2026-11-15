import type { GpsPayload, OfficeLocation, OfficeSettings } from "@/types";
import type { ApiErrorCode } from "@/types";
import { matchOfficeLocation } from "@/lib/location/match-office";
import {
  collectOfficeIpsFromLocations,
  hasOfficeIpConfigured,
  isOfficeNetwork,
  matchLocationByPublicIp,
  normalizeIp,
} from "@/lib/network/ip";

export type ValidationSuccess = {
  ok: true;
  distanceMeters: number | null;
  requestIp: string;
  /** True when accepted via office Wi‑Fi without GPS. */
  wifiOnly: boolean;
  storeGps: boolean;
  locationId: string | null;
  locationName: string | null;
};

export type ValidationFailure = {
  ok: false;
  code: ApiErrorCode;
  requestIp: string;
  allowedIps?: string[];
};

function wifiSkipGpsAllowed(office: OfficeSettings): boolean {
  return office.allow_wifi_only_punch !== false;
}

export { matchOfficeLocation };

/**
 * Hybrid punch rules:
 * 1) On a branch Wi‑Fi (public IP match for that location) → GPS not required.
 * 2) On org-level shared IP allow-list (legacy) → GPS not required, generic label.
 * 3) On any other network → GPS must match one of the configured office locations.
 */
export function validateAttendanceLocation(
  gps: GpsPayload | null | undefined,
  office: OfficeSettings,
  locations: OfficeLocation[],
  requestIp: string
): ValidationSuccess | ValidationFailure {
  const normalizedRequestIp = normalizeIp(requestIp);
  const activeLocations = locations.filter((l) => l.is_active);

  if (activeLocations.length === 0) {
    return {
      ok: false,
      code: "OFFICE_NOT_CONFIGURED",
      requestIp: normalizedRequestIp,
    };
  }

  const locationByIp = matchLocationByPublicIp(
    normalizedRequestIp,
    activeLocations
  );

  const onOrgWifi =
    hasOfficeIpConfigured(office.office_public_ip, office.allowed_office_ips) &&
    isOfficeNetwork(
      normalizedRequestIp,
      office.office_public_ip,
      office.allowed_office_ips
    );

  const onOfficeWifi = Boolean(locationByIp) || onOrgWifi;

  const hasCoords =
    gps != null &&
    typeof gps.latitude === "number" &&
    typeof gps.longitude === "number" &&
    !Number.isNaN(gps.latitude) &&
    !Number.isNaN(gps.longitude);

  if (hasCoords) {
    const match = matchOfficeLocation(
      gps,
      activeLocations,
      office.max_gps_accuracy_meters
    );
    if (match) {
      return {
        ok: true,
        distanceMeters: match.distanceMeters,
        requestIp: normalizedRequestIp,
        wifiOnly: false,
        storeGps: true,
        locationId: match.location.id,
        locationName: match.location.name,
      };
    }
  }

  // Office Wi‑Fi path: skip GPS when enabled
  if (onOfficeWifi && wifiSkipGpsAllowed(office)) {
    if (locationByIp) {
      return {
        ok: true,
        distanceMeters: null,
        requestIp: normalizedRequestIp,
        wifiOnly: true,
        storeGps: false,
        locationId: locationByIp.id,
        locationName: locationByIp.name,
      };
    }
    return {
      ok: true,
      distanceMeters: null,
      requestIp: normalizedRequestIp,
      wifiOnly: true,
      storeGps: false,
      locationId: null,
      locationName: "Office Wi‑Fi",
    };
  }

  if (!hasCoords) {
    return {
      ok: false,
      code: "GPS_REQUIRED",
      requestIp: normalizedRequestIp,
      allowedIps: collectOfficeIpsFromLocations(
        activeLocations,
        office.office_public_ip,
        office.allowed_office_ips
      ),
    };
  }

  if (
    typeof gps!.accuracy !== "number" ||
    Number.isNaN(gps!.accuracy) ||
    gps!.accuracy > office.max_gps_accuracy_meters
  ) {
    return {
      ok: false,
      code: "GPS_ACCURACY_TOO_LOW",
      requestIp: normalizedRequestIp,
    };
  }

  return {
    ok: false,
    code: "OUTSIDE_OFFICE",
    requestIp: normalizedRequestIp,
  };
}
